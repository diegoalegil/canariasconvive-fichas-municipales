# Exportación del libro BASE_DATOS_CANCON.xlsx a JSON para la web, con las
# funciones de lectura del cuaderno FICHAS_MUNICIPALES.ipynb. Los cuatro índices
# se leen ya calculados del Excel (en las provincias, que no tienen hojas, se
# calculan con las fórmulas del libro); la TVMA y los puestos se calculan aquí.
#
#  Salida:  web/datos/indice.json           · municipios, islas y provincias
#           web/datos/mun/<codmun>.json     · una ficha por municipio
#           web/datos/isla/<slug>.json      · una ficha por isla, con las hojas «I»
#           web/datos/provincia/<slug>.json · una ficha por provincia, sumando sus islas
#           web/datos/canarias.json         · la ficha de Canarias, con las hojas «R»
import json
import math
import sqlite3
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd
from correcciones_libro import cruzar_si_procede, descuadres
from territorios import ISLAS, COMARCAS, PROVINCIAS, EXC_GEO

RUTA = Path.home() / "Downloads" / "BASE_DATOS_CANCON.xlsx"
RUTA_GEO = Path.home() / "Downloads" / "MUNICIPIOS.gpkg"
SALIDA = Path(__file__).parent / "web" / "datos"

EXCLUIR = ["Frontera (hasta 2007)"]  # columna previa a la segregación de El Pinar
ANIO_BASE_VAR = 2000                 # ventana de variación acumulada y TVMA

LIBRO = pd.ExcelFile(RUTA, engine="openpyxl")
_CACHE = {}


def _hoja(nombre):
    if nombre not in _CACHE:
        _CACHE[nombre] = pd.read_excel(LIBRO, sheet_name=nombre, header=None)
    return _CACHE[nombre]


def _norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return s.strip().lower()


# ---------------------------------------------------------------- lectores ---
# Idénticos a los del notebook. Cualquier cambio ahí debe replicarse aquí.

def preparar(hoja):
    """Hojas de pirámide (C23, C24): municipio en fila 1, sexo en fila 2."""
    df = _hoja(hoja).copy()
    sexos = df.iloc[1].astype(str).str.strip().str.lower()
    es_dato = sexos.str.startswith(("hombre", "mujer"))
    col_edad = df.columns[~es_dato][-1]
    nombres = df.iloc[0].ffill()
    edades = (df.iloc[2:23, col_edad].astype(str).str.strip()
                .str.replace("De ", "", regex=False)
                .str.replace(" años", "", regex=False).tolist())
    datos = df.iloc[2:23].loc[:, es_dato].apply(pd.to_numeric, errors="coerce")
    return nombres[es_dato], sexos[es_dato], edades, datos


def ultima_serie(hoja):
    """({territorio: valor}, año) del último año con datos completos."""
    df = _hoja(hoja).copy()
    nombres = [str(x).strip() for x in df.iloc[0, 2:]]
    validos = [n for n in nombres if n not in EXCLUIR]
    umbral = max(1, int(len(validos) * 0.9))

    cuerpo = df.iloc[1:].copy()
    cuerpo[1] = pd.to_numeric(cuerpo[1], errors="coerce")
    cuerpo = cuerpo.dropna(subset=[1]).sort_values(1, ascending=False)

    for _, fila in cuerpo.iterrows():
        valores = pd.to_numeric(fila.iloc[2:], errors="coerce")
        d = {n: v for n, v in zip(nombres, valores.tolist())
             if n not in EXCLUIR and pd.notna(v)}
        if len(d) >= umbral:
            return d, int(fila[1])
    raise ValueError(f"{hoja}: sin ningún año completo")


def serie_completa(hoja):
    """(años, {territorio: [valores]}) de toda la serie histórica."""
    df = _hoja(hoja).copy()
    nombres = [str(x).strip() for x in df.iloc[0, 2:]]
    cuerpo = df.iloc[1:].copy()
    cuerpo[1] = pd.to_numeric(cuerpo[1], errors="coerce")
    cuerpo = cuerpo.dropna(subset=[1]).sort_values(1)
    anios = cuerpo[1].astype(int).tolist()
    series = {}
    for j, n in enumerate(nombres):
        if n in EXCLUIR:
            continue
        series[n] = pd.to_numeric(cuerpo.iloc[:, j + 2], errors="coerce").tolist()
    return anios, series


CAT_ORIGEN = ["Canarias", "Resto de España", "Extranjero"]


def reparto_origen(hoja, categorias=CAT_ORIGEN, absolutos=False):
    """Doble cabecera sin columna de años. {territorio: [cat1, cat2, cat3]}."""
    df = _hoja(hoja).copy()
    cats = df.iloc[1].map(_norm)
    validas = {_norm(c): c for c in categorias}
    es_dato = cats.isin(validas)
    if not es_dato.any():
        raise ValueError(f"{hoja}: cabeceras no coinciden con {categorias}")

    terr = df.iloc[0].ffill()
    fila = df.iloc[2]

    bruto = {}
    for c in df.columns[es_dato]:
        t = str(terr[c]).strip()
        if t in EXCLUIR:
            continue
        bruto.setdefault(t, {})[validas[cats[c]]] = pd.to_numeric(fila[c], errors="coerce")

    out = {}
    for t, d in bruto.items():
        v = [d.get(c, np.nan) for c in categorias]
        if all(pd.notna(x) for x in v) and sum(v) > 0:
            out[t] = v if absolutos else [x / sum(v) * 100 for x in v]
    return out


def _sin_nulos(x, y):
    pares = [(a, v) for a, v in zip(x, y)
             if v is not None and isinstance(v, (int, float, np.floating)) and np.isfinite(v)]
    if not pares:
        raise ValueError("serie sin ningún dato")
    return [a for a, _ in pares], [float(v) for _, v in pares]


# ------------------------------------------------------- islas y comarcas ---
ISLA_DE = {m: i for i, ms in ISLAS.items() for m in ms}
COMARCA_DE = {m: c for c, ms in COMARCAS.items() for m in ms}


# ------------------------------------------------------------------ carga ---
print("Leyendo el Excel…")

NM, SM, EDADES, DM = preparar("C23M")          # pirámide total, municipios
NR, SR, _, DR = preparar("C23R")               # pirámide total, Canarias
NMX, SMX, _, DMX = preparar("C24M")            # pirámide origen extranjero, mun.
NI, SI, _, DI = preparar("C23I")               # pirámide total, islas
NIX, SIX, _, DIX = preparar("C24I")            # pirámide origen extranjero, islas
NRX, SRX, _, DRX = preparar("C24R")            # pirámide origen extranjero, Canarias

MUNICIPIOS = list(dict.fromkeys(NM.tolist()))


def piramide(nombres, sexos, datos, entidad):
    """(hombres, mujeres) en absolutos para una entidad. None si no está."""
    cols = nombres[nombres == entidad].index
    if len(cols) == 0:
        return None, None
    ch = [c for c in cols if sexos[c].startswith("hombre")]
    cm = [c for c in cols if sexos[c].startswith("mujer")]
    if not ch or not cm:
        return None, None
    return datos[ch[0]].to_numpy(float), datos[cm[0]].to_numpy(float)


POB_M, ANIO_POB = ultima_serie("C1M")
POB_R, _ = ultima_serie("C1R")
POB_CANARIAS = POB_R["Canarias"]
POB_I, _ = ultima_serie("C1I")

_orden = sorted(POB_M, key=POB_M.get, reverse=True)
PUESTO_CAN = {m: i + 1 for i, m in enumerate(_orden)}
# Puesto de cada isla por población entre las siete.
PUESTO_ISLAS = {i: n + 1 for n, i in enumerate(sorted(ISLAS, key=POB_I.get, reverse=True))}
PUESTO_ISLA, PUESTO_COMARCA = {}, {}
for _isla, _muns in ISLAS.items():
    for i, m in enumerate(sorted(_muns, key=POB_M.get, reverse=True)):
        PUESTO_ISLA[m] = (i + 1, len(_muns))
for _com, _muns in COMARCAS.items():
    for i, m in enumerate(sorted(_muns, key=POB_M.get, reverse=True)):
        PUESTO_COMARCA[m] = (i + 1, len(_muns))

ANIOS_C1, SERIE_C1 = serie_completa("C1M")
ANIOS_C6, SERIE_C6 = serie_completa("C6M")
ANIOS_C7, SERIE_C7 = serie_completa("C7M")
ANIOS_C22, SERIE_C22 = serie_completa("C22M")
_, SERIE_C22_R = serie_completa("C22R")

# Las mismas series por isla (hojas «I»). C1I arranca en 2000, no en 1996.
ANIOS_C1I, SERIE_C1I = serie_completa("C1I")
ANIOS_C6I, SERIE_C6I = serie_completa("C6I")
ANIOS_C7I, SERIE_C7I = serie_completa("C7I")
ANIOS_C22I, SERIE_C22I = serie_completa("C22I")

ORIGEN_M = reparto_origen("C25M")
ORIGEN_R = reparto_origen("C25R")
ORIGEN_I = reparto_origen("C25I")
ORIGEN_I_ABS = reparto_origen("C25I", absolutos=True)   # en personas, para sumar las provincias

# Canarias, de las hojas «R». Desde el libro del 24/9/2026, C1R es la suma de C1I
# y arranca en 2000, como las de isla (antes venía de otra fuente desde 1971 y
# hasta 2020 no cuadraba con las islas); la ficha se acota igualmente a los años
# de las islas por si el libro volviera a traer más.
ANIOS_C1R, SERIE_C1R = serie_completa("C1R")
ANIOS_C6R, SERIE_C6R = serie_completa("C6R")
ANIOS_C7R, SERIE_C7R = serie_completa("C7R")


def _agregado_extranjero(isla, anio):
    """(nacidos fuera de España, población) de una isla sumando sus municipios
    (C22M por C1M). None si a algún municipio le falta el dato ese año (El
    Hierro antes de 2007, sin Frontera ni El Pinar)."""
    ext = pob = 0.0
    for mun in ISLAS[isla]:
        p = _por_anio(ANIOS_C1, SERIE_C1[mun]).get(anio)
        v = _por_anio(ANIOS_C22, SERIE_C22[mun]).get(anio)
        if p is None or v is None:
            return None
        ext += v * p / 100
        pob += p
    return (ext, pob) if pob else None


def conciliar_extranjero_islas(tolerancia=1.0):
    """C22I contra la suma de sus municipios, año a año, en personas. Si una
    isla no cuadra pero su recuento es el de otra isla y el de la otra es el
    suyo, las dos columnas van cambiadas en el libro ese año (C2I, de donde
    sale C22I): se corrige aquí y se avisa para que se arregle en el Excel
    (el libro del 15/9/2026 traía Lanzarote y Fuerteventura intercambiadas de
    2021 a 2025, los años de la operación censal; Pedro lo corrigió el 16/9 y
    el cruce se conserva por si vuelve a pasar, como los de
    correcciones_libro.py). Cualquier otro descuadre detiene la exportación: la
    ficha de la isla diría un dato distinto del de sus municipios."""
    cuadra = lambda a, b: a is not None and b is not None and abs(a - b) <= tolerancia
    pob_i = {i: _por_anio(ANIOS_C1I, SERIE_C1I[i]) for i in ISLAS}
    agregados = {(i, a): _agregado_extranjero(i, a) for i in ISLAS for a in ANIOS_C22I}
    # Personas que dice la hoja para cada isla y año (porcentaje por población insular).
    def hoja(isla, j, anio):
        v, p = SERIE_C22I[isla][j], pob_i[isla].get(anio)
        return None if v is None or p is None or not np.isfinite(v) else v * p / 100
    cambios = {}
    for j, anio in enumerate(ANIOS_C22I):
        for isla in ISLAS:
            agg = agregados[(isla, anio)]
            if agg is None or cuadra(hoja(isla, j, anio), agg[0]):
                continue
            otra = next((o for o in ISLAS if o != isla and agregados[(o, anio)] is not None
                         and cuadra(hoja(isla, j, anio), agregados[(o, anio)][0])
                         and cuadra(hoja(o, j, anio), agg[0])), None)
            if otra is None:
                raise SystemExit(f"C22I {isla} {anio}: la hoja da {hoja(isla, j, anio):.0f} nacidos fuera y sus "
                                 f"municipios suman {agg[0]:.0f}. Revisar el libro antes de exportar.")
            par = tuple(sorted([isla, otra]))
            if anio in cambios.get(par, []):
                continue
            # A cada isla, sus personas sobre su población.
            SERIE_C22I[isla][j] = agg[0] / pob_i[isla][anio] * 100
            SERIE_C22I[otra][j] = agregados[(otra, anio)][0] / pob_i[otra][anio] * 100
            cambios.setdefault(par, []).append(anio)
    for (a, b), anios in cambios.items():
        print(f"  ⚠ C22I: {a} y {b} vienen intercambiadas en {anios[0]}–{anios[-1]} "
              f"({len(anios)} años); se corrige en la exportación. Hay que arreglarlo en el libro (C2I).")
    return cambios


# Los cuatro índices de la ficha. codigo: (etiqueta, multiplicador, decimales, unidad)
INDICES = {
    "C10": ("Envejecimiento", 1, 2, ""),
    "C11": ("Juventud", 100, 1, "%"),
    "C17": ("Dependencia", 1, 1, "%"),
    "C14": ("Reemplazo laboral", 1, 1, "%"),
}

DATOS_IND, ANIO_IND = {}, {}
for cod in INDICES:
    d, anios = {}, []
    for niv in ("M", "I", "R"):
        d[niv], a = ultima_serie(cod + niv)
        anios.append(a)
    DATOS_IND[cod] = d
    ANIO_IND[cod] = min(anios)
    print(f"  {cod} · {INDICES[cod][0]}: {len(d['M'])} municipios · {ANIO_IND[cod]}")

LIBRO.close()
_CACHE.clear()


# ------------------------------------------------------------ geometrías ---
# codmun (código INE) leído del GeoPackage por SQLite, sin geopandas/GDAL.
con = sqlite3.connect(f"file:{RUTA_GEO}?mode=ro", uri=True)
_eq = {_norm(m): m for m in ISLA_DE}
COD_DE = {}
for cod, nom in con.execute('SELECT codmun, municipio FROM "Municipios_canarias"'):
    nombre = EXC_GEO.get(int(cod), _eq.get(_norm(nom)))
    if nombre:
        COD_DE[nombre] = int(cod)
con.close()

_sin_cod = [m for m in MUNICIPIOS if m not in COD_DE]
if _sin_cod:
    raise SystemExit(f"Sin código INE en el GeoPackage: {_sin_cod}. "
                     "Revisar los nombres o EXC_GEO en territorios.py antes de exportar.")


# --------------------------------------------------------------- cálculos ---
# Edad media aproximada con los grupos quinquenales de la pirámide: marcas de
# clase 2,5; 7,5; …; 97,5 años, y 102 para el grupo de 100 o más.
MARCAS = [2.5 + 5 * i for i in range(20)] + [102.0]


def edad_media(h, m):
    total = h + m
    return float((total * np.array(MARCAS)).sum() / total.sum())


def _ventana(x, y, anio_base):
    """(valores por año, primer año de la ventana, último año): la ventana
    arranca en `anio_base` o, si la serie empieza después, en su primer año."""
    d = dict(zip(x, y))
    posteriores = [a for a in x if a >= anio_base]
    return d, (posteriores[0] if posteriores else x[0]), x[-1]


def variacion(x, y, anio_base=ANIO_BASE_VAR):
    """(% acumulado, año inicial real, año final)."""
    d, a0, a1 = _ventana(x, y, anio_base)
    if not d[a0]:
        return None, a0, a1
    return (d[a1] / d[a0] - 1) * 100, a0, a1


def tvma(x, y, anio_base=ANIO_BASE_VAR):
    """Tasa de variación media anual, %."""
    d, a0, a1 = _ventana(x, y, anio_base)
    n = a1 - a0
    if not d[a0] or n <= 0:
        return None
    return ((d[a1] / d[a0]) ** (1 / n) - 1) * 100


def r2(v, dec=2):
    """Redondea para el JSON. None si no es finito; con dec=None, el valor
    entero tal cual (para las series que la web redondea al mostrarlas)."""
    if v is None or not np.isfinite(v):
        return None
    return float(v) if dec is None else round(float(v), dec)


def reparto_cien(pct):
    """Lugar de nacimiento con un decimal y sumando 100,0 (Pedro, 22/9/2026):
    redondeados por separado, los tres daban 99,9 o 100,1 en 35 repartos.
    «Extranjero» conserva su redondeo, que es el último dato de la serie de
    origen extranjero (invariantes.py lo exige), y las décimas que quedan se
    reparten entre Canarias y Resto de España por el mayor resto."""
    if any(v is None or not np.isfinite(v) for v in pct):
        return [r2(v, 1) for v in pct]
    ext = round(float(pct[2]), 1)
    decimas = [float(v) * 10 for v in pct[:2]]
    suelo = [math.floor(d) for d in decimas]
    faltan = round(1000 - ext * 10) - sum(suelo)
    if not 0 <= faltan <= 2:
        raise SystemExit(f"lugar de nacimiento {pct}: las décimas no cuadran ({faltan})")
    for k in sorted(range(2), key=lambda k: suelo[k] - decimas[k])[:faltan]:
        suelo[k] += 1
    return [suelo[0] / 10, suelo[1] / 10, ext]


def serie_json(anios, valores, dec=3):
    """Empareja años y valores descartando huecos."""
    x, y = _sin_nulos(anios, valores)
    return {"anios": x, "valores": [r2(v, dec) for v in y]}


def desde(anio, anios, valores):
    """La serie (años, valores) a partir de `anio`."""
    pares = [(a, v) for a, v in zip(anios, valores) if a >= anio]
    return [a for a, _ in pares], [v for _, v in pares]


def _por_anio(anios, valores):
    return {a: v for a, v in zip(anios, valores)
            if v is not None and isinstance(v, (int, float, np.floating)) and np.isfinite(v)}


def combinar(series, dec=3):
    """Alinea varias series POR AÑO, no por posición.

    Imprescindible: las hojas no comparten ventana temporal (C6M va de 1999 a
    2024 y C7M de 2002 a 2024). Emparejarlas por índice desplaza una respecto
    de la otra sin que salte ningún error.

    series = {clave: (anios, valores)} -> {"anios": [...], clave: [...], ...}
    """
    mapas = {k: _por_anio(a, v) for k, (a, v) in series.items()}
    anios = sorted(set().union(*(m.keys() for m in mapas.values())))
    out = {"anios": anios}
    for k, m in mapas.items():
        out[k] = [r2(m[a], dec) if a in m else None for a in anios]
    return out


UMBRAL_ANOMALIA = 0.20   # de la población actual del municipio
# Los únicos valores apartados hasta ahora, con su explicación. Si el umbral
# salta en otro municipio o año, la exportación se detiene: hay que mirar el
# dato y escribir su motivo antes de publicar, no etiquetarlo a ciegas.
ANOMALIAS_CONOCIDAS = {("El Pinar de El Hierro", 2007), ("Frontera", 2007)}


def depurar_componentes(comp, poblacion, mun):
    """Aparta a `anomalias` los valores que no pueden ser un flujo anual real:
    en 2007 El Pinar se segregó de Frontera y el ISTAC anotó el traspaso de
    vecinos como saldo migratorio (+1.880 y −1.757), que multiplicaba por 40 la
    escala del gráfico. La ficha los anota en vez de fingir que no hay dato."""
    anomalias = []
    for clave in ("vegetativo", "migratorio"):
        for i, (anio, v) in enumerate(zip(comp["anios"], comp[clave])):
            if v is not None and abs(v) > poblacion * UMBRAL_ANOMALIA:
                if (mun, anio) not in ANOMALIAS_CONOCIDAS:
                    raise SystemExit(f"{mun} {anio}: {clave} = {v:g} supera el umbral de anomalía y no está "
                                     "en ANOMALIAS_CONOCIDAS. Revisar el dato antes de exportar.")
                anomalias.append({"anio": anio, "serie": clave, "valor": v,
                                  "motivo": "cambio administrativo de términos municipales"})
                comp[clave][i] = None
    if anomalias:
        comp["anomalias"] = anomalias
    return comp


def conciliar_componentes():
    """C6M y C7M contra C6I y C7I: cada isla tiene que sumar sus municipios en
    cada año con datos. Las celdas cruzadas conocidas (correcciones_libro.py)
    se cruzan de vuelta, avisando, solo si el libro sigue con el error; cualquier
    otro descuadre detiene la exportación."""
    for hoja, anios, series, anios_i, series_i in (("C6M", ANIOS_C6, SERIE_C6, ANIOS_C6I, SERIE_C6I),
                                                    ("C7M", ANIOS_C7, SERIE_C7, ANIOS_C7I, SERIE_C7I)):
        por_mun = {m: _por_anio(anios, v) for m, v in series.items()}
        por_isla = {i: _por_anio(anios_i, v) for i, v in series_i.items()}
        try:
            aplicadas = cruzar_si_procede(hoja, por_mun, por_isla, ISLA_DE)
        except ValueError as e:
            raise SystemExit(str(e))
        for a, b, anio in aplicadas:
            # De vuelta a las listas alineadas con los años, que es lo que exporta la ficha.
            for m in (a, b):
                series[m] = [por_mun[m].get(x, np.nan) for x in anios]
            print(f"  ⚠ {hoja} {anio}: {a} y {b} vienen cruzados; se corrige en la exportación. "
                  "Hay que arreglarlo en el libro.")
        malos = descuadres(por_mun, por_isla, ISLA_DE)
        if malos:
            raise SystemExit(f"{hoja}: la suma de los municipios no da la hoja insular en "
                             + "; ".join(f"{i} {a} ({s:.0f} frente a {t:.0f})" for i, a, s, t in malos)
                             + ". Revisar el libro antes de exportar.")


# ----------------------------------------------------------------- export ---
conciliar_extranjero_islas()   # corrige SERIE_C22I sobre la marcha; necesita _por_anio, definida arriba
conciliar_componentes()

(SALIDA / "mun").mkdir(parents=True, exist_ok=True)

H_CAN, M_CAN = piramide(NR, SR, DR, "Canarias")
POB_PIR_CAN = H_CAN.sum() + M_CAN.sum()

fichas = []
todas_las_fichas = []
for mun in MUNICIPIOS:
    isla = ISLA_DE[mun]
    comarca = COMARCA_DE[mun]

    h, m = piramide(NM, SM, DM, mun)
    hx, mx = piramide(NMX, SMX, DMX, mun)
    pob_pir = h.sum() + m.sum()

    x1, y1 = _sin_nulos(ANIOS_C1, SERIE_C1[mun])
    var, a0, a1 = variacion(x1, y1)

    ficha = {
        "tipo": "municipio",
        "codmun": COD_DE.get(mun),
        "nombre": mun,
        "isla": isla,
        "comarca": comarca,
        "anio": ANIO_POB,
        "poblacion": int(POB_M[mun]),

        "evolucion": {
            **serie_json(ANIOS_C1, SERIE_C1[mun], 0),
            "variacion_acumulada": r2(var, 1),
            "anio_base": a0,
            "anio_fin": a1,
        },

        # Sin redondeo intermedio: la web muestra un decimal y redondea una sola vez.
        "extranjero": combinar({
            "municipio": (ANIOS_C22, SERIE_C22[mun]),
            "canarias": (ANIOS_C22, SERIE_C22_R["Canarias"]),
        }, None),

        "cifras": {
            "tvma": tvma(x1, y1),  # sin redondear: la web redondea una sola vez
            "edad_media": r2(edad_media(h, m), 1),
            "hombres": int(h.sum()),
            "mujeres": int(m.sum()),
            "pct_hombres": r2(h.sum() / pob_pir * 100, 1),
            "pct_mujeres": r2(m.sum() / pob_pir * 100, 1),
        },

        "rankings": {
            "canarias": {
                "puesto": PUESTO_CAN[mun], "total": len(POB_M),
                "peso": r2(POB_M[mun] / POB_CANARIAS * 100, 2),
            },
            "isla": {
                "puesto": PUESTO_ISLA[mun][0], "total": PUESTO_ISLA[mun][1],
                "peso": r2(POB_M[mun] / POB_I[isla] * 100, 2),
            },
            "comarca": {
                "puesto": PUESTO_COMARCA[mun][0], "total": PUESTO_COMARCA[mun][1],
                "peso": r2(POB_M[mun] / sum(POB_M[x] for x in COMARCAS[comarca]) * 100, 2),
            },
        },

        # Pirámides del municipio en absolutos; Canarias en porcentaje. "extranjera" es C24.
        "piramide": {
            "edades": EDADES,
            "hombres": [int(v) for v in h],
            "mujeres": [int(v) for v in m],
            "canarias_hombres": [r2(v / POB_PIR_CAN * 100, 3) for v in H_CAN],
            "canarias_mujeres": [r2(v / POB_PIR_CAN * 100, 3) for v in M_CAN],
            "extranjera_hombres": None if hx is None else [int(v) for v in hx],
            "extranjera_mujeres": None if mx is None else [int(v) for v in mx],
        },

        "indices": {
            cod: {
                "etiqueta": INDICES[cod][0],
                "anio": ANIO_IND[cod],
                "unidad": INDICES[cod][3],
                "municipio": r2(DATOS_IND[cod]["M"].get(mun, np.nan) * INDICES[cod][1],
                                INDICES[cod][2]),
                "isla": r2(DATOS_IND[cod]["I"].get(isla, np.nan) * INDICES[cod][1],
                           INDICES[cod][2]),
                "canarias": r2(DATOS_IND[cod]["R"].get("Canarias", np.nan) * INDICES[cod][1],
                               INDICES[cod][2]),
            }
            for cod in INDICES
        },

        "componentes": depurar_componentes(combinar({
            "vegetativo": (ANIOS_C6, SERIE_C6[mun]),
            "migratorio": (ANIOS_C7, SERIE_C7.get(mun, [np.nan] * len(ANIOS_C7))),
        }, 0), int(POB_M[mun]), mun),

        "origen": {
            "categorias": CAT_ORIGEN,
            "municipio": reparto_cien(ORIGEN_M.get(mun, [np.nan] * 3)),
            "canarias": reparto_cien(ORIGEN_R["Canarias"]),
        },
    }

    cod = ficha["codmun"]
    with open(SALIDA / "mun" / f"{cod}.json", "w", encoding="utf-8") as fh:
        json.dump(ficha, fh, ensure_ascii=False, separators=(",", ":"))

    fichas.append({
        "codmun": cod, "nombre": mun, "isla": isla,
        "comarca": comarca, "poblacion": ficha["poblacion"],
    })
    todas_las_fichas.append(ficha)

# Un solo orden de islas para toda la web (portada, selectores y dossier), de
# oeste a este; el orden del diccionario se conserva en el JSON y en JavaScript.
ORDEN_ISLAS = ["El Hierro", "La Palma", "La Gomera", "Tenerife", "Gran Canaria", "Fuerteventura", "Lanzarote"]
assert set(ORDEN_ISLAS) == set(ISLAS), "ORDEN_ISLAS no coincide con las islas de territorios.py"


# ------------------------------------------------------ fichas agregadas ----
# Isla, provincia y Canarias comparten la forma: la misma ficha que la municipal
# salvo lo que no tiene sentido por encima del municipio (en vez de comarca y
# tres mapas, su sitio en Canarias y la lista de lo que contiene; en los índices,
# el valor de las islas para ordenarlas). La clave de la serie propia es el tipo
# («isla», «provincia»; en Canarias la propia y la referencia son la misma,
# «canarias»). Las islas salen de las hojas «I» y Canarias de las «R». Las dos
# provincias no tienen hojas: se suman desde sus islas. Población, pirámides,
# componentes y lugar de nacimiento son sumas exactas; el origen extranjero se
# suma en personas; los cuatro índices se calculan sobre la pirámide sumada con
# las fórmulas del libro, que reproducen exactamente sus hojas para las siete
# islas y Canarias (se comprueba abajo antes de usarlas).
def slug_de(nombre):
    """Identificador en direcciones y ficheros: «gran-canaria», «las-palmas»."""
    return _norm(nombre).replace(" ", "-")


def indices_de_piramide(h, m):
    """Los cuatro índices con las fórmulas del libro (guia.js) sobre los grupos
    quinquenales: 0-14 (tres grupos), 15-64 (diez), 65 y más, 15-19 y 60-64."""
    t = h + m
    p0, p15, p65 = t[:3].sum(), t[3:13].sum(), t[13:].sum()
    return {"C10": p65 / p0, "C11": p0 / p15 * 100, "C17": (p0 + p65) / p15 * 100, "C14": t[3] / t[12] * 100}


def indice_del_libro(cod, nivel, nombre):
    return r2(DATOS_IND[cod][nivel].get(nombre, np.nan) * INDICES[cod][1], INDICES[cod][2])


PIR_I = {isla: piramide(NI, SI, DI, isla) for isla in ISLAS}
PIRX_I = {isla: piramide(NIX, SIX, DIX, isla) for isla in ISLAS}
for isla, (h, m) in PIR_I.items():
    if h is None or PIRX_I[isla][0] is None:
        raise SystemExit(f"{isla}: sin pirámide en C23I o C24I")
for cod in INDICES:
    if ANIO_IND[cod] != ANIO_POB:
        raise SystemExit(f"{cod}: el índice es de {ANIO_IND[cod]} y la pirámide de {ANIO_POB}; "
                         "las provincias no se pueden calcular sobre la pirámide sumada.")
for nombre, (h, m) in [*PIR_I.items(), ("Canarias", (H_CAN, M_CAN))]:
    nivel = "R" if nombre == "Canarias" else "I"
    for cod, v in indices_de_piramide(h, m).items():
        if r2(v, INDICES[cod][2]) != indice_del_libro(cod, nivel, nombre):
            raise SystemExit(f"{nombre} {cod}: la fórmula da {v:.3f} y el libro {indice_del_libro(cod, nivel, nombre)}; "
                             "sin fórmula fiable no se calculan los índices provinciales.")

def sumar_por_anio(mapas):
    """Suma varias series {año: valor} en los años en que todas tienen dato."""
    comunes = sorted(set.intersection(*(set(s) for s in mapas)))
    return comunes, [sum(s[a] for s in mapas) for a in comunes]


def extranjero_sumado(islas):
    """Serie de origen extranjero de varias islas juntas: personas (C22I por
    C1I) sobre la población conjunta, año a año."""
    pobs = {i: _por_anio(ANIOS_C1I, SERIE_C1I[i]) for i in islas}
    pcts = {i: _por_anio(ANIOS_C22I, SERIE_C22I[i]) for i in islas}
    anios = sorted(set.intersection(*(set(pobs[i]) & set(pcts[i]) for i in islas)))
    return anios, [sum(pcts[i][a] * pobs[i][a] for i in islas) / sum(pobs[i][a] for i in islas) for a in anios]


def ficha_agregada(tipo, nombre, poblacion, serie_pob, serie_ext, h, m, hx, mx,
                   vegetativo, migratorio, origen, indices_propios, islas_indices, contenido):
    """La ficha de una isla, una provincia o Canarias. `serie_*`, `vegetativo` y
    `migratorio` son (años, valores); `origen`, el reparto en porcentaje;
    `indices_propios`, {código: valor ya en su unidad}; `islas_indices`, las
    islas que van en la escalera de los índices; `contenido`, lo que la ficha
    lista (rankings, municipios, islas, provincias)."""
    x1, y1 = _sin_nulos(*serie_pob)
    var, a0, a1 = variacion(x1, y1)
    pob_pir = h.sum() + m.sum()
    if not (int(poblacion) == int(pob_pir)):
        raise SystemExit(f"{nombre}: población {poblacion:.0f} y pirámide {pob_pir:.0f} no coinciden")
    es_canarias = tipo == "canarias"
    propio = (lambda valor: {} if es_canarias else {tipo: valor})
    return {
        "tipo": tipo,
        "slug": slug_de(nombre),
        "nombre": nombre,
        "anio": ANIO_POB,
        "poblacion": int(poblacion),

        "evolucion": {
            **serie_json(*serie_pob, 0),
            "variacion_acumulada": r2(var, 1),
            "anio_base": a0,
            "anio_fin": a1,
        },

        "extranjero": combinar({**propio(serie_ext), "canarias": (ANIOS_C22, SERIE_C22_R["Canarias"])}, None),

        "cifras": {
            "tvma": tvma(x1, y1),
            "edad_media": r2(edad_media(h, m), 1),
            "hombres": int(h.sum()),
            "mujeres": int(m.sum()),
            "pct_hombres": r2(h.sum() / pob_pir * 100, 1),
            "pct_mujeres": r2(m.sum() / pob_pir * 100, 1),
        },

        **contenido,

        "piramide": {
            "edades": EDADES,
            "hombres": [int(v) for v in h],
            "mujeres": [int(v) for v in m],
            "canarias_hombres": [r2(v / POB_PIR_CAN * 100, 3) for v in H_CAN],
            "canarias_mujeres": [r2(v / POB_PIR_CAN * 100, 3) for v in M_CAN],
            "extranjera_hombres": [int(v) for v in hx],
            "extranjera_mujeres": [int(v) for v in mx],
        },

        "indices": {
            cod: {
                "etiqueta": INDICES[cod][0],
                "anio": ANIO_IND[cod],
                "unidad": INDICES[cod][3],
                **propio(r2(indices_propios[cod], INDICES[cod][2])),
                "canarias": indice_del_libro(cod, "R", "Canarias"),
                "islas": {isla: indice_del_libro(cod, "I", isla) for isla in islas_indices},
            }
            for cod in INDICES
        },

        "componentes": depurar_componentes(combinar({
            "vegetativo": vegetativo,
            "migratorio": migratorio,
        }, 0), int(poblacion), nombre),

        "origen": {
            "categorias": CAT_ORIGEN,
            **propio(reparto_cien(origen)),
            "canarias": reparto_cien(ORIGEN_R["Canarias"]),
        },
    }


def escribir_agregada(ficha, carpeta=None):
    destino = SALIDA / carpeta / f"{ficha['slug']}.json" if carpeta else SALIDA / f"{ficha['slug']}.json"
    destino.parent.mkdir(parents=True, exist_ok=True)
    with open(destino, "w", encoding="utf-8") as fh:
        json.dump(ficha, fh, ensure_ascii=False, separators=(",", ":"))
    todas_las_fichas.append(ficha)


def resumen_municipios(fichas_mun, total):
    """De mayor a menor población, con el peso en el ámbito (`total`)."""
    return [{"codmun": f["codmun"], "nombre": f["nombre"], "poblacion": f["poblacion"],
             "peso": r2(f["poblacion"] / total * 100, 2)}
            for f in sorted(fichas_mun, key=lambda f: -f["poblacion"])]


# ----------------------------------------------------------- islas ---------
fichas_islas = []
for isla in ORDEN_ISLAS:
    h, m = PIR_I[isla]
    suyos = [f for f in fichas if f["isla"] == isla]
    suma_mun = sum(f["poblacion"] for f in suyos)
    # La isla tiene que ser la suma de sus municipios en las tres hojas; si el
    # ISTAC las publicara desacompasadas, la ficha mentiría: mejor detenerse.
    if not (int(POB_I[isla]) == int(h.sum() + m.sum()) == suma_mun):
        raise SystemExit(f"{isla}: C1I {POB_I[isla]:.0f}, pirámide {h.sum() + m.sum():.0f} y suma de municipios {suma_mun} no coinciden")
    ficha = ficha_agregada(
        "isla", isla, POB_I[isla],
        (ANIOS_C1I, SERIE_C1I[isla]), (ANIOS_C22I, SERIE_C22I[isla]),
        h, m, *PIRX_I[isla],
        (ANIOS_C6I, SERIE_C6I[isla]), (ANIOS_C7I, SERIE_C7I[isla]),
        ORIGEN_I[isla], indices_de_piramide(h, m), ORDEN_ISLAS,
        {
            "rankings": {"canarias": {"puesto": PUESTO_ISLAS[isla], "total": len(ISLAS),
                                      "peso": r2(POB_I[isla] / POB_CANARIAS * 100, 2)}},
            # Sus municipios de mayor a menor población, con el peso en la isla (el
            # mismo que lleva cada ficha municipal en rankings.isla.peso).
            "municipios": resumen_municipios(suyos, POB_I[isla]),
        })
    escribir_agregada(ficha, "isla")
    fichas_islas.append({"slug": ficha["slug"], "nombre": isla, "poblacion": ficha["poblacion"],
                         "municipios": len(suyos)})

# ------------------------------------------------------- provincias --------
ORDEN_PROVINCIAS = list(PROVINCIAS)   # de oeste a este, como las islas
fichas_provincias = []
for prov in ORDEN_PROVINCIAS:
    islas = PROVINCIAS[prov]
    pob = sum(POB_I[i] for i in islas)
    suyos = [f for f in fichas if ISLA_DE[f["nombre"]] in islas]
    if int(pob) != sum(f["poblacion"] for f in suyos):
        raise SystemExit(f"{prov}: las islas suman {pob:.0f} y los municipios {sum(f['poblacion'] for f in suyos)}")
    h = sum(PIR_I[i][0] for i in islas)
    m = sum(PIR_I[i][1] for i in islas)
    hx = sum(PIRX_I[i][0] for i in islas)
    mx = sum(PIRX_I[i][1] for i in islas)
    origen_abs = [sum(ORIGEN_I_ABS[i][k] for i in islas) for k in range(3)]
    ficha = ficha_agregada(
        "provincia", prov, pob,
        sumar_por_anio([_por_anio(ANIOS_C1I, SERIE_C1I[i]) for i in islas]), extranjero_sumado(islas),
        h, m, hx, mx,
        sumar_por_anio([_por_anio(ANIOS_C6I, SERIE_C6I[i]) for i in islas]),
        sumar_por_anio([_por_anio(ANIOS_C7I, SERIE_C7I[i]) for i in islas]),
        [v / sum(origen_abs) * 100 for v in origen_abs], indices_de_piramide(h, m), islas,
        {
            # Sin puesto: entre dos provincias no hay clasificación que valga, solo el peso.
            "rankings": {"canarias": {"peso": r2(pob / POB_CANARIAS * 100, 2)}},
            "islas": [{"slug": slug_de(i), "nombre": i, "poblacion": int(POB_I[i]),
                       "peso": r2(POB_I[i] / pob * 100, 2), "municipios": len(ISLAS[i])}
                      for i in sorted(islas, key=POB_I.get, reverse=True)],
            "municipios": resumen_municipios(suyos, pob),
        })
    escribir_agregada(ficha, "provincia")
    fichas_provincias.append({"slug": ficha["slug"], "nombre": prov, "poblacion": ficha["poblacion"],
                              "islas": [slug_de(i) for i in islas], "municipios": len(suyos)})

# --------------------------------------------------------- Canarias --------
if int(POB_CANARIAS) != int(sum(POB_I.values())) or int(POB_CANARIAS) != int(POB_PIR_CAN):
    raise SystemExit(f"Canarias: C1R {POB_CANARIAS:.0f}, islas {sum(POB_I.values()):.0f} y pirámide {POB_PIR_CAN:.0f} no coinciden")
HX_CAN, MX_CAN = piramide(NRX, SRX, DRX, "Canarias")
if HX_CAN is None:
    raise SystemExit("Canarias: sin pirámide de origen extranjero en C24R")
ficha_canarias = ficha_agregada(
    "canarias", "Canarias", POB_CANARIAS,
    desde(ANIOS_C1I[0], ANIOS_C1R, SERIE_C1R["Canarias"]), (ANIOS_C22, SERIE_C22_R["Canarias"]),
    H_CAN, M_CAN, HX_CAN, MX_CAN,
    (ANIOS_C6R, SERIE_C6R["Canarias"]), (ANIOS_C7R, SERIE_C7R["Canarias"]),
    ORIGEN_R["Canarias"], indices_de_piramide(H_CAN, M_CAN), ORDEN_ISLAS,
    {
        "provincias": [{"slug": p["slug"], "nombre": p["nombre"], "poblacion": p["poblacion"],
                        "peso": r2(p["poblacion"] / POB_CANARIAS * 100, 2),
                        "islas": len(p["islas"]), "municipios": p["municipios"]}
                       for p in sorted(fichas_provincias, key=lambda p: -p["poblacion"])],
        "islas": [{"slug": slug_de(i), "nombre": i, "poblacion": int(POB_I[i]),
                   "peso": r2(POB_I[i] / POB_CANARIAS * 100, 2), "municipios": len(ISLAS[i]),
                   "provincia": next(p for p, islas in PROVINCIAS.items() if i in islas)}
                  for i in sorted(ISLAS, key=POB_I.get, reverse=True)],
    })
escribir_agregada(ficha_canarias)

# El último dato regional de origen extranjero, para la portada (sin redondear).
_ext_canarias = _sin_nulos(ANIOS_C22, SERIE_C22_R["Canarias"])[1][-1]

indice = {
    "anio": ANIO_POB,
    "poblacion_canarias": int(POB_CANARIAS),
    "extranjero_canarias": float(_ext_canarias),
    "municipios": sorted(fichas, key=lambda f: _norm(f["nombre"])),
    "islas": {i: sorted(ISLAS[i], key=_norm) for i in ORDEN_ISLAS},
    # Las siete islas de oeste a este, con lo que necesita la portada.
    "islas_resumen": fichas_islas,
    # Las dos provincias, de oeste a este, con los identificadores de sus islas.
    "provincias": fichas_provincias,
}
with open(SALIDA / "indice.json", "w", encoding="utf-8") as fh:
    json.dump(indice, fh, ensure_ascii=False, separators=(",", ":"))

# ---------------------------------------------------------------------------
# El eje de cada pirámide lo calcula la web (ejeAutomatico en web/comun.js): el
# entero más pequeño que cubre el grupo más numeroso de la pestaña, cada
# población sobre su propio total. Aquí se repite el cálculo para dejar escrito
# el reparto en cada exportación y avisar de un eje por encima de 14.
def _eje_automatico(maximo):
    return max(1, math.ceil(maximo - 1e-9))

def _modal(H, M):
    tot = sum(H) + sum(M)
    return max(max(H), max(M)) / tot * 100 if tot else 0.0

_ejes = {"canarias": [], "municipio": []}
for f in todas_las_fichas:   # las 88 municipales, las 7 insulares, las 2 provinciales y Canarias
    pi = f["piramide"]
    _ejes["canarias"].append((_eje_automatico(max(_modal(pi["hombres"], pi["mujeres"]),
                                                  max(pi["canarias_hombres"] + pi["canarias_mujeres"]))), f["nombre"]))
    if pi.get("extranjera_hombres"):
        eh, em = pi["extranjera_hombres"], pi["extranjera_mujeres"]
        esph = [max(0, a - b) for a, b in zip(pi["hombres"], eh)]
        espm = [max(0, a - b) for a, b in zip(pi["mujeres"], em)]
        _ejes["municipio"].append((_eje_automatico(max(_modal(esph, espm), _modal(eh, em))), f["nombre"]))
for _clave, _lista in _ejes.items():
    _reparto = {}
    for _e, _n in _lista:
        _reparto.setdefault(_e, []).append(_n)
    print(f"\nEje de la pestaña «{_clave}»: " + " · ".join(
        f"{_e} % en {len(_ns)}" + (f" ({', '.join(sorted(_ns))})" if len(_ns) <= 3 else "")
        for _e, _ns in sorted(_reparto.items())))
    _raros = [(e, n) for e, n in _lista if e > 14]
    if _raros:
        raise SystemExit(
            f"\nLa pestaña «{_clave}» necesita un eje de más de 14 % y eso no ha pasado nunca: revisar los datos.\n"
            + "\n".join(f"  {n}: {e} %" for e, n in _raros))

_peso = sum(p.stat().st_size for p in (SALIDA / "mun").glob("*.json"))
print(f"\n{len(fichas)} fichas escritas en {SALIDA/'mun'}, {len(fichas_islas)} en {SALIDA/'isla'}, "
      f"{len(fichas_provincias)} en {SALIDA/'provincia'} y Canarias en {SALIDA/'canarias.json'}")
print(f"Peso total: {_peso/1024:.0f} KB  ·  media {_peso/len(fichas)/1024:.1f} KB por ficha")

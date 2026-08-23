# =============================================================================
#  FICHAS MUNICIPALES · CANARIAS CONVIVE
#  Exportación de la base de datos a JSON para la versión web.
#
#  Reutiliza literalmente las funciones de lectura de FICHAS_MUNICIPALES.ipynb
#  (celdas 1-4, Pedro Delgado). No recalcula ningún indicador: los índices
#  estructurales se leen ya calculados desde el Excel.
#
#  Salida:  web/datos/indice.json     · listado de municipios + metadatos
#           web/datos/mun/<codmun>.json · una ficha por municipio
# =============================================================================
import json
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

RUTA = Path.home() / "Downloads" / "BASE_DATOS_CANCON.xlsx"
RUTA_GEO = Path.home() / "Downloads" / "MUNICIPIOS.gpkg"
SALIDA = Path(__file__).parent / "web" / "datos"

EXCLUIR = ["Frontera (hasta 2007)"]  # columna previa a la segregación de El Pinar
ANIO_BASE_VAR = 2000                 # ventana de variación acumulada y TVMA
ANIO_C25 = 2025

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
from territorios import ISLAS, COMARCAS, EXC_GEO  # noqa: E402

ISLA_DE = {m: i for i, ms in ISLAS.items() for m in ms}
COMARCA_DE = {m: c for c, ms in COMARCAS.items() for m in ms}


# ------------------------------------------------------------------ carga ---
print("Leyendo el Excel…")

NM, SM, EDADES, DM = preparar("C23M")          # pirámide total, municipios
NR, SR, _, DR = preparar("C23R")               # pirámide total, Canarias
NMX, SMX, _, DMX = preparar("C24M")            # pirámide origen extranjero, mun.
NRX, SRX, _, DRX = preparar("C24R")            # pirámide origen extranjero, Can.

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

ORIGEN_M = reparto_origen("C25M")
ORIGEN_R = reparto_origen("C25R")

# Índices de la ficha actual + los tres de "mirada de convivencia".
#   codigo: (etiqueta, multiplicador, decimales, unidad)
INDICES = {
    "C10": ("Envejecimiento", 1, 2, ""),
    "C11": ("Juventud", 100, 1, "%"),
    "C17": ("Dependencia", 1, 1, "%"),
    "C14": ("Reemplazo laboral", 1, 1, "%"),
    "C19": ("Dependencia · nacidos en España", 1, 1, "%"),
    "C16": ("Reemplazo laboral · nacidos en España", 1, 1, "%"),
    "C21": ("Sex ratio", 1, 1, ""),
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
# codmun (código INE) leído del GeoPackage por SQLite: evita la dependencia
# de geopandas/GDAL, que aquí solo haría falta para las geometrías.
import sqlite3  # noqa: E402

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
    print(f"  ⚠ Sin código INE: {_sin_cod}")


# --------------------------------------------------------------- cálculos ---
MARCAS = [2.5 + 5 * i for i in range(20)] + [102.0]   # marcas de clase, 21 grupos


def variacion(x, y, anio_base=ANIO_BASE_VAR):
    """(% acumulado, año inicial real, año final)."""
    d = dict(zip(x, y))
    posteriores = [a for a in x if a >= anio_base]
    a0 = posteriores[0] if posteriores else x[0]
    a1 = x[-1]
    if not d[a0]:
        return None, a0, a1
    return (d[a1] / d[a0] - 1) * 100, a0, a1


def tvma(x, y, anio_base=ANIO_BASE_VAR):
    """Tasa de variación media anual, %."""
    d = dict(zip(x, y))
    posteriores = [a for a in x if a >= anio_base]
    a0 = posteriores[0] if posteriores else x[0]
    a1 = x[-1]
    n = a1 - a0
    if not d[a0] or n <= 0:
        return None
    return ((d[a1] / d[a0]) ** (1 / n) - 1) * 100


def edad_media(h, m):
    total = h + m
    return float((total * np.array(MARCAS)).sum() / total.sum())


def r2(v, dec=2):
    """Redondea para el JSON. None si no es finito."""
    if v is None or not np.isfinite(v):
        return None
    return round(float(v), dec)


def serie_json(anios, valores, dec=3):
    """Empareja años y valores descartando huecos."""
    x, y = _sin_nulos(anios, valores)
    return {"anios": x, "valores": [r2(v, dec) for v in y]}


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


def depurar_componentes(comp, poblacion):
    """Aparta los valores que no pueden ser un flujo demográfico anual real.

    En 2007 El Pinar de El Hierro se segregó de Frontera, y el ISTAC anotó el
    traspaso de vecinos como saldo migratorio: +1.880 en un municipio de 2.040
    habitantes y −1.757 en el otro. Es un movimiento administrativo, no
    migración, y dejarlo en la serie multiplica por 40 la escala del gráfico y
    aplasta todos los años reales.

    Se apartan a `anomalias` en lugar de borrarse, para que la ficha pueda
    decir que existen en vez de fingir que no hay dato.
    """
    anomalias = []
    for clave in ("vegetativo", "migratorio"):
        for i, (anio, v) in enumerate(zip(comp["anios"], comp[clave])):
            if v is not None and abs(v) > poblacion * UMBRAL_ANOMALIA:
                anomalias.append({"anio": anio, "serie": clave, "valor": v,
                                  "motivo": "cambio administrativo de términos municipales"})
                comp[clave][i] = None
    if anomalias:
        comp["anomalias"] = anomalias
    return comp


# ----------------------------------------------------------------- export ---
(SALIDA / "mun").mkdir(parents=True, exist_ok=True)

H_CAN, M_CAN = piramide(NR, SR, DR, "Canarias")
HX_CAN, MX_CAN = piramide(NRX, SRX, DRX, "Canarias")
POB_PIR_CAN = H_CAN.sum() + M_CAN.sum()

fichas = []
for mun in MUNICIPIOS:
    isla = ISLA_DE[mun]
    comarca = COMARCA_DE[mun]

    h, m = piramide(NM, SM, DM, mun)
    hx, mx = piramide(NMX, SMX, DMX, mun)
    pob_pir = h.sum() + m.sum()

    x1, y1 = _sin_nulos(ANIOS_C1, SERIE_C1[mun])
    var, a0, a1 = variacion(x1, y1)

    ficha = {
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

        "extranjero": combinar({
            "municipio": (ANIOS_C22, SERIE_C22[mun]),
            "canarias": (ANIOS_C22, SERIE_C22_R["Canarias"]),
        }, 2),

        "cifras": {
            "tvma": r2(tvma(x1, y1), 2),
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
                "ambito": isla,
                "peso": r2(POB_M[mun] / POB_I[isla] * 100, 2),
            },
            "comarca": {
                "puesto": PUESTO_COMARCA[mun][0], "total": PUESTO_COMARCA[mun][1],
                "ambito": comarca,
                "peso": r2(POB_M[mun] / sum(POB_M[x] for x in COMARCAS[comarca]) * 100, 2),
            },
        },

        # Pirámides en absolutos: el front decide si las pinta en % o en efectivos.
        # "extranjera" = población de origen extranjero (C24).
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
        }, 0), int(POB_M[mun])),

        "origen": {
            "categorias": CAT_ORIGEN,
            "anio": ANIO_C25,
            "municipio": [r2(v, 1) for v in ORIGEN_M.get(mun, [np.nan] * 3)],
            "canarias": [r2(v, 1) for v in ORIGEN_R["Canarias"]],
        },
    }

    cod = ficha["codmun"]
    with open(SALIDA / "mun" / f"{cod}.json", "w", encoding="utf-8") as fh:
        json.dump(ficha, fh, ensure_ascii=False, separators=(",", ":"))

    fichas.append({
        "codmun": cod, "nombre": mun, "isla": isla,
        "comarca": comarca, "poblacion": ficha["poblacion"],
    })

indice = {
    "anio": ANIO_POB,
    "poblacion_canarias": int(POB_CANARIAS),
    "municipios": sorted(fichas, key=lambda f: _norm(f["nombre"])),
    "islas": {i: sorted(ms, key=_norm) for i, ms in ISLAS.items()},
    "comarcas": {c: sorted(ms, key=_norm) for c, ms in COMARCAS.items()},
    "fuentes": ["ISTAC — Instituto Canario de Estadística", "INE", "Cartografía: GRAFCAN"],
}
with open(SALIDA / "indice.json", "w", encoding="utf-8") as fh:
    json.dump(indice, fh, ensure_ascii=False, separators=(",", ":"))

_peso = sum(p.stat().st_size for p in (SALIDA / "mun").glob("*.json"))
print(f"\n{len(fichas)} fichas escritas en {SALIDA/'mun'}")
print(f"Peso total: {_peso/1024:.0f} KB  ·  media {_peso/len(fichas)/1024:.1f} KB por ficha")

# Escenario demográfico 2035: el libro PROYECCION_HP_2035.xlsx de Pedro a JSON
# para la página escenario.html, con las cuentas de su cuaderno
# FICHAS_MUNICIPALES_PROSPECTIVAS.ipynb (celdas P1 y P2).
#
# El libro reparte la proyección provincial del INE entre los 88 municipios
# (Hamilton-Perry promediado con cuota constante y control bidimensional). Aquí
# no se proyecta nada: se leen sus hojas de valores de 2030 y 2035, se suman
# islas, provincias y Canarias desde los municipios, como en el cuaderno, y se
# calculan la pirámide en porcentaje, los cuatro índices y la variación media
# anual. La parte observada (la serie de población y la pirámide de 2025) sale
# de las fichas ya exportadas por exportar_datos.py, que hay que ejecutar antes.
#
#  Entrada: ~/Downloads/PROYECCION_HP_2035.xlsx (o la ruta que se pase)
#           web/datos/indice.json, mun/, isla/, provincia/ y canarias.json
#  Salida:  web/datos/escenario/mun/<codmun>.json
#           web/datos/escenario/isla/<slug>.json
#           web/datos/escenario/provincia/<slug>.json
#           web/datos/escenario/canarias.json
#
# Antes de escribir nada comprueba que la población de 2025 del libro es la de
# las fichas, que cada provincia reproduce la proyección del INE por sexo y
# grupo de edad, que los índices de 2025 son los de las fichas y que no hay
# huecos ni negativos. Si algo no cuadra, se para sin tocar la salida.
import json
import math
import shutil
import sys
from pathlib import Path

import openpyxl

from territorios import ISLAS, PROVINCIAS

RUTA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "PROYECCION_HP_2035.xlsx"
DATOS = Path(__file__).parent / "web" / "datos"
SALIDA = DATOS / "escenario"

BASE, MEDIO, HORIZONTE = 2025, 2030, 2035
OBSERVADA_DESDE = BASE - 10        # la variación observada: los diez años anteriores
GRUPO_TERM = 17                    # la pirámide termina en «85 o más» (decisión de Pedro)
GRUPOS = 21                        # 0 a 4 … 95 a 99 y 100 o más, como C23M
INDICES = ("C10", "C11", "C17", "C14")
DECIMALES = {"C10": 2, "C11": 1, "C17": 1, "C14": 1}   # FORMATO_P del cuaderno
TOLERANCIA_INE = 0.01              # personas: el control bidimensional cierra por debajo

ERRORES = []


def falla(msg):
    ERRORES.append(msg)


# ------------------------------------------------------------- lectura ----

if not RUTA.exists():
    raise SystemExit(f"No está el libro de la proyección en {RUTA}")
LIBRO = openpyxl.load_workbook(RUTA, read_only=True, data_only=True)


def filas(hoja):
    return [list(f) for f in LIBRO[hoja].iter_rows(values_only=True)]


def numero(v, donde):
    if not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v):
        falla(f"{donde}: valor no numérico ({v!r})")
        return 0.0
    if v < 0:
        falla(f"{donde}: valor negativo ({v})")
    return float(v)


def hoja_municipal(hoja):
    """Hojas con la estructura de C23M: municipio en la primera fila (una vez
    cada dos columnas), sexo en la segunda y los 21 grupos debajo."""
    F = filas(hoja)
    nombres, sexos = F[0], F[1]
    etiquetas = [str(F[2 + g][1]).strip() for g in range(GRUPOS)]
    out, actual = {}, None
    for c in range(2, len(sexos)):
        if nombres[c] is not None:
            actual = str(nombres[c]).strip()
        sexo = str(sexos[c] or "").strip().lower()
        if not sexo:
            continue
        clave = "H" if sexo.startswith("hombre") else "M" if sexo.startswith("mujer") else None
        if clave is None or actual is None:
            falla(f"{hoja}: columna {c + 1} sin municipio o sexo reconocible")
            continue
        if clave in out.setdefault(actual, {}):
            falla(f"{hoja}: {actual} tiene dos columnas de {sexos[c]}")
        out[actual][clave] = [numero(F[2 + g][c], f"{hoja} {actual} {clave} {etiquetas[g]}")
                              for g in range(GRUPOS)]
    if len(F) > 2 + GRUPOS and any(v not in (None, "") for v in F[2 + GRUPOS][2:]):
        falla(f"{hoja}: hay datos por debajo de los {GRUPOS} grupos")
    return out, etiquetas


def hoja_ine(hoja):
    """Proyección provincial del INE por edad simple (0 a 99 y «100 y más»),
    agrupada en los 21 grupos quinquenales del libro."""
    F = filas(hoja)
    provs, sexos = F[0], F[1]
    out, actual = {}, None
    for c in range(2, len(sexos)):
        if provs[c] is not None:
            actual = str(provs[c]).strip()
        sexo = str(sexos[c] or "").strip().lower()
        if not sexo:
            continue
        clave = "H" if sexo.startswith("hombre") else "M"
        grupos = [0.0] * GRUPOS
        for edad in range(101):
            rotulo = str(F[2 + edad][1]).strip()
            esperado = "100 y más" if edad == 100 else f"{edad} años"
            if rotulo != esperado:
                falla(f"{hoja}: la fila de la edad {edad} dice «{rotulo}»")
            grupos[min(edad // 5, GRUPOS - 1)] += numero(F[2 + edad][c], f"{hoja} {actual} {clave} {edad}")
        out.setdefault(actual, {})[clave] = grupos
    return out


BASE_LIBRO, ETIQUETAS = hoja_municipal(f"POB_{BASE}")
PROY = {}
for anio, hoja in ((MEDIO, f"24_VALORES_{MEDIO}"), (HORIZONTE, f"25_VALORES_{HORIZONTE}")):
    PROY[anio], etiquetas = hoja_municipal(hoja)
    if etiquetas != ETIQUETAS:
        falla(f"{hoja}: los grupos de edad no son los de POB_{BASE}")
INE = {MEDIO: hoja_ine(f"03_INE_{MEDIO}_SIMPLE"), HORIZONTE: hoja_ine(f"04_INE_{HORIZONTE}_SIMPLE")}

# ------------------------------------------------------- las fichas -------

INDICE = json.loads((DATOS / "indice.json").read_text(encoding="utf-8"))
if INDICE["anio"] != BASE:
    raise SystemExit(f"Las fichas son de {INDICE['anio']} y el escenario parte de {BASE}")
MUNICIPIOS = {m["nombre"]: m for m in INDICE["municipios"]}
FICHAS = {n: json.loads((DATOS / "mun" / f"{m['codmun']}.json").read_text(encoding="utf-8"))
          for n, m in MUNICIPIOS.items()}

for anio, P in ((BASE, BASE_LIBRO), *PROY.items()):
    if set(P) != set(MUNICIPIOS):
        falla(f"{anio}: municipios que sobran {sorted(set(P) - set(MUNICIPIOS))}, "
              f"que faltan {sorted(set(MUNICIPIOS) - set(P))}")
    for n, d in P.items():
        if set(d) != {"H", "M"}:
            falla(f"{anio} {n}: faltan hombres o mujeres")
if ERRORES:
    raise SystemExit("\n".join(ERRORES))

# El libro parte de la misma pirámide que la ficha (C23M), grupo a grupo.
etiquetas_ficha = FICHAS["Adeje"]["piramide"]["edades"]
if [e.replace(" y más", " o más") for e in ETIQUETAS] != etiquetas_ficha:
    falla(f"Los grupos del libro ({ETIQUETAS}) no son los de la ficha ({etiquetas_ficha})")
for n, f in FICHAS.items():
    for clave, lado in (("H", "hombres"), ("M", "mujeres")):
        if [int(v) for v in BASE_LIBRO[n][clave]] != f["piramide"][lado] or \
                any(v != int(v) for v in BASE_LIBRO[n][clave]):
            falla(f"POB_{BASE} {n} {lado}: no es la pirámide de la ficha")

# ------------------------------------------------------------ ámbitos -----

PROVINCIA_DE_ISLA = {i: p for p, islas in PROVINCIAS.items() for i in islas}
SLUG_ISLA = {i["nombre"]: i["slug"] for i in INDICE["islas_resumen"]}
SLUG_PROV = {p["nombre"]: p["slug"] for p in INDICE["provincias"]}
if set(SLUG_ISLA) != set(ISLAS) or set(SLUG_PROV) != set(PROVINCIAS):
    raise SystemExit("Las islas o provincias de indice.json no son las de territorios.py")
for isla, muns in ISLAS.items():
    for n in muns:
        if MUNICIPIOS[n]["isla"] != isla:
            falla(f"{n}: indice.json lo pone en {MUNICIPIOS[n]['isla']} y territorios.py en {isla}")

AMBITOS = {}   # clave → (tipo, nombre, municipios, ficha observada)
for n, m in MUNICIPIOS.items():
    AMBITOS[str(m["codmun"])] = ("municipio", n, [n], FICHAS[n])
for isla, muns in ISLAS.items():
    AMBITOS[f"isla:{SLUG_ISLA[isla]}"] = ("isla", isla, muns, json.loads(
        (DATOS / "isla" / f"{SLUG_ISLA[isla]}.json").read_text(encoding="utf-8")))
for prov, islas in PROVINCIAS.items():
    AMBITOS[f"provincia:{SLUG_PROV[prov]}"] = ("provincia", prov, [n for i in islas for n in ISLAS[i]],
                                               json.loads((DATOS / "provincia" / f"{SLUG_PROV[prov]}.json")
                                                          .read_text(encoding="utf-8")))
AMBITOS["canarias"] = ("canarias", "Canarias", list(MUNICIPIOS),
                       json.loads((DATOS / "canarias.json").read_text(encoding="utf-8")))


def suma(fuente, muns, clave):
    return [sum(fuente[n][clave][g] for n in muns) for g in range(GRUPOS)]


def vectores(muns):
    """Hombres y mujeres por grupo en 2025, 2030 y 2035."""
    return {anio: {c: suma(P, muns, c) for c in ("H", "M")}
            for anio, P in ((BASE, BASE_LIBRO), *PROY.items())}


# Cada provincia reproduce la proyección del INE en cada sexo y grupo de edad.
for anio in (MEDIO, HORIZONTE):
    if set(INE[anio]) != set(PROVINCIAS):
        falla(f"INE {anio}: provincias {sorted(INE[anio])}")
        continue
    for prov, islas in PROVINCIAS.items():
        muns = [n for i in islas for n in ISLAS[i]]
        for c in ("H", "M"):
            for g, (a, b) in enumerate(zip(suma(PROY[anio], muns, c), INE[anio][prov][c])):
                if abs(a - b) > TOLERANCIA_INE:
                    falla(f"{anio} {prov} {c} {ETIQUETAS[g]}: los municipios suman {a:.4f} y el INE da {b:.4f}")


def indices(h, m):
    """Las fórmulas del cuaderno (y del libro): 0-14, 15-64 y 65 y más; el
    reemplazo, 15-19 entre 60-64."""
    t = [a + b for a, b in zip(h, m)]
    j, act, may = sum(t[0:3]), sum(t[3:13]), sum(t[13:])
    return {"C10": may / j, "C11": j / act * 100, "C17": (j + may) / act * 100, "C14": t[3] / t[12] * 100}


def tvma(p0, p1, anios):
    return ((p1 / p0) ** (1 / anios) - 1) * 100


def piramide_pct(v):
    """Porcentaje sobre el propio total, con los grupos de 85 en adelante juntos."""
    total = sum(v["H"]) + sum(v["M"])
    junta = lambda x: x[:GRUPO_TERM] + [sum(x[GRUPO_TERM:])]
    # Seis decimales, como los índices y la variación: con cuatro, un 3,449985 se
    # guardaba 3,45 y la página escribía 3,5 (README, «Redondeo una sola vez»).
    return {"hombres": [round(x / total * 100, 6) for x in junta(v["H"])],
            "mujeres": [round(x / total * 100, 6) for x in junta(v["M"])]}


def serie_observada(ficha):
    ev = ficha["evolucion"]
    return dict(zip(ev["anios"], ev["valores"]))


CALCULO = {}
for clave, (tipo, nombre, muns, ficha) in AMBITOS.items():
    V = vectores(muns)
    total = {a: sum(V[a]["H"]) + sum(V[a]["M"]) for a in V}
    obs = serie_observada(ficha)
    if total[BASE] != ficha["poblacion"] or obs.get(BASE) != ficha["poblacion"]:
        falla(f"{nombre}: la pirámide de {BASE} suma {total[BASE]} y la ficha da {ficha['poblacion']} "
              f"(serie: {obs.get(BASE)})")
    if obs.get(OBSERVADA_DESDE) is None:
        falla(f"{nombre}: la serie observada no tiene {OBSERVADA_DESDE}")
        continue
    ind = {a: indices(V[a]["H"], V[a]["M"]) for a in V}
    # Los índices de 2025 son los de la ficha (que los lee del libro CanCon).
    for cod in INDICES:
        de_ficha = ficha["indices"][cod][tipo]
        if abs(ind[BASE][cod] - de_ficha) > 0.5 * 10 ** -DECIMALES[cod] + 1e-9:
            falla(f"{nombre} {cod} {BASE}: la pirámide da {ind[BASE][cod]:.4f} y la ficha {de_ficha}")
    for a in (MEDIO, HORIZONTE):
        for cod, v in ind[a].items():
            if not math.isfinite(v) or v <= 0:
                falla(f"{nombre} {cod} {a}: {v}")
    CALCULO[clave] = {
        "V": V, "total": total, "ind": ind, "obs": obs,
        "tvma_observada": tvma(obs[OBSERVADA_DESDE], obs[BASE], BASE - OBSERVADA_DESDE),
        "tvma_proyectada": tvma(total[BASE], total[HORIZONTE], HORIZONTE - BASE),
    }

# Canarias es la suma de las dos provincias, y estas la proyección del INE.
for anio in (MEDIO, HORIZONTE):
    ine = sum(sum(INE[anio][p][c]) for p in PROVINCIAS for c in ("H", "M"))
    if abs(CALCULO["canarias"]["total"][anio] - ine) > TOLERANCIA_INE * GRUPOS * 4:
        falla(f"Canarias {anio}: {CALCULO['canarias']['total'][anio]:.2f} frente a {ine:.2f} del INE")

if ERRORES:
    raise SystemExit("No se escribe nada:\n" + "\n".join(ERRORES))

# ------------------------------------------------------------- salida -----

def fila_tvma(rotulo, clave):
    c = CALCULO[clave]
    return {"rotulo": rotulo, "observada": round(c["tvma_observada"], 6), "proyectada": round(c["tvma_proyectada"], 6)}


def escenario(clave):
    tipo, nombre, muns, ficha = AMBITOS[clave]
    c = CALCULO[clave]
    ev = ficha["evolucion"]
    out = {"tipo": tipo, "nombre": nombre}
    if tipo == "municipio":
        out.update(codmun=ficha["codmun"], isla=ficha["isla"])
    elif tipo in ("isla", "provincia"):
        out["slug"] = ficha["slug"]
    out.update({
        "base": BASE, "medio": MEDIO, "horizonte": HORIZONTE,
        "poblacion": ficha["poblacion"],
        "observado": {"anios": ev["anios"], "valores": [int(v) for v in ev["valores"]]},
        # Lo proyectado, a la unidad: la página no lo escribe como cifra exacta.
        "proyectado": {"anios": [BASE, MEDIO, HORIZONTE],
                       "valores": [int(c["total"][BASE])] + [round(c["total"][a]) for a in (MEDIO, HORIZONTE)]},
        "tvma": {"periodos": [[OBSERVADA_DESDE, BASE], [BASE, HORIZONTE]], "filas": []},
        "piramide": {"edades": etiquetas_ficha[:GRUPO_TERM] + [f"{5 * GRUPO_TERM} o más"],
                     "base": piramide_pct(c["V"][BASE]), "horizonte": piramide_pct(c["V"][HORIZONTE])},
        "indices": {cod: {"etiqueta": ficha["indices"][cod]["etiqueta"], "unidad": ficha["indices"][cod]["unidad"],
                          "decimales": DECIMALES[cod], "base": round(c["ind"][BASE][cod], 6),
                          "horizonte": round(c["ind"][HORIZONTE][cod], 6)} for cod in INDICES},
    })
    # La tabla de Pedro: el territorio, su isla y Canarias.
    filas_ = out["tvma"]["filas"]
    if tipo == "municipio":
        filas_ += [fila_tvma("Municipio", clave), fila_tvma(ficha["isla"], f"isla:{SLUG_ISLA[ficha['isla']]}")]
    elif tipo in ("isla", "provincia"):
        filas_.append(fila_tvma(tipo.capitalize(), clave))
    filas_.append(fila_tvma("Canarias", "canarias"))
    return out


if SALIDA.exists():
    shutil.rmtree(SALIDA)
for carpeta in ("mun", "isla", "provincia"):
    (SALIDA / carpeta).mkdir(parents=True)
for clave, (tipo, nombre, muns, ficha) in AMBITOS.items():
    ruta = (SALIDA / "canarias.json" if tipo == "canarias" else
            SALIDA / "mun" / f"{ficha['codmun']}.json" if tipo == "municipio" else
            SALIDA / tipo / f"{ficha['slug']}.json")
    with open(ruta, "w", encoding="utf-8") as fh:
        json.dump(escenario(clave), fh, ensure_ascii=False, separators=(",", ":"))

c = CALCULO["canarias"]
print(f"Escenario {BASE}-{HORIZONTE}: {len(AMBITOS)} territorios en {SALIDA.relative_to(Path(__file__).parent)}")
print(f"  Canarias {c['total'][BASE]:,.0f} → {c['total'][HORIZONTE]:,.0f} · "
      f"variación media anual {c['tvma_observada']:.2f} % observada y {c['tvma_proyectada']:.2f} % proyectada")
for cod in INDICES:
    print(f"  {cod} {c['ind'][BASE][cod]:.2f} → {c['ind'][HORIZONTE][cod]:.2f}")

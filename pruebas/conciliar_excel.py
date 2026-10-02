#!/usr/bin/env python3
"""Conciliación de los JSON exportados contra el libro de Pedro, celda a celda.

Necesita el Excel en ~/Downloads (o en la ruta que se pase como argumento) y
openpyxl; si no está el libro, se omite avisando. Comprueba población, serie
de evolución, variación acumulada, TVMA (sin redondeo intermedio), series de
origen extranjero (el valor y el decimal que se muestra), componentes del
cambio —incluidas las anomalías apartadas—, los cuatro índices en los tres
ámbitos, puestos y pesos, las 42 barras de cada pirámide y el reparto por
lugar de nacimiento en los 88 municipios; lo mismo en las siete islas contra
las hojas «I», donde el origen extranjero se contrasta con la suma de sus
municipios, y en Canarias contra las «R»; las dos provincias, que no tienen
hojas, se contrastan con la suma de sus islas (el libro trajo Lanzarote y Fuerteventura cambiadas en C2I/C22I de
2021 a 2025 hasta que Pedro lo corrigió el 16/9/2026; si volviera a pasar, el
exportador lo corrige y aquí se cuentan los años corregidos). También las
pirámides de 2005, 2010, 2015 y 2020 (C28M–C31M) de cada ficha, con los
índices de esos años."""
import json
import math
import sys
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))
from correcciones_libro import cruzar_si_procede  # noqa: E402
from territorios import ISLAS, PROVINCIAS  # noqa: E402
RUTA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "BASE_DATOS_CANCON.xlsx"
if not RUTA.exists():
    print(f"omitida · no está el libro en {RUTA}")
    sys.exit(0)
try:
    import openpyxl  # noqa: E402
except ImportError:
    # Con el libro a mano, no poder leerlo es un fallo: la conciliación tiene que correr antes de publicar.
    print("FALLA · está el libro pero falta openpyxl: pip install -r requirements.txt, o ejecutar con el python3 que lo tenga (/usr/bin/python3)")
    sys.exit(1)

W = openpyxl.load_workbook(RUTA, read_only=True, data_only=True)
F = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((RAIZ / "web/datos/mun").glob("*.json"))]
ERR, CUENTA = [], Counter()


def check(a, b, donde):
    CUENTA[donde.split(":")[0]] += 1
    if a != b:
        ERR.append((donde, a, b))


def mostrado(v):
    """Un decimal con el redondeo de la web (Intl, half-expand sobre el valor decimal)."""
    return str(Decimal(repr(float(v))).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def reparto_valido(publicado, vals):
    """¿Cumple el reparto por lugar de nacimiento la regla de Pedro (22/9/2026)?
    Un decimal y 100,0 justo; «Extranjero» con el redondeo de siempre, el del
    último dato del gráfico de origen extranjero; Canarias y Resto de España por
    el mayor resto, contado con aritmética exacta sobre las personas del libro
    y no con el exportador: cada una es su décima por abajo o por arriba, y si
    solo sube una, es la de mayor resto. En un empate exacto de restos vale
    cualquiera de las dos, así que la prueba no depende del desempate."""
    if len(publicado) != 3 or abs(sum(publicado) - 100) > 1e-9:
        return False
    if publicado[2] != round(vals[2] / sum(vals) * 100, 1):
        return False
    total = sum(Fraction(v) for v in vals)
    exactas = [Fraction(v) * 1000 / total for v in vals[:2]]          # en décimas
    suelos = [math.floor(e) for e in exactas]
    dadas = [round(p * 10) for p in publicado[:2]]
    if any(d not in (s, s + 1) or (d == s + 1 and e == s) for d, s, e in zip(dadas, suelos, exactas)):
        return False
    sube = [d > s for d, s in zip(dadas, suelos)]
    restos = [e - s for e, s in zip(exactas, suelos)]
    return sube[0] == sube[1] or restos[sube.index(True)] >= restos[sube.index(False)]


def series(hoja):
    filas = list(W[hoja].values)
    nombres = filas[0][2:]
    return {str(n).strip(): {int(r[1]): r[i + 2] for r in filas[1:]
                             if isinstance(r[1], (int, float)) and isinstance(r[i + 2], (int, float))}
            for i, n in enumerate(nombres) if n}


SS = {s: series(s) for s in ["C1M", "C1I", "C1R", "C6M", "C6I", "C7M", "C7I", "C22M", "C22R"]
      + [c + a for c in ["C10", "C11", "C17", "C14"] for a in "MIR"]}
# Las celdas cruzadas que el libro aún traiga (correcciones_libro.py) se cruzan aquí
# igual que en el exportador, y se cuentan: la ficha lleva el dato corregido.
ISLA_DE = {m: i for i, ms in ISLAS.items() for m in ms}
for hoja, hoja_i in (("C6M", "C6I"), ("C7M", "C7I")):
    for a, b, anio in cruzar_si_procede(hoja, SS[hoja], SS[hoja_i], ISLA_DE):
        CUENTA["componentes_corregidos_en_el_libro"] += 1
for f in F:
    mun = f["nombre"]
    check(f["poblacion"], SS["C1M"][mun][f["anio"]], f"poblacion:{mun}")
    ev = f["evolucion"]
    check(dict(zip(ev["anios"], ev["valores"])), SS["C1M"][mun], f"evolucion:{mun}")
    base, fin = SS["C1M"][mun][ev["anio_base"]], SS["C1M"][mun][ev["anio_fin"]]
    check(ev["variacion_acumulada"], round(100 * (fin / base - 1), 1), f"variacion:{mun}")
    tvma = 100 * ((fin / base) ** (1 / (ev["anio_fin"] - ev["anio_base"])) - 1)
    check(abs(f["cifras"]["tvma"] - tvma) < 1e-9, True, f"tvma:{mun}")
    ex = f["extranjero"]
    for k, s, n in [("municipio", "C22M", mun), ("canarias", "C22R", "Canarias")]:
        # La serie va sin redondear: la web redondea a un decimal al mostrarla,
        # una sola vez. Se comprueba el valor y también lo que se leerá en pantalla
        # (a dos decimales el libro y el JSON coincidían mientras Las Palmas
        # salía «16,6 %» en vez de 16,5).
        exportado = {a: v for a, v in zip(ex["anios"], ex[k]) if v is not None}
        check(exportado, SS[s][n], f"serie_extranjero:{mun}:{k}")
        check({a: mostrado(v) for a, v in exportado.items()}, {a: mostrado(v) for a, v in SS[s][n].items()},
              f"extranjero_mostrado:{mun}:{k}")
    co = f["componentes"]
    for k, s in [("vegetativo", "C6M"), ("migratorio", "C7M")]:
        exportado = {a: v for a, v in zip(co["anios"], co[k]) if v is not None}
        exportado.update({x["anio"]: x["valor"] for x in co.get("anomalias", []) if x["serie"] == k})
        check(exportado, SS[s][mun], f"componentes:{mun}:{k}")
    for c, idx in f["indices"].items():
        factor, dec = (100 if c == "C11" else 1), (2 if c == "C10" else 1)
        for k, a, n in [("municipio", "M", mun), ("isla", "I", f["isla"]), ("canarias", "R", "Canarias")]:
            check(idx[k], round(SS[c + a][n][idx["anio"]] * factor, dec), f"indices:{mun}:{c}:{k}")
    for k, grupo in [("canarias", F), ("isla", [g for g in F if g["isla"] == f["isla"]]),
                     ("comarca", [g for g in F if g["comarca"] == f["comarca"]])]:
        check(f["rankings"][k]["puesto"], 1 + sum(g["poblacion"] > f["poblacion"] for g in grupo), f"puesto:{mun}:{k}")
        check(f["rankings"][k]["peso"], round(f["poblacion"] / sum(g["poblacion"] for g in grupo) * 100, 2), f"peso:{mun}:{k}")
    check(f["poblacion"], sum(f["piramide"]["hombres"] + f["piramide"]["mujeres"]), f"piramide_total:{mun}")
    for campo, hoja in [("", "C23M"), ("extranjera_", "C24M")]:
        filas = list(W[hoja].values)
        col = filas[0].index(mun)
        for k, d in [("hombres", 0), ("mujeres", 1)]:
            check(f["piramide"][campo + k], [r[col + d] for r in filas[2:23]], f"piramide:{mun}:{campo}{k}")
    filas = list(W["C25M"].values)
    col = filas[0].index(mun)
    vals = filas[2][col:col + 3]
    check(reparto_valido(f["origen"]["municipio"], vals), True, f"origen:{mun}:{f['origen']['municipio']}")

# ---- islas: las hojas «I», celda a celda ------------------------------------
FI = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((RAIZ / "web/datos/isla").glob("*.json"))]
SS.update({s: series(s) for s in ["C6I", "C7I", "C22I"]})
for f in FI:
    isla = f["nombre"]
    check(f["poblacion"], SS["C1I"][isla][f["anio"]], f"isla_poblacion:{isla}")
    ev = f["evolucion"]
    check(dict(zip(ev["anios"], ev["valores"])), SS["C1I"][isla], f"isla_evolucion:{isla}")
    base, fin = SS["C1I"][isla][ev["anio_base"]], SS["C1I"][isla][ev["anio_fin"]]
    check(ev["variacion_acumulada"], round(100 * (fin / base - 1), 1), f"isla_variacion:{isla}")
    tvma = 100 * ((fin / base) ** (1 / (ev["anio_fin"] - ev["anio_base"])) - 1)
    check(abs(f["cifras"]["tvma"] - tvma) < 1e-9, True, f"isla_tvma:{isla}")
    # La serie de origen extranjero de la isla tiene que ser la suma de sus
    # municipios (C22M por C1M): es lo que la ficha debe decir aunque C22I
    # traiga dos islas cambiadas; se cuentan los años en que el libro no cuadra.
    ex = f["extranjero"]
    suyos = [g for g in F if g["isla"] == isla]
    exportado = {a: v for a, v in zip(ex["anios"], ex["isla"]) if v is not None}
    for a, v in exportado.items():
        pares = [(SS["C22M"][g["nombre"]].get(a), SS["C1M"][g["nombre"]].get(a)) for g in suyos]
        if any(p is None or q is None for p, q in pares):   # El Hierro antes de 2007
            continue
        agregado = sum(p * q / 100 for p, q in pares) / sum(q for _, q in pares) * 100
        check(abs(v - agregado) < 1e-6, True, f"isla_extranjero:{isla}:{a}")
        if abs(SS["C22I"][isla][a] - agregado) > 1e-6:
            CUENTA["isla_extranjero_corregido_en_el_libro"] += 1
    check({a: v for a, v in zip(ex["anios"], ex["canarias"]) if v is not None}, SS["C22R"]["Canarias"], f"isla_extranjero_canarias:{isla}")
    co = f["componentes"]
    for k, s in [("vegetativo", "C6I"), ("migratorio", "C7I")]:
        exportado = {a: v for a, v in zip(co["anios"], co[k]) if v is not None}
        check(exportado, SS[s][isla], f"isla_componentes:{isla}:{k}")
    for c, idx in f["indices"].items():
        factor, dec = (100 if c == "C11" else 1), (2 if c == "C10" else 1)
        check(idx["isla"], round(SS[c + "I"][isla][idx["anio"]] * factor, dec), f"isla_indices:{isla}:{c}")
        check(idx["canarias"], round(SS[c + "R"]["Canarias"][idx["anio"]] * factor, dec), f"isla_indices:{isla}:{c}:canarias")
        for otra, v in idx["islas"].items():
            check(v, round(SS[c + "I"][otra][idx["anio"]] * factor, dec), f"isla_indices_islas:{isla}:{c}:{otra}")
    check(f["rankings"]["canarias"]["puesto"], 1 + sum(g["poblacion"] > f["poblacion"] for g in FI), f"isla_puesto:{isla}")
    check(f["rankings"]["canarias"]["peso"], round(f["poblacion"] / sum(g["poblacion"] for g in FI) * 100, 2), f"isla_peso:{isla}")
    check([m["codmun"] for m in f["municipios"]], [g["codmun"] for g in sorted(suyos, key=lambda g: -g["poblacion"])], f"isla_municipios:{isla}")
    for m in f["municipios"]:
        check(m["peso"], round(m["poblacion"] / f["poblacion"] * 100, 2), f"isla_municipio_peso:{isla}:{m['nombre']}")
    check(f["poblacion"], sum(f["piramide"]["hombres"] + f["piramide"]["mujeres"]), f"isla_piramide_total:{isla}")
    for campo, hoja in [("", "C23I"), ("extranjera_", "C24I")]:
        filas = list(W[hoja].values)
        col = filas[0].index(isla)
        for k, d in [("hombres", 0), ("mujeres", 1)]:
            check(f["piramide"][campo + k], [r[col + d] for r in filas[2:23]], f"isla_piramide:{isla}:{campo}{k}")
    filas = list(W["C25I"].values)
    col = filas[0].index(isla)
    vals = filas[2][col:col + 3]
    check(reparto_valido(f["origen"]["isla"], vals), True, f"isla_origen:{isla}:{f['origen']['isla']}")

# ---- Canarias: las hojas «R», celda a celda --------------------------------
FC = json.loads((RAIZ / "web/datos/canarias.json").read_text(encoding="utf-8"))
SS.update({s: series(s) for s in ["C6R", "C7R"]})
check(FC["poblacion"], SS["C1R"]["Canarias"][FC["anio"]], "canarias_poblacion")
ev = FC["evolucion"]
# La ficha acota la serie regional a los años de las fichas de isla (C1I, desde 2000).
desde = min(min(s) for s in SS["C1I"].values())
check(dict(zip(ev["anios"], ev["valores"])), {a: v for a, v in SS["C1R"]["Canarias"].items() if a >= desde}, "canarias_evolucion")
base, fin = SS["C1R"]["Canarias"][ev["anio_base"]], SS["C1R"]["Canarias"][ev["anio_fin"]]
check(ev["variacion_acumulada"], round(100 * (fin / base - 1), 1), "canarias_variacion")
check(abs(FC["cifras"]["tvma"] - 100 * ((fin / base) ** (1 / (ev["anio_fin"] - ev["anio_base"])) - 1)) < 1e-9, True, "canarias_tvma")
check({a: v for a, v in zip(FC["extranjero"]["anios"], FC["extranjero"]["canarias"]) if v is not None}, SS["C22R"]["Canarias"], "canarias_extranjero")
for k, s in [("vegetativo", "C6R"), ("migratorio", "C7R")]:
    check({a: v for a, v in zip(FC["componentes"]["anios"], FC["componentes"][k]) if v is not None}, SS[s]["Canarias"], f"canarias_componentes:{k}")
for c, idx in FC["indices"].items():
    factor, dec = (100 if c == "C11" else 1), (2 if c == "C10" else 1)
    check(idx["canarias"], round(SS[c + "R"]["Canarias"][idx["anio"]] * factor, dec), f"canarias_indices:{c}")
    for otra, v in idx["islas"].items():
        check(v, round(SS[c + "I"][otra][idx["anio"]] * factor, dec), f"canarias_indices_islas:{c}:{otra}")
for campo, hoja in [("", "C23R"), ("extranjera_", "C24R")]:
    filas = list(W[hoja].values)
    for k, d in [("hombres", 0), ("mujeres", 1)]:
        check(FC["piramide"][campo + k], [r[2 + d] for r in filas[2:23]], f"canarias_piramide:{campo}{k}")
vals = list(W["C25R"].values)[2][1:4]
check(reparto_valido(FC["origen"]["canarias"], vals), True, f"canarias_origen:{FC['origen']['canarias']}")
check([i["nombre"] for i in FC["islas"]], [g["nombre"] for g in sorted(FI, key=lambda g: -g["poblacion"])], "canarias_islas")
for i in FC["islas"]:
    check(i["peso"], round(i["poblacion"] / FC["poblacion"] * 100, 2), f"canarias_isla_peso:{i['nombre']}")

# ---- provincias: no tienen hojas; cada una es la suma de sus islas ----------
FP = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((RAIZ / "web/datos/provincia").glob("*.json"))]
for f in FP:
    prov = f["nombre"]
    suyas = [g for g in FI if g["nombre"] in PROVINCIAS[prov]]
    nombres = [g["nombre"] for g in suyas]
    check(f["poblacion"], sum(SS["C1I"][i][f["anio"]] for i in nombres), f"provincia_poblacion:{prov}")
    ev = f["evolucion"]
    anios = sorted(set.intersection(*(set(SS["C1I"][i]) for i in nombres)))
    check(dict(zip(ev["anios"], ev["valores"])), {a: sum(SS["C1I"][i][a] for i in nombres) for a in anios}, f"provincia_evolucion:{prov}")
    ex = {a: v for a, v in zip(f["extranjero"]["anios"], f["extranjero"]["provincia"]) if v is not None}
    for a, v in ex.items():
        # En personas: cada isla con su serie ya conciliada (la de su ficha) por su población.
        pares = [(dict(zip(g["extranjero"]["anios"], g["extranjero"]["isla"])).get(a), SS["C1I"][g["nombre"]].get(a)) for g in suyas]
        if any(p is None or q is None for p, q in pares):
            continue
        check(abs(v - sum(p * q / 100 for p, q in pares) / sum(q for _, q in pares) * 100) < 1e-6, True, f"provincia_extranjero:{prov}:{a}")
    for k, s in [("vegetativo", "C6I"), ("migratorio", "C7I")]:
        exportado = {a: v for a, v in zip(f["componentes"]["anios"], f["componentes"][k]) if v is not None}
        comunes = sorted(set.intersection(*(set(SS[s][i]) for i in nombres)))
        check(exportado, {a: sum(SS[s][i][a] for i in nombres) for a in comunes}, f"provincia_componentes:{prov}:{k}")
    for campo, hoja in [("", "C23I"), ("extranjera_", "C24I")]:
        filas = list(W[hoja].values)
        for k, d in [("hombres", 0), ("mujeres", 1)]:
            suma = [sum(r[filas[0].index(i) + d] for i in nombres) for r in filas[2:23]]
            check(f["piramide"][campo + k], suma, f"provincia_piramide:{prov}:{campo}{k}")
    filas = list(W["C25I"].values)
    vals = [sum(filas[2][filas[0].index(i) + j] for i in nombres) for j in range(3)]
    check(reparto_valido(f["origen"]["provincia"], vals), True, f"provincia_origen:{prov}:{f['origen']['provincia']}")
    # Los índices, con las fórmulas del libro sobre la pirámide sumada (invariantes.py
    # comprueba la fórmula; aquí, que Canarias y sus islas son las de las hojas).
    for c, idx in f["indices"].items():
        factor, dec = (100 if c == "C11" else 1), (2 if c == "C10" else 1)
        check(idx["canarias"], round(SS[c + "R"]["Canarias"][idx["anio"]] * factor, dec), f"provincia_indices_canarias:{prov}:{c}")
        check(sorted(idx["islas"]), sorted(nombres), f"provincia_indices_islas:{prov}:{c}")
        for otra, v in idx["islas"].items():
            check(v, round(SS[c + "I"][otra][idx["anio"]] * factor, dec), f"provincia_indices_islas:{prov}:{c}:{otra}")
    check(f["rankings"]["canarias"]["peso"], round(f["poblacion"] / SS["C1R"]["Canarias"][f["anio"]] * 100, 2), f"provincia_peso:{prov}")
    check([i["nombre"] for i in f["islas"]], [g["nombre"] for g in sorted(suyas, key=lambda g: -g["poblacion"])], f"provincia_islas:{prov}")
    suyos = [g for g in F if g["isla"] in nombres]
    check([m["codmun"] for m in f["municipios"]], [g["codmun"] for g in sorted(suyos, key=lambda g: -g["poblacion"])], f"provincia_municipios:{prov}")

# ---- años anteriores: pirámides C28M–C31M y los índices de esos años --------
# Cada pirámide municipal, celda a celda contra su hoja y sumando su población de
# C1M; la de cada isla, la suma de sus municipios en la hoja (en 2005 El Hierro
# lleva la columna «Frontera (hasta 2007)», y Frontera y El Pinar no tienen ese
# año) y su población de C1I; Canarias, la suma de las islas y C1R; cada
# provincia, la suma de sus islas. Los índices, los de las hojas de ese año (las
# provincias, con la fórmula: invariantes.py).
HOJAS_ANT = {2005: "C28M", 2010: "C29M", 2015: "C30M", 2020: "C31M"}
PIR_ANT = {}
for anio, hoja in HOJAS_ANT.items():
    filas = list(W[hoja].values)
    cab = [str(x).strip() if x is not None else None for x in filas[0]]
    PIR_ANT[anio] = {}
    for j, nombre in enumerate(cab):
        if nombre and nombre != "INDEX-C" and j + 1 < len(cab):
            h, m = [r[j] for r in filas[2:23]], [r[j + 1] for r in filas[2:23]]
            if all(isinstance(v, (int, float)) for v in h + m):
                PIR_ANT[anio][nombre] = (h, m)
FRONTERA_VIEJA = "Frontera (hasta 2007)"


def isla_ant(isla, anio):
    nombres = [n for n in PIR_ANT[anio] if ISLA_DE.get(n) == isla or (isla == "El Hierro" and n == FRONTERA_VIEJA)]
    return ([sum(PIR_ANT[anio][n][0][k] for n in nombres) for k in range(21)],
            [sum(PIR_ANT[anio][n][1][k] for n in nombres) for k in range(21)])


ISLA_ANT = {(i, a): isla_ant(i, a) for i in ISLAS for a in HOJAS_ANT}
CAN_ANT = {a: ([sum(ISLA_ANT[(i, a)][0][k] for i in ISLAS) for k in range(21)],
               [sum(ISLA_ANT[(i, a)][1][k] for i in ISLAS) for k in range(21)]) for a in HOJAS_ANT}
for (i, a), (h, m) in ISLA_ANT.items():
    check(sum(h + m), SS["C1I"][i][a], f"anterior_isla_total:{i}:{a}")
for a, (h, m) in CAN_ANT.items():
    check(sum(h + m), SS["C1R"]["Canarias"][a], f"anterior_canarias_total:{a}")


def comprobar_anteriores(f, que, propia, columnas):
    """`propia(año)` es la pirámide del libro o None; `columnas`, {clave del índice: (hoja, nombre)}."""
    esperados = [a for a in HOJAS_ANT if propia(a) is not None]
    check([x["anio"] for x in f["anteriores"]], esperados, f"anterior_anios:{que}")
    for x in f["anteriores"]:
        a, pi = x["anio"], x["piramide"]
        h, m = propia(a)
        check(pi["hombres"], h, f"anterior_piramide:{que}:{a}:hombres")
        check(pi["mujeres"], m, f"anterior_piramide:{que}:{a}:mujeres")
        hc, mc = CAN_ANT[a]
        tot = sum(hc + mc)
        check(pi["canarias_hombres"], [round(v / tot * 100, 3) for v in hc], f"anterior_canarias:{que}:{a}:hombres")
        check(pi["canarias_mujeres"], [round(v / tot * 100, 3) for v in mc], f"anterior_canarias:{que}:{a}:mujeres")
        for c, idx in x["indices"].items():
            factor, dec = (100 if c == "C11" else 1), (2 if c == "C10" else 1)
            for k, (nivel, nombre) in {**columnas, "canarias": ("R", "Canarias")}.items():
                check(idx[k], round(SS[c + nivel][nombre][a] * factor, dec), f"anterior_indices:{que}:{a}:{c}:{k}")
            for otra, v in idx.get("islas", {}).items():
                check(v, round(SS[c + "I"][otra][a] * factor, dec), f"anterior_indices_islas:{que}:{a}:{c}:{otra}")


for f in F:
    mun = f["nombre"]
    comprobar_anteriores(f, mun, lambda a, mun=mun: PIR_ANT[a].get(mun), {"municipio": ("M", mun), "isla": ("I", f["isla"])})
    for x in f["anteriores"]:
        check(sum(x["piramide"]["hombres"] + x["piramide"]["mujeres"]), SS["C1M"][mun][x["anio"]], f"anterior_total:{mun}:{x['anio']}")
for f in FI:
    comprobar_anteriores(f, f["nombre"], lambda a, i=f["nombre"]: ISLA_ANT[(i, a)], {"isla": ("I", f["nombre"])})
comprobar_anteriores(FC, "Canarias", lambda a: CAN_ANT[a], {})
for f in FP:
    nombres = PROVINCIAS[f["nombre"]]
    suma = lambda a, nombres=nombres: ([sum(ISLA_ANT[(i, a)][0][k] for i in nombres) for k in range(21)],
                                       [sum(ISLA_ANT[(i, a)][1][k] for i in nombres) for k in range(21)])
    comprobar_anteriores(f, f["nombre"], suma, {})

total = sum(CUENTA.values())
if ERR:
    print(f"FALLA · {len(ERR)} discrepancia(s) en {total} comparaciones")
    for e in ERR[:40]:
        print(" -", e)
    sys.exit(1)
print(f"ok · {total} comparaciones contra el libro sin discrepancias: " + ", ".join(f"{k} {v}" for k, v in sorted(CUENTA.items())))

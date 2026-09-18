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
exportador lo corrige y aquí se cuentan los años corregidos)."""
import json
import sys
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
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
    print("omitida · falta openpyxl (pip install -r requirements.txt, o ejecutar con el python3 que lo tenga)")
    sys.exit(0)

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
    check(f["origen"]["municipio"], [round(v / sum(vals) * 100, 1) for v in vals], f"origen:{mun}")

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
    check(f["origen"]["isla"], [round(v / sum(vals) * 100, 1) for v in vals], f"isla_origen:{isla}")

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
check(FC["origen"]["canarias"], [round(v / sum(vals) * 100, 1) for v in vals], "canarias_origen")
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
    check(f["origen"]["provincia"], [round(v / sum(vals) * 100, 1) for v in vals], f"provincia_origen:{prov}")
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

total = sum(CUENTA.values())
if ERR:
    print(f"FALLA · {len(ERR)} discrepancia(s) en {total} comparaciones")
    for e in ERR[:40]:
        print(" -", e)
    sys.exit(1)
print(f"ok · {total} comparaciones contra el libro sin discrepancias: " + ", ".join(f"{k} {v}" for k, v in sorted(CUENTA.items())))

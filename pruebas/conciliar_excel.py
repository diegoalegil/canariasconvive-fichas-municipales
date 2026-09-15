#!/usr/bin/env python3
"""Conciliación de los JSON exportados contra el libro de Pedro, celda a celda.

Necesita el Excel en ~/Downloads (o en la ruta que se pase como argumento) y
openpyxl; si no está el libro, se omite avisando. Comprueba población, serie
de evolución, variación acumulada, TVMA (sin redondeo intermedio), series de
origen extranjero (el valor y el decimal que se muestra), componentes del
cambio —incluidas las anomalías apartadas—, los cuatro índices en los tres
ámbitos, puestos y pesos, las 42 barras de cada pirámide y el reparto por
lugar de nacimiento en los 88 municipios; y lo mismo en las siete islas contra
las hojas «I», donde el origen extranjero se contrasta con la suma de sus
municipios (el libro trae Lanzarote y Fuerteventura cambiadas en C2I/C22I desde
2021 y el exportador lo corrige: aquí se cuentan los años corregidos)."""
import json
import sys
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
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


SS = {s: series(s) for s in ["C1M", "C1I", "C1R", "C6M", "C7M", "C22M", "C22R"]
      + [c + a for c in ["C10", "C11", "C17", "C14"] for a in "MIR"]}
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

total = sum(CUENTA.values())
if ERR:
    print(f"FALLA · {len(ERR)} discrepancia(s) en {total} comparaciones")
    for e in ERR[:40]:
        print(" -", e)
    sys.exit(1)
print(f"ok · {total} comparaciones contra el libro sin discrepancias: " + ", ".join(f"{k} {v}" for k, v in sorted(CUENTA.items())))

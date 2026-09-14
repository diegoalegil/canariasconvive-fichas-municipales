#!/usr/bin/env python3
"""Conciliación de los JSON exportados contra el libro de Pedro, celda a celda.

Necesita el Excel en ~/Downloads (o en la ruta que se pase como argumento) y
openpyxl; si no está el libro, se omite avisando. Comprueba población, serie
de evolución, variación acumulada, TVMA (sin redondeo intermedio), series de
origen extranjero (el valor y el decimal que se muestra), componentes del
cambio —incluidas las anomalías apartadas—, los cuatro índices en los tres
ámbitos, puestos y pesos, las 42 barras de cada pirámide y el reparto por
lugar de nacimiento: 2.992 comparaciones en los 88 municipios."""
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

total = sum(CUENTA.values())
if ERR:
    print(f"FALLA · {len(ERR)} discrepancia(s) en {total} comparaciones")
    for e in ERR[:40]:
        print(" -", e)
    sys.exit(1)
print(f"ok · {total} comparaciones contra el libro sin discrepancias: " + ", ".join(f"{k} {v}" for k, v in sorted(CUENTA.items())))

#!/usr/bin/env python3
"""Invariantes de los datos exportados. Solo biblioteca estándar: corre en
cualquier sitio, también en GitHub Actions antes de publicar.

Comprueba lo que no puede fallar sin que la ficha mienta: que hay 88
municipios, 7 islas y 2 provincias, que cada pirámide suma su población, las
88 suman Canarias, cada isla suma sus municipios y cada provincia (y Canarias)
sus islas, que los índices provinciales son los de la fórmula del libro, que
la TVMA guardada es la de la serie (sin redondeo intermedio), que los repartos
por lugar de nacimiento suman cien, que los cuatro índices están en los tres
ámbitos, que cada fuente de gráfico lleva el año de referencia, que los 88
envoltorios de web/m/ apuntan a la URL pública de sitio.json y llevan la
población y el año de los datos (con su tarjeta og), que la serie de origen
extranjero se muestra con un solo redondeo, que las islas van en el mismo orden
en el índice, que las cinco páginas cargan la misma versión de recursos y que
todas llevan su política de contenido sin manejadores ni scripts en línea (los
envoltorios, con la huella de su único script).

La conciliación contra el Excel, que sí necesita el libro, está en
conciliar_excel.py."""
import base64
import hashlib
import json
import re
import shutil
import sys
import tempfile
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


def mostrado(v, dec=1):
    """Lo que escribe la web con `nf(v, dec)`: half-expand sobre el valor decimal."""
    return str(Decimal(repr(float(v))).quantize(Decimal(1).scaleb(-dec), rounding=ROUND_HALF_UP))


def suma_cien(v):
    """El lugar de nacimiento, con un decimal, suma 100,0 justo (Pedro, 22/9/2026)."""
    return isinstance(v, list) and all(isinstance(x, (int, float)) for x in v) and abs(sum(v) - 100) < 0.05

RAIZ = Path(__file__).resolve().parent.parent
WEB = RAIZ / "web"
fallos = []


def comprobar(condicion, mensaje):
    if not condicion:
        fallos.append(mensaje)


indice = json.loads((WEB / "datos/indice.json").read_text(encoding="utf-8"))
sitio = json.loads((RAIZ / "sitio.json").read_text(encoding="utf-8"))
url_publica = sitio["url_publica"]
comprobar(url_publica.startswith("https://") and url_publica.endswith("/"), "sitio.json: url_publica debe ser https y acabar en /")
config = (WEB / "config.js").read_text(encoding="utf-8")
comprobar(url_publica in config, "web/config.js no lleva la URL de sitio.json: ejecutar generar_tarjetas.py")
comprobar(all(o in config for o in sitio.get("origenes_iframe", [])), "web/config.js no lleva los orígenes de sitio.json: ejecutar generar_tarjetas.py")
# Los tres logotipos (sitio.json, «logos»): id en minúsculas y único, nombre y ficheros que existen; en config.js tal
# cual; y escritos en el mismo orden en la placa de la portada, en la cabecera de las páginas interiores y en la
# placa del papel de la ficha (comun.js los dibuja igual donde se generan al vuelo: presentación y dossier).
logos = sitio.get("logos", [])
comprobar(len(logos) == 3 and len({l.get("id") for l in logos}) == 3, "sitio.json: tienen que ser tres logotipos con id distinto")
for l in logos:
    comprobar(re.fullmatch(r"[a-z]+", l.get("id", "")) is not None and l.get("nombre"), f"sitio.json: el logotipo «{l.get('id')}» necesita id en minúsculas y nombre")
    for clave in ("logo", "menu"):
        comprobar((WEB / l.get(clave, "")).is_file(), f"sitio.json: falta el fichero {l.get(clave)} del logotipo «{l.get('id')}»")
def imagenes_de(clave):
    return "".join(f'<img src="{l[clave]}" alt="{l["nombre"]}" data-logo="{l["id"]}">' for l in logos)
_tres = lambda html, clave: imagenes_de(clave) in re.sub(r">\s+<", "><", html)
comprobar(_tres((WEB / "index.html").read_text(encoding="utf-8"), "logo"), "web/index.html: la placa de la portada tiene que llevar los tres logotipos de sitio.json, en su orden")
for pagina in ("ficha", "comparar", "guia", "dossier"):
    comprobar(_tres((WEB / f"{pagina}.html").read_text(encoding="utf-8"), "menu"), f"web/{pagina}.html: la cabecera tiene que llevar los tres logotipos de menú de sitio.json, en su orden")
comprobar(_tres((WEB / "ficha.html").read_text(encoding="utf-8"), "logo"), "web/ficha.html: la placa del papel tiene que llevar los tres logotipos de sitio.json, en su orden")
_logos_config = re.search(r"^const LOGOS = (.*);$", config, re.M)
comprobar(_logos_config is not None and json.loads(_logos_config.group(1)) == logos, "web/config.js no lleva los logotipos de sitio.json: ejecutar generar_tarjetas.py")

MARCAS = [2.5 + 5 * i for i in range(20)] + [102.0]   # marcas de clase de la edad media (exportar_datos.py)


def edad_de(p):
    """La edad media que sale de la pirámide del JSON, con las marcas del exportador."""
    totales = [a + b for a, b in zip(p["hombres"], p["mujeres"])]
    return sum(t * marca for t, marca in zip(totales, MARCAS)) / sum(totales)


def envoltorio_seguro(h):
    """Un envoltorio solo puede ejecutar su script de redirección: la política
    de contenido lleva la huella sha256 de ese script y nada más."""
    scripts = re.findall(r"<script>(.*?)</script>", h, re.S)
    csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">', h)
    if len(scripts) != 1 or not csp:
        return False
    huella = "sha256-" + base64.b64encode(hashlib.sha256(scripts[0].encode("utf-8")).digest()).decode()
    return f"script-src '{huella}'" in csp.group(1) and "default-src 'none'" in csp.group(1)


municipios = indice["municipios"]
comprobar(len(municipios) == 88, f"indice.json: {len(municipios)} municipios, no 88")
suma = 0
primer_anio = None
for m in municipios:
    cod = m["codmun"]
    # Un municipio que no encaje con el GeoPackage saldría sin código: exportar_datos.py se detiene, y aquí también.
    comprobar(isinstance(cod, int), f"{m['nombre']}: codmun no es un entero ({cod!r}); no encaja con el GeoPackage")
    if not isinstance(cod, int):
        continue
    ruta = WEB / f"datos/mun/{cod}.json"
    comprobar(ruta.exists(), f"falta {ruta.name}")
    if not ruta.exists():
        continue
    f = json.loads(ruta.read_text(encoding="utf-8"))
    comprobar(f.get("tipo") == "municipio", f"{f['nombre']}: la ficha no lleva tipo «municipio»")
    p = f["piramide"]
    total = sum(p["hombres"]) + sum(p["mujeres"])
    comprobar(total == f["poblacion"], f"{f['nombre']}: la pirámide suma {total} y la población es {f['poblacion']}")
    comprobar(f["poblacion"] == m["poblacion"], f"{f['nombre']}: población distinta en indice.json")
    suma += f["poblacion"]
    comprobar(len(p["edades"]) == 21 and p["edades"][0] == "0 a 4" and p["edades"][-1] == "100 o más",
              f"{f['nombre']}: grupos de edad {p['edades'][:1]}…{p['edades'][-1:]}")
    for clave in ("hombres", "mujeres", "extranjera_hombres", "extranjera_mujeres", "canarias_hombres", "canarias_mujeres"):
        comprobar(isinstance(p.get(clave), list) and len(p[clave]) == 21, f"{f['nombre']}: {clave} no tiene 21 valores ({'nulo' if p.get(clave) is None else len(p[clave])})")
    if isinstance(p.get("extranjera_hombres"), list) and isinstance(p.get("extranjera_mujeres"), list):
        comprobar(all(p["extranjera_hombres"][i] <= p["hombres"][i] and p["extranjera_mujeres"][i] <= p["mujeres"][i] for i in range(21)),
                  f"{f['nombre']}: nacidos fuera por encima del total en algún grupo")
    ev = f["evolucion"]
    primer_anio = ev["anios"][0] if primer_anio is None else min(primer_anio, ev["anios"][0])
    serie = dict(zip(ev["anios"], ev["valores"]))
    n = ev["anio_fin"] - ev["anio_base"]
    tvma = 100 * ((serie[ev["anio_fin"]] / serie[ev["anio_base"]]) ** (1 / n) - 1)
    comprobar(abs(tvma - f["cifras"]["tvma"]) < 1e-9, f"{f['nombre']}: TVMA {f['cifras']['tvma']} no es la de la serie ({tvma:.6f}); ¿redondeo intermedio?")
    origen = f["origen"]["municipio"]
    comprobar(suma_cien(origen), f"{f['nombre']}: el lugar de nacimiento es {origen} y no suma 100,0")
    comprobar(abs(f["cifras"]["pct_hombres"] + f["cifras"]["pct_mujeres"] - 100) <= 0.15, f"{f['nombre']}: hombres + mujeres no suman 100")
    comprobar(isinstance(f["cifras"].get("edad_media"), (int, float)) and abs(edad_de(p) - f["cifras"]["edad_media"]) <= 0.05 + 1e-9,
              f"{f['nombre']}: edad media {f['cifras'].get('edad_media')} y la pirámide da {edad_de(p):.3f}")
    for cod_ind in ("C10", "C11", "C17", "C14"):
        ind = f["indices"].get(cod_ind)
        comprobar(ind is not None and all(isinstance(ind.get(k), (int, float)) for k in ("municipio", "isla", "canarias")),
                  f"{f['nombre']}: índice {cod_ind} incompleto")
    # El último dato de origen extranjero se muestra con un decimal en la ficha y
    # coincide con el del bloque de lugar de nacimiento, que ya viene con uno:
    # con la serie exportada a dos decimales, Las Palmas salía 16,6 y 16,5.
    ultimo = next((v for v in reversed(f["extranjero"]["municipio"]) if v is not None), None)
    comprobar(ultimo is not None and isinstance(origen[2], (int, float)) and mostrado(ultimo) == mostrado(origen[2]),
              f"{f['nombre']}: origen extranjero {ultimo} en la serie y {origen[2]} en el lugar de nacimiento; ¿redondeo intermedio?")
    ultimo_can = next((v for v in reversed(f["extranjero"]["canarias"]) if v is not None), None)
    comprobar(ultimo_can == indice.get("extranjero_canarias"), f"{f['nombre']}: el último dato regional de origen extranjero ({ultimo_can}) no es el de indice.json ({indice.get('extranjero_canarias')})")
    envoltorio = WEB / f"m/{cod}.html"
    comprobar(envoltorio.exists(), f"falta el envoltorio m/{cod}.html")
    if envoltorio.exists():
        h = envoltorio.read_text(encoding="utf-8")
        comprobar(f'content="{url_publica}m/{cod}.html"' in h, f"m/{cod}.html: og:url no apunta a la URL pública de sitio.json")
        comprobar(f'<link rel="canonical" href="{url_publica}m/{cod}.html">' in h, f"m/{cod}.html: la canónica no es él mismo")
        comprobar(f"ficha.html?municipio={cod}" in h, f"m/{cod}.html no redirige a la ficha")
        # Los envoltorios y las tarjetas llevan la población y el año escritos: si se
        # regeneran los datos sin regenerarlos, se publican vistas previas viejas.
        hab = format(m["poblacion"], ",").replace(",", ".")
        comprobar(f'content="{hab} habitantes.' in h and f"1 de enero de {indice['anio']}." in h,
                  f"m/{cod}.html: la población o el año de og:description no son los de indice.json: ejecutar generar_tarjetas.py")
        comprobar('<meta property="og:site_name" content="Canarias Convive">' in h, f"m/{cod}.html sin og:site_name")
        comprobar((WEB / f"og/{cod}.png").exists(), f"falta la tarjeta og/{cod}.png")
        comprobar(envoltorio_seguro(h), f"m/{cod}.html: la política de contenido no lleva la huella de su script")
comprobar(suma == indice["poblacion_canarias"], f"los 88 suman {suma} y Canarias es {indice['poblacion_canarias']}")

# Las siete islas: su ficha suma sus municipios, lleva los índices de las siete
# y su envoltorio i/<isla>.html con la tarjeta og.
islas_resumen = indice.get("islas_resumen", [])
anios_evolucion_islas = set()
comprobar(len(islas_resumen) == 7 and [i["nombre"] for i in islas_resumen] == list(indice["islas"]),
          f"indice.json: islas_resumen no son las siete islas en su orden: {[i.get('nombre') for i in islas_resumen]}")
for i in islas_resumen:
    ruta = WEB / f"datos/isla/{i['slug']}.json"
    comprobar(ruta.exists(), f"falta {ruta.name}")
    if not ruta.exists():
        continue
    f = json.loads(ruta.read_text(encoding="utf-8"))
    comprobar(f.get("tipo") == "isla" and f.get("slug") == i["slug"] and f["nombre"] == i["nombre"], f"{i['nombre']}: la ficha de isla no lleva tipo, slug y nombre")
    anios_evolucion_islas.add(tuple(f["evolucion"]["anios"]))
    p = f["piramide"]
    comprobar(sum(p["hombres"]) + sum(p["mujeres"]) == f["poblacion"] == i["poblacion"], f"{i['nombre']}: la pirámide de la isla no suma su población")
    comprobar(all(isinstance(p.get(k), list) and len(p[k]) == 21 for k in ("hombres", "mujeres", "extranjera_hombres", "extranjera_mujeres", "canarias_hombres", "canarias_mujeres")),
              f"{i['nombre']}: la pirámide de la isla no tiene 21 grupos en las seis series")
    suyos = [m for m in municipios if m["isla"] == i["nombre"]]
    comprobar(sum(m["poblacion"] for m in suyos) == f["poblacion"], f"{i['nombre']}: sus municipios no suman la población de la isla")
    comprobar([m["codmun"] for m in f["municipios"]] == [m["codmun"] for m in sorted(suyos, key=lambda m: -m["poblacion"])] and i["municipios"] == len(suyos),
              f"{i['nombre']}: la lista de municipios no es la suya de mayor a menor")
    for cod_ind in ("C10", "C11", "C17", "C14"):
        ind = f["indices"].get(cod_ind, {})
        comprobar(all(isinstance(ind.get(k), (int, float)) for k in ("isla", "canarias")) and set(ind.get("islas", {})) == set(indice["islas"]),
                  f"{i['nombre']}: índice {cod_ind} incompleto (la isla, Canarias y las siete islas)")
    ultimo = next((v for v in reversed(f["extranjero"]["isla"]) if v is not None), None)
    comprobar(ultimo is not None and mostrado(ultimo) == mostrado(f["origen"]["isla"][2]),
              f"{i['nombre']}: origen extranjero {ultimo} en la serie y {f['origen']['isla'][2]} en el lugar de nacimiento (C22I sin conciliar con C25I)")
    comprobar(suma_cien(f["origen"]["isla"]), f"{i['nombre']}: el lugar de nacimiento es {f['origen']['isla']} y no suma 100,0")
    comprobar(isinstance(f["cifras"].get("edad_media"), (int, float)) and abs(edad_de(p) - f["cifras"]["edad_media"]) <= 0.05 + 1e-9,
              f"{i['nombre']}: edad media {f['cifras'].get('edad_media')} y la pirámide de la isla da {edad_de(p):.3f}")
    comprobar(f["rankings"]["canarias"]["total"] == len(islas_resumen), f"{i['nombre']}: el puesto no es entre las {len(islas_resumen)} islas")
    # Los componentes de la isla son la suma de los de sus municipios en cada año con todos los datos
    # (las celdas cruzadas del libro se detectan aquí: los dos San Bartolomé descuadraban Lanzarote y Gran Canaria).
    suyas = [json.loads((WEB / f"datos/mun/{m['codmun']}.json").read_text(encoding="utf-8"))["componentes"] for m in suyos]
    for clave in ("vegetativo", "migratorio"):
        for j, anio in enumerate(f["componentes"]["anios"]):
            v = f["componentes"][clave][j]
            partes = [c[clave][c["anios"].index(anio)] if anio in c["anios"] else None for c in suyas]
            if v is None or any(x is None for x in partes):
                continue
            comprobar(abs(sum(partes) - v) <= 0.5, f"{i['nombre']} {anio}: {clave} de la isla {v:.0f} y sus municipios suman {sum(partes):.0f}")
    envoltorio = WEB / f"i/{i['slug']}.html"
    comprobar(envoltorio.exists(), f"falta el envoltorio i/{i['slug']}.html")
    if envoltorio.exists():
        h = envoltorio.read_text(encoding="utf-8")
        comprobar(f'content="{url_publica}i/{i["slug"]}.html"' in h and f"ficha.html?isla={i['slug']}" in h, f"i/{i['slug']}.html: og:url o redirección incorrectos")
        hab = format(i["poblacion"], ",").replace(",", ".")
        comprobar(f'content="{hab} habitantes en {i["municipios"]} municipios.' in h and f"1 de enero de {indice['anio']}." in h,
                  f"i/{i['slug']}.html: la población o el año no son los de indice.json: ejecutar generar_tarjetas.py")
        comprobar((WEB / f"og/{i['slug']}.png").exists(), f"falta la tarjeta og/{i['slug']}.png")
        comprobar(envoltorio_seguro(h), f"i/{i['slug']}.html: la política de contenido no lleva la huella de su script")
# Las dos provincias y Canarias: cada una suma sus islas, la pirámide su población,
# los índices salen de la pirámide con las fórmulas del libro (las mismas que
# reproducen las hojas de islas y Canarias) y su envoltorio lleva la tarjeta og.
def indices_de(p):
    t = [h + m for h, m in zip(p["hombres"], p["mujeres"])]
    p0, p15, p65 = sum(t[:3]), sum(t[3:13]), sum(t[13:])
    return {"C10": round(p65 / p0, 2), "C11": round(p0 / p15 * 100, 1),
            "C17": round((p0 + p65) / p15 * 100, 1), "C14": round(t[3] / t[12] * 100, 1)}


def comprobar_ambito(f, quien, clave, islas_suyas, envoltorio, consulta, contiene):
    p = f["piramide"]
    comprobar(sum(p["hombres"]) + sum(p["mujeres"]) == f["poblacion"], f"{quien}: la pirámide no suma su población")
    comprobar(sum(i["poblacion"] for i in islas_suyas) == f["poblacion"], f"{quien}: sus islas no suman su población")
    comprobar([i["nombre"] for i in f["islas"]] == [i["nombre"] for i in sorted(islas_suyas, key=lambda i: -i["poblacion"])]
              and all(abs(i["peso"] - i["poblacion"] / f["poblacion"] * 100) < 0.006 for i in f["islas"]),
              f"{quien}: la lista de islas no es la suya de mayor a menor con su peso")
    for cod_ind, esperado in indices_de(p).items():
        ind = f["indices"].get(cod_ind, {})
        comprobar(ind.get(clave) == esperado and isinstance(ind.get("canarias"), (int, float))
                  and set(ind.get("islas", {})) == {i["nombre"] for i in islas_suyas},
                  f"{quien}: índice {cod_ind} = {ind.get(clave)}; la pirámide da {esperado}, o faltan Canarias o sus islas")
    ultimo = next((v for v in reversed(f["extranjero"][clave]) if v is not None), None)
    comprobar(ultimo is not None and mostrado(ultimo) == mostrado(f["origen"][clave][2]),
              f"{quien}: origen extranjero {ultimo} en la serie y {f['origen'][clave][2]} en el lugar de nacimiento")
    comprobar(suma_cien(f["origen"][clave]), f"{quien}: el lugar de nacimiento es {f['origen'][clave]} y no suma 100,0")
    comprobar(isinstance(f["cifras"].get("edad_media"), (int, float)) and abs(edad_de(p) - f["cifras"]["edad_media"]) <= 0.05 + 1e-9,
              f"{quien}: edad media {f['cifras'].get('edad_media')} y la pirámide da {edad_de(p):.3f}")
    # Los componentes son la suma de los de sus islas en cada año con todos los datos.
    suyas = [json.loads((WEB / f"datos/isla/{i['slug']}.json").read_text(encoding="utf-8"))["componentes"] for i in islas_suyas]
    for cl in ("vegetativo", "migratorio"):
        for j, anio in enumerate(f["componentes"]["anios"]):
            v = f["componentes"][cl][j]
            partes = [c[cl][c["anios"].index(anio)] if anio in c["anios"] else None for c in suyas]
            if v is None or any(x is None for x in partes):
                continue
            comprobar(abs(sum(partes) - v) <= 0.5, f"{quien} {anio}: {cl} {v:.0f} y sus islas suman {sum(partes):.0f}")
    comprobar(envoltorio.exists(), f"falta el envoltorio {envoltorio.relative_to(WEB)}")
    if envoltorio.exists():
        h = envoltorio.read_text(encoding="utf-8")
        ruta = envoltorio.relative_to(WEB).as_posix()
        comprobar(f'content="{url_publica}{ruta}"' in h and f"ficha.html?{consulta}" in h, f"{ruta}: og:url o redirección incorrectos")
        hab = format(f["poblacion"], ",").replace(",", ".")
        comprobar(f'content="{hab} habitantes en {contiene}.' in h and f"1 de enero de {indice['anio']}." in h,
                  f"{ruta}: la población, lo que contiene o el año no son los de los datos: ejecutar generar_tarjetas.py")
        comprobar((WEB / f"og/{f['slug']}.png").exists(), f"falta la tarjeta og/{f['slug']}.png")
        comprobar(envoltorio_seguro(h), f"{ruta}: la política de contenido no lleva la huella de su script")


provincias = indice.get("provincias", [])
comprobar([p["nombre"] for p in provincias] == ["Santa Cruz de Tenerife", "Las Palmas"]
          and [len(p["islas"]) for p in provincias] == [4, 3] and sum(p["municipios"] for p in provincias) == 88,
          f"indice.json: provincias incompletas o desordenadas: {[(p.get('nombre'), p.get('islas')) for p in provincias]}")
for pr in provincias:
    ruta = WEB / f"datos/provincia/{pr['slug']}.json"
    comprobar(ruta.exists(), f"falta {ruta.name}")
    if not ruta.exists():
        continue
    f = json.loads(ruta.read_text(encoding="utf-8"))
    comprobar(f.get("tipo") == "provincia" and f.get("slug") == pr["slug"] and f["nombre"] == pr["nombre"] and f["poblacion"] == pr["poblacion"],
              f"{pr['nombre']}: la ficha de provincia no lleva tipo, slug, nombre y población")
    suyas = [i for i in islas_resumen if i["slug"] in pr["islas"]]
    comprobar(f["rankings"]["canarias"].get("puesto") is None and abs(f["rankings"]["canarias"]["peso"] - f["poblacion"] / indice["poblacion_canarias"] * 100) < 0.006,
              f"{pr['nombre']}: el peso en Canarias no cuadra, o lleva puesto (entre dos no hay clasificación)")
    suyos = [m for m in municipios if m["isla"] in {i["nombre"] for i in suyas}]
    comprobar([m["codmun"] for m in f["municipios"]] == [m["codmun"] for m in sorted(suyos, key=lambda m: -m["poblacion"])] and pr["municipios"] == len(suyos),
              f"{pr['nombre']}: la lista de municipios no es la suya de mayor a menor")
    comprobar_ambito(f, pr["nombre"], "provincia", suyas, WEB / f"p/{pr['slug']}.html", f"provincia={pr['slug']}",
                     f"{len(suyas)} islas y {len(suyos)} municipios")

ruta = WEB / "datos/canarias.json"
comprobar(ruta.exists(), "falta datos/canarias.json")
if ruta.exists():
    f = json.loads(ruta.read_text(encoding="utf-8"))
    comprobar(f.get("tipo") == "canarias" and f.get("slug") == "canarias" and f["poblacion"] == indice["poblacion_canarias"],
              "Canarias: la ficha no lleva tipo, slug y la población de indice.json")
    comprobar([p["nombre"] for p in f["provincias"]] == [p["nombre"] for p in sorted(provincias, key=lambda p: -p["poblacion"])]
              and all(abs(p["peso"] - p["poblacion"] / f["poblacion"] * 100) < 0.006 for p in f["provincias"]),
              "Canarias: la lista de provincias no va de mayor a menor con su peso")
    comprobar(all("municipio" not in b and "isla" not in b and "provincia" not in b for b in (f["extranjero"], f["origen"])),
              "Canarias: la serie propia tiene que ser «canarias» (sin otra clave)")
    comprobar(anios_evolucion_islas == {tuple(f["evolucion"]["anios"])},
              f"Canarias: la evolución tiene que llevar los mismos años que las de isla (desde 2000), no {f['evolucion']['anios'][0]}–{f['evolucion']['anios'][-1]}")
    comprobar_ambito(f, "Canarias", "canarias", islas_resumen, WEB / "r/canarias.html", "canarias",
                     f"{len(islas_resumen)} islas y {len(municipios)} municipios")

# La referencia de Canarias en el lugar de nacimiento es una sola en las 98 fichas y suma 100,0.
_refs_canarias = {tuple(json.loads(r.read_text(encoding="utf-8"))["origen"]["canarias"])
                  for r in [WEB / "datos/canarias.json", *(WEB / "datos").glob("*/*.json")] if r.parent.name != "geo"}
comprobar(len(_refs_canarias) == 1 and suma_cien(list(next(iter(_refs_canarias)))),
          f"el lugar de nacimiento de Canarias tiene que ser uno solo en todas las fichas y sumar 100,0: {sorted(_refs_canarias)}")

# La geometría lleva los mismos 88 municipios, con el mismo código INE.
geo = json.loads((WEB / "datos/geo/municipios.json").read_text(encoding="utf-8"))
codigos_geo = [ft["properties"]["codmun"] for ft in geo["features"]]
comprobar(len(codigos_geo) == 88 and set(codigos_geo) == {m["codmun"] for m in municipios},
          f"geo/municipios.json: {len(codigos_geo)} geometrías; faltan {sorted({m['codmun'] for m in municipios} - set(codigos_geo))}")
# Un solo orden de islas (de oeste a este) para la portada, los selectores y el dossier.
comprobar(list(indice["islas"]) == ["El Hierro", "La Palma", "La Gomera", "Tenerife", "Gran Canaria", "Fuerteventura", "Lanzarote"],
          f"indice.json: las islas no van de oeste a este: {list(indice['islas'])}")

# La fuente de cada gráfico (FUENTES_GRAFICOS en datos-ui.js) lleva los años de la
# operación estadística escritos a mano: cuando se actualicen los datos, el año
# de referencia del índice tiene que seguir apareciendo en cada una.
ui = (WEB / "datos-ui.js").read_text(encoding="utf-8")
bloque = re.search(r"const FUENTES_GRAFICOS = \{(.*?)\n\};", ui, re.S)
graficos = dict(re.findall(r"^\s+(\w+): '([^']*)',$", bloque.group(1), re.M)) if bloque else {}
anio_ref = str(indice["anio"])
for clave in ("evolucion", "evolucion_isla", "evolucion_canarias", "municipios", "islas", "extranjero", "mapas", "piramide", "piramide_nacimiento", "indices", "componentes", "nacimiento"):
    texto = graficos.get(clave, "")
    comprobar(texto.startswith("ISTAC. ") or texto.startswith("GRAFCAN, "), f"fuente del gráfico «{clave}»: falta o no empieza por el organismo")
    comprobar(texto.endswith("."), f"fuente del gráfico «{clave}»: sin punto final")
    comprobar("-" not in texto, f"fuente del gráfico «{clave}»: los periodos van con raya (–), no con guion")
    esperado = str(indice["anio"] - 1) if clave == "componentes" else anio_ref
    comprobar(esperado in texto, f"fuente del gráfico «{clave}» no lleva el año {esperado}: revisar la redacción tras actualizar los datos")

versiones = set()
RUTAS = {"index": "", "ficha": "ficha.html", "comparar": "comparar.html", "guia": "guia.html", "dossier": "dossier.html"}
for pagina, ruta in RUTAS.items():
    h = (WEB / f"{pagina}.html").read_text(encoding="utf-8")
    versiones |= set(re.findall(r"\?v=(\d+)", h))
    comprobar('src="config.js' in h and 'src="comun.js' in h, f"{pagina}.html no carga config.js y comun.js")
    # Canónica y og: de la página principal, con la URL de sitio.json.
    comprobar(f'<link rel="canonical" href="{url_publica}{ruta}">' in h, f"{pagina}.html: la canónica no es la de sitio.json")
    if 'property="og:url"' in h:   # el dossier no lleva og: (noindex)
        comprobar(f'<meta property="og:url" content="{url_publica}{ruta}">' in h, f"{pagina}.html: og:url no es la de sitio.json")
        comprobar(f'<meta property="og:image" content="{url_publica}og/portada.png">' in h, f"{pagina}.html: og:image no es la de sitio.json")
    comprobar("Padrón" not in h and "padrón" not in h, f"{pagina}.html atribuye los datos al padrón; la fuente reciente es censal: decir «Población a 1 de enero»")
    comprobar("fonts.googleapis.com" not in h and "gstatic" not in h, f"{pagina}.html carga recursos de terceros: la tipografía va en web/fonts/")
    # Política de contenido: solo scripts propios; ni manejadores ni scripts en línea (la política los bloquearía).
    comprobar('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\';' in h, f"{pagina}.html sin política de contenido")
    comprobar(not re.search(r"\son[a-z]+=\"", h), f"{pagina}.html lleva un manejador en línea, que la política de contenido bloquea")
    comprobar(not re.search(r"<script(?![^>]*\ssrc=)[^>]*>", h), f"{pagina}.html lleva un script en línea, que la política de contenido bloquea")
    if pagina == "index":
        # La descripción de la portada lleva el año y el arranque de la serie escritos: generar_tarjetas.py pone el año.
        comprobar(h.count(f"1 de enero de {indice['anio']}.") == 2, f"index.html: la descripción no dice «1 de enero de {indice['anio']}»: ejecutar generar_tarjetas.py")
        comprobar(f"desde {primer_anio}" in h, f"index.html: la descripción no dice «desde {primer_anio}», que es donde arranca la serie")
comprobar(len(versiones) == 1, f"las páginas mezclan versiones de recursos: {sorted(versiones)}")
for pagina in ("404", "enmarcada"):
    h = (WEB / f"{pagina}.html").read_text(encoding="utf-8")
    comprobar('http-equiv="Content-Security-Policy"' in h and "<script" not in h, f"{pagina}.html: sin política de contenido o con script")
for js in ("portada", "dossier", "ficha", "comparar", "guia", "datos-ui"):
    comprobar("adrón" not in (WEB / f"{js}.js").read_text(encoding="utf-8"), f"{js}.js atribuye los datos al padrón")

# Ensayo de mudanza: con otra URL pública en sitio.json, ¿queda alguna referencia
# al dominio actual en las cinco páginas, los envoltorios o config.js?
sys.path.insert(0, str(RAIZ))
try:
    from generar_tarjetas import reescribir_paginas, escribir_envoltorios
    with tempfile.TemporaryDirectory() as tmp:
        web_tmp = Path(tmp) / "web"
        web_tmp.mkdir()
        for pagina in [*RUTAS, "404", "enmarcada"]:
            shutil.copy(WEB / f"{pagina}.html", web_tmp / f"{pagina}.html")
        ficticia = "https://ejemplo.test/fichas/"
        reescribir_paginas(ficticia, web_tmp, origenes=sitio.get("origenes_iframe", []))
        escribir_envoltorios(indice, ficticia, web_tmp)
        comprobar(all(o in (web_tmp / "config.js").read_text(encoding="utf-8") for o in sitio.get("origenes_iframe", [])),
                  "ensayo de mudanza: config.js no lleva los orígenes del iframe")
        dominio_actual = re.sub(r"^https?://", "", url_publica).split("/")[0]
        for f in sorted(web_tmp.rglob("*")):
            if f.is_file():
                t = f.read_text(encoding="utf-8")
                comprobar(dominio_actual not in t, f"ensayo de mudanza: {f.relative_to(web_tmp)} conserva {dominio_actual}")
                comprobar(ficticia in t, f"ensayo de mudanza: {f.relative_to(web_tmp)} no lleva la URL nueva")
except ImportError as e:
    comprobar(False, f"no se puede importar generar_tarjetas para el ensayo de mudanza: {e}")

if fallos:
    print(f"FALLA · {len(fallos)} problema(s):")
    for x in fallos:
        print(" -", x)
    sys.exit(1)
print(f"ok · 88 municipios, {len(islas_resumen)} islas, {len(provincias)} provincias y Canarias, {format(suma, ',').replace(',', '.')} habitantes, {len(graficos)} fuentes de gráfico, recursos v={versiones.pop()}, ensayo de mudanza a https://ejemplo.test/fichas/ limpio")

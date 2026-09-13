#!/usr/bin/env python3
"""Invariantes de los datos exportados. Solo biblioteca estándar: corre en
cualquier sitio, también en GitHub Actions antes de publicar.

Comprueba lo que no puede fallar sin que la ficha mienta: que hay 88
municipios, que cada pirámide suma su población y las 88 suman Canarias, que
la TVMA guardada es la de la serie (sin redondeo intermedio), que los repartos
por lugar de nacimiento suman cien, que los cuatro índices están en los tres
ámbitos, que cada indicador tiene su fuente con enlace https, que los 88
envoltorios de web/m/ apuntan a la URL pública de sitio.json y que las cinco
páginas cargan la misma versión de recursos.

La conciliación contra el Excel, que sí necesita el libro, está en
conciliar_excel.py."""
import json
import re
import sys
from pathlib import Path

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
comprobar(url_publica in (WEB / "config.js").read_text(encoding="utf-8"), "web/config.js no lleva la URL de sitio.json: ejecutar generar_tarjetas.py")

municipios = indice["municipios"]
comprobar(len(municipios) == 88, f"indice.json: {len(municipios)} municipios, no 88")
suma = 0
for m in municipios:
    cod = m["codmun"]
    ruta = WEB / f"datos/mun/{cod}.json"
    comprobar(ruta.exists(), f"falta {ruta.name}")
    if not ruta.exists():
        continue
    f = json.loads(ruta.read_text(encoding="utf-8"))
    p = f["piramide"]
    total = sum(p["hombres"]) + sum(p["mujeres"])
    comprobar(total == f["poblacion"], f"{f['nombre']}: la pirámide suma {total} y la población es {f['poblacion']}")
    comprobar(f["poblacion"] == m["poblacion"], f"{f['nombre']}: población distinta en indice.json")
    suma += f["poblacion"]
    comprobar(len(p["edades"]) == 21 and p["edades"][0] == "0 a 4" and p["edades"][-1] == "100 o más",
              f"{f['nombre']}: grupos de edad {p['edades'][:1]}…{p['edades'][-1:]}")
    for clave in ("hombres", "mujeres", "extranjera_hombres", "extranjera_mujeres", "canarias_hombres", "canarias_mujeres"):
        comprobar(len(p[clave]) == 21, f"{f['nombre']}: {clave} tiene {len(p[clave])} valores")
    comprobar(all(p["extranjera_hombres"][i] <= p["hombres"][i] and p["extranjera_mujeres"][i] <= p["mujeres"][i] for i in range(21)),
              f"{f['nombre']}: nacidos fuera por encima del total en algún grupo")
    ev = f["evolucion"]
    serie = dict(zip(ev["anios"], ev["valores"]))
    n = ev["anio_fin"] - ev["anio_base"]
    tvma = 100 * ((serie[ev["anio_fin"]] / serie[ev["anio_base"]]) ** (1 / n) - 1)
    comprobar(abs(tvma - f["cifras"]["tvma"]) < 1e-9, f"{f['nombre']}: TVMA {f['cifras']['tvma']} no es la de la serie ({tvma:.6f}); ¿redondeo intermedio?")
    comprobar(abs(sum(f["origen"]["municipio"]) - 100) <= 0.15, f"{f['nombre']}: el lugar de nacimiento suma {sum(f['origen']['municipio'])}")
    comprobar(abs(f["cifras"]["pct_hombres"] + f["cifras"]["pct_mujeres"] - 100) <= 0.15, f"{f['nombre']}: hombres + mujeres no suman 100")
    for cod_ind in ("C10", "C11", "C17", "C14"):
        ind = f["indices"].get(cod_ind)
        comprobar(ind is not None and all(isinstance(ind.get(k), (int, float)) for k in ("municipio", "isla", "canarias")),
                  f"{f['nombre']}: índice {cod_ind} incompleto")
    envoltorio = WEB / f"m/{cod}.html"
    comprobar(envoltorio.exists(), f"falta el envoltorio m/{cod}.html")
    if envoltorio.exists():
        h = envoltorio.read_text(encoding="utf-8")
        comprobar(f'content="{url_publica}m/{cod}.html"' in h, f"m/{cod}.html: og:url no apunta a la URL pública de sitio.json")
        comprobar(f'<link rel="canonical" href="{url_publica}m/{cod}.html">' in h, f"m/{cod}.html: la canónica no es él mismo")
        comprobar(f"ficha.html?municipio={cod}" in h, f"m/{cod}.html no redirige a la ficha")
comprobar(suma == indice["poblacion_canarias"], f"los 88 suman {suma} y Canarias es {indice['poblacion_canarias']}")

fuentes = indice.get("fuentes_indicadores", {})
for clave in ("poblacion", "tvma", "edad", "sexo", "evolucion", "extranjero", "piramide", "nacimiento",
              "vegetativo", "migratorio", "rankings", "envejecimiento", "juventud", "dependencia", "reemplazo"):
    fu = fuentes.get(clave)
    comprobar(fu is not None and fu.get("periodo") and fu.get("nota") and fu.get("enlaces"), f"fuentes_indicadores: falta o está incompleta «{clave}»")
    for e in (fu or {}).get("enlaces", []):
        comprobar(str(e.get("url", "")).startswith("https://") and e.get("organismo"), f"fuentes_indicadores «{clave}»: enlace sin https u organismo")

# La fuente de cada gráfico (FUENTES_GRAFICOS en datos-ui.js) lleva los años de la
# operación estadística escritos a mano: cuando se actualicen los datos, el año
# de referencia del índice tiene que seguir apareciendo en cada una.
ui = (WEB / "datos-ui.js").read_text(encoding="utf-8")
bloque = re.search(r"const FUENTES_GRAFICOS = \{(.*?)\n\};", ui, re.S)
graficos = dict(re.findall(r"^\s+(\w+): '([^']*)',$", bloque.group(1), re.M)) if bloque else {}
anio_ref = str(indice["anio"])
for clave in ("evolucion", "extranjero", "mapas", "piramide", "piramide_nacimiento", "indices", "componentes", "nacimiento"):
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
comprobar(len(versiones) == 1, f"las páginas mezclan versiones de recursos: {sorted(versiones)}")
for js in ("portada", "dossier", "ficha", "comparar", "guia", "datos-ui"):
    comprobar("adrón" not in (WEB / f"{js}.js").read_text(encoding="utf-8"), f"{js}.js atribuye los datos al padrón")

# Ensayo de mudanza: con otra URL pública en sitio.json, ¿queda alguna referencia
# al dominio actual en las cinco páginas, los envoltorios o config.js?
import shutil
import sys as _sys
import tempfile
_sys.path.insert(0, str(RAIZ))
try:
    from generar_tarjetas import reescribir_paginas, escribir_envoltorios
    with tempfile.TemporaryDirectory() as tmp:
        web_tmp = Path(tmp) / "web"
        web_tmp.mkdir()
        for pagina in RUTAS:
            shutil.copy(WEB / f"{pagina}.html", web_tmp / f"{pagina}.html")
        ficticia = "https://ejemplo.test/fichas/"
        reescribir_paginas(ficticia, web_tmp)
        escribir_envoltorios(indice, ficticia, web_tmp)
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
print(f"ok · 88 municipios, {format(suma, ',').replace(',', '.')} habitantes, {len(fuentes)} fuentes con enlace y {len(graficos)} fuentes de gráfico, recursos v={versiones.pop()}, ensayo de mudanza a https://ejemplo.test/fichas/ limpio")

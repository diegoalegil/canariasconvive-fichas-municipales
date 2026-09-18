#!/usr/bin/env python3
"""Tarjetas de vista previa del enlace (PNG de 1200 × 630 para WhatsApp, X y
LinkedIn), una genérica, una por municipio, una por isla, una por provincia y
la de Canarias, más los envoltorios web/m/<cod>.html, web/i/<slug>.html,
web/p/<slug>.html y web/r/canarias.html con las etiquetas og: de cada ficha
(los rastreadores no ejecutan JavaScript) y la URL pública de sitio.json en
las cinco páginas y config.js.

    python3 generar_tarjetas.py  ->  web/og/portada.png, web/og/<cod>.png, web/og/<slug>.png,
                                     web/m/<cod>.html, web/i/<slug>.html, web/p/<slug>.html, web/r/canarias.html

La tarjeta lleva un solo dato, los habitantes, y ningún texto por debajo de
26 px. Compone en Avenir Next (Montserrat no está en el sistema; si se instala,
va la primera en FAMILIAS). Necesita macOS y Pillow."""
import base64
import hashlib
import json
import re
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pruebas/invariantes.py importa este módulo sin Pillow
    Image = ImageDraw = ImageFont = None

AQUI = Path(__file__).resolve().parent
WEB = AQUI / "web"
SALIDA_OG = WEB / "og"
SALIDA_M = WEB / "m"
SALIDA_I = WEB / "i"
SALIDA_P = WEB / "p"
SALIDA_R = WEB / "r"

W, H = 1200, 630
AZUL = (24, 95, 165)
AZUL_MEDIO = (46, 117, 182)
AZUL_SOBRE = (207, 226, 248)
AZUL_CLARO = (133, 183, 235)
BLANCO = (255, 255, 255)

FAMILIAS = [
    ("/System/Library/Fonts/Avenir Next.ttc", {"demi": 2, "medio": 5, "normal": 7, "negrita": 0}),
    ("/System/Library/Fonts/HelveticaNeue.ttc", {"demi": 1, "medio": 0, "normal": 0, "negrita": 1}),
]


def familia():
    for ruta, idx in FAMILIAS:
        if Path(ruta).exists():
            return ruta, idx
    raise SystemExit("No hay ninguna tipografía de las previstas en este sistema.")


_cache = {}


def tf(peso, px):
    clave = (peso, px)
    if clave not in _cache:
        ruta, idx = familia()
        _cache[clave] = ImageFont.truetype(ruta, px, index=idx[peso])
    return _cache[clave]


def nf(n):
    """Miles con punto, como en el resto del sitio."""
    return f"{n:,}".replace(",", ".")


def ancho(d, texto, fuente):
    return d.textbbox((0, 0), texto, font=fuente)[2]


def partir(d, texto, fuente, limite):
    """Reparte el texto en líneas que quepan en `limite`."""
    palabras, lineas, actual = texto.split(), [], ""
    for p in palabras:
        prueba = f"{actual} {p}".strip()
        if ancho(d, prueba, fuente) <= limite or not actual:
            actual = prueba
        else:
            lineas.append(actual)
            actual = p
    if actual:
        lineas.append(actual)
    return lineas


def cuerpo_que_cabe(d, texto, limite_ancho, alto_max, max_lineas, px_max, px_min):
    """Baja el cuerpo hasta que el nombre quepa en la caja (por alto total, no por líneas)."""
    for px in range(px_max, px_min - 1, -2):
        f = tf("demi", px)
        lineas = partir(d, texto, f, limite_ancho)
        if len(lineas) <= max_lineas and len(lineas) * px * 1.14 <= alto_max:
            return f, lineas
    f = tf("demi", px_min)
    return f, partir(d, texto, f, limite_ancho)[:max_lineas]


# ------------------------------------------------------------------ silueta --
def silueta(draw, rasgos, codmun, caja, destacar=None):
    """Dibuja los municipios dados encajados en `caja`, con el de `codmun`
    destacado en blanco; con codmun=None se destacan todos (la isla entera), o
    los que diga `destacar(rasgo)` (las islas de una provincia)."""
    x0 = min(f["properties"]["bbox"][0] for f in rasgos)
    y0 = min(f["properties"]["bbox"][1] for f in rasgos)
    x1 = max(f["properties"]["bbox"][2] for f in rasgos)
    y1 = max(f["properties"]["bbox"][3] for f in rasgos)
    bw, bh = x1 - x0, y1 - y0
    cx, cy, cw, ch = caja
    k = min(cw / bw, ch / bh)
    dx = cx + (cw - bw * k) / 2
    dy = cy + (ch - bh * k) / 2

    def proy(p):
        return (dx + (p[0] - x0) * k, dy + (y1 - p[1]) * k)   # y invertida

    for f in rasgos:
        destacado = destacar(f) if destacar else (codmun is None or f["properties"]["codmun"] == codmun)
        color = BLANCO if destacado else AZUL_MEDIO
        for poli in f["geometry"]["coordinates"]:
            for anillo in poli:
                if len(anillo) < 3:
                    continue
                draw.polygon([proy(p) for p in anillo], fill=color, outline=AZUL)


# ------------------------------------------------------------------ tarjeta --
def tarjeta_municipio(m, geo, anio):
    img = Image.new("RGB", (W, H), AZUL)
    d = ImageDraw.Draw(img)

    rasgos = [f for f in geo["features"] if f["properties"]["isla"] == m["isla"]]
    silueta(d, rasgos, m["codmun"], (760, 96, 380, 438))

    d.text((72, 74), "FICHA DEMOGRÁFICA MUNICIPAL", font=tf("demi", 27), fill=AZUL_SOBRE)

    f_nombre, lineas = cuerpo_que_cabe(d, m["nombre"], 640, 212, 3, 88, 40)
    y = 140
    for ln in lineas:
        d.text((72, y), ln, font=f_nombre, fill=BLANCO)
        y += int(f_nombre.size * 1.14)

    y = max(y + 30, 372)
    d.text((72, y), nf(m["poblacion"]), font=tf("medio", 76), fill=BLANCO)
    d.text((72, y + 90), "habitantes", font=tf("normal", 34), fill=AZUL_CLARO)

    d.text((72, 524), f"{m['isla']} · 1 de enero de {anio}", font=tf("medio", 29), fill=AZUL_SOBRE)
    d.rectangle([72, 576, 132, 580], fill=AZUL_CLARO)
    d.text((72, 592), "Canarias Convive", font=tf("demi", 25), fill=AZUL_SOBRE)
    return img


def tarjeta_isla(i, geo, anio):
    """La isla entera en blanco, con sus límites municipales."""
    img = Image.new("RGB", (W, H), AZUL)
    d = ImageDraw.Draw(img)

    rasgos = [f for f in geo["features"] if f["properties"]["isla"] == i["nombre"]]
    silueta(d, rasgos, None, (760, 96, 380, 438))

    d.text((72, 74), "FICHA DEMOGRÁFICA DE LA ISLA", font=tf("demi", 27), fill=AZUL_SOBRE)

    f_nombre, lineas = cuerpo_que_cabe(d, i["nombre"], 640, 212, 3, 88, 40)
    y = 140
    for ln in lineas:
        d.text((72, y), ln, font=f_nombre, fill=BLANCO)
        y += int(f_nombre.size * 1.14)

    y = max(y + 30, 372)
    d.text((72, y), nf(i["poblacion"]), font=tf("medio", 76), fill=BLANCO)
    d.text((72, y + 90), "habitantes", font=tf("normal", 34), fill=AZUL_CLARO)

    d.text((72, 524), f"{i['municipios']} municipios · 1 de enero de {anio}", font=tf("medio", 29), fill=AZUL_SOBRE)
    d.rectangle([72, 576, 132, 580], fill=AZUL_CLARO)
    d.text((72, 592), "Canarias Convive", font=tf("demi", 25), fill=AZUL_SOBRE)
    return img


def tarjeta_ambito(nombre, rotulo, poblacion, pie, geo, anio, islas=None):
    """Canarias entera o una provincia: el archipiélago con sus islas en blanco."""
    img = Image.new("RGB", (W, H), AZUL)
    d = ImageDraw.Draw(img)

    suyas = set(islas) if islas else None
    silueta(d, geo["features"], None, (700, 150, 440, 330),
            destacar=(lambda f: suyas is None or f["properties"]["isla"] in suyas))

    d.text((72, 74), rotulo, font=tf("demi", 27), fill=AZUL_SOBRE)

    f_nombre, lineas = cuerpo_que_cabe(d, nombre, 600, 212, 3, 88, 40)
    y = 140
    for ln in lineas:
        d.text((72, y), ln, font=f_nombre, fill=BLANCO)
        y += int(f_nombre.size * 1.14)

    y = max(y + 30, 372)
    d.text((72, y), nf(poblacion), font=tf("medio", 76), fill=BLANCO)
    d.text((72, y + 90), "habitantes", font=tf("normal", 34), fill=AZUL_CLARO)

    d.text((72, 524), f"{pie} · 1 de enero de {anio}", font=tf("medio", 29), fill=AZUL_SOBRE)
    d.rectangle([72, 576, 132, 580], fill=AZUL_CLARO)
    d.text((72, 592), "Canarias Convive", font=tf("demi", 25), fill=AZUL_SOBRE)
    return img


def tarjeta_portada(idx):
    img = Image.new("RGB", (W, H), AZUL)
    d = ImageDraw.Draw(img)
    d.text((72, 88), "CANARIAS CONVIVE", font=tf("demi", 29), fill=AZUL_SOBRE)

    f = tf("demi", 74)
    y = 168
    for ln in partir(d, "Una ficha por municipio, isla, provincia y para toda Canarias", f, 1000):
        d.text((72, y), ln, font=f, fill=BLANCO)
        y += 88

    d.text((72, 424), f"88 municipios · 7 islas · 2 provincias · 1 de enero de {idx['anio']}",
           font=tf("medio", 38), fill=AZUL_CLARO)
    d.rectangle([72, 512, 132, 516], fill=AZUL_CLARO)
    d.text((72, 542), f"{nf(idx['poblacion_canarias'])} habitantes",
           font=tf("medio", 32), fill=AZUL_SOBRE)
    return img


ENVOLTORIO_ISLA = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '{hash}'; base-uri 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{nombre} · Ficha demográfica de la isla · Canarias Convive</title>
<link rel="canonical" href="{base}/i/{slug}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Canarias Convive">
<meta property="og:title" content="{nombre} · Ficha demográfica de la isla">
<meta property="og:description" content="{hab} habitantes en {n} municipios. Estructura de la población, evolución e índices. Población a 1 de enero de {anio}.">
<meta property="og:image" content="{base}/og/{slug}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{base}/i/{slug}.html">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=../ficha.html?isla={slug}">
<script>{script}</script>
</head>
<body>
<p>Abriendo la ficha de {nombre}… <a href="../ficha.html?isla={slug}">Ir a la ficha</a>.</p>
</body>
</html>
"""

# Provincia y Canarias: la misma tarjeta, con la carpeta, el rótulo, lo que
# contienen y la dirección de la ficha como huecos.
ENVOLTORIO_AMBITO = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '{hash}'; base-uri 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{nombre} · Ficha demográfica{de} · Canarias Convive</title>
<link rel="canonical" href="{base}/{carpeta}/{slug}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Canarias Convive">
<meta property="og:title" content="{nombre} · Ficha demográfica{de}">
<meta property="og:description" content="{hab} habitantes en {contiene}. Estructura de la población, evolución e índices. Población a 1 de enero de {anio}.">
<meta property="og:image" content="{base}/og/{slug}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{base}/{carpeta}/{slug}.html">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=../ficha.html?{consulta}">
<script>{script}</script>
</head>
<body>
<p>Abriendo la ficha de {nombre}… <a href="../ficha.html?{consulta}">Ir a la ficha</a>.</p>
</body>
</html>
"""

ENVOLTORIO = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '{hash}'; base-uri 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{nombre} · Ficha demográfica · Canarias Convive</title>
<link rel="canonical" href="{base}/m/{cod}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Canarias Convive">
<meta property="og:title" content="{nombre} · Ficha demográfica">
<meta property="og:description" content="{hab} habitantes. Estructura de la población, evolución e índices. Población a 1 de enero de {anio}.">
<meta property="og:image" content="{base}/og/{cod}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{base}/m/{cod}.html">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=../ficha.html?municipio={cod}">
<script>{script}</script>
</head>
<body>
<p>Abriendo la ficha de {nombre}… <a href="../ficha.html?municipio={cod}">Ir a la ficha</a>.</p>
</body>
</html>
"""

def hash_script(codigo):
    """Huella del script en línea de un envoltorio, para su política de
    contenido: es lo único que puede ejecutar la página."""
    return "sha256-" + base64.b64encode(hashlib.sha256(codigo.encode("utf-8")).digest()).decode()


def script_envoltorio(destino):
    # La consulta se conserva: ?marca=obiten llega a la ficha (comun.js).
    return f"location.replace('{destino}' + (location.search ? '&' + location.search.slice(1) : '') + location.hash);"


# La URL pública vive en sitio.json; cambiar de alojamiento es cambiar ese
# fichero y volver a ejecutar este script.
SITIO = json.loads((AQUI / "sitio.json").read_text(encoding="utf-8"))
BASE = SITIO["url_publica"].rstrip("/")
ORIGENES = SITIO.get("origenes_iframe", [])   # los sitios que pueden enmarcar la web (comun.js)
MARCAS = SITIO.get("marcas", {})              # los programas con los que se puede ver la web (comun.js)
MARCA_POR_DEFECTO = SITIO.get("marca_por_defecto", next(iter(MARCAS), ""))

PAGINAS = {"index": "", "ficha": "ficha.html", "comparar": "comparar.html",
           "guia": "guia.html", "dossier": "dossier.html"}


def _meta(html, propiedad, valor):
    patron = rf'(<meta property="{re.escape(propiedad)}" content=")[^"]*(">)'
    return re.sub(patron, lambda m: m.group(1) + valor + m.group(2), html)


def reescribir_paginas(base, web=WEB, anio=None, origenes=(), marcas=None):
    """Canónica, og:url y og:image de las cinco páginas, la fecha del dato en
    la descripción de la portada, el enlace de vuelta (y el icono) de 404.html
    y de enmarcada.html, y web/config.js (URL pública, orígenes que pueden
    enmarcar la web y las marcas con que se puede ver), con la URL pública dada
    (sin barra final). Devuelve los ficheros tocados."""
    if marcas is None:
        marcas = MARCAS
    base = base.rstrip("/")
    tocados = []
    for nombre, ruta in PAGINAS.items():
        p = web / f"{nombre}.html"
        html = p.read_text(encoding="utf-8")
        url = f"{base}/{ruta}"
        html = re.sub(r'<link rel="canonical" href="[^"]*">',
                      f'<link rel="canonical" href="{url}">', html)
        html = _meta(html, "og:url", url)
        html = _meta(html, "og:image", f"{base}/og/portada.png")
        if nombre == "index" and anio is not None:
            html = re.sub(r"1 de enero de \d{4}\.", f"1 de enero de {anio}.", html)
        p.write_text(html, encoding="utf-8")
        tocados.append(p)
    for nombre in ("404.html", "enmarcada.html"):
        p = web / nombre
        if p.exists():
            html = re.sub(r'(<a class="btn" href=")[^"]*(")', lambda m: m.group(1) + base + "/" + m.group(2),
                          p.read_text(encoding="utf-8"))
            html = re.sub(r'(<link rel="icon" href=")[^"]*(")', lambda m: m.group(1) + base + "/img/icono-32.png" + m.group(2), html)
            p.write_text(html, encoding="utf-8")
            tocados.append(p)
    config = web / "config.js"
    config.write_text("// Generado por generar_tarjetas.py desde sitio.json. No editar a mano.\n"
                      f"const URL_PUBLICA = {json.dumps(base + '/')};\n"
                      f"const ORIGENES_IFRAME = {json.dumps(list(origenes))};\n"
                      f"const MARCAS = {json.dumps(marcas, ensure_ascii=False)};\n"
                      f"const MARCA_POR_DEFECTO = {json.dumps(MARCA_POR_DEFECTO)};\n", encoding="utf-8")
    tocados.append(config)
    return tocados


def escribir_envoltorios(idx, base, web=WEB):
    """Los 88 m/<código>.html, los 7 i/<isla>.html, los 2 p/<provincia>.html y
    r/canarias.html: etiquetas og: de la ficha y redirección a ficha.html."""
    base = base.rstrip("/")
    salida = web / "m"
    salida.mkdir(exist_ok=True)
    for m in idx["municipios"]:
        script = script_envoltorio(f"../ficha.html?municipio={m['codmun']}")
        (salida / f"{m['codmun']}.html").write_text(
            ENVOLTORIO.format(nombre=m["nombre"], cod=m["codmun"], script=script, hash=hash_script(script),
                              hab=nf(m["poblacion"]), anio=idx["anio"], base=base),
            encoding="utf-8")
    salida = web / "i"
    salida.mkdir(exist_ok=True)
    for i in idx.get("islas_resumen", []):
        script = script_envoltorio(f"../ficha.html?isla={i['slug']}")
        (salida / f"{i['slug']}.html").write_text(
            ENVOLTORIO_ISLA.format(nombre=i["nombre"], slug=i["slug"], n=i["municipios"], script=script,
                                   hash=hash_script(script), hab=nf(i["poblacion"]), anio=idx["anio"], base=base),
            encoding="utf-8")
    # Las provincias (con sus islas y municipios) y Canarias (con las siete islas y los 88).
    ambitos = [("p", p["slug"], p["nombre"], " de la provincia", p["poblacion"],
                f"{len(p['islas'])} islas y {p['municipios']} municipios", f"provincia={p['slug']}")
               for p in idx.get("provincias", [])]
    ambitos.append(("r", "canarias", "Canarias", "", idx["poblacion_canarias"],
                    f"{len(idx['islas_resumen'])} islas y {len(idx['municipios'])} municipios", "canarias"))
    for carpeta, slug, nombre, de, poblacion, contiene, consulta in ambitos:
        salida = web / carpeta
        salida.mkdir(exist_ok=True)
        script = script_envoltorio(f"../ficha.html?{consulta}")
        (salida / f"{slug}.html").write_text(
            ENVOLTORIO_AMBITO.format(nombre=nombre, slug=slug, carpeta=carpeta, de=de, contiene=contiene,
                                     consulta=consulta, script=script, hash=hash_script(script),
                                     hab=nf(poblacion), anio=idx["anio"], base=base),
            encoding="utf-8")


def guardar(img, ruta):
    """PNG con paleta de 64 colores: indistinguible a la vista y pesa 17 KB en vez de 41."""
    img.convert("RGB").quantize(colors=64, method=Image.MEDIANCUT,
                                dither=Image.NONE).save(ruta, optimize=True)


def main():
    idx = json.loads((WEB / "datos" / "indice.json").read_text(encoding="utf-8"))
    geo = json.loads((WEB / "datos" / "geo" / "municipios.json").read_text(encoding="utf-8"))
    if Image is None:
        raise SystemExit("Hace falta Pillow para las tarjetas: pip install -r requirements.txt")
    SALIDA_OG.mkdir(exist_ok=True)
    reescribir_paginas(BASE, anio=idx["anio"], origenes=ORIGENES)
    escribir_envoltorios(idx, BASE)

    guardar(tarjeta_portada(idx), SALIDA_OG / "portada.png")
    for m in idx["municipios"]:
        guardar(tarjeta_municipio(m, geo, idx["anio"]), SALIDA_OG / f"{m['codmun']}.png")
    for i in idx["islas_resumen"]:
        guardar(tarjeta_isla(i, geo, idx["anio"]), SALIDA_OG / f"{i['slug']}.png")
    nombres_islas = {i["slug"]: i["nombre"] for i in idx["islas_resumen"]}
    for p in idx["provincias"]:
        guardar(tarjeta_ambito(p["nombre"], "FICHA DEMOGRÁFICA DE LA PROVINCIA", p["poblacion"],
                               f"{len(p['islas'])} islas · {p['municipios']} municipios", geo, idx["anio"],
                               islas=[nombres_islas[s] for s in p["islas"]]),
                SALIDA_OG / f"{p['slug']}.png")
    guardar(tarjeta_ambito("Canarias", "FICHA DEMOGRÁFICA DE CANARIAS", idx["poblacion_canarias"],
                           f"{len(idx['islas_resumen'])} islas · {len(idx['municipios'])} municipios", geo, idx["anio"]),
            SALIDA_OG / "canarias.png")
    # Cada tarjeta y cada envoltorio tienen nombre propio: ningún identificador se repite.
    ids = [str(m["codmun"]) for m in idx["municipios"]] + [i["slug"] for i in idx["islas_resumen"]] \
        + [p["slug"] for p in idx["provincias"]] + ["canarias", "portada"]
    assert len(ids) == len(set(ids)), "identificadores repetidos entre municipios, islas, provincias y Canarias"

    n = len(idx["municipios"]) + len(idx["islas_resumen"]) + len(idx["provincias"]) + 2
    peso = sum(p.stat().st_size for p in SALIDA_OG.glob("*.png"))
    print(f"{n} tarjetas en {SALIDA_OG}")
    print(f"Peso total: {peso/1024:.0f} KB  ·  media {peso/n/1024:.1f} KB")
    print(f"{len(idx['municipios'])} envoltorios en {SALIDA_M}, {len(idx['islas_resumen'])} en {SALIDA_I}, "
          f"{len(idx['provincias'])} en {SALIDA_P} y Canarias en {SALIDA_R}")
    print(f"Tipografía: {familia()[0]}")
    print(f"URL pública: {BASE}/ (sitio.json) en las cinco páginas, los envoltorios y config.js; "
          f"marcas: {', '.join(MARCAS)} (por defecto, {MARCA_POR_DEFECTO})")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Tarjetas de vista previa del enlace · Canarias Convive
======================================================

Genera los PNG de 1200 x 630 que leen WhatsApp, X y LinkedIn cuando alguien
comparte un enlace del visor: una tarjeta genérica y una por municipio.

    python3 generar_tarjetas.py        ->  web/og/portada.png  +  web/og/<codINE>.png
                                           web/m/<codINE>.html

Reglas de la tarjeta, que vienen del diseño:

  · Un solo dato numérico, los habitantes. Ningún índice, ningún porcentaje y
    ninguna pirámide: a 320 px de ancho un gráfico se vuelve una mancha.
  · Nada de sellos, medallas ni etiquetas de posición. La tarjeta identifica un
    municipio; no lo califica ni lo compara.
  · Ningún texto por debajo de 26 px, para que aguante el tamaño de miniatura de
    una lista de conversaciones.

Sobre la tipografía: el sitio compone en Montserrat, que no está en el sistema.
La tarjeta usa Avenir Next, que es la geométrica más parecida de las que hay.
Si alguna vez se instala Montserrat, basta con ponerla la primera en FAMILIAS.

Los .html de web/m/ son envoltorios: llevan las etiquetas og: de su municipio y
redirigen a la ficha. Los rastreadores de WhatsApp y X no ejecutan JavaScript,
así que las etiquetas tienen que estar en el HTML servido; una sola ficha.html
con ?municipio= mostraría la misma tarjeta para los 88.
"""
import json
import sqlite3  # noqa: F401  (no se usa; el geo ya está exportado a JSON)
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
WEB = AQUI / "web"
SALIDA_OG = WEB / "og"
SALIDA_M = WEB / "m"

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


RUTA_TF, IDX = familia()
_cache = {}


def tf(peso, px):
    clave = (peso, px)
    if clave not in _cache:
        _cache[clave] = ImageFont.truetype(RUTA_TF, px, index=IDX[peso])
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
    """Baja el cuerpo hasta que el nombre quepa en la caja.

    De Tías a Santa María de Guía de Gran Canaria hay mucha diferencia, y la
    caja no cambia: lo que cambia es el cuerpo. No basta con contar líneas: tres
    líneas a 76 px miden 260 px y se comen el pie de la tarjeta, así que la
    condición es el alto total.
    """
    for px in range(px_max, px_min - 1, -2):
        f = tf("demi", px)
        lineas = partir(d, texto, f, limite_ancho)
        if len(lineas) <= max_lineas and len(lineas) * px * 1.14 <= alto_max:
            return f, lineas
    f = tf("demi", px_min)
    return f, partir(d, texto, f, limite_ancho)[:max_lineas]


# ------------------------------------------------------------------ silueta --
def silueta(draw, rasgos, codmun, caja):
    """Dibuja la isla con el municipio destacado, encajada en `caja`."""
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
        destacado = f["properties"]["codmun"] == codmun
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

    d.text((72, 524), f"{m['isla']} · Padrón {anio}", font=tf("medio", 29), fill=AZUL_SOBRE)
    d.rectangle([72, 576, 132, 580], fill=AZUL_CLARO)
    d.text((72, 592), "Canarias Convive", font=tf("demi", 25), fill=AZUL_SOBRE)
    return img


def tarjeta_portada(idx):
    img = Image.new("RGB", (W, H), AZUL)
    d = ImageDraw.Draw(img)
    d.text((72, 88), "CANARIAS CONVIVE", font=tf("demi", 29), fill=AZUL_SOBRE)

    f = tf("demi", 74)
    y = 168
    for ln in partir(d, "Una ficha por cada municipio de Canarias", f, 1000):
        d.text((72, y), ln, font=f, fill=BLANCO)
        y += 88

    d.text((72, 424), f"88 municipios · 7 islas · Padrón {idx['anio']}",
           font=tf("medio", 38), fill=AZUL_CLARO)
    d.rectangle([72, 512, 132, 516], fill=AZUL_CLARO)
    d.text((72, 542), f"{nf(idx['poblacion_canarias'])} habitantes",
           font=tf("medio", 32), fill=AZUL_SOBRE)
    return img


ENVOLTORIO = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{nombre} · Ficha demográfica · Canarias Convive</title>
<link rel="canonical" href="../ficha.html?municipio={cod}">
<meta property="og:type" content="article">
<meta property="og:title" content="{nombre} · Ficha demográfica">
<meta property="og:description" content="{hab} habitantes. Estructura de la población, evolución e índices. Padrón {anio}.">
<meta property="og:image" content="{base}/og/{cod}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{base}/m/{cod}.html">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=../ficha.html?municipio={cod}">
</head>
<body>
<p>Abriendo la ficha de {nombre}… <a href="../ficha.html?municipio={cod}">Ir a la ficha</a>.</p>
</body>
</html>
"""

BASE = "https://diegoalegil.github.io/canariasconvive-fichas-municipales"


def main():
    idx = json.loads((WEB / "datos" / "indice.json").read_text(encoding="utf-8"))
    geo = json.loads((WEB / "datos" / "geo" / "municipios.json").read_text(encoding="utf-8"))
    SALIDA_OG.mkdir(exist_ok=True)
    SALIDA_M.mkdir(exist_ok=True)

    tarjeta_portada(idx).save(SALIDA_OG / "portada.png", optimize=True)

    for m in idx["municipios"]:
        tarjeta_municipio(m, geo, idx["anio"]).save(
            SALIDA_OG / f"{m['codmun']}.png", optimize=True)
        (SALIDA_M / f"{m['codmun']}.html").write_text(
            ENVOLTORIO.format(nombre=m["nombre"], cod=m["codmun"],
                              hab=nf(m["poblacion"]), anio=idx["anio"], base=BASE),
            encoding="utf-8")

    peso = sum(p.stat().st_size for p in SALIDA_OG.glob("*.png"))
    print(f"{len(idx['municipios']) + 1} tarjetas en {SALIDA_OG}")
    print(f"Peso total: {peso/1024:.0f} KB  ·  media {peso/(len(idx['municipios'])+1)/1024:.1f} KB")
    print(f"{len(idx['municipios'])} envoltorios en {SALIDA_M}")
    print(f"Tipografía: {RUTA_TF}")


if __name__ == "__main__":
    main()

# =============================================================================
#  FICHAS MUNICIPALES · CANARIAS CONVIVE
#  MUNICIPIOS.gpkg (17,8 MB) -> GeoJSON simplificado para web.
#
#  Lee el GeoPackage con sqlite3 y un parser WKB propio, y simplifica con
#  Douglas-Peucker. Sin geopandas ni GDAL: solo biblioteca estándar.
#
#  Las coordenadas se dejan en EPSG:4083 (REGCAN95 / UTM 28N, metros). No hace
#  falta reproyectar para dibujar: el front escala cada mapa a su recuadro.
# =============================================================================
import json
import sqlite3
import struct
from pathlib import Path

from territorios import ISLAS, COMARCAS, EXC_GEO

RUTA_GEO = Path.home() / "Downloads" / "MUNICIPIOS.gpkg"
SALIDA = Path(__file__).parent / "web" / "datos"

# Tolerancia de simplificación, en metros. Los mapas de la ficha miden unos
# 200 px de ancho: a escala de archipiélago 1 px son ~2,5 km, y a escala de
# comarca unos 50 m. 60 m mantiene el detalle a la escala mayor.
TOLERANCIA = 60
DECIMALES = 0          # metros enteros: el error es < 1 px a cualquier escala


# ------------------------------------------------------------------- WKB ---
def _leer_gpkg_blob(blob):
    """Quita la cabecera GeoPackage y devuelve el WKB desnudo."""
    if blob[:2] != b"GP":
        raise ValueError("no es un blob GeoPackage")
    flags = blob[3]
    envelope = (flags >> 1) & 0x07
    n_env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[envelope]
    return blob[8 + n_env:]


def _wkb_multipolygon(wkb):
    """Devuelve [polígono], polígono = [anillo], anillo = [(x, y), …]."""
    def leer(off, fmt):
        val = struct.unpack_from(fmt, wkb, off)
        return val, off + struct.calcsize(fmt)

    orden = "<" if wkb[0] == 1 else ">"
    (tipo,), off = leer(1, orden + "I")
    tipo &= 0xFF

    def anillo(off, orden):
        (n,), off = leer(off, orden + "I")
        pts = struct.unpack_from(orden + f"{2*n}d", wkb, off)
        off += struct.calcsize(orden + f"{2*n}d")
        return list(zip(pts[0::2], pts[1::2])), off

    def poligono(off, orden):
        (n_anillos,), off = leer(off, orden + "I")
        anillos = []
        for _ in range(n_anillos):
            a, off = anillo(off, orden)
            anillos.append(a)
        return anillos, off

    if tipo == 3:                                   # POLYGON
        pol, _ = poligono(off, orden)
        return [pol]
    if tipo == 6:                                   # MULTIPOLYGON
        (n,), off = leer(off, orden + "I")
        pols = []
        for _ in range(n):
            sub_orden = "<" if wkb[off] == 1 else ">"
            (_t,), off = leer(off + 1, sub_orden + "I")
            pol, off = poligono(off, sub_orden)
            pols.append(pol)
        return pols
    raise ValueError(f"tipo de geometría no soportado: {tipo}")


# --------------------------------------------------- Douglas-Peucker ------
def _simplificar(pts, tol):
    """Douglas-Peucker iterativo. Conserva siempre el primer y último punto."""
    if len(pts) < 3:
        return pts
    guardar = [False] * len(pts)
    guardar[0] = guardar[-1] = True
    pila = [(0, len(pts) - 1)]
    tol2 = tol * tol

    while pila:
        i, j = pila.pop()
        if j <= i + 1:
            continue
        x0, y0 = pts[i]
        x1, y1 = pts[j]
        dx, dy = x1 - x0, y1 - y0
        norma = dx * dx + dy * dy
        peor, k = -1.0, i

        for m in range(i + 1, j):
            px, py = pts[m]
            if norma == 0:
                d2 = (px - x0) ** 2 + (py - y0) ** 2
            else:
                t = ((px - x0) * dx + (py - y0) * dy) / norma
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                d2 = (px - x0 - t * dx) ** 2 + (py - y0 - t * dy) ** 2
            if d2 > peor:
                peor, k = d2, m

        if peor > tol2:
            guardar[k] = True
            pila.append((i, k))
            pila.append((k, j))

    return [p for p, g in zip(pts, guardar) if g]


def _limpiar(anillo, tol):
    """Simplifica un anillo y lo cierra. None si degenera en menos de 4 puntos."""
    a = _simplificar(anillo, tol)
    if len(a) < 4:
        return None
    if a[0] != a[-1]:
        a.append(a[0])
    return [[round(x, DECIMALES), round(y, DECIMALES)] for x, y in a]


# ----------------------------------------------------------------- carga ---
def main():
    con = sqlite3.connect(f"file:{RUTA_GEO}?mode=ro", uri=True)
    filas = con.execute(
        'SELECT codmun, municipio, isla, Shape FROM "Municipios_canarias"'
    ).fetchall()
    con.close()

    ISLA_DE = {m: i for i, ms in ISLAS.items() for m in ms}
    COMARCA_DE = {m: c for c, ms in COMARCAS.items() for m in ms}
    equiv = {}
    for m in ISLA_DE:
        import unicodedata
        k = unicodedata.normalize("NFKD", m).encode("ascii", "ignore").decode().strip().lower()
        equiv[k] = m

    def nombre_excel(cod, nom_geo):
        import unicodedata
        if int(cod) in EXC_GEO:
            return EXC_GEO[int(cod)]
        k = unicodedata.normalize("NFKD", str(nom_geo)).encode("ascii", "ignore").decode().strip().lower()
        return equiv.get(k)

    rasgos, v_ini, v_fin = [], 0, 0
    for cod, nom_geo, isla_geo, blob in filas:
        nombre = nombre_excel(cod, nom_geo)
        if nombre is None:
            print(f"  ⚠ sin correspondencia: {nom_geo} ({cod})")
            continue

        pols = _wkb_multipolygon(_leer_gpkg_blob(blob))
        v_ini += sum(len(a) for p in pols for a in p)

        limpios = []
        for pol in pols:
            anillos = [_limpiar(a, TOLERANCIA) for a in pol]
            anillos = [a for a in anillos if a]
            if anillos:
                limpios.append(anillos)
        if not limpios:
            print(f"  ⚠ {nombre}: geometría vacía tras simplificar")
            continue
        v_fin += sum(len(a) for p in limpios for a in p)

        xs = [x for p in limpios for a in p for x, _ in a]
        ys = [y for p in limpios for a in p for _, y in a]

        rasgos.append({
            "type": "Feature",
            "properties": {
                "codmun": int(cod),
                "nombre": nombre,
                "isla": ISLA_DE[nombre],
                "comarca": COMARCA_DE[nombre],
                "bbox": [min(xs), min(ys), max(xs), max(ys)],
            },
            "geometry": {"type": "MultiPolygon", "coordinates": limpios},
        })

    fc = {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:4083"}},
        "features": sorted(rasgos, key=lambda f: f["properties"]["codmun"]),
    }

    (SALIDA / "geo").mkdir(parents=True, exist_ok=True)
    destino = SALIDA / "geo" / "municipios.json"
    with open(destino, "w", encoding="utf-8") as fh:
        json.dump(fc, fh, ensure_ascii=False, separators=(",", ":"))

    orig = RUTA_GEO.stat().st_size
    nuevo = destino.stat().st_size
    print(f"{len(rasgos)} municipios · vértices {v_ini:,} -> {v_fin:,} "
          f"({v_fin/v_ini*100:.1f} %)".replace(",", "."))
    print(f"GeoPackage {orig/1024/1024:.1f} MB -> GeoJSON {nuevo/1024:.0f} KB "
          f"(x{orig/nuevo:.0f} más ligero)")


if __name__ == "__main__":
    main()

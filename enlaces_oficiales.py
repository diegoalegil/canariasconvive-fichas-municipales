# Los enlaces de cada ficha a las consultas oficiales de su territorio en el
# INE y en el ISTAC («Consultar en el INE y el ISTAC», al pie de la ficha).
#
# INE · Censo anual de población, la operación cuyas cifras son las de la
# ficha. Lee las dos tablas provinciales del censo por secciones censales (Las
# Palmas y Santa Cruz de Tenerife), que traen en cada celda el código de su
# serie, y guarda la consulta de cada municipio: su serie y la de cada una de
# sus secciones, los cinco últimos años, en la página de series del INE. Se
# detiene si un municipio no está en su tabla, si su población no es la de su
# ficha o si sus secciones no la suman. El INE rechaza las direcciones de más
# de unos 2.000 caracteres: los municipios con muchas secciones (Las Palmas de
# Gran Canaria y Santa Cruz de Tenerife) se quedan sin consulta propia y la
# ficha enlaza la tabla de su provincia.
#
# INE · la población por continente de nacimiento de cada municipio y de cada
# provincia, en la misma operación (abajo, `CONTINENTES`).
#
# ISTAC · el identificador de cada territorio en su catálogo (MUN_…, ISLA_…,
# PROV_…, CCAA_CANARIAS), que no es el código INE: sale de la tabla de
# población por municipios del ISTAC y se comprueba uno a uno en su API (un
# identificador que no existe responde 404). Frontera tiene dos, el de antes y
# el de después de la segregación de El Pinar en 2007; vale el de ahora.
#
# Hay que volver a ejecutarlo cada vez que el INE publique un año nuevo del
# censo (en diciembre) o cambie el seccionado, y después de exportar_datos.py.
#
#  Uso:     python3 enlaces_oficiales.py
#  Salida:  web/datos/enlaces.json
import json
import re
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).parent
DATOS = RAIZ / "web" / "datos"
SALIDA = DATOS / "enlaces.json"
# Censo anual de población · Resultados de secciones censales por provincias ·
# Población por sexo y edad (grupos quinquenales); la vista por defecto es el
# total de los dos sexos y todas las edades del último año.
TABLAS_SECCIONES = {"35": 69237, "38": 69253}
AÑOS = 5   # los de la consulta por secciones: el censo anual empieza en 2021
CONSULTA = "https://www.ine.es/consul/serie.do?d=true&{series}&c=2&nult=" + str(AÑOS)
LARGO_MAXIMO = 2000
API_ISTAC = "https://datos.canarias.es/api/estadisticas"
# Censo anual de población · Resultados por municipios · Población por sexo y
# país de nacimiento (grandes grupos): la tabla, ya filtrada al municipio o a la
# provincia, se pide con los mismos campos que envía su formulario (rows,
# columns, un valor de cada variable y el periodo). Los valores del territorio
# son internos de la tabla y el INE no los publica en la página: van escritos
# aquí y cada enlace se comprueba abriéndolo (su fila tiene que traer el
# territorio y la población de la ficha). Si una edición nueva del censo los
# cambiara, la comprobación lo diría.
CONTINENTES = ("https://www.ine.es/jaxiT3/Datos.htm?t=68538&L=0&rows=143048&columns=143049&columns=143051&columns=p_per"
               "&cri143048={valor}&cri143049=7180074&cri143051=7180078&cri143051=7190435&cri143051=7190436&cri143051=7190437"
               "&cri143051=7190438&cri143051=7190439&cri143051=7190440&cri143051=7190441&cri143051=7190442&cri143051=7190443&periodo=28~{anio}")
VALOR_CONTINENTES = {
    "35": 7176884, "35001": 7171952, "35002": 7171982, "35003": 7172505, "35004": 7172662, "35005": 7172688,
    "35006": 7172695, "35007": 7173136, "35008": 7174674, "35009": 7174912, "35010": 7175185, "35011": 7175408,
    "35012": 7176180, "35013": 7176402, "35014": 7176688, "35015": 7176836, "35016": 7176883, "35017": 7177430,
    "35018": 7177900, "35019": 7177906, "35020": 7172192, "35021": 7178169, "35022": 7178232, "35023": 7178240,
    "35024": 7178660, "35025": 7178667, "35026": 7178670, "35027": 7178679, "35028": 7178696, "35029": 7178709,
    "35030": 7178993, "35031": 7179296, "35032": 7179272, "35033": 7179332, "35034": 7179962, "38": 7178204,
    "38001": 7171940, "38002": 7171985, "38003": 7172017, "38004": 7172522, "38005": 7172629, "38006": 7172651,
    "38007": 7172886, "38008": 7173278, "38009": 7173279, "38010": 7173310, "38011": 7173576, "38012": 7174640,
    "38013": 7174786, "38014": 7174792, "38015": 7174945, "38016": 7174946, "38017": 7175082, "38018": 7175134,
    "38019": 7175154, "38020": 7175166, "38021": 7175204, "38022": 7175380, "38023": 7177918, "38024": 7175694,
    "38025": 7176014, "38026": 7176780, "38027": 7176947, "38028": 7177426, "38029": 7177458, "38030": 7177459,
    "38031": 7177558, "38032": 7177758, "38033": 7177897, "38034": 7177946, "38035": 7177982, "38036": 7178031,
    "38037": 7178191, "38038": 7178205, "38039": 7178283, "38040": 7178299, "38041": 7178375, "38042": 7178478,
    "38043": 7178595, "38044": 7178626, "38045": 7178656, "38046": 7178659, "38047": 7178706, "38048": 7179302,
    "38049": 7179259, "38050": 7179263, "38051": 7179413, "38052": 7179443, "38053": 7179501, "38901": 7177125
}

FILA = re.compile(r'<th scope="row"[^>]*>(\d{5}|\d{10}) ([^<]+)</th>\s*<td[^>]*><!--\{[^}]*"s":"([A-Z]+\d+)"\} -->([\d.]+)</td>')


def leer(url, json_=False):
    peticion = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json" if json_ else "text/html"})
    with urllib.request.urlopen(peticion, timeout=120) as r:
        texto = r.read().decode("utf-8")
    return json.loads(texto) if json_ else texto


def plano(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


fichas = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (DATOS / "mun").glob("*.json")}
indice = json.loads((DATOS / "indice.json").read_text(encoding="utf-8"))

# ---------------------------------------------------------------- INE ------
# El último año del censo en el INE tiene que ser el de las fichas: si el INE ya
# hubiera publicado otro, los enlaces enseñarían cifras que la web aún no tiene.
ANIO = indice["anio"]
secciones, sin_consulta = {}, []
for prov, tabla in TABLAS_SECCIONES.items():
    leidos = {}
    html = leer(f"https://www.ine.es/jaxiT3/Datos.htm?t={tabla}")
    anio_ine = re.search(r'id="c_C0"[^>]*>(\d{4})<', html)
    if not anio_ine or int(anio_ine.group(1)) != ANIO:
        raise SystemExit(f"La tabla {tabla} del INE es de {anio_ine and anio_ine.group(1)} y las fichas de {ANIO}")
    for codigo, nombre, serie, valor in FILA.findall(html):
        personas = int(valor.replace(".", ""))
        if len(codigo) == 5:
            leidos[codigo] = {"poblacion": personas, "serie": serie, "secciones": []}
        elif codigo[:5] in leidos:
            leidos[codigo[:5]]["secciones"].append((serie, personas))
    for cod, f in sorted(fichas.items()):
        if not cod.startswith(prov):
            continue
        m = leidos.get(cod)
        if m is None:
            raise SystemExit(f"{f['nombre']} ({cod}) no está en la tabla {tabla} del INE")
        if m["poblacion"] != f["poblacion"]:
            raise SystemExit(f"{f['nombre']}: el INE da {m['poblacion']} y la ficha {f['poblacion']}; ¿otro año del censo?")
        if not m["secciones"] or sum(p for _, p in m["secciones"]) != m["poblacion"]:
            raise SystemExit(f"{f['nombre']}: sus {len(m['secciones'])} secciones no suman su población")
        url = CONSULTA.format(series="&".join(f"s={s}" for s in [m["serie"], *(s for s, _ in m["secciones"])]))
        secciones[cod] = {"secciones": len(m["secciones"]), "consulta": url if len(url) <= LARGO_MAXIMO else None}
        if len(url) > LARGO_MAXIMO:
            sin_consulta.append(f["nombre"])

# Lugar de nacimiento por continentes, de cada municipio y de cada provincia.
def fila_continentes(html, codigo):
    texto = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<!--.*?-->", "", html, flags=re.S)))
    m = re.search(rf"\b{codigo} [^0-9]+?((?:[\d.]+ ){{9}}[\d.]+)", texto)
    return [int(x.replace(".", "")) for x in m.group(1).split()] if m else None


continentes = {}
provincias_pob = {p["slug"]: p["poblacion"] for p in indice["provincias"]}
for codigo, poblacion in [*((c, f["poblacion"]) for c, f in fichas.items()),
                          ("35", provincias_pob["las-palmas"]), ("38", provincias_pob["santa-cruz-de-tenerife"])]:
    url = CONTINENTES.format(valor=VALOR_CONTINENTES[codigo], anio=ANIO)
    fila = fila_continentes(leer(url), codigo)
    if not fila or fila[0] != poblacion or sum(fila[1:]) != poblacion:
        raise SystemExit(f"{codigo}: la tabla de continentes del INE da {fila} y la población es {poblacion}")
    continentes[codigo] = url

# -------------------------------------------------------------- ISTAC ------
# La tabla de población por municipios (Cifras oficiales de población) lista
# Canarias, las islas y los municipios con su código y su identificador.
dimensiones = leer(f"{API_ISTAC}/statistical-resources/v1.0/datasets/ISTAC/E30245A_000002/~latest?fields=-data", True)["metadata"]["dimensions"]["dimension"]
territorios = next(d for d in dimensiones if d["id"] == "TERRITORIO")["dimensionValues"]["value"]
id_de = {v["id"]: v["variableElement"]["id"] for v in territorios}
nombre_de = {v["id"]: next(t["value"] for t in v["name"]["text"] if t["lang"] == "es") for v in territorios}

istac = {"municipios": {}, "islas": {}, "provincias": {}, "canarias": id_de.get("ES70")}
for cod, f in fichas.items():
    istac["municipios"][cod] = id_de.get(f"{cod}_2007", id_de.get(cod))   # Frontera: la de después de 2007
for isla in indice["islas_resumen"]:
    # Las islas van con su código ES70x; el nombre del ISTAC lleva «(Isla)» y el artículo detrás.
    cod = next((c for c, n in nombre_de.items() if c.startswith("ES70") and len(c) == 5
                and set(plano(isla["nombre"]).split()) <= set(re.findall(r"\w+", plano(n)))), None)
    istac["islas"][isla["slug"]] = id_de.get(cod)
for prov in indice["provincias"]:
    istac["provincias"][prov["slug"]] = {"las-palmas": "PROV_LAS_PALMAS", "santa-cruz-de-tenerife": "PROV_SANTA_CRUZ_TENERIFE"}[prov["slug"]]

todos = [istac["canarias"], *istac["municipios"].values(), *istac["islas"].values(), *istac["provincias"].values()]
if None in todos:
    raise SystemExit(f"Territorios sin identificador del ISTAC: {istac}")
for ident in todos:
    try:
        leer(f"{API_ISTAC}/structural-resources/v1.0/variables/VR_TERRITORIO/variableelements/{ident}", True)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"El ISTAC no reconoce el territorio {ident} ({e.code})")

SALIDA.write_text(json.dumps({"anio": ANIO, "desde": ANIO - AÑOS + 1,
                             "ine": {"tablas_secciones": TABLAS_SECCIONES, "municipios": secciones, "continentes": continentes}, "istac": istac},
                             ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"INE: {len(secciones)} municipios, {sum(c['secciones'] for c in secciones.values())} secciones censales y {len(continentes)} tablas de continentes; sin consulta propia "
      f"(enlazan la tabla de su provincia): {', '.join(sin_consulta) or 'ninguno'}. ISTAC: {len(todos)} territorios comprobados.")

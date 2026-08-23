# Fichas municipales · Canarias Convive — versión web

Prototipo de las 88 fichas demográficas municipales como página web interactiva,
para colgar en canariasconvive.com.

Parte del trabajo de **Pedro Delgado** (`FICHAS_MUNICIPALES.ipynb` + `BASE_DATOS_CANCON.xlsx`),
que sigue siendo la fuente de verdad de los datos y de la metodología. Aquí no se
recalcula ningún indicador: los índices se leen ya calculados desde el Excel.

## Cómo se levanta

```bash
python3 -m http.server 8140 --directory web
```

Y se abre `http://localhost:8140`. Se puede enlazar un municipio concreto con
`?municipio=38038` (código INE).

## Regenerar los datos

Requiere `pandas`, `numpy` y `openpyxl`. El notebook necesita además `geopandas`,
pero estos dos scripts no: la geometría se lee del GeoPackage con `sqlite3`.

```bash
python exportar_datos.py    # Excel  -> web/datos/mun/<codINE>.json  +  indice.json
python exportar_geo.py      # gpkg   -> web/datos/geo/municipios.json
```

Ambos leen de `~/Downloads/`. La ruta está en una constante al principio de cada script.

## Qué hay

```
exportar_datos.py    Excel -> 88 JSON (3,6 KB cada uno)
exportar_geo.py      GeoPackage -> GeoJSON simplificado (17,2 MB -> 252 KB)
territorios.py       islas, comarcas y excepciones de nombres, extraídas del notebook
web/index.html       estructura de la ficha
web/estilos.css      identidad visual
web/ficha.js         gráficos en SVG, sin librerías
web/datos/           salida de los dos scripts
```

## Decisiones

**Nada de servidor.** Ficheros estáticos: se suben tal cual y se embeben con un
`<iframe>` en una página de WordPress, igual que `/mapa-de-agentes/`.

**Sin librerías de gráficos.** Los SVG se generan a mano en `ficha.js`. Da control
total sobre el diseño, pesa nada y permite etiquetar todo para lectores de pantalla.

**Identidad propia.** Verde corporativo de canariasconvive.com en vez del azul del
ISTAC, retícula de tarjetas web en vez de una página A4, y un código de color
constante en toda la ficha:

| Color | Significa |
|---|---|
| Verde `#0D4E47` | el municipio / la población total |
| Verde claro `#A8C9C3` | Canarias, como referencia |
| Coral `#F55654` | todo lo relativo a población de origen extranjero |

**Mirada de convivencia.** Además de los 13 indicadores de la ficha PDF, se usan
otros que ya estaban en el Excel sin explotar y que son el tema del programa:
pirámide de población de origen extranjero (C24) y las variantes de dependencia
y reemplazo laboral calculadas solo sobre nacidos en España (C19, C16), más el
sex ratio (C21).

**Código INE como clave.** Los nombres de municipio canarios tienen tildes,
artículos y formas largas (*La Laguna* / *San Cristóbal de La Laguna*). Todo se
referencia por `codmun`.

## Cosas de los datos que hubo que resolver

- **C6M y C7M no comparten ventana temporal** (1999–2024 y 2002–2024). Emparejarlas
  por posición desplazaba el saldo migratorio tres años sin dar ningún error. Las
  series se alinean por año en `combinar()`.
- **Segregación de El Pinar de El Hierro (2007).** El ISTAC anotó el traspaso de
  vecinos desde Frontera como saldo migratorio: +1.880 en El Pinar (población
  2.040) y −1.757 en Frontera. No es migración, y deja la escala del gráfico
  inservible. Se aparta a `componentes.anomalias` y la ficha lo explica en una nota.
- **Frontera y El Pinar no existen antes de 2007**, así que la variación acumulada
  y la TVMA arrancan en 2008 y la etiqueta lo dice.

## Verificación

Los valores exportados se contrastaron uno a uno contra la ficha PDF de Santa Cruz
de Tenerife generada por el notebook: población, variación acumulada, TVMA, edad
media, reparto por sexo, los tres rankings con sus pesos, los cuatro índices en
los tres ámbitos y el reparto por lugar de nacimiento. **Coinciden los 19.**
Además, la suma de la población de los 88 municipios cuadra exactamente con el
total regional de la hoja C1R.

## Pendiente

- [ ] Enlazar el botón de PDF a las fichas de Pedro (ahora llama a `window.print()`).
- [ ] Decidir si hay selector de año o solo el último.
- [ ] Decidir alojamiento: GitHub Pages o subdominio propio en su Plesk.
- [ ] Repasar contraste y navegación por teclado antes de publicar (RD 1112/2018).
- [ ] Ojo: la web madre lleva `user-scalable=0`, que bloquea el zoom en móvil y lo
      hereda el iframe. Está en la auditoría como hallazgo M1.

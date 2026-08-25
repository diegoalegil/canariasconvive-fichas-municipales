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

**Paleta azul, la de Pedro.** La misma que documenta en el LEEME de su notebook.

**Dos criterios que vienen de la revisión con Pedro y que no se tocan:**

1. **Ningún color de alerta sobre personas.** En semiología gráfica el rojo
   significa alerta, y estos gráficos representan población. Un primer prototipo
   usaba coral para marcar la población de origen extranjero; se retiró.
2. **La ficha muestra datos y no los interpreta.** Se eliminó un bloque que
   comparaba los índices con y sin la población nacida fuera. Emitía un juicio
   de valor que el programa no quiere emitir, y además el dato era engañoso: el
   índice de reemplazo laboral compara la franja de 15-19 años con la de 60-64,
   y como se migra a partir de los 19, la población de origen extranjero está
   estructuralmente vacía en el numerador. No medía la aportación de la
   migración, medía la edad a la que se migra.

**Pirámide con tres vistas.** Población total con el perfil de Canarias
superpuesto, nacida en España, y de origen extranjero (hoja C24). Se pasa de una
a otra con una transición animada, y el eje es común a las tres para que las
siluetas se puedan comparar.

**Índices con la escala de Pedro.** Los tres ámbitos ordenados de izquierda a
derecha por valor, y el tono indica la posición. El ISTAC no lo tiene así.

**Mosaico para el lugar de nacimiento.** Cien casillas: de cada cien habitantes,
cuántos nacieron dónde. Sustituye a las barras apiladas, donde las etiquetas de
algunos municipios no cabían dentro.

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

## Accesibilidad

Comprobado en once anchos de 320 a 2560 px: sin desbordes horizontales, sin
texto por debajo de 7,5 px reales, y todo el texto pasa el contraste AA (4,5:1,
o 3:1 en texto grande) tanto sobre blanco como sobre los fondos de las tarjetas.
Objetivos táctiles de 44 px en cualquier aparato con puntero grueso. La
transición de la pirámide se desactiva con `prefers-reduced-motion` y también
cuando la pestaña está oculta, donde el navegador congela `requestAnimationFrame`.

## Pendiente

- [ ] Enlazar el botón de PDF a una ficha de una sola hoja (ahora imprime la página).
- [ ] Confirmar con Pedro cómo nombrar la vista "Nacida en España" de la pirámide:
      se obtiene restando la población de origen extranjero (C24) del total (C23).
- [ ] Proyecciones de pirámides hasta 2036, para integrarlas como una vista más.
- [ ] Decidir si hay selector de año o solo el último.
- [ ] Decidir alojamiento: GitHub Pages o subdominio propio en su Plesk.
- [ ] Ojo: la web madre lleva `user-scalable=0`, que bloquea el zoom en móvil y lo
      hereda el iframe. Está en la auditoría como hallazgo M1.

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

Y se abre `http://localhost:8140`. La raíz es la portada, con el buscador y
las listas por isla; la ficha vive en `ficha.html` y se puede enlazar un
municipio concreto con `ficha.html?municipio=38038` (código INE). Un enlace
antiguo del tipo `index.html?municipio=38038` redirige solo. La dirección
estable de cada municipio es `m/38038.html`: un envoltorio con las etiquetas
de vista previa del municipio que redirige a la ficha, y la que la ficha deja
en la barra del navegador al cargar y al cambiar de municipio, para que
copiarla de ahí sea lo mismo que «Copiar enlace». Por eso datos y enlaces se
resuelven contra la raíz de la web (`rutaWeb` en `comun.js`) y no contra la
dirección visible.

## Regenerar los datos

Requiere `pandas`, `numpy`, `openpyxl` y, para las tarjetas, `Pillow`
(`pip install -r requirements.txt`). El notebook necesita además `geopandas`,
pero estos scripts no: la geometría se lee del GeoPackage con `sqlite3`.

```bash
python3 exportar_datos.py    # Excel  -> web/datos/mun/<codINE>.json  +  indice.json
python3 exportar_geo.py      # gpkg   -> web/datos/geo/municipios.json
python3 generar_tarjetas.py  # tarjetas og/, envoltorios m/ y web/config.js
npm test                     # antes de publicar (ver Verificación)
```

Los dos primeros leen de `~/Downloads/`; la ruta está en una constante al
principio de cada script. **Los tres van juntos**: las tarjetas y los
envoltorios llevan la población y el año escritos, y si se regeneran los datos
sin regenerarlos se quedan viejos. `exportar_datos.py` guarda también, en
`indice.json`, la fuente de cada indicador —organismo, enlace, años cubiertos
y fecha de revisión— leída del índice `INDEX-F` del libro por `metadatos.py`.
La URL pública del sitio está en un solo sitio, `sitio.json`; de ahí salen las
canónicas y las etiquetas `og:` de las cinco páginas, los envoltorios de
`web/m/` y `web/config.js`, que la da al JS para el botón de compartir. Mudar
el sitio de alojamiento es cambiar ese fichero y volver a ejecutar
`generar_tarjetas.py`; `pruebas/invariantes.py` ensaya esa mudanza con una URL
ficticia y comprueba que no queda ninguna referencia al dominio anterior.

## Qué hay

```
exportar_datos.py    Excel -> 88 JSON (3,6 KB cada uno) + indice.json
exportar_geo.py      GeoPackage -> GeoJSON simplificado (17,2 MB -> 252 KB)
generar_tarjetas.py  las 89 tarjetas de vista previa, los envoltorios de web/m/ y web/config.js
metadatos.py         la fuente de cada indicador, leída del índice del Excel
territorios.py       islas, comarcas y excepciones de nombres, extraídas del notebook
sitio.json           la URL pública, en un solo sitio
pruebas/             la batería: invariantes de los datos, conciliación con el Excel e interacciones

web/index.html       portada: buscador y listas por isla de los 88 municipios
web/ficha.html       la ficha municipal
web/comparar.html    hasta tres municipios en paralelo
web/guia.html        qué mide cada indicador y qué no dice
web/dossier.html     las 88 fichas en un documento A4 de 98 hojas

web/config.js        la URL pública, generada desde sitio.json
web/comun.js         cifras, escapado, carga con error visible y el cruce con desenfoque
web/datos-ui.js      la fuente de cada gráfico y el desplegable «Datos y método»: fecha y tabla
web/ficha.js         los gráficos en SVG, sin librerías, en pantalla y en hoja
web/portada.js       buscador, listas por isla y entrada de la portada
web/comparar.js      el comparador
web/guia.js          la guía
web/dossier.js       compone el dossier reutilizando los gráficos de ficha.js
web/iconos.js        el set de iconos, en un solo sitio
web/estilos.css      sistema de tarjeta, identidad visual e impresión
web/dossier.css      solo el armazón del dossier
web/og/  web/m/      tarjetas de vista previa y sus envoltorios con etiquetas og:
web/datos/           salida de los scripts
```

## Las definiciones de los cuatro índices

Están en el Excel, como fórmulas matriciales sobre los grupos de edad de las
hojas `C8M` (0-14, 15-64, 65 y más) y `C13M` (15-19, 60-64); se leen con
`openpyxl` (`data_only=False`, `celda.value.text`). Las de la ficha son esas:

| Índice | Celda | Definición | Escala en la ficha |
|---|---|---|---|
| C10 Envejecimiento | `C10M!C27` | (65 y más) / (0-14) | razón |
| C11 Juventud | `C11M!C27` | (0-14) / (15-64) | el libro guarda la razón; la ficha la multiplica por cien |
| C17 Dependencia | `C17M!C27` | (0-14 y 65 y más) / (15-64) × 100 | por cien |
| C14 Reemplazo laboral | `C14M!C27` | (15-19) / (60-64) × 100 | por cien |

Los cuatro se leen ya calculados del libro; `pruebas/conciliar_excel.py`
comprueba los 88 municipios en los tres ámbitos contra él. El reemplazo
laboral cuadra con lo que dijo Pedro en la revisión: 15-19 frente a 60-64. De
ahí que no tenga sentido calcularlo por separado para la población de origen
extranjero.

**Ojo con juventud.** No es el porcentaje de menores de 15 sobre la población
—eso sería un 10,3 % en Santa Cruz— sino menores de 15 por cada cien personas de
15 a 64, que da 15,0. La ficha lo rotula con un `%` que puede inducir a esa
lectura; la guía lo advierte de forma expresa.

También se comprobó que "de origen extranjero" y el tramo "extranjero" del
lugar de nacimiento son el mismo dato: en los 88 municipios se diferencian como
mucho en una décima, y de media en 0,03 puntos.

La TVMA no viene del libro: se calcula con la serie de población y se guarda
**sin redondear**; solo se redondea al presentarla. Con dos decimales en el
JSON y uno en pantalla, siete municipios cambiaban de cifra (Puerto del
Rosario: 3,148… → 3,15 → «3,2 %», cuando es 3,1). La edad media es una
aproximación por marcas de clase (2,5; 7,5; …; 97,5 y 102 para 100 o más), y
la guía lo dice.

## Decisiones

**Nada de servidor.** Ficheros estáticos: se suben tal cual y se embeben con un
`<iframe>` en una página de WordPress, igual que `/mapa-de-agentes/`.

**Sin librerías de gráficos.** Los SVG se generan a mano en `ficha.js`. Da control
total sobre el diseño, pesa nada y permite etiquetar todo para lectores de pantalla.

**Paleta azul, la de Pedro.** La misma que documenta en el LEEME de su notebook.

**Sistema de tarjeta con dos rótulos.** Todas las tarjetas llevan un filete azul
de 3 px arriba y el título a la izquierda, que es donde empieza la lectura. Solo
una por pantalla —la pirámide, que es la destacada— lleva cabecera azul plena; si
la llevaran todas, la página sería una escalera de bloques azules. Se retiró la
cápsula centrada de borde fino: competía con el título de la sección y dejaba la
tarjeta sin anclaje. Espaciados de base 4, cuatro radios y dos sombras, siempre
tintadas en azul y nunca en negro puro.

**Iconografía propia.** Diez iconos sobre retícula de 24, trazo 1,5 uniforme y
monocromo, en `iconos.js`. Ninguno usa banderas ni siluetas humanas: al hablar de
personas, un signo geométrico no arrastra los sesgos que arrastra un retrato. El
color lo pone el contenedor con `currentColor`, así que sobre la cabecera azul se
vuelven blancos sin duplicar el marcado.

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

**Pirámide con dos pestañas.** «Municipio y Canarias»: el municipio en barras
azules y Canarias en barras negras huecas, cada uno sobre su población total.
«Por lugar de nacimiento»: nacidos en España en azul y nacidos en el
extranjero (hoja C24) en negro hueco, cada población sobre su propio total, que
es como lo calcula Pedro. Los rótulos dicen *nacidos en* y no *españoles /
extranjeros*: la fuente (ISTAC, E30243A_000004) mide dónde nació cada persona,
no su nacionalidad, y una persona nacida fuera puede ser española. El eje es fijo e igual en las 88 fichas, pero uno por pestaña —7 %
y 14 %— porque sobre base propia los extranjeros de un municipio pequeño se
concentran mucho (Artenara, 65 personas, 13,85 % en un grupo) y un eje que corta
una barra miente. `exportar_datos.py` comprueba las dos holguras. Al señalar un
grupo de edad, la lectura da los porcentajes y los recuentos de cada población.

**Índices con la escala de Pedro.** Los tres ámbitos ordenados de izquierda a
derecha por valor, y el tono indica la posición. El ISTAC no lo tiene así.

**Anillo para el lugar de nacimiento.** Municipio y Canarias, uno al lado del
otro, con el reparto escrito debajo. Sustituye a las barras apiladas, donde las
etiquetas de algunos municipios no cabían dentro.

**La fuente bajo cada gráfico.** Una línea «Fuente: …» al pie de cada
gráfico, en pantalla, en la hoja y en el dossier, con la redacción que fijó
Pedro para cada uno (`FUENTES_GRAFICOS` en `web/datos-ui.js`): operación
estadística del ISTAC y años que cubre, GRAFCAN en los mapas, y «Elaboración
propia» donde hay cálculo. La pirámide cambia de fuente con la pestaña, porque
cada una dibuja una tabla distinta. Los años son los de la operación de
origen (la serie de cifras oficiales arranca en 1996 aunque un municipio
empiece más tarde), así que no se calculan con los datos: se revisan a mano
con cada actualización, y `pruebas/invariantes.py` avisa si el año de
referencia del índice deja de aparecer en ellas. Las cifras clave no llevan
línea de fuente: no son un gráfico. Debajo, plegado, «Datos y método»
(«Método de cálculo» en cifras y mapas): fecha o periodo del dato, cómo se
calcula, enlace al recurso estadístico y la tabla completa con los valores
que el gráfico dibuja, para quien no pueda leer el gráfico o quiera el
número exacto. Describe el dato, no lo interpreta, y va plegado para que la
tarjeta cerrada siga siendo el gráfico y su fuente. En papel el desplegable
no se imprime, y el camino a la guía va en la esquina de la cabecera.

En la hoja A4 cada fila de la retícula crece la línea de fuente (2,3 mm); se
compensa con menos relleno en el pie y el rótulo de las tarjetas. Medido: la
ficha más alta pasa de 276,0 a 276,4 mm de los 281 disponibles, y las 88
miden lo mismo porque en El Pinar y Frontera el gráfico de componentes cede a
su nota de 2007 los 3 mm que las hacían más altas. En el dossier la pirámide
cede milímetro y medio (de 13 a 11,5 mm más alta que en la ficha suelta) y la
cabecera y el pie otros dos: la hoja más alta mide 293,7 mm de 297.

**La última selección manda.** Cambiar dos veces de municipio con la primera
respuesta llegando tarde dejaba el selector en uno y la ficha en otro. Cada
carga aborta la anterior y, si aun así llegara, solo pinta la vigente. Si
falla, el selector vuelve al municipio que se ve y aparece un aviso con
reintento; el comparador reserva la plaza mientras carga, así que no pasa de
tres ni admite dos veces el mismo, y el color de cada municipio es suyo y no
del hueco que ocupa.

**Código INE como clave.** Los nombres de municipio canarios tienen tildes,
artículos y formas largas (*La Laguna* / *San Cristóbal de La Laguna*). Todo se
referencia por `codmun`.

**«Población a 1 de enero», no «padrón».** La cifra reciente sale de la
operación censal anual del ISTAC (E30243A, desde 2021), que el propio ISTAC
distingue de las cifras oficiales del padrón; las series largas combinan
fuentes. Los rótulos generales dicen la fecha del dato, y la operación
estadística queda identificada por el enlace de la nota de fuente de cada
indicador (el recurso del ISTAC, con su código en la dirección); la nota
misma solo describe el dato.

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

**El PDF se redibuja, no se encoge.** Al imprimir, `beforeprint` vuelve a generar
todos los SVG a la medida de la hoja, con márgenes de eje y cuerpos de letra
propios. Escalar por CSS un gráfico pensado para 640 px hasta 60 mm dejaba las
etiquetas del eje en tres puntos y unas encima de otras. En la hoja el reparto de
la retícula pasa de 8/4 a 7/5: los índices repiten el nombre del municipio tres
veces y a cuatro columnas se partía en tres líneas, que era lo que hacía que la
ficha no cupiera en una cara. «Imprimir en A3» es la misma ficha ampliada un
41 %, para quien la lectura de 5-6 pt le resulte pequeña; la A4 de una hoja
sigue siendo el formato habitual. En el diálogo hay que elegir A3 como papel
(el botón lo dice en su tooltip). Con `@page` fijado en A4, elegir A3 dejaba
la ficha a tamaño A4 centrada en la hoja grande (medido en el PDF: 17 pt de
título en las dos). El botón inyecta un `@page { size: A3 }` y un
`transform: scale(1.414)` —no `zoom`, que cambiaba la composición y partía la
hoja en dos— dentro de una condición sobre el papel elegido (250 × 380 mm o
más), que Chromium evalúa contra ese papel: con A3, ampliada; con A4 o carta,
la A4 de siempre. Un `@page` A3 sin condición hacía que Chromium encogiera la
página al 71 % si el usuario dejaba A4, peor que el botón normal; Safari no
atiende a `@page size` y también necesita elegir A3 a mano. La prueba mide el
texto dentro del PDF: con A3, mismo número de textos que la A4 y todos ×1,41
(título 17 → 24 pt); con A4 dejada, idéntica a la A4 normal. Lo que no se ha
medido es el diálogo real de cada navegador: conviene probarlo a mano en
Chrome y en Safari una vez (pulsar el botón, elegir A3, guardar PDF).
El papel lleva al pie las fuentes y la dirección de la guía, para que se pueda
llegar desde una hoja impresa a cada recurso estadístico. El botón no se
muestra por debajo de 966 px de ancho: en tableta añadía una fila a la barra
y en móvil, reducido a su icono, era un segundo icono de descarga.

## Verificación

La batería está en `pruebas/` y corre antes de cada publicación (la acción de
GitHub no despliega si falla):

```bash
python3 -m pip install -r requirements.txt   # una vez
npm ci && npx playwright install chromium     # una vez
npm test
```

- `pruebas/invariantes.py` (solo biblioteca estándar): 88 municipios, cada
  pirámide suma su población y las 88 suman Canarias, la TVMA es la de la
  serie sin redondeo intermedio, los repartos suman cien, los índices están en
  los tres ámbitos, cada indicador tiene fuente con enlace https, los 88
  envoltorios y las canónicas y `og:` de las cinco páginas llevan la URL de
  `sitio.json`, las cinco cargan la misma versión de recursos, ningún texto
  atribuye los datos al padrón, y una mudanza a una URL ficticia no deja
  rastro del dominio anterior.
- `pruebas/conciliar_excel.py`: 3.608 comparaciones contra el libro, celda a
  celda —población, series, componentes con sus anomalías, los siete índices
  en los tres ámbitos, puestos y pesos, las 42 barras de cada pirámide y el
  lugar de nacimiento—. Necesita el Excel en `~/Downloads`; si no está, se
  omite avisando. No corre en GitHub porque el libro no está en el repositorio.
- `pruebas/web.test.cjs` (Playwright, Chromium): la última selección manda,
  la dirección visible es `m/<código>.html` y desde ella se sigue cargando
  todo; el error se ve y se reintenta; la TVMA se redondea una vez; rótulos por
  lugar de nacimiento; la fuente de cada gráfico con la redacción de Pedro,
  que en la pirámide sigue a la pestaña; «Datos y método» con sus 42 filas;
  teclado de la
  pirámide y de la evolución tras redibujar e imprimir; la presentación es
  modal, Mayús+Tab recién abierta va a Salir y el foco vuelve al botón; el
  cruce no deja fantasmas; el comparador con tres plazas, sin duplicados,
  colores fijos, tabla semántica y sin texto en azul claro, con 1, 2 y 3
  municipios a 1280 y 375 px; el fallo de carga inicial visible; las siete
  islas abiertas dentro de la pantalla a 320, 375 y 1280, e Inicio/Fin desde el
  disparador; el foco del buscador; la guía; las 88 fichas en una A4; la A3 con
  los mismos textos que la A4 y todos ×1,41 medidos en el PDF; el dossier de
  98 páginas con su barra visible, sin hojas desbordadas y con la guía que
  calcula el último año de los componentes.

En GitHub corre en Chromium. En local, `MOTOR=webkit npm run test:web` corre
los mismos casos en el motor de Safari, salvo el de papel (`page.pdf` solo
existe en Chromium); los detalles de Safari que se cubren así: el clic de
ratón no da el foco a un botón, y sin él la presentación no devolvía el foco
ni las listas de isla recibían las teclas. Lo que la batería no cubre: los
diálogos de impresión reales, un móvil físico, el `<iframe>` de WordPress
(probado a mano desde otro origen: la ficha pinta y cambia su dirección sin
error) y los rastreadores de vista previa. Después de publicar conviene pasar
`m/38038.html` por el depurador de compartir de Facebook o pegarlo en un chat
de WhatsApp y comprobar que la tarjeta es la del municipio.

## Accesibilidad

Comprobado en 320, 375, 414, 700, 701, 941, 1180, 1440 y 2560 px: sin desbordes
horizontales, también con los desplegables abiertos; sin texto por debajo de
7,5 px reales; todo el texto pasa el contraste AA (4,5:1, o 3:1 en texto
grande): el nombre del municipio en el comparador iba en el azul claro de su
serie (2,1:1) y ahora va en negro con una marca de color debajo. Objetivos
táctiles de 44 px con puntero grueso. Pirámide y evolución se recorren con
teclado (flechas, Inicio, Fin) y cada tarjeta ofrece su tabla; las cifras del
comparador son una tabla con encabezados de fila y columna. La presentación
es un diálogo modal: el resto queda inerte, el tabulador no sale y al cerrar
el foco vuelve al botón. El buscador de la portada enseña el foco en su caja.
Las transiciones se desactivan con `prefers-reduced-motion` y con la pestaña
oculta, donde el navegador congela `requestAnimationFrame`.

## Pendiente

- [ ] Que Pedro dé por buenos los rótulos «Nacidos en España» y «Nacidos en el
      extranjero» de la pestaña por lugar de nacimiento (él había dicho
      «españoles / extranjeros»; la fuente mide nacimiento, no nacionalidad).
- [ ] Proyecciones de pirámides hasta 2036, para integrarlas como una vista más.
- [ ] Decidir si hay selector de año o solo el último.
- [ ] Decidir alojamiento: GitHub Pages o subdominio propio en su Plesk. Al
      mudarlo, cambiar `sitio.json` y ejecutar `generar_tarjetas.py`. El
      `<iframe>` de WordPress necesita `allow="fullscreen; clipboard-write"`
      y `allowfullscreen` para el modo presentación y el botón de copiar.
- [ ] Probar a mano «Imprimir en A3» en el diálogo de Chrome y de Safari
      (elegir A3, guardar PDF) y, tras publicar, la vista previa de un enlace
      `m/<código>.html` en WhatsApp.
- [ ] Ojo: la web madre lleva `user-scalable=0`, que bloquea el zoom en móvil y lo
      hereda el iframe. Está en la auditoría como hallazgo M1.

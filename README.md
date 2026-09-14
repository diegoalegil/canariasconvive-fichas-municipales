# Fichas municipales · Canarias Convive — versión web

Las 88 fichas demográficas municipales de Canarias como página web
interactiva, para colgar en canariasconvive.com. Los datos y la metodología
son los del trabajo de **Pedro Delgado** (`FICHAS_MUNICIPALES.ipynb` y
`BASE_DATOS_CANCON.xlsx`), que sigue siendo la fuente de verdad: los cuatro
índices se leen ya calculados del Excel; la variación media anual, la edad
media y los puestos se calculan en el exportador.

## Cómo se levanta

```bash
python3 -m http.server 8140 --directory web
```

Y se abre `http://localhost:8140`. La raíz es la portada, con el buscador y
las listas por isla; la ficha vive en `ficha.html` y admite un municipio por
código INE, `ficha.html?municipio=38038` (un enlace antiguo del tipo
`index.html?municipio=38038` redirige solo). La dirección estable de cada
municipio es `m/38038.html`: un envoltorio con las etiquetas de vista previa
que redirige a la ficha, y la que la ficha deja en la barra del navegador al
cargar y al cambiar de municipio, de modo que copiarla de ahí es lo mismo que
«Copiar enlace». Por eso datos y enlaces se resuelven contra la raíz de la web
(`rutaWeb`, en `comun.js`) y no contra la dirección visible.

## Regenerar los datos

Hacen falta `pandas`, `numpy`, `openpyxl` y, para las tarjetas, `Pillow`
(`pip install -r requirements.txt`). El notebook necesita además `geopandas`;
estos scripts no: la geometría se lee del GeoPackage con `sqlite3`.

```bash
python3 exportar_datos.py    # Excel      -> web/datos/mun/<codINE>.json + indice.json
python3 exportar_geo.py      # GeoPackage -> web/datos/geo/municipios.json
python3 generar_tarjetas.py  # tarjetas og/, envoltorios m/ y web/config.js
npm test                     # antes de publicar (ver Verificación)
```

Los dos primeros leen de `~/Downloads/`; la ruta está en una constante al
principio de cada script. **Los tres van juntos**: las tarjetas, los
envoltorios y la descripción de la portada llevan escritos la población y el
año, y si se regeneran los datos sin regenerarlos se quedan viejos
(`pruebas/invariantes.py` lo detecta). `exportar_datos.py` escribe además en
`indice.json` la fuente de cada indicador —organismo, enlace y años
cubiertos—, que `metadatos.py` lee de la hoja `INDEX-F` del libro, el orden de
las islas, de oeste a este, que heredan la portada, los selectores y el
dossier, y el último dato regional de origen extranjero, que usa la portada.
Se detiene, en vez de avisar y seguir, si un municipio del Excel no encaja
con el GeoPackage (saldría sin código INE) o si un valor de los componentes
del cambio supera el umbral de anomalía en un municipio o año que no esté en
`ANOMALIAS_CONOCIDAS`: un dato así hay que mirarlo, no etiquetarlo a ciegas.

La URL pública está en un solo sitio, `sitio.json`: de ahí salen las canónicas
y las etiquetas `og:` de las cinco páginas, los envoltorios de `web/m/` y
`web/config.js`, que se la da al JavaScript para el botón de compartir y el
pie del papel. Mudar el sitio de alojamiento es cambiar ese fichero y volver a
ejecutar `generar_tarjetas.py`; `pruebas/invariantes.py` ensaya esa mudanza
con una URL ficticia y comprueba que no queda ninguna referencia al dominio
anterior.

## Qué hay

```
exportar_datos.py    Excel -> 88 JSON (unos 4 KB cada uno) + indice.json
exportar_geo.py      GeoPackage -> GeoJSON simplificado (17,2 MB -> 252 KB)
generar_tarjetas.py  las 89 tarjetas de vista previa, los envoltorios de web/m/ y web/config.js
metadatos.py         la fuente de cada indicador, leída del índice del Excel
territorios.py       islas, comarcas y excepciones de nombres, extraídas del notebook
sitio.json           la URL pública, en un solo sitio
requirements.txt     dependencias de Python; package.json, las de las pruebas (Playwright)
pruebas/             la batería: invariantes de los datos, conciliación con el Excel e interacciones
.github/workflows/   la acción que pasa la batería y publica web/ en GitHub Pages

web/index.html       portada: buscador y listas por isla de los 88 municipios
web/ficha.html       la ficha municipal
web/comparar.html    hasta tres municipios en paralelo
web/guia.html        qué mide cada indicador y con qué cuenta se obtiene
web/dossier.html     las 88 fichas en un documento A4 de 98 hojas

web/config.js        la URL pública, generada desde sitio.json
web/comun.js         cifras, escapado, carga con error visible y el cruce con desenfoque
web/datos-ui.js      la fuente de cada gráfico, y el desplegable de fuente y fecha de la guía
web/ficha.js         los gráficos en SVG, sin librerías, en pantalla y en hoja
web/portada.js       buscador, listas por isla y entrada de la portada
web/comparar.js      el comparador
web/guia.js          la guía
web/dossier.js       compone el dossier reutilizando los gráficos de ficha.js
web/iconos.js        los quince iconos, en un solo sitio
web/estilos.css      sistema de tarjeta, identidad visual e impresión
web/dossier.css      solo el armazón del dossier
web/404.html         la página de error de GitHub Pages, con el camino a la portada
web/fonts/           Montserrat (licencia SIL OFL), alojada en la web
web/img/             los logotipos y el icono de la pestaña
web/og/  web/m/      tarjetas de vista previa y sus envoltorios con etiquetas og:
web/datos/           salida de los scripts
```

## Los datos

**Los cuatro índices** están en el Excel como fórmulas matriciales sobre los
grupos de edad de las hojas `C8M` (0-14, 15-64, 65 y más) y `C13M` (15-19,
60-64), y se leen ya calculados:

| Índice | Celda | Definición | Escala en la ficha |
|---|---|---|---|
| C10 Envejecimiento | `C10M!C27` | (65 y más) / (0-14) | razón |
| C11 Juventud | `C11M!C27` | (0-14) / (15-64) | el libro guarda la razón; la ficha la multiplica por cien |
| C17 Dependencia | `C17M!C27` | (0-14 y 65 y más) / (15-64) × 100 | por cien |
| C14 Reemplazo laboral | `C14M!C27` | (15-19) / (60-64) × 100 | por cien |

`pruebas/conciliar_excel.py` los comprueba en los 88 municipios y los tres
ámbitos contra el libro.

**Ojo con juventud.** No es el porcentaje de menores de 15 sobre la población
—eso sería un 10,3 % en Santa Cruz— sino menores de 15 por cada cien personas
de 15 a 64, que da 15,0. La ficha lo rotula con un `%` que puede inducir a esa
lectura; la guía lo advierte de forma expresa.

**Redondeo una sola vez.** La TVMA no viene del libro: se calcula con la serie
de población y se guarda sin redondear, igual que la serie de origen
extranjero; las dos se redondean solo al mostrarse. Con un redondeo
intermedio a dos decimales, Puerto del Rosario (3,148…) salía «3,2 %» en vez
de 3,1, y Las Palmas «16,6 %» en la serie junto al 16,5 del lugar de
nacimiento. `invariantes.py` y `conciliar_excel.py` comprueban el valor y lo
que se lee en pantalla. La edad media es una aproximación por marcas de clase
(2,5; 7,5; …; 97,5 y 102 para 100 o más), y la guía lo dice.

**«Origen extranjero» y el tramo «extranjero» del lugar de nacimiento son el
mismo dato**: en los 88 municipios difieren como mucho en 0,05 puntos y de
media en 0,03.

**Particularidades que resuelve el exportador:**

- `C6M` y `C7M` no comparten ventana temporal (1999–2024 y 2002–2024).
  `combinar()` alinea las series por año, no por posición: emparejarlas por
  índice desplazaría el saldo migratorio tres años sin dar ningún error.
- En 2007 El Pinar se segregó de Frontera y el ISTAC anotó el traspaso de
  vecinos como saldo migratorio: +1.880 en El Pinar (población 2.040) y −1.757
  en Frontera. No es migración y deja la escala del gráfico inservible: se
  aparta a `componentes.anomalias` y la ficha lo explica en una nota.
- Frontera y El Pinar no existen antes de 2007: su variación acumulada y su
  TVMA arrancan en 2008, y la etiqueta lo dice.

## Decisiones

**Nada de servidor.** Ficheros estáticos: se suben tal cual y se embeben con un
`<iframe>` en una página de WordPress, igual que `/mapa-de-agentes/`.

**Nada de terceros.** La tipografía (Montserrat, un solo fichero variable de
35 KB) va en `web/fonts/`: ningún visitante conecta con Google ni con nadie
más al abrir la web, que es lo que exige el RGPD a una administración
pública, y de paso la hoja de estilos externa deja de bloquear el primer
pintado. `pruebas/invariantes.py` y la batería fallan si alguna página
vuelve a pedir un recurso fuera de la web.

**Sin librerías de gráficos.** Los SVG se generan a mano en `ficha.js`. Da
control total sobre el diseño, no pesa y permite etiquetar todo para lectores
de pantalla.

**Paleta azul, la de Pedro**, la misma que documenta en el LEEME de su
notebook. **Dos criterios suyos que no se tocan:**

1. **Ningún color de alerta sobre personas.** En semiología gráfica el rojo
   significa alerta, y estos gráficos representan población.
2. **La ficha muestra datos y no los interpreta.** No compara los índices con
   y sin la población nacida fuera ni orienta la lectura de ningún gráfico.
   Esa comparación, además, engañaría: el reemplazo laboral compara la franja
   de 15-19 años con la de 60-64 y, como se migra a partir de los 19, la
   población de origen extranjero está estructuralmente vacía en el
   numerador; no mediría la aportación de la migración, sino la edad a la que
   se migra.

**Sistema de tarjeta con dos rótulos.** Todas las tarjetas llevan un filete
azul de 3 px arriba y el título a la izquierda, que es donde empieza la
lectura. Solo una por pantalla —la pirámide, la destacada— lleva cabecera azul
plena; si la llevaran todas, la página sería una escalera de bloques azules.
Espaciados de base 4, cuatro radios y dos sombras, siempre tintadas en azul y
nunca en negro puro.

**Iconografía propia.** Quince iconos sobre retícula de 24, trazo 1,5 uniforme
y monocromo, en `iconos.js`. Ninguno usa banderas ni siluetas humanas: al
hablar de personas, un signo geométrico no arrastra los sesgos que arrastra un
retrato. El color lo pone el contenedor con `currentColor`, así que sobre la
cabecera azul se vuelven blancos sin duplicar el marcado.

**Pirámide con dos pestañas.** «Municipio y Canarias»: el municipio en barras
azules y Canarias en marcos negros huecos, cada uno sobre su población total.
«Por lugar de nacimiento»: nacidos en España en azul y nacidos en el
extranjero (hoja `C24`) en negro hueco, cada población sobre su propio total,
que es como lo calcula Pedro; la leyenda dice «Hombres españoles · Mujeres
españolas · Extranjeros», con sus palabras, y la línea de fuente de la pestaña
precisa que el ISTAC mide dónde nació cada persona, no su nacionalidad. Las
barras ocupan 0,8 de la fila, como en su cuaderno. El eje lo decide cada
pestaña de cada municipio en la escalera de los pares: el menor de 6, 8, 10,
12… que cubre todas sus barras (`ejeAutomatico`, en `web/comun.js`), que es
su regla: «al 6 u 8 por cien dependiendo del valor; si hay excepciones, que se
ajuste automáticamente». Sale 6 en 86 municipios y 8 en Artenara y Tejeda en
la primera pestaña; en la segunda, 6 en 49, 8 en 34, 10 en tres, 12 en Agulo
y 14 en Artenara: sobre base propia los extranjeros de un municipio pequeño se
concentran mucho, y un eje que corta una barra miente. `exportar_datos.py`
escribe el reparto en cada exportación y se detiene si algún municipio
necesitara más de 14. Los rótulos van de dos en dos, como en el cuaderno,
salvo en el móvil con eje de 10 o más, donde van de cuatro en cuatro; el tope
siempre rotulado. En reposo no hay ninguna cifra ni línea horizontal. Al
señalar un grupo de edad —con el ratón, el dedo o las flechas— sus
porcentajes aparecen dentro del dibujo junto a la punta de las barras (azul
para la barra, negro para el marco), con dos decimales y «< 0,01 %» cuando hay
personas pero el redondeo daría cero, y una región viva invisible los dice en
palabras. Un clic o un toque fija el grupo: la franja fijada sobrevive al
cambio de pestaña, al redibujado por cambio de ancho y a la impresión (en la
hoja no se imprime), y otro clic la suelta.

**Índices con la escala de Pedro.** Los tres ámbitos ordenados de izquierda a
derecha por valor, y el tono indica la posición; dos ámbitos con el mismo
valor (pasa en doce municipios) llevan el mismo tono. Señalar un ámbito lo
resalta en los cuatro índices.

**Origen extranjero.** Barras del municipio, la última destacada con su cifra,
y la línea de Canarias como referencia, con su último valor en la leyenda. El
eje va de 5 en 5, como pidió Pedro, con el tope en el múltiplo justo por
encima del máximo; por encima del 40 % (doce municipios) se rotulan los
múltiplos de 10 y el tope, sin el múltiplo anterior si queda pegado. La cifra
del último año se coloca por encima de la línea de Canarias cuando esta pasa
por ahí. Para el lector de pantalla, una tabla oculta lleva la serie entera;
la de componentes del cambio, igual.

**Componentes del cambio.** Crecimiento vegetativo y saldo migratorio desde
2002, que es donde arranca la serie del saldo; el eje temporal va cada dos
años, también en papel, y cada cuatro en pantallas estrechas.

**El municipio en su entorno.** Tres mapas —Canarias, la isla y la comarca—
con el puesto por población y el peso en cada ámbito. El tercero dice «en la
comarca», como en la ficha de Pedro; en El Hierro, donde la comarca es la
isla, hay dos mapas y las migas no la repiten.

**Anillo para el lugar de nacimiento.** Municipio y Canarias, uno al lado del
otro, con el reparto escrito debajo.

**La fuente bajo cada gráfico.** Una línea «Fuente: …» al pie de cada gráfico,
en pantalla, en la hoja y en el dossier, con la redacción que fijó Pedro para
cada uno (`FUENTES_GRAFICOS`, en `web/datos-ui.js`): operación estadística
del ISTAC y años que cubre, GRAFCAN en los mapas y «Elaboración propia» donde
hay cálculo. La pirámide cambia de fuente con la pestaña, porque cada una
dibuja una tabla distinta. Los años son los de la operación de origen (la
serie de cifras oficiales arranca en 1996 aunque un municipio empiece más
tarde), así que no se calculan con los datos: se revisan a mano con cada
actualización, y `pruebas/invariantes.py` avisa si el año de referencia deja
de aparecer en ellas. Las cifras clave no llevan línea de fuente: no son un
gráfico. Nada más al pie de la tarjeta; el método y los enlaces a cada recurso
están en la guía, y en papel el camino a la guía va en la esquina de la
cabecera.

**Un solo orden de islas**, de oeste a este, que fija `exportar_datos.py` en
`indice.json` y heredan la portada, los selectores de la ficha y del
comparador, y el dossier; dentro de cada isla, los municipios por orden
alfabético.

**La última selección manda.** Cada carga de municipio aborta la anterior y,
si aun así llegara, solo pinta la vigente. Si falla, el selector vuelve al
municipio que se ve y aparece un aviso con reintento. El comparador reserva la
plaza mientras carga, así que no pasa de tres ni admite dos veces el mismo, y
el color de cada municipio es suyo y no del hueco que ocupa.

**Código INE como clave.** Los nombres de municipio tienen tildes, artículos y
formas largas (*La Laguna* / *San Cristóbal de La Laguna*). Todo se referencia
por `codmun`.

**«Población a 1 de enero», no «padrón».** La cifra reciente sale de la
operación censal anual del ISTAC (E30243A, desde 2021), que el propio ISTAC
distingue de las cifras oficiales del padrón; las series largas combinan
fuentes. Los rótulos dicen la fecha del dato, y la operación estadística queda
identificada por el enlace de la nota de fuente de cada indicador.
`invariantes.py` falla si algún texto atribuye los datos al padrón.

## Papel

**El PDF se redibuja, no se encoge.** Al imprimir, `beforeprint` vuelve a
generar todos los SVG a la medida de la hoja, con márgenes de eje y cuerpos de
letra propios: escalar por CSS un gráfico pensado para 640 px hasta 60 mm deja
las etiquetas del eje en tres puntos y unas encima de otras. En la hoja el
reparto de la retícula pasa de 8/4 a 7/5, porque los índices a cuatro columnas
se partían en tres líneas y la ficha no cabía en una cara. La hoja es una A4 y
nada más, con la fuente de cada gráfico al pie de su tarjeta y, en la esquina
de la cabecera, la dirección de la guía, para llegar desde el papel a cada
recurso estadístico. Medido en la versión publicada: las 88 fichas miden
269,4 mm de los 281 disponibles (miden lo mismo porque en El Pinar y Frontera
el gráfico de componentes cede a su nota de 2007 los 3 mm que las harían más
altas), y la hoja más alta del dossier, 292,4 de 297.

El dossier (`dossier.html`) compone las 98 hojas —portada, guía de uso,
índice, un separador por isla y una hoja por municipio— con las reglas de
impresión de `estilos.css`, que copia en caliente, y los mismos gráficos que
la ficha, con la dirección de la guía en la cabecera de cada hoja. Las 88
fichas se piden a la vez y lo que falle se vuelve a pedir hasta dos veces
antes de dar el error.

## Verificación

La batería está en `pruebas/` y corre antes de cada publicación (la acción de
GitHub no despliega si falla):

```bash
python3 -m pip install -r requirements.txt   # una vez
npm ci && npx playwright install chromium     # una vez
npm test
```

- `pruebas/invariantes.py` (solo biblioteca estándar): 88 municipios con
  código INE entero y su geometría; cada pirámide suma su población y las 88
  suman Canarias; la edad media es la de la propia pirámide; la TVMA es la de
  la serie sin redondeo intermedio; el último dato de origen extranjero se
  muestra igual que el del lugar de nacimiento y el regional es el de
  `indice.json`; los repartos suman cien; los cuatro índices están en los
  tres ámbitos; cada indicador tiene fuente con enlace https y cada fuente de
  gráfico lleva el año de referencia; las islas van de oeste a este; los 88
  envoltorios llevan la población y el año de `indice.json`, su tarjeta `og` y
  la URL de `sitio.json` (igual que las canónicas y `og:` de las cinco
  páginas, y la descripción de la portada, que lleva el año y el arranque de
  la serie); las cinco cargan la misma versión de recursos y ningún recurso de
  terceros; ningún texto atribuye los datos al padrón; y una mudanza a una URL
  ficticia no deja rastro del dominio anterior.
- `pruebas/conciliar_excel.py`: 2.992 comparaciones contra el libro, celda a
  celda —población, series, origen extranjero con el decimal que se muestra,
  componentes con sus anomalías, los cuatro índices en los tres ámbitos,
  puestos y pesos, las 42 barras de cada pirámide y el lugar de nacimiento—.
  Necesita el Excel en `~/Downloads` (o en la ruta que se le pase) y
  `openpyxl`; si falta cualquiera de los dos, se omite avisando. No corre en
  GitHub porque el libro no está en el repositorio.
- `pruebas/web.test.cjs` (Playwright, doce casos): la última selección manda,
  la dirección visible es `m/<código>.html` y desde ella se sigue cargando
  todo, el error se ve y se reintenta, la tipografía carga de la propia web y
  ninguna página pide nada fuera; los rótulos y la fuente de cada gráfico, el
  eje de la pirámide por pestaña y municipio, la lectura con teclado tras
  redibujar e imprimir, la franja fijada y «< 0,01 %», el eje de origen
  extranjero con el tope rotulado y la cifra final libre de la línea de
  Canarias, las tablas ocultas, el mismo tono para el mismo valor, el ordinal
  con punto, las anclas por debajo de la barra, El Hierro con dos mapas; los
  rótulos de evolución, componentes y origen extranjero sin pisarse a 320, 375
  y 414 px; la presentación modal, que atrapa y devuelve el foco y deja el
  fondo oculto al lector de pantalla; el cruce sin fantasmas; el comparador
  con tres plazas, sin duplicados, colores fijos, tabla semántica y sin texto
  en azul claro, sin desbordes a 1280 y 375 px, con la tira de elegidos en el
  orden elegido y el foco a salvo al quitar con teclado; el fallo de carga
  inicial visible en el comparador y en la portada (buscador desactivado); la
  portada (las siete islas dentro de la pantalla a 320, 375 y 1280, cifras
  junto al título, desplegables del mismo alto, chips en una fila, el
  buscador como combobox con `aria-activedescendant`, Escape, Inicio/Fin y el
  foco); el dossier que reintenta una petición fallida y se desplaza con
  teclado en pantallas estrechas; la guía (fuentes, exponente y anclas); y el
  papel: las 88 fichas en una A4 y el dossier de 98 páginas con su barra, la
  dirección de la guía en cada hoja y sin hojas desbordadas.

En GitHub corre en Chromium. En local, `MOTOR=webkit npm run test:web` pasa
los mismos casos en el motor de Safari, salvo el de papel (`page.pdf` solo
existe en Chromium); cubre, entre otras cosas, que Safari no da el foco a un
botón al pulsarlo con el ratón, y sin él la presentación no devolvería el foco
ni las listas de isla recibirían las teclas. Lo que la batería no cubre: los
diálogos de impresión reales, un móvil físico, el `<iframe>` de WordPress
(probado a mano desde otro origen: la ficha pinta y cambia su dirección sin
error) y los rastreadores de vista previa. Después de publicar conviene pasar
`m/38038.html` por el depurador de compartir de Facebook o pegarlo en un chat
de WhatsApp y comprobar que la tarjeta es la del municipio.

## Accesibilidad

Comprobado en 320, 375, 414, 700, 701, 941, 1180, 1440 y 2560 px: sin
desbordes horizontales, también con los desplegables abiertos; sin texto por
debajo de 7,5 px reales; todo el texto pasa el contraste AA (4,5:1, o 3:1 en
texto grande): el nombre del municipio en el comparador va en negro con una
marca de color debajo, porque el azul claro de su serie da 2,1:1. Objetivos
táctiles de 44 px con puntero grueso. Pirámide y evolución se recorren con
teclado (flechas, Inicio, Fin, Escape); las cifras del grupo señalado, que en
pantalla van dentro del dibujo, las dice en palabras una región viva
invisible, que en la evolución solo cambia al cambiar de año; los gráficos de
origen extranjero y de componentes llevan una tabla oculta con su serie;
cada gráfico lleva su descripción y su fuente, y las cifras del comparador
son una tabla con encabezados de fila y columna. El buscador de la portada es
un combobox: el foco no sale del campo y la opción activa se señala con
`aria-activedescendant`. La presentación es un diálogo modal: el resto queda
inerte y oculto al lector de pantalla, el tabulador no sale y al cerrar el
foco vuelve al botón. Las anclas y el foco se colocan por debajo de la barra
pegajosa, cuya altura real se mide. El contorno de foco de los gráficos no
depende solo de `:focus-visible`. Los avisos de carga y de error son
regiones de estado en las cinco páginas. axe-core (WCAG 2.2 AA) no señala
ninguna violación en las cinco páginas a 320 y 1280 px, con desplegables,
presentación y comparador abiertos. Las transiciones se desactivan con
`prefers-reduced-motion` y con la pestaña oculta, donde el navegador congela
`requestAnimationFrame`.

Quedan abiertas, porque cambian el diseño o el alcance: las filas de la
pirámide como objetivo de puntero miden 15–20 px (WCAG 2.5.8 pide 24; el
teclado y el toque fijado ya la recorren); el resalte de los índices al
pasar el ratón no tiene equivalente por teclado (el dato se ve siempre); en
papel la fuente de cada gráfico va a 5,5 pt; en Safari anterior a 16, al
llegar al final de un desplegable de isla el dedo arrastra también la página
(`overscroll-behavior` no existe ahí); y la ficha espera a la geometría de
los mapas (258 KB) antes de pintar nada, con aviso si tarda.

## Pendiente

- [ ] Proyecciones de pirámides hasta 2036, para integrarlas como una vista más.
- [ ] Decidir si hay selector de año o solo el último.
- [ ] Decidir alojamiento: GitHub Pages o subdominio propio en su Plesk. Al
      mudarlo, cambiar `sitio.json` y ejecutar `generar_tarjetas.py`. El
      `<iframe>` de WordPress necesita `allow="fullscreen; clipboard-write"`
      y `allowfullscreen` para el modo presentación y el botón de copiar.
- [ ] Tras publicar, probar la vista previa de un enlace `m/<código>.html`
      en WhatsApp.
- [ ] La web madre lleva `user-scalable=0`, que bloquea el zoom en móvil y lo
      hereda el iframe.
- [ ] GitHub Pages no admite cabeceras HTTP propias (CSP, Referrer-Policy…);
      una CSP por `<meta>` exigiría quitar los dos manejadores en línea.
      Fijar las acciones del workflow por commit (o Dependabot) si se quiere
      ese nivel de garantía.

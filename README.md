# Fichas municipales · Canarias Convive — versión web

Las 88 fichas demográficas municipales de Canarias, y una ficha por cada una
de las siete islas, como página web interactiva, para colgar en
canariasconvive.com. Los datos y la metodología son los del trabajo de
**Pedro Delgado** (`FICHAS_MUNICIPALES.ipynb` y `BASE_DATOS_CANCON.xlsx`),
que sigue siendo la fuente de verdad: los cuatro índices se leen ya
calculados del Excel; la variación media anual y los puestos se calculan en
el exportador.

## Cómo se levanta

```bash
python3 -m http.server 8140 --directory web
```

Y se abre `http://localhost:8140`. La raíz es la portada: el buscador y una
tarjeta por isla, que despliega primero la ficha de la isla entera y debajo
la de cada municipio. La ficha vive en `ficha.html` y admite un municipio por código INE,
`ficha.html?municipio=38038`, o una isla, `ficha.html?isla=tenerife` (un
enlace antiguo del tipo `index.html?municipio=38038` redirige solo). La
dirección estable de cada ficha es `m/38038.html` o `i/tenerife.html`: un
envoltorio con las etiquetas de vista previa que redirige a la ficha, y la
que la ficha deja en la barra del navegador al cargar y al cambiar de
territorio, de modo que copiarla de ahí es lo mismo que «Copiar enlace». Por
eso datos y enlaces se resuelven contra la raíz de la web (`rutaWeb`, en
`comun.js`) y no contra la dirección visible.

## Regenerar los datos

Hacen falta `pandas`, `numpy`, `openpyxl` y, para las tarjetas, `Pillow`
(`pip install -r requirements.txt`). El notebook necesita además `geopandas`;
estos scripts no: la geometría se lee del GeoPackage con `sqlite3`.

```bash
python3 exportar_datos.py    # Excel      -> web/datos/mun/<codINE>.json, web/datos/isla/<isla>.json + indice.json
python3 exportar_geo.py      # GeoPackage -> web/datos/geo/municipios.json
python3 generar_tarjetas.py  # tarjetas og/, envoltorios m/ e i/, y web/config.js
npm test                     # antes de publicar (ver Verificación)
```

Los dos primeros leen de `~/Downloads/`; la ruta está en una constante al
principio de cada script. **Los tres van juntos**: las tarjetas, los
envoltorios y la descripción de la portada llevan escritos la población y el
año, y si se regeneran los datos sin regenerarlos se quedan viejos
(`pruebas/invariantes.py` lo detecta). `exportar_datos.py` escribe además en
`indice.json` el orden de las islas, de oeste a este, que heredan la portada,
los selectores y el dossier (`islas` e `islas_resumen`, con la población y el
número de municipios de cada una), y el último dato regional de origen
extranjero, que usa la portada.
Se detiene, en vez de avisar y seguir, si un municipio del Excel no encaja
con el GeoPackage (saldría sin código INE), si un valor de los componentes
del cambio supera el umbral de anomalía en un municipio o año que no esté en
`ANOMALIAS_CONOCIDAS`, si la población de una isla no coincide en `C1I`, en
su pirámide y en la suma de sus municipios, o si su serie de origen
extranjero (`C22I`) no es la suma de la de sus municipios: un dato así hay que
mirarlo, no etiquetarlo a ciegas. La única excepción que corrige por sí
mismo, avisando, es la de dos islas con las columnas cambiadas (ver Los
datos).

La URL pública está en un solo sitio, `sitio.json`: de ahí salen las canónicas
y las etiquetas `og:` de las cinco páginas, los envoltorios de `web/m/`, el
enlace de vuelta de las páginas de aviso y `web/config.js`, que se la da al
JavaScript para el botón de compartir. En `sitio.json` van también los
orígenes que pueden enmarcar la web (`origenes_iframe`). Mudar el sitio de
alojamiento es cambiar ese fichero y volver a ejecutar `generar_tarjetas.py`;
`pruebas/invariantes.py` ensaya esa mudanza con una URL ficticia y comprueba
que no queda ninguna referencia al dominio anterior.

## Qué hay

```
exportar_datos.py    Excel -> 88 JSON municipales y 7 insulares (unos 4 KB cada uno) + indice.json
exportar_geo.py      GeoPackage -> GeoJSON simplificado (17,2 MB -> 252 KB)
generar_tarjetas.py  las 96 tarjetas de vista previa, los envoltorios de web/m/ y web/i/, y web/config.js
territorios.py       islas, comarcas y excepciones de nombres, extraídas del notebook
sitio.json           la URL pública y los orígenes que pueden enmarcar la web, en un solo sitio
requirements.txt     dependencias de Python; package.json, las de las pruebas (Playwright)
pruebas/             la batería: invariantes de los datos, conciliación con el Excel e interacciones
.github/workflows/   la acción que pasa la batería y publica web/ en GitHub Pages

web/index.html       portada: buscador y una tarjeta por isla, con sus municipios
web/ficha.html       la ficha municipal y la ficha de isla
web/comparar.html    hasta tres municipios en paralelo, o tres islas
web/guia.html        qué mide cada indicador y con qué cuenta se obtiene
web/dossier.html     las 95 fichas en un documento A4 de 98 hojas

web/config.js        la URL pública y los orígenes del iframe, generados desde sitio.json
web/comun.js         cifras, escapado, carga con error visible, el cruce con desenfoque y el aviso al enmarcar
web/datos-ui.js      la fuente de cada gráfico
web/ficha.js         los gráficos en SVG, sin librerías, en pantalla y en hoja; la ficha municipal y la de isla
web/portada.js       buscador, tarjetas de isla con su desplegable y entrada de la portada
web/comparar.js      el comparador
web/guia.js          la guía
web/dossier.js       compone el dossier reutilizando los gráficos de ficha.js
web/iconos.js        los quince iconos, en un solo sitio
web/estilos.css      sistema de tarjeta, identidad visual e impresión
web/dossier.css      solo el armazón del dossier
web/404.html         la página de error de GitHub Pages, con el camino a la portada
web/enmarcada.html   el aviso que se muestra si otro sitio enmarca la web
web/fonts/           Montserrat (licencia SIL OFL), alojada en la web
web/img/             los logotipos y el icono de la pestaña
web/og/  web/m/  web/i/   tarjetas de vista previa y sus envoltorios con etiquetas og:
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
que se lee en pantalla.

**«Origen extranjero» y el tramo «extranjero» del lugar de nacimiento son el
mismo dato**: en los 88 municipios difieren como mucho en 0,05 puntos y de
media en 0,03.

**Las islas salen de las hojas «I»** del mismo libro (`C1I`, `C6I`, `C7I`,
`C22I`, `C23I`, `C24I`, `C25I` y los cuatro índices), con los mismos lectores
que las municipales; la serie de población insular arranca en 2000, no en
1996. El exportador comprueba que cada isla es la suma de sus municipios
donde puede serlo: la población coincide en las tres hojas (`C1I`, pirámide y
suma de `C1M`), y la serie de origen extranjero se contrasta año a año, en
personas, con la suma de `C22M` por `C1M`. Ahí aparece un error del libro: en
`C2I` (nacidos fuera de España por isla, de donde sale `C22I`) las columnas
de Lanzarote y Fuerteventura vienen cambiadas de 2021 a 2025, los años de la
operación censal; con ellas, la ficha de Lanzarote habría dicho 30,4 % de
origen extranjero en la barra y 34,4 % en el lugar de nacimiento. El
exportador detecta el intercambio (el recuento de una isla es el de la otra y
viceversa), lo corrige, lo avisa al exportar y `conciliar_excel.py` cuenta los
años corregidos; queda pendiente arreglarlo en el Excel. Cualquier otro
descuadre detiene la exportación. En el saldo migratorio, la hoja insular
de Lanzarote y la de Gran Canaria difieren de la suma de sus municipios en
2022 y 2023 (244 y 235 personas, en sentidos opuestos); la ficha muestra el
dato insular tal como lo publica el ISTAC.

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

**Solo en Canarias Convive.** Si otro sitio enmarca la web en un `<iframe>`,
`comun.js` sustituye la página por `enmarcada.html`, un aviso con el camino a
las fichas: se compara el origen que enmarca (`location.ancestorOrigins` o,
en Firefox, el `referrer`) con la propia web y con `origenes_iframe` de
`sitio.json`, y si no se puede saber quién enmarca no se bloquea. Un enlace
directo a la web no se puede impedir ni conviene: es público.

**Política de contenido.** Cada página lleva una `Content-Security-Policy`
por `<meta>` (GitHub Pages no admite cabeceras): solo scripts, datos y
tipografía de la propia web, ningún objeto ni formulario, y nada en línea,
ni manejadores ni scripts (los envoltorios `m/` e `i/` permiten solo su
script de redirección, por la huella sha256 que `generar_tarjetas.py`
calcula). Los estilos en línea sí se permiten: los gráficos los llevan.
`pruebas/invariantes.py` comprueba que las siete páginas y los envoltorios
la llevan y que no queda ningún manejador en línea, y la batería fallaría
con cualquier recurso que la política bloquease. Las acciones del workflow
van fijadas por commit, con la versión en el comentario.

**La ficha no espera a los mapas.** La geometría de los mapas pesa 258 KB y
se pide a la vez que el índice; la ficha se pinta con sus 4 KB en cuanto
llegan, con un hueco del tamaño de cada mapa y su pie, y los mapas se
dibujan en cuanto llega la geometría, sin que nada salte. Si falla, la
ficha se ve entera y un aviso ofrece reintentar solo los mapas.

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
«Municipio: Según origen» (con la mayúscula que dictó Pedro): nacidos en España en azul y nacidos en el
extranjero (hoja `C24`) en negro hueco, cada población sobre su propio total,
que es como lo calcula Pedro; la leyenda dice «Hombres españoles · Mujeres
españolas · Extranjeros», con sus palabras, y la línea de fuente de la pestaña
precisa que el ISTAC mide dónde nació cada persona, no su nacionalidad. Las
barras ocupan 0,8 de la fila, como en su cuaderno. El eje lo decide cada
pestaña de cada municipio: el entero más pequeño que cubre todas sus barras,
el mismo a los dos lados (`ejeAutomatico`, en `web/comun.js`), que es su
regla: que se adapte a cada pirámide para que se vea lo más ancha posible.
Sale 5 en 62 municipios, 6 en 24 y 7 en Artenara y Tejeda en la primera
pestaña; en la segunda va de 5 a 14 (14 en Artenara): sobre base propia los
extranjeros de un municipio pequeño se concentran mucho, y un eje que corta
una barra miente. `exportar_datos.py` escribe el reparto en cada exportación
y se detiene si algún municipio necesitara más de 14. Los rótulos van de dos
en dos, como en el cuaderno, salvo en el móvil con eje de 10 o más, donde van
de cuatro en cuatro; el tope siempre rotulado, sin el múltiplo anterior si
queda pegado. En reposo no hay ninguna cifra ni línea horizontal. Al señalar
un grupo de edad —con el ratón, el dedo o las flechas— sus porcentajes
aparecen en el dibujo junto a la punta de las barras (azul para la barra,
negro para el marco), con dos decimales y «< 0,01 %» cuando hay personas pero
el redondeo daría cero, y una región viva invisible los dice en palabras. Van
por fuera de la barra; si no caben en una línea, en dos (pueden salir un poco
del dibujo, sobre el relleno de la tarjeta); y si tampoco caben, dentro de la
barra pegadas a la punta, nunca en la base. Un clic o un toque fija el grupo:
la franja fijada sobrevive al cambio de pestaña, al redibujado por cambio de
ancho y a la impresión (en la hoja no se imprime), y otro clic la suelta. En
pantalla cada fila mide al menos 24 px, el objetivo de puntero que pide
WCAG 2.5.8: la pirámide crece a 550 px de alto cuando la tarjeta es ancha.

**Índices con la escala de Pedro.** Los tres ámbitos ordenados de izquierda a
derecha por valor, y el tono indica la posición; dos ámbitos con el mismo
valor (pasa en doce municipios) llevan el mismo tono. Señalar un ámbito lo
resalta en los cuatro índices: con el ratón al pasar, con el dedo con un
toque que fija, y con el teclado enfocando el bloque y recorriendo los
ámbitos con las flechas (Enter fija, Escape suelta), como la pirámide.

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
años, también en papel, y cada cuatro en pantallas estrechas. El eje vertical
se ajusta a cada municipio, como la pirámide: el mismo paso redondo (1-2-5) a
los dos lados y cada lado con su tope, el múltiplo justo por encima de su
barra más larga (el negativo no baja más de lo que bajan sus barras; sin
negativos, el cero es el suelo); se rotulan el cero, los topes y los pasos
que quepan.

**El municipio en su entorno.** Tres mapas —Canarias, la isla y la comarca—
con el puesto por población y el peso en cada ámbito; la unidad territorial
va en negrita negra, para destacarla. El tercero dice «en la comarca», como
en la ficha de Pedro; en El Hierro, donde la comarca es la isla, hay dos
mapas y las migas no la repiten.

**La ficha de isla es la misma ficha** (`ficha.html?isla=tenerife`, con el
mismo código: lo que cambia lo dice `entidad(f)` en `ficha.js`), y solo se
sustituye lo que no tiene sentido para una isla. Seis de los ocho bloques
funcionan tal cual con los datos insulares (cifras clave, evolución, origen
extranjero, pirámide con las pestañas «Isla y Canarias» e «Isla: según
origen», componentes y lugar de nacimiento). Los otros dos: en vez de «El
municipio en su entorno», «La isla en Canarias» (la isla destacada en el
archipiélago, su puesto entre las siete y su peso, y debajo la isla con sus
términos municipales) junto a «Sus municipios», la lista de mayor a menor
población con una barra de fondo proporcional al mayor, sus habitantes y su
peso en la isla, cada uno enlazado a su ficha (señalar uno en la lista lo
destaca en el mapa); y en «Información geodemográfica», las siete islas y
Canarias ordenadas de menor a mayor en cada índice, en una escalera vertical
con la barra proporcional al mayor valor, la isla en azul y Canarias en gris,
que es la escala de tres ámbitos de Pedro extendida a ocho. La cabecera dice
«Canarias · 31 municipios» donde la municipal dice la isla y la comarca. El
desplegable de la barra es uno solo para todo: cada isla abre su grupo con
«toda la isla» y sigue con sus municipios, así que de la isla se pasa al
municipio y del municipio a la isla sin cambiar de página; la pirámide se
transforma entre unas y otras.

**La portada son las siete islas.** Una tarjeta por isla, las siete iguales
y en una fila (en el móvil, apaisadas en una columna), cada una con su
silueta dibujada con los mismos límites municipales fundidos (`portada.js`),
su nombre y cuántos municipios tiene. La tarjeta despliega la lista de fichas
de esa isla: la isla entera primero, en azul, y debajo cada municipio por
orden alfabético; los siete desplegables miden lo mismo, como pidió Pedro
para las listas de isla, y el de las tarjetas del extremo se alinea a la
derecha para no salirse de la tapa. La opción señalada va en claro con una
marca azul, para que el azul pleno sea solo el de la isla entera. El buscador
encuentra islas y municipios, las islas primero. Se probó antes un mapa
grande del archipiélago con pestañas y un panel; Diego prefirió las
tarjetas, más limpias y del mismo tamaño.

**Anillo para el lugar de nacimiento.** Municipio y Canarias, uno al lado del
otro, con el reparto escrito debajo.

**La fuente bajo cada gráfico.** Una línea «Fuente: …» al pie de cada gráfico,
en pantalla, en la hoja y en el dossier, con la redacción que fijó Pedro para
cada uno (`FUENTES_GRAFICOS`, en `web/datos-ui.js`): operación estadística
del ISTAC y años que cubre, y GRAFCAN en los mapas; sin «Elaboración propia».
La pirámide cambia de fuente con la pestaña, porque cada una dibuja una tabla
distinta. Los años son los de la operación de origen (la serie de cifras
oficiales arranca en 1996 aunque un municipio empiece más tarde), así que no
se calculan con los datos: se revisan a mano con cada actualización, y
`pruebas/invariantes.py` avisa si el año de referencia deja de aparecer en
ellas. Las cifras clave no llevan línea de fuente: no son un gráfico. Nada
más al pie de la tarjeta. La guía dice qué mide cada indicador y con qué
cuenta se obtiene, con los enunciados de Pedro y la fórmula de cada uno
(las dos restas, incluidas), y nada más: ni fechas ni enlaces a los
recursos. Las tarjetas de cada fila miden lo mismo, con la fórmula abajo, y
la última, sola, va a todo el ancho.

**Comparador.** Hasta tres municipios en columnas, siempre de mayor a menor
por el criterio elegido en la barra: una cifra clave (habitantes, variación
media anual, mujeres, hombres) o un índice (envejecimiento, juventud,
dependencia, reemplazo laboral); elegir en un desplegable deja el otro sin
elección. Las pirámides comparten eje y no llevan aviso alguno. En el lugar
de nacimiento cada cifra va del tono de su tramo de la barra, que es lo que
pidió Pedro (el tono más claro, #B5D4F4, no llega al contraste AA sobre
blanco; queda dicho). Los anillos de origen extranjero van de un solo azul,
porque es una sola magnitud, y de mayor a menor. Con el mismo código se
comparan hasta tres islas (`comparar.html?i=tenerife,gran-canaria`): un
conmutador en la cabecera pasa de municipios a islas y vacía la
comparación, porque municipios e islas no se mezclan nunca.

**Un solo orden de islas**, de oeste a este, que fija `exportar_datos.py` en
`indice.json` y heredan la portada, los selectores de la ficha y del
comparador, y el dossier; dentro de cada isla, los municipios por orden
alfabético. Las islas se identifican por su nombre en minúsculas y con guion
(`gran-canaria`), en direcciones, ficheros y desplegables.

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
de la cabecera azul, una placa blanca con el logotipo de Canarias Convive
(Pedro). Los límites municipales de los mapas van más gruesos en papel; los
pies de los mapas, los rótulos de los índices y las notas van a 6,5 pt, y la
línea de fuente de cada gráfico, la letra más pequeña de la hoja, a 6 pt
(a 6,5 la hoja de isla del dossier se salía). Medido en la versión
publicada: las 88 fichas miden 271,7 mm de los 281 disponibles (272,6 en El
Pinar y Frontera, por su nota de 2007), y la hoja más alta del dossier,
293,2 de 297.

La ficha de isla también es una A4, con tres concesiones al papel: la
tarjeta del mapa cede sitio a la lista de municipios (3/9 de la retícula en
vez de 4/8) y lleva solo el mapa de Canarias, la lista va en cuatro columnas
para Tenerife y Gran Canaria (tres o dos para las demás) sin la columna del
peso, que no cabe, y los índices van a dos columnas dentro de su tarjeta.
Las siete miden 275,6 mm; la letra más pequeña, la de esa lista, 5,2 pt.

El dossier (`dossier.html`) compone las 98 hojas —portada, guía de uso,
índice y, por cada isla, su ficha seguida de una hoja por municipio— con las
reglas de impresión de `estilos.css`, que copia en caliente, y los mismos
gráficos que la ficha, con la misma placa en la cabecera de cada hoja. La
ficha de la isla hace de portada de su grupo: su lista de municipios lleva
la hoja de cada uno, y el índice, la hoja de cada isla. Las hojas de isla
miden 293,4 mm de 297. Las 95 fichas se piden a la vez y lo que falle se
vuelve a pedir hasta dos veces antes de dar el error.

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
  suman Canarias; las siete islas con su ficha, su pirámide igual a su
  población e igual a la suma de sus municipios, su lista de municipios de
  mayor a menor, los índices de las siete, el origen extranjero conciliado
  con el lugar de nacimiento y su envoltorio `i/` con tarjeta; la TVMA es la
  de la serie sin redondeo intermedio; el último dato de origen extranjero se
  muestra igual que el del lugar de nacimiento y el regional es el de
  `indice.json`; los repartos suman cien; los cuatro índices están en los
  tres ámbitos; cada fuente de gráfico lleva el año de referencia; las islas
  van de oeste a este; los 88 envoltorios llevan la población y el año de
  `indice.json`, su tarjeta `og` y la URL de `sitio.json` (igual que las
  canónicas y `og:` de las cinco páginas, la descripción de la portada, que
  lleva el año y el arranque de la serie, y `config.js`, con los orígenes del
  iframe); las cinco cargan la misma versión de recursos y ningún recurso de
  terceros; ningún texto atribuye los datos al padrón; y una mudanza a una
  URL ficticia no deja rastro del dominio anterior.
- `pruebas/conciliar_excel.py`: 3.628 comparaciones contra el libro, celda a
  celda —población, series, origen extranjero con el decimal que se muestra,
  componentes con sus anomalías, los cuatro índices en los tres ámbitos,
  puestos y pesos, las 42 barras de cada pirámide y el lugar de nacimiento en
  los 88 municipios, y lo mismo en las siete islas contra las hojas «I», con
  el origen extranjero contrastado con la suma de sus municipios y los años
  que el libro trae cambiados contados aparte—. Necesita el Excel en
  `~/Downloads` (o en la ruta que se le pase) y `openpyxl`; si falta
  cualquiera de los dos, se omite avisando. No corre en GitHub porque el
  libro no está en el repositorio.
- `pruebas/web.test.cjs` (Playwright, dieciséis casos): la última selección
  manda, la dirección visible es `m/<código>.html` y desde ella se sigue
  cargando todo, el error se ve y se reintenta, la tipografía carga de la
  propia web y ninguna página pide nada fuera ni recibe un error HTTP; los
  rótulos y la fuente de cada gráfico (sin «Elaboración propia»), el eje
  entero de la pirámide por pestaña y municipio, la pestaña «Municipio: según
  origen», la lectura con teclado tras redibujar e imprimir, la franja fijada,
  «< 0,01 %» y la cifra de la fila más larga junto a la punta y nunca en la
  base, el eje de origen extranjero con el tope rotulado y la cifra final
  libre de la línea de Canarias, las tablas ocultas, el mismo tono para el
  mismo valor, el ordinal con punto, las anclas por debajo de la barra, El
  Hierro con dos mapas; la ficha que pinta sin esperar a la geometría (hueco
  por mapa con su pie, mapas al llegar, aviso con reintento si fallan), las
  filas de la pirámide de 24 px, los índices con teclado (flechas, Enter fija,
  Escape suelta) y el alto que la página enmarcada dice al marco; la ficha
  de isla (se entra por `i/tenerife.html`, la
  dirección, la canónica y las etiquetas `og:` son las suyas, las pestañas
  dicen «Isla», los 31 municipios de mayor a menor con enlace a su ficha,
  señalar uno lo destaca en el mapa, la escalera de las siete islas y
  Canarias de menor a mayor con la isla en azul, ocho fuentes, la
  presentación con la escalera, sin desbordes a 375 y 1280, y el paso de la
  isla al municipio y a otra isla con el mismo desplegable); los rótulos de
  evolución, componentes y origen extranjero sin pisarse a 320, 375 y 414
  px; la presentación modal, que atrapa y devuelve el foco y deja el fondo
  oculto al lector de pantalla; el cruce sin fantasmas; el comparador con
  tres plazas, sin duplicados, colores fijos, tabla semántica sin edad media
  y sin texto en azul claro, sin desbordes a 1280 y 375 px, de mayor a menor
  por el criterio elegido en todas las secciones y en la tira de elegidos,
  sin avisos bajo las pirámides, cifras del lugar de nacimiento en su tono,
  anillos de un solo azul y ordenados, y el foco a salvo al quitar con
  teclado; el comparador de islas (islas con islas, y cambiar de modo vacía
  la comparación y cambia el desplegable y los rótulos); el fallo de carga
  inicial visible en el comparador y en la portada (buscador desactivado);
  la portada (siete tarjetas del mismo tamaño, en una fila a 1280, que
  abren dentro de la pantalla a 320, 375 y 1280 y sin desbordes, siete
  desplegables del mismo alto que empiezan por la isla entera en otro color
  y siguen con sus 31 municipios, Inicio, Fin, Escape y el foco, también
  abiertas con el ratón; el buscador como combobox con
  `aria-activedescendant`, Escape, las islas antes que los municipios y
  Enter abre la primera); el dossier que reintenta una
  petición fallida y se desplaza con teclado en pantallas estrechas; la
  ficha enmarcada en otro origen, que pasa al aviso, y enmarcada en la propia
  web, que se muestra; la guía (los enunciados de Pedro, sin edad media ni
  desplegables, exponente y anclas); y el papel: las 88 fichas y las 7 de
  isla en una A4 con tres cifras clave y la placa del programa en la
  cabecera, y el dossier de 98 páginas con su barra, la ficha de cada isla
  abriendo su grupo con la hoja de cada municipio, la placa en cada hoja y
  sin hojas desbordadas.

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
`aria-activedescendant`. Cada tarjeta de isla es un botón que abre un
`listbox` (flechas, Inicio, Fin y Escape, que devuelve el foco; con el ratón,
Safari no da el foco al botón y se le da a mano para que lleguen las teclas),
y su silueta queda oculta a las tecnologías de apoyo. En la ficha de isla, la
lista de municipios es una lista ordenada de enlaces, señalar uno lo destaca
solo en el mapa de la isla (el de Canarias no responde) y el resaltado se
suelta al salir; la escalera de índices es una lista ordenada por índice. La
presentación es un diálogo modal: el resto queda
inerte y oculto al lector de pantalla, el tabulador no sale y al cerrar el
foco vuelve al botón. Las anclas y el foco se colocan por debajo de la barra
pegajosa, cuya altura real se mide. El contorno de foco de los gráficos no
depende solo de `:focus-visible`. Los avisos de carga y de error son
regiones de estado en las cinco páginas. axe-core (WCAG 2.2 AA) no señala
ninguna violación en las cinco páginas a 320 y 1280 px, con desplegables,
presentación y comparador abiertos, con una excepción que es decisión de
Pedro: las cifras del lugar de nacimiento en el comparador van del tono de
su tramo, y los dos tonos claros no llegan al contraste AA sobre blanco. Las transiciones se desactivan con
`prefers-reduced-motion` y con la pestaña oculta, donde el navegador congela
`requestAnimationFrame`.

Queda abierta una sola cosa, por decisión: en Safari anterior a 16, al
llegar al final de un desplegable de isla el dedo arrastra también la página
(`overscroll-behavior` no existe ahí); no tiene arreglo limpio y Safari 16 es
de 2022.

## Incrustar en Canarias Convive

La web se incrusta en una página de WordPress con un `<iframe>`, como
`/mapa-de-agentes/`. Tres cosas que el WordPress tiene que hacer:

1. **Los atributos del marco.** `allow="fullscreen; clipboard-write"` y
   `allowfullscreen`, para el modo Presentar y el botón de copiar el
   enlace; sin ellos el navegador los bloquea en silencio.
2. **El alto.** La página, cuando la enmarca un origen de `origenes_iframe`,
   envía al marco su alto cada vez que cambia (`postMessage` con
   `{ fichas: 'alto', alto }`, en `comun.js`). El WordPress lo escucha y
   ajusta el marco, y así no hay barra de desplazamiento dentro:

   ```html
   <iframe id="fichas" src="https://diegoalegil.github.io/canariasconvive-fichas-municipales/"
           title="Fichas demográficas municipales" style="width:100%;border:0;min-height:600px"
           allow="fullscreen; clipboard-write" allowfullscreen loading="lazy"></iframe>
   <script>
   addEventListener('message', (e) => {
     if (e.origin !== 'https://diegoalegil.github.io' || !e.data || e.data.fichas !== 'alto') return;
     document.getElementById('fichas').style.height = e.data.alto + 'px';
   });
   </script>
   ```

   Con el marco a su alto, la barra pegajosa de la ficha deja de pegarse
   (es la página madre la que se desplaza); si se prefiere la barra pegada,
   el marco lleva un alto fijo y la ficha se desplaza dentro. Es una
   decisión de la integración.
3. **La dirección.** Dentro del marco se navega de la portada a la ficha y
   al comparador sin que cambie la dirección de la página madre. Si se
   quiere que un enlace externo abra un municipio concreto, la página de
   WordPress tiene que leer un parámetro propio y ponerlo en el `src` del
   marco (`ficha.html?municipio=38038`), o enlazar directamente a la web
   (`m/38038.html`), que es pública. La web madre lleva además
   `user-scalable=0`, que bloquea el zoom en el móvil y lo hereda el
   marco; se arregla en el tema de WordPress.

Al mudar la web a su alojamiento definitivo, cambiar `sitio.json` (la URL y
los orígenes que pueden enmarcarla), ejecutar `generar_tarjetas.py` y
cambiar el origen en los dos sitios del fragmento de arriba.

## Pendiente

- [ ] Arreglar en `BASE_DATOS_CANCON.xlsx` la hoja `C2I`: las columnas de
      Lanzarote y Fuerteventura vienen cambiadas de 2021 a 2025 (y `C22I`
      lo hereda). El exportador lo corrige y avisa mientras tanto; cuando
      el libro esté bien, el aviso desaparece solo.
- [ ] Enseñar a Pedro lo que no ha visto desde la v=79: la portada con las
      tarjetas, la ficha de isla (títulos «La isla en Canarias», «Sus
      municipios», «Las siete islas y Canarias, ordenadas de menor a mayor
      valor», y en papel la lista sin la columna del peso) y el comparador
      de islas. Y las preguntas que quedan de la auditoría: Frontera y El
      Pinar en 2007, si juventud lleva «%», las cifras de color del lugar
      de nacimiento (no llegan al contraste AA; la alternativa es un chip de
      color con la cifra en negro), y si el dossier y el modo Presentar,
      que no pidió, se quedan.
- [ ] Proyecciones de pirámides hasta 2036, para integrarlas como una vista más.
- [ ] Decidir si hay selector de año o solo el último.
- [ ] Decidir alojamiento: GitHub Pages o carpeta en el Plesk de Canarias
      Convive, y sacar el repositorio de una cuenta personal. Al mudarlo,
      seguir «Incrustar en Canarias Convive».
- [ ] Tras publicar, probar la vista previa de un enlace `m/<código>.html`
      en WhatsApp (las etiquetas están comprobadas tal como las lee un
      rastreador; falta verlo en un chat).

# Fichas municipales · Canarias Convive — versión web

Las 88 fichas demográficas municipales de Canarias, y una ficha por cada una
de las siete islas, por cada una de las dos provincias y por Canarias entera,
como página web interactiva, para colgar en canariasconvive.com. Los datos y la metodología son los del trabajo de
**Pedro Delgado** (`FICHAS_MUNICIPALES.ipynb` y `BASE_DATOS_CANCON.xlsx`),
que sigue siendo la fuente de verdad: los cuatro índices se leen ya
calculados del Excel; la variación media anual y los puestos se calculan en
el exportador.

## Cómo se levanta

```bash
python3 -m http.server 8140 --directory web
```

Y se abre `http://localhost:8140`. La raíz es la portada: el buscador, la
banda de Canarias entera y, bajo el rótulo de su provincia, una tarjeta por
isla, que despliega primero la ficha de la isla entera y debajo la de cada
municipio. La ficha vive en `ficha.html` y admite un municipio por código
INE, `ficha.html?municipio=38038`, una isla, `ficha.html?isla=tenerife`, una
provincia, `ficha.html?provincia=las-palmas`, o Canarias,
`ficha.html?canarias` (un enlace antiguo del tipo `index.html?municipio=38038`
redirige solo). La dirección estable de cada ficha es `m/38038.html`,
`i/tenerife.html`, `p/las-palmas.html` o `r/canarias.html`: un envoltorio con
las etiquetas de vista previa que redirige a la ficha, y la
que la ficha deja en la barra del navegador al cargar y al cambiar de
territorio, de modo que copiarla de ahí es lo mismo que «Copiar enlace». Por
eso datos y enlaces se resuelven contra la raíz de la web (`rutaWeb`, en
`comun.js`) y no contra la dirección visible.

## Tres marcas en una sola web

La web se ve con la marca del programa que la enlaza o la enmarca: Canarias
Convive por defecto, OBITen con `?marca=obiten` y Juntas en la misma
dirección con `?marca=juntas` en cualquier dirección de la web
(`index.html?marca=obiten`, `m/38038.html?marca=juntas`; los sobres pasan el
parámetro a la ficha). Las tres marcas viven en `sitio.json` (`marcas`: id,
nombre, logotipo grande y de menú, y la línea de entidades de la portada del
dossier; `marca_por_defecto`) y llegan a la web en `config.js`. La marca
cambia el logotipo de la cabecera de las páginas interiores, de la placa del
papel y de la presentación, el nombre en los títulos de las páginas y en los
pies del dossier, y la línea de entidades de su portada; el resto es
idéntico. Se recuerda mientras se navega: los enlaces internos la llevan al
pulsarlos, «Copiar enlace» la incluye y la sesión la guarda por si algún
enlace se escapa; sin parámetro ni sesión (otra pestaña, otro sitio que la
enmarca) es la de por defecto, y una marca desconocida también. La portada no
cambia: lleva siempre los tres logotipos juntos en su placa, en el orden de
`sitio.json` (Pedro). Cada marca lleva su altura de logotipo (`--alto-logo`,
`--alto-placa`… en `estilos.css`, por `data-marca` en `<html>`; en la
portada, por `data-marca` en cada imagen): el de OBITen es apaisado con letra
pequeña y el de Juntas es cuadrado, y a la altura del de Canarias Convive no
se leerían; en el papel, una placa más alta se coloca a la derecha del año,
no debajo. Las tarjetas de vista previa y las etiquetas `og:` son estáticas y
van siempre con la marca por defecto: si algún día hace falta una vista
previa por marca, se generan los sobres por marca. Añadir una marca es añadir
su entrada en `sitio.json` y sus dos PNG en `web/img/`, y ejecutar
`generar_tarjetas.py`. Las líneas de entidades de OBITen y de Juntas
(«Cabildo de Tenerife · Universidad de La Laguna») están puestas de oído: hay
que confirmarlas.

## Regenerar los datos

Hacen falta `pandas`, `numpy`, `openpyxl` y, para las tarjetas, `Pillow`
(`pip install -r requirements.txt`). El notebook necesita además `geopandas`;
estos scripts no: la geometría se lee del GeoPackage con `sqlite3`.

```bash
python3 exportar_datos.py    # Excel      -> web/datos/mun/<codINE>.json, isla/<isla>.json, provincia/<provincia>.json, canarias.json + indice.json
python3 exportar_geo.py      # GeoPackage -> web/datos/geo/municipios.json
python3 generar_tarjetas.py  # tarjetas og/, envoltorios m/, i/, p/ y r/, y web/config.js
npm test                     # antes de publicar (ver Verificación)
```

Los dos primeros leen de `~/Downloads/`; la ruta está en una constante al
principio de cada script. **Los tres van juntos**: las tarjetas, los
envoltorios y la descripción de la portada llevan escritos la población y el
año, y si se regeneran los datos sin regenerarlos se quedan viejos
(`pruebas/invariantes.py` lo detecta). `exportar_datos.py` escribe además en
`indice.json` el orden de las islas y de las provincias, de oeste a este, que
heredan la portada, los selectores y el dossier (`islas`, `islas_resumen` y
`provincias`, con la población y el número de municipios de cada una), y el
último dato regional de origen extranjero, que usa la portada.
Se detiene, en vez de avisar y seguir, si un municipio del Excel no encaja
con el GeoPackage (saldría sin código INE), si un valor de los componentes
del cambio supera el umbral de anomalía en un municipio o año que no esté en
`ANOMALIAS_CONOCIDAS`, si la población de una isla no coincide en `C1I`, en
su pirámide y en la suma de sus municipios, si su serie de origen extranjero
(`C22I`) no es la suma de la de sus municipios, si Canarias no es la suma de
las islas o si las fórmulas de los índices no reproducen las hojas de las
islas y de Canarias (con ellas se calculan los índices provinciales): un dato
así hay que mirarlo, no etiquetarlo a ciegas. La única excepción que corrige por sí
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
exportar_datos.py    Excel -> 88 JSON municipales, 7 insulares, 2 provinciales y el de Canarias (unos 4 KB cada uno) + indice.json
exportar_geo.py      GeoPackage -> GeoJSON simplificado (17,2 MB -> 252 KB)
generar_tarjetas.py  las 99 tarjetas de vista previa, los envoltorios de web/m/, web/i/, web/p/ y web/r/, y web/config.js
territorios.py       islas, comarcas y excepciones de nombres, extraídas del notebook; las dos provincias
correcciones_libro.py  las celdas cruzadas conocidas del libro, que se corrigen solo mientras sigan mal
sitio.json           la URL pública, los orígenes que pueden enmarcar la web y las tres marcas, en un solo sitio
requirements.txt     dependencias de Python; package.json, las de las pruebas (Playwright)
pruebas/             la batería: invariantes de los datos, conciliación con el Excel e interacciones
.github/workflows/   la acción que pasa la batería y publica web/ en GitHub Pages

web/index.html       portada: buscador, Canarias, las dos provincias y una tarjeta por isla, con sus municipios
web/ficha.html       la ficha municipal, la de isla, la de provincia y la de Canarias
web/comparar.html    hasta tres municipios en paralelo, tres islas o las dos provincias
web/guia.html        qué mide cada indicador y con qué cuenta se obtiene
web/dossier.html     las 98 fichas en un documento A4 de 101 hojas

web/config.js        la URL pública, los orígenes del iframe y las marcas, generados desde sitio.json
web/comun.js         cifras, escapado, carga con error visible, el cruce con desenfoque, el aviso al enmarcar y la marca activa
web/datos-ui.js      la fuente de cada gráfico
web/ficha.js         los gráficos en SVG, sin librerías, en pantalla y en hoja; las fichas de municipio, isla, provincia y Canarias
web/portada.js       buscador, banda de Canarias, rótulos de provincia, tarjetas de isla con su desplegable y entrada de la portada
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

**Cifras clave: cuatro.** Variación media anual, edad media, mujeres y
hombres, en municipios y en islas. La edad media no está en el libro: se
aproxima con los grupos quinquenales de la propia pirámide (marcas de clase
2,5; 7,5; …; 97,5 años y 102 para el grupo de 100 o más), en el exportador,
y `invariantes.py` la recalcula desde la pirámide de cada JSON. Pedro pidió
quitarla de la guía de indicadores, no de las cifras clave (se entendió mal
en la tercera llamada y estuvo fuera de la web entre la v=84 y la v=89).

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
personas, con la suma de `C22M` por `C1M`. Ahí apareció el primer error del
libro: en `C2I` (nacidos fuera de España por isla, de donde sale `C22I`) las
columnas de Lanzarote y Fuerteventura venían cambiadas de 2021 a 2025, los
años de la operación censal; con ellas, la ficha de Lanzarote habría dicho
30,4 % de origen extranjero en la barra y 34,4 % en el lugar de nacimiento.
El exportador detecta un intercambio así (el recuento de una isla es el de la
otra y viceversa), lo corrige, lo avisa al exportar y `conciliar_excel.py`
cuenta los años corregidos. Cualquier otro descuadre detiene la exportación.
El mismo contraste en los componentes del cambio (`C6M` y `C7M` contra `C6I`
y `C7I`, isla por isla y año por año) destapó el segundo error del libro: en
`C7M` los dos San Bartolomé, el de Lanzarote y el de Tirajana, tenían las
celdas cruzadas en 2022 y 2023 (la suma de cada isla se iba 244 y 235
personas, en sentidos opuestos, y cruzar esas dos celdas lo cuadraba
exactamente). Pedro confirmó los dos errores el
15/9 y el 16/9 pasó el libro corregido (con un tercer arreglo, el total de
Canarias de `C7R` en 2023, que la web no usa): exportado desde él, no hay
ningún aviso y los datos son los mismos que ya se habían publicado con las
correcciones. Las correcciones conocidas del libro viven en
`correcciones_libro.py` (ahora vacío) y se aplican solo mientras el libro
siga con el error: si ya cuadra, no se toca nada; si no cuadra ni con ellas,
la exportación se detiene. `conciliar_excel.py` aplica las mismas al leer el
libro y cuenta las celdas corregidas, e `invariantes.py` comprueba en los
JSON que cada isla suma sus municipios.

**Canarias sale de las hojas «R»** (`C1R`, `C6R`, `C7R`, `C22R`, `C23R`,
`C24R`, `C25R` y los índices), con los mismos lectores; el exportador
comprueba que la población coincide en `C1R`, en la pirámide y en la suma de
las siete islas. `C1R` arranca en 1971, pero la serie de la ficha se acota a
los años de las de isla y provincia (desde 2000): con 55 años la curva pierde
detalle y lo que interesa son los últimos 25. **Las dos provincias no tienen
hojas** y se suman desde sus islas (`PROVINCIAS`, en `territorios.py`):
población, pirámides, componentes y lugar de nacimiento son sumas exactas; la
serie de origen extranjero se suma en personas (`C22I` por `C1I`) sobre la
población conjunta; y los cuatro índices se calculan sobre la pirámide sumada
con las fórmulas del libro (`indices_de_piramide`), que reproducen
exactamente las hojas `C10`–`C17` de las siete islas y de Canarias: el
exportador lo comprueba antes de usarlas y se detiene si dejaran de
coincidir. `conciliar_excel.py` contrasta Canarias con las hojas «R» y cada
provincia con la suma de sus islas, e `invariantes.py` recalcula los índices
provinciales desde su pirámide.

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

**La ficha no espera a los mapas.** La geometría de los mapas pesa 252 KB y
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
nunca en negro puro. Las tarjetas de una misma fila miden lo mismo (la más
alta manda) y el cuerpo ocupa lo que queda bajo el rótulo: los gráficos de
evolución, origen extranjero y componentes se redibujan más altos hasta
llenar su tarjeta (`igualarGraficos`, como mucho dos tercios más), los cuatro
índices se reparten a lo alto de la suya, que mide lo que la pirámide, y una
lista corta (los tres municipios de El Hierro, las islas de una provincia) va
centrada; la pirámide manda en su fila y no se toca. En el papel y en el
dossier, lo mismo, y las hojas miden igual que antes porque la fila ya la
marcaba la tarjeta más alta.

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
queda pegado (`pasosEje`, en `web/comun.js`: la misma rejilla y los mismos
rótulos en la ficha, el dossier y el comparador). En reposo no hay ninguna
cifra ni línea horizontal. Al señalar
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

**Evolución de la población.** La curva desde cero, con el eje vertical en
los tramos redondos (1, 2, 2,5 o 5 por potencia de diez) más cercanos a
cinco, entre cuatro y seis (`pasoEvolucion`): cada 250.000 en Tenerife, cada
500.000 en Canarias, cada 10.000 en Adeje. Antes el paso era el primer
múltiplo redondo por encima de un quinto del máximo y un tercio de las fichas
se quedaba en tres tramos, donde la curva pierde detalle, dijo Pedro. El
margen izquierdo se hace al rótulo del tope, que en Tenerife y Gran Canaria
tiene siete cifras aunque los datos tengan seis. Encima, la cápsula con la
variación acumulada de los últimos 25 años; el eje temporal de cinco en cinco
años, cuadrado con el último dato.

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
términos municipales) junto a «Sus municipios» («Los 31 municipios de la
isla y su peso demográfico de mayor a menor», con las palabras de Pedro), la
lista de mayor a menor población con una barra de fondo proporcional al
mayor, sus habitantes y su peso en la isla, cada uno enlazado a su ficha
(señalar uno en la lista lo destaca en el mapa); y en «Información
geodemográfica», las siete islas y
Canarias ordenadas de menor a mayor en cada índice, en una escalera vertical
con la barra proporcional al mayor valor, la isla en azul y Canarias en gris,
que es la escala de tres ámbitos de Pedro extendida a ocho. La cabecera dice
«Canarias · 31 municipios» donde la municipal dice la isla y la comarca. El
desplegable de la barra es uno solo para todo: cada isla abre su grupo con
«toda la isla» y sigue con sus municipios, así que de la isla se pasa al
municipio y del municipio a la isla sin cambiar de página; la pirámide se
transforma entre unas y otras.

**Las fichas de provincia y de Canarias siguen el mismo patrón**
(`ficha.html?provincia=las-palmas`, `ficha.html?canarias`; el desplegable
abre con «Canarias · todo el archipiélago», «Provincia de Santa Cruz de
Tenerife» y «Provincia de Las Palmas»). La provincia lleva «La provincia en
Canarias» (sus islas destacadas en el archipiélago y su peso; sin puesto,
porque entre dos no hay clasificación), «Sus islas» («Las 4 islas de la
provincia y su peso demográfico de mayor a menor») y, a todo lo ancho, «Sus
municipios» («Los 54 municipios de la provincia…», con el mapa de sus islas y
sus términos al lado: señalar uno lo destaca); en la escalera de índices van
sus islas, «Provincia» (como «Municipio» e «Isla» en el bloque municipal:
«Santa Cruz de Tenerife» no cabe) y Canarias. Canarias lleva «Sus provincias»
(el archipiélago con cada provincia de un tono y las dos debajo, con el mismo
tono) y «Sus islas», y en ella la serie propia es la referencia: la pirámide
va sin marco negro (la pestaña se llama «Canarias»), el gráfico de origen
extranjero sin la línea de Canarias y el lugar de nacimiento con un solo
anillo; la evolución va de 2000 a 2025, como en las islas y las provincias.

**La portada son Canarias, las dos provincias y las siete islas.** Arriba, la
banda de Canarias entera (silueta del archipiélago, «Canarias» y «Ver la
ficha», sin cifras: las de la cabecera ya son las suyas); debajo, el rótulo
de cada provincia, con sus islas y sus habitantes, sobre sus tarjetas: una
por isla, las siete iguales y en una fila (en el móvil, apaisadas en una
columna, cada provincia con las suyas debajo), cada una con su silueta
dibujada con los mismos límites municipales fundidos (`portada.js`), su
nombre y cuántos municipios tiene. Es una sola retícula de siete columnas,
con los rótulos en la primera fila (cuatro y tres columnas) y las tarjetas en
la segunda, así miden exactamente lo mismo. La tarjeta despliega la lista de
fichas de esa isla: la isla entera primero, en azul, y debajo cada municipio
por orden alfabético; los siete desplegables miden lo mismo, como pidió Pedro
para las listas de isla, y el de las tarjetas del extremo se alinea a la
derecha para no salirse de la tapa. La opción señalada va en claro con una
marca azul, para que el azul pleno sea solo el de la isla entera. El buscador
encuentra Canarias, provincias, islas y municipios: los que empiezan por lo
tecleado antes que los que solo lo contienen y, a igualdad, del ámbito mayor
al menor. Se probó antes un mapa grande del archipiélago con pestañas y un
panel; Diego prefirió las tarjetas, más limpias y del mismo tamaño.

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
por la cifra clave elegida en la barra (habitantes, edad media, variación
media anual, mujeres u hombres). Los índices no ordenan la comparación: su
sección ya va de mayor a menor, índice a índice, y por eso el desplegable de
índices se quitó (Pedro). Las pirámides comparten eje, con la misma rejilla y
los mismos rótulos que la de la ficha (Pedro: sin referencias en el eje no se
puede comparar), y no llevan aviso alguno. En el lugar de nacimiento cada
cifra va del tono de su tramo de la barra, que es lo que pidió Pedro (el tono
más claro, #B5D4F4, no llega al contraste AA sobre blanco; queda dicho). Los
anillos de origen extranjero van de un solo azul, porque es una sola
magnitud, y de mayor a menor. Con el mismo código se comparan hasta tres
islas (`comparar.html?i=tenerife,gran-canaria`) o las dos provincias
(`comparar.html?provincias`, que las carga las dos de golpe; `?p=las-palmas`
deja una): un conmutador en la cabecera pasa de municipios a islas o a
provincias y vacía la comparación, porque los ámbitos no se mezclan nunca.

**Un solo orden de islas y de provincias**, de oeste a este, que fija
`exportar_datos.py` en `indice.json` y heredan la portada, los selectores de
la ficha y del comparador, y el dossier; dentro de cada isla, los municipios
por orden alfabético. Islas y provincias se identifican por su nombre en
minúsculas y con guion (`gran-canaria`, `santa-cruz-de-tenerife`), en
direcciones, ficheros y desplegables.

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
para Tenerife y Gran Canaria (tres o dos para las demás) con sus tres
cifras, y los índices van a dos columnas dentro de su tarjeta. Las siete
miden 275,6 mm; la letra más pequeña, la de esa lista, 5,2 pt. La de
Canarias mide 262,3 mm (la tarjeta de sus provincias es algo más ancha, 4/8,
para que el nombre de Santa Cruz de Tenerife quepa en una línea) y las dos de
provincia, 271,5: en el papel la provincia lista sus islas, no sus
municipios, que ya están en el índice del dossier.

El dossier (`dossier.html`) compone las 101 hojas —portada, guía de uso,
índice, Canarias y, por cada provincia, su ficha seguida de las de sus islas,
cada una con una hoja por municipio— con las reglas de impresión de
`estilos.css`, que copia en caliente, y los mismos gráficos que la ficha, con
la misma placa en la cabecera de cada hoja. La ficha de la provincia y la de
la isla hacen de portada de su grupo, y el índice lleva la hoja de Canarias,
de cada provincia, de cada isla y de cada municipio (la segunda provincia
abre columna). Las hojas de isla miden 292,6 mm de 297; la de Canarias,
277,3; las de provincia, 286,3. Las 98 fichas se piden a la vez y lo que
falle se vuelve a pedir hasta dos veces antes de dar el error.

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
  suman Canarias; la edad media de cada ficha, municipal o insular, es la
  que da su pirámide; las siete islas con su ficha, su pirámide igual a su
  población e igual a la suma de sus municipios, su lista de municipios de
  mayor a menor, los índices de las siete, el origen extranjero conciliado
  con el lugar de nacimiento y su envoltorio `i/` con tarjeta; las dos
  provincias y Canarias suman sus islas, sus índices son los de la fórmula
  del libro sobre su pirámide, sus componentes la suma de los de sus islas,
  su lista de islas de mayor a menor, y sus envoltorios `p/` y `r/` con
  tarjeta; la TVMA es la
  de la serie sin redondeo intermedio; el último dato de origen extranjero se
  muestra igual que el del lugar de nacimiento y el regional es el de
  `indice.json`; los repartos suman cien; los cuatro índices están en los
  tres ámbitos; cada fuente de gráfico lleva el año de referencia; las islas
  van de oeste a este; los 88 envoltorios llevan la población y el año de
  `indice.json`, su tarjeta `og` y la URL de `sitio.json` (igual que las
  canónicas y `og:` de las cinco páginas, la descripción de la portada, que
  lleva el año y el arranque de la serie, y `config.js`, con los orígenes del
  iframe y las marcas de `sitio.json`, cada una con sus logotipos en
  `web/img/`; los sobres conservan la consulta al redirigir); las cinco
  cargan la misma versión de recursos y ningún recurso de
  terceros; ningún texto atribuye los datos al padrón; y una mudanza a una
  URL ficticia no deja rastro del dominio anterior.
- `pruebas/conciliar_excel.py`: 3.790 comparaciones contra el libro, celda a
  celda —población, series, origen extranjero con el decimal que se muestra,
  componentes con sus anomalías, los cuatro índices en los tres ámbitos,
  puestos y pesos, las 42 barras de cada pirámide y el lugar de nacimiento en
  los 88 municipios; lo mismo en las siete islas contra las hojas «I», con
  el origen extranjero contrastado con la suma de sus municipios y los años
  que el libro trae cambiados contados aparte; Canarias contra las hojas «R»;
  y cada provincia contra la suma de sus islas—. Necesita el Excel en
  `~/Downloads` (o en la ruta que se le pase) y `openpyxl`; si falta
  cualquiera de los dos, se omite avisando. No corre en GitHub porque el
  libro no está en el repositorio.
- `pruebas/web.test.cjs` (Playwright, dieciocho casos): la última selección
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
  isla al municipio y a otra isla con el mismo desplegable); las fichas de
  Canarias y de provincia (se entra por `r/canarias.html`, la serie desde
  2000, la pirámide sin marco y sin marcadores ni lectura del marco, el
  origen extranjero sin línea ni leyenda y un solo anillo, las dos provincias
  con su tono y las siete islas de mayor a menor, cada provincia de su tono
  en el mapa y la isla señalada destacada, Canarias como propia en la
  escalera; la provincia con sus 4 islas, sus 54 municipios con el mapa de
  sus términos, el peso sin puesto, «Provincia» en la escalera, nueve
  fuentes y el enlace al comparador; y la vuelta a la forma municipal); los rótulos de
  evolución, componentes y origen extranjero sin pisarse a 320, 375 y 414
  px; la presentación modal, que atrapa y devuelve el foco y deja el fondo
  oculto al lector de pantalla; el cruce sin fantasmas; el comparador con
  tres plazas, sin duplicados, colores fijos, tabla semántica con las cinco
  cifras y sin texto en azul claro, sin desbordes a 1280 y 375 px, de mayor a menor
  por el criterio elegido en todas las secciones y en la tira de elegidos,
  sin avisos bajo las pirámides, cifras del lugar de nacimiento en su tono,
  anillos de un solo azul y ordenados, y el foco a salvo al quitar con
  teclado; el comparador de islas (islas con islas, ordenadas también por
  edad media, y cambiar de modo vacía la comparación y cambia el desplegable
  y los rótulos; a provincias entran las dos de golpe, `?p=` deja una y
  `?provincias` las dos); el fallo de carga
  inicial visible en el comparador y en la portada (buscador desactivado);
  la portada (la banda de Canarias y el rótulo de cada provincia, con enlace
  a su ficha, en una fila sobre sus islas a 1280 y cada uno sobre las suyas
  en una columna; siete tarjetas del mismo tamaño, en una fila a 1280, que
  abren dentro de la pantalla a 320, 375 y 1280 y sin desbordes, siete
  desplegables del mismo alto que empiezan por la isla entera en otro color
  y siguen con sus 31 municipios, Inicio, Fin, Escape y el foco, también
  abiertas con el ratón; el buscador como combobox con
  `aria-activedescendant`, Escape, la provincia y las islas antes que los
  municipios, «tene» da la isla antes que la provincia y Enter abre la
  primera); la marca (`?marca=obiten` cambia logotipos, títulos, la placa,
  la presentación, los enlaces al pulsarlos, «Copiar enlace», el comparador
  y el dossier con sus pies y su portada; en el papel la placa no tapa el
  año; el logotipo cuadrado de Juntas va más alto; sin parámetro o con una
  marca desconocida, Canarias Convive); el dossier que reintenta una
  petición fallida y se desplaza con teclado en pantallas estrechas; la
  ficha enmarcada en otro origen, que pasa al aviso, y enmarcada en la propia
  web, que se muestra; la guía (los enunciados de Pedro, sin edad media ni
  desplegables, exponente y anclas); y el papel: las 88 fichas, las 7 de
  isla, las 2 de provincia y la de Canarias en una A4 con cuatro cifras
  clave y la placa del programa en la cabecera (la provincia sin su lista de
  municipios y con la de islas), y el dossier de 101 páginas con su barra,
  Canarias, cada provincia y cada isla abriendo su grupo con la hoja de cada
  municipio en el índice, la pirámide de Canarias sin marco, la placa en
  cada hoja y sin hojas desbordadas.

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

Comprobado con el navegador y axe, aparte de la batería automática, en 320,
375, 414, 700, 701, 941, 1180, 1440 y 2560 px: sin
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

**Sin GitHub, dentro del propio alojamiento.** La web es estática: no
necesita servidor de aplicaciones ni base de datos, así que puede vivir en
una carpeta del Plesk de canariasconvive.com (por ejemplo
`httpdocs/fichas/`, que sería `https://canariasconvive.com/fichas/`) subida
por el gestor de archivos o por SFTP, sin GitHub ni intermediarios. El
procedimiento es el mismo: cambiar `sitio.json` a esa URL, ejecutar
`generar_tarjetas.py`, pasar la batería en local y copiar `web/` entera.
Lo que se pierde sin GitHub es la publicación automática con las pruebas
delante: cada actualización de datos es exportar, probar y volver a copiar
la carpeta a mano. Meter el código «dentro» de WordPress (en una página con
el editor, o como plugin) no compensa: son cinco páginas, catorce scripts y
hojas de estilo y doscientos ficheros de datos que WordPress y Divi
reescribirían o servirían mal; la carpeta aparte y, si se quiere dentro de
una página del sitio, el `<iframe>` de arriba es la integración limpia.
Como repositorio, el código puede seguir en GitHub (en una cuenta de equipo
de la empresa, con la misma acción de pruebas) aunque el alojamiento sea el
Plesk: las dos cosas son independientes.

## Pendiente

- [ ] Subir a la carpeta compartida `DATOS_CANCON` el libro corregido del
      16/9 (allí sigue el del 7 de agosto). El libro nuevo trae nueve hojas
      más (`C26`–`C32`, pirámides por año y hojas «P»): preguntar a Pedro si
      son las proyecciones a 2036.
- [ ] Confirmar con Alexis las líneas de entidades de OBITen y de Juntas en
      la portada del dossier (`sitio.json`), y si quieren vistas previas
      (tarjetas `og:`) por marca.
- [ ] Enseñar a Pedro y a Alexis lo hecho tras la llamada del 16/9: las fichas
      de Canarias y de las dos provincias (sumadas desde las islas, con los
      índices por la fórmula del libro), la portada con la banda de Canarias
      y los rótulos de provincia, el comparador de provincias y el dossier
      de 101 hojas; y lo que no han visto desde la v=79: la portada con las
      tarjetas, la ficha de isla (títulos «La isla en Canarias», «Sus
      municipios», «Las siete islas y Canarias, ordenadas de menor a mayor
      valor») y el comparador
      de islas. Y las preguntas que quedan de la auditoría: Frontera y El
      Pinar en 2007, si juventud lleva «%», las cifras de color del lugar
      de nacimiento (no llegan al contraste AA; la alternativa es un chip de
      color con la cifra en negro), y si el dossier y el modo Presentar,
      que no pidió, se quedan.
- [ ] Proyecciones de pirámides hasta 2036, para integrarlas como una vista más.
- [ ] Decidir si hay selector de año o solo el último.
- [ ] Decidir alojamiento: GitHub Pages (en una cuenta de equipo de la
      empresa, posibilidad que salió el 16/9) o carpeta en el Plesk de
      Canarias Convive sin GitHub, y sacar el repositorio de una cuenta
      personal. Al mudarlo, seguir «Incrustar en Canarias Convive».
- [ ] Tras publicar, probar la vista previa de un enlace `m/<código>.html`
      en WhatsApp (las etiquetas están comprobadas tal como las lee un
      rastreador; falta verlo en un chat).

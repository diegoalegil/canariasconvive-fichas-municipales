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

Y se abre `http://localhost:8140`. La raíz es la portada con el mapa selector;
la ficha vive en `ficha.html` y se puede enlazar un municipio concreto con
`ficha.html?municipio=38038` (código INE). Un enlace antiguo del tipo
`index.html?municipio=38038` redirige solo.

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
web/index.html       portada: mapa selector de los 88 municipios
web/portada.js       cartografía por islas, buscador y filtro por isla
web/ficha.html       estructura de la ficha municipal
web/ficha.js         gráficos en SVG, sin librerías, en pantalla y en hoja A4
web/iconos.js        el set de diez iconos, en un solo sitio
web/estilos.css      sistema de tarjeta, identidad visual e impresión
web/datos/           salida de los dos scripts
```

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

**Cifras clave con su propio dato dentro.** Cada celda lleva una
micro-representación dibujada con los valores reales del municipio: la serie de
población del periodo, la edad media sobre la escala 0-100 y el reparto por sexo
en una retícula de puntos. Ninguna marca un umbral ni una referencia de "lo
normal"; solo dan escala a la cifra que tienen encima. Los números van centrados,
como pidió Pedro en la revisión.

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

**Entrada en oleada, de oeste a este.** Al entrar la portada en pantalla, los 88
municipios aparecen uno a uno con 9 ms de desfase, ordenados por su longitud
geográfica: un frente que cruza el archipiélago de El Hierro a Lanzarote. Las
divisorias municipales llegan al final, a los 1.180 ms, así que el mapa se
resuelve en municipios cuando el mosaico ya está completo. Total: 1.440 ms.

El orden sale de la propia geometría —la x del EPSG:4083 es el este en metros y
crece de forma monótona de El Hierro a Lanzarote—, así que no hay que mantener
ninguna lista a mano. Es un criterio que no dice nada de los municipios: es
dónde están. Todos comparten duración, color y escala, y las cifras aparecen
escritas en vez de contar hacia arriba: hacerlas subir dramatizaría un dato que
son personas.

Tres cosas que no son evidentes y están resueltas en el código: el umbral del
`IntersectionObserver` es una fracción del área del **elemento observado**, y la
tapa mide 5.000 px, así que un 0,3 fijo no se alcanza nunca y la animación no
arrancaría jamás —se calcula un umbral alcanzable—; dentro de un iframe el
observador mide contra el viewport del iframe, donde la portada está visible
desde el principio, que es justo lo que se quiere; y la clase de animación se
retira al acabar, para que un giro de pantalla no vuelva a lanzar la oleada.

Con `prefers-reduced-motion` no hay animación ni se registra el observador: se
ve directamente el estado final.

**El listado no es un extra, sostiene la accesibilidad del mapa.** En un móvil
hay trece municipios del norte de Tenerife cuya forma baja de los 24 px que pide
la norma para un objetivo táctil; el más pequeño es Puerto de la Cruz, con 16x11.
La norma admite esos casos cuando existe **un control equivalente en la misma
página**, y ese control es el listado alfabético por islas, que además es lo que
filtra el buscador. Por eso en pantalla táctil sus enlaces van holgados (37 px) y
no justos.

**Portada con mapa de verdad.** Cada isla se dibuja en su propio panel y a su
propia escala, en vez de meter el archipiélago entero a escala única. Así
Betancuria (805 habitantes) se pincha igual de fácil que Las Palmas (384.023) sin
renunciar a la forma real del municipio, que es lo que un concejal busca. Que las
islas no comparten escala entre sí se dice en el propio mapa. Cada municipio es un
enlace de verdad dentro del SVG: funciona el teclado, el clic central y el abrir
en otra pestaña sin una línea de JavaScript para ello. Debajo va el listado
completo por islas, que es la alternativa accesible al mapa y además es lo que
filtra el buscador.

**El PDF se redibuja, no se encoge.** Al imprimir, `beforeprint` vuelve a generar
todos los SVG a la medida de la hoja, con márgenes de eje y cuerpos de letra
propios. Escalar por CSS un gráfico pensado para 640 px hasta 60 mm dejaba las
etiquetas del eje en tres puntos y unas encima de otras. En la hoja el reparto de
la retícula pasa de 8/4 a 7/5: los índices repiten el nombre del municipio tres
veces y a cuatro columnas se partía en tres líneas, que era lo que hacía que la
ficha no cupiera en una cara.

## Verificación

Los valores exportados se contrastaron uno a uno contra la ficha PDF de Santa Cruz
de Tenerife generada por el notebook: población, variación acumulada, TVMA, edad
media, reparto por sexo, los tres rankings con sus pesos, los cuatro índices en
los tres ámbitos y el reparto por lugar de nacimiento. **Coinciden los 19.**
Además, la suma de la población de los 88 municipios cuadra exactamente con el
total regional de la hoja C1R.

La ficha impresa se comprobó municipio a municipio midiendo la altura real de la
maqueta a 190 mm de ancho: los 88 caben entre 271,2 y 273,1 mm, con 281 mm
disponibles en una A4 con estos márgenes. **Ninguno pasa a una segunda página.**

La auditoría comprueba además que **el contenido no se salga de su propia caja a
ninguna profundidad**, no solo de la tarjeta. La diferencia no es teórica: en
móvil, el pie de la celda de edad media se colaba por especificidad —`.cifra
em.entre` gana a `.cifra em` aunque la segunda esté dentro de una media query—,
y flex encogía el número hasta 4 px en vez de desbordar la tarjeta. La
comprobación antigua no lo veía; la nueva sí, y está verificada reintroduciendo
el fallo a propósito.

## Accesibilidad

Comprobado en 320, 375, 414, 700, 701, 941, 1180, 1440 y 2560 px: sin desbordes horizontales, sin
texto por debajo de 7,5 px reales, y todo el texto pasa el contraste AA (4,5:1,
o 3:1 en texto grande) tanto sobre blanco como sobre los fondos de las tarjetas.
Objetivos táctiles de 44 px en cualquier aparato con puntero grueso. La
transición de la pirámide se desactiva con `prefers-reduced-motion` y también
cuando la pestaña está oculta, donde el navegador congela `requestAnimationFrame`.

## Pendiente

- [ ] Confirmar con Pedro cómo nombrar la vista "Nacida en España" de la pirámide:
      se obtiene restando la población de origen extranjero (C24) del total (C23).
- [ ] Proyecciones de pirámides hasta 2036, para integrarlas como una vista más.
- [ ] Decidir si hay selector de año o solo el último.
- [ ] Decidir alojamiento: GitHub Pages o subdominio propio en su Plesk.
- [ ] Ojo: la web madre lleva `user-scalable=0`, que bloquea el zoom en móvil y lo
      hereda el iframe. Está en la auditoría como hallazgo M1.

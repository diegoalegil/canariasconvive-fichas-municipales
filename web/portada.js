/* =============================================================================
   PORTADA · FICHAS MUNICIPALES · CANARIAS CONVIVE

   Un mapa de verdad, no un cartograma de teselas: la geometría municipal ya
   está en el proyecto y el concejal busca la forma de su municipio, no un
   cuadrado. El problema de que Betancuria (805 habitantes) sea difícil de
   pinchar al lado de Las Palmas se resuelve dibujando cada isla en su propio
   panel y a su propia escala, no encogiendo las islas pequeñas dentro de un
   archipiélago a escala única.

   Que las islas no comparten escala entre sí se dice en el propio mapa. Es una
   convención cartográfica, no una lectura del dato.
   ============================================================================= */

/* Orden de oeste a este, que es como se nombran las islas aquí. El reparto de
   columnas da más sitio a las islas con más municipios. */
const ISLAS = [
  { nombre: 'El Hierro',     cols: 4 },
  { nombre: 'La Gomera',     cols: 4 },
  { nombre: 'La Palma',      cols: 4 },
  { nombre: 'Tenerife',      cols: 7 },
  { nombre: 'Gran Canaria',  cols: 5 },
  { nombre: 'Fuerteventura', cols: 6 },
  { nombre: 'Lanzarote',     cols: 6 },
];

const nf = (v, d = 0) => v == null || !isFinite(v)
  ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Sin tildes y en minúsculas, para que "Guimar" encuentre "Güímar". */
const plano = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

let GEO = null, INDICE = null, POR_COD = new Map();
let filtroIsla = null, consulta = '', marcado = null;

/* Orden de la oleada de entrada: los 88 municipios de oeste a este. La x del
   EPSG:4083 es el este en metros y crece de forma monótona de El Hierro a
   Lanzarote, así que basta ordenar por el centro de su envolvente. No es un
   criterio que diga nada del municipio: es dónde está. */
const OLEADA = new Map();
function ordenarOleada() {
  GEO.features
    .map((f) => [String(f.properties.codmun), (f.properties.bbox[0] + f.properties.bbox[2]) / 2])
    .sort((a, b) => a[1] - b[1])
    .forEach(([cod], i) => OLEADA.set(cod, i));
}

/* ------------------------------------------------------------------ mapa --- */
/** Dibuja una isla con un camino por municipio. Cada camino va dentro de un
 *  enlace real: así funciona el teclado, el clic central y el "abrir en otra
 *  pestaña" sin escribir una línea de JavaScript para ello. */
function dibujarIsla(nombre, ancho) {
  const rasgos = GEO.features.filter((f) => f.properties.isla === nombre);
  if (!rasgos.length) return '';

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of rasgos) {
    const [a, b, c, d] = f.properties.bbox;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  const bw = x1 - x0, bh = y1 - y0;
  const alto = Math.max(120, Math.min(Math.round(ancho * bh / bw), 380));
  const m = 6;
  const k = Math.min((ancho - 2 * m) / bw, (alto - 2 * m) / bh);
  // Centrado dentro del panel. La y se invierte: en el mapa crece hacia el
  // norte y en el SVG hacia abajo.
  const dx = (ancho - bw * k) / 2, dy = (alto - bh * k) / 2;
  const px = (x) => (dx + (x - x0) * k).toFixed(1);
  const py = (y) => (dy + (y1 - y) * k).toFixed(1);

  const caminos = rasgos.map((f) => {
    const d = f.geometry.coordinates.map((poli) => poli.map((anillo) =>
      'M' + anillo.map(([x, y]) => `${px(x)},${py(y)}`).join('L') + 'Z').join('')).join('');
    const p = f.properties;
    return `<a href="ficha.html?municipio=${p.codmun}" data-cod="${p.codmun}" `
         + `style="--i:${OLEADA.get(String(p.codmun)) ?? 0}">`
         + `<path d="${d}" id="m${p.codmun}"><title>${esc(p.nombre)}</title></path></a>`;
  }).join('');

  return `<svg viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" `
       + `role="group" aria-label="Municipios de ${esc(nombre)}">${caminos}</svg>`;
}

/** El reparto de la rejilla se decide aquí y no en una media query: es la misma
 *  función la que reparte las columnas y la que dibuja el SVG a esa anchura. */
function colsEfectivas(cols) {
  if (innerWidth <= 620) return 12;
  if (innerWidth <= 940) return cols >= 6 ? 12 : 6;
  return cols;
}

function pintarIslario() {
  const cont = document.getElementById('islario');
  // Si el mapa se redibuja mientras la oleada está en marcha —girar el móvil,
  // por ejemplo—, los municipios nuevos volverían a entrar desde cero. Se corta
  // la animación y se dibujan ya colocados.
  if (yaEntro) document.querySelector('.tapa').classList.remove('entra', 'espera');
  const total = cont.clientWidth || 800;
  const hueco = 16;
  cont.innerHTML = ISLAS.map(({ nombre, cols }) => {
    const n = INDICE.islas[nombre].length;
    const c = colsEfectivas(cols);
    // El ancho útil de un panel: su parte de la rejilla de 12, menos los huecos
    // que le tocan y menos el padding lateral de la tarjeta.
    const ancho = Math.max(120, Math.round((total - hueco * (12 - c) / c) * c / 12) - 34);
    return `<section class="isla ent" style="--cols:${c};--n:${ISLAS.findIndex((x) => x.nombre === nombre)}" data-isla="${esc(nombre)}">
      <h2><span>${esc(nombre)}</span> <em>${n} municipio${n === 1 ? '' : 's'}</em></h2>
      ${dibujarIsla(nombre, ancho)}
    </section>`;
  }).join('');

  cont.querySelectorAll('a[data-cod]').forEach((a) => {
    a.addEventListener('mouseenter', () => mostrarPanel(a.dataset.cod));
    a.addEventListener('focus', () => mostrarPanel(a.dataset.cod));
  });
  aplicarFiltro();
}

/* ----------------------------------------------------------------- panel --- */
function mostrarPanel(cod) {
  const m = POR_COD.get(String(cod));
  if (!m) return;
  if (marcado) marcado.classList.remove('marcado');
  marcado = document.getElementById('m' + m.codmun);
  if (marcado) marcado.classList.add('marcado');

  document.getElementById('panel-nombre').textContent = m.nombre;
  document.getElementById('panel-isla').textContent =
    `${m.isla} · ${nf(m.poblacion)} habitantes`;
  document.getElementById('panel-enlace').href = `ficha.html?municipio=${m.codmun}`;
}

/* --------------------------------------------------------------- listado --- */
function pintarListado() {
  const cont = document.getElementById('listado');
  const q = plano(consulta.trim());
  let hallados = 0;

  cont.innerHTML = ISLAS.map(({ nombre }) => {
    if (filtroIsla && filtroIsla !== nombre) return '';
    const muns = INDICE.municipios
      .filter((m) => m.isla === nombre && (!q || plano(m.nombre).includes(q)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    if (!muns.length) return '';
    hallados += muns.length;
    return `<div class="grupo"><h3>${esc(nombre)}</h3>`
      + muns.map((m) => `<a href="ficha.html?municipio=${m.codmun}">${esc(m.nombre)}</a>`).join('')
      + '</div>';
  }).join('');

  if (!hallados) cont.innerHTML = `<p class="vacio">Ningún municipio se llama así.</p>`;
  document.getElementById('cuenta').textContent =
    hallados === 88 ? 'Los 88 municipios' : `${hallados} municipio${hallados === 1 ? '' : 's'}`;
}

/** Apaga en el mapa lo que queda fuera del filtro, en vez de esconderlo: así se
 *  sigue viendo dónde está el municipio dentro de su isla. */
function aplicarFiltro() {
  const q = plano(consulta.trim());
  document.querySelectorAll('.isla').forEach((sec) => {
    sec.classList.toggle('apagada', Boolean(filtroIsla && filtroIsla !== sec.dataset.isla));
  });
  document.querySelectorAll('a[data-cod]').forEach((a) => {
    const m = POR_COD.get(a.dataset.cod);
    // El filtro por isla ya apaga la isla entera. Aquí solo se apaga lo que no
    // case con el texto buscado: si se aplicaran las dos cosas, las opacidades
    // se multiplicarían (0,34 x 0,25) y el municipio desaparecería.
    a.querySelector('path').style.opacity = (!q || (m && plano(m.nombre).includes(q))) ? '' : '.25';
  });
  pintarListado();
}


/* ---------------------------------------------------------------- entrada -- */
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let yaEntro = false;

/** Arranca la animación cuando la sección entra en pantalla, una sola vez.
 *
 *  Dos cuidados que no son evidentes:
 *
 *  1. El umbral de IntersectionObserver es una fracción del área del propio
 *     elemento. La tapa mide varios miles de píxeles de alto, así que un 0,3
 *     fijo no se alcanza nunca en una pantalla normal y la animación no
 *     arrancaría jamás. Se calcula un umbral que sí sea alcanzable.
 *  2. Dentro de un iframe el observador mide respecto al viewport del iframe,
 *     no al de la web madre: allí la portada está visible desde el primer
 *     momento y la animación arranca al cargar, que es justo lo que se quiere.
 */
function prepararEntrada() {
  const tapa = document.querySelector('.tapa');
  if (!tapa) return;

  const soltar = (animar) => {
    if (yaEntro) return;
    yaEntro = true;
    tapa.classList.remove('espera');
    if (!animar) return;
    tapa.classList.add('entra');
    // Al acabar se retira: si el mapa se redibuja por un cambio de tamaño, los
    // municipios nuevos no repiten la oleada.
    setTimeout(() => tapa.classList.remove('entra'), 1600);
  };

  if (reducido()) { soltar(false); return; }

  const objetivo = tapa.querySelector('.tapa-alto') || tapa;
  const alto = objetivo.getBoundingClientRect().height || 1;
  // El umbral es una fracción del área del elemento observado. La tapa entera
  // mide varios miles de píxeles, así que un 0,3 fijo no se alcanzaría nunca:
  // se observa la cabecera y se acota a un valor alcanzable.
  const umbral = Math.min(0.3, (innerHeight * 0.5) / alto);

  const ob = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    ob.disconnect();
    soltar(true);
  }, { threshold: umbral });
  ob.observe(objetivo);

  /* Red de seguridad, y no es teórica: **con la pestaña en segundo plano el
     navegador no entrega los avisos del IntersectionObserver**. Sin esto, quien
     abriera el enlace en una pestaña de fondo se encontraría la portada en
     blanco hasta ponerla en primer plano. La portada no puede quedarse
     invisible por nada del mundo, así que a los 1,5 s se enseña igualmente: con
     animación si está a la vista y el documento visible, y sin ella si no,
     porque una animación que nadie ve solo sirve para retrasar el contenido. */
  setTimeout(() => {
    if (yaEntro) return;
    ob.disconnect();
    const r = objetivo.getBoundingClientRect();
    soltar(!document.hidden && r.top < innerHeight && r.bottom > 0);
  }, 1500);
}

/* ---------------------------------------------------------------- inicio --- */
function montarIconos() {
  document.querySelectorAll('[data-ico], [data-ico-fin]').forEach((e) => {
    const px = Number(e.dataset.px) || 18;
    if (e.dataset.ico) e.insertAdjacentHTML('afterbegin', icono(e.dataset.ico, px));
    if (e.dataset.icoFin) e.insertAdjacentHTML('beforeend', icono(e.dataset.icoFin, px));
  });
}

let temporizador = null, anchoPrevio = window.innerWidth;
addEventListener('resize', () => {
  if (!GEO || innerWidth === anchoPrevio) return;
  anchoPrevio = innerWidth;
  clearTimeout(temporizador);
  temporizador = setTimeout(pintarIslario, 180);
});

async function iniciar() {
  montarIconos();

  [INDICE, GEO] = await Promise.all([
    fetch('datos/indice.json').then((r) => r.json()),
    fetch('datos/geo/municipios.json').then((r) => r.json()),
  ]);
  INDICE.municipios.forEach((m) => POR_COD.set(String(m.codmun), m));
  ordenarOleada();

  // El porcentaje de Canarias viene de la serie regional que va dentro de cada
  // ficha, así que se lee de una y no se recalcula.
  const uno = await (await fetch(`datos/mun/${INDICE.municipios[0].codmun}.json`)).json();
  const serie = uno.extranjero.canarias;
  let pctCan = null;
  for (let i = serie.length - 1; i >= 0; i--) if (serie[i] != null) { pctCan = serie[i]; break; }

  document.getElementById('tapa-datos').innerHTML = [
    [nf(INDICE.poblacion_canarias), 'Habitantes'],
    ['88', 'Municipios'],
    ['7', 'Islas'],
    [nf(pctCan, 1) + ' %', 'Origen extranjero'],
  ].map(([v, r], i) => `<div class="ent" style="--n:${i}"><b>${v}</b><span>${r}</span></div>`).join('');

  document.getElementById('tapa-anio').textContent =
    `Datos del padrón a 1 de enero de ${INDICE.anio}.`;

  // Chips de isla
  const chips = document.getElementById('chips');
  chips.insertAdjacentHTML('beforeend', ISLAS.map(({ nombre }) =>
    `<button class="chip ent" type="button" aria-pressed="false" data-isla="${esc(nombre)}" style="--n:${ISLAS.findIndex((x) => x.nombre === nombre)}">`
    + `${esc(nombre)} <em>${INDICE.islas[nombre].length}</em></button>`).join(''));
  chips.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    filtroIsla = filtroIsla === b.dataset.isla ? null : b.dataset.isla;
    chips.querySelectorAll('.chip').forEach((o) =>
      o.setAttribute('aria-pressed', String(o.dataset.isla === filtroIsla)));
    aplicarFiltro();
  }));

  const buscar = document.getElementById('buscar');
  buscar.addEventListener('input', () => { consulta = buscar.value; aplicarFiltro(); });

  pintarIslario();
  mostrarPanel(INDICE.municipios.find((m) => m.nombre === 'Santa Cruz de Tenerife').codmun);
  prepararEntrada();
}

// Un enlace antiguo del tipo index.html?municipio=38038 apuntaba a la ficha
// cuando la ficha vivía en la raíz. Se respeta.
const heredado = new URLSearchParams(location.search).get('municipio');
if (heredado) {
  location.replace(`ficha.html?municipio=${encodeURIComponent(heredado)}`);
} else {
  iniciar().catch((e) => {
    document.querySelector('.tapa').classList.remove('espera');
    document.getElementById('islario').innerHTML =
      '<p class="vacio">No se han podido cargar los datos.</p>';
    console.error(e);
  });
}

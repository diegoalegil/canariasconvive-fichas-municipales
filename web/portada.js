/* Portada: el mapa de Canarias, que se acerca a la isla elegida y abre la
   ficha del municipio que se pulse; la banda de Canarias entera, el rótulo de
   cada provincia y, bajo él, una tarjeta por isla con su silueta, que
   despliega la lista de fichas de esa isla: primero la isla entera y, debajo,
   cada municipio. El buscador
   encuentra Canarias, provincias, islas y municipios. El orden de provincias e
   islas es el de indice.json (de oeste a este, lo fija exportar_datos.py). Los
   siete desplegables miden lo mismo (`.isla-menu .desplegable` en estilos.css). */

let INDICE = null, GEO = null;
let abierto = null;          // { disparador, lista } del desplegable visible

/* ------------------------------------------------------------- enlaces --- */
const enlaceFicha = (x) => x.tipo === 'canarias' ? 'ficha.html?canarias'
  : x.tipo === 'provincia' ? `ficha.html?provincia=${x.slug}`
  : x.slug ? `ficha.html?isla=${x.slug}` : `ficha.html?municipio=${x.codmun}`;
/** Lo que dice la opción del buscador debajo del nombre. */
const quEs = (x) => x.tipo === 'canarias' ? 'Todo el archipiélago' : x.tipo === 'provincia' ? 'Toda la provincia' : x.slug ? 'Toda la isla' : esc(x.isla);
const municipiosDe = (isla) => INDICE.municipios
  .filter((m) => m.isla === isla.nombre)
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

/* ------------------------------------------------------------ opciones --- */
/** Una opción de lista; con `prefijo`, lleva id (el buscador la señala con
 *  aria-activedescendant). `conIsla` añade la isla del municipio, o «Toda la
 *  isla» si la opción es una isla. */
function opcion(x, conIsla, prefijo = '') {
  return `<a role="option" tabindex="-1" href="${enlaceFicha(x)}"`
    + (prefijo ? ` id="${prefijo}-${x.slug || x.codmun || x.tipo}" aria-selected="false"` : '') + '>'
    + `<span>${esc(x.nombre)}</span>`
    + (conIsla ? `<em>${quEs(x)}</em>` : '')
    + '</a>';
}

/** La primera opción de cada isla: su ficha entera, destacada. */
function opcionIsla(isla) {
  return `<a role="option" tabindex="-1" class="toda" href="${enlaceFicha(isla)}">`
    + `<span>Toda la isla</span><em>${nf(isla.poblacion)} habitantes</em></a>`;
}

/* ---------------------------------------------------------- desplegables -- */
let cerrandoConEscape = false;   // Escape devuelve el foco al disparador sin reabrir la lista
function cerrar(devolverFoco = false) {
  if (!abierto) return;
  const { disparador, lista } = abierto;
  lista.hidden = true;
  disparador.setAttribute('aria-expanded', 'false');
  desmarcar(disparador, lista);
  abierto = null;
  if (devolverFoco) {
    cerrandoConEscape = true;
    disparador.focus();
    cerrandoConEscape = false;
  }
}

/** Abre la lista bajo su disparador. Si se saliera de la tapa por la derecha
 *  (las tarjetas del extremo) se alinea a la derecha del disparador, y en
 *  cualquier caso queda dentro de la pantalla. */
function abrir(disparador, lista) {
  if (abierto && abierto.lista === lista) return;
  cerrar();
  lista.hidden = false;
  lista.style.left = '0px';
  const caja = lista.getBoundingClientRect();
  const tapa = document.querySelector('.tapa').getBoundingClientRect();
  const padre = disparador.parentElement.getBoundingClientRect();
  let izquierda = caja.right > tapa.right - 12 ? padre.width - caja.width : 0;
  izquierda = acotar(izquierda, 12 - padre.left, document.documentElement.clientWidth - 12 - caja.width - padre.left);
  lista.style.left = `${Math.round(izquierda)}px`;
  lista.scrollTop = 0;
  disparador.setAttribute('aria-expanded', 'true');
  abierto = { disparador, lista };
  // Safari no da el foco a un botón al pulsarlo con el ratón, y sin foco no llegan las teclas.
  if (!disparador.contains(document.activeElement) && !lista.contains(document.activeElement)) disparador.focus();
}

addEventListener('resize', () => { if (abierto) cerrar(abierto.lista.contains(document.activeElement)); });

/** Posición de destino en una lista: un paso arriba o abajo desde `i`, o 'inicio' / 'fin'. */
function destino(n, i, paso) {
  return paso === 'inicio' ? 0 : paso === 'fin' ? n - 1
    : i < 0 ? (paso > 0 ? 0 : n - 1)
    : Math.min(n - 1, Math.max(0, i + paso));
}

/** Listas de isla: el foco real recorre las opciones. */
function mover(lista, paso) {
  const ops = [...lista.querySelectorAll('a')];
  if (ops.length) ops[destino(ops.length, ops.indexOf(document.activeElement), paso)].focus();
}

/** Buscador (patrón combobox): el foco se queda en el campo y la opción activa
 *  se señala con aria-activedescendant y aria-selected. */
function moverActivo(campo, lista, paso) {
  const ops = [...lista.querySelectorAll('a')];
  if (!ops.length) return;
  const j = destino(ops.length, ops.findIndex((o) => o.id === campo.getAttribute('aria-activedescendant')), paso);
  ops.forEach((o, k) => { o.classList.toggle('activa', k === j); o.setAttribute('aria-selected', String(k === j)); });
  campo.setAttribute('aria-activedescendant', ops[j].id);
  ops[j].scrollIntoView({ block: 'nearest' });
}

function desmarcar(campo, lista) {
  campo.removeAttribute('aria-activedescendant');
  lista.querySelectorAll('a.activa').forEach((o) => { o.classList.remove('activa'); o.setAttribute('aria-selected', 'false'); });
}

/** Teclado común a los desplegables; `mueve(paso)` recorre la lista a su manera. */
function teclas(e, disparador, lista, alAbrir, mueve) {
  const dentro = lista.contains(document.activeElement);
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      e.preventDefault();
      // El buscador abre su lista al buscar (con algo tecleado); las islas, siempre.
      if (lista.hidden) { if (alAbrir) alAbrir(); else abrir(disparador, lista); }
      if (lista.hidden) return;
      mueve(e.key === 'ArrowDown' ? 1 : -1);
      break;
    case 'Home':
    case 'End':
      if (lista.hidden) return;
      e.preventDefault();
      mueve(e.key === 'Home' ? 'inicio' : 'fin');
      break;
    case 'Escape':
      if (lista.hidden) return;
      e.preventDefault();
      cerrar(true);
      break;
    case 'Tab':
      if (dentro || document.activeElement === disparador) cerrar();
      break;
  }
}

/* ------------------------------------------------------------- por isla --- */
/** La silueta de la isla: sus términos municipales fundidos en un trazado. */
function siluetaIsla(isla, w, h) {
  return silueta(GEO.features.filter((f) => f.properties.isla === isla.nombre), w, h);
}
/** La silueta de unos rasgos del mapa (una isla, el archipiélago), fundidos en un trazado. */
function silueta(suyos, w, h) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of suyos) {
    const [a, b, c, d] = f.properties.bbox;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  const s = Math.min((w - 2) / (x1 - x0), (h - 2) / (y1 - y0));
  const ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  const P = (c) => `${((c[0] - x0) * s + ox).toFixed(1)},${((y1 - c[1]) * s + oy).toFixed(1)}`;
  const d = suyos.map((f) => f.geometry.coordinates
    .map((pol) => pol.map((an) => 'M' + an.map(P).join('L') + 'Z').join('')).join('')).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

function montarIslas() {
  const cont = document.getElementById('islas');
  // Canarias entera, arriba, sin cifras (las de la cabecera ya son las suyas);
  // el rótulo de cada provincia lleva a su ficha y encabeza sus islas (el
  // orden de indice.json las deja contiguas).
  const banda = document.getElementById('banda-canarias');
  banda.innerHTML = `<span class="canarias-silueta">${silueta(GEO.features, 120, 40)}</span>`
    + `<b>Canarias</b><em>Ver la ficha ${icono('desplegar', 14, 'ico galon')}</em>`;
  cont.innerHTML = INDICE.provincias.map((p, n) => `
    <a class="provincia-cab ent" style="--n:${n}" href="${enlaceFicha({ tipo: 'provincia', slug: p.slug })}">
      <b>${esc(p.nombre)}</b><span>${p.islas.length} islas · ${nf(p.poblacion)} habitantes</span>${icono('desplegar', 14, 'ico galon')}
    </a>`).join('') + INDICE.islas_resumen.map((isla, n) => `
    <div class="isla-menu ent" style="--n:${n}">
      <button class="isla-tarjeta" type="button" aria-haspopup="listbox"
              aria-expanded="false" aria-controls="isla-${isla.slug}">
        <span class="isla-silueta">${siluetaIsla(isla, 96, 64)}</span>
        <span class="isla-nombre">${esc(isla.nombre)}</span>
        <span class="isla-cuenta">${isla.municipios} municipios</span>
        ${icono('desplegar', 14, 'ico galon')}
      </button>
      <div class="desplegable" id="isla-${isla.slug}" role="listbox"
           aria-label="Fichas de ${esc(isla.nombre)}" hidden>${opcionIsla(isla)}${municipiosDe(isla).map((m) => opcion(m, false)).join('')}</div>
    </div>`).join('');

  cont.querySelectorAll('.isla-menu').forEach((menu) => {
    const boton = menu.querySelector('.isla-tarjeta');
    const lista = menu.querySelector('.desplegable');
    boton.addEventListener('click', () => {
      if (abierto && abierto.lista === lista) cerrar(); else abrir(boton, lista);
    });
    menu.addEventListener('keydown', (e) => teclas(e, boton, lista, null, (paso) => mover(lista, paso)));
  });
}

/* -------------------------------------------------------------- el mapa --- */
/* Canarias con sus 88 términos municipales y, al lado, un panel con el
   territorio señalado y el enlace a su ficha. Pulsar una isla acerca el mapa
   hasta ella, con sus municipios (las demás quedan atenuadas y pulsarlas
   cambia de isla); pulsar un municipio abre su ficha (con el dedo, el primer
   toque lo presenta en el panel y el segundo la abre). «Toda Canarias» y
   Escape vuelven al archipiélago. Con el teclado, el mapa se enfoca y las
   flechas recorren las islas o los municipios: Enter acerca o abre. Las
   coordenadas UTM se proyectan a mil unidades de ancho y el acercamiento
   anima el viewBox. */
const ANCHO_MAPA = 1000;
const MAPA = { svg: null, cajas: {}, todo: null, vista: null, raf: 0, isla: null, senalado: null, tocado: null, teclado: null, puntero: null, hasta: 0, vuelta: 0 };

const municipioDe = (codmun) => INDICE.municipios.find((m) => String(m.codmun) === String(codmun));
const islaDe = (nombre) => INDICE.islas_resumen.find((i) => i.nombre === nombre);
const provinciaDeIsla = (isla) => INDICE.provincias.find((p) => p.islas.includes(isla.slug));
const tactil = () => matchMedia('(hover: none)').matches;

/** Lo que el panel dice de un territorio: Canarias (null), una isla o un municipio. */
function fichaPanel(t) {
  if (!t) {
    return {
      migas: 'Todo el archipiélago', nombre: 'Canarias',
      datos: `<b>${nf(INDICE.poblacion_canarias)}</b> habitantes · ${INDICE.islas_resumen.length} islas · ${INDICE.municipios.length} municipios`,
      href: enlaceFicha({ tipo: 'canarias' }), boton: 'Ver la ficha de Canarias',
      ayuda: 'Pulsa una isla para acercarte a sus municipios.',
    };
  }
  if (t.slug) {
    const prov = provinciaDeIsla(t);
    return {
      migas: prov ? `Provincia de ${prov.nombre}` : '', nombre: t.nombre,
      datos: `<b>${nf(t.poblacion)}</b> habitantes · ${t.municipios} municipios`,
      href: enlaceFicha(t), boton: 'Ver la ficha de la isla',
      ayuda: MAPA.isla === t.nombre
        ? (tactil() ? 'Toca un municipio para verlo; otro toque abre su ficha.' : 'Pulsa un municipio para abrir su ficha.')
        : 'Pulsa la isla para acercarte a sus municipios.',
    };
  }
  return {
    migas: t.isla, nombre: t.nombre,
    datos: `<b>${nf(t.poblacion)}</b> habitantes`,
    href: enlaceFicha(t), boton: 'Ver la ficha del municipio',
    ayuda: tactil() ? 'Otro toque en el mapa también abre su ficha.' : 'Pulsa el municipio para abrir su ficha.',
  };
}

/** El panel se monta una vez y después se actualiza en su sitio: si se
 *  sustituyera, el enlace que tiene el foco (o al que va el tabulador)
 *  desaparecería y el foco caería al principio de la página. */
function pintarPanel(t) {
  const d = fichaPanel(t);
  const panel = document.getElementById('mapa-panel');
  if (!panel.firstElementChild) {
    panel.innerHTML = `
      <button class="btn btn-liso mapa-volver" type="button" id="mapa-volver" hidden>${icono('desplegar', 14, 'ico galon')}<span>Toda Canarias</span></button>
      <p class="explorar-migas"></p>
      <p class="explorar-nombre"></p>
      <p class="explorar-datos"></p>
      <a class="btn"><span></span>${icono('desplegar', 14, 'ico galon')}</a>
      <p class="explorar-ayuda"></p>`;
  }
  panel.querySelector('.explorar-migas').textContent = d.migas;
  panel.querySelector('.explorar-nombre').textContent = d.nombre;
  panel.querySelector('.explorar-datos').innerHTML = d.datos;
  const a = panel.querySelector('a.btn');
  a.setAttribute('href', d.href);
  a.querySelector('span').textContent = d.boton;
  panel.querySelector('.explorar-ayuda').textContent = d.ayuda;
}

/** El territorio que el panel enseña cuando no se señala nada: el municipio
 *  tocado, la isla de cerca o Canarias. */
function territorioBase() {
  if (MAPA.tocado) return municipioDe(MAPA.tocado);
  return MAPA.isla ? islaDe(MAPA.isla) : null;
}

/** Señala un territorio en el mapa (una isla de lejos o, de cerca, un
 *  municipio de la isla elegida u otra isla) y lo presenta en el panel; con
 *  null, vuelve al territorio base. */
function senalarEnMapa(objetivo) {
  const svg = MAPA.svg;
  svg.querySelectorAll('.senalada, .senalado').forEach((e) => e.classList.remove('senalada', 'senalado'));
  MAPA.senalado = objetivo;
  if (objetivo?.codmun) svg.querySelector(`path[data-codmun="${objetivo.codmun}"]`)?.classList.add('senalado');
  else if (objetivo?.slug) svg.querySelector(`.isla[data-isla="${CSS.escape(objetivo.nombre)}"]`)?.classList.add('senalada');
  if (!objetivo && MAPA.tocado) svg.querySelector(`path[data-codmun="${MAPA.tocado}"]`)?.classList.add('senalado');
  pintarPanel(objetivo || territorioBase());
}

/** Lo que hay bajo el puntero o el dedo: el municipio de la isla elegida o, si
 *  no, la isla. */
function objetivoDe(nodo) {
  const zona = nodo.closest?.('.zona');
  if (zona) return islaDe(zona.parentNode.dataset.isla);
  const trazo = nodo.closest?.('path[data-codmun]');
  if (!trazo) return null;
  const isla = trazo.parentNode.dataset.isla;
  return MAPA.isla === isla ? municipioDe(trazo.dataset.codmun) : islaDe(isla);
}

/** La caja `c` con margen y estirada a la proporción del mapa en pantalla, centrada. */
function encuadre(c, margen) {
  const r = MAPA.svg.clientWidth / MAPA.svg.clientHeight || 2.2;
  let w = c.w * (1 + 2 * margen), h = c.h * (1 + 2 * margen);
  if (w / h < r) w = h * r; else h = w / r;
  return [c.x + c.w / 2 - w / 2, c.y + c.h / 2 - h / 2, w, h];
}
const encuadreActual = () => MAPA.isla ? encuadre(MAPA.cajas[MAPA.isla], 0.1) : encuadre(MAPA.todo, 0.03);
const ponerVista = (vb) => { MAPA.vista = vb; MAPA.svg.setAttribute('viewBox', vb.map((v) => v.toFixed(2)).join(' ')); };

/** Lleva el mapa a la vista de ahora: el ancho cambia en escala logarítmica
 *  (el acercamiento no se precipita al final) y el centro, en línea recta. */
function moverVista(animar) {
  cancelAnimationFrame(MAPA.raf);
  const destino = encuadreActual(), origen = MAPA.vista;
  if (!animar || !origen || !animable()) { ponerVista(destino); return; }
  const centro = (v) => [v[0] + v[2] / 2, v[1] + v[3] / 2];
  const [cx0, cy0] = centro(origen), [cx1, cy1] = centro(destino);
  const r = destino[2] / destino[3], t0 = performance.now(), dur = 720;
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const w = Math.exp(Math.log(origen[2]) + (Math.log(destino[2]) - Math.log(origen[2])) * e), h = w / r;
    const cx = cx0 + (cx1 - cx0) * e, cy = cy0 + (cy1 - cy0) * e;
    ponerVista([cx - w / 2, cy - h / 2, w, h]);
    if (p < 1) MAPA.raf = requestAnimationFrame(paso);
  };
  MAPA.raf = requestAnimationFrame(paso);
}

/** Acerca el mapa a una isla o, con null, vuelve a toda Canarias. */
function irAIsla(nombre) {
  MAPA.isla = nombre;
  MAPA.tocado = null;
  MAPA.teclado = null;
  const mapa = document.getElementById('mapa-portada');
  mapa.classList.toggle('de-cerca', !!nombre);
  MAPA.svg.querySelectorAll('.isla').forEach((g) => g.classList.toggle('elegida', g.dataset.isla === nombre));
  document.getElementById('mapa-volver').hidden = !nombre;
  MAPA.hasta = animable() ? performance.now() + 750 : 0;   // hasta que termina el acercamiento, pulsar no abre fichas
  moverVista(true);
  senalarEnMapa(null);
}

function abrirFicha(t) { location.href = enlaceFicha(t); }

/** Los territorios que recorren las flechas: las islas de oeste a este o los
 *  municipios de la isla elegida por orden alfabético. */
const recorrido = () => MAPA.isla ? municipiosDe(islaDe(MAPA.isla)) : INDICE.islas_resumen;
function anunciar(texto) { document.getElementById('mapa-estado').textContent = texto; }
function textoTerritorio(t) {
  if (t.codmun) return `${t.nombre}: ${nf(t.poblacion)} habitantes. Enter abre su ficha.`;
  return `${t.nombre}: ${nf(t.poblacion)} habitantes, ${t.municipios} municipios. Enter acerca el mapa.`;
}

/** Los rótulos de las islas en el mapa entero, por encima del dibujo (en
 *  píxeles no crecen con el acercamiento): debajo de cada isla y, en
 *  Lanzarote, que tiene Fuerteventura debajo, a su izquierda. */
function colocarRotulos() {
  const vb = encuadre(MAPA.todo, 0.03);
  const pc = (x, y) => [(x - vb[0]) / vb[2] * 100, (y - vb[1]) / vb[3] * 100];
  // Una isla pequeña en una pantalla estrecha mide menos de 24 px: un círculo
  // transparente debajo de su dibujo le da al menos ese objetivo.
  const unidadesPorPx = vb[2] / (MAPA.svg.clientWidth || 1);
  MAPA.svg.querySelectorAll('.zona').forEach((c) => {
    const caja = MAPA.cajas[c.parentNode.dataset.isla];
    c.setAttribute('r', Math.max(Math.hypot(caja.w, caja.h) / 2, 12 * unidadesPorPx).toFixed(2));
  });
  document.getElementById('mapa-rotulos').innerHTML = INDICE.islas_resumen.map((i) => {
    const c = MAPA.cajas[i.nombre];
    const izquierda = i.nombre === 'Lanzarote';
    const [x, y] = izquierda ? pc(c.x - 8, c.y + c.h / 2) : pc(c.x + c.w / 2, c.y + c.h + 6);
    return `<span class="${izquierda ? 'a-la-izquierda' : ''}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%">${esc(i.nombre)}</span>`;
  }).join('');
}

function montarMapa() {
  const mapa = document.getElementById('mapa-portada');
  if (!mapa) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of GEO.features) {
    const [a, b, c, d] = f.properties.bbox;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  const k = ANCHO_MAPA / (x1 - x0);
  const P = (c) => `${((c[0] - x0) * k).toFixed(2)},${((y1 - c[1]) * k).toFixed(2)}`;
  MAPA.todo = { x: 0, y: 0, w: ANCHO_MAPA, h: (y1 - y0) * k };
  const grupos = INDICE.islas_resumen.map((isla) => {
    const suyos = GEO.features.filter((f) => f.properties.isla === isla.nombre);
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const f of suyos) {
      const [p, q, r, s] = f.properties.bbox;
      a = Math.min(a, p); b = Math.min(b, q); c = Math.max(c, r); d = Math.max(d, s);
    }
    MAPA.cajas[isla.nombre] = { x: (a - x0) * k, y: (y1 - d) * k, w: (c - a) * k, h: (d - b) * k };
    const caja = MAPA.cajas[isla.nombre];
    return `<g class="isla" data-isla="${esc(isla.nombre)}"><circle class="zona" cx="${(caja.x + caja.w / 2).toFixed(2)}" cy="${(caja.y + caja.h / 2).toFixed(2)}" r="0"/>`
      + suyos.map((f) => `<path data-codmun="${f.properties.codmun}" d="`
      + f.geometry.coordinates.map((pol) => pol.map((an) => 'M' + an.map(P).join('L') + 'Z').join('')).join('') + '"/>').join('') + '</g>';
  }).join('');
  mapa.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${ANCHO_MAPA} ${MAPA.todo.h.toFixed(2)}" aria-hidden="true" focusable="false">${grupos}</svg>`
    + '<div class="mapa-rotulos" id="mapa-rotulos" aria-hidden="true"></div>');
  MAPA.svg = mapa.querySelector('svg');
  pintarPanel(null);
  ponerVista(encuadreActual());
  colocarRotulos();
  mapa.closest('.explorar').hidden = false;   // sin datos, la sección no sale
  ponerVista(encuadreActual());               // ya con su tamaño
  colocarRotulos();

  const svg = MAPA.svg;
  // Al salir del mapa, el panel vuelve al territorio base con un respiro: quien
  // va hacia su botón llega con el territorio que señalaba.
  const panel = document.getElementById('mapa-panel');
  svg.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(MAPA.vuelta);
    senalarEnMapa(objetivoDe(e.target));
  });
  svg.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') MAPA.vuelta = setTimeout(() => senalarEnMapa(null), 350);
  });
  panel.addEventListener('pointerenter', () => clearTimeout(MAPA.vuelta));
  panel.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') MAPA.vuelta = setTimeout(() => senalarEnMapa(null), 350); });
  // El clic no dice bien si viene del dedo (Safari lo da como «mouse»): lo dice el pointerdown que lo precede.
  svg.addEventListener('pointerdown', (e) => { MAPA.puntero = e.pointerType; });
  svg.addEventListener('click', (e) => {
    const t = objetivoDe(e.target);
    const dedo = (MAPA.puntero || e.pointerType) === 'touch';
    // El doble clic del ratón, gesto de acercar, no abre fichas (con el dedo, el segundo toque sí).
    if (!t || (e.detail > 1 && !dedo)) return;
    if (t.slug) { if (t.nombre !== MAPA.isla) irAIsla(t.nombre); return; }
    if (performance.now() < MAPA.hasta) return;
    // Con el dedo no hay «señalar»: el primer toque presenta el municipio y el segundo abre su ficha.
    if (dedo && MAPA.tocado !== String(t.codmun)) { MAPA.tocado = String(t.codmun); senalarEnMapa(null); return; }
    abrirFicha(t);
  });
  document.getElementById('mapa-volver').addEventListener('click', () => { irAIsla(null); mapa.focus(); });

  mapa.addEventListener('keydown', (e) => {
    if (e.target !== mapa || e.altKey || e.ctrlKey || e.metaKey) return;
    const lista = recorrido();
    let i = lista.indexOf(MAPA.teclado);
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': i = i < 0 ? 0 : (i + 1) % lista.length; break;
      case 'ArrowLeft': case 'ArrowUp': i = i < 0 ? lista.length - 1 : (i - 1 + lista.length) % lista.length; break;
      case 'Home': i = 0; break;
      case 'End': i = lista.length - 1; break;
      case 'Enter': case ' ': {
        e.preventDefault();
        const t = MAPA.teclado;
        if (!t) return;
        if (t.slug) {
          irAIsla(t.nombre);
          anunciar(`${t.nombre}, ${t.municipios} municipios. Flechas para recorrerlos; Escape vuelve a toda Canarias.`);
        } else abrirFicha(t);
        return;
      }
      case 'Escape':
        if (!MAPA.isla) return;
        e.preventDefault();
        irAIsla(null);
        anunciar('Toda Canarias. Flechas para recorrer las islas.');
        return;
      default: return;
    }
    e.preventDefault();
    MAPA.teclado = lista[i];
    senalarEnMapa(lista[i]);
    anunciar(textoTerritorio(lista[i]));
  });
  mapa.addEventListener('blur', () => { if (MAPA.teclado) { MAPA.teclado = null; senalarEnMapa(null); } });
  // Un cambio de tamaño a mitad del acercamiento corta la animación: su destino tenía la proporción vieja.
  addEventListener('resize', () => { cancelAnimationFrame(MAPA.raf); ponerVista(encuadreActual()); colocarRotulos(); });
}

/* ------------------------------------------------------------- buscador --- */
function montarBuscador() {
  const campo = document.getElementById('buscar');
  const lista = document.getElementById('resultados');

  const buscar = () => {
    const q = plano(campo.value.trim());
    desmarcar(campo, lista);
    if (!q) { cerrar(); lista.innerHTML = ''; document.getElementById('buscar-estado').textContent = ''; return; }
    // Los que empiezan por lo tecleado van antes que los que solo lo contienen;
    // dentro de cada grupo, Canarias y las provincias antes que las islas, y
    // las islas antes que los municipios («tene» da Tenerife, la isla, antes
    // que Santa Cruz de Tenerife, la provincia); cada grupo, por orden alfabético.
    const empieza = (x) => plano(x.nombre).startsWith(q);
    const coincide = (x) => plano(x.nombre).includes(q);
    const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
    const ambitos = [{ tipo: 'canarias', nombre: 'Canarias' }, ...INDICE.provincias.map((p) => ({ tipo: 'provincia', slug: p.slug, nombre: p.nombre }))];
    const grupos = [ambitos, INDICE.islas_resumen, INDICE.municipios].map((g) => g.filter(coincide).sort(orden));
    const hallados = [...grupos.flatMap((g) => g.filter(empieza)), ...grupos.flatMap((g) => g.filter((x) => !empieza(x)))];
    lista.innerHTML = hallados.length
      ? hallados.map((x) => opcion(x, true, 'res')).join('')
      : '<div role="option" aria-disabled="true" class="vacio">Ningún territorio se llama así.</div>';
    // Cuántos hay, para el lector de pantalla (la lista abierta no lo dice).
    document.getElementById('buscar-estado').textContent = hallados.length
      ? `${hallados.length} ${hallados.length === 1 ? 'territorio encontrado' : 'territorios encontrados'}` : 'Ningún territorio se llama así.';
    abrir(campo, lista);
  };

  campo.addEventListener('input', buscar);
  // Al volver al campo con texto se reabre la lista, salvo cuando es Escape quien devuelve el foco.
  campo.addEventListener('focus', () => { if (campo.value.trim() && !cerrandoConEscape) buscar(); });
  campo.parentElement.addEventListener('keydown', (e) => teclas(e, campo, lista, buscar, (paso) => moverActivo(campo, lista, paso)));
  // Enter abre la opción activa o, sin haber bajado, la primera de la lista.
  campo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || lista.hidden) return;   // cerrada con Escape, Enter no salta a nada
    const elegida = lista.querySelector('a.activa') || lista.querySelector('a');
    if (elegida) { e.preventDefault(); elegida.click(); }
  });
}

/* -------------------------------------------------------------- entrada --- */
let yaEntro = false;

/** Arranca la animación cuando la portada entra en pantalla, una sola vez. */
function prepararEntrada() {
  const tapa = document.querySelector('.tapa');
  if (!tapa) return;

  const soltar = (animar) => {
    if (yaEntro) return;
    yaEntro = true;
    tapa.classList.remove('espera');
    if (!animar) return;
    tapa.classList.add('entra');
    setTimeout(() => tapa.classList.remove('entra'), 1600);
  };

  if (reducido()) { soltar(false); return; }

  const objetivo = tapa.querySelector('.tapa-alto') || tapa;
  const alto = objetivo.getBoundingClientRect().height || 1;
  const umbral = Math.min(0.3, (innerHeight * 0.5) / alto);

  const ob = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    ob.disconnect();
    soltar(true);
  }, { threshold: umbral });
  ob.observe(objetivo);

  // Con la pestaña en segundo plano el IntersectionObserver no avisa: red de seguridad.
  setTimeout(() => {
    if (yaEntro) return;
    ob.disconnect();
    const r = objetivo.getBoundingClientRect();
    soltar(!document.hidden && r.top < innerHeight && r.bottom > 0);
  }, 1500);
}

/* --------------------------------------------------------------- inicio --- */
function montarIconos() {
  document.querySelectorAll('[data-ico]').forEach((e) => {
    if (e.querySelector('svg')) return;
    e.insertAdjacentHTML('afterbegin', icono(e.dataset.ico, e.classList.contains('btn') ? 15 : 17));
  });
}

async function iniciar() {
  montarIconos();

  [INDICE, GEO] = await Promise.all([
    leerJSON('datos/indice.json'),
    leerJSON('datos/geo/municipios.json'),
  ]);

  document.getElementById('tapa-datos').innerHTML = [
    [nf(INDICE.poblacion_canarias), 'Habitantes'],
    [String(INDICE.municipios.length), 'Municipios'],
    [String(INDICE.islas_resumen.length), 'Islas'],
    [pct(INDICE.extranjero_canarias, 1), 'Origen extranjero'],
  ].map(([v, r], i) => `<div class="ent" style="--n:${i}"><b>${v}</b><span>${r}</span></div>`).join('');

  montarMapa();
  montarIslas();
  montarBuscador();

  // Un clic fuera cierra lo que hubiera abierto.
  addEventListener('pointerdown', (e) => {
    if (abierto && !abierto.lista.contains(e.target)
        && !abierto.disparador.parentElement.contains(e.target)) cerrar();
  });

  prepararEntrada();
}

// Los enlaces antiguos index.html?municipio=38038 siguen llevando a la ficha.
const heredado = new URLSearchParams(location.search).get('municipio');
if (heredado) {
  location.replace(`ficha.html?municipio=${encodeURIComponent(heredado)}`);
} else {
  iniciar().catch((e) => {
    document.querySelector('.tapa').classList.remove('espera');
    document.getElementById('buscar').disabled = true;   // sin datos no hay nada que buscar
    avisoCarga('estado-portada', 'No se han podido cargar los datos.', () => location.reload());
    console.error(e);
  });
}

/* Portada: el mapa de las siete islas, una pestaña por isla y el buscador. Al
   elegir una isla, el panel ofrece primero su ficha entera y debajo la de cada
   municipio. El orden de las islas es el de indice.json (de oeste a este, lo
   fija exportar_datos.py). */

let INDICE = null, GEO = null;
let abierto = null;          // { disparador, lista } del desplegable visible (el buscador)
let ISLA = null;             // slug de la isla elegida

/* ------------------------------------------------------------- enlaces --- */
const enlaceFicha = (x) => x.slug ? `ficha.html?isla=${x.slug}` : `ficha.html?municipio=${x.codmun}`;
const islaDe = (slug) => INDICE.islas_resumen.find((i) => i.slug === slug);
const municipiosDe = (isla) => INDICE.municipios
  .filter((m) => m.isla === isla.nombre)
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

/* ----------------------------------------------------------- buscador ----- */
/** Las opciones del buscador: islas y municipios; con `prefijo`, cada una
 *  lleva id (el campo las señala con aria-activedescendant). */
function opciones(items, prefijo = '') {
  if (!items.length) return '<div role="option" aria-disabled="true" class="vacio">Ninguna isla ni municipio se llama así.</div>';
  return items.map((x) =>
    `<a role="option" tabindex="-1" href="${enlaceFicha(x)}"`
    + (prefijo ? ` id="${prefijo}-${x.slug || x.codmun}" aria-selected="false"` : '') + '>'
    + `<span>${esc(x.nombre)}</span><em>${x.slug ? 'Toda la isla' : esc(x.isla)}</em></a>`).join('');
}

let cerrandoConEscape = false;   // Escape devuelve el foco al campo sin reabrir la lista
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

function abrir(disparador, lista) {
  if (abierto && abierto.lista === lista) return;
  cerrar();
  lista.hidden = false;
  lista.style.left = '0px';
  const caja = lista.getBoundingClientRect();
  const desplazamiento = acotar(0, 12 - caja.left, document.documentElement.clientWidth - 12 - caja.right);
  lista.style.left = `${desplazamiento}px`;
  lista.scrollTop = 0;
  disparador.setAttribute('aria-expanded', 'true');
  abierto = { disparador, lista };
}

addEventListener('resize', () => { if (abierto) cerrar(abierto.lista.contains(document.activeElement)); });

/** Posición de destino en una lista: un paso arriba o abajo desde `i`, o 'inicio' / 'fin'. */
function destino(n, i, paso) {
  return paso === 'inicio' ? 0 : paso === 'fin' ? n - 1
    : i < 0 ? (paso > 0 ? 0 : n - 1)
    : Math.min(n - 1, Math.max(0, i + paso));
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

/** Teclado del buscador; `mueve(paso)` recorre la lista. */
function teclas(e, disparador, lista, alAbrir, mueve) {
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      e.preventDefault();
      if (lista.hidden) { if (alAbrir) alAbrir(); abrir(disparador, lista); }
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
      if (lista.contains(document.activeElement) || document.activeElement === disparador) cerrar();
      break;
  }
}

function montarBuscador() {
  const campo = document.getElementById('buscar');
  const lista = document.getElementById('resultados');

  const buscar = () => {
    const q = plano(campo.value.trim());
    desmarcar(campo, lista);
    if (!q) { cerrar(); lista.innerHTML = ''; return; }
    // Primero los que empiezan por lo tecleado; las islas, antes que los municipios.
    const orden = (a, b) => {
      const ea = plano(a.nombre).startsWith(q), eb = plano(b.nombre).startsWith(q);
      if (ea !== eb) return ea ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, 'es');
    };
    const coincide = (x) => plano(x.nombre).includes(q);
    const hallados = [...INDICE.islas_resumen.filter(coincide).sort(orden), ...INDICE.municipios.filter(coincide).sort(orden)];
    lista.innerHTML = opciones(hallados, 'res');
    abrir(campo, lista);
  };

  campo.addEventListener('input', buscar);
  // Al volver al campo con texto se reabre la lista, salvo cuando es Escape quien devuelve el foco.
  campo.addEventListener('focus', () => { if (campo.value.trim() && !cerrandoConEscape) buscar(); });
  campo.parentElement.addEventListener('keydown', (e) => teclas(e, campo, lista, buscar, (paso) => moverActivo(campo, lista, paso)));
  // Enter abre la opción activa o, sin haber bajado, la primera de la lista.
  campo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const elegida = lista.querySelector('a.activa') || lista.querySelector('a');
    if (elegida) { e.preventDefault(); elegida.click(); }
  });
}

/* ----------------------------------------------------------------- mapa --- */
/* Las siete islas sobre el ancho de la tapa: los términos municipales de cada
   isla en un solo trazado, con el contorno del color del relleno para que se
   fundan. El rótulo va dentro de la isla y, en las que no lo abarcan, debajo. */
const AZUL = '#185FA5', AZUL_CLARO = '#85B7EB';

function mapaIslas(w) {
  const rasgos = GEO.features;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of rasgos) {
    const [a, b, c, d] = f.properties.bbox;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  const pad = 10, estrecho = w < 600;
  const fe = estrecho ? 0 : w < 900 ? 11.5 : 13;   // 0: sin rótulos (las pestañas los llevan)
  const s = (w - 2 * pad) / (x1 - x0);
  const h = Math.round((y1 - y0) * s + 2 * pad + (fe ? 22 : 0));   // sitio para los rótulos de abajo
  const P = (c) => `${((c[0] - x0) * s + pad).toFixed(1)},${((y1 - c[1]) * s + pad).toFixed(1)}`;

  const grupos = INDICE.islas_resumen.map((isla) => {
    const suyos = rasgos.filter((f) => f.properties.isla === isla.nombre);
    const d = suyos.map((f) => f.geometry.coordinates
      .map((pol) => pol.map((an) => 'M' + an.map(P).join('L') + 'Z').join('')).join('')).join('');
    // El rótulo se apoya en el cuerpo de la isla (el centro de gravedad de todos
    // sus anillos), no en el centro de su caja: en Lanzarote los islotes del
    // norte la estiran y el centro cae en el mar. Cabe dentro si el cuerpo
    // abarca el texto con holgura; si no, va debajo de la caja.
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    let sx = 0, sy = 0, sa = 0;
    for (const f of suyos) {
      const [a, b, c, e] = f.properties.bbox;
      bx0 = Math.min(bx0, a); by0 = Math.min(by0, b); bx1 = Math.max(bx1, c); by1 = Math.max(by1, e);
      for (const pol of f.geometry.coordinates) {
        const an = pol[0];
        let area = 0, cx = 0, cy = 0;
        for (let k = 0; k < an.length - 1; k++) {
          const cruz = an[k][0] * an[k + 1][1] - an[k + 1][0] * an[k][1];
          area += cruz; cx += (an[k][0] + an[k + 1][0]) * cruz; cy += (an[k][1] + an[k + 1][1]) * cruz;
        }
        if (area) { sx += cx / 3; sy += cy / 3; sa += area; }
      }
    }
    const gx = sa ? sx / sa : (bx0 + bx1) / 2, gy = sa ? sy / sa : (by0 + by1) / 2;
    const cx = (gx - x0) * s + pad, cy = (y1 - gy) * s + pad;
    const ancho = (bx1 - bx0) * s, alto = (by1 - by0) * s;
    const largo = isla.nombre.length * fe * 0.62;
    const dentro = ancho > largo * 1.6 && alto > fe * 3.5;
    const rotulo = fe ? `<text x="${cx.toFixed(1)}" y="${(dentro ? cy + fe * 0.36 : (y1 - by0) * s + pad + fe + 4).toFixed(1)}" `
      + `text-anchor="middle" font-size="${fe}">${esc(isla.nombre)}</text>` : '';
    return `<g class="isla-mapa" data-isla="${isla.slug}"><path d="${d}"/>${rotulo}</g>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" aria-hidden="true" focusable="false">${grupos.join('')}</svg>`;
}

function montarMapa() {
  const cont = document.getElementById('mapa-islas');
  const w = Math.max(280, Math.floor(cont.clientWidth));
  cont.innerHTML = mapaIslas(w);
  cont.querySelectorAll('.isla-mapa').forEach((g) => {
    g.addEventListener('click', () => elegirIsla(g.dataset.isla, true));
  });
  if (ISLA) cont.querySelector(`.isla-mapa[data-isla="${ISLA}"]`)?.classList.add('activa');
}

let temporizador = null, anchoPrevio = window.innerWidth;
addEventListener('resize', () => {
  if (!GEO || innerWidth === anchoPrevio) return;
  anchoPrevio = innerWidth;
  clearTimeout(temporizador);
  temporizador = setTimeout(montarMapa, 180);
});

/* ------------------------------------------------------------- pestañas --- */
/* Una pestaña por isla (patrón tabs, activación automática con las flechas).
   El mapa es la misma elección para el ratón y el dedo; el teclado y el lector
   de pantalla van por aquí. */
function montarPestanas() {
  const cont = document.getElementById('islas');
  cont.innerHTML = INDICE.islas_resumen.map((isla, n) => `
    <button class="pestana" type="button" role="tab" id="tab-${isla.slug}" data-isla="${isla.slug}"
            aria-selected="false" aria-controls="panel-isla" tabindex="${n ? -1 : 0}" style="--n:${n}">
      <span>${esc(isla.nombre)}</span><em>${isla.municipios}</em>
    </button>`).join('');
  const tabs = [...cont.querySelectorAll('[role="tab"]')];
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => elegirIsla(t.dataset.isla));
    t.addEventListener('pointerenter', () => resaltar(t.dataset.isla, true));
    t.addEventListener('pointerleave', () => resaltar(t.dataset.isla, false));
    t.addEventListener('keydown', (e) => {
      const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'inicio', End: 'fin' }[e.key];
      if (paso === undefined) return;
      e.preventDefault();
      const j = destino(tabs.length, i, paso);
      tabs[j].focus();
      elegirIsla(tabs[j].dataset.isla);
    });
  });
}

function resaltar(slug, si) {
  document.querySelector(`.isla-mapa[data-isla="${slug}"]`)?.classList.toggle('resalta', si);
}

/* ---------------------------------------------------------------- panel --- */
/** La silueta de la isla sola, para el enlace a su ficha. */
function siluetaIsla(isla, w = 56, h = 44) {
  const suyos = GEO.features.filter((f) => f.properties.isla === isla.nombre);
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
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}"/></svg>`;
}

/** Elige una isla: pestaña, mapa y panel. Con `enfocar`, el foco pasa a su pestaña. */
function elegirIsla(slug, enfocar = false) {
  const isla = islaDe(slug);
  if (!isla) return;
  ISLA = slug;
  document.querySelectorAll('.isla-mapa').forEach((g) => g.classList.toggle('activa', g.dataset.isla === slug));
  document.querySelectorAll('[role="tab"]').forEach((t) => {
    const activa = t.dataset.isla === slug;
    t.setAttribute('aria-selected', String(activa));
    t.tabIndex = activa ? 0 : -1;
    if (activa && enfocar) t.focus();
  });
  const panel = document.getElementById('panel-isla');
  panel.setAttribute('aria-labelledby', `tab-${slug}`);
  const muns = municipiosDe(isla);
  panel.innerHTML = `
    <a class="isla-entera ent" href="${enlaceFicha(isla)}">
      <span class="isla-icono">${siluetaIsla(isla)}</span>
      <span class="isla-texto"><b>${esc(isla.nombre)}</b>
        <em>Toda la isla · ${nf(isla.poblacion)} habitantes · ${isla.municipios} municipios</em></span>
      <span class="isla-ir">Ver la ficha de la isla</span>
    </a>
    <ul class="panel-muns" aria-label="Municipios de ${esc(isla.nombre)}">
      ${muns.map((m, k) => `<li class="ent" style="--n:${k}"><a href="${enlaceFicha(m)}">${esc(m.nombre)}</a></li>`).join('')}
    </ul>`;
  panel.classList.remove('entra');
  void panel.offsetWidth;   // reinicia la animación de entrada del panel
  panel.classList.add('entra');
  history.replaceState(null, '', `#${slug}`);
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
    [nf(INDICE.extranjero_canarias, 1) + ' %', 'Origen extranjero'],
  ].map(([v, r], i) => `<div class="ent" style="--n:${i}"><b>${v}</b><span>${r}</span></div>`).join('');

  montarPestanas();
  montarMapa();
  montarBuscador();
  // Un enlace con #tenerife abre la portada con esa isla elegida, también si
  // cambia el fragmento con la portada ya abierta.
  const porFragmento = () => { const slug = location.hash.slice(1); if (islaDe(slug) && slug !== ISLA) elegirIsla(slug); };
  porFragmento();
  addEventListener('hashchange', porFragmento);

  // Un clic fuera cierra el buscador si estaba abierto.
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

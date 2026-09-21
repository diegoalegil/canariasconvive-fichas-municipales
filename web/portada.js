/* Portada: la banda de Canarias entera, el rótulo de cada provincia y, bajo
   él, una tarjeta por isla con su silueta, que despliega la lista de fichas de
   esa isla: primero la isla entera y, debajo, cada municipio. El buscador
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

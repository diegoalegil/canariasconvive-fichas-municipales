/* Portada: buscador por nombre y un desplegable por isla, en el orden de
   indice.json (de oeste a este, lo fija exportar_datos.py). Los siete
   desplegables miden lo mismo (`.isla-menu .desplegable` en estilos.css). */

let INDICE = null;
let abierto = null;          // { disparador, lista } del desplegable visible

/* ---------------------------------------------------------- desplegables -- */
/** Las opciones de una lista; con `prefijo`, cada una lleva id (el buscador
 *  las señala con aria-activedescendant). */
function opciones(muns, conIsla, prefijo = '') {
  if (!muns.length) return '<div role="option" aria-disabled="true" class="vacio">Ningún municipio se llama así.</div>';
  return muns.map((m) =>
    `<a role="option" tabindex="-1" href="ficha.html?municipio=${m.codmun}"`
    + (prefijo ? ` id="${prefijo}-${m.codmun}" aria-selected="false"` : '') + '>'
    + `<span>${esc(m.nombre)}</span>`
    + (conIsla ? `<em>${esc(m.isla)}</em>` : '')
    + `</a>`).join('');
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

/** Teclado común a los dos desplegables; `mueve(paso)` recorre la lista a su manera. */
function teclas(e, disparador, lista, alAbrir, mueve) {
  const dentro = lista.contains(document.activeElement);
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
      if (dentro || document.activeElement === disparador) cerrar();
      break;
  }
}

/* ------------------------------------------------------------- por isla --- */
function montarIslas() {
  const cont = document.getElementById('islas');

  cont.insertAdjacentHTML('beforeend', Object.keys(INDICE.islas).map((isla, n) => {
    const muns = INDICE.municipios
      .filter((m) => m.isla === isla)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return `<div class="isla-menu ent" style="--n:${n}">
      <button class="chip" type="button" aria-haspopup="listbox"
              aria-expanded="false" aria-controls="isla-${n}">
        <span>${esc(isla)}</span><em>${muns.length}</em>${icono('desplegar', 14, 'ico galon')}
      </button>
      <div class="desplegable" id="isla-${n}" role="listbox"
           aria-label="Municipios de ${esc(isla)}" hidden>${opciones(muns, false)}</div>
    </div>`;
  }).join(''));

  cont.querySelectorAll('.isla-menu').forEach((menu) => {
    const chip = menu.querySelector('.chip');
    const lista = menu.querySelector('.desplegable');
    chip.addEventListener('click', () => {
      if (abierto && abierto.lista === lista) cerrar(); else abrir(chip, lista);
    });
    menu.addEventListener('keydown', (e) => teclas(e, chip, lista, null, (paso) => mover(lista, paso)));
  });
}

/* ------------------------------------------------------------- buscador --- */
function montarBuscador() {
  const campo = document.getElementById('buscar');
  const lista = document.getElementById('resultados');

  const buscar = () => {
    const q = plano(campo.value.trim());
    desmarcar(campo, lista);
    if (!q) { cerrar(); lista.innerHTML = ''; return; }
    const hallados = INDICE.municipios
      .filter((m) => plano(m.nombre).includes(q))
      .sort((a, b) => {
        // Primero los que empiezan por lo tecleado.
        const ea = plano(a.nombre).startsWith(q), eb = plano(b.nombre).startsWith(q);
        if (ea !== eb) return ea ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
    lista.innerHTML = opciones(hallados, true, 'res');
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

  INDICE = await leerJSON('datos/indice.json');

  // El porcentaje de Canarias va en la serie regional de cada ficha: se lee de una.
  const uno = await leerJSON(`datos/mun/${INDICE.municipios[0].codmun}.json`);
  const pctCan = ultimoValido(uno.extranjero.canarias);

  document.getElementById('tapa-datos').innerHTML = [
    [nf(INDICE.poblacion_canarias), 'Habitantes'],
    ['88', 'Municipios'],
    ['7', 'Islas'],
    [nf(pctCan, 1) + '\u00a0%', 'Origen extranjero'],
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

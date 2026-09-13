/* =============================================================================
   PORTADA · CANARIAS CONVIVE

   Dos maneras de llegar a una ficha, y solo dos: escribir el nombre, o abrir la
   isla y elegir de la lista. Antes había tres —el buscador, un mapa con los 88
   municipios dibujados y un listado alfabético completo debajo— y el mapa era
   la peor de las tres: para pinchar un municipio de Tenerife había que acertar
   en una figura de pocos píxeles, y hacía falta un recuadro al lado explicando
   cómo leerlo. Cuando un control necesita instrucciones, sobra el control.

   Las siete listas miden lo mismo aunque El Hierro tenga tres municipios y
   Tenerife treinta y uno: la caja no cambia de tamaño al pasar de una isla a
   otra, y la que no cabe se desplaza por dentro.
   ============================================================================= */

/* De oeste a este, que es como se nombran las islas aquí. */
const ISLAS = ['El Hierro', 'La Gomera', 'La Palma', 'Tenerife',
               'Gran Canaria', 'Fuerteventura', 'Lanzarote'];


let INDICE = null;
let abierto = null;          // { disparador, lista } del desplegable visible

/* ---------------------------------------------------------- desplegables -- */
function opciones(muns, conIsla) {
  if (!muns.length) return '<p class="vacio">Ningún municipio se llama así.</p>';
  return muns.map((m) =>
    `<a role="option" tabindex="-1" href="ficha.html?municipio=${m.codmun}">`
    + `<span>${esc(m.nombre)}</span>`
    + (conIsla ? `<em>${esc(m.isla)}</em>` : '')
    + `</a>`).join('');
}

function cerrar(devolverFoco = false) {
  if (!abierto) return;
  const { disparador, lista } = abierto;
  lista.hidden = true;
  disparador.setAttribute('aria-expanded', 'false');
  abierto = null;
  if (devolverFoco) disparador.focus();
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

/** Arriba y abajo recorren la lista; desde el disparador, la primera flecha
 *  entra en ella. Es lo que se espera de algo que se despliega. */
addEventListener('resize', () => { if (abierto) cerrar(abierto.lista.contains(document.activeElement)); });

function mover(lista, paso) {
  const ops = [...lista.querySelectorAll('a')];
  if (!ops.length) return;
  const i = ops.indexOf(document.activeElement);
  const j = i < 0
    ? (paso > 0 ? 0 : ops.length - 1)
    : Math.min(ops.length - 1, Math.max(0, i + paso));
  ops[j].focus();
}

/** Teclado común a los dos desplegables. */
function teclas(e, disparador, lista, alAbrir) {
  const dentro = lista.contains(document.activeElement);
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      e.preventDefault();
      if (lista.hidden) { if (alAbrir) alAbrir(); abrir(disparador, lista); }
      mover(lista, e.key === 'ArrowDown' ? 1 : -1);
      break;
    case 'Home':
    case 'End':
      if (lista.hidden) return;
      e.preventDefault();
      mover(lista, e.key === 'Home' ? -999 : 999);
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

  cont.insertAdjacentHTML('beforeend', ISLAS.map((isla, n) => {
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
    menu.addEventListener('keydown', (e) => teclas(e, chip, lista));
  });
}

/* ------------------------------------------------------------- buscador --- */
function montarBuscador() {
  const campo = document.getElementById('buscar');
  const lista = document.getElementById('resultados');

  const buscar = () => {
    const q = plano(campo.value.trim());
    if (!q) { cerrar(); lista.innerHTML = ''; return; }
    const hallados = INDICE.municipios
      .filter((m) => plano(m.nombre).includes(q))
      .sort((a, b) => {
        // Primero los que empiezan por lo tecleado: quien escribe "san" busca
        // San Andrés antes que Alajeró de San Sebastián.
        const ea = plano(a.nombre).startsWith(q), eb = plano(b.nombre).startsWith(q);
        if (ea !== eb) return ea ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, 'es');
      });
    lista.innerHTML = opciones(hallados, true);
    abrir(campo, lista);
  };

  campo.addEventListener('input', buscar);
  campo.addEventListener('focus', () => { if (campo.value.trim()) buscar(); });
  campo.parentElement.addEventListener('keydown', (e) => teclas(e, campo, lista, buscar));
  // Enter sobre el campo abre el primero de la lista, sin tener que bajar.
  campo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const primero = lista.querySelector('a');
    if (primero) { e.preventDefault(); primero.click(); }
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

  /* Red de seguridad: con la pestaña en segundo plano el navegador no entrega
     los avisos del IntersectionObserver, y la portada se quedaría en blanco
     hasta que alguien volviera a ella. */
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

  INDICE = await (await fetch('datos/indice.json')).json();

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
    [nf(pctCan, 1) + '\u00a0%', 'Origen extranjero'],
  ].map(([v, r], i) => `<div class="ent" style="--n:${i}"><b>${v}</b><span>${r}</span></div>`).join('');

  document.getElementById('tapa-anio').textContent =
    `Datos del padrón a 1 de enero de ${INDICE.anio}.`;

  montarIslas();
  montarBuscador();

  // Un clic fuera cierra lo que hubiera abierto.
  addEventListener('pointerdown', (e) => {
    if (abierto && !abierto.lista.contains(e.target)
        && !abierto.disparador.parentElement.contains(e.target)) cerrar();
  });

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
    document.getElementById('islas').insertAdjacentHTML('beforeend',
      '<p class="vacio">No se han podido cargar los datos.</p>');
    console.error(e);
  });
}

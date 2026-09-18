/* Ayudantes comunes a todas las páginas. Se carga antes que cualquier otro script. */

/* Enmarcada en un sitio que no sea la propia web ni los de sitio.json
   (ORIGENES_IFRAME, config.js), la página se sustituye por un aviso con el
   camino a la web. Si no se puede saber quién la enmarca, no se bloquea.
   Enmarcada en un sitio permitido, la página le dice su alto cada vez que
   cambia, para que el marco crezca con ella y no tenga barra de
   desplazamiento propia (el WordPress escucha el mensaje; README,
   «Incrustar en Canarias Convive»). */
(() => {
  if (window.self === window.top) return;
  let padre = null;
  try {
    padre = location.ancestorOrigins && location.ancestorOrigins.length ? location.ancestorOrigins[0]
      : document.referrer ? new URL(document.referrer).origin : null;
  } catch { padre = null; }
  if (!padre) return;
  const permitidos = [location.origin, ...(typeof ORIGENES_IFRAME !== 'undefined' ? ORIGENES_IFRAME : [])];
  if (!permitidos.includes(padre)) { location.replace(new URL('enmarcada.html', document.currentScript.src).href); return; }
  const avisarAlto = () => parent.postMessage({ fichas: 'alto', alto: document.documentElement.scrollHeight }, padre);
  addEventListener('load', avisarAlto);
  if ('ResizeObserver' in window) addEventListener('DOMContentLoaded', () => new ResizeObserver(avisarAlto).observe(document.body));
})();

/* Si un script de la página no llega a cargar, la portada no puede quedarse en
   blanco esperando su entrada: se destapa desde aquí (el evento de carga fallida
   no burbujea, se captura en la ventana). */
addEventListener('error', (e) => {
  if (e.target && e.target.tagName === 'SCRIPT') document.querySelector('.tapa.espera')?.classList.remove('espera');
}, true);

/** Cifra en español: punto de millar siempre, coma decimal, `d` decimales. */
const nf = (v, d = 0) => v == null || !isFinite(v)
  ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });

// Espacio duro entre la cifra y su unidad (%, años…): nunca se separan al final de línea.
const UNI = '\u00a0';
const pct = (v, d = 1) => v == null ? '—' : nf(v, d) + UNI + '%';

const acotar = (v, min, max) => Math.max(min, Math.min(max, v));
/** Último valor no nulo de una serie. */
const ultimoValido = (V) => {
  for (let i = V.length - 1; i >= 0; i--) if (V[i] != null && isFinite(V[i])) return V[i];
  return null;
};
/** Eje de una pirámide: el entero más pequeño que cubre el grupo más numeroso,
 *  el mismo a los dos lados (regla de Pedro: que se adapte a cada pirámide).
 *  La misma en ficha, dossier y comparador; exportar_datos.py la repite. */
const ejeAutomatico = (maximo) => Math.max(1, Math.ceil(maximo - 1e-9));
/** Rejilla y rótulos de ese eje, los mismos en la ficha, el dossier y el
 *  comparador: una línea por punto hasta 8, cada dos desde 10 y siempre el
 *  tope; rótulo de dos en dos (de cuatro en cuatro donde 2 % no llegan a
 *  30 px), el tope siempre rotulado y sin el múltiplo anterior si queda
 *  pegado. `anchoLado`, en px, es lo que mide un lado de la pirámide. */
function pasosEje(eje, anchoLado) {
  const paso = eje <= 8 ? 1 : 2;
  const cada = Math.min(2, eje) / eje * anchoLado >= 30 ? 2 : 4;
  const pasos = [];
  for (let v = 0; v < eje; v += paso) pasos.push({ v, rotulo: v % cada === 0 && eje - v >= cada });
  pasos.push({ v: eje, rotulo: true });
  return pasos;
}
/** Comarca sin el prefijo de isla («Tenerife - Abona» → «Abona»), o null cuando
 *  la comarca es la isla entera (El Hierro): migas y tercer mapa la omiten. */
const comarcaDe = (f) => { const c = f.comarca.replace(/^.*? - /, ''); return c === f.isla ? null : c; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Sin tildes y en minúsculas: quien busca "guia" tiene que encontrar Guía. */
const plano = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ------------------------------------------------------ transiciones ------- */
/* Los cambios de contenido se hacen por cruce con desenfoque: lo que había se
   difumina encima y lo nuevo aparece debajo enfocándose. Sin animación con
   «reducir movimiento», con la pestaña oculta y en papel. */
const SUAVE = 'cubic-bezier(.22,.61,.36,1)';
const SALIDA = 'cubic-bezier(.4,0,.6,1)';
const DESENFOQUE = 4;
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const animable = () => !reducido() && !document.hidden
  && !(typeof IMPRIMIENDO !== 'undefined' && IMPRIMIENDO);

/** Deja un fantasma de cada elemento del selector como hermano colocado
 *  encima. Devuelve `soltar`: tras repintar, funde el fantasma (320 ms) mientras
 *  el contenido nuevo se enfoca (600 ms). Un elemento oculto no deja fantasma. */
function cruce(selector) {
  if (!animable()) return () => {};
  const pares = [];
  for (const el of document.querySelectorAll(selector)) {
    const padre = el.parentElement;
    // Un fantasma a medio fundir coincide con el mismo selector: no se vuelve a clonar.
    if (!padre || el.classList.contains('fantasma') || el.closest('.fantasma')) continue;
    const a = el.getBoundingClientRect();
    let clon = null;
    if (a.width > 0 && a.height > 0) {
      if (getComputedStyle(padre).position === 'static') padre.style.position = 'relative';
      const b = padre.getBoundingClientRect();
      clon = el.cloneNode(true);
      clon.classList.add('fantasma');
      clon.inert = true;
      clon.setAttribute('aria-hidden', 'true');
      clon.removeAttribute('id');
      clon.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
      clon.style.cssText = `left:${a.left - b.left - padre.clientLeft}px;top:${a.top - b.top - padre.clientTop}px;`
        + `width:${a.width}px;height:${a.height}px`;
      el.after(clon);
    }
    pares.push([el, clon]);
  }
  return () => {
    for (const [el, clon] of pares) {
      if (clon) {
        clon.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: `blur(${DESENFOQUE}px)` }],
          { duration: 320, easing: SALIDA, fill: 'forwards' }).onfinish = () => clon.remove();
      }
      // Se enfoca el contenido, no la caja (el filtro emborronaría borde y fondo).
      const hijos = [...el.children].filter((h) => !h.classList.contains('fantasma'));
      for (const h of hijos.length ? hijos : [el]) {
        h.animate([{ opacity: 0, filter: `blur(${DESENFOQUE}px)` }, { opacity: 1, filter: 'blur(0px)' }],
          { duration: 600, easing: SUAVE });
      }
    }
  };
}

/** Pulso de desenfoque sobre un gráfico mientras sus barras se mueven (`max`
 *  píxeles en el primer tercio, a la duración del movimiento). */
function pulsoDesenfoque(el, dur = 800, max = 1.2) {
  if (!el || !animable()) return;
  el.animate([{ filter: 'blur(0px)', easing: 'ease-in-out' }, { filter: `blur(${max}px)`, offset: .3, easing: 'ease-in-out' }, { filter: 'blur(0px)' }],
    { duration: dur });
}

/** Antes de imprimir: ni fantasmas a medias ni animaciones en curso. */
addEventListener('beforeprint', () => {
  document.querySelectorAll('.fantasma').forEach((f) => f.remove());
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { a.cancel(); } });
});

/* La barra pegajosa mide distinto según la página y la anchura: las anclas y el
   foco se colocan por debajo de su altura real (estilos.css deja un valor fijo
   de reserva). */
const BARRA_PEGAJOSA = document.querySelector('.barra');
if (BARRA_PEGAJOSA && 'ResizeObserver' in window) {
  const ajustar = () => {
    document.documentElement.style.scrollPaddingTop = `${Math.ceil(BARRA_PEGAJOSA.getBoundingClientRect().height) + 8}px`;
  };
  new ResizeObserver(ajustar).observe(BARRA_PEGAJOSA);
  ajustar();
}

/* ------------------------------------------------------------- carga ------- */
/* Raíz de la web: el directorio de este script. Datos y enlaces se resuelven
   contra ella, porque la ficha cambia su dirección visible a m/<código>.html. */
const RAIZ_WEB = new URL('.', document.currentScript.src);
const rutaWeb = (ruta) => new URL(ruta, RAIZ_WEB).href;

/* ------------------------------------------------------------- marca ------- */
/* La web se ve con la marca del programa que la enlaza o la enmarca: Canarias
   Convive por defecto, u otra con ?marca=<id> en la dirección (los ids, sus
   logotipos y su nombre están en sitio.json y llegan en config.js: MARCAS y
   MARCA_POR_DEFECTO). La marca cambia el logotipo de la cabecera, de la
   portada, de la placa del papel y de la presentación, el nombre en los
   títulos y en los pies del dossier, y la línea de entidades de su portada. Se
   recuerda mientras se navega: los enlaces internos la llevan al pulsarlos y la
   sesión la guarda por si alguno se escapa. Sin parámetro ni sesión, la de por
   defecto: una web enmarcada en otro sitio no hereda la marca de otra pestaña.
   Las tarjetas de vista previa y las etiquetas og: son estáticas y van siempre
   con la marca por defecto. */
const MARCAS_SITIO = typeof MARCAS !== 'undefined' && Object.keys(MARCAS).length ? MARCAS
  : { canariasconvive: { nombre: 'Canarias Convive', logo: 'img/logo-canariasconvive.png', menu: 'img/logo-canariasconvive-menu.png', entidades: 'Gobierno de Canarias · Universidad de La Laguna' } };
const MARCA_BASE = typeof MARCA_POR_DEFECTO !== 'undefined' && MARCAS_SITIO[MARCA_POR_DEFECTO] ? MARCA_POR_DEFECTO : Object.keys(MARCAS_SITIO)[0];
const MARCA_ID = (() => {
  const pedida = new URLSearchParams(location.search).get('marca');
  let id = pedida && MARCAS_SITIO[pedida] ? pedida : null;
  try {
    if (id) sessionStorage.setItem('marca', id);
    else if (pedida === null) id = sessionStorage.getItem('marca');   // sin parámetro: la de la sesión, si la hay
  } catch { /* sin almacenamiento (privado, bloqueado): la marca va solo en la dirección */ }
  return id && MARCAS_SITIO[id] ? id : MARCA_BASE;
})();
const MARCA = MARCAS_SITIO[MARCA_ID];
const NOMBRE_MARCA = MARCA.nombre;
/** El título de una página, con la marca activa. */
const tituloPagina = (texto) => `${texto} · ${NOMBRE_MARCA}`;
/** Una dirección de la web con la marca activa, si no es la de por defecto. */
function conMarca(url) {
  if (MARCA_ID === MARCA_BASE) return url;
  const u = new URL(url, location.href);
  if (!u.searchParams.has('marca')) u.searchParams.set('marca', MARCA_ID);
  return u.href;
}
/** Logotipos, título y enlaces de la página con la marca activa. Se ejecuta
 *  en cuanto carga este script, antes del primer dibujado, porque la
 *  cabecera va antes que los scripts en todas las páginas. */
function aplicarMarca() {
  document.documentElement.dataset.marca = MARCA_ID;
  if (MARCA_ID === MARCA_BASE) return;
  document.querySelectorAll('.marca img, .tapa-marca .placa img').forEach((img) => { img.src = rutaWeb(MARCA.menu || MARCA.logo); img.alt = NOMBRE_MARCA; });
  document.querySelectorAll('.placa-papel img').forEach((img) => { img.src = rutaWeb(MARCA.logo); img.alt = NOMBRE_MARCA; });
  const base = MARCAS_SITIO[MARCA_BASE].nombre;
  if (document.title.endsWith(` · ${base}`)) document.title = document.title.slice(0, -base.length) + NOMBRE_MARCA;
  // Los enlaces de la propia web llevan la marca al pulsarlos (también con Ctrl o Cmd, en otra pestaña).
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && a.origin === location.origin && !a.href.startsWith('data:')) a.href = conMarca(a.href);
  }, true);
}
aplicarMarca();

/** Los enlaces relativos del HTML pasan a absolutos contra la raíz. */
function enlacesAbsolutos() {
  document.querySelectorAll('a[href]').forEach((a) => {
    const h = a.getAttribute('href');
    if (/^(https?:|mailto:|#|\/)/.test(h)) return;
    a.href = rutaWeb(h);
  });
}

/** fetch de un JSON con comprobación del estado HTTP. */
async function leerJSON(ruta, signal) {
  const respuesta = await fetch(rutaWeb(ruta), { signal });
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${ruta}: HTTP ${respuesta.status}`);
  return respuesta.json();
}

/** Aviso de carga o de error con botón de reintento; sin mensaje, se oculta. */
function avisoCarga(id, mensaje = '', reintentar) {
  const caja = document.getElementById(id);
  if (!caja) return;
  caja.hidden = !mensaje;
  caja.replaceChildren();
  if (!mensaje) return;
  const texto = document.createElement('span');
  texto.textContent = mensaje;
  caja.append(texto);
  if (reintentar) {
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'btn btn-liso'; boton.textContent = 'Reintentar';
    boton.addEventListener('click', reintentar);
    caja.append(boton);
  }
}

/** Canónica y og: de la ficha en pantalla, sobre la URL pública de sitio.json
 *  (config.js). Para los rastreadores, que no ejecutan JS, están las mismas
 *  etiquetas en los envoltorios estáticos m/<código>.html, i/<isla>.html,
 *  p/<provincia>.html y r/canarias.html. */
const URL_PUBLICA_SITIO = typeof URL_PUBLICA !== 'undefined' ? URL_PUBLICA : new URL('.', location.href).href;
function metadatosFicha(f) {
  // La misma tarjeta que escribe generar_tarjetas.py en los envoltorios.
  const carpeta = { municipio: 'm', isla: 'i', provincia: 'p', canarias: 'r' }[f.tipo];
  const url = new URL(`${carpeta}/${f.tipo === 'municipio' ? f.codmun : f.slug}.html`, URL_PUBLICA_SITIO).href;
  const de = { isla: ' de la isla', provincia: ' de la provincia' }[f.tipo] || '';
  const contiene = f.tipo === 'isla' ? ` en ${f.municipios.length} municipios`
    : f.tipo === 'provincia' ? ` en ${f.islas.length} islas y ${f.municipios.length} municipios`
    : f.tipo === 'canarias' ? ` en ${f.islas.length} islas y ${f.islas.reduce((s, i) => s + i.municipios, 0)} municipios` : '';
  const valores = {
    'og:title': `${f.nombre} · Ficha demográfica${de}`,
    'og:url': url,
    'og:image': new URL(`og/${f.tipo === 'municipio' ? f.codmun : f.slug}.png`, URL_PUBLICA_SITIO).href,
    'og:description': `${nf(f.poblacion)} habitantes${contiene}. `
      + `Estructura de la población, evolución e índices. Población a 1 de enero de ${f.anio}.`,
  };
  for (const [clave, valor] of Object.entries(valores)) {
    document.querySelector(`meta[property="${clave}"]`)?.setAttribute('content', valor);
  }
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
}

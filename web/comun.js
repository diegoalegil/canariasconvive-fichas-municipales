/* =============================================================================
   AYUDANTES COMUNES · CANARIAS CONVIVE
   Se carga antes que cualquier otro script. Estaban copiados en cuatro
   ficheros (y en el dossier con otro nombre para no chocar con la copia de la
   ficha); una sola definición es la única manera de que las 88 fichas, el
   comparador, la portada y el dossier escriban una cifra igual.
   ============================================================================= */

/** Cifra en español: punto de millar siempre, coma decimal, `d` decimales. */
const nf = (v, d = 0) => v == null || !isFinite(v)
  ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });

/* El símbolo va separado de la cifra, como manda la RAE, y con espacio duro
   para que nunca se quede solo al final de una línea. Vale para el %, para
   "años" y para cualquier unidad. */
const UNI = '\u00a0';
const pct = (v, d = 1) => v == null ? '—' : nf(v, d) + UNI + '%';

const acotar = (v, min, max) => Math.max(min, Math.min(max, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Sin tildes y en minúsculas: quien busca "guia" tiene que encontrar Guía. */
const plano = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ------------------------------------------------------ transiciones ------- */
/* Todo cambio de contenido se hace por CRUCE CON DESENFOQUE: lo que había se
   difumina y se apaga encima, y lo nuevo aparece debajo enfocándose. Nada se
   desplaza ni cambia de tamaño. Se apaga con "reducir movimiento", con la
   pestaña oculta (el navegador congela los fotogramas) y en papel. */
/* Dos curvas para toda la web: lo que entra frena largo (SUAVE, easeOutCubic)
   y lo que sale se va sin brusquedad (SALIDA, simétrica). Desenfoque de 4 px:
   suficiente para que el ojo vea el cambio, no tanto como para emborronar. */
const SUAVE = 'cubic-bezier(.22,.61,.36,1)';
const SALIDA = 'cubic-bezier(.4,0,.6,1)';
const DESENFOQUE = 4;
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const animable = () => !reducido() && !document.hidden
  && !(typeof IMPRIMIENDO !== 'undefined' && IMPRIMIENDO);

/** Deja un fantasma de cada elemento del selector, tal cual está ahora, como
 *  hermano colocado encima. Devuelve `soltar`: se llama después de repintar y
 *  funde el fantasma (320 ms) mientras el contenido nuevo se enfoca (600 ms).
 *  Un elemento sin tamaño (oculto) no deja fantasma, pero sí entra enfocándose. */
function cruce(selector) {
  if (!animable()) return () => {};
  const pares = [];
  for (const el of document.querySelectorAll(selector)) {
    const padre = el.parentElement;
    if (!padre) continue;
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
      /* Se enfoca el contenido, no la caja: con el filtro en el elemento, el
         borde y el fondo de la cabecera se veían blandos durante el cruce. */
      const hijos = [...el.children].filter((h) => !h.classList.contains('fantasma'));
      for (const h of hijos.length ? hijos : [el]) {
        h.animate([{ opacity: 0, filter: `blur(${DESENFOQUE}px)` }, { opacity: 1, filter: 'blur(0px)' }],
          { duration: 600, easing: SUAVE });
      }
    }
  };
}

/** Pulso de desenfoque sobre un gráfico mientras sus barras se mueven: una
 *  campana leve, de `max` píxeles como mucho en el primer tercio, que vuelve a
 *  enfocarse con el movimiento. Va a la duración del movimiento. */
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


/* ------------------------------------------------------------- carga ------- */
/** fetch con comprobación del estado: un 404 servido como HTML no es un JSON,
 *  y antes se intentaba parsear y fallaba sin decir por qué. */
async function leerJSON(ruta, signal) {
  const respuesta = await fetch(ruta, { signal });
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${ruta}: HTTP ${respuesta.status}`);
  return respuesta.json();
}

/** Aviso de carga o de error, visible y con botón de reintento. Sin mensaje,
 *  se oculta. El elemento lleva role="status" en el HTML. */
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

/** Metadatos de la página para el municipio en pantalla —canónica y og:—
 *  sobre la URL pública de sitio.json (config.js). Los rastreadores no
 *  ejecutan JS, para ellos están los envoltorios de web/m/; esto sirve a quien
 *  copie la dirección de la barra o guarde la página. */
const URL_PUBLICA_SITIO = typeof URL_PUBLICA !== 'undefined' ? URL_PUBLICA : new URL('.', location.href).href;
function metadatosFicha(f) {
  const url = new URL(`m/${f.codmun}.html`, URL_PUBLICA_SITIO).href;
  const valores = {
    'og:title': `${f.nombre} · Ficha demográfica`,
    'og:url': url,
    'og:image': new URL(`og/${f.codmun}.png`, URL_PUBLICA_SITIO).href,
    'og:description': `${nf(f.poblacion)} habitantes. Estructura de la población, evolución e índices. Datos de ${f.anio}.`,
  };
  for (const [clave, valor] of Object.entries(valores)) {
    document.querySelector(`meta[property="${clave}"]`)?.setAttribute('content', valor);
  }
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
}

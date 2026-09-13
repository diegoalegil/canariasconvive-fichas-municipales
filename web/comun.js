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
const SUAVE = 'cubic-bezier(.2,.7,.2,1)';
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const animable = () => !reducido() && !document.hidden
  && !(typeof IMPRIMIENDO !== 'undefined' && IMPRIMIENDO);

/** Deja un fantasma de cada elemento del selector, tal cual está ahora, como
 *  hermano colocado encima. Devuelve `soltar`: se llama después de repintar y
 *  funde el fantasma (280 ms) mientras el contenido nuevo se enfoca (460 ms).
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
        clon.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)' }],
          { duration: 260, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' }).onfinish = () => clon.remove();
      }
      /* Se enfoca el contenido, no la caja: con el filtro en el elemento, el
         borde y el fondo de la cabecera se veían blandos durante el cruce. */
      const hijos = [...el.children].filter((h) => !h.classList.contains('fantasma'));
      for (const h of hijos.length ? hijos : [el]) {
        h.animate([{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }],
          { duration: 460, easing: SUAVE });
      }
    }
  };
}

/** Pulso de desenfoque sobre un gráfico mientras sus barras se mueven: sube
 *  hasta `max` píxeles en el primer cuarto y vuelve a enfocarse al acabar. */
function pulsoDesenfoque(el, dur = 600, max = 2.5) {
  if (!el || !animable()) return;
  el.animate([{ filter: 'blur(0px)' }, { filter: `blur(${max}px)`, offset: .25 }, { filter: 'blur(0px)' }],
    { duration: dur, easing: 'linear' });
}

/** Antes de imprimir: ni fantasmas a medias ni animaciones en curso. */
addEventListener('beforeprint', () => {
  document.querySelectorAll('.fantasma').forEach((f) => f.remove());
  document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { a.cancel(); } });
});

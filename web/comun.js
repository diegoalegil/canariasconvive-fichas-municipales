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

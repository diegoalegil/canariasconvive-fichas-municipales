/* Guía de lectura: qué mide cada indicador y con qué cuenta se obtiene. Las
   fórmulas de los cuatro índices son las del Excel (C10M, C11M, C14M y C17M);
   los enunciados son los de Pedro. */

/* ------------------------------------------------------------- fórmulas --- */
/** División con barra horizontal; `coda` es lo que va detrás (× 100). */
function fraccion(arriba, abajo, coda = '') {
  return `<span class="frm">
    <span class="frac"><span class="num">${esc(arriba)}</span><span class="den">${esc(abajo)}</span></span>
    ${coda ? `<span class="coda">${esc(coda)}</span>` : ''}
  </span>`;
}
/** Resta, para los dos componentes del cambio. */
function resta(a, b) {
  return `<span class="frm"><span>${esc(a)}</span><span class="coda">\u2212</span><span>${esc(b)}</span></span>`;
}

/* ----------------------------------------------------------- indicadores --- */
const INDICADORES = [
  {
    id: 'tvma', ico: 'variacion', nombre: 'Variación media anual',
    unidad: 'Se expresa en porcentaje anual',
    mide: 'Ritmo constante al que habría crecido la población cada año para pasar de la cifra inicial a la final. n es el número de años transcurridos.',
    formula: `<span class="frm" role="img" aria-label="Población final dividida por población inicial, elevada a uno partido por n; menos uno, por cien">[${fraccion('Población final', 'Población inicial')}<sup>1/n</sup> − 1] × 100</span>`,
  },
  {
    id: 'envejecimiento', ico: 'edad', nombre: 'Índice de envejecimiento',
    unidad: 'Se expresa como una razón',
    mide: 'Cuántas personas de 65 años o más hay por cada persona menor de 15.',
    formula: fraccion('Población de 65 años o más', 'Población menor de 15 años'),
  },
  {
    id: 'juventud', ico: 'poblacion', nombre: 'Índice de juventud',
    unidad: 'Se expresa por cien',
    mide: 'Cuántos menores de 15 años hay por cada cien personas de 15 a 64.',
    formula: fraccion('Población menor de 15 años', 'Población de 15 a 64 años', '× 100'),
  },
  {
    id: 'dependencia', ico: 'dependencia', nombre: 'Índice de dependencia',
    unidad: 'Se expresa por cien',
    mide: 'Cuántas personas hay menores de 15 y mayores de 64 años por cada cien entre 15 y 64 años.',
    formula: fraccion('Menores de 15 + mayores de 64', 'Población de 15 a 64 años', '× 100'),
  },
  {
    id: 'reemplazo', ico: 'relevo', nombre: 'Índice de reemplazo laboral',
    unidad: 'Se expresa por cien',
    mide: 'Cuántas personas de 15 a 19 años hay por cada cien de 60 a 64.',
    formula: fraccion('Población de 15 a 19 años', 'Población de 60 a 64 años', '× 100'),
  },
  {
    id: 'vegetativo', ico: 'variacion', nombre: 'Crecimiento vegetativo',
    unidad: 'Se expresa en personas',
    mide: 'Los nacimientos de un año menos las defunciones de ese mismo año.',
    formula: resta('Nacimientos', 'Defunciones'),
  },
  {
    id: 'migratorio', ico: 'variacion', nombre: 'Saldo migratorio',
    unidad: 'Se expresa en personas',
    mide: 'Las entradas menos las salidas por cambio de residencia en el mismo año.',
    formula: resta('Entradas', 'Salidas'),
  },
  {
    id: 'nacimiento', ico: 'nacimiento', nombre: 'Lugar de nacimiento',
    unidad: 'Se expresa en porcentaje y suma cien',
    mide: 'De cada cien habitantes, cuántos nacieron en Canarias, cuántos en el resto de España y cuántos en el extranjero.',
    formula: fraccion('Nacidos en cada lugar', 'Total de habitantes', '× 100'),
  },
  {
    id: 'extranjero', ico: 'extranjero', nombre: 'Población de origen extranjero',
    unidad: 'Se expresa en porcentaje',
    mide: 'Personas nacidas fuera de España por cada cien habitantes.',
    formula: fraccion('Personas nacidas fuera de España', 'Total de habitantes', '× 100'),
  },
];

/* -------------------------------------------------------------- montaje --- */
// El dossier carga este fichero solo por INDICADORES, junto a ficha.js.
function pintarGuia() {
  document.getElementById('guia-indice').innerHTML = INDICADORES.map((x) =>
    `<a href="#${x.id}">${esc(x.nombre.replace(/^Índice (de |del )?/, '').replace(/^./, (l) => l.toUpperCase()))}</a>`).join('');

  document.getElementById('guia-fichas').innerHTML = INDICADORES.map((x) => `
    <section class="tarjeta mitad" id="${x.id}">
      <header class="rotulo" data-ico="${x.ico}">
        <div><h2>${esc(x.nombre)}</h2><p>${esc(x.unidad)}</p></div>
      </header>
      <div class="cuerpo">
        <p class="guia-mide">${esc(x.mide)}</p>
        ${x.formula ? `<div class="guia-formula">${x.formula}</div>` : ''}
      </div>
    </section>`).join('');

  document.querySelectorAll('.rotulo[data-ico]').forEach((r) => {
    if (!r.querySelector('svg')) r.insertAdjacentHTML('afterbegin', icono(r.dataset.ico, 26));
  });
  document.querySelectorAll('.btn[data-ico]').forEach((b) =>
    b.insertAdjacentHTML('afterbegin', icono(b.dataset.ico, 15)));
}

if (document.getElementById('guia-fichas')) pintarGuia();

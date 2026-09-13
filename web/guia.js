/* =============================================================================
   GUÍA DE LECTURA DE LOS INDICADORES · CANARIAS CONVIVE

   El público de la ficha son concejales y cargos públicos, no demógrafos. La
   guía dice qué mide cada indicador y con qué cuenta se obtiene. Nada más.

   Antes traía además, por cada indicador, qué significa un valor alto, qué
   significa uno bajo, qué no se puede concluir y un ejemplo con datos reales.
   Era demasiado para lo que hay que explicar, y lo de "alto" y "bajo" rozaba el
   calificativo, que es justo lo que la ficha no hace.

   Las cuatro definiciones de los índices no estaban escritas en ninguna parte:
   el diccionario del Excel da el nombre y la unidad, pero no la fórmula. Se
   dedujeron contrastando los valores ya calculados de Pedro contra la pirámide
   de población de los 88 municipios, y cuadran con menos de un 0,5 % de error
   máximo. El detalle está en el README.
   ============================================================================= */


/* ------------------------------------------------------------- fórmulas --- */
/** División con barra horizontal, escrita como en un libro y no como "a / b".
 *  `coda` es lo que va detrás de la fracción, normalmente el × 100.
 *
 *  Los dos indicadores que son una resta —crecimiento vegetativo y saldo
 *  migratorio— no llevan fórmula: escrita, repetía palabra por palabra la
 *  frase de encima. Pedro los separó del resto por eso mismo: "en crecimiento
 *  vegetativo solo el enunciado con su descripción cortita". */
function fraccion(arriba, abajo, coda = '') {
  return `<span class="frm">
    <span class="frac"><span class="num">${esc(arriba)}</span><span class="den">${esc(abajo)}</span></span>
    ${coda ? `<span class="coda">${esc(coda)}</span>` : ''}
  </span>`;
}

/* ----------------------------------------------------------- indicadores --- */
const INDICADORES = [
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
    mide: 'Cuántas personas hay en los dos extremos de edad juntos por cada cien de 15 a 64.',
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
  },
  {
    id: 'migratorio', ico: 'variacion', nombre: 'Saldo migratorio',
    unidad: 'Se expresa en personas',
    mide: 'Las altas en el padrón del municipio en un año menos las bajas.',
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
    mide: 'Qué parte de la población del municipio es de origen extranjero.',
    formula: fraccion('Población de origen extranjero', 'Total de habitantes', '× 100'),
  },
];

/* -------------------------------------------------------------- montaje --- */
function pintar() {
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

pintar();

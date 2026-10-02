/* Fuente de cada gráfico («Fuente: …» al pie, en pantalla y en papel). */

/* Texto de cada fuente: la operación de la que salen de verdad los datos de
   cada gráfico, con sus años, comprobada celda a celda contra las tablas del
   ISTAC y del INE (README, «Las fuentes»). Hasta 2020 la población es la de
   las cifras oficiales y la explotación del padrón; desde 2021, la del censo
   anual de población; el saldo migratorio de 2022 a 2024 es del INE. Los años
   no se calculan con los datos: se revisan a mano con cada actualización, e
   invariantes.py exige el año de referencia, el censo anual donde lo hay y que
   ni las cifras oficiales ni el padrón pasen de 2020. Las de padrón son las de
   la pirámide y los índices de un año anterior: su año se pone al mostrarlas.
   Van cortas para que en la A4 la fila de evolución y origen extranjero siga
   en una línea: el nombre completo de cada tabla, con su enlace, está en la
   tarjeta de fuentes (FUENTES_OFICIALES). Las series que empiezan más tarde
   (Frontera y El Pinar, desde 2008) llevan su primer año (`desde`). */
const FUENTES_GRAFICOS = {
  evolucion: 'ISTAC. Cifras oficiales de población, 1996–2020, y censo anual, 2021–2025.',
  evolucion_isla: 'ISTAC. Cifras oficiales de población, 2000–2020, y censo anual, 2021–2025.',
  evolucion_canarias: 'ISTAC. Cifras oficiales de población, 2000–2020, y censo anual, 2021–2025.',
  evolucion_provincia: 'ISTAC. Cifras oficiales de población, 2000–2020, y censo anual, 2021–2025: suma de sus islas.',
  municipios: 'ISTAC. Censo anual de población de los municipios, 2025.',
  islas: 'ISTAC. Censo anual de población de las islas, 2025.',
  extranjero: 'ISTAC. Padrón, 2000–2020, y censo anual, 2021–2025.',
  mapas: 'GRAFCAN, límites municipales; ISTAC, censo anual de población, 2025.',
  piramide: 'ISTAC. Censo anual de población, por sexo y grupos de edad, 2025.',
  piramide_padron: 'ISTAC. Explotación estadística del padrón, por sexo y grupos de edad, 2020.',
  piramide_nacimiento: 'ISTAC. Censo anual de población, por sexo, edad y lugar de nacimiento, 2025.',
  indices: 'ISTAC. Censo anual de población, por sexo y edades, 2025.',
  indices_padron: 'ISTAC. Explotación estadística del padrón, por sexo y edades, 2020.',
  componentes: 'ISTAC. Crecimiento vegetativo, 2002–2024, y variaciones residenciales, 2002–2021; INE. Migraciones y cambios de residencia, 2022–2024.',
  nacimiento: 'ISTAC. Censo anual de población, por lugar de nacimiento, 2025.',
};
/** Con `anio`, la de un año anterior de la pirámide o los índices (la clave
 *  «_padron»), con su año en lugar del de referencia. Con `desde`, el primer
 *  año de la serie de la ficha: un periodo que empieza antes, empieza ahí. */
function textoFuente(clave, anio = null, desde = null) {
  let texto = FUENTES_GRAFICOS[clave];
  if (anio) texto = texto.replace(/\d{4}\.$/, `${anio}.`);
  if (desde) texto = texto.replace(/(\d{4})–(\d{4})/g, (todo, a, b) => (+a < desde && desde <= +b ? `${desde}–${b}` : todo));
  return `Fuente: ${texto}`;
}
function fuenteGrafico(clave, desde = null) { return `<p class="fuente-grafico">${esc(textoFuente(clave, null, desde))}</p>`; }

/** El primer año con dato de la evolución y del origen extranjero de la ficha
 *  `f` (Frontera y El Pinar empiezan en 2008, tras la segregación). */
function primerosAnios(f) {
  if (!f) return {};
  const ext = f.extranjero, propia = ext[f.tipo] ?? ext.canarias;
  return { evolucion: f.evolucion.anios[0], extranjero: ext.anios.find((a, i) => propia[i] != null) };
}

/** Pone o actualiza la línea de fuente al final de `elemento`. */
function ponerFuente(elemento, id, clave, anio = null, desde = null) {
  if (!elemento || !FUENTES_GRAFICOS[clave]) return;
  let p = document.getElementById(id);
  if (!p) { p = document.createElement('p'); p.id = id; p.className = 'fuente-grafico'; elemento.append(p); }
  const texto = textoFuente(clave, anio, desde);
  if (p.textContent !== texto) p.textContent = texto;
}

/* Los organismos y las tablas de las que salen los datos de la ficha, con su
   enlace («Fuentes de esta ficha», en la tarjeta de consultas oficiales). Las
   del ISTAC se abren ya en el territorio de la ficha (su identificador en el
   ISTAC, de enlaces.json); la de migraciones del INE tiene una tabla por
   ámbito. Un `desde` con nombre es el primer año de esa serie de la ficha:
   «evolucion» (1996 en los municipios, 2000 por encima, 2008 en Frontera y El
   Pinar), «extranjero» y «anteriores» (2010 en Frontera y El Pinar). Los
   logotipos son los de la web de cada organismo; el del ISTAC, su versión en
   color sobre blanco. */
const VISOR_ISTAC = 'https://www3.gobiernodecanarias.org/istac/statistical-visualizer/visualizer/data.html?resourceType=dataset&agencyId=ISTAC&version=~latest&resourceId=';
const ORGANISMOS = {
  ISTAC: { nombre: 'Instituto Canario de Estadística', logo: 'img/logo-istac.svg', web: 'https://www.gobiernodecanarias.org/istac/' },
  INE: { nombre: 'Instituto Nacional de Estadística', logo: 'img/logo-ine.svg', web: 'https://www.ine.es/' },
};
const FUENTES_OFICIALES = {
  ISTAC: [
    { texto: 'Cifras oficiales de población', desde: 'evolucion', hasta: 2020, istac: 'E30245A_000002' },
    { texto: 'Censo anual de población: sexo y edad', desde: 2021, hasta: 2025, istac: 'E30243A_000001' },
    { texto: 'Censo anual de población: país de nacimiento', desde: 2021, hasta: 2025, istac: 'E30243A_000004' },
    { texto: 'Censo anual de población: lugar de nacimiento', desde: 2025, hasta: 2025, istac: 'E30243A_000006' },
    { texto: 'Explotación del padrón: sexo y edad', desde: 'anteriores', hasta: 2020, istac: 'E30260A_000001' },
    { texto: 'Explotación del padrón: país de nacimiento', desde: 'extranjero', hasta: 2020, istac: 'E30260A_000009' },
    { texto: 'Crecimiento vegetativo', desde: 2002, hasta: 2024, istac: 'C00042A_000001' },
    { texto: 'Variaciones residenciales', desde: 2002, hasta: 2021,
      url: 'https://datos.canarias.es/catalogos/estadisticas/es/dataset/saldo-migratorio-segun-sexos-municipios-por-islas-de-canarias-y-anos' },
  ],
  INE: [
    { texto: 'Migraciones y cambios de residencia', desde: 2022, hasta: 2024,
      ine: { municipio: 69767, provincia: 69767, isla: 69766, canarias: 69762 } },   // por municipio, por isla y por comunidad
  ],
};

/** La fuente de la evolución, que cambia con el ámbito (ficha, presentación y dossier). */
const claveEvolucion = (ent) => ent?.canarias ? 'evolucion_canarias' : ent?.provincia ? 'evolucion_provincia' : ent?.agregada ? 'evolucion_isla' : 'evolucion';

/** Las siete tarjetas con gráfico de la ficha (ocho por encima del municipio,
 *  con la lista de lo que contiene; nueve en la provincia, que lista también
 *  sus municipios); la pirámide sigue a su pestaña. Las cifras clave no
 *  llevan fuente: no son un gráfico. `ent` es la entidad de la ficha
 *  (`entidad`, ficha.js); las provincias se suman desde las islas. Con
 *  `anioEstructura`, la pirámide y los índices son de ese año anterior. */
function fuentesFicha(vistaPiramide = 0, ent = null, anioEstructura = null, f = null) {
  const desde = primerosAnios(f);
  const agregada = !!ent?.agregada;
  [['g-evolucion', claveEvolucion(ent)],
   ['g-extranjero', 'extranjero'], ['mapas', 'mapas'],
   ['g-municipios', ent?.isla ? 'municipios' : agregada ? 'islas' : null],
   ['g-municipios-provincia', ent?.provincia ? 'municipios' : null],
   ['g-piramide', vistaPiramide === 1 ? 'piramide_nacimiento' : anioEstructura ? 'piramide_padron' : 'piramide'],
   ['g-indices', anioEstructura ? 'indices_padron' : 'indices'], ['g-componentes', 'componentes'], ['g-origen', 'nacimiento'],
  ].forEach(([id, clave]) => {
    const anio = id === 'g-piramide' || id === 'g-indices' ? anioEstructura : null;
    const inicio = id === 'g-evolucion' ? desde.evolucion : id === 'g-extranjero' ? desde.extranjero : null;
    if (clave) ponerFuente(document.getElementById(id)?.parentElement, `fuente-${id}`, clave, anio, inicio);
    else document.getElementById(`fuente-${id}`)?.remove();
  });
}

/** Las cuatro secciones con gráfico del comparador. */
function fuentesComparador() {
  // El comparador solo enseña el último dato de origen extranjero: la misma operación y año que el lugar de nacimiento.
  [['cmp-piramides', 'piramide'], ['cmp-indices', 'indices'], ['cmp-nacimiento', 'nacimiento'], ['cmp-extranjero', 'nacimiento']]
    .forEach(([id, clave]) => ponerFuente(document.getElementById(id), `fuente-${id}`, clave));
}

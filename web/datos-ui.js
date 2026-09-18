/* Fuente de cada gráfico («Fuente: …» al pie, en pantalla y en papel). */

/* Texto de cada fuente, con la redacción de Pedro. Los años son los de la
   operación estadística de origen, no se calculan con los datos: se revisan a
   mano con cada actualización e invariantes.py avisa si falta el año de
   referencia del índice. */
const FUENTES_GRAFICOS = {
  evolucion: 'ISTAC. Cifras oficiales de población de los municipios, 1996–2025.',
  evolucion_isla: 'ISTAC. Cifras oficiales de población de las islas, 2000–2025.',
  evolucion_canarias: 'ISTAC. Cifras oficiales de población de Canarias, 2000–2025.',
  municipios: 'ISTAC. Cifras oficiales de población de los municipios, 2025.',
  islas: 'ISTAC. Cifras oficiales de población de las islas, 2025.',
  extranjero: 'ISTAC. Población según lugar de nacimiento, 2000–2025.',
  mapas: 'GRAFCAN, límites municipales; ISTAC, cifras de población 2025.',
  piramide: 'ISTAC. Población según sexo y grupos de edad, 2025.',
  piramide_nacimiento: 'ISTAC. Población según sexo, edad y lugar de nacimiento, 2025.',
  indices: 'ISTAC. Población según sexo y edades, 2025.',
  componentes: 'ISTAC. Movimiento natural de la población y estadística de migraciones, 2002–2024.',
  nacimiento: 'ISTAC. Población según lugar de nacimiento, 2025.',
};
function textoFuente(clave) { return `Fuente: ${FUENTES_GRAFICOS[clave]}`; }
function fuenteGrafico(clave) { return `<p class="fuente-grafico">${esc(textoFuente(clave))}</p>`; }

/** Pone o actualiza la línea de fuente al final de `elemento`. */
function ponerFuente(elemento, id, clave) {
  if (!elemento || !FUENTES_GRAFICOS[clave]) return;
  let p = document.getElementById(id);
  if (!p) { p = document.createElement('p'); p.id = id; p.className = 'fuente-grafico'; elemento.append(p); }
  const texto = textoFuente(clave);
  if (p.textContent !== texto) p.textContent = texto;
}

/** Las siete tarjetas con gráfico de la ficha (ocho por encima del municipio,
 *  con la lista de lo que contiene; nueve en la provincia, que lista también
 *  sus municipios); la pirámide sigue a su pestaña. Las cifras clave no
 *  llevan fuente: no son un gráfico. `ent` es la entidad de la ficha
 *  (`entidad`, ficha.js); las provincias se suman desde las islas. */
function fuentesFicha(vistaPiramide = 0, ent = null) {
  const agregada = !!ent?.agregada;
  [['g-evolucion', ent?.canarias ? 'evolucion_canarias' : agregada ? 'evolucion_isla' : 'evolucion'],
   ['g-extranjero', 'extranjero'], ['mapas', 'mapas'],
   ['g-municipios', ent?.isla ? 'municipios' : agregada ? 'islas' : null],
   ['g-municipios-provincia', ent?.provincia ? 'municipios' : null],
   ['g-piramide', vistaPiramide === 1 ? 'piramide_nacimiento' : 'piramide'],
   ['g-indices', 'indices'], ['g-componentes', 'componentes'], ['g-origen', 'nacimiento'],
  ].forEach(([id, clave]) => {
    if (clave) ponerFuente(document.getElementById(id)?.parentElement, `fuente-${id}`, clave);
    else document.getElementById(`fuente-${id}`)?.remove();
  });
}

/** Las cuatro secciones con gráfico del comparador. */
function fuentesComparador() {
  [['cmp-piramides', 'piramide'], ['cmp-indices', 'indices'], ['cmp-nacimiento', 'nacimiento'], ['cmp-extranjero', 'extranjero']]
    .forEach(([id, clave]) => ponerFuente(document.getElementById(id), `fuente-${id}`, clave));
}

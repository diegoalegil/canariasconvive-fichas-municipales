/* =============================================================================
   FUENTE DE CADA GRÁFICO
   Al pie de cada gráfico, una línea «Fuente: …» con la redacción que fijó
   Pedro para cada uno (13 sep 2026), visible en pantalla y en papel. Nada más:
   hubo bajo cada tarjeta un desplegable «Datos y método» con la tabla de
   valores, el cálculo y el enlace al recurso, y se retiró porque cargaba la
   ficha con información que Pedro no pidió; el método y los enlaces siguen en
   la guía, que es donde se leen.
   `fuenteHTML` y `ponerDetalle` quedan para la guía: allí cada indicador
   despliega su fuente y su fecha, con los enlaces y periodos de indice.json
   (`fuentes_indicadores`, leídos del índice del Excel por metadatos.py).
   ============================================================================= */
let FUENTES_ACTUALES = {};
function configurarFuentes(indice) { FUENTES_ACTUALES = indice.fuentes_indicadores || {}; }

/* La fuente de cada gráfico, palabra por palabra como la dio Pedro. Los años
   son los de la operación estadística de origen (la serie de cifras oficiales
   arranca en 1996 aunque El Pinar empiece en 2008), así que no se calculan
   con los datos: con cada actualización se revisan a mano, e invariantes.py
   avisa si el año de referencia del índice deja de aparecer en ellas. */
const FUENTES_GRAFICOS = {
  evolucion: 'ISTAC. Cifras oficiales de población de los municipios, 1996–2025.',
  extranjero: 'ISTAC. Población según lugar de nacimiento, 2000–2025.',
  mapas: 'GRAFCAN, límites municipales; ISTAC, cifras de población 2025. Elaboración propia.',
  piramide: 'ISTAC. Población según sexo y grupos de edad, 2025. Elaboración propia.',
  piramide_nacimiento: 'ISTAC. Población según sexo, edad y lugar de nacimiento, 2025. Elaboración propia.',
  indices: 'ISTAC. Indicadores demográficos, 2025.',
  componentes: 'ISTAC. Movimiento natural de la población y estadística de migraciones, 2002–2024.',
  nacimiento: 'ISTAC. Población según lugar de nacimiento, 2025. Elaboración propia.',
};
function textoFuente(clave) { return `Fuente: ${FUENTES_GRAFICOS[clave]}`; }
function fuenteGrafico(clave) { return `<p class="fuente-grafico">${esc(textoFuente(clave))}</p>`; }
/* Pone (o actualiza) la línea de fuente al final de `elemento`; si ya existe
   solo cambia el texto, que es lo que hace la pirámide al cambiar de pestaña. */
function ponerFuente(elemento, id, clave) {
  if (!elemento || !FUENTES_GRAFICOS[clave]) return;
  let p = document.getElementById(id);
  if (!p) { p = document.createElement('p'); p.id = id; p.className = 'fuente-grafico'; elemento.append(p); }
  const texto = textoFuente(clave);
  if (p.textContent !== texto) p.textContent = texto;
}
/* Las siete tarjetas con gráfico de la ficha. `vistaPiramide` es la pestaña
   activa de la pirámide: la segunda dibuja otra tabla del ISTAC. Las cifras
   clave no llevan línea de fuente: no son un gráfico. */
function fuentesFicha(vistaPiramide = 0) {
  [['g-evolucion', 'evolucion'], ['g-extranjero', 'extranjero'], ['mapas', 'mapas'],
   ['g-piramide', vistaPiramide === 1 ? 'piramide_nacimiento' : 'piramide'],
   ['g-indices', 'indices'], ['g-componentes', 'componentes'], ['g-origen', 'nacimiento'],
  ].forEach(([id, clave]) => ponerFuente(document.getElementById(id)?.parentElement, `fuente-${id}`, clave));
}
const CODIGOS_INDICES = { envejecimiento: 'C10', juventud: 'C11', dependencia: 'C17', reemplazo: 'C14' };

function periodoDato(clave, f) {
  if (!f) return FUENTES_ACTUALES[clave]?.periodo || 'Fecha no disponible';
  if (CODIGOS_INDICES[clave]) return String(f.indices[CODIGOS_INDICES[clave]].anio);
  if (clave === 'tvma') return `${f.evolucion.anio_base}–${f.evolucion.anio_fin}`;
  if (clave === 'evolucion') return `${f.evolucion.anios[0]}–${f.evolucion.anios.at(-1)}`;
  if (clave === 'extranjero') {
    const anios = f.extranjero.anios.filter((a, i) => f.extranjero.municipio[i] != null);
    return `${anios[0]}–${anios.at(-1)}`;
  }
  if (clave === 'vegetativo' || clave === 'migratorio') {
    const anios = f.componentes.anios.filter((a, i) => f.componentes[clave][i] != null);
    return anios.length ? `${anios[0]}–${anios.at(-1)}` : 'Sin datos';
  }
  return `1 de enero de ${clave === 'nacimiento' ? f.origen.anio : f.anio}`;
}
function fuenteHTML(clave, f) {
  const fuente = FUENTES_ACTUALES[clave];
  if (!fuente) return '';
  const enlaces = fuente.enlaces.map((e) => `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.organismo)} · ${e.desde}–${e.hasta}<span class="oculto"> (abre otra pestaña)</span></a>`).join(' · ');
  return `<div class="fuente-dato"><p><b>${esc(fuente.titulo)}</b> · Datos: ${esc(periodoDato(clave, f))}.</p>
    <p>${esc(fuente.nota)}</p><p>${fuente.enlaces.length > 1 ? 'Enlaces' : 'Enlace'}: ${enlaces}.</p></div>`;
}
function ponerDetalle(elemento, id, html, firma, rotulo = 'Fuente y fecha') {
  if (!elemento) return;
  let detalle = document.getElementById(id);
  if (detalle?.dataset.firma === firma) return;
  const abierto = detalle?.open || false;
  if (!detalle) { detalle = document.createElement('details'); detalle.id = id; detalle.className = 'datos-detalle'; elemento.append(detalle); }
  detalle.innerHTML = `<summary>${rotulo}</summary><div class="datos-contenido">${html}</div>`;
  detalle.dataset.firma = firma; detalle.open = abierto;
}
/* Las cuatro secciones con gráfico del comparador; las cifras clave, como en
   la ficha, no llevan línea de fuente. */
function fuentesComparador() {
  [['cmp-piramides', 'piramide'], ['cmp-indices', 'indices'], ['cmp-nacimiento', 'nacimiento'], ['cmp-extranjero', 'extranjero']]
    .forEach(([id, clave]) => ponerFuente(document.getElementById(id), `fuente-${id}`, clave));
}

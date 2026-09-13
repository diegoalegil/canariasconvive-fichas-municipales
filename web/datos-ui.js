/* =============================================================================
   FUENTE Y DATOS DE CADA TARJETA
   Al pie de cada tarjeta, plegada, una línea «Fuente y datos»: de dónde sale el
   dato, de qué fecha o periodo es, cómo se calcula, y la tabla completa con
   los valores que el gráfico dibuja, para quien no pueda leer el gráfico o
   quiera el número exacto. Es descripción del dato, no interpretación, y va
   plegada para que la tarjeta cerrada siga siendo solo el gráfico. En papel no
   se imprime: la hoja lleva una línea de fuentes al pie.
   Las fuentes vienen de indice.json (`fuentes_indicadores`, leídas del índice
   del Excel por metadatos.py).
   ============================================================================= */
let FUENTES_ACTUALES = {};
function configurarFuentes(indice) { FUENTES_ACTUALES = indice.fuentes_indicadores || {}; }
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
    <p>${esc(fuente.nota)}</p><p>Fuente: ${enlaces}.</p></div>`;
}
function tablaDatos(titulo, columnas, filas) {
  return `<div class="tabla-scroll" role="region" aria-label="${esc(titulo)}" tabindex="0">
    <table class="tabla-datos"><caption>${esc(titulo)}</caption>
    <thead><tr>${columnas.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((fila) => `<tr>${fila.map((v, i) => i === 0
      ? `<th scope="row">${esc(v)}</th>` : `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function tablaPiramide(f) {
  const p = f.piramide;
  const total = p.hombres.reduce((a, b) => a + b, 0) + p.mujeres.reduce((a, b) => a + b, 0);
  const ext = p.extranjera_hombres.reduce((a, b) => a + b, 0) + p.extranjera_mujeres.reduce((a, b) => a + b, 0);
  const pc = (v, t) => t ? pct(v / t * 100, 2) : '—';
  const filas = p.edades.map((edad, i) => [edad, nf(p.hombres[i]), nf(p.mujeres[i]), pc(p.hombres[i], total), pc(p.mujeres[i], total),
    pct(p.canarias_hombres[i], 2), pct(p.canarias_mujeres[i], 2)]);
  const porNacimiento = p.edades.map((edad, i) => {
    const h = p.hombres[i] - p.extranjera_hombres[i], m = p.mujeres[i] - p.extranjera_mujeres[i];
    return [edad, nf(h), nf(m), pc(h, total - ext), pc(m, total - ext), nf(p.extranjera_hombres[i]), nf(p.extranjera_mujeres[i]), pc(p.extranjera_hombres[i], ext), pc(p.extranjera_mujeres[i], ext)];
  });
  return tablaDatos(`${f.nombre} · Municipio y Canarias`, ['Edad', 'Municipio: hombres (personas)', 'Municipio: mujeres (personas)', 'Municipio: hombres (%)', 'Municipio: mujeres (%)', 'Canarias: hombres (%)', 'Canarias: mujeres (%)'], filas)
    + tablaDatos(`${f.nombre} · Por lugar de nacimiento`, ['Edad', 'España: hombres (personas)', 'España: mujeres (personas)', 'España: hombres (%)', 'España: mujeres (%)', 'Extranjero: hombres (personas)', 'Extranjero: mujeres (personas)', 'Extranjero: hombres (%)', 'Extranjero: mujeres (%)'], porNacimiento);
}
function tablaEvolucion(f) {
  return tablaDatos(`${f.nombre} · Evolución`, ['Año', 'Habitantes'], f.evolucion.anios.map((a, i) => [a, nf(f.evolucion.valores[i])]));
}
function tablaExtranjero(f) {
  return tablaDatos(`${f.nombre} · Origen extranjero`, ['Año', 'Municipio (%)', 'Canarias (%)'], f.extranjero.anios.map((a, i) => [a, pct(f.extranjero.municipio[i], 2), pct(f.extranjero.canarias[i], 2)]));
}
function tablaComponentes(f) {
  const c = f.componentes;
  const valor = (clave, i) => {
    const anomalia = (c.anomalias || []).find((x) => x.serie === clave && x.anio === c.anios[i]);
    return anomalia ? `${nf(anomalia.valor)} (cambio administrativo; no representado)` : nf(c[clave][i]);
  };
  return tablaDatos(`${f.nombre} · Componentes del cambio`, ['Año', 'Crecimiento vegetativo (personas)', 'Saldo migratorio (personas)'], c.anios.map((a, i) => [a, valor('vegetativo', i), valor('migratorio', i)]));
}
function tablaNacimiento(f) {
  return tablaDatos(`${f.nombre} · Lugar de nacimiento`, ['Lugar', 'Municipio (%)', 'Canarias (%)'], f.origen.categorias.map((c, i) => [c, pct(f.origen.municipio[i]), pct(f.origen.canarias[i])]));
}
function tablaIndices(f) {
  return tablaDatos(`${f.nombre} · Índices`, ['Indicador', 'Municipio', 'Isla', 'Canarias', 'Año'], Object.values(CODIGOS_INDICES).map((c) => {
    const v = f.indices[c], dec = c === 'C10' ? 2 : 1;
    return [v.etiqueta, nf(v.municipio, dec), nf(v.isla, dec), nf(v.canarias, dec), v.anio];
  }));
}
function ponerDetalle(elemento, id, html, firma, rotulo = 'Fuente y datos') {
  if (!elemento) return;
  let detalle = document.getElementById(id);
  if (detalle?.dataset.firma === firma) return;
  const abierto = detalle?.open || false;
  if (!detalle) { detalle = document.createElement('details'); detalle.id = id; detalle.className = 'datos-detalle'; elemento.append(detalle); }
  detalle.innerHTML = `<summary>${rotulo}</summary><div class="datos-contenido">${html}</div>`;
  detalle.dataset.firma = firma; detalle.open = abierto;
}
function datosFicha(f) {
  const fuentes = (...claves) => claves.map((c) => fuenteHTML(c, f)).join('');
  const grupos = [
    ['cifras', fuentes('poblacion', 'tvma', 'edad', 'sexo'), 'Fuente y cálculo'],
    ['g-evolucion', tablaEvolucion(f) + fuentes('evolucion'), 'Fuente y datos'],
    ['g-extranjero', tablaExtranjero(f) + fuentes('extranjero'), 'Fuente y datos'],
    ['g-piramide', tablaPiramide(f) + fuentes('piramide'), 'Fuente y datos'],
    ['g-indices', tablaIndices(f) + fuentes(...Object.keys(CODIGOS_INDICES)), 'Fuente y datos'],
    ['g-componentes', tablaComponentes(f) + fuentes('vegetativo', 'migratorio'), 'Fuente y datos'],
    ['g-origen', tablaNacimiento(f) + fuentes('nacimiento'), 'Fuente y datos'],
    ['mapas', fuentes('rankings'), 'Fuente y cálculo'],
  ];
  grupos.forEach(([id, html, rotulo]) => ponerDetalle(document.getElementById(id)?.parentElement, `datos-${id}`, html, String(f.codmun), rotulo));
}
function datosComparador(fichas) {
  const fuente = (clave) => fichas.map((f) => `<p><b>${esc(f.nombre)}</b></p>${fuenteHTML(clave, f)}`).join('');
  const panel = (id, html, rotulo = 'Fuente y datos') => ponerDetalle(document.getElementById(id), `datos-${id}`, html, fichas.map((f) => f.codmun).join(','), rotulo);
  panel('cmp-cifras', fuente('poblacion') + fuente('edad') + fuente('tvma') + fuente('sexo'), 'Fuente y cálculo');
  panel('cmp-piramides', fichas.map(tablaPiramide).join('') + fuente('piramide'));
  panel('cmp-indices', fichas.map(tablaIndices).join('') + Object.keys(CODIGOS_INDICES).map(fuente).join(''));
  panel('cmp-nacimiento', fichas.map(tablaNacimiento).join('') + fuente('nacimiento'));
  panel('cmp-extranjero', fichas.map(tablaExtranjero).join('') + fuente('extranjero'));
}

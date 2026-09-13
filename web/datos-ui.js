/* =============================================================================
   FUENTE Y DATOS DE CADA TARJETA
   Al pie de cada gráfico, una línea «Fuente: …» con la redacción que fijó
   Pedro para cada uno (13 sep 2026), visible en pantalla y en papel. Debajo,
   plegada, «Datos y método»: de qué fecha o periodo es el dato, cómo se
   calcula, el enlace al recurso estadístico y la tabla completa con los
   valores que el gráfico dibuja, para quien no pueda leer el gráfico o quiera
   el número exacto. Es descripción del dato, no interpretación, y va plegada
   para que la tarjeta cerrada siga siendo el gráfico y su fuente. En papel el
   desplegable no se imprime.
   Los enlaces y periodos vienen de indice.json (`fuentes_indicadores`, leídos
   del índice del Excel por metadatos.py).
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
/* Pone (o actualiza) la línea de fuente al final de `elemento`. Va antes que el
   desplegable de datos porque se llama antes; si ya existe solo cambia el texto,
   que es lo que hace la pirámide al cambiar de pestaña. */
function ponerFuente(elemento, id, clave) {
  if (!elemento || !FUENTES_GRAFICOS[clave]) return;
  let p = document.getElementById(id);
  if (!p) { p = document.createElement('p'); p.id = id; p.className = 'fuente-grafico'; elemento.append(p); }
  const texto = textoFuente(clave);
  if (p.textContent !== texto) p.textContent = texto;
}
/* Las siete tarjetas con gráfico de la ficha. `vistaPiramide` es la pestaña
   activa de la pirámide: la segunda dibuja otra tabla del ISTAC. Las cifras
   clave no llevan línea de fuente: no son un gráfico y su procedencia va en
   «Método de cálculo». */
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
function ponerDetalle(elemento, id, html, firma, rotulo = 'Datos y método') {
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
    ['cifras', fuentes('poblacion', 'tvma', 'edad', 'sexo'), 'Método de cálculo'],
    ['g-evolucion', tablaEvolucion(f) + fuentes('evolucion'), 'Datos y método'],
    ['g-extranjero', tablaExtranjero(f) + fuentes('extranjero'), 'Datos y método'],
    ['g-piramide', tablaPiramide(f) + fuentes('piramide'), 'Datos y método'],
    ['g-indices', tablaIndices(f) + fuentes(...Object.keys(CODIGOS_INDICES)), 'Datos y método'],
    ['g-componentes', tablaComponentes(f) + fuentes('vegetativo', 'migratorio'), 'Datos y método'],
    ['g-origen', tablaNacimiento(f) + fuentes('nacimiento'), 'Datos y método'],
    ['mapas', fuentes('rankings'), 'Método de cálculo'],
  ];
  grupos.forEach(([id, html, rotulo]) => ponerDetalle(document.getElementById(id)?.parentElement, `datos-${id}`, html, String(f.codmun), rotulo));
}
function datosComparador(fichas) {
  const fuente = (clave) => fichas.map((f) => `<p><b>${esc(f.nombre)}</b></p>${fuenteHTML(clave, f)}`).join('');
  const panel = (id, html, rotulo = 'Datos y método') => ponerDetalle(document.getElementById(id), `datos-${id}`, html, fichas.map((f) => f.codmun).join(','), rotulo);
  [['cmp-piramides', 'piramide'], ['cmp-indices', 'indices'], ['cmp-nacimiento', 'nacimiento'], ['cmp-extranjero', 'extranjero']]
    .forEach(([id, clave]) => ponerFuente(document.getElementById(id), `fuente-${id}`, clave));
  panel('cmp-cifras', fuente('poblacion') + fuente('edad') + fuente('tvma') + fuente('sexo'), 'Método de cálculo');
  panel('cmp-piramides', fichas.map(tablaPiramide).join('') + fuente('piramide'));
  panel('cmp-indices', fichas.map(tablaIndices).join('') + Object.keys(CODIGOS_INDICES).map(fuente).join(''));
  panel('cmp-nacimiento', fichas.map(tablaNacimiento).join('') + fuente('nacimiento'));
  panel('cmp-extranjero', fichas.map(tablaExtranjero).join('') + fuente('extranjero'));
}

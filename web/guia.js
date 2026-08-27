/* =============================================================================
   GUÍA DE LECTURA DE LOS INDICADORES · CANARIAS CONVIVE

   El público de la ficha son concejales y cargos públicos, no demógrafos. Esta
   página explica la mecánica de cada indicador para que se lea bien, que es la
   única manera honesta de evitar que se lea mal: no se ponen conclusiones, se
   explica la cuenta.

   Ningún indicador tiene aquí un valor deseable. Todos describen cómo se
   reparte una población; ninguno la califica.

   Las cuatro definiciones de los índices no estaban escritas en ninguna parte:
   el diccionario del Excel da el nombre y la unidad, pero no la fórmula. Se
   dedujeron contrastando los valores ya calculados de Pedro contra la pirámide
   de población de los 88 municipios, y cuadran con menos de un 0,5 % de error
   máximo. El detalle está en el README.
   ============================================================================= */

const EJEMPLO = 38038;   // Santa Cruz de Tenerife

const nf = (v, d = 0) => v == null || !isFinite(v)
  ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------------------------------- micro-gráficos --- */
/** Dos bloques enfrentados: la cuenta que hace el índice, sin números reales.
 *  Explica la mecánica, no el caso. */
function division(arriba, abajo, propA, propB) {
  const w = 260, h = 118, alto = 24;
  const a = Math.max(14, propA * w), b = Math.max(14, propB * w);
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true">
    <text x="0" y="10" font-size="11" fill="#5F5E5A">${esc(arriba)}</text>
    <rect x="0" y="16" width="${a.toFixed(0)}" height="${alto}" rx="3" fill="#185FA5"/>
    <line x1="0" y1="52" x2="${w}" y2="52" stroke="#1A1A1A" stroke-width="1.4"/>
    <text x="0" y="72" font-size="11" fill="#5F5E5A">${esc(abajo)}</text>
    <rect x="0" y="78" width="${b.toFixed(0)}" height="${alto}" rx="3" fill="#85B7EB"/>
  </svg>`;
}

/** Serie de barras a un lado y otro del cero, para las dos componentes. */
function restaAnual() {
  const w = 260, h = 84, cero = h / 2;
  const vals = [12, -6, 18, 4, -14, 9, 22, -3, 15, 7];
  let out = `<line x1="0" y1="${cero}" x2="${w}" y2="${cero}" stroke="#6E6D69" stroke-width="1.2"/>`;
  vals.forEach((v, i) => {
    const x = 6 + i * 25, alt = Math.abs(v) * 1.5;
    out += `<rect x="${x}" y="${(v > 0 ? cero - alt : cero).toFixed(1)}" width="14" height="${alt.toFixed(1)}" rx="2" fill="#185FA5"/>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true">${out}
    <text x="0" y="${cero - 6}" font-size="10" fill="#5F5E5A">por encima de cero</text>
    <text x="0" y="${cero + 14}" font-size="10" fill="#5F5E5A">por debajo</text></svg>`;
}

/** Cien casillas con una parte marcada. */
function cien(p, color = '#185FA5') {
  const lado = 15, hueco = 4, paso = lado + hueco, w = paso * 10 - hueco;
  let c = '';
  for (let i = 0; i < 100; i++) {
    const fila = 9 - Math.floor(i / 10), col = i % 10;
    c += `<rect x="${col * paso}" y="${fila * paso}" width="${lado}" height="${lado}" rx="2" fill="${i < Math.round(p) ? color : '#DDE5EE'}"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${w}" width="${w}" height="${w}" aria-hidden="true">${c}</svg>`;
}

/** Barra apilada de tres tramos. */
function apilada(v, tonos) {
  const w = 260, h = 30;
  let x = 0, out = '';
  v.forEach((p, i) => {
    const a = p / 100 * w;
    out += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0, a - 1).toFixed(1)}" height="${h}" fill="${tonos[i]}"/>`;
    x += a;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">${out}</svg>`;
}

/* --------------------------------------------------------------- fichas --- */
function fichas(f) {
  const c = f.indices, o = f.origen;
  const ext = (() => { const v = f.extranjero.municipio; for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return v[i]; })();

  return [
    {
      id: 'envejecimiento', ico: 'edad', nombre: 'Índice de envejecimiento',
      tipo: 'Razón · compara dos grupos de edad entre sí',
      compara: 'Cuántas personas de <b>65 años o más</b> hay <b>por cada persona menor de 15</b>.',
      alto: 'el grupo de 65 y más es más numeroso que el de menores de 15. En 2, el doble.',
      bajo: 'hay más menores de 15 que personas de 65 o más. Un valor de 1 significa que los dos grupos son iguales.',
      noDice: 'nada sobre el tamaño de la población. Dos municipios con el mismo índice pueden tener 800 habitantes y 380.000.',
      viz: division('65 años o más', 'menores de 15', 0.72, 0.42),
      ejemplo: `En ${f.nombre} vale <b>${nf(c.C10.municipio, 2)}</b>: hay ${nf(c.C10.municipio, 2)} personas de 65 o más por cada menor de 15.`,
    },
    {
      id: 'juventud', ico: 'poblacion', nombre: 'Índice de juventud',
      tipo: 'Por cien · compara dos grupos de edad',
      compara: 'Cuántos <b>menores de 15 años</b> hay <b>por cada cien personas de 15 a 64</b>.',
      alto: 'los menores de 15 son numerosos frente al grupo de 15 a 64.',
      bajo: 'son pocos frente a ese grupo.',
      noDice: '<b>no es el porcentaje de menores de 15 sobre la población.</b> El divisor es el grupo de 15 a 64, no el total, así que el número sale más alto que ese porcentaje. Tampoco es lo contrario del envejecimiento: los dos pueden bajar a la vez si crece el grupo intermedio.',
      viz: division('menores de 15', 'de 15 a 64 años', 0.24, 0.9),
      ejemplo: `En ${f.nombre} vale <b>${nf(c.C11.municipio, 1)}</b>: ${nf(c.C11.municipio, 1)} menores de 15 por cada cien personas de 15 a 64.`,
    },
    {
      id: 'dependencia', ico: 'dependencia', nombre: 'Índice de dependencia',
      tipo: 'Por cien · compara tres grupos de edad',
      compara: 'Cuántas personas hay en <b>los dos extremos de edad juntos</b> —menores de 15 y mayores de 64— <b>por cada cien personas de 15 a 64</b>.',
      alto: 'los dos grupos de los extremos son numerosos frente al grupo central.',
      bajo: 'el grupo central es proporcionalmente mayor.',
      noDice: 'el nombre es una convención estadística por tramos de edad. <b>No mide quién trabaja, quién cobra una pensión ni quién cuida de alguien</b>: eso no está en el padrón.',
      viz: division('menores de 15 y mayores de 64', 'de 15 a 64 años', 0.5, 0.9),
      ejemplo: `En ${f.nombre} vale <b>${nf(c.C17.municipio, 1)}</b>: ${nf(c.C17.municipio, 1)} personas en los extremos de edad por cada cien en el tramo central.`,
    },
    {
      id: 'reemplazo', ico: 'relevo', nombre: 'Índice de reemplazo laboral',
      tipo: 'Por cien · compara dos grupos de edad',
      compara: 'Cuántas personas de <b>15 a 19 años</b> hay <b>por cada cien de 60 a 64</b>: el grupo que se acerca a la edad de trabajar frente al que se acerca a la de jubilarse.',
      alto: 'el grupo de 15 a 19 es más numeroso que el de 60 a 64.',
      bajo: 'el grupo que se acerca a los 65 es el más numeroso de los dos.',
      noDice: 'nada sobre empleo, paro ni actividad económica: cuenta edades del padrón, no puestos de trabajo. Y <b>no se puede calcular por separado para la población de origen extranjero</b>: se emigra sobre todo a partir de los 19 años, así que ese grupo está casi vacío en el numerador y el resultado sería tramposo.',
      viz: division('de 15 a 19 años', 'de 60 a 64 años', 0.5, 0.7),
      ejemplo: `En ${f.nombre} vale <b>${nf(c.C14.municipio, 1)}</b>: ${nf(c.C14.municipio, 1)} personas de 15 a 19 por cada cien de 60 a 64.`,
    },
    {
      id: 'vegetativo', ico: 'variacion', nombre: 'Crecimiento vegetativo',
      tipo: 'Resta de dos recuentos de un año · en personas',
      compara: 'Los <b>nacimientos</b> de un año menos las <b>defunciones</b> de ese mismo año entre las personas residentes en el municipio.',
      alto: 'por encima de cero, ese año hubo más nacimientos que defunciones.',
      bajo: 'por debajo de cero, lo contrario. Se escribe con el signo menos, sin color ni flecha.',
      noDice: 'no explica por sí solo si el municipio gana o pierde habitantes: para eso hay que sumarle el saldo migratorio, que en la mayoría de los municipios canarios pesa más.',
      viz: restaAnual(),
      ejemplo: 'En la ficha aparece como serie anual, no como un valor único: en un municipio pequeño, un solo año depende de muy pocos casos.',
    },
    {
      id: 'migratorio', ico: 'variacion', nombre: 'Saldo migratorio',
      tipo: 'Resta de dos recuentos de un año · en personas',
      compara: 'Las personas que se <b>dan de alta</b> en el padrón del municipio en un año menos las que se <b>dan de baja</b>, vengan o se vayan a donde vayan.',
      alto: 'por encima de cero, ese año se empadronaron más personas de las que se fueron.',
      bajo: 'por debajo de cero, lo contrario.',
      noDice: 'no distingue de dónde viene ni a dónde va cada persona: una mudanza entre dos municipios canarios cuenta igual que una llegada desde otro país. Tampoco recoge a quien no se empadrona.',
      viz: restaAnual(),
      ejemplo: 'Un cambio administrativo de términos municipales puede aparecer aquí como si fuera migración. Cuando pasa, la ficha lo aparta y lo explica en una nota.',
    },
    {
      id: 'nacimiento', ico: 'nacimiento', nombre: 'Lugar de nacimiento',
      tipo: 'Reparto en porcentaje · suma 100',
      compara: 'De cada cien habitantes del municipio, cuántos nacieron <b>en Canarias</b>, cuántos <b>en el resto de España</b> y cuántos <b>en el extranjero</b>.',
      alto: 'una parte grande de sus vecinos nació en ese lugar.',
      bajo: 'una parte pequeña. Los tres tramos suman siempre cien.',
      noDice: 'dónde nació alguien no dice cuánto tiempo lleva viviendo allí. Una persona nacida fuera puede llevar cuarenta años en el municipio y una nacida en Canarias haberse mudado el año pasado.',
      viz: apilada(o.municipio, ['#185FA5', '#6FA6D8', '#B5D4F4']),
      ejemplo: `En ${f.nombre}: ${o.categorias.map((cat, i) => `${nf(o.municipio[i], 1)} % ${cat.toLowerCase()}`).join(', ')}.`,
    },
    {
      id: 'extranjero', ico: 'extranjero', nombre: 'Población de origen extranjero',
      tipo: 'Porcentaje sobre el total de habitantes',
      compara: 'Qué parte de la población del municipio es de origen extranjero, año a año desde 2000, con la serie de Canarias superpuesta para dar contexto.',
      alto: 'esa parte es grande dentro del municipio.',
      bajo: 'es pequeña.',
      noDice: '<b>no es lo mismo que nacionalidad extranjera.</b> Muchas personas de origen extranjero tienen nacionalidad española, y no aparecen en las estadísticas de nacionalidad. En la práctica este dato y el tramo "extranjero" del bloque de lugar de nacimiento coinciden: en los 88 municipios se diferencian como mucho en una décima.',
      viz: cien(ext),
      ejemplo: `En ${f.nombre} es el <b>${nf(ext, 1)} %</b> de la población.`,
    },
  ];
}

/* -------------------------------------------------------------- montaje --- */
function pintar(f) {
  const lista = fichas(f);
  document.getElementById('guia-indice').innerHTML = lista.map((x) =>
    `<a href="#${x.id}">${esc(x.nombre.replace(/^Índice (de |del )?/, '').replace(/^./, (l) => l.toUpperCase()))}</a>`).join('');

  document.getElementById('guia-fichas').innerHTML = lista.map((x) => `
    <section class="tarjeta" id="${x.id}">
      <header class="rotulo" data-ico="${x.ico}">
        <div><h2>${esc(x.nombre)}</h2><p>${esc(x.tipo)}</p></div>
      </header>
      <div class="cuerpo guia-cuerpo">
        <div class="guia-texto">
          <div class="guia-bloque"><b>Qué compara</b><p>${x.compara}</p></div>
          <div class="guia-bloque"><b>Un valor alto</b><p>significa que ${x.alto}</p></div>
          <div class="guia-bloque"><b>Un valor bajo</b><p>significa que ${x.bajo}</p></div>
          <div class="guia-bloque guia-ojo"><b>Lo que no dice</b><p>${x.noDice}</p></div>
        </div>
        <div class="guia-viz">
          ${x.viz}
          <p class="guia-ejemplo">${x.ejemplo}</p>
        </div>
      </div>
    </section>`).join('');

  document.querySelectorAll('.rotulo[data-ico]').forEach((r) => {
    if (!r.querySelector('svg')) r.insertAdjacentHTML('afterbegin', icono(r.dataset.ico, 26));
  });
}

async function iniciar() {
  document.querySelectorAll('.btn[data-ico]').forEach((b) =>
    b.insertAdjacentHTML('afterbegin', icono(b.dataset.ico, 15)));
  const f = await (await fetch(`datos/mun/${EJEMPLO}.json`)).json();
  document.getElementById('guia-ejemplo-mun').textContent = f.nombre;
  pintar(f);
}

iniciar().catch((e) => {
  document.getElementById('guia-fichas').innerHTML =
    '<p class="cmp-vacio">No se han podido cargar los datos de ejemplo.</p>';
  console.error(e);
});

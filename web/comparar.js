/* Comparador de hasta tres municipios, de hasta tres islas o de las dos
   provincias: municipios con municipios, islas con islas y provincias con
   provincias, nunca mezclados. Comparar no es clasificar: no
   hay puestos ni umbrales, el color distingue columnas (nunca valores) y va
   pegado al territorio, y Canarias queda en gris como referencia. Lo que
   describe un reparto va en porcentaje sobre el propio total; los recuentos,
   como número. */

const MAXIMO = 3;
const TONOS_COL = ['#185FA5', '#2E75B6', '#85B7EB'];   // distinguen columna, no valor
const TONOS_ORIGEN = ['#185FA5', '#6FA6D8', '#B5D4F4'];
const GRIS_REF = '#9AA0A6';

let INDICE = null;
let ELEGIDOS = [];         // fichas completas, en el orden en que se añadieron
let ORDEN = 'poblacion';   // criterio de orden: una cifra clave o un índice
let MODO = 'municipios';   // 'municipios', 'islas' o 'provincias'
// Sube con cada cambio de modo: una petición lanzada en un modo anterior no
// cuenta al llegar, aunque se haya vuelto al mismo modo mientras tanto (si
// contara, las dos provincias entrarían dos veces).
let GENERACION = 0;

/** La serie propia de un bloque: «municipio», «isla» o «provincia» según la ficha. */
const propia = (bloque) => bloque.municipio ?? bloque.isla ?? bloque.provincia;
/** La clave de una ficha: código INE del municipio o identificador de la isla o de la provincia. */
const claveDe = (f) => f.tipo === 'municipio' ? String(f.codmun) : f.slug;
const CARPETAS = { municipios: 'mun', islas: 'isla', provincias: 'provincia' };
const rutaDatos = (clave) => `datos/${CARPETAS[MODO]}/${clave}.json`;

// Los rótulos que cambian con el modo.
const TEXTOS = {
  municipios: {
    titulo: 'Comparar municipios', intro: 'Hasta tres municipios a la vez.',
    vacio: 'Elige un municipio en el desplegable de arriba para empezar. Puedes comparar hasta tres.',
    anadir: 'Añadir municipio', ninguno: 'Ningún municipio elegido todavía', fallo: 'No se ha podido añadir el municipio.',
    nacimiento: 'Cada barra suma el 100 % de su municipio', extranjero: 'Porcentaje sobre el total de habitantes de cada municipio',
    tabla: 'Cifras clave por municipio', parametro: 'm',
  },
  islas: {
    titulo: 'Comparar islas', intro: 'Hasta tres islas a la vez.',
    vacio: 'Elige una isla en el desplegable de arriba para empezar. Puedes comparar hasta tres.',
    anadir: 'Añadir isla', ninguno: 'Ninguna isla elegida todavía', fallo: 'No se ha podido añadir la isla.',
    nacimiento: 'Cada barra suma el 100 % de su isla', extranjero: 'Porcentaje sobre el total de habitantes de cada isla',
    tabla: 'Cifras clave por isla', parametro: 'i',
  },
  provincias: {
    titulo: 'Comparar provincias', intro: 'Las dos provincias, una junto a otra.',
    vacio: 'Elige una provincia en el desplegable de arriba para empezar.',
    anadir: 'Añadir provincia', ninguno: 'Ninguna provincia elegida todavía', fallo: 'No se ha podido añadir la provincia.',
    nacimiento: 'Cada barra suma el 100 % de su provincia', extranjero: 'Porcentaje sobre el total de habitantes de cada provincia',
    tabla: 'Cifras clave por provincia', parametro: 'p',
  },
};

// Las columnas van siempre de mayor a menor por el criterio elegido (Pedro).
const CRITERIOS = {
  poblacion: (f) => f.poblacion, edad_media: (f) => f.cifras.edad_media, tvma: (f) => f.cifras.tvma,
  pct_mujeres: (f) => f.cifras.pct_mujeres, pct_hombres: (f) => f.cifras.pct_hombres,
  C10: (f) => propia(f.indices.C10), C11: (f) => propia(f.indices.C11),
  C17: (f) => propia(f.indices.C17), C14: (f) => propia(f.indices.C14),
};
function ordenados() {
  const valor = CRITERIOS[ORDEN] || CRITERIOS.poblacion;
  return [...ELEGIDOS].sort((a, b) => (valor(b) ?? -Infinity) - (valor(a) ?? -Infinity));
}

/** El color de un territorio es el del hueco que ocupó al elegirlo. */
const COLORES = new Map();
const PENDIENTES = new Set();
const ELECCION = new Map();
let secuenciaEleccion = 0;
const tono = (f) => COLORES.get(claveDe(f)) || TONOS_COL[0];
function reservarColor(codigo) {
  const usados = new Set([...ELEGIDOS.map(claveDe), ...PENDIENTES]
    .filter((c) => c !== codigo).map((c) => COLORES.get(c)));
  const anterior = COLORES.get(codigo);
  COLORES.set(codigo, anterior && !usados.has(anterior) ? anterior : TONOS_COL.find((c) => !usados.has(c)));
}

/* --------------------------------------------------------------- pirámide -- */
/** Pirámide en porcentaje sobre el total del propio municipio, con un eje común a las columnas. */
function piramide(f, tope, w) {
  const p = f.piramide, n = p.edades.length;
  const total = p.hombres.reduce((a, b) => a + b, 0) + p.mujeres.reduce((a, b) => a + b, 0);
  if (!total) return '';
  const H = p.hombres.map((v) => v / total * 100);
  const M = p.mujeres.map((v) => v / total * 100);

  const m = { t: 6, b: 20, l: 4, r: 4 };
  const h = 250;
  // Canal central para las edades, compactas («0–4», «100+»): a tres columnas no cabe más.
  const hueco = acotar(w * 0.16, 36, 54);
  const centro = w / 2, lado = centro - hueco / 2 - m.l;
  const fila = (h - m.t - m.b) / n, barra = fila * 0.78;
  const x = (v) => v / tope * lado;
  const y = (i) => m.t + (n - 1 - i) * fila;

  let barras = '', rejilla = '', eje = '';
  // Líneas de dos en dos; rótulo en el 0, el tope y, si hay sitio, el medio.
  for (let v = 0; v <= tope; v += 2) {
    for (const s of [-1, 1]) {
      const px = centro + s * (hueco / 2 + x(v));
      const extremo = v === tope;
      rejilla += `<line x1="${px.toFixed(1)}" y1="${m.t}" x2="${px.toFixed(1)}" y2="${h - m.b}" stroke="#D9D9D9"/>`;
      if (v === 0 || extremo || (tope % 4 === 0 && v === tope / 2)) {
        eje += `<text x="${px.toFixed(1)}" y="${h - 7}" `
             + `text-anchor="${extremo ? (s < 0 ? 'start' : 'end') : 'middle'}" `
             + `font-size="8.5" fill="#5F5E5A">${v}${UNI}%</text>`;
      }
    }
  }
  let edades = '';
  for (let i = 0; i < n; i++) {
    barras += `<rect x="${(centro - hueco / 2 - x(H[i])).toFixed(1)}" y="${y(i).toFixed(1)}" `
            + `width="${x(H[i]).toFixed(1)}" height="${barra.toFixed(1)}" fill="#2E75B6" rx="1"/>`
            + `<rect x="${(centro + hueco / 2).toFixed(1)}" y="${y(i).toFixed(1)}" `
            + `width="${x(M[i]).toFixed(1)}" height="${barra.toFixed(1)}" fill="#85B7EB" rx="1"/>`;
    edades += `<text x="${centro.toFixed(1)}" y="${(y(i) + barra / 2 + 2.6).toFixed(1)}" `
            + `text-anchor="middle" font-size="7.5" fill="#5F5E5A">`
            + `${esc(p.edades[i].replace(' a ', '\u2013').replace(' o más', '+'))}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" `
       + `aria-label="Pirámide de ${esc(f.nombre)} en porcentaje sobre su propia población">`
       + rejilla + barras + edades + eje + '</svg>';
}

/* ------------------------------------------------- barra apilada de origen -- */
function barraApilada(valores, w = 280) {
  const h = 26;
  let x = 0, out = '';
  valores.forEach((v, i) => {
    const a = (v ?? 0) / 100 * w;
    out += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0, a - 1).toFixed(1)}" height="${h}" fill="${TONOS_ORIGEN[i]}"/>`;
    x += a;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">${out}</svg>`;
}

/* ------------------------------------------------------------- anillo ------ */
/** Anillo de dos sectores: el porcentaje en el color del municipio y el resto en gris. */
function anillo(porcentaje, color, radio = 62, grosor = 22) {
  const w = radio * 2, cx = radio, cy = radio, re = radio - 1, ri = radio - grosor;
  const Pt = (a, r) => `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`;
  const sector = (a0, a1, fill) => {
    const g = a1 - a0 > Math.PI ? 1 : 0;
    return `<path d="M${Pt(a0, re)}A${re},${re} 0 ${g},1 ${Pt(a1, re)}`
         + `L${Pt(a1, ri)}A${ri},${ri} 0 ${g},0 ${Pt(a0, ri)}Z" `
         + `fill="${fill}" stroke="#FFFFFF" stroke-width="1.4"/>`;
  };
  // Un sector de vuelta entera no se puede trazar con un solo arco.
  const f = acotar((porcentaje || 0) / 100, 0, 1);
  const a0 = -Math.PI / 2, aq = a0 + Math.min(f, 0.9995) * 2 * Math.PI;
  let out = '';
  if (f > 0.0005) out += sector(a0, aq, color);
  if (f < 0.9995) out += sector(aq, a0 + 2 * Math.PI, '#DDE5EE');
  return `<svg viewBox="0 0 ${w} ${w}" width="${w}" height="${w}" aria-hidden="true">${out}</svg>`;
}

/* ------------------------------------------------------------- secciones --- */
function seccionCifras() {
  const filas = [
    ['Habitantes', 'personas', (f) => nf(f.poblacion)],
    ['Edad media', 'años', (f) => nf(f.cifras.edad_media, 1)],
    ['Variación media anual', '% medio por año',
      (f) => `${f.cifras.tvma >= 0 ? '+' : '−'}${nf(Math.abs(f.cifras.tvma), 1)}${UNI}%`
           + `<em>${f.evolucion.anio_base}–${f.evolucion.anio_fin}</em>`],
    ['Mujeres', '% del total', (f) => pct(f.cifras.pct_mujeres)],
    ['Hombres', '% del total', (f) => pct(f.cifras.pct_hombres)],
  ];
  const municipios = ordenados();
  return `<table class="cmp-tabla" role="table">
    <caption class="oculto">${TEXTOS[MODO].tabla}</caption>
    <thead role="rowgroup"><tr role="row"><th class="cmp-cab" scope="col" role="columnheader">Indicador</th>
    ${municipios.map((f) => `<th class="cmp-cab" scope="col" role="columnheader"><b>${esc(f.nombre)}</b><span>${esc(f.tipo === 'isla' ? 'Isla' : f.tipo === 'provincia' ? 'Provincia' : f.isla)}</span><i class="marca-municipio" style="background:${tono(f)}"></i></th>`).join('')}
    </tr></thead><tbody role="rowgroup">
    ${filas.map(([rot, uni, fn], i) => `<tr role="row">
      <th class="cmp-rot" scope="row" role="rowheader" id="cmp-fila-${i}"><b>${rot}</b><span>${uni}</span></th>
      ${municipios.map((f) => `<td role="cell" class="cmp-val" data-mun="${esc(f.nombre)}" style="--c:${tono(f)}"><span class="cmp-dato">${fn(f)}</span></td>`).join('')}
    </tr>`).join('')}
    </tbody></table>`;
}

function seccionPiramides(ancho) {
  // El mismo eje para las tres, en la escalera de pares de la ficha (comun.js).
  const tope = ejeAutomatico(Math.max(...ELEGIDOS.flatMap((f) => {
    const p = f.piramide, t = p.hombres.reduce((a, b) => a + b, 0) + p.mujeres.reduce((a, b) => a + b, 0);
    return t ? [...p.hombres, ...p.mujeres].map((v) => v / t * 100) : [0];
  })));

  return `<div class="cmp-cols" style="--cols:${ELEGIDOS.length}">
    ${ordenados().map((f) => `
      <div class="cmp-col">
        <h3 style="color:var(--azul)">${esc(f.nombre)}</h3>
        ${piramide(f, tope, ancho)}
      </div>`).join('')}
  </div>
  <div class="leyenda">
    <span><i class="llave" style="background:#2E75B6"></i>Hombres</span>
    <span><i class="llave" style="background:#85B7EB"></i>Mujeres</span>
  </div>`;
}

function seccionIndices() {
  const codigos = ['C10', 'C11', 'C17', 'C14'];
  const comoSeLee = {
    C10: 'personas de 65 y más por cada persona menor de 15',
    C11: 'menores de 15 por cada cien personas de 15 a 64',
    C17: 'menores de 15 y mayores de 64 por cada cien personas de 15 a 64',
    C14: 'personas de 15 a 19 por cada cien de 60 a 64',
  };
  return codigos.map((cod) => {
    const ref = ELEGIDOS[0].indices[cod].canarias;
    const dec = cod === 'C10' ? 2 : 1;
    // El mismo bloque que la ficha, de mayor a menor y con Canarias en gris al
    // final; el color es el del municipio, no el de la posición.
    const filas = [...ELEGIDOS].sort((a, b) =>
      (propia(b.indices[cod]) ?? -Infinity) - (propia(a.indices[cod]) ?? -Infinity));
    return `<div class="cmp-indice">
      <div class="cmp-indice-tit">
        <b>${esc(ELEGIDOS[0].indices[cod].etiqueta)}</b>
        <span>${comoSeLee[cod]}</span>
      </div>
      <div class="escala" style="--n:${filas.length + 1}">
        ${filas.map((f) => `
        <div class="peldano">
          <span style="color:var(--azul)">${esc(f.nombre)}</span>
          <b>${nf(propia(f.indices[cod]), dec)}</b>
          <i style="background:${tono(f)}"></i>
        </div>`).join('')}
        <div class="peldano cmp-ref">
          <span>Canarias</span>
          <b>${nf(ref, dec)}</b>
          <i style="background:${GRIS_REF}"></i>
        </div>
      </div>
    </div>`;
  }).join('');
}

function seccionNacimiento() {
  const cats = ELEGIDOS[0].origen.categorias;
  // El rótulo de cada municipio va en azul; el de Canarias, la referencia, en negro.
  // Cada cifra va del tono de su tramo de la barra (Pedro).
  const fila = (rot, vals, municipio) => `
    <div class="cmp-apilada">
      <span class="cmp-barra-rot" ${municipio ? 'style="color:var(--azul)"' : ''}>${esc(rot)}</span>
      ${barraApilada(vals)}
      <span class="cmp-barra-val">${vals.map((v, i) => `<b style="color:${TONOS_ORIGEN[i]}">${nf(v, 1)}</b>`).join(' · ')}</span>
    </div>`;
  return `
    ${ordenados().map((f) => fila(f.nombre, propia(f.origen), true)).join('')}
    ${fila('Canarias', ELEGIDOS[0].origen.canarias, false)}
    <div class="leyenda">
      ${cats.map((c, i) => `<span><i class="llave" style="background:${TONOS_ORIGEN[i]}"></i>${esc(c)}</span>`).join('')}
    </div>`;
}

/** Una sola magnitud: los anillos van del mismo azul y de mayor a menor (Pedro). */
function seccionExtranjero() {
  const canarias = ultimoValido(ELEGIDOS[0].extranjero.canarias);
  const porValor = ELEGIDOS.map((f) => [f, ultimoValido(propia(f.extranjero))]).sort((a, b) => (b[1] ?? -Infinity) - (a[1] ?? -Infinity));
  return `<div class="cmp-cols" style="--cols:${ELEGIDOS.length}">
      ${porValor.map(([f, v]) => `<div class="cmp-col">
          <h3 style="color:var(--azul)">${esc(f.nombre)}</h3>
          <p><b>${pct(v)}</b> de su población</p>
          ${anillo(v, '#185FA5')}
        </div>`).join('')}
    </div>
    <p class="cmp-escala">En el conjunto de Canarias son ${pct(canarias)}.</p>`;
}

/* ---------------------------------------------------------------- montaje -- */
function anchoColumna() {
  const cont = document.getElementById('cmp-piramides');
  const total = cont ? cont.clientWidth : 900;
  const cols = innerWidth <= 780 ? 1 : ELEGIDOS.length;
  return Math.max(150, Math.floor((total - 20 * (cols - 1)) / cols));
}

/** `cruzar`: al añadir, quitar o reordenar, las secciones cambian por cruce con
 *  desenfoque; al redibujar por un cambio de ancho, en seco. */
function pintar(cruzar = false) {
  const soltar = cruzar ? cruce('#cmp-elegidos, #cmp-cifras, #cmp-piramides, #cmp-indices, #cmp-nacimiento, #cmp-extranjero') : () => {};
  const vacio = ELEGIDOS.length === 0;
  document.getElementById('cmp-vacio').hidden = !vacio;
  document.getElementById('cmp-resultado').hidden = vacio;
  pintarElegidos();
  // ?m=38038,35016, ?i=tenerife,la-palma o ?p=las-palmas; sin nada elegido,
  // ?islas o ?provincias conserva el modo.
  const parametro = TEXTOS[MODO].parametro;
  history.replaceState(null, '', conMarca(ELEGIDOS.length ? `?${parametro}=${ELEGIDOS.map(claveDe).join(',')}`
    : MODO === 'municipios' ? location.pathname : `?${MODO}`));
  if (vacio) { soltar(); return; }

  document.getElementById('cmp-cifras').innerHTML = seccionCifras();
  document.getElementById('cmp-piramides').innerHTML = seccionPiramides(anchoColumna());
  document.getElementById('cmp-indices').innerHTML = seccionIndices();
  document.getElementById('cmp-nacimiento').innerHTML = seccionNacimiento();
  document.getElementById('cmp-extranjero').innerHTML = seccionExtranjero();
  fuentesComparador();
  soltar();
}

function pintarElegidos() {
  const cont = document.getElementById('cmp-elegidos');
  cont.innerHTML = ordenados().map((f) => `
    <span class="cmp-ficha" style="--c:${tono(f)}">
      <b>${esc(f.nombre)}</b>
      <button type="button" data-quitar="${claveDe(f)}" aria-label="Quitar ${esc(f.nombre)} de la comparación">×</button>
    </span>`).join('') || `<span class="cmp-ninguno">${TEXTOS[MODO].ninguno}</span>`;
  cont.querySelectorAll('[data-quitar]').forEach((b) =>
    b.addEventListener('click', () => quitar(b.dataset.quitar)));
  document.getElementById('cmp-cuenta').textContent =
    `${ELEGIDOS.length} de ${MAXIMO}`;
  document.getElementById('sel-anadir').disabled = ELEGIDOS.length + PENDIENTES.size >= MAXIMO;
  document.getElementById('cmp-cuenta').textContent += PENDIENTES.size ? ` · ${PENDIENTES.size} cargando` : '';
}

async function anadir(clave) {
  const codigo = String(clave), generacion = GENERACION;
  const repetido = () => ELEGIDOS.some((f) => claveDe(f) === codigo);
  if (ELEGIDOS.length + PENDIENTES.size >= MAXIMO || PENDIENTES.has(codigo) || repetido()) return;
  PENDIENTES.add(codigo); reservarColor(codigo);
  ELECCION.set(codigo, ++secuenciaEleccion);
  pintarElegidos();
  avisoCarga('estado-comparador');
  try {
    const f = await leerJSON(rutaDatos(codigo));
    if (generacion !== GENERACION) return;   // se cambió de modo mientras cargaba: ya no cuenta
    if (repetido() || ELEGIDOS.length >= MAXIMO) return;
    ELEGIDOS.push(f);
    ELEGIDOS.sort((a, b) => ELECCION.get(claveDe(a)) - ELECCION.get(claveDe(b)));
    PENDIENTES.delete(codigo);
    pintar(true);
  } catch (error) {
    if (generacion !== GENERACION) return;
    avisoCarga('estado-comparador', TEXTOS[MODO].fallo, () => anadir(codigo));
    if (!ELEGIDOS.length) pintar();
  } finally {
    PENDIENTES.delete(codigo); pintarElegidos();
  }
}

function quitar(clave) {
  // Si se quita con el teclado, el foco pasa al siguiente botón de quitar o al selector de añadir.
  const teniaFoco = document.activeElement?.dataset?.quitar === String(clave);
  ELEGIDOS = ELEGIDOS.filter((f) => claveDe(f) !== String(clave));
  pintar(true);
  if (teniaFoco) (document.querySelector('#cmp-elegidos [data-quitar]') || document.getElementById('sel-anadir')).focus();
}

let temporizador = null, anchoPrevio = window.innerWidth;
addEventListener('resize', () => {
  if (!ELEGIDOS.length || innerWidth === anchoPrevio) return;
  anchoPrevio = innerWidth;
  clearTimeout(temporizador);
  temporizador = setTimeout(pintar, 180);
});

async function iniciar() {
  document.querySelectorAll('.rotulo[data-ico]').forEach((r) =>
    r.insertAdjacentHTML('afterbegin', icono(r.dataset.ico, 26)));
  document.querySelectorAll('.btn[data-ico]').forEach((b) =>
    b.insertAdjacentHTML('afterbegin', icono(b.dataset.ico, 15)));

  INDICE = await leerJSON('datos/indice.json');

  // Dos desplegables, un solo criterio: elegir en uno deja el otro sin elección.
  const selectores = ['sel-orden-cifras', 'sel-orden-indices'].map((id) => document.getElementById(id));
  selectores.forEach((sel) => sel.addEventListener('change', () => {
    if (!sel.value) { sel.value = [...sel.options].some((o) => o.value === ORDEN) ? ORDEN : ''; return; }
    ORDEN = sel.value;
    selectores.forEach((otro) => { if (otro !== sel) otro.value = ''; });
    if (ELEGIDOS.length) pintar(true);
  }));

  const sel = document.getElementById('sel-anadir');
  sel.addEventListener('change', () => {
    if (sel.value) anadir(sel.value);
    sel.value = '';
  });
  document.querySelectorAll('.cmp-modo .vista').forEach((b) =>
    b.addEventListener('click', () => cambiarModo(b.dataset.modo)));

  const params = new URLSearchParams(location.search);
  const modo = params.has('p') || params.has('provincias') ? 'provincias' : params.has('i') || params.has('islas') ? 'islas' : 'municipios';
  ponerModo(modo);
  const pedidos = modo === 'provincias'
    // Sin provincias pedidas van las dos: comparar por provincia es compararlas.
    ? (params.get('p') || INDICE.provincias.map((p) => p.slug).join(',')).split(',').filter((c) => INDICE.provincias.some((x) => x.slug === c))
    : modo === 'islas'
    ? (params.get('i') || '').split(',').filter((c) => INDICE.islas_resumen.some((x) => x.slug === c))
    : (params.get('m') || '').split(',').filter((c) => INDICE.municipios.some((m) => String(m.codmun) === c));
  for (const c of pedidos.slice(0, MAXIMO)) await anadir(c);
  if (!ELEGIDOS.length) pintar();
}

/** Rótulos y desplegable del modo; no toca lo elegido. */
function ponerModo(modo) {
  MODO = modo;
  const T = TEXTOS[modo];
  document.title = tituloPagina(T.titulo);
  document.getElementById('cmp-titulo').textContent = T.titulo;
  document.getElementById('cmp-intro').textContent = T.intro;
  document.getElementById('cmp-vacio').textContent = T.vacio;
  document.getElementById('rot-anadir').textContent = T.anadir;
  document.getElementById('sub-nacimiento').textContent = T.nacimiento;
  document.getElementById('sub-extranjero').textContent = T.extranjero;
  document.querySelectorAll('.cmp-modo .vista').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === modo)));
  const sel = document.getElementById('sel-anadir');
  sel.innerHTML = `<option value="">${T.anadir}…</option>` + (modo === 'provincias'
    ? INDICE.provincias.map((p) => `<option value="${p.slug}">${esc(p.nombre)}</option>`).join('')
    : modo === 'islas'
    ? INDICE.islas_resumen.map((i) => `<option value="${i.slug}">${esc(i.nombre)}</option>`).join('')
    : Object.entries(INDICE.islas).map(([isla, muns]) =>
        `<optgroup label="${esc(isla)}">` + muns.map((n) => {
          const m = INDICE.municipios.find((x) => x.nombre === n);
          return m ? `<option value="${m.codmun}">${esc(n)}</option>` : '';
        }).join('') + '</optgroup>').join(''));
}

/** Cambiar de modo vacía la comparación: municipios con municipios, islas con
 *  islas, provincias con provincias (y estas entran las dos de golpe). */
function cambiarModo(modo) {
  if (modo === MODO) return;
  GENERACION++;
  ELEGIDOS = []; PENDIENTES.clear(); COLORES.clear(); ELECCION.clear();
  avisoCarga('estado-comparador');
  ponerModo(modo);
  pintar(true);
  if (modo === 'provincias') INDICE.provincias.forEach((p) => anadir(p.slug));
}

iniciar().catch((e) => {
  avisoCarga('estado-comparador', 'No se han podido cargar los datos.', () => location.reload());
  console.error(e);
});

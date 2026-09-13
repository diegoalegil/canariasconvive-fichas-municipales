/* =============================================================================
   COMPARADOR DE MUNICIPIOS · CANARIAS CONVIVE

   Los dos criterios de Pedro siguen mandando, y aquí aparece un tercero que se
   deriva de ellos:

   1. Ningún color de alerta sobre personas.
   2. La ficha muestra datos y no los interpreta.
   3. **Comparar no es clasificar.** Sí hay ahora un control que ordena las
      columnas —por habitantes o por nombre, que Pedro pidió— pero no hay
      posiciones, ni destacados, ni umbrales. En el bloque de índices las filas
      sí van de mayor a menor —Pedro lo pidió: "el mayor arriba"— pero eso
      ordena una lista, no puntúa a nadie: no hay puesto, ni medalla, y
      Canarias se queda abajo en gris, de referencia y no de competidor. El
      color distingue columnas, nunca valores, y va pegado al municipio: al
      reordenar, cada uno se lleva el suyo. Si el color cambiara de sitio, el
      orden parecería significar algo.

   La decisión de escala: todo lo que describe cómo se reparte una población va
   en porcentaje sobre su propio total, así que Betancuria (805 habitantes) y
   Las Palmas (384.023) ocupan el mismo ancho. Lo que es un recuento o una
   magnitud con unidad propia se imprime como número, sin barra: una barra de
   384.023 frente a 805 dejaría a la segunda en menos de un píxel y solo diría
   cuál es más grande, que ya lo dice la cifra.
   ============================================================================= */

const MAXIMO = 3;
const TONOS_COL = ['#185FA5', '#2E75B6', '#85B7EB'];   // distinguen columna, no valor
const TONOS_ORIGEN = ['#185FA5', '#6FA6D8', '#B5D4F4'];
const GRIS_REF = '#9AA0A6';


let INDICE = null;
let ELEGIDOS = [];        // fichas completas, en el orden en que las añadió el usuario
let ORDEN = 'poblacion';   // lo que molestaba a Pedro era el orden de selección

/** Las fichas en el orden de presentación. `ELEGIDOS` guarda siempre el orden
 *  de elección, que es el que decide qué color le toca a cada una. */
function ordenados() {
  const l = [...ELEGIDOS];
  if (ORDEN === 'poblacion') l.sort((a, b) => b.poblacion - a.poblacion);
  if (ORDEN === 'nombre') l.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return l;
}

/** El color de un municipio es el del hueco que ocupó al elegirlo. */
const COLORES = new Map();
const PENDIENTES = new Set();
const ELECCION = new Map();
let secuenciaEleccion = 0;
const tono = (f) => COLORES.get(String(f.codmun)) || TONOS_COL[0];
function reservarColor(codigo) {
  const usados = new Set([...ELEGIDOS.map((f) => String(f.codmun)), ...PENDIENTES]
    .filter((c) => c !== codigo).map((c) => COLORES.get(c)));
  const anterior = COLORES.get(codigo);
  COLORES.set(codigo, anterior && !usados.has(anterior) ? anterior : TONOS_COL.find((c) => !usados.has(c)));
}

/* --------------------------------------------------------------- pirámide -- */
/** Pirámide en porcentaje sobre el total del propio municipio. El eje es común
 *  a todas las columnas para que las siluetas se puedan comparar. */
function piramide(f, tope, w) {
  const p = f.piramide, n = p.edades.length;
  const total = p.hombres.reduce((a, b) => a + b, 0) + p.mujeres.reduce((a, b) => a + b, 0);
  if (!total) return '';
  const H = p.hombres.map((v) => v / total * 100);
  const M = p.mujeres.map((v) => v / total * 100);

  const m = { t: 6, b: 20, l: 4, r: 4 };
  const h = 250;
  // El hueco central deja sitio al eje de edad. Las etiquetas van compactas
  // —"0–4", "100+"— porque a tres columnas no cabe "100 o más".
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
/** El mismo gráfico circular que la ficha, aquí con dos sectores. Sustituye al
 *  mosaico de cien cuadros por la razón que dio Pedro del lugar de nacimiento:
 *  "al ser porcentajes con decimal, en gráfico circular sería más preciso". El
 *  mosaico redondeaba —un 12,4 % se dibujaba con doce cuadros— y encima decía
 *  al pie que cada cuadro era un uno por ciento, que no era verdad. */
function anillo(porcentaje, color, radio = 62, grosor = 22) {
  const w = radio * 2, cx = radio, cy = radio, re = radio - 1, ri = radio - grosor;
  const Pt = (a, r) => `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`;
  const sector = (a0, a1, fill) => {
    const g = a1 - a0 > Math.PI ? 1 : 0;
    return `<path d="M${Pt(a0, re)}A${re},${re} 0 ${g},1 ${Pt(a1, re)}`
         + `L${Pt(a1, ri)}A${ri},${ri} 0 ${g},0 ${Pt(a0, ri)}Z" `
         + `fill="${fill}" stroke="#FFFFFF" stroke-width="1.4"/>`;
  };
  // Un sector de vuelta entera no se traza con un solo arco: los dos extremos
  // caerían en el mismo punto y el camino saldría vacío.
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
    ['Habitantes', 'personas', (f) => nf(f.poblacion), null],
    ['Edad media', 'años', (f) => nf(f.cifras.edad_media, 1), null],
    ['Variación media anual', '% medio por año',
      (f) => `${f.cifras.tvma >= 0 ? '+' : '−'}${nf(Math.abs(f.cifras.tvma), 1)}${UNI}%`
           + `<em>${f.evolucion.anio_base}–${f.evolucion.anio_fin}</em>`, null],
    ['Mujeres', '% del total', (f) => pct(f.cifras.pct_mujeres), null],
    ['Hombres', '% del total', (f) => pct(f.cifras.pct_hombres), null],
  ];
  const municipios = ordenados();
  return `<table class="cmp-tabla" role="table">
    <caption class="oculto">Cifras clave por municipio</caption>
    <thead role="rowgroup"><tr role="row"><th class="cmp-cab" scope="col" role="columnheader">Indicador</th>
    ${municipios.map((f) => `<th class="cmp-cab" scope="col" role="columnheader"><b>${esc(f.nombre)}</b><span>${esc(f.isla)}</span><i class="marca-municipio" style="background:${tono(f)}"></i></th>`).join('')}
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
        ${f.poblacion < 5000 ? `<p class="cmp-aviso">Con ${nf(f.poblacion)} habitantes, cada franja de cinco años reúne pocas personas y la silueta sale irregular. No se ha suavizado.</p>` : ''}
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
    /* El mismo bloque que la ficha —rótulo, valor grande y pastilla de color—,
       que es lo que pidió Pedro: "ordenar igual que está eso pero con los
       nombres de los municipios, 3 colores, de mayor a menor y Canarias como
       eje gris al lado… ordenarlo de izquierda a derecha con el color
       respectivo, como hacemos en la página de visualización". Aquí sí de
       mayor a menor, que es lo que dijo para el comparador; el color es el de
       cada municipio y no el de la posición, para que al reordenar cada uno se
       lleve el suyo. La barra medida de antes era lo que le desconcertaba:
       "no sabe el eje que está aportando". */
    const filas = [...ELEGIDOS].sort((a, b) =>
      (b.indices[cod].municipio ?? -Infinity) - (a.indices[cod].municipio ?? -Infinity));
    return `<div class="cmp-indice">
      <div class="cmp-indice-tit">
        <b>${esc(INDICE.rangos_indices[cod].etiqueta)}</b>
        <span>${comoSeLee[cod]}</span>
      </div>
      <div class="escala" style="--n:${filas.length + 1}">
        ${filas.map((f) => `
        <div class="peldano">
          <span style="color:var(--azul)">${esc(f.nombre)}</span>
          <b>${nf(f.indices[cod].municipio, dec)}</b>
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
  const fila = (rot, vals, color) => `
    <div class="cmp-apilada">
      <span class="cmp-barra-rot" ${color ? 'style="color:var(--azul)"' : ''}>${esc(rot)}</span>
      ${barraApilada(vals)}
      <span class="cmp-barra-val">${vals.map((v) => nf(v, 1)).join(' · ')}</span>
    </div>`;
  return `
    ${ordenados().map((f) => fila(f.nombre, f.origen.municipio, tono(f))).join('')}
    ${fila('Canarias', ELEGIDOS[0].origen.canarias, null)}
    <div class="leyenda">
      ${cats.map((c, i) => `<span><i class="llave" style="background:${TONOS_ORIGEN[i]}"></i>${esc(c)}</span>`).join('')}
    </div>
    <p class="cmp-escala">Cada barra suma el 100 % de la población de su municipio, así que se pueden comparar entre sí sea cual sea su tamaño.</p>`;
}

function ultimo(v) { for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return v[i]; return null; }

function seccionExtranjero() {
  const canarias = ultimo(ELEGIDOS[0].extranjero.canarias);
  return `<div class="cmp-cols" style="--cols:${ELEGIDOS.length}">
      ${ordenados().map((f) => {
        const v = ultimo(f.extranjero.municipio);
        return `<div class="cmp-col">
          <h3 style="color:var(--azul)">${esc(f.nombre)}</h3>
          <p><b>${pct(v)}</b> de su población</p>
          ${anillo(v, tono(f))}
        </div>`;
      }).join('')}
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

/* `cruzar`: al añadir, quitar o reordenar, cada sección cambia por cruce con
   desenfoque (comun.js). Al redibujar por un cambio de ancho, en seco. */
function pintar(cruzar = false) {
  const soltar = cruzar ? cruce('#cmp-elegidos, #cmp-cifras, #cmp-piramides, #cmp-indices, #cmp-nacimiento, #cmp-extranjero') : () => {};
  const vacio = ELEGIDOS.length === 0;
  document.getElementById('cmp-vacio').hidden = !vacio;
  document.getElementById('cmp-resultado').hidden = vacio;
  pintarElegidos();
  history.replaceState(null, '', ELEGIDOS.length ? `?m=${ELEGIDOS.map((f) => f.codmun).join(',')}` : location.pathname);
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
  cont.innerHTML = ELEGIDOS.map((f) => `
    <span class="cmp-ficha" style="--c:${tono(f)}">
      <b>${esc(f.nombre)}</b>
      <button type="button" data-quitar="${f.codmun}" aria-label="Quitar ${esc(f.nombre)} de la comparación">×</button>
    </span>`).join('') || '<span class="cmp-ninguno">Ningún municipio elegido todavía</span>';
  cont.querySelectorAll('[data-quitar]').forEach((b) =>
    b.addEventListener('click', () => quitar(b.dataset.quitar)));
  document.getElementById('cmp-cuenta').textContent =
    `${ELEGIDOS.length} de ${MAXIMO}`;
  document.getElementById('sel-anadir').disabled = ELEGIDOS.length + PENDIENTES.size >= MAXIMO;
  document.getElementById('cmp-cuenta').textContent += PENDIENTES.size ? ` · ${PENDIENTES.size} cargando` : '';
}

async function anadir(codmun) {
  const codigo = String(codmun);
  if (ELEGIDOS.length + PENDIENTES.size >= MAXIMO || PENDIENTES.has(codigo)
      || ELEGIDOS.some((f) => String(f.codmun) === codigo)) return;
  PENDIENTES.add(codigo); reservarColor(codigo);
  ELECCION.set(codigo, ++secuenciaEleccion);
  pintarElegidos();
  avisoCarga('estado-comparador');
  try {
    const f = await leerJSON(`datos/mun/${codigo}.json`);
    ELEGIDOS.push(f);
    ELEGIDOS.sort((a, b) => ELECCION.get(String(a.codmun)) - ELECCION.get(String(b.codmun)));
    PENDIENTES.delete(codigo);
    pintar(true);
  } catch (error) {
    avisoCarga('estado-comparador', 'No se ha podido añadir el municipio.', () => anadir(codigo));
    if (!ELEGIDOS.length) pintar();
  } finally {
    PENDIENTES.delete(codigo); pintarElegidos();
  }
}

function quitar(codmun) {
  ELEGIDOS = ELEGIDOS.filter((f) => String(f.codmun) !== String(codmun));
  pintar(true);
}

function montarIconos() {
  document.querySelectorAll('[data-ico], [data-ico-fin]').forEach((e) => {
    const px = Number(e.dataset.px) || 18;
    if (e.dataset.ico) e.insertAdjacentHTML('afterbegin', icono(e.dataset.ico, px));
    if (e.dataset.icoFin) e.insertAdjacentHTML('beforeend', icono(e.dataset.icoFin, px));
  });
  document.querySelectorAll('.rotulo[data-ico]').forEach(() => {});
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

  document.getElementById('sel-orden').addEventListener('change', (e) => {
    ORDEN = e.target.value;
    if (ELEGIDOS.length) pintar(true);
  });

  const sel = document.getElementById('sel-anadir');
  sel.innerHTML = '<option value="">Añadir municipio…</option>'
    + Object.entries(INDICE.islas).map(([isla, muns]) =>
        `<optgroup label="${esc(isla)}">` + muns.map((n) => {
          const m = INDICE.municipios.find((x) => x.nombre === n);
          return m ? `<option value="${m.codmun}">${esc(n)}</option>` : '';
        }).join('') + '</optgroup>').join('');
  sel.addEventListener('change', () => {
    if (sel.value) anadir(sel.value);
    sel.value = '';
  });

  const pedidos = (new URLSearchParams(location.search).get('m') || '')
    .split(',').filter((c) => INDICE.municipios.some((m) => String(m.codmun) === c));
  for (const c of pedidos.slice(0, MAXIMO)) await anadir(c);
  if (!ELEGIDOS.length) pintar();
}

iniciar().catch((e) => {
  avisoCarga('estado-comparador', 'No se han podido cargar los datos.', () => location.reload());
  console.error(e);
});

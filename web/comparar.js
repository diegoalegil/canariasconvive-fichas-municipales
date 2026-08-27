/* =============================================================================
   COMPARADOR DE MUNICIPIOS · CANARIAS CONVIVE

   Los dos criterios de Pedro siguen mandando, y aquí aparece un tercero que se
   deriva de ellos:

   1. Ningún color de alerta sobre personas.
   2. La ficha muestra datos y no los interpreta.
   3. **Comparar no es clasificar.** Las columnas conservan el orden en que se
      añadieron. No hay control que ordene, ni posiciones, ni destacados, ni
      umbrales. El color distingue columnas, nunca valores.

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

const nf = (v, d = 0) => v == null || !isFinite(v)
  ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const pct = (v, d = 1) => v == null ? '—' : nf(v, d) + ' %';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const acotar = (v, a, b) => Math.max(a, Math.min(b, v));
const plano = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let INDICE = null;
let ELEGIDOS = [];        // fichas completas, en el orden en que las añadió el usuario

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
  const hueco = acotar(w * 0.13, 26, 44);
  const centro = w / 2, lado = centro - hueco / 2 - m.l;
  const fila = (h - m.t - m.b) / n, barra = fila * 0.78;
  const x = (v) => v / tope * lado;
  const y = (i) => m.t + (n - 1 - i) * fila;

  let barras = '', rejilla = '', eje = '';
  for (const v of [0, tope / 2, tope]) {
    for (const s of [-1, 1]) {
      const px = centro + s * (hueco / 2 + x(v));
      const extremo = v === tope;
      rejilla += `<line x1="${px.toFixed(1)}" y1="${m.t}" x2="${px.toFixed(1)}" y2="${h - m.b}" stroke="#D9D9D9"/>`;
      eje += `<text x="${px.toFixed(1)}" y="${h - 7}" `
           + `text-anchor="${extremo ? (s < 0 ? 'start' : 'end') : 'middle'}" `
           + `font-size="8.5" fill="#5F5E5A">${nf(v, v % 1 ? 1 : 0)}%</text>`;
    }
  }
  for (let i = 0; i < n; i++) {
    barras += `<rect x="${(centro - hueco / 2 - x(H[i])).toFixed(1)}" y="${y(i).toFixed(1)}" `
            + `width="${x(H[i]).toFixed(1)}" height="${barra.toFixed(1)}" fill="#2E75B6" rx="1"/>`
            + `<rect x="${(centro + hueco / 2).toFixed(1)}" y="${y(i).toFixed(1)}" `
            + `width="${x(M[i]).toFixed(1)}" height="${barra.toFixed(1)}" fill="#85B7EB" rx="1"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" `
       + `aria-label="Pirámide de ${esc(f.nombre)} en porcentaje sobre su propia población">`
       + rejilla + barras + eje + '</svg>';
}

/* ------------------------------------------------------- barra de un índice */
/** Cada índice lleva su propia escala, la del recorrido del índice en el
 *  conjunto de Canarias. Una escala común a los cuatro no diría nada:
 *  envejecimiento es una razón que va de 0,8 a 5,6 y reemplazo laboral un
 *  porcentaje que llega a 103. No hay umbrales ni franjas de referencia: se ve
 *  dónde cae cada municipio, no si está dentro o fuera de nada. */
function barraIndice(valor, rango, color, w = 200) {
  const h = 18, tope = rango.max * 1.04;
  const x = (v) => acotar(v / tope, 0, 1) * w;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">`
       + `<rect x="0" y="3" width="${w}" height="${h - 6}" fill="#E8EEF5" rx="2"/>`
       + `<rect x="0" y="3" width="${x(valor).toFixed(1)}" height="${h - 6}" fill="${color}" rx="2"/>`
       + '</svg>';
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

/* ------------------------------------------------------- mosaico de cien ---- */
function mosaico(porcentaje, color, lado = 13, hueco = 3) {
  const p = acotar(Math.round(porcentaje), 0, 100);
  const paso = lado + hueco, w = paso * 10 - hueco;
  let celdas = '';
  for (let i = 0; i < 100; i++) {
    const fila = 9 - Math.floor(i / 10), col = i % 10;
    celdas += `<rect x="${col * paso}" y="${fila * paso}" width="${lado}" height="${lado}" rx="2" `
            + `fill="${i < p ? color : '#DDE5EE'}"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${w}" width="${w}" height="${w}" aria-hidden="true">${celdas}</svg>`;
}

/* ------------------------------------------------------------- secciones --- */
function seccionCifras() {
  const filas = [
    ['Habitantes', 'personas', (f) => nf(f.poblacion), null],
    ['Edad media', 'años', (f) => nf(f.cifras.edad_media, 1), null],
    ['Variación media anual', '% medio por año',
      (f) => `${f.cifras.tvma >= 0 ? '+' : '−'}${nf(Math.abs(f.cifras.tvma), 1)} %`
           + `<em>${f.evolucion.anio_base}–${f.evolucion.anio_fin}</em>`, null],
    ['Mujeres', '% del total', (f) => pct(f.cifras.pct_mujeres), null],
    ['Hombres', '% del total', (f) => pct(f.cifras.pct_hombres), null],
  ];
  return `<div class="cmp-tabla" style="--cols:${ELEGIDOS.length}">
    <div class="cmp-cab"></div>
    ${ELEGIDOS.map((f, i) => `<div class="cmp-cab"><b style="color:${TONOS_COL[i]}">${esc(f.nombre)}</b><span>${esc(f.isla)}</span></div>`).join('')}
    ${filas.map(([rot, uni, fn]) => `
      <div class="cmp-rot"><b>${rot}</b><span>${uni}</span></div>
      ${ELEGIDOS.map((f, i) => `<div class="cmp-val" data-mun="${esc(f.nombre)}" style="--c:${TONOS_COL[i]}">${fn(f)}</div>`).join('')}
    `).join('')}
  </div>`;
}

function seccionPiramides(ancho) {
  const tope = Math.ceil(Math.max(...ELEGIDOS.flatMap((f) => {
    const p = f.piramide, t = p.hombres.reduce((a, b) => a + b, 0) + p.mujeres.reduce((a, b) => a + b, 0);
    return t ? [...p.hombres, ...p.mujeres].map((v) => v / t * 100) : [0];
  })) * 2) / 2;   // a la media unidad superior

  return `<div class="cmp-cols" style="--cols:${ELEGIDOS.length}">
    ${ELEGIDOS.map((f, i) => `
      <div class="cmp-col">
        <h3 style="color:${TONOS_COL[i]}">${esc(f.nombre)}</h3>
        <p>Edad media ${nf(f.cifras.edad_media, 1)} años</p>
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
    const rango = INDICE.rangos_indices[cod];
    const ref = ELEGIDOS[0].indices[cod].canarias;
    const dec = cod === 'C10' ? 2 : 1;
    return `<div class="cmp-indice">
      <div class="cmp-indice-tit">
        <b>${esc(rango.etiqueta)}</b>
        <span>${comoSeLee[cod]}</span>
      </div>
      ${ELEGIDOS.map((f, i) => `
        <div class="cmp-barra">
          <span class="cmp-barra-rot">${esc(f.nombre)}</span>
          <span class="cmp-barra-val">${nf(f.indices[cod].municipio, dec)}</span>
          ${barraIndice(f.indices[cod].municipio, rango, TONOS_COL[i])}
        </div>`).join('')}
      <div class="cmp-barra cmp-ref">
        <span class="cmp-barra-rot">Canarias</span>
        <span class="cmp-barra-val">${nf(ref, dec)}</span>
        ${barraIndice(ref, rango, GRIS_REF)}
      </div>
      <p class="cmp-escala">Escala de 0 a ${nf(rango.max, dec)}, que es el valor más alto de los 88 municipios en este índice.</p>
    </div>`;
  }).join('');
}

function seccionNacimiento() {
  const cats = ELEGIDOS[0].origen.categorias;
  const fila = (rot, vals, color) => `
    <div class="cmp-apilada">
      <span class="cmp-barra-rot" ${color ? `style="color:${color}"` : ''}>${esc(rot)}</span>
      ${barraApilada(vals)}
      <span class="cmp-barra-val">${vals.map((v) => nf(v, 1)).join(' · ')}</span>
    </div>`;
  return `
    ${ELEGIDOS.map((f, i) => fila(f.nombre, f.origen.municipio, TONOS_COL[i])).join('')}
    ${fila('Canarias', ELEGIDOS[0].origen.canarias, null)}
    <div class="leyenda">
      ${cats.map((c, i) => `<span><i class="llave" style="background:${TONOS_ORIGEN[i]}"></i>${esc(c)}</span>`).join('')}
    </div>
    <p class="cmp-escala">Cada barra suma el 100 % de la población de su municipio, así que se pueden comparar entre sí sea cual sea su tamaño.</p>`;
}

function ultimo(v) { for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return v[i]; return null; }

function seccionExtranjero() {
  const canarias = ultimo(ELEGIDOS[0].extranjero.canarias);
  return `<div class="cmp-cols" style="--cols:${ELEGIDOS.length}">
      ${ELEGIDOS.map((f, i) => {
        const v = ultimo(f.extranjero.municipio);
        return `<div class="cmp-col">
          <h3 style="color:${TONOS_COL[i]}">${esc(f.nombre)}</h3>
          <p><b>${pct(v)}</b> de su población</p>
          ${mosaico(v, TONOS_COL[i])}
        </div>`;
      }).join('')}
    </div>
    <p class="cmp-escala">Cada cuadro es un uno por ciento de la población del municipio. En el conjunto de Canarias son ${pct(canarias)}.</p>`;
}

/* ---------------------------------------------------------------- montaje -- */
function anchoColumna() {
  const cont = document.getElementById('cmp-piramides');
  const total = cont ? cont.clientWidth : 900;
  const cols = innerWidth <= 780 ? 1 : ELEGIDOS.length;
  return Math.max(150, Math.floor((total - 20 * (cols - 1)) / cols));
}

function pintar() {
  const vacio = ELEGIDOS.length === 0;
  document.getElementById('cmp-vacio').hidden = !vacio;
  document.getElementById('cmp-resultado').hidden = vacio;
  pintarElegidos();
  history.replaceState(null, '', ELEGIDOS.length ? `?m=${ELEGIDOS.map((f) => f.codmun).join(',')}` : location.pathname);
  if (vacio) return;

  document.getElementById('cmp-cifras').innerHTML = seccionCifras();
  document.getElementById('cmp-piramides').innerHTML = seccionPiramides(anchoColumna());
  document.getElementById('cmp-indices').innerHTML = seccionIndices();
  document.getElementById('cmp-nacimiento').innerHTML = seccionNacimiento();
  document.getElementById('cmp-extranjero').innerHTML = seccionExtranjero();
}

function pintarElegidos() {
  const cont = document.getElementById('cmp-elegidos');
  cont.innerHTML = ELEGIDOS.map((f, i) => `
    <span class="cmp-ficha" style="--c:${TONOS_COL[i]}">
      <b>${esc(f.nombre)}</b>
      <button type="button" data-quitar="${f.codmun}" aria-label="Quitar ${esc(f.nombre)} de la comparación">×</button>
    </span>`).join('') || '<span class="cmp-ninguno">Ningún municipio elegido todavía</span>';
  cont.querySelectorAll('[data-quitar]').forEach((b) =>
    b.addEventListener('click', () => quitar(b.dataset.quitar)));
  document.getElementById('cmp-cuenta').textContent =
    `${ELEGIDOS.length} de ${MAXIMO}`;
  document.getElementById('sel-anadir').disabled = ELEGIDOS.length >= MAXIMO;
}

async function anadir(codmun) {
  if (ELEGIDOS.length >= MAXIMO) return;
  if (ELEGIDOS.some((f) => String(f.codmun) === String(codmun))) return;
  const f = await (await fetch(`datos/mun/${codmun}.json`)).json();
  ELEGIDOS.push(f);
  pintar();
}

function quitar(codmun) {
  ELEGIDOS = ELEGIDOS.filter((f) => String(f.codmun) !== String(codmun));
  pintar();
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

  INDICE = await (await fetch('datos/indice.json')).json();

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
  document.getElementById('cmp-vacio').textContent = 'No se han podido cargar los datos.';
  console.error(e);
});

/* =============================================================================
   FICHAS MUNICIPALES · CANARIAS CONVIVE
   Gráficos en SVG generado a mano. Sin librerías.

   Dos criterios de la revisión con Pedro que condicionan todo el fichero:

   1. Ningún color de alerta sobre personas. La paleta es la azul de su ficha
      impresa; el rojo queda descartado por semiología gráfica.
   2. La ficha presenta datos y no los interpreta. No hay etiquetas que digan si
      un valor es bueno o malo, ni comparaciones que induzcan una lectura.
   ============================================================================= */

const C = {
  azul: '#185FA5', azulMedio: '#2E75B6', azulClaro: '#85B7EB', azulPalido: '#B5D4F4',
  azulHumo: '#E4F0FB',
  negro: '#1A1A1A', gris: '#5F5E5A', gris40: '#82817C',
  rejilla: '#D9D9D9', linea: '#C9D4E0',
};
// Escala de tres tonos, de menor a mayor. Es la de Pedro.
const TONOS = [C.azulPalido, C.azulClaro, C.azul];
// Lugar de nacimiento: tres tonos con separación suficiente entre sí.
const TONOS_ORIGEN = ['#185FA5', '#6FA6D8', '#B5D4F4'];

const ANIO_INICIO_COMPONENTES = 2002;   // la serie de saldo migratorio arranca aquí

/* ------------------------------------------------------------- utilidades -- */
const nf = (v, d = 0) => v == null || !isFinite(v)
  ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const pct = (v, d = 1) => v == null ? '—' : nf(v, d) + '%';
const acotar = (v, min, max) => Math.max(min, Math.min(max, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ultimoValido = (V) => {
  for (let i = V.length - 1; i >= 0; i--) if (V[i] != null && isFinite(V[i])) return V[i];
  return null;
};

/** Paso 1-2-5 x 10^n. El eje se adapta a los datos de cada municipio. */
function pasoRedondo(rango, objetivo = 5) {
  if (!(rango > 0)) return 1;
  const bruto = rango / objetivo;
  const exp = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 2, 5, 10]) if (bruto <= m * exp) return m * exp;
  return 10 * exp;
}

/** Menor número redondo >= v cuya mitad también es redonda. Se usa en los ejes
 *  simétricos: con la secuencia 1-2-5 el paso salta de 2.000 a 5.000 y un
 *  municipio con máximo 5.500 acababa con el eje en 10.000, con las barras
 *  aplastadas contra el cero. */
function topeRedondo(v) {
  if (!(v > 0)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 4, 6, 8, 10]) if (v <= m * exp + 1e-9) return m * exp;
  return 10 * exp;
}

function anchoDe(id, porDefecto = 520) {
  const e = document.getElementById(id);
  const w = e ? e.clientWidth : 0;
  return w > 60 ? w : porDefecto;
}

/** Los gráficos se dibujan a escala 1:1 sobre el ancho real de su tarjeta. Si se
 *  dibujaran a tamaño fijo y se estirasen, en un móvil las etiquetas quedarían
 *  a tres píxeles. */
function abrirSVG(w, h, titulo, fluido = true) {
  return `<svg viewBox="0 0 ${w} ${h}" ${fluido ? 'width="100%"' : `width="${w}" height="${h}"`} `
       + `role="img" aria-label="${esc(titulo)}" preserveAspectRatio="xMidYMid meet">`;
}

/** Interpolación cúbica monótona (Fritsch-Carlson). Suaviza la curva sin
 *  inventar máximos ni mínimos que no estén en los datos. Es el mismo criterio
 *  que el PCHIP que usa Pedro en el notebook. */
function suavizar(xs, ys, muestras = 240) {
  const k = xs.length;
  if (k < 3) return xs.map((x, i) => [x, ys[i]]);
  const dx = [], delta = [], m = [];
  for (let i = 0; i < k - 1; i++) { dx[i] = xs[i + 1] - xs[i]; delta[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  m[0] = delta[0];
  for (let i = 1; i < k - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
    m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
  }
  m[k - 1] = delta[k - 2];

  const salida = [];
  for (let s = 0; s < muestras; s++) {
    const x = xs[0] + (xs[k - 1] - xs[0]) * (s / (muestras - 1));
    let i = 0;
    while (i < k - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / dx[i], t2 = t * t, t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * dx[i] * m[i]
            + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * dx[i] * m[i + 1];
    salida.push([x, y]);
  }
  return salida;
}

/* ------------------------------------------------------------------ mapas -- */
/** Mapa de situación. `conLimites` dibuja las divisiones municipales; el mapa
 *  del archipiélago va sin ellas para que la silueta se lea limpia. */
function mapa(geo, codmun, ambito, w, h, conLimites) {
  const rasgos = geo.features.filter(ambito);
  if (!rasgos.length) return '';
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of rasgos) {
    const [a, b, c, d] = f.properties.bbox;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  const pad = 6;
  const s = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1));
  const ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  const P = (c) => `${((c[0] - x0) * s + ox).toFixed(1)},${((y1 - c[1]) * s + oy).toFixed(1)}`;

  let base = '', foco = '';
  for (const f of rasgos) {
    const d = f.geometry.coordinates
      .map((pol) => pol.map((an) => 'M' + an.map(P).join('L') + 'Z').join('')).join('');
    if (f.properties.codmun === codmun) {
      foco = `<path d="${d}" fill="${C.azul}" stroke="${C.azul}" stroke-width="0.8"/>`;
    } else {
      // Sin límites, el trazo va del color del relleno y las piezas se funden.
      const trazo = conLimites ? '#FFFFFF' : C.azulClaro;
      base += `<path d="${d}" fill="${C.azulClaro}" stroke="${trazo}" stroke-width="${conLimites ? 0.7 : 0.5}"/>`;
    }
  }
  return abrirSVG(w, h, 'Situación del municipio', false) + base + foco + '</svg>';
}

/* -------------------------------------------------------------- evolución -- */
let EVOLUCION = null;   // geometría del último gráfico dibujado, para la lectura al pasar el ratón
function graficoEvolucion(ev, w, h) {
  const m = { t: w < 430 ? 46 : 30, r: 14, b: 26, l: 52 };
  const X = ev.anios, Y = ev.valores;
  const paso = pasoRedondo(Math.max(...Y) * 1.12, 5);
  const tope = Math.ceil(Math.max(...Y) * 1.12 / paso) * paso;
  const px = (a) => m.l + (a - X[0]) / (X[X.length - 1] - X[0]) * (w - m.l - m.r);
  const py = (v) => h - m.b - (v / tope) * (h - m.t - m.b);

  let rejilla = '', ejeY = '';
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${C.rejilla}"/>`;
    ejeY += `<text x="${m.l - 9}" y="${(py(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.gris}">${nf(v)}</text>`;
  }
  // El eje temporal va de cinco en cinco años: cuadra con el último dato, 2025.
  let ejeX = '';
  for (let a = Math.ceil(X[0] / 5) * 5; a <= X[X.length - 1]; a += 5) {
    ejeX += `<text x="${px(a).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="${C.gris}">${a}</text>`;
  }

  EVOLUCION = { X, Y, px, py, w, m };
  const curva = suavizar(X, Y).map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`);
  const area = `M${px(X[0]).toFixed(1)},${(h - m.b).toFixed(1)} L${curva.join(' L')} L${px(X[X.length - 1]).toFixed(1)},${(h - m.b).toFixed(1)}Z`;

  // Cápsula con la variación acumulada. En pantallas estrechas no cabe al lado
  // del texto, así que el texto baja a una segunda línea en vez de salirse.
  const v = ev.variacion_acumulada;
  const leyendaVar = `Variación acumulada entre ${ev.anio_base} y ${ev.anio_fin}`;
  const textoVar = `${v >= 0 ? '\u25B2' : '\u25BC'} ${nf(Math.abs(v), 1)}%`;
  const anchoCapsula = Math.max(58, textoVar.length * 6.4 + 16);   // +261,3% no cabe en un ancho fijo
  const cabeAlLado = w - m.r - (m.l + anchoCapsula + 16) > leyendaVar.length * 5.6;
  const rotulo = v == null ? '' : `
    <g transform="translate(${m.l + 8}, ${m.t - 12})">
      <rect x="0" y="-10" width="${anchoCapsula.toFixed(0)}" height="20" rx="10" fill="${C.azul}"/>
      <text x="${(anchoCapsula / 2).toFixed(0)}" y="4.5" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${textoVar}</text>
      <text x="${cabeAlLado ? (anchoCapsula + 9).toFixed(0) : (2 - m.l - 8).toFixed(0)}" y="${cabeAlLado ? 4.5 : 24}" font-size="${cabeAlLado ? 10.5 : 10}" fill="${C.negro}">${leyendaVar}</text>
    </g>`;

  return abrirSVG(w, h, `Evolución de la población entre ${X[0]} y ${X[X.length - 1]}`)
    + rejilla
    + `<defs><linearGradient id="degradado-evolucion" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.azul}" stop-opacity=".22"/><stop offset="1" stop-color="${C.azul}" stop-opacity=".02"/></linearGradient></defs>`
    + `<path d="${area}" fill="url(#degradado-evolucion)"/>`
    + `<polyline points="${curva.join(' ')}" fill="none" stroke="${C.azul}" stroke-width="2.3" stroke-linejoin="round"/>`
    + `<circle cx="${px(X[X.length - 1]).toFixed(1)}" cy="${py(Y[Y.length - 1]).toFixed(1)}" r="4" fill="${C.azul}"/>`
    + ejeY + ejeX + rotulo
    + `<g id="guia-evolucion" opacity="0" pointer-events="none">`
    + `<line y1="${m.t}" y2="${h - m.b}" stroke="${C.azul}" stroke-width="1" stroke-dasharray="3 3"/>`
    + `<circle r="4.5" fill="${C.azul}" stroke="#fff" stroke-width="1.6"/></g>`
    + `<rect id="cazador-evolucion" x="${m.l}" y="${m.t}" width="${(w - m.l - m.r).toFixed(1)}" `
    + `height="${(h - m.t - m.b).toFixed(1)}" fill="transparent"/>`
    + '</svg>';
}

/* --------------------------------------------- peso de origen extranjero --- */
/** Barras para el municipio, con la última destacada y su porcentaje encima en
 *  negro, y una línea para Canarias. Es como lo tenía Pedro. */
function graficoExtranjero(ext, w, h) {
  // El margen derecho deja sitio a la etiqueta del último dato, que va centrada
  // sobre la última barra y se saldría del lienzo.
  const m = { t: 30, r: 34, b: 26, l: 42 };
  const A = ext.anios, M = ext.municipio, R = ext.canarias;
  const vivos = A.map((a, i) => [a, M[i]]).filter(([, v]) => v != null && isFinite(v));
  // Primero el paso a partir del máximo, y el tope como el múltiplo justo por
  // encima. Al revés, el eje quedaba holgado: un municipio con 23,5 % acababa
  // con la escala en 40 y las barras a media altura.
  const maximo = Math.max(...M.concat(R).filter((v) => v != null));
  const paso = pasoRedondo(maximo, 5);
  const tope = Math.ceil(maximo / paso) * paso;

  const ancho = (w - m.l - m.r) / vivos.length;
  const bw = Math.min(ancho * 0.62, 26);
  const px = (i) => m.l + i * ancho + ancho / 2;
  const py = (v) => h - m.b - (v / tope) * (h - m.t - m.b);

  let rejilla = '', ejeY = '';
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${C.rejilla}"/>`;
    ejeY += `<text x="${m.l - 8}" y="${(py(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.gris}">${nf(v)}%</text>`;
  }

  let barras = '', ejeX = '';
  vivos.forEach(([a, v], i) => {
    const ultima = i === vivos.length - 1;
    barras += `<rect x="${(px(i) - bw / 2).toFixed(1)}" y="${py(v).toFixed(1)}" width="${bw.toFixed(1)}" `
            + `height="${(h - m.b - py(v)).toFixed(1)}" fill="${ultima ? C.azul : C.azulClaro}" rx="1.5"/>`;
    if (ultima) {
      barras += `<text x="${px(i).toFixed(1)}" y="${(py(v) - 8).toFixed(1)}" text-anchor="middle" `
              + `font-size="13" font-weight="700" fill="${C.negro}">${nf(v, 1)}%</text>`;
    }
    if (a % 5 === 0 || ultima) {
      ejeX += `<text x="${px(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="${C.gris}">${a}</text>`;
    }
  });

  const lineaCan = A.map((a, i) => [a, R[i]]).filter(([, v]) => v != null)
    .map(([a, v]) => `${px(A.indexOf(a)).toFixed(1)},${py(v).toFixed(1)}`);

  return abrirSVG(w, h, 'Peso de la población de origen extranjero, municipio frente a Canarias')
    + rejilla + barras
    + `<polyline points="${lineaCan.join(' ')}" fill="none" stroke="${C.negro}" stroke-width="1.6" stroke-linejoin="round"/>`
    + ejeY + ejeX + '</svg>';
}

/* --------------------------------------------------------------- pirámide -- */
/** Construye el esqueleto y devuelve las tres vistas. El eje es común a las
 *  tres para que al cambiar solo se mueva la silueta y se puedan comparar. */
function construirPiramide(p, w, h) {
  const n = p.edades.length;
  const porc = (H, M) => {
    const total = H.reduce((a, b) => a + b, 0) + M.reduce((a, b) => a + b, 0);
    return total > 0
      ? { H: H.map((v) => v / total * 100), M: M.map((v) => v / total * 100), total }
      : { H: H.map(() => 0), M: M.map(() => 0), total: 0 };
  };

  const ext = p.extranjera_hombres
    ? { h: p.extranjera_hombres, m: p.extranjera_mujeres }
    : { h: p.hombres.map(() => 0), m: p.mujeres.map(() => 0) };
  const espH = p.hombres.map((v, i) => Math.max(0, v - ext.h[i]));
  const espM = p.mujeres.map((v, i) => Math.max(0, v - ext.m[i]));

  const vistas = [
    { clave: 'total', etiqueta: 'Población total', ...porc(p.hombres, p.mujeres), canarias: true },
    { clave: 'espanola', etiqueta: 'Nacida en España', ...porc(espH, espM), canarias: false },
    { clave: 'extranjera', etiqueta: 'De origen extranjero', ...porc(ext.h, ext.m), canarias: false },
  ];

  const tope = Math.ceil(Math.max(
    ...vistas.flatMap((v) => [...v.H, ...v.M]),
    ...p.canarias_hombres, ...p.canarias_mujeres) * 1.08);

  const m = { t: 14, r: 12, b: 30, l: 12 };
  const hueco = acotar(w * 0.12, 40, 62);
  const centro = w / 2;
  const anchoLado = centro - hueco / 2 - m.l;
  const altoFila = (h - m.t - m.b) / n;
  const barra = altoFila * 0.76;
  const fy = (i) => m.t + (n - 1 - i) * altoFila;
  const escala = (v) => v / tope * anchoLado;

  let rejilla = '', ejeX = '';
  for (let v = 0; v <= tope; v += pasoRedondo(tope, 3)) {
    for (const s of [-1, 1]) {
      const x = centro + s * (hueco / 2 + escala(v));
      rejilla += `<line x1="${x.toFixed(1)}" y1="${m.t}" x2="${x.toFixed(1)}" y2="${h - m.b}" stroke="${C.rejilla}"/>`;
      // El 0% se rotula a los dos lados, como pidió Pedro.
      ejeX += `<text x="${x.toFixed(1)}" y="${h - 14}" text-anchor="middle" font-size="9.5" fill="${C.gris}">${v}%</text>`;
    }
  }

  let barras = '', etiquetas = '';
  for (let i = 0; i < n; i++) {
    const y = fy(i).toFixed(1), alt = barra.toFixed(1);
    barras += `<rect id="ph${i}" x="${(centro - hueco / 2).toFixed(1)}" y="${y}" width="0" height="${alt}" fill="${C.azulMedio}" rx="1.5"/>`;
    barras += `<rect id="pm${i}" x="${(centro + hueco / 2).toFixed(1)}" y="${y}" width="0" height="${alt}" fill="${C.azulClaro}" rx="1.5"/>`;
    etiquetas += `<text x="${centro}" y="${(fy(i) + barra / 2 + 3).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="${C.gris}">${p.edades[i]}</text>`;
  }

  // Perfil de Canarias: línea negra continua, escalonada.
  const perfil = [];
  for (const [serie, signo] of [[p.canarias_hombres, -1], [p.canarias_mujeres, 1]]) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = centro + signo * (hueco / 2 + escala(serie[i]));
      pts.push(`${x.toFixed(1)},${(fy(i) + barra).toFixed(1)}`, `${x.toFixed(1)},${fy(i).toFixed(1)}`);
    }
    perfil.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${C.negro}" stroke-width="1.3" stroke-linejoin="round"/>`);
  }

  // Franjas transparentes por grupo de edad: capturan el ratón para poder leer
  // los valores exactos, que es lo que una ficha en papel no puede dar.
  let franjas = `<rect id="franja-activa" x="${m.l}" y="0" width="${(w - m.l - m.r).toFixed(1)}" `
              + `height="${barra.toFixed(1)}" fill="${C.azul}" opacity="0" pointer-events="none"/>`;
  for (let i = 0; i < n; i++) {
    franjas += `<rect class="franja" data-i="${i}" x="${m.l}" y="${(fy(i) - (altoFila - barra) / 2).toFixed(1)}" `
             + `width="${(w - m.l - m.r).toFixed(1)}" height="${altoFila.toFixed(1)}" fill="transparent"/>`;
  }

  const svg = abrirSVG(w, h, 'Pirámide de población del municipio comparada con el perfil de Canarias')
    + rejilla + barras + `<g id="perfil-canarias">${perfil.join('')}</g>` + etiquetas + ejeX + franjas + '</svg>';

  return { svg, vistas, escala, centro, hueco, edades: p.edades, fy, barra, altoFila };
}

/* --------------------------------------------- índices geodemográficos ----- */
/** Los tres ámbitos ordenados de izquierda a derecha por valor. El tono indica
 *  la posición, no el territorio. Diseño original de Pedro. */
function bloqueIndices(ind, codigos, nombreMun, isla) {
  return codigos.map((cod) => {
    const d = ind[cod];
    const filas = [['Canarias', d.canarias], [isla, d.isla], [nombreMun, d.municipio]]
      .filter(([, v]) => v != null)
      .sort((a, b) => a[1] - b[1]);
    const dec = cod === 'C10' ? 2 : 1;
    return `<div class="indice">
      <div class="indice-tit"><b>${esc(d.etiqueta)}</b><em>${d.anio}${d.unidad ? ' · ' + d.unidad : ''}</em></div>
      <div class="escala">${filas.map(([n, v], i) => `
        <div class="peldano">
          <span>${esc(n)}</span>
          <b>${nf(v, dec)}</b>
          <i style="background:${TONOS[i]}"></i>
        </div>`).join('')}</div>
    </div>`;
  }).join('');
}

/* ------------------------------------------------------------ componentes -- */
function graficoComponentes(c, w, h) {
  const m = { t: 16, r: 12, b: 26, l: 52 };
  const idx = c.anios.map((a, i) => i).filter((i) => c.anios[i] >= ANIO_INICIO_COMPONENTES);
  const A = idx.map((i) => c.anios[i]);
  const V = idx.map((i) => c.vegetativo[i]);
  const S = idx.map((i) => c.migratorio[i]);

  const vals = [...V, ...S].filter((v) => v != null && isFinite(v));
  const tope = topeRedondo(Math.max(...vals.map(Math.abs)) * 1.08);
  const paso = tope / 2;                        // dos divisiones a cada lado del cero
  const py = (v) => m.t + (tope - v) / (2 * tope) * (h - m.t - m.b);
  const ancho = (w - m.l - m.r) / A.length;
  const bw = Math.min(ancho * 0.38, 13);

  let rejilla = '', ejeY = '';
  for (let v = -tope; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${v === 0 ? C.gris40 : C.rejilla}"/>`;
    ejeY += `<text x="${m.l - 9}" y="${(py(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${C.gris}">${nf(v)}</text>`;
  }
  let barras = '', ejeX = '';
  A.forEach((a, i) => {
    const x = m.l + i * ancho + ancho / 2;
    [[V[i], C.azulClaro, -1], [S[i], C.azul, 1]].forEach(([v, col, s]) => {
      if (v == null || !isFinite(v)) return;
      const y0 = py(0), y1 = py(v);
      barras += `<rect x="${(x + s * bw / 2 - bw / 2 + s * .6).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" `
              + `width="${bw.toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" fill="${col}" rx="1"/>`;
    });
    if (a % 2 === 0) ejeX += `<text x="${x.toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="9.5" fill="${C.gris}">${a}</text>`;
  });

  let marcas = '';
  for (const an of c.anomalias || []) {
    const i = A.indexOf(an.anio);
    if (i < 0) continue;
    const x = m.l + i * ancho + ancho / 2;
    marcas += `<line x1="${x.toFixed(1)}" y1="${m.t}" x2="${x.toFixed(1)}" y2="${h - m.b}" stroke="${C.gris40}" stroke-width="1" stroke-dasharray="2 3"/>`;
  }

  return abrirSVG(w, h, 'Crecimiento vegetativo y saldo migratorio por año')
    + rejilla + barras + marcas + ejeY + ejeX + '</svg>';
}

/* -------------------------------------------------- lugar de nacimiento ---- */
/** Mosaico de cien casillas: de cada cien habitantes, cuántos nacieron dónde.
 *  Sustituye a las barras apiladas, donde las etiquetas no cabían dentro. */
function mosaicoOrigen(valores, lado = 17, hueco = 3) {
  const total = valores.reduce((a, b) => a + (b || 0), 0);
  if (!(total > 0)) return '';
  // Reparto de mayor resto: las cien casillas suman exactamente cien.
  const exactos = valores.map((v) => (v || 0) / total * 100);
  const enteros = exactos.map(Math.floor);
  let faltan = 100 - enteros.reduce((a, b) => a + b, 0);
  exactos.map((v, i) => [v - enteros[i], i]).sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => { if (faltan-- > 0) enteros[i]++; });

  const orden = [];
  enteros.forEach((n, cat) => { for (let k = 0; k < n; k++) orden.push(cat); });

  const w = 10 * lado + 9 * hueco, h = w;
  let celdas = '';
  for (let i = 0; i < 100; i++) {
    const x = (i % 10) * (lado + hueco), y = Math.floor(i / 10) * (lado + hueco);
    celdas += `<rect x="${x}" y="${y}" width="${lado}" height="${lado}" rx="2.5" fill="${TONOS_ORIGEN[orden[i]] || C.rejilla}"/>`;
  }
  return abrirSVG(w, h, 'De cada cien habitantes, dónde nacieron', false) + celdas + '</svg>';
}

/* ------------------------------------------------------------ cifras clave -- */
const ICONOS = {
  variacion: (sube) => `<svg class="icono" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path d="${sube ? 'M13 5 L21 19 L5 19 Z' : 'M13 21 L5 7 L21 7 Z'}" fill="currentColor"/></svg>`,
  edad: `<svg class="icono" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="7.5" r="4" fill="currentColor"/>
      <path d="M13 12.5c-4.2 0-6.5 2.6-6.5 6.4V22h13v-3.1c0-3.8-2.3-6.4-6.5-6.4z" fill="currentColor"/></svg>`,
  mujeres: `<svg class="icono" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="9" r="5.2" fill="none" stroke="currentColor" stroke-width="2.4"/>
      <path d="M13 14.5V23M9.5 19.5h7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  hombres: `<svg class="icono" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="10.5" cy="15.5" r="5.2" fill="none" stroke="currentColor" stroke-width="2.4"/>
      <path d="M15 11L21.5 4.5M16.5 4.5h5v5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/* ================================================================= montaje == */
let GEO = null, INDICE = null, FICHA = null, PIRAMIDE = null, VISTA = 0;

async function cargar(codmun) {
  const f = await (await fetch(`datos/mun/${codmun}.json`)).json();
  VISTA = 0;
  pintar(f);
  history.replaceState(null, '', `?municipio=${codmun}`);
}

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Transición entre pirámides: interpola las anchuras de cada barra. */
let animacion = null;
function mostrarVista(i, animar = true) {
  if (!PIRAMIDE) return;
  VISTA = i;
  const v = PIRAMIDE.vistas[i];
  const { escala, centro, hueco } = PIRAMIDE;
  const n = v.H.length;

  document.querySelectorAll('.vista').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  const perfil = document.getElementById('perfil-canarias');
  if (perfil) perfil.style.display = v.canarias ? '' : 'none';
  document.getElementById('vista-info').innerHTML =
    `<b>${esc(v.etiqueta)}</b> · ${nf(v.total)} personas · porcentaje sobre este total`;

  const rh = [], rm = [];
  for (let k = 0; k < n; k++) { rh.push(document.getElementById('ph' + k)); rm.push(document.getElementById('pm' + k)); }
  if (!rh[0]) return;

  const desdeH = rh.map((r) => parseFloat(r.getAttribute('width')) || 0);
  const desdeM = rm.map((r) => parseFloat(r.getAttribute('width')) || 0);
  const haciaH = v.H.map(escala), haciaM = v.M.map(escala);

  const aplicar = (H, M) => {
    for (let k = 0; k < n; k++) {
      rh[k].setAttribute('width', H[k].toFixed(1));
      rh[k].setAttribute('x', (centro - hueco / 2 - H[k]).toFixed(1));
      rm[k].setAttribute('width', M[k].toFixed(1));
    }
  };

  cancelAnimationFrame(animacion);
  // Sin animación si el usuario la ha desactivado en el sistema, y tampoco si la
  // pestaña está oculta: ahí el navegador congela requestAnimationFrame y la
  // pirámide se quedaría a medio camino.
  if (!animar || reducido() || document.hidden) { aplicar(haciaH, haciaM); return; }

  const dur = 620, t0 = performance.now();
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // easeInOutCubic
    aplicar(desdeH.map((d, k) => d + (haciaH[k] - d) * e),
            desdeM.map((d, k) => d + (haciaM[k] - d) * e));
    if (p < 1) animacion = requestAnimationFrame(paso);
  };
  animacion = requestAnimationFrame(paso);
}

// Si la pestaña se oculta a mitad de una transición, al volver se fija el
// estado final en lugar de dejar las barras congeladas donde quedaron.
addEventListener('visibilitychange', () => {
  if (document.hidden && PIRAMIDE) mostrarVista(VISTA, false);
});

function pintar(f) {
  FICHA = f;
  const doc = document;
  doc.title = `${f.nombre} · Fichas municipales · Canarias Convive`;

  doc.getElementById('migas').textContent = `${f.isla} · ${f.comarca.replace(/^.*? - /, '')}`;
  doc.getElementById('nombre').textContent = f.nombre;
  doc.getElementById('anio').textContent = f.anio;
  doc.getElementById('habitantes').innerHTML = `<b>${nf(f.poblacion)}</b><span>habitantes</span>`;

  // --- cifras clave ---
  const c = f.cifras;
  doc.getElementById('cifras').innerHTML = [
    [ICONOS.variacion(c.tvma >= 0), `${c.tvma >= 0 ? '+' : '−'}${nf(Math.abs(c.tvma), 1)}%`,
     'Variación media anual', `${f.evolucion.anio_base}–${f.evolucion.anio_fin}`],
    [ICONOS.edad, nf(c.edad_media, 1), 'Edad media', 'años'],
    [ICONOS.mujeres, pct(c.pct_mujeres), 'Mujeres', nf(c.mujeres)],
    [ICONOS.hombres, pct(c.pct_hombres), 'Hombres', nf(c.hombres)],
  ].map(([ico, v, t, e]) => `<div class="cifra">${ico}<b>${v}</b><i>${t}</i><em>${e}</em></div>`).join('');

  // --- mapas, en franja central y a tamaño grande ---
  const wMapa = Math.max(180, Math.floor(anchoDe('mapas', 1080) / (innerWidth > 940 ? 3 : 1)) - 20);
  const hMapa = Math.round(wMapa * 0.74);
  const niveles = [
    ['Canarias', () => true, f.rankings.canarias, false],
    [f.isla, (g) => g.properties.isla === f.isla, f.rankings.isla, true],
    [f.comarca.replace(/^.*? - /, ''), (g) => g.properties.comarca === f.comarca, f.rankings.comarca, true],
  ];
  doc.getElementById('mapas').innerHTML = niveles.map(([tit, filtro, r, lim]) => `
    <figure class="mapa">
      ${mapa(GEO, f.codmun, filtro, wMapa, hMapa, lim)}
      <figcaption class="mapa-pie">
        <b>${r.puesto}º de ${r.total}</b>
        <span>en ${esc(tit)} · ${pct(r.peso, 2)} de su población</span>
      </figcaption>
    </figure>`).join('');

  // --- gráficos ---
  const wEv = anchoDe('g-evolucion'), wEx = anchoDe('g-extranjero', 320);
  const wPi = anchoDe('g-piramide'), wCo = anchoDe('g-componentes');

  doc.getElementById('g-evolucion').innerHTML =
    graficoEvolucion(f.evolucion, wEv, acotar(wEv * 0.42, 190, 260));
  doc.getElementById('g-extranjero').innerHTML =
    graficoExtranjero(f.extranjero, wEx, acotar(wEx * 0.72, 200, 260));

  PIRAMIDE = construirPiramide(f.piramide, wPi, acotar(wPi * 0.70, 360, 470));
  doc.getElementById('g-piramide').innerHTML = PIRAMIDE.svg;
  mostrarVista(VISTA, false);

  doc.getElementById('g-indices').innerHTML =
    bloqueIndices(f.indices, ['C10', 'C11', 'C17', 'C14'], f.nombre, f.isla);

  const anom = f.componentes.anomalias || [];
  doc.getElementById('g-componentes').innerHTML =
    graficoComponentes(f.componentes, wCo, acotar(wCo * 0.34, 190, 250))
    + (anom.length ? `<figcaption class="nota">${anom.map((a) =>
        `En ${a.anio} no se representa el saldo migratorio (${nf(a.valor)}): corresponde a un `
        + `${a.motivo}, no a un flujo demográfico.`).join(' ')}</figcaption>` : '');

  // --- lugar de nacimiento ---
  const o = f.origen;
  doc.getElementById('g-origen').innerHTML = [
    ['Municipio', o.municipio], ['Canarias', o.canarias],
  ].map(([tit, vals]) => `
    <div class="mosaico">
      <h3>${tit}</h3>
      <p>De cada 100 habitantes</p>
      ${mosaicoOrigen(vals)}
      <div class="reparto">${o.categorias.map((cat, i) => `
        <div><i style="background:${TONOS_ORIGEN[i]}"></i><span>${esc(cat)}</span><b>${nf(vals[i], 1)}%</b></div>`).join('')}
      </div>
    </div>`).join('');

  conectarLecturaPiramide();
  conectarLecturaEvolucion();
}

/* ------------------------------------------------------- lecturas al vuelo -- */
/* Un gráfico impreso no puede dar el valor exacto de una barra. Este sí. */

function conectarLecturaPiramide() {
  const svg = document.querySelector('#g-piramide svg');
  const salida = document.getElementById('lectura-piramide');
  if (!svg || !salida || !PIRAMIDE) return;
  const activa = svg.querySelector('#franja-activa');

  svg.querySelectorAll('.franja').forEach((fr) => {
    fr.addEventListener('mouseenter', () => {
      const i = +fr.dataset.i, v = PIRAMIDE.vistas[VISTA];
      activa.setAttribute('y', (PIRAMIDE.fy(i)).toFixed(1));
      activa.setAttribute('opacity', '.07');
      salida.innerHTML = `<b>${esc(PIRAMIDE.edades[i])} años</b> · `
        + `Hombres ${nf(v.H[i], 2)}% · Mujeres ${nf(v.M[i], 2)}%`;
    });
  });
  svg.addEventListener('mouseleave', () => {
    activa.setAttribute('opacity', '0');
    salida.textContent = '';
  });
}

function conectarLecturaEvolucion() {
  const svg = document.querySelector('#g-evolucion svg');
  const salida = document.getElementById('lectura-evolucion');
  if (!svg || !salida || !EVOLUCION) return;
  const { X, Y, px, py } = EVOLUCION;
  const guia = svg.querySelector('#guia-evolucion');
  const linea = guia.querySelector('line'), punto = guia.querySelector('circle');
  const cazador = svg.querySelector('#cazador-evolucion');

  cazador.addEventListener('mousemove', (ev) => {
    const caja = svg.getBoundingClientRect();
    const escalaX = svg.viewBox.baseVal.width / caja.width;
    const xSvg = (ev.clientX - caja.left) * escalaX;
    let mejor = 0, dist = Infinity;
    X.forEach((a, i) => { const d = Math.abs(px(a) - xSvg); if (d < dist) { dist = d; mejor = i; } });
    const x = px(X[mejor]), y = py(Y[mejor]);
    linea.setAttribute('x1', x.toFixed(1)); linea.setAttribute('x2', x.toFixed(1));
    punto.setAttribute('cx', x.toFixed(1)); punto.setAttribute('cy', y.toFixed(1));
    guia.setAttribute('opacity', '1');
    salida.innerHTML = `<b>${X[mejor]}</b> · ${nf(Y[mejor])} habitantes`;
  });
  cazador.addEventListener('mouseleave', () => {
    guia.setAttribute('opacity', '0');
    salida.textContent = '';
  });
}

/* ------------------------------------------------------------------ inicio -- */
let temporizador = null, anchoPrevio = window.innerWidth;
addEventListener('resize', () => {
  if (!FICHA || innerWidth === anchoPrevio) return;
  anchoPrevio = innerWidth;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => pintar(FICHA), 180);
});

async function iniciar() {
  [INDICE, GEO] = await Promise.all([
    fetch('datos/indice.json').then((r) => r.json()),
    fetch('datos/geo/municipios.json').then((r) => r.json()),
  ]);

  const sel = document.getElementById('sel-municipio');
  sel.innerHTML = Object.entries(INDICE.islas).map(([isla, muns]) =>
    `<optgroup label="${esc(isla)}">` + muns.map((n) => {
      const m = INDICE.municipios.find((x) => x.nombre === n);
      return m ? `<option value="${m.codmun}">${esc(n)}</option>` : '';
    }).join('') + '</optgroup>').join('');

  const pedido = new URLSearchParams(location.search).get('municipio');
  const inicial = INDICE.municipios.some((m) => String(m.codmun) === pedido) ? pedido : '38038';
  sel.value = inicial;
  sel.addEventListener('change', () => cargar(sel.value));

  document.querySelectorAll('.vista').forEach((b, i) =>
    b.addEventListener('click', () => mostrarVista(i)));

  await cargar(inicial);
}

iniciar().catch((e) => {
  document.getElementById('nombre').textContent = 'No se han podido cargar los datos';
  console.error(e);
});

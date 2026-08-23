/* =============================================================================
   FICHAS MUNICIPALES · CANARIAS CONVIVE
   Gráficos en SVG generado a mano. Sin librerías: control total del diseño,
   peso mínimo y marcado accesible.

   Código de color (constante en toda la ficha):
     verde  -> el municipio / la población total
     claro  -> Canarias, como referencia de comparación
     coral  -> todo lo relativo a población de origen extranjero
   ============================================================================= */

const C = {
  verde: '#0D4E47', verdeMedio: '#3D7A72', verdeClaro: '#A8C9C3', verdePalido: '#DCEAE7',
  coral: '#F55654', coralClaro: '#FBB4B3', coralPalido: '#FDE2E1',
  linea: '#E6E6E6', tinta40: '#A2A2A2', tinta60: '#6F6F6F',
};

// useGrouping:'always' porque es-ES no separa los millares de cuatro cifras
// por defecto: sin él, 2040 habitantes se imprime "2040" y no "2.040".
const nf = (v, d = 0) => v == null || !isFinite(v)
  ? '—'
  : v.toLocaleString('es-ES', {
      minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always',
    });
const pct = (v, d = 1) => v == null ? '—' : nf(v, d) + '%';
const firma = (v, d = 1) => v == null ? '—' : (v >= 0 ? '+' : '−') + nf(Math.abs(v), d) + '%';

/** Paso 1-2-5 x 10^n para tener ~n marcas en el eje. Igual criterio que el notebook. */
function pasoRedondo(rango, objetivo = 5) {
  if (!(rango > 0)) return 1;
  const bruto = rango / objetivo;
  const exp = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 2, 5, 10]) if (bruto <= m * exp) return m * exp;
  return 10 * exp;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Último valor no nulo de una serie alineada por año. */
const ultimoValido = (V) => {
  for (let i = V.length - 1; i >= 0; i--) if (V[i] != null && isFinite(V[i])) return V[i];
  return null;
};

/** Abre un <svg> con título accesible.
 *
 *  Los gráficos se dibujan con el viewBox igual al ancho real del contenedor,
 *  o sea a escala 1:1. Si en vez de eso se dibujaran a un ancho fijo y se
 *  estiraran al 100%, en un móvil de 320 px el factor sería 0,4 y las etiquetas
 *  de 8 px acabarían midiendo 3 px reales: ilegibles.
 */
function abrirSVG(w, h, titulo, fluido = true) {
  const dim = fluido ? `width="100%"` : `width="${w}" height="${h}"`;
  return `<svg viewBox="0 0 ${w} ${h}" ${dim} role="img" `
       + `aria-label="${esc(titulo)}" preserveAspectRatio="xMidYMid meet">`;
}

const acotar = (v, min, max) => Math.max(min, Math.min(max, v));

/** Ancho útil de la tarjeta que contiene a un elemento. */
function anchoDe(id, porDefecto = 520) {
  const e = document.getElementById(id);
  const w = e ? e.clientWidth : 0;
  return w > 60 ? w : porDefecto;
}

/* ============================================================ localizador === */
/** Mapa de situación. `ambito` filtra los municipios dibujados. */
function mapaLocalizador(geo, codmun, ambito, w, h) {
  const rasgos = geo.features.filter(ambito);
  if (!rasgos.length) return '';
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of rasgos) {
    const [a, b, c, d] = f.properties.bbox;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  const pad = 3;
  const s = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1));
  const ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  const P = (c) => `${((c[0] - x0) * s + ox).toFixed(1)},${((y1 - c[1]) * s + oy).toFixed(1)}`;

  let base = '', foco = '';
  for (const f of rasgos) {
    const d = f.geometry.coordinates
      .map((pol) => pol.map((an) => 'M' + an.map(P).join('L') + 'Z').join('')).join('');
    // El trazo del mismo color que el relleno evita las costuras blancas entre
    // municipios contiguos que obligaban a disolver las islas en la ficha PDF.
    if (f.properties.codmun === codmun) {
      foco = `<path d="${d}" fill="#fff" stroke="#fff" stroke-width="1.1"/>`;
      // A escala de archipiélago el municipio puede quedar en dos píxeles:
      // se le añade un anillo para que siga siendo localizable.
      const [a, b, cx2, d2] = f.properties.bbox;
      const lado = Math.max((cx2 - a) * s, (d2 - b) * s);
      if (lado < w * 0.13) {
        const cx = ((a + cx2) / 2 - x0) * s + ox, cy = (y1 - (b + d2) / 2) * s + oy;
        foco += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5.5" `
              + `fill="none" stroke="#fff" stroke-width="1.3" opacity=".95"/>`;
      }
    } else {
      base += `<path d="${d}" fill="${C.verdeMedio}" stroke="${C.verdeMedio}" stroke-width=".5"/>`;
    }
  }
  return abrirSVG(w, h, 'Situación del municipio', false) + base + foco + '</svg>';
}

/* ============================================================== evolución === */
function graficoEvolucion(ev, w = 560, h = 210) {
  const m = { t: 26, r: 10, b: 24, l: 46 };
  const X = ev.anios, Y = ev.valores;
  const max = Math.max(...Y) * 1.12;
  const paso = pasoRedondo(max, 4);
  const tope = Math.ceil(max / paso) * paso;
  const px = (a) => m.l + (a - X[0]) / (X[X.length - 1] - X[0]) * (w - m.l - m.r);
  const py = (v) => h - m.b - (v / tope) * (h - m.t - m.b);

  let rejilla = '', ejeY = '';
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${C.linea}"/>`;
    ejeY += `<text x="${m.l - 8}" y="${(py(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" fill="${C.tinta40}">${nf(v)}</text>`;
  }
  let ejeX = '';
  const salto = pasoRedondo(X[X.length - 1] - X[0], 5);
  for (let a = Math.ceil(X[0] / salto) * salto; a <= X[X.length - 1]; a += salto) {
    ejeX += `<text x="${px(a).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="9.5" fill="${C.tinta40}">${a}</text>`;
  }

  const pts = X.map((a, i) => `${px(a).toFixed(1)},${py(Y[i]).toFixed(1)}`);
  const area = `M${px(X[0]).toFixed(1)},${(h - m.b).toFixed(1)} L${pts.join(' L')} L${px(X[X.length - 1]).toFixed(1)},${(h - m.b).toFixed(1)}Z`;

  // Cápsula con la variación acumulada, en la esquina libre. El signo lo lleva
  // la flecha: el coral queda reservado para la población de origen extranjero.
  const v = ev.variacion_acumulada;
  const capsula = v == null ? '' : `
    <g transform="translate(${m.l + 10}, ${m.t - 8})">
      <rect x="0" y="-11" width="58" height="21" rx="10.5" fill="${C.verde}"/>
      <text x="29" y="4" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${v >= 0 ? '▲' : '▼'} ${nf(Math.abs(v), 1)}%</text>
      <text x="66" y="4" font-size="10.5" fill="${C.tinta60}">acumulada ${ev.anio_base}–${ev.anio_fin}</text>
    </g>`;

  return abrirSVG(w, h, `Evolución de la población entre ${X[0]} y ${X[X.length - 1]}`)
    + rejilla
    + `<path d="${area}" fill="${C.verde}" opacity=".10"/>`
    + `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.verde}" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<circle cx="${px(X[X.length - 1]).toFixed(1)}" cy="${py(Y[Y.length - 1]).toFixed(1)}" r="3.6" fill="${C.verde}"/>`
    + ejeY + ejeX + capsula + '</svg>';
}

/* ============================================== peso de origen extranjero === */
function graficoExtranjero(ext, w = 300, h = 210) {
  const m = { t: 16, r: 40, b: 24, l: 34 };
  const A = ext.anios, M = ext.municipio, R = ext.canarias;
  const vivos = (V) => A.map((a, i) => [a, V[i]]).filter(([, v]) => v != null && isFinite(v));
  const tope = Math.ceil(Math.max(...M.concat(R).filter((v) => v != null)) * 1.18 / 5) * 5;
  const px = (a) => m.l + (a - A[0]) / (A[A.length - 1] - A[0]) * (w - m.l - m.r);
  const py = (v) => h - m.b - (v / tope) * (h - m.t - m.b);

  let rejilla = '', ejeY = '';
  for (let v = 0; v <= tope; v += pasoRedondo(tope, 4)) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${C.linea}"/>`;
    ejeY += `<text x="${m.l - 7}" y="${(py(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="9.5" fill="${C.tinta40}">${v}%</text>`;
  }
  const linea = (V, col, gr) =>
    `<polyline points="${vivos(V).map(([a, v]) => `${px(a).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${gr}" stroke-linejoin="round"/>`;

  const ultimo = vivos(M).at(-1)[1];
  return abrirSVG(w, h, 'Peso de la población de origen extranjero, municipio frente a Canarias')
    + rejilla
    + linea(R, C.verdeClaro, 2)
    + linea(M, C.coral, 2.4)
    + `<circle cx="${px(A[A.length - 1]).toFixed(1)}" cy="${py(ultimo).toFixed(1)}" r="3.4" fill="${C.coral}"/>`
    + `<text x="${(px(A[A.length - 1]) + 6).toFixed(1)}" y="${(py(ultimo) + 3.5).toFixed(1)}" font-size="11" font-weight="700" fill="${C.coral}">${pct(ultimo)}</text>`
    + ejeY
    + `<text x="${px(A[0]).toFixed(1)}" y="${h - 8}" text-anchor="start" font-size="9.5" fill="${C.tinta40}">${A[0]}</text>`
    + `<text x="${px(A[A.length - 1]).toFixed(1)}" y="${h - 8}" text-anchor="end" font-size="9.5" fill="${C.tinta40}">${A[A.length - 1]}</text>`
    + '</svg>';
}

/* =============================================================== pirámide === */
/** Pirámide del municipio con la población de origen extranjero superpuesta
 *  y el perfil de Canarias como contorno escalonado. */
function graficoPiramide(p, w = 560, h = 350) {
  const m = { t: 24, r: 12, b: 26, l: 12 };
  const n = p.edades.length;
  const total = p.hombres.reduce((a, b) => a + b, 0) + p.mujeres.reduce((a, b) => a + b, 0);
  const H = p.hombres.map((v) => v / total * 100);
  const M = p.mujeres.map((v) => v / total * 100);
  const HX = (p.extranjera_hombres || []).map((v) => v / total * 100);
  const MX = (p.extranjera_mujeres || []).map((v) => v / total * 100);

  const tope = Math.ceil(Math.max(...H, ...M, ...p.canarias_hombres, ...p.canarias_mujeres) * 1.1);
  // El hueco central se encoge en pantallas estrechas para no comerse las barras.
  const centro = w / 2, hueco = acotar(w * 0.11, 34, 58);
  const anchoLado = centro - hueco / 2 - m.l;
  const altoFila = (h - m.t - m.b) / n;
  const barra = altoFila * 0.78;
  const fy = (i) => m.t + (n - 1 - i) * altoFila;
  const esc = (v) => v / tope * anchoLado;

  let rejilla = '', ejeX = '';
  for (let v = 0; v <= tope; v += pasoRedondo(tope, 3)) {
    for (const s of [-1, 1]) {
      const x = centro + s * (hueco / 2 + esc(v));
      rejilla += `<line x1="${x.toFixed(1)}" y1="${m.t}" x2="${x.toFixed(1)}" y2="${h - m.b}" stroke="${C.linea}"/>`;
      ejeX += `<text x="${x.toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="9" fill="${C.tinta40}">${v}%</text>`;
      if (v === 0) break;   // el cero es uno solo, no uno por lado
    }
  }

  let barras = '', etiquetas = '', contorno = '';
  for (let i = 0; i < n; i++) {
    const y = fy(i).toFixed(1), alt = barra.toFixed(1);
    const xh = (centro - hueco / 2 - esc(H[i])).toFixed(1);
    const xm = (centro + hueco / 2).toFixed(1);
    barras += `<rect x="${xh}" y="${y}" width="${esc(H[i]).toFixed(1)}" height="${alt}" fill="${C.verde}" rx="1.5"/>`;
    barras += `<rect x="${xm}" y="${y}" width="${esc(M[i]).toFixed(1)}" height="${alt}" fill="${C.verdeMedio}" rx="1.5"/>`;
    if (HX.length) {
      barras += `<rect x="${(centro - hueco / 2 - esc(HX[i])).toFixed(1)}" y="${y}" width="${esc(HX[i]).toFixed(1)}" height="${alt}" fill="${C.coral}" rx="1.5"/>`;
      barras += `<rect x="${xm}" y="${y}" width="${esc(MX[i]).toFixed(1)}" height="${alt}" fill="${C.coral}" rx="1.5"/>`;
    }
    etiquetas += `<text x="${centro}" y="${(fy(i) + barra / 2 + 3).toFixed(1)}" text-anchor="middle" font-size="8" fill="${C.tinta60}">${p.edades[i]}</text>`;
  }

  // Contorno de Canarias: línea escalonada a cada lado.
  for (const [serie, signo] of [[p.canarias_hombres, -1], [p.canarias_mujeres, 1]]) {
    // De abajo arriba. fy(i) es el borde SUPERIOR de la barra i y el grupo 0 es
    // el de abajo, así que dentro de cada barra hay que ir de fy+barra a fy: al
    // revés las diagonales se cruzan y el perfil sale como un rombo.
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = centro + signo * (hueco / 2 + esc(serie[i]));
      pts.push(`${x.toFixed(1)},${(fy(i) + barra).toFixed(1)}`, `${x.toFixed(1)},${fy(i).toFixed(1)}`);
    }
    contorno += `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.tinta60}" stroke-width="1.1" stroke-dasharray="3 2" opacity=".75"/>`;
  }

  // HOMBRES / MUJERES arriba: abajo chocaban con las marcas del eje.
  return abrirSVG(w, h, 'Pirámide de población del municipio, con la población de origen extranjero superpuesta y el perfil de Canarias')
    + rejilla + barras + contorno + etiquetas + ejeX
    + `<text x="${(centro - hueco / 2 - anchoLado / 2).toFixed(1)}" y="${m.t - 1}" text-anchor="middle" font-size="9.5" font-weight="700" letter-spacing="1" fill="${C.tinta60}">HOMBRES</text>`
    + `<text x="${(centro + hueco / 2 + anchoLado / 2).toFixed(1)}" y="${m.t - 1}" text-anchor="middle" font-size="9.5" font-weight="700" letter-spacing="1" fill="${C.tinta60}">MUJERES</text>`
    + '</svg>';
}

/* ========================================================== componentes === */
function graficoComponentes(c, w = 560, h = 210) {
  const m = { t: 22, r: 10, b: 24, l: 50 };
  const A = c.anios;
  const pares = A.map((a, i) => [c.vegetativo[i], c.migratorio[i]]);
  const vals = pares.flat().filter((v) => v != null && isFinite(v));
  const max = Math.max(...vals.map(Math.abs)) * 1.1;
  const paso = pasoRedondo(max * 2, 4);
  const tope = Math.ceil(max / paso) * paso;
  const py = (v) => m.t + (tope - v) / (2 * tope) * (h - m.t - m.b);
  const ancho = (w - m.l - m.r) / A.length;
  const bw = ancho * 0.36;

  let rejilla = '', ejeY = '';
  for (let v = -tope; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${v === 0 ? C.tinta40 : C.linea}"/>`;
    ejeY += `<text x="${m.l - 8}" y="${(py(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="${C.tinta40}">${nf(v)}</text>`;
  }
  let barras = '', ejeX = '';
  A.forEach((a, i) => {
    const x = m.l + i * ancho + ancho / 2;
    [[c.vegetativo[i], C.verdeClaro, -1], [c.migratorio[i], C.coral, 1]].forEach(([v, col, s]) => {
      if (v == null || !isFinite(v)) return;
      const y0 = py(0), y1 = py(v);
      barras += `<rect x="${(x + s * bw / 2 - bw / 2 + s * 0.6).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" fill="${col}" rx="1"/>`;
    });
    if (a % 4 === 0) ejeX += `<text x="${x.toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="9" fill="${C.tinta40}">${a}</text>`;
  });

  // Los años apartados por cambio de términos municipales se marcan en el eje
  // en lugar de desaparecer sin más.
  let marcas = '';
  for (const an of c.anomalias || []) {
    const i = A.indexOf(an.anio);
    if (i < 0) continue;
    const x = m.l + i * ancho + ancho / 2;
    marcas += `<line x1="${x.toFixed(1)}" y1="${m.t}" x2="${x.toFixed(1)}" y2="${h - m.b}" stroke="${C.tinta40}" stroke-width="1" stroke-dasharray="2 3"/>`
            + `<text x="${x.toFixed(1)}" y="${m.t - 2}" text-anchor="middle" font-size="8.5" fill="${C.tinta40}">${an.anio}</text>`;
  }

  return abrirSVG(w, h, 'Crecimiento vegetativo y saldo migratorio por año')
    + rejilla + barras + marcas + ejeY + ejeX + '</svg>';
}

/* ====================================================== lugar de nacimiento === */
function graficoOrigen(o, w = 300, h = 150) {
  const cols = [C.verde, C.verdeClaro, C.coral];
  const filas = [['Municipio', o.municipio], ['Canarias', o.canarias]];
  const bw = w - 4, alto = 30;
  let out = '';
  filas.forEach(([tit, vals], k) => {
    const y = 20 + k * 66;
    out += `<text x="0" y="${y - 6}" font-size="11" font-weight="600" fill="${C.tinta60}">${tit}</text>`;
    let x = 0;
    vals.forEach((v, i) => {
      const an = (v || 0) / 100 * bw;
      out += `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(an, 0).toFixed(1)}" height="${alto}" fill="${cols[i]}"/>`;
      if (an > 24) out += `<text x="${(x + an / 2).toFixed(1)}" y="${y + alto / 2 + 4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${i === 1 ? C.tinta60 : '#fff'}">${nf(v, 1)}%</text>`;
      x += an;
    });
  });
  return abrirSVG(w, h, 'Población según lugar de nacimiento, municipio frente a Canarias') + out + '</svg>';
}

/* ============================================== índices comparados (HTML) === */
function bloqueIndices(ind, codigos, nombreMun, isla) {
  return codigos.map((cod) => {
    const d = ind[cod];
    const filas = [
      ['Canarias', d.canarias, false], [isla, d.isla, false], [nombreMun, d.municipio, true],
    ].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));   // ordenados por valor, no por jerarquía
    const max = Math.max(...filas.map((f) => f[1] ?? 0)) || 1;
    const dec = cod === 'C10' ? 2 : 1;
    return `<div class="indice">
      <div class="indice-tit"><b>${esc(d.etiqueta)}</b><em>${d.anio}${d.unidad ? ' · ' + d.unidad : ''}</em></div>
      <div class="pista">${filas.map(([n, v, propia]) => `
        <div class="fila${propia ? ' propia' : ''}">
          <span>${esc(n)}</span>
          <div class="raya"><i style="width:${((v ?? 0) / max * 100).toFixed(1)}%"></i></div>
          <b>${nf(v, dec)}</b>
        </div>`).join('')}</div>
    </div>`;
  }).join('');
}

/* ================================================= aportación migratoria === */
/** Compara cada índice con su variante calculada solo sobre nacidos en España.
 *  Es la lectura que el ISTAC no publica y la que da sentido a esta ficha. */
function bloqueAporte(ind) {
  const pares = [
    ['Dependencia', 'C17', 'C19',
     'Población dependiente por cada 100 personas en edad de trabajar.'],
    ['Reemplazo laboral', 'C14', 'C16',
     'Jóvenes de 15 a 19 años por cada 100 personas de 60 a 64, próximas a jubilarse.'],
  ];
  return pares.map(([tit, cCon, cSin, expl]) => {
    const con = ind[cCon].municipio, sin = ind[cSin].municipio;
    if (con == null || sin == null) return '';
    const dif = sin - con;                       // efecto de quitar a los nacidos fuera
    // En dependencia, más es peor; en reemplazo laboral, más es mejor.
    const sube = dif > 0;
    // En dependencia subir es malo; en reemplazo laboral, bueno. Si dejar fuera
    // a los nacidos en el extranjero empeora el indicador, es que lo mejoraban.
    const quitarlosEmpeora = tit === 'Dependencia' ? sube : !sube;
    const frase = `Contando solo a los nacidos en España, ${tit.toLowerCase()} `
      + `${sube ? 'sube' : 'baja'} hasta ${nf(sin, 1)}% — ${nf(Math.abs(dif), 1)} puntos `
      + `${sube ? 'más' : 'menos'}. La población nacida fuera `
      + `${quitarlosEmpeora ? 'mejora' : 'empeora'} este indicador.`;
    return `<div class="aporte-fila">
      <h3>${tit}</h3><p>${expl}</p>
      <div class="duo">
        <div class="duo-lado con"><span>Toda la población</span><b>${nf(con, 1)}%</b></div>
        <div class="flecha">${sube ? '▲' : '▼'} ${nf(Math.abs(dif), 1)}<br><em style="font-style:normal;font-weight:500">puntos</em></div>
        <div class="duo-lado sin"><span>Solo nacidos en España</span><b>${nf(sin, 1)}%</b></div>
      </div>
      <p style="margin:10px 0 0">${frase}</p>
    </div>`;
  }).join('');
}

/* ================================================================ montaje === */
let GEO = null, INDICE = null, FICHA = null;

async function cargar(codmun) {
  const f = await (await fetch(`datos/mun/${codmun}.json`)).json();
  pintar(f);
  history.replaceState(null, '', `?municipio=${codmun}`);
}

// Como los gráficos se dibujan a la medida de la tarjeta, hay que rehacerlos
// cuando cambia el ancho: girar el móvil, redimensionar la ventana o el propio
// iframe de WordPress al recalcularse.
let temporizador = null;
let anchoPrevio = window.innerWidth;
addEventListener('resize', () => {
  if (!FICHA || window.innerWidth === anchoPrevio) return;
  anchoPrevio = window.innerWidth;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => pintar(FICHA), 180);
});

function pintar(f) {
  FICHA = f;
  const doc = document;
  doc.title = `${f.nombre} · Fichas municipales · Canarias Convive`;

  // --- cabecera y localizador ---
  doc.getElementById('migas').textContent = `${f.isla} · ${f.comarca.replace(/^.*? - /, '')}`;
  doc.getElementById('nombre').textContent = f.nombre;
  doc.getElementById('habitantes').innerHTML =
    `<b>${nf(f.poblacion)}</b><span>habitantes · ${f.anio}</span>`;

  const niveles = [
    ['Canarias', () => true, f.rankings.canarias],
    [f.isla, (g) => g.properties.isla === f.isla, f.rankings.isla],
    ['Comarca', (g) => g.properties.comarca === f.comarca, f.rankings.comarca],
  ];
  doc.getElementById('localizador').innerHTML = niveles.map(([tit, filtro, r]) => `
    <figure class="loc">
      ${mapaLocalizador(GEO, f.codmun, filtro, 118, 76)}
      <figcaption class="loc-pie"><b>${r.puesto}º de ${r.total}</b>${esc(tit)} · ${pct(r.peso, 2)}</figcaption>
    </figure>`).join('');

  // --- cifras clave ---
  const c = f.cifras;
  doc.getElementById('cifras').innerHTML = [
    [firma(c.tvma, 1), 'Variación media anual', `${f.evolucion.anio_base}–${f.evolucion.anio_fin}`, false],
    [nf(c.edad_media, 1), 'Edad media', 'años', false],
    [pct(c.pct_mujeres), 'Mujeres', nf(c.mujeres), false],
    [pct(c.pct_hombres), 'Hombres', nf(c.hombres), false],
    [pct(ultimoValido(f.extranjero.municipio)), 'De origen extranjero',
     `Canarias ${pct(ultimoValido(f.extranjero.canarias))}`, true],
  ].map(([v, t, e, ac]) =>
    `<div class="cifra${ac ? ' acento' : ''}"><b>${v}</b><i>${t}</i><em>${e}</em></div>`).join('');

  // --- gráficos, dibujados a 1:1 sobre el ancho real de cada tarjeta ---
  const wEv = anchoDe('g-evolucion'), wEx = anchoDe('g-extranjero', 300);
  const wPi = anchoDe('g-piramide'), wCo = anchoDe('g-componentes');
  const wOr = anchoDe('g-origen', 300);

  doc.getElementById('g-evolucion').innerHTML =
    graficoEvolucion(f.evolucion, wEv, acotar(wEv * 0.40, 180, 250));
  doc.getElementById('g-extranjero').innerHTML =
    graficoExtranjero(f.extranjero, wEx, acotar(wEx * 0.70, 190, 240));
  doc.getElementById('g-piramide').innerHTML =
    graficoPiramide(f.piramide, wPi, acotar(wPi * 0.62, 330, 430));
  const anom = f.componentes.anomalias || [];
  doc.getElementById('g-componentes').innerHTML =
    graficoComponentes(f.componentes, wCo, acotar(wCo * 0.36, 180, 240))
    + (anom.length ? `<figcaption class="nota">${anom.map((a) =>
        `En ${a.anio} no se representa el ${a.serie === 'migratorio' ? 'saldo migratorio' : 'crecimiento vegetativo'} `
        + `(${nf(a.valor)}): corresponde a un ${a.motivo}, no a un flujo demográfico real.`).join(' ')}</figcaption>` : '');
  doc.getElementById('g-origen').innerHTML = graficoOrigen(f.origen, wOr, 150);

  doc.getElementById('g-indices').innerHTML =
    bloqueIndices(f.indices, ['C10', 'C11', 'C17', 'C14', 'C21'], f.nombre, f.isla);
  doc.getElementById('g-aporte').innerHTML = bloqueAporte(f.indices);

  doc.getElementById('pie-anio').textContent = f.anio;
}

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
  await cargar(inicial);
}

iniciar().catch((e) => {
  document.getElementById('nombre').textContent = 'No se han podido cargar los datos';
  console.error(e);
});

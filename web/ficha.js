/* Ficha municipal: gráficos en SVG generado a mano, sin librerías.
   Dos reglas de Pedro para todo el fichero: paleta azul (ningún color de alerta
   sobre personas) y la ficha muestra datos sin interpretarlos. */

const C = {
  azul: '#185FA5', azulMedio: '#2E75B6', azulClaro: '#85B7EB', azulPalido: '#B5D4F4',
  negro: '#1A1A1A', gris: '#5F5E5A', gris40: '#82817C', rejilla: '#D9D9D9',
};
const TONOS = [C.azulPalido, C.azulClaro, C.azul];       // escala de menor a mayor
const TONOS_ORIGEN = ['#185FA5', '#6FA6D8', '#B5D4F4'];  // lugar de nacimiento
const ANIO_INICIO_COMPONENTES = 2002;   // arranque de la serie de saldo migratorio
// Los dos lados de la pirámide: [lado, signo, clave de la serie].
const LADOS_PI = [['h', -1, 'H'], ['m', 1, 'M']];

/* ------------------------------------------------------------- utilidades -- */

/** Paso 1-2-5 × 10ⁿ para ~`objetivo` divisiones. */
function pasoRedondo(rango, objetivo = 5) {
  if (!(rango > 0)) return 1;
  const bruto = rango / objetivo;
  const exp = Math.pow(10, Math.floor(Math.log10(bruto)));
  for (const m of [1, 2, 5, 10]) if (bruto <= m * exp) return m * exp;
  return 10 * exp;
}

/** Menor número redondo ≥ v cuya mitad también es redonda (ejes simétricos). */
function topeRedondo(v) {
  if (!(v > 0)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 4, 6, 8, 10]) if (v <= m * exp + 1e-9) return m * exp;
  return 10 * exp;
}

/* ---------------------------------------------------------- impresión ----- */
/* Al imprimir, los gráficos se redibujan a la medida de la hoja (escalar un SVG
   de pantalla deja las letras ilegibles). Caja útil de la A4: 190 mm, retícula
   de doce columnas. */
const MM = 96 / 25.4;                 // píxeles CSS por milímetro
const HOJA = 190, HUECO = 2, PAD = 3;
let IMPRIMIENDO = false;
/** El dossier dibuja las 88 fichas a medida de hoja. */
function modoHoja(v) { IMPRIMIENDO = v; }

/** Ancho interior de una tarjeta de `cols` columnas, en píxeles CSS. */
function anchoHoja(cols) {
  const col = (HOJA - 11 * HUECO) / 12;
  return Math.round((col * cols + HUECO * (cols - 1) - 2 * PAD) * MM);
}
const mm = (v) => Math.round(v * MM);

function anchoDe(id, porDefecto = 520) {
  const e = document.getElementById(id);
  const w = e ? e.clientWidth : 0;
  return w > 60 ? w : porDefecto;
}

/** Apertura del SVG. Los gráficos se dibujan 1:1 sobre el ancho real de su tarjeta. */
function abrirSVG(w, h, titulo, fluido = true) {
  return `<svg viewBox="0 0 ${w} ${h}" ${fluido ? 'width="100%"' : `width="${w}" height="${h}"`} `
       + `role="img" aria-label="${esc(titulo)}" preserveAspectRatio="xMidYMid meet">`;
}

/** Interpolación cúbica monótona (Fritsch-Carlson, como el PCHIP del cuaderno de
 *  Pedro): suaviza sin inventar máximos ni mínimos. */
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
/** Mapa de situación. `conLimites` dibuja las divisiones municipales (el del
 *  archipiélago va sin ellas). */
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

/** Los mapas de la ficha y del dossier: [rótulo del pie, filtro, puesto, con límites].
 *  El tercero dice «en la comarca» (con el nombre real salían pies como «en Oeste»);
 *  en El Hierro la comarca es la isla y no hay tercero. */
function nivelesMapas(f) {
  const niveles = [
    ['en Canarias', () => true, f.rankings.canarias, false],
    [`en ${f.isla}`, (g) => g.properties.isla === f.isla, f.rankings.isla, true],
  ];
  if (comarcaDe(f)) niveles.push(['en la comarca', (g) => g.properties.comarca === f.comarca, f.rankings.comarca, true]);
  return niveles;
}

/* -------------------------------------------------------------- evolución -- */
let EVOLUCION = null;   // geometría del último gráfico dibujado, para la lectura al pasar el ratón
function graficoEvolucion(ev, w, h, sufijo = '') {
  const P = IMPRIMIENDO;
  const m = P ? { t: 20, r: 8, b: 13, l: 36 } : { t: 30, r: 14, b: 26, l: 52 };
  const fe = P ? 6.5 : 10;
  const X = ev.anios, Y = ev.valores;
  // Cápsula con la variación acumulada y su rótulo. Si el rótulo no cabe al lado
  // (pantallas estrechas) baja a una segunda línea y el margen superior crece
  // para que los dos queden por encima de la rejilla. Se decide antes de la rejilla.
  const v = ev.variacion_acumulada;
  const leyendaVar = `Variación acumulada entre ${ev.anio_base} y ${ev.anio_fin}`;
  const textoVar = `${v >= 0 ? '\u25B2' : '\u25BC'} ${nf(Math.abs(v), 1)}${UNI}%`;
  const alto = P ? 13 : 20, fc = P ? 8 : 11, fl = P ? 7 : 10.5;
  const anchoCapsula = Math.max(P ? 40 : 58, textoVar.length * (P ? 4.7 : 6.4) + (P ? 10 : 16));
  const cabeAlLado = w - m.r - (m.l + anchoCapsula + 16) > leyendaVar.length * (P ? 3.8 : 5.6);
  if (!cabeAlLado) m.t += P ? 12 : 16;
  const paso = pasoRedondo(Math.max(...Y) * 1.12, 5);
  const tope = Math.ceil(Math.max(...Y) * 1.12 / paso) * paso;
  const px = (a) => m.l + (a - X[0]) / (X[X.length - 1] - X[0]) * (w - m.l - m.r);
  const py = (v) => h - m.b - (v / tope) * (h - m.t - m.b);

  let rejilla = '', ejeY = '';
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${C.rejilla}"/>`;
    ejeY += `<text x="${m.l - (P ? 5 : 9)}" y="${(py(v) + fe * .35).toFixed(1)}" text-anchor="end" font-size="${fe}" fill="${C.gris}">${nf(v)}</text>`;
  }
  // El eje temporal va de cinco en cinco años: cuadra con el último dato, 2025.
  let ejeX = '';
  for (let a = Math.ceil(X[0] / 5) * 5; a <= X[X.length - 1]; a += 5) {
    ejeX += `<text x="${px(a).toFixed(1)}" y="${h - (P ? 4 : 8)}" text-anchor="middle" font-size="${fe}" fill="${C.gris}">${a}</text>`;
  }

  EVOLUCION = { X, Y, px, py, w, m };
  const curva = suavizar(X, Y).map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`);
  const area = `M${px(X[0]).toFixed(1)},${(h - m.b).toFixed(1)} L${curva.join(' L')} L${px(X[X.length - 1]).toFixed(1)},${(h - m.b).toFixed(1)}Z`;

  // Plegada, la cápsula sube lo que ocupa la segunda línea, que va debajo de ella.
  const centroCapsula = m.t - (P ? 8 : 12) - (cabeAlLado ? 0 : (P ? 13 : 19));
  const rotulo = v == null ? '' : `
    <g transform="translate(${m.l + 8}, ${centroCapsula})">
      <rect x="0" y="${-alto / 2}" width="${anchoCapsula.toFixed(0)}" height="${alto}" rx="${alto / 2}" fill="${C.azul}"/>
      <text x="${(anchoCapsula / 2).toFixed(0)}" y="${(fc * .36).toFixed(1)}" text-anchor="middle" font-size="${fc}" font-weight="700" fill="#fff">${textoVar}</text>
      <text x="${cabeAlLado ? (anchoCapsula + 9).toFixed(0) : (2 - m.l - 8).toFixed(0)}" y="${cabeAlLado ? (fl * .36).toFixed(1) : (alto / 2 + fl + 1).toFixed(1)}" font-size="${cabeAlLado ? fl : fl - .5}" fill="${C.negro}">${leyendaVar}</text>
    </g>`;

  return abrirSVG(w, h, `Evolución de la población entre ${X[0]} y ${X[X.length - 1]}`)
    + rejilla
    + `<defs><linearGradient id="degradado-evolucion${sufijo}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.azul}" stop-opacity=".22"/><stop offset="1" stop-color="${C.azul}" stop-opacity=".02"/></linearGradient></defs>`
    + `<path d="${area}" fill="url(#degradado-evolucion${sufijo})"/>`
    + `<polyline points="${curva.join(' ')}" fill="none" stroke="${C.azul}" stroke-width="2.3" stroke-linejoin="round"/>`
    + `<circle cx="${px(X[X.length - 1]).toFixed(1)}" cy="${py(Y[Y.length - 1]).toFixed(1)}" r="4" fill="${C.azul}"/>`
    + ejeY + ejeX + rotulo
    + (sufijo ? '' : `<g id="guia-evolucion" opacity="0" pointer-events="none">`
    + `<line y1="${m.t}" y2="${h - m.b}" stroke="${C.azul}" stroke-width="1" stroke-dasharray="3 3"/>`
    + `<circle r="4.5" fill="${C.azul}" stroke="#fff" stroke-width="1.6"/></g>`
    + `<rect id="cazador-evolucion" x="${m.l}" y="${m.t}" width="${(w - m.l - m.r).toFixed(1)}" `
    + `height="${(h - m.t - m.b).toFixed(1)}" fill="transparent"/>`)
    + '</svg>';
}

/* --------------------------------------------- peso de origen extranjero --- */
/** Barras del municipio, la última destacada con su porcentaje encima, y una
 *  línea para Canarias. El margen derecho deja sitio a esa etiqueta. */
function graficoExtranjero(ext, w, h) {
  const P = IMPRIMIENDO;
  const m = P ? { t: 21, r: 24, b: 13, l: 26 } : { t: 30, r: 34, b: 26, l: 42 };
  const fe = P ? 6.5 : 10;
  const A = ext.anios, M = ext.municipio, R = ext.canarias;
  const vivos = A.map((a, i) => [a, M[i]]).filter(([, v]) => v != null && isFinite(v));
  // Eje de 5 en 5 (Pedro), tope en el múltiplo justo por encima del máximo;
  // por encima del 40 % se rotulan los múltiplos de 10 y el tope, sin el
  // múltiplo anterior si queda pegado (como en la pirámide).
  const maximo = Math.max(...M.concat(R).filter((v) => v != null));
  const paso = 5;
  const tope = Math.ceil(maximo / paso) * paso;
  const cadaRotulo = tope > 40 ? 10 : 5;

  const ancho = (w - m.l - m.r) / vivos.length;
  const bw = Math.min(ancho * 0.62, P ? 14 : 26);
  const px = (i) => m.l + i * ancho + ancho / 2;
  const py = (v) => h - m.b - (v / tope) * (h - m.t - m.b);

  let rejilla = '', ejeY = '';
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${C.rejilla}"/>`;
    if (v === tope || (v % cadaRotulo === 0 && tope - v >= cadaRotulo)) ejeY += `<text x="${m.l - (P ? 4 : 8)}" y="${(py(v) + fe * .35).toFixed(1)}" text-anchor="end" font-size="${fe}" fill="${C.gris}">${nf(v)}${UNI}%</text>`;
  }

  // La línea de Canarias va sobre las posiciones de las barras (El Pinar y
  // Frontera tienen huecos en la serie) y suavizada como la curva de evolución.
  const paresCan = vivos.map(([a], i) => [i, R[A.indexOf(a)]])
    .filter(([, v]) => v != null && isFinite(v));
  const trazoCan = paresCan.length >= 3
    ? suavizar(paresCan.map(([i]) => i), paresCan.map(([, v]) => v))
    : paresCan;
  const lineaCan = trazoCan.map(([i, v]) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);

  let barras = '', etiqueta = '', ejeX = '';
  const feEtiqueta = P ? 9 : 13;
  vivos.forEach(([a, v], i) => {
    const ultima = i === vivos.length - 1;
    barras += `<rect x="${(px(i) - bw / 2).toFixed(1)}" y="${py(v).toFixed(1)}" width="${bw.toFixed(1)}" `
            + `height="${(h - m.b - py(v)).toFixed(1)}" fill="${ultima ? C.azul : C.azulClaro}" rx="1.5"/>`;
    if (ultima) {
      // La cifra va sobre la barra y, si la línea de Canarias pasa por ahí, sobre
      // la línea; se pinta después de ella y nunca por encima del borde.
      const medioAncho = (`${nf(v, 1)}${UNI}%`.length * feEtiqueta * 0.55) / 2 + 2;
      const xq = px(i);
      const yLinea = Math.min(Infinity, ...trazoCan.filter(([j]) => Math.abs(px(j) - xq) <= medioAncho).map(([, c]) => py(c)));
      const y = Math.max(feEtiqueta, Math.min(py(v), yLinea) - (P ? 4 : 8));
      etiqueta = `<text x="${xq.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" `
              + `font-size="${feEtiqueta}" font-weight="700" fill="${C.negro}" `
              + `stroke="#FFFFFF" stroke-width="${P ? 2.4 : 3.2}" stroke-linejoin="round" `
              + `paint-order="stroke fill">${nf(v, 1)}${UNI}%</text>`;
    }
    if (a % 5 === 0 || ultima) {
      ejeX += `<text x="${px(i).toFixed(1)}" y="${h - (P ? 4 : 8)}" text-anchor="middle" font-size="${fe}" fill="${C.gris}">${a}</text>`;
    }
  });

  return abrirSVG(w, h, 'Peso de la población de origen extranjero, municipio frente a Canarias')
    + rejilla + barras
    + `<polyline points="${lineaCan.join(' ')}" fill="none" stroke="${C.negro}" stroke-width="1.6" stroke-linejoin="round"/>`
    + etiqueta + ejeY + ejeX + '</svg>';
}

/* --------------------------------------------------------------- pirámide -- */
/* El eje de cada pestaña es el par más pequeño (6, 8, 10…) que cubre sus barras
   (`ejeAutomatico`, comun.js), regla de Pedro: «al 6 u 8 por cien según el
   valor; si hay excepciones, que se ajuste automáticamente». exportar_datos.py
   imprime el reparto por municipio en cada exportación. */

/* Alto de la pirámide en la hoja A4: la única constante que se toca si la hoja
   no cupiera. Por debajo de mm(52) el marco negro no se puede dibujar. */
const ALTO_PIRAMIDE_A4 = mm(64);

/** Medidas para papel, pantalla estrecha y pantalla. `hueco` es el canal
 *  central con el grupo de edad («100 o más») y `feEdad` su cuerpo. */
function medidasPiramide(w) {
  if (IMPRIMIENDO) return { m: { t: 11, r: 10, b: 13, l: 10 }, hueco: 36, s: 0.7, fe: 8,   feEdad: 6.5, rej: 0.6 };
  if (w < 430)     return { m: { t: 12, r: 8,  b: 26, l: 8  }, hueco: 44, s: 1.0, fe: 8.5, feEdad: 8,   rej: 1 };
  return           { m: { t: 14, r: 12, b: 30, l: 12 }, hueco: 50, s: 1.1, fe: 9.5, feEdad: 8.5, rej: 1 };
}

/** Marco negro de una barra: tres lados, abierto contra el eje (cerrado, las 21
 *  marcas formarían dos columnas negras). El trazo se mete media anchura para
 *  que el borde exterior caiga sobre el dato; por debajo de dos anchuras de
 *  trazo queda una marca vertical en la posición del dato. */
function glifoNegro(x0, signo, largo, y, alto, s) {
  if (!(largo > 0)) return '';
  const xd = x0 + signo * largo;                       // donde cae el dato
  if (largo < s * 2) return `M${xd.toFixed(2)},${y.toFixed(2)}V${(y + alto).toFixed(2)}`;
  const xe = x0 + signo * (largo - s / 2);
  return `M${x0.toFixed(2)},${(y + s / 2).toFixed(2)}`
       + `H${xe.toFixed(2)}V${(y + alto - s / 2).toFixed(2)}H${x0.toFixed(2)}`;
}

/** Construye el SVG de la pirámide y devuelve las dos vistas (pestañas) con la
 *  geometría que necesitan la animación y la lectura. Con `vistaFija` dibuja
 *  esa vista ya rellena y sin ids (dossier, presentación). */
function construirPiramide(p, w, h, vistaFija = null) {
  const n = p.edades.length;
  const { m, hueco, s, fe, feEdad, rej } = medidasPiramide(w);

  const suma = (V) => V.reduce((a, b) => a + b, 0);
  const total = suma(p.hombres) + suma(p.mujeres);
  // Cada población sobre su propio total (los dos sexos juntos): así cada
  // pirámide superpuesta suma 100 en sus 42 barras y son comparables.
  const sobre = (V, t) => t > 0 ? V.map((v) => v / t * 100) : V.map(() => 0);
  const pc = (V) => sobre(V, total);

  const ext = p.extranjera_hombres
    ? { H: p.extranjera_hombres, M: p.extranjera_mujeres }
    : { H: p.hombres.map(() => 0), M: p.mujeres.map(() => 0) };
  const esp = {
    H: p.hombres.map((v, i) => Math.max(0, v - ext.H[i])),
    M: p.mujeres.map((v, i) => Math.max(0, v - ext.M[i])),
  };
  const totalEsp = suma(esp.H) + suma(esp.M);
  const totalExt = suma(ext.H) + suma(ext.M);

  // La primera pestaña es la que abre la ficha y la que se imprime. `rotH`,
  // `rotM` y `rotNegro` son la leyenda, con las palabras de Pedro.
  const vistas = [
    {
      clave: 'canarias', etiqueta: 'Municipio y Canarias',
      relleno: { H: pc(p.hombres), M: pc(p.mujeres) },
      negro: { H: p.canarias_hombres, M: p.canarias_mujeres },
      rotH: 'Hombres', rotM: 'Mujeres', rotNegro: 'Canarias',
    },
    {
      clave: 'municipio', etiqueta: 'Por lugar de nacimiento',
      relleno: { H: sobre(esp.H, totalEsp), M: sobre(esp.M, totalEsp) },
      negro: { H: sobre(ext.H, totalExt), M: sobre(ext.M, totalExt) },
      rotH: 'Hombres españoles', rotM: 'Mujeres españolas', rotNegro: 'Extranjeros',
    },
  ];
  for (const v of vistas) v.eje = ejeAutomatico(Math.max(...v.relleno.H, ...v.relleno.M, ...v.negro.H, ...v.negro.M));

  // ---- geometría ----
  const centro = w / 2;
  const anchoLado = centro - hueco / 2 - m.l;
  const altoFila = (h - m.t - m.b) / n;
  // Barra de 0,8 de la fila (ALTO_BAR del cuaderno de Pedro); en papel 0,7 para
  // que los marcos negros de dos filas seguidas no se peguen. El marco negro
  // tiene la misma altura que la barra.
  const relleno = altoFila * (IMPRIMIENDO ? 0.70 : 0.80);
  const fy = (i) => m.t + (n - 1 - i) * altoFila + (altoFila - relleno) / 2;
  const escala = (v, eje) => acotar(v, 0, eje) / eje * anchoLado;

  const fija = vistaFija == null ? null : vistas[vistaFija];

  // ---- rejilla y eje ----
  // Van en un grupo propio que `mostrarVista` reescribe al cambiar de pestaña.
  // Una vertical por punto hasta 8, cada dos desde 10; rótulos de dos en dos
  // (cada cuatro donde 2 % no llegan a 30 px), el tope siempre rotulado y sin
  // el múltiplo anterior si queda pegado; en el dibujo estrecho el rótulo del
  // tope se ancla hacia dentro para no salirse del borde.
  const ejeSVG = (eje) => {
    const paso = eje <= 8 ? 1 : 2;
    const cada = escala(2, eje) >= 30 ? 2 : 4;
    const estrecho = m.l < 12;
    let out = '';
    for (let v = 0; v <= eje; v += paso) {
      for (const [, signo] of LADOS_PI) {
        const x = centro + signo * (hueco / 2 + escala(v, eje));
        out += `<line x1="${x.toFixed(1)}" y1="${m.t}" x2="${x.toFixed(1)}" y2="${(h - m.b).toFixed(1)}" stroke="${C.rejilla}" stroke-width="${rej}"/>`;
        if (v === eje || (v % cada === 0 && eje - v >= cada)) {
          const ancla = v === eje && estrecho ? (signo < 0 ? 'start' : 'end') : 'middle';
          out += `<text x="${(x - (ancla === 'middle' ? 0 : signo * 2)).toFixed(1)}" y="${(h - m.b + fe + (IMPRIMIENDO ? 3 : 6)).toFixed(1)}" `
               + `text-anchor="${ancla}" font-size="${fe}" fill="${C.gris}">${v}${UNI}%</text>`;
        }
      }
    }
    return out;
  };
  const ejeInicial = (fija || vistas[0]).eje;
  // Sin id cuando la vista es fija: el dossier dibuja 88 pirámides en un documento.
  const rejilla = `<g${fija ? '' : ' id="eje-piramide"'}>${ejeSVG(ejeInicial)}</g>`;

  // ---- barras, glifos y edades ----
  let barras = '', negros = '', etiquetas = '';
  for (let i = 0; i < n; i++) {
    const y = fy(i);
    for (const [lado, signo, clave] of LADOS_PI) {
      const col = lado === 'h' ? C.azulMedio : C.azulClaro;
      const x0 = centro + signo * hueco / 2;
      const aR = fija ? escala(fija.relleno[clave][i], fija.eje) : 0;
      barras += `<rect ${fija ? '' : `id="p${lado}${i}" `}`
              + `x="${(signo < 0 ? x0 - aR : x0).toFixed(2)}" y="${y.toFixed(2)}" `
              + `width="${aR.toFixed(2)}" height="${relleno.toFixed(2)}" fill="${col}"/>`;
      const d = fija ? glifoNegro(x0, signo, escala(fija.negro[clave][i], fija.eje), y, relleno, s) : '';
      negros += `<path ${fija ? '' : `id="n${lado}${i}" `}d="${d}" fill="none" `
              + `stroke="${C.negro}" stroke-width="${s}" stroke-linejoin="miter"/>`;
    }
    etiquetas += `<text x="${centro.toFixed(1)}" y="${(y + relleno / 2 + feEdad * 0.36).toFixed(1)}" `
               + `text-anchor="middle" font-size="${feEdad}" fill="${C.gris}">${esc(p.edades[i])}</text>`;
  }

  // ---- franjas de lectura ----
  let franjas = '';
  if (!fija) {
    franjas = `<rect id="franja-activa" x="${m.l}" y="0" width="${(w - m.l - m.r).toFixed(1)}" `
            + `height="${altoFila.toFixed(1)}" fill="${C.azul}" opacity="0" pointer-events="none"/>`
            + `<g id="marcas-activas" opacity="0" pointer-events="none"></g>`;
    for (let i = 0; i < n; i++) {
      franjas += `<rect class="franja" data-i="${i}" x="${m.l}" y="${(m.t + (n - 1 - i) * altoFila).toFixed(1)}" `
               + `width="${(w - m.l - m.r).toFixed(1)}" height="${altoFila.toFixed(1)}" fill="transparent"/>`;
    }
  }

  const svg = abrirSVG(w, h, 'Pirámide de población en porcentaje sobre el total de cada población')
    + rejilla + barras + negros + etiquetas + franjas + '</svg>';

  return {
    svg, vistas, escala, ejeSVG, centro, hueco, edades: p.edades, w, h, fe,
    fy, relleno, altoFila, trazo: s, glifo: glifoNegro,
    fyFranja: (i) => m.t + (n - 1 - i) * altoFila,   // la franja cubre la fila entera
  };
}

/* --------------------------------------------- índices geodemográficos ----- */
/** Bloque de índices, diseño de Pedro: los tres ámbitos en columnas de menor a
 *  mayor, cada uno con su valor y una pastilla cuyo tono marca la posición.
 *  «Municipio» e «Isla» en vez de los nombres propios (los hay muy largos). */
function bloqueIndices(ind, codigos) {
  return codigos.map((cod) => {
    const d = ind[cod];
    const filas = [['Canarias', d.canarias], ['Isla', d.isla], ['Municipio', d.municipio]]
      .filter(([, v]) => v != null)
      .sort((a, b) => a[1] - b[1]);
    const dec = cod === 'C10' ? 2 : 1;
    // Dos ámbitos con el mismo valor llevan el mismo tono: el de la posición más alta que comparten.
    const tono = (v) => TONOS[2 - filas.filter(([, w]) => w > v).length];
    return `<div class="indice">
      <div class="indice-tit"><b>${esc(d.etiqueta)}</b><em>${d.anio}${d.unidad ? ' · ' + esc(d.unidad) : ''}</em></div>
      <div class="escala">${filas.map(([n, v]) => `
        <div class="peldano" data-ambito="${esc(n)}">
          <span>${esc(n)}</span>
          <b>${nf(v, dec)}</b>
          <i style="background:${tono(v)}"></i>
        </div>`).join('')}</div>
    </div>`;
  }).join('');
}

/* ------------------------------------------------------------ componentes -- */
function graficoComponentes(c, w, h) {
  const P = IMPRIMIENDO;
  const m = P ? { t: 10, r: 8, b: 13, l: 36 } : { t: 16, r: 12, b: 26, l: 52 };
  const fe = P ? 6.5 : 10;
  const idx = c.anios.map((a, i) => i).filter((i) => c.anios[i] >= ANIO_INICIO_COMPONENTES);
  const A = idx.map((i) => c.anios[i]);
  const V = idx.map((i) => c.vegetativo[i]);
  const S = idx.map((i) => c.migratorio[i]);

  const vals = [...V, ...S].filter((v) => v != null && isFinite(v));
  const tope = topeRedondo(Math.max(...vals.map(Math.abs)) * 1.08);
  const paso = tope / 2;                        // dos divisiones a cada lado del cero
  const py = (v) => m.t + (tope - v) / (2 * tope) * (h - m.t - m.b);
  const ancho = (w - m.l - m.r) / A.length;
  const bw = Math.min(ancho * 0.38, P ? 7 : 13);
  // Eje temporal cada dos años (Pedro), también en papel; en pantallas estrechas cada cuatro.
  const cadaAnio = !P && w < 430 ? 4 : 2;

  let rejilla = '', ejeY = '';
  for (let v = -tope; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${v === 0 ? C.gris40 : C.rejilla}"/>`;
    ejeY += `<text x="${m.l - (P ? 5 : 9)}" y="${(py(v) + fe * .35).toFixed(1)}" text-anchor="end" font-size="${fe}" fill="${C.gris}">${nf(v)}</text>`;
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
    if (a % cadaAnio === 0) ejeX += `<text x="${x.toFixed(1)}" y="${h - (P ? 4 : 8)}" text-anchor="middle" font-size="${P ? 6 : 9.5}" fill="${C.gris}">${a}</text>`;
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
/** Anillo con el reparto por lugar de nacimiento (el sector admite el decimal). */
function anilloOrigen(valores, radio = 74, grosor = 30) {
  const total = valores.reduce((a, b) => a + (b || 0), 0);
  if (!(total > 0)) return '';
  const w = radio * 2, cx = radio, cy = radio, re = radio - 1, ri = radio - grosor;

  const P = (ang, rad) => `${(cx + Math.cos(ang) * rad).toFixed(2)},${(cy + Math.sin(ang) * rad).toFixed(2)}`;
  let a0 = -Math.PI / 2, arcos = '';
  valores.forEach((v, i) => {
    const frac = (v || 0) / total;
    if (!(frac > 0)) return;
    // Un sector de vuelta entera no se puede trazar con un solo arco.
    const a1 = a0 + Math.min(frac, 0.9995) * 2 * Math.PI;
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    arcos += `<path d="M${P(a0, re)}A${re},${re} 0 ${grande},1 ${P(a1, re)}`
           + `L${P(a1, ri)}A${ri},${ri} 0 ${grande},0 ${P(a0, ri)}Z" `
           + `fill="${TONOS_ORIGEN[i]}" stroke="#FFFFFF" stroke-width="${(radio > 50 ? 1.6 : 0.7)}"/>`;
    a0 = a1;
  });
  return abrirSVG(w, w, 'Reparto por lugar de nacimiento', false) + arcos + '</svg>';
}

/* ------------------------------------------------------------ tabla oculta -- */
/** Los datos de un gráfico en una tabla solo para lectores de pantalla. */
function tablaOculta(titulo, cabeceras, filas) {
  return `<div class="oculto"><table><caption>${esc(titulo)}</caption>`
    + `<thead><tr>${cabeceras.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>`
    + `<tbody>${filas.map((f) => `<tr>${f.map((v, i) => i ? `<td>${v}</td>` : `<th scope="row">${v}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ------------------------------------------------------------ cifras clave -- */
/** Las cuatro celdas: la cifra, lo que es y el pie que la sitúa. */
function cifrasClave(f) {
  const c = f.cifras, ev = f.evolucion;
  const signo = c.tvma >= 0 ? '+' : '\u2212';   // menos tipográfico, no guion

  const celda = (cifra, unidad, rotulo, pie = '') => `
    <div class="cifra">
      <b>${cifra}${unidad ? `<span>${UNI}${unidad}</span>` : ''}</b>
      <i>${rotulo}</i>
      <em>${pie}</em>
    </div>`;

  return [
    celda(`${signo}${nf(Math.abs(c.tvma), 1)}`, '%', 'Variación media anual',
      `Serie ${ev.anio_base}\u2013${ev.anio_fin}`),
    celda(nf(c.edad_media, 1), 'años', 'Edad media'),
    celda(nf(c.pct_mujeres, 1), '%', 'Mujeres', `${nf(c.mujeres)} personas`),
    celda(nf(c.pct_hombres, 1), '%', 'Hombres', `${nf(c.hombres)} personas`),
  ].join('');
}

/* ------------------------------------------------------------------ montaje -- */
let GEO = null, INDICE = null, FICHA = null, PIRAMIDE = null, VISTA = 0;
let FILA = null;      // grupo de edad señalado en la pirámide, o null
let FIJADA = false;   // fijado con clic, toque o teclado; global porque cada redibujado reconecta la lectura

// Al cambiar de municipio, cabecera y cuerpos cambian por cruce con desenfoque
// (`cruce`, comun.js); la pirámide no, sus barras se transforman en `pintar`.
const CRUCE_MUNICIPIO = '.cabecera, .tarjeta:not(.destacada) > .cuerpo';

// Solo la última petición pinta: se aborta la anterior y, si aun así llegara,
// se comprueba que sigue siendo la vigente. Si falla, el selector vuelve al
// municipio que se ve y se ofrece reintentar.
let peticionFicha = null;
async function cargar(codmun) {
  peticionFicha?.abort();
  const peticion = new AbortController();
  peticionFicha = peticion;
  const contenido = document.querySelector('main');
  contenido.setAttribute('aria-busy', 'true');
  // El aviso de carga solo sale si tarda.
  const tardio = setTimeout(() => {
    if (peticion === peticionFicha) avisoCarga('estado-ficha', 'Cargando municipio…');
  }, 600);
  try {
    const f = await leerJSON(`datos/mun/${codmun}.json`, peticion.signal);
    if (peticion !== peticionFicha) return;
    const soltar = FICHA ? cruce(CRUCE_MUNICIPIO) : () => {};
    pintar(f);
    soltar();
    document.getElementById('sel-municipio').value = String(f.codmun);
    // La dirección visible es la estable, m/<código>.html (la misma que copia
    // «Copiar enlace»); al recargarla, el envoltorio redirige aquí.
    history.replaceState(null, '', rutaWeb(`m/${f.codmun}.html`) + location.hash);
    metadatosFicha(f);
    avisoCarga('estado-ficha');
  } catch (error) {
    if (peticion !== peticionFicha || error.name === 'AbortError') return;
    if (FICHA) document.getElementById('sel-municipio').value = String(FICHA.codmun);
    else document.getElementById('nombre').textContent = 'Ficha sin cargar';
    avisoCarga('estado-ficha', 'No se ha podido cargar el municipio.'
      + (FICHA ? ' Se mantiene la ficha anterior.' : ''), () => cargar(codmun));
  } finally {
    clearTimeout(tardio);
    if (peticion === peticionFicha) contenido.setAttribute('aria-busy', 'false');
  }
}

let animacion = null;
let temporizadorEje = null;   // el fundido del eje; se cancela si llega otra pestaña antes de que acabe

/** Leyenda de la pestaña, con los rótulos de la vista. La misma en la ficha y
 *  en la presentación. */
function leyendaPiramide(vista) {
  return `<span><i class="llave" style="background:${C.azulMedio}"></i>${esc(vista.rotH)}</span>`
       + `<span><i class="llave" style="background:${C.azulClaro}"></i>${esc(vista.rotM)}</span>`
       + `<span><i class="llave hueca"></i>${esc(vista.rotNegro)}</span>`;
}

/** Transición a la pestaña `i`: interpola el ancho del relleno azul y el largo
 *  del marco negro con un easeOut de grado `grado` (3 entre pestañas, 4 entre
 *  municipios, donde el recorrido puede ser de pocos píxeles). */
function mostrarVista(i, animar = true, dur = 720, grado = 3) {
  if (!PIRAMIDE) return;
  const P = PIRAMIDE;
  VISTA = i;
  const v = P.vistas[i];
  const n = v.relleno.H.length;

  document.querySelectorAll('.vista').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  document.getElementById('leyenda-piramide').innerHTML = leyendaPiramide(v);
  fuentesFicha(i);   // cada pestaña dibuja una tabla distinta del ISTAC
  // El eje cambia fundiéndose mientras las barras se mueven.
  const eje = document.querySelector('#g-piramide #eje-piramide');
  if (eje) {
    clearTimeout(temporizadorEje);
    const cambia = eje.dataset.eje !== String(v.eje);
    if (cambia && animar && animable()) {
      eje.style.opacity = '0';
      temporizadorEje = setTimeout(() => { eje.innerHTML = P.ejeSVG(v.eje); eje.style.opacity = '1'; }, 260);
    } else {
      if (cambia || !eje.dataset.eje) eje.innerHTML = P.ejeSVG(v.eje);
      eje.style.opacity = '1';
    }
    eje.dataset.eje = String(v.eje);
  }

  if (!P.nodos) {
    P.nodos = {}; P.actual = {};
    for (const [lado] of LADOS_PI) {
      P.nodos[lado] = { r: [], n: [] };
      for (let k = 0; k < n; k++) {
        P.nodos[lado].r.push(document.getElementById(`p${lado}${k}`));
        P.nodos[lado].n.push(document.getElementById(`n${lado}${k}`));
      }
      P.actual[lado] = { r: new Array(n).fill(0), n: new Array(n).fill(0) };
    }
  }
  if (!P.nodos.h.r[0]) return;
  for (const [lado] of LADOS_PI) P.nodos[lado].n.forEach((c) => c.removeAttribute('opacity'));

  const hacia = {}, desde = {};
  for (const [lado, , cl] of LADOS_PI) {
    hacia[lado] = {
      r: v.relleno[cl].map((x) => P.escala(x, v.eje)),
      n: v.negro[cl].map((x) => P.escala(x, v.eje)),
    };
    desde[lado] = { r: P.actual[lado].r.slice(), n: P.actual[lado].n.slice() };
  }

  const aplicar = (t) => {
    for (const [lado, sg] of LADOS_PI) {
      const x0 = P.centro + sg * P.hueco / 2;
      for (let k = 0; k < n; k++) {
        const aR = desde[lado].r[k] + (hacia[lado].r[k] - desde[lado].r[k]) * t;
        const aN = desde[lado].n[k] + (hacia[lado].n[k] - desde[lado].n[k]) * t;
        const rect = P.nodos[lado].r[k];
        rect.setAttribute('width', Math.max(0, aR).toFixed(2));
        rect.setAttribute('x', (sg < 0 ? x0 - aR : x0).toFixed(2));
        P.nodos[lado].n[k].setAttribute('d', P.glifo(x0, sg, aN, P.fy(k), P.relleno, P.trazo));
        P.actual[lado].r[k] = aR;
        P.actual[lado].n[k] = aN;
      }
    }
  };

  cancelAnimationFrame(animacion);
  // Sin animación con «reducir movimiento» o con la pestaña oculta (el navegador
  // congela requestAnimationFrame). Las marcas de la franja señalada se
  // recolocan cuando las barras terminan de moverse.
  const refrescar = () => { if (P.senalar && FILA != null) P.senalar(FILA); };
  if (!animar || !animable()) { aplicar(1); refrescar(); return; }

  pulsoDesenfoque(document.querySelector('#g-piramide svg'), dur);
  const t0 = performance.now();
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    aplicar(1 - Math.pow(1 - p, grado));

    if (p < 1) animacion = requestAnimationFrame(paso); else refrescar();
  };
  animacion = requestAnimationFrame(paso);
}

// Si la pestaña se oculta a mitad de una transición, al volver se fija el
// estado final en lugar de dejar las barras congeladas donde quedaron.
addEventListener('visibilitychange', () => {
  if (document.hidden && PIRAMIDE) mostrarVista(VISTA, false);
});
// Las cifras de la fila señalada se colocan midiendo el texto: si la tipografía
// llega después de medir, se recolocan con la definitiva.
document.fonts?.addEventListener('loadingdone', () => { if (PIRAMIDE?.senalar && FILA != null) PIRAMIDE.senalar(FILA); });

function pintar(f) {
  FICHA = f;
  const el = (id) => document.getElementById(id);
  document.title = `${f.nombre} · Fichas municipales · Canarias Convive`;

  el('migas').textContent = [f.isla, comarcaDe(f)].filter(Boolean).join(' · ');
  el('btn-comparar').href = rutaWeb(`comparar.html?m=${f.codmun}`);   // el comparador abre con este municipio
  el('nombre').textContent = f.nombre;
  el('anio').textContent = f.anio;
  el('habitantes').innerHTML = `<b>${nf(f.poblacion)}</b><span>habitantes</span>`;
  el('cifras').innerHTML = cifrasClave(f);

  const ev = f.evolucion;
  el('sub-cifras').textContent = `Datos a 1 de enero de ${f.anio}`;
  el('sub-evolucion').textContent = `Habitantes, ${ev.anios[0]}–${ev.anios[ev.anios.length - 1]}`;

  // --- mapas ---
  const wMapa = IMPRIMIENDO
    ? Math.floor((anchoHoja(12) - 2 * mm(4)) / 3)
    : Math.max(180, Math.floor(anchoDe('mapas', 1080) / (innerWidth > 940 ? 3 : 1)) - 20);
  const hMapa = IMPRIMIENDO ? mm(16) : Math.round(wMapa * 0.74);
  const niveles = nivelesMapas(f);
  const mapas = el('mapas');
  mapas.classList.toggle('dos', niveles.length === 2);
  mapas.innerHTML = niveles.map(([tit, filtro, r, lim]) => `
    <figure class="mapa">
      ${mapa(GEO, f.codmun, filtro, wMapa, hMapa, lim)}
      <figcaption class="mapa-pie">
        <b>${r.puesto}.º de ${r.total}</b>
        <span>${esc(tit)}</span>
        <p><b>${pct(r.peso, 2)}</b> <span>de su población</span></p>
      </figcaption>
    </figure>`).join('');

  // --- gráficos ---
  const wEv = IMPRIMIENDO ? anchoHoja(7) : anchoDe('g-evolucion');
  const wEx = IMPRIMIENDO ? anchoHoja(5) : anchoDe('g-extranjero', 320);
  const wPi = IMPRIMIENDO ? anchoHoja(7) : anchoDe('g-piramide');
  const wCo = IMPRIMIENDO ? anchoHoja(6) : anchoDe('g-componentes');

  el('g-evolucion').innerHTML =
    graficoEvolucion(f.evolucion, wEv, IMPRIMIENDO ? mm(27) : acotar(wEv * 0.42, 190, 260));
  const ext = f.extranjero;
  el('g-extranjero').innerHTML =
    graficoExtranjero(ext, wEx, IMPRIMIENDO ? mm(26) : acotar(wEx * 0.72, 200, 260))
    + (IMPRIMIENDO ? '' : tablaOculta('Población de origen extranjero por año, en porcentaje', ['Año', f.nombre, 'Canarias'],
      ext.anios.map((a, i) => [a, pct(ext.municipio[i]), pct(ext.canarias[i])])));
  // La leyenda lleva el valor de Canarias: es la referencia de la barra del municipio.
  el('leyenda-extranjero').innerHTML = leyendaExtranjero(f, 2);

  // La hoja imprime siempre la primera pestaña. Si ya hay una pirámide en
  // pantalla con la misma geometría no se borra: sus barras se mueven hasta la
  // forma del municipio nuevo (Canarias, que es la misma, no se mueve).
  if (IMPRIMIENDO) VISTA = 0;
  const nueva = construirPiramide(f.piramide, wPi, IMPRIMIENDO ? ALTO_PIRAMIDE_A4 : acotar(wPi * 0.70, 360, 470));
  const enPantalla = !!(PIRAMIDE && PIRAMIDE.nodos && !IMPRIMIENDO
    && PIRAMIDE.w === nueva.w && PIRAMIDE.h === nueva.h && document.querySelector('#g-piramide svg'));
  if (enPantalla) {
    Object.assign(PIRAMIDE, { vistas: nueva.vistas, edades: nueva.edades });
    mostrarVista(VISTA, true, 800, 4);
  } else {
    PIRAMIDE = nueva;
    el('g-piramide').innerHTML = PIRAMIDE.svg;
    mostrarVista(VISTA, false);
  }

  el('g-indices').innerHTML = bloqueIndices(f.indices, INDICES_FICHA);

  // En papel, el gráfico de componentes cede 3 mm a la nota de El Pinar y
  // Frontera para que la fila mida lo mismo que en los otros municipios.
  const comp = f.componentes, anom = comp.anomalias || [];
  el('g-componentes').innerHTML =
    graficoComponentes(comp, wCo, IMPRIMIENDO ? mm(anom.length ? 21 : 24) : acotar(wCo * 0.34, 190, 250))
    + (anom.length ? `<figcaption class="nota">${notaAnomalias(anom)}</figcaption>` : '')
    + (IMPRIMIENDO ? '' : tablaOculta('Crecimiento vegetativo y saldo migratorio por año, en personas', ['Año', 'Crecimiento vegetativo', 'Saldo migratorio'],
      comp.anios.map((a, i) => [a, nf(comp.vegetativo[i]), nf(comp.migratorio[i])]).filter(([a]) => a >= ANIO_INICIO_COMPONENTES)));

  const o = f.origen;
  el('g-origen').innerHTML = [
    ['Municipio', o.municipio], ['Canarias', o.canarias],
  ].map(([tit, vals]) => `
    <div class="anillo">
      <h3>${tit}</h3>
      ${IMPRIMIENDO ? anilloOrigen(vals, 30, 13) : anilloOrigen(vals)}
      <div class="reparto">${o.categorias.map((cat, i) => `
        <div><i style="background:${TONOS_ORIGEN[i]}"></i><span>${esc(cat)}</span><b>${nf(vals[i], 1)}${UNI}%</b></div>`).join('')}
      </div>
    </div>`).join('');

  if (!enPantalla) {
    conectarLecturaPiramide();
    if (!ENTRADA_HECHA && !IMPRIMIENDO) { ENTRADA_HECHA = true; programarEntrada(); }
  }
  conectarLecturaEvolucion();
  conectarIndices();
  fuentesFicha(VISTA);
}

const INDICES_FICHA = ['C10', 'C11', 'C17', 'C14'];

/** Leyenda de «Origen extranjero»: la línea de Canarias con su último valor. */
function leyendaExtranjero(f, grosor) {
  return `<span><i class="llave" style="background:${C.negro};height:${grosor}px;border-radius:0"></i>`
       + `Canarias <b>${pct(ultimoValido(f.extranjero.canarias))}</b></span>`;
}

/** Nota bajo el gráfico de componentes para los años apartados (El Pinar y Frontera, 2007). */
function notaAnomalias(anomalias) {
  return anomalias.map((a) =>
    `En ${a.anio} no se representa el saldo migratorio (${nf(a.valor)}): corresponde a un ${esc(a.motivo)}.`).join(' ');
}

/* ------------------------------------------------------- lecturas al vuelo -- */
/* Las cifras del grupo señalado van en el dibujo, junto a la punta de sus
   barras: la de la barra azul en azul y negrita, la del marco negro en negro,
   con halo blanco. En reposo no hay ninguna. Dos decimales: con uno, dos grupos
   contiguos podían leerse iguales. */

/** Dos decimales, y «< 0,01» cuando hay personas pero el redondeo daría 0,00. */
const pctFila = (v) => v > 0 && v < 0.005 ? '< 0,01' : nf(v, 2);

function etiquetasFila(P, actual, i, vista, fe) {
  const estrecho = P.w < 430;   // en un dibujo estrecho los dos valores van en dos líneas
  let out = '';
  for (const [lado, sg, cl] of LADOS_PI) {
    const x0 = P.centro + sg * P.hueco / 2;
    const yc = P.fy(i) + P.relleno / 2;
    const punta = Math.max(actual[lado].r[i], actual[lado].n[i]);
    const azul = `${pctFila(vista.relleno[cl][i])}${UNI}%`;
    const negro = `${pctFila(vista.negro[cl][i])}${UNI}%`;
    // Junto a la punta, por fuera; `colocarEtiquetas` la lleva a la base de la
    // barra si no cabe dentro del dibujo, con el ancho real del texto.
    const x = (x0 + sg * (punta + 9)).toFixed(1);
    const comun = `x="${x}" data-sg="${sg}" data-base="${(x0 + sg * 6).toFixed(1)}" text-anchor="${sg < 0 ? 'end' : 'start'}" font-size="${fe}" paint-order="stroke" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"`;
    out += estrecho
      ? `<text ${comun} y="${(yc - fe * 0.2).toFixed(1)}" font-weight="700" fill="${C.azul}">${azul}`
        + `<tspan x="${x}" dy="${(fe * 1.1).toFixed(1)}" font-weight="400" fill="${C.negro}">${negro}</tspan></text>`
      : `<text ${comun} y="${(yc + fe * 0.36).toFixed(1)}" font-weight="700" fill="${C.azul}">${azul}`
        + `<tspan font-weight="400" fill="${C.negro}"> · ${negro}</tspan></text>`;
  }
  return out;
}

/** Los cuatro marcadores de la fila `i`: círculo en la punta de cada barra y
 *  cuadro hueco en la punta de cada marco negro. */
function marcadoresFila(P, actual, i) {
  let out = '';
  for (const [lado, sg] of LADOS_PI) {
    const x0 = P.centro + sg * P.hueco / 2, y = P.fy(i) + P.relleno / 2;
    const xr = x0 + sg * actual[lado].r[i], xn = x0 + sg * actual[lado].n[i];
    out += `<circle cx="${xr.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${C.azul}" stroke="#FFFFFF" stroke-width="1.2"/>`
         + `<rect x="${(xn - 3.1).toFixed(1)}" y="${(y - 3.1).toFixed(1)}" width="6.2" height="6.2" fill="#FFFFFF" stroke="${C.negro}" stroke-width="1.3"/>`;
  }
  return out;
}

/** Tras escribir las etiquetas en el SVG: la que no cabe entre la punta de la
 *  barra y el borde del dibujo pasa a la base de la barra. */
function colocarEtiquetas(grupo, w) {
  for (const t of grupo.querySelectorAll('text[data-sg]')) {
    const sg = +t.dataset.sg, x = +t.getAttribute('x');
    const largo = t.getComputedTextLength();
    const cabe = sg < 0 ? x - largo >= 2 : x + largo <= w - 2;
    if (cabe) continue;
    t.setAttribute('x', t.dataset.base);
    for (const ts of t.querySelectorAll('tspan[x]')) ts.setAttribute('x', t.dataset.base);
  }
}

/** La misma lectura en palabras, para el lector de pantalla (región viva). */
function textoLectura(P, vista, i) {
  if (i == null) return '';
  const v = (S, cl) => `${pctFila(S[cl][i])}${UNI}%`;
  return `${P.edades[i]} años. ${vista.rotH}: ${v(vista.relleno, 'H')}; ${vista.rotM}: ${v(vista.relleno, 'M')}.`
       + ` ${vista.rotNegro}: hombres ${v(vista.negro, 'H')}, mujeres ${v(vista.negro, 'M')}.`;
}

function conectarLecturaPiramide() {
  const fig = document.getElementById('g-piramide');
  const svg = fig && fig.querySelector('svg');
  if (!svg || !PIRAMIDE) return;
  const activa = svg.querySelector('#franja-activa');
  const marcas = svg.querySelector('#marcas-activas');
  if (!activa || !marcas) return;

  // Marcadores en la punta de cada barra (círculo) y de cada marco negro
  // (cuadro), más las cifras de la fila; el nombre de cada serie lo da la leyenda.
  const pintarMarcas = (i) => {
    const P = PIRAMIDE;
    marcas.innerHTML = marcadoresFila(P, P.actual, i) + etiquetasFila(P, P.actual, i, P.vistas[VISTA], P.fe + 1.5);
    colocarEtiquetas(marcas, P.w);
  };

  const senalar = (i) => {
    FILA = i;
    if (i == null) {
      activa.setAttribute('opacity', '0');
      marcas.setAttribute('opacity', '0');
    } else {
      activa.setAttribute('y', PIRAMIDE.fyFranja(i).toFixed(1));
      activa.setAttribute('opacity', '.07');
      pintarMarcas(i);
      marcas.setAttribute('opacity', '1');
    }
    const viva = document.getElementById('lectura-piramide');
    if (viva) viva.textContent = textoLectura(PIRAMIDE, PIRAMIDE.vistas[VISTA], i);
  };
  PIRAMIDE.senalar = senalar;

  svg.querySelectorAll('.franja').forEach((fr) => {
    const i = +fr.dataset.i;
    fr.addEventListener('pointerenter', () => { if (!FIJADA) senalar(i); });
    // Se fija con el clic o el toque terminado, no al apoyar el dedo: así el
    // desplazamiento de la página que empieza sobre la pirámide no fija nada.
    fr.addEventListener('click', () => {
      FIJADA = !(FIJADA && FILA === i);
      senalar(FIJADA ? i : null);
    });
    // Con ratón o lápiz, apoyar no selecciona texto.
    fr.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') e.preventDefault(); });
  });

  svg.addEventListener('pointerleave', () => { if (!FIJADA) senalar(null); });

  fig.setAttribute('tabindex', '0');
  fig.setAttribute('aria-label', 'Estructura de la población. Flechas arriba y abajo para recorrer las edades.');
  fig.setAttribute('aria-describedby', 'lectura-piramide');
  fig.onkeydown = (e) => {
    const n = PIRAMIDE.edades.length;
    let i = FILA;
    switch (e.key) {
      case 'ArrowUp':   i = i == null ? 0 : Math.min(n - 1, i + 1); break;
      case 'ArrowDown': i = i == null ? n - 1 : Math.max(0, i - 1); break;
      case 'Home':      i = 0; break;
      case 'End':       i = n - 1; break;
      case 'Escape':    i = null; FIJADA = false; break;
      default: return;
    }
    e.preventDefault();
    if (i != null) FIJADA = true;
    senalar(i);
  };

  senalar(FILA);
}

function conectarLecturaEvolucion() {
  const svg = document.querySelector('#g-evolucion svg');
  const salida = document.getElementById('lectura-evolucion');
  if (!svg || !salida || !EVOLUCION) return;
  const { X, Y, px, py } = EVOLUCION;
  const guia = svg.querySelector('#guia-evolucion');
  const linea = guia.querySelector('line'), punto = guia.querySelector('circle');
  const cazador = svg.querySelector('#cazador-evolucion');

  let seleccion = null;
  const mostrar = (i) => {
    seleccion = i;
    const x = px(X[i]), y = py(Y[i]);
    linea.setAttribute('x1', x.toFixed(1)); linea.setAttribute('x2', x.toFixed(1));
    punto.setAttribute('cx', x.toFixed(1)); punto.setAttribute('cy', y.toFixed(1));
    guia.setAttribute('opacity', '1');
    salida.innerHTML = `<b>${X[i]}</b> · ${nf(Y[i])} habitantes`;
  };
  const situar = (ev) => {
    const caja = svg.getBoundingClientRect();
    const escalaX = svg.viewBox.baseVal.width / caja.width;
    const xSvg = (ev.clientX - caja.left) * escalaX;
    let mejor = 0, dist = Infinity;
    X.forEach((a, i) => { const d = Math.abs(px(a) - xSvg); if (d < dist) { dist = d; mejor = i; } });
    if (mejor !== seleccion) mostrar(mejor);   // la región viva solo se reescribe al cambiar de año
  };
  const figura = document.getElementById('g-evolucion');
  figura.tabIndex = 0;
  figura.setAttribute('aria-label', 'Evolución de la población. Flechas izquierda y derecha para recorrer los años.');
  figura.setAttribute('aria-describedby', 'lectura-evolucion');
  figura.onkeydown = (e) => {
    let i = seleccion;
    if (e.key === 'ArrowRight') i = i == null ? 0 : Math.min(X.length - 1, i + 1);
    else if (e.key === 'ArrowLeft') i = i == null ? X.length - 1 : Math.max(0, i - 1);
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = X.length - 1;
    else if (e.key === 'Escape') { seleccion = null; guia.setAttribute('opacity', '0'); salida.textContent = ''; e.preventDefault(); return; }
    else return;
    e.preventDefault(); mostrar(i);
  };
  cazador.addEventListener('pointermove', situar);
  cazador.addEventListener('pointerdown', situar);
  // Al levantar el dedo también llega pointerleave: con el dedo, la lectura se queda.
  cazador.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    guia.setAttribute('opacity', '0');
    salida.textContent = '';
  });
}

/* ------------------------------------------------------------- compartir --- */
/** Copia el enlace estable m/<código>.html, cuyas etiquetas og: ya vienen en el
 *  HTML servido (los rastreadores de WhatsApp y X no ejecutan JavaScript). */
function conectarCompartir() {
  const b = document.getElementById('btn-compartir');
  const rotulo = b.querySelector('span');
  const original = rotulo.textContent;
  b.addEventListener('click', async () => {
    if (!FICHA) return;
    const url = new URL(`m/${FICHA.codmun}.html`, URL_PUBLICA_SITIO).href;
    try {
      await navigator.clipboard.writeText(url);
      rotulo.textContent = 'Enlace copiado';
      b.classList.add('confirmado');   // en móvil el rótulo va oculto: se enseña un momento
      setTimeout(() => { rotulo.textContent = original; b.classList.remove('confirmado'); }, 2200);
    } catch {
      window.prompt('Copia el enlace para compartir:', url);   // sin permiso de portapapeles
    }
  });
}

/* ----------------------------------------------------------------- entrada -- */
/* Al abrir la ficha, las barras azules crecen desde el canal central de abajo
   arriba (8 ms de desfase por grupo, 260 ms cada una) y los marcos negros
   aparecen por fundido. Una sola vez por carga; ni en papel, ni con «reducir
   movimiento», ni con la pestaña oculta. */
let ENTRADA_HECHA = false;

/** La entrada espera a que la pestaña se mire. */
function programarEntrada() {
  const entrar = () => { animarEntrada(); entradaContenido(); };
  if (!document.hidden) { entrar(); return; }
  const alVolver = () => {
    if (document.hidden) return;
    removeEventListener('visibilitychange', alVolver);
    entrar();
  };
  addEventListener('visibilitychange', alVolver);
}

/** Cabecera y tarjetas se enfocan al llegar los datos, de arriba abajo. */
function entradaContenido() {
  if (!animable()) return;
  document.querySelectorAll('.cabecera, .tarjeta > .cuerpo').forEach((el, i) =>
    el.animate([{ opacity: 0, filter: `blur(${DESENFOQUE}px)` }, { opacity: 1, filter: 'blur(0px)' }],
      { duration: 640, delay: 40 * i, easing: SUAVE, fill: 'backwards' }));
}

/** Cambio de pestaña: las barras se transforman y la leyenda se cruza con desenfoque. */
function cambiarVista(i) {
  if (!PIRAMIDE || i === VISTA) return;
  const soltar = cruce('#leyenda-piramide');
  mostrarVista(i);
  soltar();
}

function animarEntrada() {
  const P = PIRAMIDE;
  if (!P || !P.nodos || IMPRIMIENDO || reducido() || document.hidden) return;
  const v = P.vistas[VISTA], n = v.relleno.H.length;
  const DESFASE = 8, BARRA = 260, TOTAL = DESFASE * (n - 1) + BARRA;
  const hacia = {};
  for (const [lado, , cl] of LADOS_PI) {
    hacia[lado] = {
      r: v.relleno[cl].map((x) => P.escala(x, v.eje)),
      n: v.negro[cl].map((x) => P.escala(x, v.eje)),
    };
  }
  const t0 = performance.now();
  const paso = (t) => {
    const ms = t - t0;
    const opNegro = acotar((ms - 150) / 200, 0, 1).toFixed(2);
    for (const [lado, sg] of LADOS_PI) {
      const x0 = P.centro + sg * P.hueco / 2;
      for (let k = 0; k < n; k++) {
        const pr = acotar((ms - DESFASE * k) / BARRA, 0, 1);
        const aR = hacia[lado].r[k] * (1 - Math.pow(1 - pr, 3));
        const rect = P.nodos[lado].r[k];
        rect.setAttribute('width', aR.toFixed(2));
        rect.setAttribute('x', (sg < 0 ? x0 - aR : x0).toFixed(2));
        P.actual[lado].r[k] = aR;
        const cam = P.nodos[lado].n[k];
        cam.setAttribute('d', P.glifo(x0, sg, hacia[lado].n[k], P.fy(k), P.relleno, P.trazo));
        cam.setAttribute('opacity', opNegro);
        P.actual[lado].n[k] = hacia[lado].n[k];
      }
    }
    if (ms < TOTAL) { animacion = requestAnimationFrame(paso); return; }
    for (const [lado] of LADOS_PI) P.nodos[lado].n.forEach((c) => c.removeAttribute('opacity'));
    if (P.senalar && FILA != null) P.senalar(FILA);
  };
  cancelAnimationFrame(animacion);
  animacion = requestAnimationFrame(paso);
}

/* ------------------------------------------------ índices que se responden -- */
/** Señalar un ámbito lo resalta en los cuatro índices y atenúa los otros dos.
 *  Con ratón, al pasar; con el dedo, un toque fija y otro suelta. */
function conectarIndices() {
  const cont = document.getElementById('g-indices');
  if (!cont) return;
  cont.dataset.fijo = '';
  if (cont.dataset.conectado) return;
  cont.dataset.conectado = '1';
  const marcar = (amb) => cont.querySelectorAll('.peldano').forEach((c) => {
    c.classList.toggle('foco', !!amb && c.dataset.ambito === amb);
    c.classList.toggle('tenue', !!amb && c.dataset.ambito !== amb);
  });
  cont.addEventListener('pointerover', (e) => {
    const c = e.target.closest('.peldano');
    if (c && e.pointerType !== 'touch' && !cont.dataset.fijo) marcar(c.dataset.ambito);
  });
  cont.addEventListener('pointerleave', () => { if (!cont.dataset.fijo) marcar(null); });
  cont.addEventListener('click', (e) => {
    const c = e.target.closest('.peldano');
    if (!c) return;
    cont.dataset.fijo = cont.dataset.fijo === c.dataset.ambito ? '' : c.dataset.ambito;
    marcar(cont.dataset.fijo || null);
  });
}

/* ------------------------------------------------------------ presentación -- */
/* Seis diapositivas de 1920×1080 a pantalla completa con los mismos datos de la
   ficha. ← → cambian de diapositiva, ↑ ↓ recorren los grupos de edad en la
   pirámide, Esc sale. Las diapositivas 3 y 4 comparten la pirámide, que se
   transforma entre ellas. */
const PRES = { abierta: false, paso: 1, fila: null, vista: 0, P: null };
const PRES_CAPA = [0, 1, 2, 2, 3, 4];   // diapositiva → capa

function presLeyenda() {
  document.getElementById('pres-leyenda').innerHTML = leyendaPiramide(PRES.P.vistas[PRES.vista]);
}

/** Franja iluminada, marcadores y cifras del grupo señalado, como en la ficha. */
function presSenalar() {
  const P = PRES.P, i = PRES.fila, g = PRES.marcas;
  if (i == null) { g.innerHTML = ''; return; }
  g.innerHTML = `<rect x="12" y="${P.fyFranja(i).toFixed(1)}" width="${(P.w - 24).toFixed(1)}" height="${P.altoFila.toFixed(1)}" fill="${C.azul}" opacity=".07"/>`
    + marcadoresFila(P, PRES.actual, i) + etiquetasFila(P, PRES.actual, i, P.vistas[PRES.vista], P.fe + 4);
  colocarEtiquetas(g, P.w);
}

/** La pirámide de la presentación pasa a la vista pedida; animada, se transforma. */
function presMostrar(vista, animar) {
  const P = PRES.P, v = P.vistas[vista], n = P.edades.length;
  PRES.vista = vista;
  const hacia = {}, desde = {};
  for (const [lado, , cl] of LADOS_PI) {
    hacia[lado] = { r: v.relleno[cl].map((x) => P.escala(x, v.eje)), n: v.negro[cl].map((x) => P.escala(x, v.eje)) };
    desde[lado] = { r: PRES.actual[lado].r.slice(), n: PRES.actual[lado].n.slice() };
  }
  const aplicar = (t) => {
    for (const [lado, sg] of LADOS_PI) {
      const x0 = P.centro + sg * P.hueco / 2;
      for (let k = 0; k < n; k++) {
        const aR = desde[lado].r[k] + (hacia[lado].r[k] - desde[lado].r[k]) * t;
        const aN = desde[lado].n[k] + (hacia[lado].n[k] - desde[lado].n[k]) * t;
        const rect = PRES.nodos[lado].r[k];
        rect.setAttribute('width', Math.max(0, aR).toFixed(2));
        rect.setAttribute('x', (sg < 0 ? x0 - aR : x0).toFixed(2));
        PRES.nodos[lado].n[k].setAttribute('d', P.glifo(x0, sg, aN, P.fy(k), P.relleno, P.trazo));
        PRES.actual[lado].r[k] = aR; PRES.actual[lado].n[k] = aN;
      }
    }
  };
  document.getElementById('pres-titulo-pir').textContent = 'Estructura de la población · ' + v.etiqueta;
  document.getElementById('pres-fuente-pir').textContent = textoFuente(v.clave === 'municipio' ? 'piramide_nacimiento' : 'piramide');
  cancelAnimationFrame(PRES.animacion);
  clearTimeout(PRES.temporizadorEje);
  if (!animar || !animable()) { PRES.eje.innerHTML = P.ejeSVG(v.eje); PRES.eje.style.opacity = '1'; aplicar(1); presLeyenda(); presSenalar(); return; }
  const soltar = cruce('#pres-leyenda');
  presLeyenda();
  soltar();
  const dur = 720;
  pulsoDesenfoque(document.querySelector('#pres-piramide svg'), dur, 1.6);
  PRES.eje.style.opacity = '0';
  PRES.temporizadorEje = setTimeout(() => { PRES.eje.innerHTML = P.ejeSVG(v.eje); PRES.eje.style.opacity = '1'; }, 260);
  const t0 = performance.now();
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    aplicar(1 - Math.pow(1 - p, 3));
    if (p < 1) PRES.animacion = requestAnimationFrame(paso); else presSenalar();
  };
  PRES.animacion = requestAnimationFrame(paso);
}

function presIr(paso) {
  paso = acotar(paso, 1, 6);
  const capaAntes = PRES_CAPA[PRES.paso - 1], capa = PRES_CAPA[paso - 1];
  PRES.paso = paso;
  document.querySelectorAll('#presentacion .pres-diapo').forEach((d, k) => d.classList.toggle('activa', k === capa));
  document.getElementById('pres-contador').textContent = `${paso} / 6`;
  if (capa === 2) presMostrar(paso === 3 ? 0 : 1, capaAntes === 2);
}

function cerrarPresentacion() {
  if (!PRES.abierta) return;
  PRES.abierta = false;
  cancelAnimationFrame(PRES.animacion);
  document.removeEventListener('keydown', PRES.teclas);
  removeEventListener('resize', PRES.escalar);
  const cont = document.getElementById('presentacion');
  if (cont) cont.remove();
  document.body.classList.remove('presentando');
  PRES.fondo?.forEach(([e, inerte, oculto]) => {
    e.inert = inerte;
    if (oculto == null) e.removeAttribute('aria-hidden'); else e.setAttribute('aria-hidden', oculto);
  });
  if (PRES.focoAnterior?.isConnected) PRES.focoAnterior.focus();
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

function abrirPresentacion() {
  if (!FICHA || PRES.abierta) return;
  // Safari no da el foco a un botón al pulsarlo con el ratón: al cerrar, el
  // foco vuelve al botón de presentar si no había nada enfocado.
  const activo = document.activeElement;
  PRES.focoAnterior = activo && activo !== document.body ? activo : document.getElementById('btn-presentar');
  const f = FICHA, c = f.cifras, ev = f.evolucion, o = f.origen;
  const signo = c.tvma >= 0 ? '+' : '−';
  const P = construirPiramide(f.piramide, 640, 400, 0);
  const anillo = (tit, vals) => `<div class="pres-anillo"><h3>${tit}</h3>${anilloOrigen(vals, 74, 30).replace(/width="148" height="148"/, 'width="300" height="300"')}
    <div class="pres-reparto">${o.categorias.map((cat, k) => `<div><i style="background:${TONOS_ORIGEN[k]}"></i><span>${esc(cat)}</span><b>${nf(vals[k], 1)}${UNI}%</b></div>`).join('')}</div></div>`;
  const capas = [
    `<div class="pres-fila"><div><p class="pres-kicker">${esc([f.isla, comarcaDe(f)].filter(Boolean).join(' · '))}</p><h1>${esc(f.nombre)}</h1>
      <p class="pres-hab"><b>${nf(f.poblacion)}</b><span>habitantes</span></p></div><div class="pres-anio">${f.anio}</div></div>
     <div class="pres-cifras">
      <div><b>${signo}${nf(Math.abs(c.tvma), 1)}<span>${UNI}%</span></b><i>Variación media anual</i><em>Serie ${ev.anio_base}–${ev.anio_fin}</em></div>
      <div><b>${nf(c.edad_media, 1)}<span>${UNI}años</span></b><i>Edad media</i><em></em></div>
      <div><b>${nf(c.pct_mujeres, 1)}<span>${UNI}%</span></b><i>Mujeres</i><em>${nf(c.mujeres)} personas</em></div>
      <div><b>${nf(c.pct_hombres, 1)}<span>${UNI}%</span></b><i>Hombres</i><em>${nf(c.hombres)} personas</em></div></div>
     <img class="pres-logo" src="${rutaWeb('img/logo-canariasconvive.png')}" alt="Canarias Convive">`,
    `<h2>Evolución de la población · ${ev.anios[0]}–${ev.anios[ev.anios.length - 1]}</h2>
     <div class="pres-centro">${graficoEvolucion(ev, 800, 320, '-pres').replace('width="100%"', 'width="1600" height="640"')}</div>
     <p class="pres-fuente">${esc(textoFuente('evolucion'))}</p>`,
    `<h2 id="pres-titulo-pir">Estructura de la población · Municipio y Canarias</h2>
     <div class="pres-pir"><figure id="pres-piramide">${P.svg.replace('width="100%"', 'width="1200" height="750"')}</figure>
     <div class="leyenda" id="pres-leyenda"></div><p class="pres-fuente" id="pres-fuente-pir">${esc(textoFuente('piramide'))}</p></div>`,
    `<h2>Información geodemográfica</h2><p class="pres-sub">Los tres ámbitos, ordenados de menor a mayor valor</p>
     <div class="pres-indices">${bloqueIndices(f.indices, INDICES_FICHA)}</div>
     <p class="pres-fuente">${esc(textoFuente('indices'))}</p>`,
    `<div class="pres-dos"><div><h2>Lugar de nacimiento</h2><div class="pres-anillos">${anillo('Municipio', o.municipio)}${anillo('Canarias', o.canarias)}</div>
     <p class="pres-fuente">${esc(textoFuente('nacimiento'))}</p></div>
     <div><h2>Origen extranjero</h2>${graficoExtranjero(f.extranjero, 560, 300).replace('width="100%"', 'width="840" height="450"')}
     <div class="leyenda" style="justify-content:flex-start">${leyendaExtranjero(f, 3)}</div>
     <p class="pres-fuente">${esc(textoFuente('extranjero'))}</p></div></div>`,
  ];
  const cont = document.createElement('div');
  cont.id = 'presentacion';
  cont.setAttribute('aria-modal', 'true');
  cont.setAttribute('role', 'dialog'); cont.setAttribute('aria-label', 'Presentación de la ficha'); cont.tabIndex = -1;
  cont.innerHTML = `<div class="pres-escenario">${capas.map((h, k) => `<section class="pres-diapo${k === 0 ? ' activa' : ''}">${h}</section>`).join('')}</div>
    <button class="pres-zona izq" type="button" aria-label="Anterior"></button><button class="pres-zona der" type="button" aria-label="Siguiente"></button>
    <button class="pres-cerrar" type="button" aria-label="Salir de la presentación">${icono('cerrar', 20)}</button>
    <span class="pres-contador" id="pres-contador">1 / 6</span>`;
  // inert deja el fondo fuera del teclado; aria-hidden lo deja fuera del lector de pantalla donde inert no existe.
  PRES.fondo = [...document.body.children].map((e) => [e, e.inert, e.getAttribute('aria-hidden')]);
  PRES.fondo.forEach(([e]) => { e.inert = true; e.setAttribute('aria-hidden', 'true'); });
  document.body.appendChild(cont);
  document.body.classList.add('presentando');

  // La pirámide: nodos, estado y el grupo de marcas.
  const svg = cont.querySelector('#pres-piramide svg');
  const rects = [...svg.querySelectorAll(`rect[fill="${C.azulMedio}"], rect[fill="${C.azulClaro}"]`)];
  const paths = [...svg.querySelectorAll(`path[stroke="${C.negro}"]`)];
  PRES.P = P; PRES.paso = 1; PRES.fila = null; PRES.vista = 0; PRES.abierta = true;
  PRES.nodos = { h: { r: [], n: [] }, m: { r: [], n: [] } };
  PRES.actual = { h: { r: [], n: [] }, m: { r: [], n: [] } };
  const v0 = P.vistas[0];
  for (let k = 0; k < P.edades.length; k++) {
    for (const [lado, , cl] of LADOS_PI) {
      const j = k * 2 + (lado === 'h' ? 0 : 1);
      PRES.nodos[lado].r.push(rects[j]); PRES.nodos[lado].n.push(paths[j]);
      PRES.actual[lado].r.push(P.escala(v0.relleno[cl][k], v0.eje));
      PRES.actual[lado].n.push(P.escala(v0.negro[cl][k], v0.eje));
    }
  }
  PRES.eje = svg.querySelector('g');
  PRES.eje.style.transition = 'opacity .26s ease';
  PRES.marcas = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(PRES.marcas);
  presLeyenda();

  // Escala del escenario, teclado, zonas y cierre.
  const escenario = cont.querySelector('.pres-escenario');
  PRES.escalar = () => {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    escenario.style.transform = `translate(-50%, -50%) scale(${k.toFixed(4)})`;
  };
  PRES.escalar();
  addEventListener('resize', PRES.escalar);
  PRES.teclas = (e) => {
    const n = P.edades.length, enPiramide = PRES_CAPA[PRES.paso - 1] === 2;
    if (e.key === 'Tab') {
      const botones = [...cont.querySelectorAll('button')];
      const i = botones.indexOf(document.activeElement);
      // Recién abierta el foco está en el diálogo: Tab va al primer botón y Mayús+Tab al último.
      const j = i < 0 ? (e.shiftKey ? botones.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length;
      botones[j].focus();
      e.preventDefault(); return;
    }
    if (e.key === ' ' && document.activeElement.tagName === 'BUTTON') return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': presIr(PRES.paso + 1); break;
      case 'ArrowLeft': case 'PageUp': presIr(PRES.paso - 1); break;
      case 'ArrowUp': if (!enPiramide) return; PRES.fila = PRES.fila == null ? 0 : Math.min(n - 1, PRES.fila + 1); presSenalar(); break;
      case 'ArrowDown': if (!enPiramide) return; PRES.fila = PRES.fila == null ? n - 1 : Math.max(0, PRES.fila - 1); presSenalar(); break;
      case 'Home': if (!enPiramide) return; PRES.fila = 0; presSenalar(); break;
      case 'End': if (!enPiramide) return; PRES.fila = n - 1; presSenalar(); break;
      case 'Escape': cerrarPresentacion(); break;
      default: return;
    }
    e.preventDefault();
  };
  document.addEventListener('keydown', PRES.teclas);
  cont.querySelector('.pres-zona.izq').addEventListener('click', () => presIr(PRES.paso - 1));
  cont.querySelector('.pres-zona.der').addEventListener('click', () => presIr(PRES.paso + 1));
  cont.querySelector('.pres-cerrar').addEventListener('click', cerrarPresentacion);
  cont.focus();
  // Pantalla completa si el navegador (y el iframe que aloje la ficha) lo permiten.
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}
addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && PRES.abierta) cerrarPresentacion(); });

/* ------------------------------------------------------------------ inicio -- */
/** Coloca el icono (iconos.js) en cada rótulo y botón con `data-ico`. */
function montarIconos() {
  document.querySelectorAll('.rotulo[data-ico]').forEach((r) =>
    r.insertAdjacentHTML('afterbegin', icono(r.dataset.ico, 26)));
  document.querySelectorAll('.btn[data-ico]').forEach((b) =>
    b.insertAdjacentHTML('afterbegin', icono(b.dataset.ico, 15)));
}

/* beforeprint llega antes de maquetar la hoja (Ctrl+P y el botón): se redibuja
   a medida de papel, con la primera pestaña y sin franja señalada, y al
   terminar se devuelven la pestaña y la franja que había. */
let VISTA_ANTES = 0, FILA_ANTES = null;
addEventListener('beforeprint', () => {
  if (!FICHA) return;
  VISTA_ANTES = VISTA;
  FILA_ANTES = FILA;
  FILA = null;
  IMPRIMIENDO = true;
  pintar(FICHA);
});
addEventListener('afterprint', () => {
  if (!FICHA) return;
  IMPRIMIENDO = false;
  VISTA = VISTA_ANTES;
  FILA = FILA_ANTES;
  pintar(FICHA);
});

let temporizador = null, anchoPrevio = window.innerWidth;
addEventListener('resize', () => {
  if (!FICHA || innerWidth === anchoPrevio) return;
  anchoPrevio = innerWidth;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => pintar(FICHA), 180);
});

async function iniciar() {
  montarIconos();
  document.getElementById('btn-pdf').addEventListener('click', () => window.print());
  enlacesAbsolutos();
  // El pie de la hoja impresa lleva la dirección de la guía, para teclearla desde el papel.
  const pie = document.querySelector('.pie-fuentes-papel a');
  if (pie) {
    pie.href = rutaWeb('guia.html');
    pie.textContent = new URL('guia.html', URL_PUBLICA_SITIO).href.replace(/^https?:\/\//, '');
  }
  document.getElementById('btn-presentar').addEventListener('click', abrirPresentacion);
  conectarCompartir();

  // El índice y la geometría pesan más que una ficha: si tardan, se avisa.
  const tardio = setTimeout(() => avisoCarga('estado-ficha', 'Cargando los datos…'), 600);
  try {
    [INDICE, GEO] = await Promise.all([
      leerJSON('datos/indice.json'),
      leerJSON('datos/geo/municipios.json'),
    ]);
  } finally {
    clearTimeout(tardio);
  }
  avisoCarga('estado-ficha');

  const sel = document.getElementById('sel-municipio');
  sel.innerHTML = Object.entries(INDICE.islas).map(([isla, muns]) =>
    `<optgroup label="${esc(isla)}">` + muns.map((n) => {
      const m = INDICE.municipios.find((x) => x.nombre === n);
      return m ? `<option value="${m.codmun}">${esc(n)}</option>` : '';
    }).join('') + '</optgroup>').join('');

  const pedido = new URLSearchParams(location.search).get('municipio')
    || (location.pathname.match(/\/m\/(\d{5})\.html$/) || [])[1];
  const inicial = INDICE.municipios.some((m) => String(m.codmun) === pedido) ? pedido : '38038';
  sel.value = inicial;
  sel.addEventListener('change', () => cargar(sel.value));

  document.querySelectorAll('.vista').forEach((b, i) =>
    b.addEventListener('click', () => cambiarVista(i)));

  await cargar(inicial);
}

if (document.getElementById('sel-municipio')) {
  iniciar().catch((e) => {
    document.getElementById('nombre').textContent = 'Ficha sin cargar';
    avisoCarga('estado-ficha', 'No se han podido cargar los datos.', () => location.reload());
    console.error(e);
  });
}

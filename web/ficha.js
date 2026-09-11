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
/* El símbolo va separado de la cifra, como manda la RAE, y con espacio duro
   para que nunca se quede solo al final de una línea. Vale para el %, para
   "años" y para cualquier unidad: la ficha lo escribía de tres maneras. */
const UNI = '\u00a0';
const pct = (v, d = 1) => v == null ? '—' : nf(v, d) + UNI + '%';
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

/* ---------------------------------------------------------- impresión ----- */
/* Al imprimir, los gráficos se vuelven a dibujar a la medida de la hoja. Un SVG
   pensado para 640 px de pantalla y encogido por CSS hasta 60 mm deja las
   etiquetas en tres puntos: hay que redibujarlo, no escalarlo.

   La caja útil de la A4 vertical con los márgenes de @page es de 190 mm, y la
   retícula sigue siendo de doce columnas con 2,4 mm de hueco. */
const MM = 96 / 25.4;                 // píxeles CSS por milímetro
const HOJA = 190, HUECO = 2, PAD = 3;
let IMPRIMIENDO = false;
/** El dossier dibuja las 88 fichas ya a medida de hoja. */
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
function graficoEvolucion(ev, w, h, sufijo = '') {
  /* En la hoja los márgenes y el cuerpo bajan: los mismos 52 px de margen
     izquierdo que en pantalla se comen medio gráfico de 30 mm y las etiquetas
     del eje acaban una encima de otra. */
  const P = IMPRIMIENDO;
  const m = P ? { t: 20, r: 8, b: 13, l: 36 } : { t: w < 430 ? 46 : 30, r: 14, b: 26, l: 52 };
  const fe = P ? 6.5 : 10;
  const X = ev.anios, Y = ev.valores;
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

  // Cápsula con la variación acumulada. En pantallas estrechas no cabe al lado
  // del texto, así que el texto baja a una segunda línea en vez de salirse.
  const v = ev.variacion_acumulada;
  const leyendaVar = `Variación acumulada entre ${ev.anio_base} y ${ev.anio_fin}`;
  const textoVar = `${v >= 0 ? '\u25B2' : '\u25BC'} ${nf(Math.abs(v), 1)}${UNI}%`;
  const alto = P ? 13 : 20, fc = P ? 8 : 11, fl = P ? 7 : 10.5;
  const anchoCapsula = Math.max(P ? 40 : 58, textoVar.length * (P ? 4.7 : 6.4) + (P ? 10 : 16));
  const cabeAlLado = w - m.r - (m.l + anchoCapsula + 16) > leyendaVar.length * (P ? 3.8 : 5.6);
  const rotulo = v == null ? '' : `
    <g transform="translate(${m.l + 8}, ${m.t - (P ? 8 : 12)})">
      <rect x="0" y="${-alto / 2}" width="${anchoCapsula.toFixed(0)}" height="${alto}" rx="${alto / 2}" fill="${C.azul}"/>
      <text x="${(anchoCapsula / 2).toFixed(0)}" y="${(fc * .36).toFixed(1)}" text-anchor="middle" font-size="${fc}" font-weight="700" fill="#fff">${textoVar}</text>
      <text x="${cabeAlLado ? (anchoCapsula + 9).toFixed(0) : (2 - m.l - 8).toFixed(0)}" y="${cabeAlLado ? (fl * .36).toFixed(1) : (alto + fl)}" font-size="${cabeAlLado ? fl : fl - .5}" fill="${C.negro}">${leyendaVar}</text>
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
/** Barras para el municipio, con la última destacada y su porcentaje encima en
 *  negro, y una línea para Canarias. Es como lo tenía Pedro. */
function graficoExtranjero(ext, w, h) {
  // El margen derecho deja sitio a la etiqueta del último dato, que va centrada
  // sobre la última barra y se saldría del lienzo.
  const P = IMPRIMIENDO;
  const m = P ? { t: 21, r: 24, b: 13, l: 26 } : { t: 30, r: 34, b: 26, l: 42 };
  const fe = P ? 6.5 : 10;
  const A = ext.anios, M = ext.municipio, R = ext.canarias;
  const vivos = A.map((a, i) => [a, M[i]]).filter(([, v]) => v != null && isFinite(v));
  // Primero el paso a partir del máximo, y el tope como el múltiplo justo por
  // encima. Al revés, el eje quedaba holgado: un municipio con 23,5 % acababa
  // con la escala en 40 y las barras a media altura.
  const maximo = Math.max(...M.concat(R).filter((v) => v != null));
  const paso = pasoRedondo(maximo, 5);
  const tope = Math.ceil(maximo / paso) * paso;

  const ancho = (w - m.l - m.r) / vivos.length;
  const bw = Math.min(ancho * 0.62, P ? 14 : 26);
  const px = (i) => m.l + i * ancho + ancho / 2;
  const py = (v) => h - m.b - (v / tope) * (h - m.t - m.b);

  let rejilla = '', ejeY = '';
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${C.rejilla}"/>`;
    ejeY += `<text x="${m.l - (P ? 4 : 8)}" y="${(py(v) + fe * .35).toFixed(1)}" text-anchor="end" font-size="${fe}" fill="${C.gris}">${nf(v)}${UNI}%</text>`;
  }

  let barras = '', ejeX = '';
  vivos.forEach(([a, v], i) => {
    const ultima = i === vivos.length - 1;
    barras += `<rect x="${(px(i) - bw / 2).toFixed(1)}" y="${py(v).toFixed(1)}" width="${bw.toFixed(1)}" `
            + `height="${(h - m.b - py(v)).toFixed(1)}" fill="${ultima ? C.azul : C.azulClaro}" rx="1.5"/>`;
    if (ultima) {
      barras += `<text x="${px(i).toFixed(1)}" y="${(py(v) - (P ? 4 : 8)).toFixed(1)}" text-anchor="middle" `
              + `font-size="${P ? 9 : 13}" font-weight="700" fill="${C.negro}" `
              + `stroke="#FFFFFF" stroke-width="${P ? 2.4 : 3.2}" stroke-linejoin="round" `
              + `paint-order="stroke fill">${nf(v, 1)}${UNI}%</text>`;
    }
    if (a % 5 === 0 || ultima) {
      ejeX += `<text x="${px(i).toFixed(1)}" y="${h - (P ? 4 : 8)}" text-anchor="middle" font-size="${fe}" fill="${C.gris}">${a}</text>`;
    }
  });

  /* La línea de Canarias se dibuja sobre las mismas posiciones que las barras,
     no sobre el índice del año en la serie completa: en los dos municipios con
     huecos en la serie —El Pinar y Frontera— las dos escalas no coinciden y la
     línea se salía del gráfico. Y va suavizada con la misma interpolación
     monótona que la curva de evolución: unida a secas, saltaba de año en año. */
  const paresCan = vivos.map(([a], i) => [i, R[A.indexOf(a)]])
    .filter(([, v]) => v != null && isFinite(v));
  const trazoCan = paresCan.length >= 3
    ? suavizar(paresCan.map(([i]) => i), paresCan.map(([, v]) => v))
    : paresCan;
  const lineaCan = trazoCan.map(([i, v]) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);

  return abrirSVG(w, h, 'Peso de la población de origen extranjero, municipio frente a Canarias')
    + rejilla + barras
    + `<polyline points="${lineaCan.join(' ')}" fill="none" stroke="${C.negro}" stroke-width="1.6" stroke-linejoin="round"/>`
    + ejeY + ejeX + '</svg>';
}

/* --------------------------------------------------------------- pirámide -- */
/* EJE ÚNICO. De 0 a 7 % a cada lado, igual en las 88 fichas, en las dos
   pestañas y en los tres soportes. Antes el tope se calculaba municipio a
   municipio, y de ahí la queja de Pedro: Santa Cruz salía de dos en dos y San
   Bartolomé de cinco en cinco. Lo grave no era el rótulo, era que el dibujo
   mentía. Arico, con un grupo modal del 5,27 %, llenaba el 88 % del semiancho;
   Artenara, con 6,62 %, el 44 %. Una barra el doble de larga para un valor
   menor.

   El 7 sale de los datos, no del gusto: el grupo más numeroso de los 88
   municipios es el de Artenara, 6,621 % de su población. Con tope 6 ó 6,5
   quedaría cortado, y un eje que corta una barra es un eje que miente. La
   holgura es escasa —en Artenara, con 1.027 habitantes, una persona vale 0,097
   puntos— así que exportar_datos.py la comprueba en cada exportación y falla
   nombrando al municipio si alguno se pasa.

   Lo que cuesta: 46 de las 88 se ven más estrechas que antes. Se ven más
   estrechas porque lo son; su población está más repartida entre edades. */
const EJE_PIRAMIDE = 7;

/* Alto de la pirámide en la hoja A4. Si al medir la hoja real no cupiera, esta
   es la única constante que se toca: toda la geometría se recalcula sola. Por
   debajo de mm(52) el marco negro deja de poder dibujarse. */
const ALTO_PIRAMIDE_A4 = mm(54);

/* Tres interruptores. Los tres corresponden a cosas que Pedro dejó abiertas, y
   se dejan a la vista para poder enseñarle las dos versiones sin tocar nada:

   CANARIAS_FORMA  'barras' son las barras negras huecas que pidió ver;
                   'silueta' es la escalera negra de antes. Vale para pantalla
                   y para papel: cada pestaña lleva una sola capa negra, así que
                   en la hoja no se entretejen dos contornos en la misma fila.
   BASE_CANARIAS   contra qué se compara Canarias. El perfil de Canarias viene
                   en porcentaje sobre el total del archipiélago, extranjeros
                   incluidos; enfrentarlo a la parte nacida en España del
                   municipio sesgaría justo a los de mucha población extranjera. */
const CANARIAS_FORMA = 'barras';   // 'barras' | 'silueta'
const BASE_CANARIAS  = 'total';    // 'total' | 'espanola'

/** Los tres juegos de medidas. El SVG se redibuja a cada ancho; nunca se estira
 *  uno pequeño, que dejaría el trazo deformado y la letra en un pelo. */
function medidasPiramide(w) {
  if (IMPRIMIENDO) return { m: { t: 11, r: 10, b: 13, l: 10 }, hueco: 22, s: 0.7, fe: 8,   rej: 0.6, decadas: false };
  if (w < 430)     return { m: { t: 12, r: 8,  b: 26, l: 8  }, hueco: 28, s: 1.0, fe: 8.5, rej: 1,   decadas: true };
  return           { m: { t: 14, r: 12, b: 30, l: 12 }, hueco: 36, s: 1.1, fe: 9.5, rej: 1,   decadas: true };
}

/** Sólo el límite inferior del grupo: "0 a 4" es 0 y "100 o más" es 100. La
 *  etiqueta larga obligaba a un canal central de 47 px; así baja a 22 en papel
 *  y cada lado gana casi 13 px de dato. */
const limiteEdad = (e) => String(e).split(' ')[0];

/** El glifo negro: un camino de tres lados, abierto contra el eje. Cerrado
 *  dibujaría también su lado del eje, y las 21 marcas apiladas cerrarían dos
 *  columnas negras continuas pegadas a los números de edad.
 *
 *  El trazo se mete media anchura hacia dentro para que el borde exterior de la
 *  tinta caiga sobre el dato y no medio píxel más allá. Por debajo de dos
 *  anchuras de trazo la caja no se puede dibujar, y en vez de ensancharla
 *  —que sería mentir más que omitir— se deja una marca vertical que fija la
 *  posición sin fabricar longitud. */
function glifoNegro(x0, signo, largo, y, alto, s) {
  if (!(largo > 0)) return '';
  const xd = x0 + signo * largo;                       // donde cae el dato
  if (largo < s * 2) return `M${xd.toFixed(2)},${y.toFixed(2)}V${(y + alto).toFixed(2)}`;
  const xe = x0 + signo * (largo - s / 2);
  return `M${x0.toFixed(2)},${(y + s / 2).toFixed(2)}`
       + `H${xe.toFixed(2)}V${(y + alto - s / 2).toFixed(2)}H${x0.toFixed(2)}`;
}

/** Construye el esqueleto y devuelve las dos vistas más la geometría que
 *  necesitan la animación y la lectura. `capas` dice qué se ha pintado de
 *  verdad, y de ahí sale la leyenda: escrita a mano, la leyenda del PDF anunciaba
 *  un Canarias que el dibujo no llevaba. */
function construirPiramide(p, w, h, vistaFija = null) {
  const n = p.edades.length;
  const { m, hueco, s, fe, rej, decadas } = medidasPiramide(w);

  const total = p.hombres.reduce((a, b) => a + b, 0) + p.mujeres.reduce((a, b) => a + b, 0);
  /* Denominador único: la población total del municipio, los dos sexos, para el
     relleno y para el marco. Es lo que hace que la superposición sea aritmética
     y no decorativa: nacida en España % + de origen extranjero % = total % en
     cada semifila, así que el marco mide exactamente cuánto crece la barra al
     cambiar de pestaña. */
  const pc = (V) => total > 0 ? V.map((v) => v / total * 100) : V.map(() => 0);

  const ext = p.extranjera_hombres
    ? { H: p.extranjera_hombres, M: p.extranjera_mujeres }
    : { H: p.hombres.map(() => 0), M: p.mujeres.map(() => 0) };
  const esp = {
    H: p.hombres.map((v, i) => Math.max(0, v - ext.H[i])),
    M: p.mujeres.map((v, i) => Math.max(0, v - ext.M[i])),
  };
  const conCanarias = BASE_CANARIAS === 'total'
    ? { H: p.hombres, M: p.mujeres }
    : esp;

  /* El orden importa: la primera es la que sale al abrir la ficha y la que se
     imprime. Pedro dijo "poner Canarias en barras negras vacías" y luego
     "poder AÑADIR una pestaña que contemple solo lo de nacida en España y
     origen extranjero": la base lleva Canarias y la otra es la añadida. */
  const vistas = [
    {
      clave: 'canarias', etiqueta: 'Municipio y Canarias',
      relleno: { H: pc(conCanarias.H), M: pc(conCanarias.M) },
      negro: { H: p.canarias_hombres, M: p.canarias_mujeres },
      rotRelleno: BASE_CANARIAS === 'total' ? 'Población del municipio' : 'Nacida en España',
      rotNegro: 'Canarias',
      cuentaRelleno: conCanarias, cuentaNegro: null,
      base: 'Porcentaje sobre la población de cada territorio',
    },
    {
      clave: 'municipio', etiqueta: 'Por lugar de nacimiento',
      relleno: { H: pc(esp.H), M: pc(esp.M) },
      negro: { H: pc(ext.H), M: pc(ext.M) },
      rotRelleno: 'Nacida en España', rotNegro: 'De origen extranjero',
      cuentaRelleno: esp, cuentaNegro: ext,
      base: 'Porcentaje sobre la población total del municipio',
    },
  ];

  // ---- geometría ----
  const centro = w / 2;
  const anchoLado = centro - hueco / 2 - m.l;
  const altoFila = (h - m.t - m.b) / n;
  const relleno = altoFila * 0.70;          // 0,76 dejaba la calle de papel en 0,36 mm
  /* La capa negra tiene la MISMA altura que la barra azul, porque lo que Pedro
     pidió es una barra: "que las barras sean negras", "poner Canarias en barras
     negras vacías". A media altura se leía como una marca o un bigote, que es
     justo la familia de la silueta de la que quería salir, así que la prueba
     que pidió no era la que estaba viendo. */
  const marco = relleno;
  const off = 0;
  const fy = (i) => m.t + (n - 1 - i) * altoFila + (altoFila - relleno) / 2;
  const escala = (v) => acotar(v, 0, EJE_PIRAMIDE) / EJE_PIRAMIDE * anchoLado;
  const LADOS = [['h', -1], ['m', 1]];

  // ---- rejilla y eje ----
  let rejilla = '', ejeX = '';
  for (let v = 0; v <= EJE_PIRAMIDE; v++) {
    for (const [, signo] of LADOS) {
      const x = centro + signo * (hueco / 2 + escala(v));
      rejilla += `<line x1="${x.toFixed(1)}" y1="${m.t}" x2="${x.toFixed(1)}" y2="${(h - m.b).toFixed(1)}" stroke="${C.rejilla}" stroke-width="${rej}"/>`;
      // Se rotula de dos en dos; el 0 a los dos lados, como pidió Pedro.
      if (v % 2 === 0) {
        ejeX += `<text x="${x.toFixed(1)}" y="${(h - m.b + fe + (IMPRIMIENDO ? 3 : 6)).toFixed(1)}" `
              + `text-anchor="middle" font-size="${fe}" fill="${C.gris}">${v}${UNI}%</text>`;
      }
    }
  }
  /* Cuatro horizontales en los cortes de década. Entregan "a partir de los 20"
     sin ratón y sin una sola palabra que interprete. En la hoja no caben. */
  if (decadas) {
    for (const k of [4, 8, 12, 16]) {
      const y = m.t + (n - k) * altoFila;
      rejilla += `<line x1="${m.l}" y1="${y.toFixed(1)}" x2="${(w - m.r).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${C.rejilla}" stroke-width="${rej}"/>`;
    }
  }

  const fija = vistaFija == null ? null : vistas[vistaFija];
  const dibujarSilueta = CANARIAS_FORMA === 'silueta' && (fija || vistas[0]).clave === 'canarias';

  // ---- barras, glifos y edades ----
  let barras = '', negros = '', etiquetas = '';
  for (let i = 0; i < n; i++) {
    const y = fy(i);
    for (const [lado, signo] of LADOS) {
      const clave = lado === 'h' ? 'H' : 'M';
      const col = lado === 'h' ? C.azulMedio : C.azulClaro;
      const x0 = centro + signo * hueco / 2;
      const aR = fija ? escala(fija.relleno[clave][i]) : 0;
      barras += `<rect ${fija ? '' : `id="p${lado}${i}" `}`
              + `x="${(signo < 0 ? x0 - aR : x0).toFixed(2)}" y="${y.toFixed(2)}" `
              + `width="${aR.toFixed(2)}" height="${relleno.toFixed(2)}" fill="${col}"/>`;
      if (!dibujarSilueta) {
        const d = fija ? glifoNegro(x0, signo, escala(fija.negro[clave][i]), y + off, marco, s) : '';
        negros += `<path ${fija ? '' : `id="n${lado}${i}" `}d="${d}" fill="none" `
                + `stroke="${C.negro}" stroke-width="${s}" stroke-linejoin="miter"/>`;
      }
    }
    etiquetas += `<text x="${centro.toFixed(1)}" y="${(y + relleno / 2 + fe * 0.36).toFixed(1)}" `
               + `text-anchor="middle" font-size="${fe}" fill="${C.gris}">${limiteEdad(p.edades[i])}</text>`;
  }

  // ---- silueta de repuesto, si se pide ----
  let silueta = '';
  if (dibujarSilueta) {
    const v = fija || vistas[0];
    for (const [lado, signo] of LADOS) {
      const serie = v.negro[lado === 'h' ? 'H' : 'M'];
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = centro + signo * (hueco / 2 + escala(serie[i]));
        pts.push(`${x.toFixed(1)},${(fy(i) + relleno).toFixed(1)}`, `${x.toFixed(1)},${fy(i).toFixed(1)}`);
      }
      silueta += `<polyline points="${pts.join(' ')}" fill="none" stroke="${IMPRIMIENDO ? C.gris : C.negro}" `
               + `stroke-width="${IMPRIMIENDO ? 0.9 : 1.3}" stroke-linejoin="round"/>`;
    }
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

  const svg = abrirSVG(w, h, `Pirámide de población en porcentaje, eje de 0 a ${EJE_PIRAMIDE}${UNI}%`)
    + rejilla + barras + negros + silueta + etiquetas + ejeX + franjas + '</svg>';

  return {
    svg, vistas, escala, centro, hueco, edades: p.edades, total,
    fy, relleno, marco, off, altoFila, trazo: s, glifo: glifoNegro,
    silueta: dibujarSilueta,
    // La franja de lectura cubre la fila entera, no sólo la barra.
    fyFranja: (i) => m.t + (n - 1 - i) * altoFila,
    // El municipio completo, que es lo que enseña la lectura en reposo.
    municipio: { pct: { H: pc(p.hombres), M: pc(p.mujeres) },
                 cuenta: { H: p.hombres, M: p.mujeres } },
  };
}

/* --------------------------------------------- índices geodemográficos ----- */
/** Los tres ámbitos en tres barras, el mayor arriba. El tono sigue marcando la
 *  posición y no el territorio, que es el diseño de Pedro; lo que cambia es que
 *  la barra ahora mide. Va de cero al valor más alto de los 88 municipios en
 *  ese índice, que es la misma escala que usa el comparador: contra el mayor de
 *  los tres, la barra más larga llegaría siempre al tope y dos fichas distintas
 *  no se podrían poner una al lado de otra.
 *
 *  El municipio va rotulado como "Municipio" y no con su nombre: en una columna
 *  de cinco doceavos, "Santa María de Guía de Gran Canaria" repetido cuatro
 *  veces no cabe en una línea. */
function bloqueIndices(ind, codigos, isla, rangos) {
  return codigos.map((cod) => {
    const d = ind[cod];
    /* "en todos pondría municipios, islas y canarias": los tres ámbitos con la
       palabra genérica y no con el nombre propio. De qué isla se habla lo dice
       la línea de arriba de la ficha. */
    const filas = [['Canarias', d.canarias], ['Isla', d.isla], ['Municipio', d.municipio]]
      .filter(([, v]) => v != null)
      .sort((a, b) => b[1] - a[1]);
    /* El chip no lleva el "%" que trae el diccionario del Excel: juventud,
       dependencia y reemplazo son "por cien", no porcentajes, y el divisor no
       es el total de la población. Lleva en su lugar el recorrido de la escala,
       que es lo que hace falta para leer la barra. */
    const dec = cod === 'C10' ? 2 : 1;
    const tope = (rangos && rangos[cod] && rangos[cod].max)
      || Math.max(...filas.map(([, v]) => v)) || 1;
    return `<div class="indice">
      <div class="indice-tit"><b>${esc(d.etiqueta)}</b><em>${d.anio} · 0 a ${nf(tope, dec)}</em></div>
      <div class="escala">${filas.map(([n, v], i) => `
        <div class="peldano">
          <span>${esc(n)}</span>
          <span class="barra"><i style="width:${acotar(v / tope * 100, 1, 100).toFixed(1)}%;background:${TONOS[filas.length - 1 - i]}"></i></span>
          <b>${nf(v, dec)}</b>
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
    if (a % (P ? 4 : 2) === 0) ejeX += `<text x="${x.toFixed(1)}" y="${h - (P ? 4 : 8)}" text-anchor="middle" font-size="${P ? 6 : 9.5}" fill="${C.gris}">${a}</text>`;
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
/* Antes eran cien casillas. El reparto viene con un decimal y cien casillas no
   lo admiten: hay que redondear al entero y repartir el resto, de modo que un
   18,8 % acababa dibujado como 19. El sector circular sí admite el decimal, que
   es justo el motivo por el que Pedro lo pidió. */
function anilloOrigen(valores, radio = 74, grosor = 30) {
  const total = valores.reduce((a, b) => a + (b || 0), 0);
  if (!(total > 0)) return '';
  const w = radio * 2, cx = radio, cy = radio, re = radio - 1, ri = radio - grosor;

  const P = (ang, rad) => `${(cx + Math.cos(ang) * rad).toFixed(2)},${(cy + Math.sin(ang) * rad).toFixed(2)}`;
  let a0 = -Math.PI / 2, arcos = '';
  valores.forEach((v, i) => {
    const frac = (v || 0) / total;
    if (!(frac > 0)) return;
    // Un sector de vuelta entera no se puede trazar con un solo arco: los dos
    // extremos caerían en el mismo punto y el camino saldría vacío.
    const a1 = a0 + Math.min(frac, 0.9995) * 2 * Math.PI;
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    arcos += `<path d="M${P(a0, re)}A${re},${re} 0 ${grande},1 ${P(a1, re)}`
           + `L${P(a1, ri)}A${ri},${ri} 0 ${grande},0 ${P(a0, ri)}Z" `
           + `fill="${TONOS_ORIGEN[i]}" stroke="#FFFFFF" stroke-width="${(radio > 50 ? 1.6 : 0.7)}"/>`;
    a0 = a1;
  });
  return abrirSVG(w, w, 'Reparto por lugar de nacimiento', false) + arcos + '</svg>';
}

/* ------------------------------------------------------------ cifras clave -- */
/* Cuatro cifras y nada más. Cada celda llevaba debajo un micro-gráfico con la
   forma de su propio dato; se retiran, y el sitio que dejan se lo queda el
   número, que es lo que se viene a leer.

   El azul de la cifra no es decorativo: en toda la página el azul marca el dato
   que responde a la pregunta de la tarjeta, y el negro, lo que lo acompaña. */

/** Las cuatro celdas: la cifra, lo que es, y el pie que la sitúa. */
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

/* ================================================================= montaje == */
let GEO = null, INDICE = null, FICHA = null, PIRAMIDE = null, VISTA = 0;
let FILA = null;   // grupo de edad señalado en la pirámide, o null

async function cargar(codmun) {
  const f = await (await fetch(`datos/mun/${codmun}.json`)).json();
  VISTA = 0;
  pintar(f);
  history.replaceState(null, '', `?municipio=${codmun}`);
}

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Transición entre pestañas. Interpola a la vez el ancho del relleno azul y el
 *  largo del glifo negro, que es lo que hace que el cambio signifique algo: al
 *  pasar de "Solo municipio" a "Municipio y Canarias", cada barra crece
 *  exactamente el largo del marco que llevaba dentro, porque ese marco es la
 *  población de origen extranjero. El movimiento es la cantidad. */
let animacion = null;
const LADOS_PI = [['h', -1, 'H'], ['m', 1, 'M']];

/** La leyenda sale de lo que la pirámide ha pintado de verdad. Escrita a mano
 *  en el HTML, el PDF anunciaba un Canarias que el dibujo no llevaba. */
function pintarLeyendaPiramide(vista) {
  const cont = document.getElementById('leyenda-piramide');
  if (!cont) return;
  const llaves = [
    `<span><i class="llave" style="background:${C.azulMedio}"></i>Hombres</span>`,
    `<span><i class="llave" style="background:${C.azulClaro}"></i>Mujeres</span>`,
  ];
  if (vista.negro) {
    const forma = PIRAMIDE && PIRAMIDE.silueta ? 'llave linea' : 'llave hueca';
    llaves.push(`<span><i class="${forma}"></i>${esc(vista.rotNegro)}</span>`);
  }
  cont.innerHTML = llaves.join('');
}

function mostrarVista(i, animar = true) {
  if (!PIRAMIDE) return;
  const P = PIRAMIDE;
  VISTA = i;
  const v = P.vistas[i];
  const n = v.relleno.H.length;

  document.querySelectorAll('.vista').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  pintarLeyendaPiramide(v);
  const info = document.getElementById('vista-info');
  if (info) {
    // Ni el nombre de la pestaña, que ya está en el botón pulsado, ni el total,
    // que está en la línea de arriba de la lectura, ni que el eje sea el mismo
    // en las 88: eso es cosa nuestra y no del que lee la ficha.
    info.textContent = `${v.base} · eje de 0 a ${EJE_PIRAMIDE}\u00a0%`;
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

  const hacia = {}, desde = {};
  for (const [lado, , cl] of LADOS_PI) {
    hacia[lado] = {
      r: v.relleno[cl].map(P.escala),
      n: (v.negro ? v.negro[cl] : v.relleno[cl].map(() => 0)).map(P.escala),
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
        const cam = P.nodos[lado].n[k];
        if (cam) cam.setAttribute('d', P.glifo(x0, sg, aN, P.fy(k) + P.off, P.marco, P.trazo));
        P.actual[lado].r[k] = aR;
        P.actual[lado].n[k] = aN;
      }
    }
  };

  cancelAnimationFrame(animacion);
  // Sin animación si el usuario la ha desactivado en el sistema, y tampoco si la
  // pestaña está oculta: ahí el navegador congela requestAnimationFrame y la
  // pirámide se quedaría a medio camino.
  if (!animar || reducido() || document.hidden) { aplicar(1); pintarLectura(FILA); return; }

  const dur = 620, t0 = performance.now();
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // easeInOutCubic
    aplicar(e);
    if (p < 1) animacion = requestAnimationFrame(paso);
  };
  animacion = requestAnimationFrame(paso);
  pintarLectura(FILA);
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
  // El comparador se abre con este municipio ya puesto.
  doc.getElementById('btn-comparar').href = `comparar.html?m=${f.codmun}`;
  doc.getElementById('nombre').textContent = f.nombre;
  doc.getElementById('anio').textContent = f.anio;
  doc.getElementById('habitantes').innerHTML = `<b>${nf(f.poblacion)}</b><span>habitantes</span>`;

  // --- cifras clave ---
  doc.getElementById('cifras').innerHTML = cifrasClave(f);

  // --- subtítulos de las cartelas que dependen del año o de la serie ---
  const ev = f.evolucion;
  doc.getElementById('sub-cifras').textContent = `Datos a 1 de enero de ${f.anio}`;
  doc.getElementById('sub-evolucion').textContent =
    `Habitantes, ${ev.anios[0]}–${ev.anios[ev.anios.length - 1]}`;

  // --- mapas, en franja central y a tamaño grande ---
  const wMapa = IMPRIMIENDO
    ? Math.floor((anchoHoja(12) - 2 * mm(4)) / 3)
    : Math.max(180, Math.floor(anchoDe('mapas', 1080) / (innerWidth > 940 ? 3 : 1)) - 20);
  const hMapa = IMPRIMIENDO ? mm(16) : Math.round(wMapa * 0.74);
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
        <span>en ${esc(tit)}</span>
        <p><b>${pct(r.peso, 2)}</b> <span>de su población</span></p>
      </figcaption>
    </figure>`).join('');

  // --- gráficos ---
  const wEv = IMPRIMIENDO ? anchoHoja(7) : anchoDe('g-evolucion');
  const wEx = IMPRIMIENDO ? anchoHoja(5) : anchoDe('g-extranjero', 320);
  const wPi = IMPRIMIENDO ? anchoHoja(7) : anchoDe('g-piramide');
  const wCo = IMPRIMIENDO ? anchoHoja(6) : anchoDe('g-componentes');

  doc.getElementById('g-evolucion').innerHTML =
    graficoEvolucion(f.evolucion, wEv, IMPRIMIENDO ? mm(27) : acotar(wEv * 0.42, 190, 260));
  doc.getElementById('g-extranjero').innerHTML =
    graficoExtranjero(f.extranjero, wEx, IMPRIMIENDO ? mm(26) : acotar(wEx * 0.72, 200, 260));
  /* La leyenda lleva el valor de Canarias, no solo su nombre: es la referencia
     contra la que se lee la barra del municipio, y sin la cifra hay que
     adivinarla mirando dónde cae la línea. */
  const ultimaCan = ultimoValido(f.extranjero.canarias);
  doc.getElementById('leyenda-extranjero').innerHTML =
    `<span><i class="llave" style="background:${C.negro};height:2px;border-radius:0"></i>`
    + `Canarias <b>${pct(ultimaCan)}</b></span>`;

  /* La hoja imprime la primera pestaña, la de Canarias. Es la que Pedro echaba
     en falta: en el PDF salía Canarias en la leyenda y no en el dibujo. Y no
     puede llevar las dos, porque en 2,56 mm de fila dos contornos negros se
     entretejen y no se puede seguir ninguno. */
  if (IMPRIMIENDO) VISTA = 0;
  PIRAMIDE = construirPiramide(f.piramide, wPi, IMPRIMIENDO ? ALTO_PIRAMIDE_A4 : acotar(wPi * 0.70, 360, 470));
  doc.getElementById('g-piramide').innerHTML = PIRAMIDE.svg;
  mostrarVista(VISTA, false);

  doc.getElementById('g-indices').innerHTML =
    bloqueIndices(f.indices, ['C10', 'C11', 'C17', 'C14'], f.isla, INDICE.rangos_indices);

  const anom = f.componentes.anomalias || [];
  doc.getElementById('g-componentes').innerHTML =
    graficoComponentes(f.componentes, wCo, IMPRIMIENDO ? mm(24) : acotar(wCo * 0.34, 190, 250))
    + (anom.length ? `<figcaption class="nota">${anom.map((a) =>
        `En ${a.anio} no se representa el saldo migratorio (${nf(a.valor)}): corresponde a un `
        + `${a.motivo}, no a un flujo demográfico.`).join(' ')}</figcaption>` : '');

  // --- lugar de nacimiento ---
  const o = f.origen;
  doc.getElementById('g-origen').innerHTML = [
    ['Municipio', o.municipio], ['Canarias', o.canarias],
  ].map(([tit, vals]) => `
    <div class="anillo">
      <h3>${tit}</h3>
      ${IMPRIMIENDO ? anilloOrigen(vals, 30, 13) : anilloOrigen(vals)}
      <div class="reparto">${o.categorias.map((cat, i) => `
        <div><i style="background:${TONOS_ORIGEN[i]}"></i><span>${esc(cat)}</span><b>${nf(vals[i], 1)}${UNI}%</b></div>`).join('')}
      </div>
    </div>`).join('');

  conectarLecturaPiramide();
  conectarLecturaEvolucion();
}

/* ------------------------------------------------------- lecturas al vuelo -- */
/* Un gráfico impreso no puede dar el valor exacto de una barra. Este sí, y lo
   da sin globo flotante: un globo se pierde en el móvil, lo tapa el dedo y no
   existe en papel. El bloque va fijo debajo del dibujo, con la altura
   reservada para que nada salte, y nunca está vacío: en reposo enseña el total
   del municipio, que es la única cifra exacta que la ficha impresa no llevaba.

   Ni una palabra que califique. No hay "más que", ni "por encima de", ni
   flechas, ni diferencias con signo: un signo delante de una diferencia se lee
   como una nota. */

const LLAVE_RELLENA = `<i class="lec-llave" style="background:${C.azulMedio}"></i>`;
const LLAVE_HUECA   = `<i class="lec-llave hueca"></i>`;
const LLAVE_SIN     = `<i class="lec-llave vacia"></i>`;

function pintarLectura(i) {
  const salida = document.getElementById('lectura-piramide');
  if (!salida || !PIRAMIDE) return;
  const P = PIRAMIDE, v = P.vistas[VISTA];
  // Las dos filas de nacida en España y origen extranjero salen siempre de la
  // vista del municipio, esté abierta o no: Pedro no las condicionó a la pestaña.
  const base = P.vistas.find((x) => x.clave === 'municipio');
  const todo = i == null;
  const suma = (V) => V.reduce((a, b) => a + (b || 0), 0);
  const val = (V) => !V ? 0 : (todo ? suma(V) : (V[i] || 0));

  const pH = val(P.municipio.pct.H), pM = val(P.municipio.pct.M);
  const cH = val(P.municipio.cuenta.H), cM = val(P.municipio.cuenta.M);

  /* Dos decimales siempre: con 0,74 % un solo decimal borra la diferencia
     entre dos grupos de edad contiguos. */
  const fila = (llave, rot, a, b, na, nb) => `
    <div class="lec-fila">${llave}<span>${esc(rot)}</span>
      <b>${nf(a, 2)}${UNI}% · ${nf(b, 2)}${UNI}%</b>
      ${na == null ? '<em></em>' : `<em>${nf(na)} · ${nf(nb)}</em>`}
    </div>`;

  /* La desagregación entre nacida en España y de origen extranjero no
     desaparece al cambiar de pestaña; lo que cambia es si tiene marca propia en
     el dibujo. Las filas sin marca van sin símbolo, precisamente por eso. */
  const filas = [];
  /* Canarias sale en las dos pestañas: "lo mismo con la nueva pestaña que vamos
     a implementar". Lleva símbolo solo donde está dibujada; en la otra es un
     dato de referencia que no tiene marca propia en el gráfico. */
  const enCanarias = v.clave === 'canarias';
  const vc = P.vistas.find((x) => x.clave === 'canarias');
  filas.push(fila(enCanarias ? LLAVE_HUECA : LLAVE_SIN, 'Canarias',
    val(vc.negro.H), val(vc.negro.M), null, null));
  filas.push(fila(enCanarias ? LLAVE_SIN : LLAVE_RELLENA, 'Nacida en España',
    val(base.relleno.H), val(base.relleno.M), val(base.cuentaRelleno.H), val(base.cuentaRelleno.M)));
  filas.push(fila(enCanarias ? LLAVE_SIN : LLAVE_HUECA, 'De origen extranjero',
    val(base.negro.H), val(base.negro.M), val(base.cuentaNegro.H), val(base.cuentaNegro.M)));

  /* El grupo de edad encabeza las dos columnas, y cada una lleva de quién
     habla: a la izquierda el municipio, a la derecha las capas, con Canarias
     entre ellas. Así cada franja queda rematada con municipio y Canarias, que
     es lo que pidió Pedro. Antes la columna izquierda no decía en ninguna
     parte que fuera el municipio: había que deducirlo. */
  salida.innerHTML = `
    <p class="lec-titulo">${todo ? 'Todas las edades' : esc(P.edades[i]) + ' años'} · ${nf(todo ? P.total : cH + cM)} personas</p>
    <div class="lec-izq">
      <p class="lec-cab">Municipio</p>
      <div><span>Hombres</span><b>${nf(pH, 2)}${UNI}%</b><em>${nf(cH)}</em></div>
      <div><span>Mujeres</span><b>${nf(pM, 2)}${UNI}%</b><em>${nf(cM)}</em></div>
    </div>
    <div class="lec-der">
      <p class="lec-cab">hombres · mujeres</p>
      ${filas.join('')}
    </div>`;
}

function conectarLecturaPiramide() {
  const fig = document.getElementById('g-piramide');
  const svg = fig && fig.querySelector('svg');
  if (!svg || !PIRAMIDE) return;
  const activa = svg.querySelector('#franja-activa');
  const marcas = svg.querySelector('#marcas-activas');
  if (!activa || !marcas) return;
  let fijada = false;

  /* Los cuatro marcadores: círculo relleno en la punta de cada barra y cuadro
     negro hueco en la punta de cada marca negra. Es lo que Pedro pedía cuando
     dijo "que se mueva de un punto a otro a municipio y de uno a otro a
     Canarias". El nombre va en la lectura y no pegado al punto: pegado al
     punto cambia de serie según la edad y acaba leyéndose como un veredicto de
     quién gana en cada grupo. */
  const pintarMarcas = (i) => {
    const P = PIRAMIDE;
    let out = '';
    for (const [lado, sg] of LADOS_PI) {
      const x0 = P.centro + sg * P.hueco / 2;
      const y = P.fy(i) + P.relleno / 2;
      const xr = x0 + sg * P.actual[lado].r[i];
      out += `<circle cx="${xr.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${C.azul}" stroke="#FFFFFF" stroke-width="1.2"/>`;
      if (P.vistas[VISTA].negro) {
        const xn = x0 + sg * P.actual[lado].n[i];
        out += `<rect x="${(xn - 3.1).toFixed(1)}" y="${(y - 3.1).toFixed(1)}" width="6.2" height="6.2" `
             + `fill="#FFFFFF" stroke="${C.negro}" stroke-width="1.3"/>`;
      }
    }
    marcas.innerHTML = out;
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
    pintarLectura(i);
  };
  PIRAMIDE.senalar = senalar;

  svg.querySelectorAll('.franja').forEach((fr) => {
    const i = +fr.dataset.i;
    // pointerenter cubre ratón y lápiz; con mouseenter a secas, en el móvil no
    // se podía leer ni una cifra.
    fr.addEventListener('pointerenter', () => { if (!fijada) senalar(i); });
    fr.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fijada = !(fijada && FILA === i);
      senalar(fijada ? i : null);
    });
  });

  svg.addEventListener('pointerleave', () => { if (!fijada) senalar(null); });

  fig.setAttribute('tabindex', '0');
  fig.addEventListener('keydown', (e) => {
    const n = PIRAMIDE.edades.length;
    let i = FILA;
    switch (e.key) {
      case 'ArrowUp':   i = i == null ? 0 : Math.min(n - 1, i + 1); break;
      case 'ArrowDown': i = i == null ? n - 1 : Math.max(0, i - 1); break;
      case 'Home':      i = 0; break;
      case 'End':       i = n - 1; break;
      case 'Escape':    i = null; fijada = false; break;
      default: return;
    }
    e.preventDefault();
    if (i != null) fijada = true;
    senalar(i);
  });

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

/* ------------------------------------------------------------- compartir --- */
/* Copia el enlace de m/<código>.html en vez del de la barra de direcciones.
   Los rastreadores de WhatsApp y de X no ejecutan JavaScript, así que las
   etiquetas og: tienen que venir ya en el HTML servido: una sola ficha.html con
   ?municipio= enseñaría la misma tarjeta para los 88 municipios. */
function conectarCompartir() {
  const b = document.getElementById('btn-compartir');
  const rotulo = b.querySelector('span');
  const original = rotulo.textContent;
  b.addEventListener('click', async () => {
    if (!FICHA) return;
    const url = new URL(`m/${FICHA.codmun}.html`, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      rotulo.textContent = 'Enlace copiado';
      // En móvil el rótulo va oculto: se enseña un momento para confirmar.
      b.classList.add('confirmado');
      setTimeout(() => { rotulo.textContent = original; b.classList.remove('confirmado'); }, 2200);
    } catch {
      // Sin permiso de portapapeles: se abre para copiarlo a mano.
      window.prompt('Copia el enlace para compartir:', url);
    }
  });
}

/* ------------------------------------------------------------------ inicio -- */
/** Coloca el icono del set en cada rótulo y en cada botón que lo pida. Se
 *  inyecta desde aquí y no se escribe en el HTML para que los trazos vivan en
 *  un solo sitio: iconos.js. */
function montarIconos() {
  document.querySelectorAll('.rotulo[data-ico]').forEach((r) =>
    r.insertAdjacentHTML('afterbegin', icono(r.dataset.ico, 26)));
  document.querySelectorAll('.btn[data-ico]').forEach((b) =>
    b.insertAdjacentHTML('afterbegin', icono(b.dataset.ico, 15)));
}

/* Chrome, Safari y Firefox disparan beforeprint antes de maquetar la hoja, así
   que da tiempo a redibujar. Vale igual para Ctrl+P que para el botón. */
/* La hoja imprime siempre la primera pestaña, pero la que estuviera abierta en
   pantalla se devuelve al terminar: quien imprimía desde "Municipio y Canarias"
   se encontraba con la otra al volver. */
let VISTA_ANTES = 0;
addEventListener('beforeprint', () => {
  if (!FICHA) return;
  VISTA_ANTES = VISTA;
  IMPRIMIENDO = true;
  pintar(FICHA);
});
addEventListener('afterprint', () => {
  if (!FICHA) return;
  IMPRIMIENDO = false;
  VISTA = VISTA_ANTES;
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
  conectarCompartir();

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

if (document.getElementById('sel-municipio')) {
  iniciar().catch((e) => {
    document.getElementById('nombre').textContent = 'No se han podido cargar los datos';
    console.error(e);
  });
}

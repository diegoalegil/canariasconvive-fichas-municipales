/* Escenario demográfico 2035: la página prospectiva de Pedro (su cuaderno
   FICHAS_MUNICIPALES_PROSPECTIVAS, celdas P1 a P3) para cada municipio, isla,
   provincia y Canarias, con los datos de exportar_escenario.py. Va en verde a
   propósito, para separar lo estimado de lo observado, que en el resto de la
   web es azul. Como en la ficha, se muestran los datos sin interpretarlos, y
   lo proyectado no se escribe como cifra exacta: lo que sostiene la página es
   la dirección y la intensidad del cambio (la nota de Pedro). */

const V = {
  verde: '#1B6B47', medio: '#2F8A5E', claro: '#7DC4A0', palido: '#B9E0CD',
  negro: '#1A1A1A', gris: '#5F5E5A', rejilla: '#D9D9D9', eje: '#BFBFBF', corte: '#BBBBBB', contorno: '#000000',
};

let INDICE = null, ESC = null;
let PAPEL = false;   // al imprimir, los gráficos se redibujan a la medida de la A4

/* Las mismas claves que la ficha: código INE, «isla:<slug>», «provincia:<slug>» o «canarias». */
const tipoDe = (clave) => clave === 'canarias' ? 'canarias' : clave.includes(':') ? clave.split(':')[0] : 'municipio';
const idDe = (clave) => clave.split(':').pop();
const rutaEscenario = (clave) => {
  const tipo = tipoDe(clave);
  return tipo === 'canarias' ? 'datos/escenario/canarias.json'
    : `datos/escenario/${tipo === 'municipio' ? 'mun' : tipo}/${idDe(clave)}.json`;
};
/** La consulta que abre este territorio, aquí y en la ficha. */
const consultaDe = (clave) => tipoDe(clave) === 'canarias' ? 'canarias' : `${tipoDe(clave)}=${idDe(clave)}`;
const claveDe = (e) => e.tipo === 'municipio' ? String(e.codmun) : e.tipo === 'canarias' ? 'canarias' : `${e.tipo}:${e.slug}`;

/* --------------------------------------------------------------- medidas -- */
const MM = 96 / 25.4;
/** Ancho interior de una tarjeta de `cols` columnas en la A4 (190 mm útiles,
 *  doce columnas, 1,8 mm entre tarjetas y 3 mm de margen interior), como la ficha. */
function anchoPapel(cols) {
  const col = (190 - 11 * 1.8) / 12;
  return Math.round((col * cols + 1.8 * (cols - 1) - 2 * 3) * MM);
}
function anchoDe(id, porDefecto) {
  const w = document.getElementById(id)?.clientWidth || 0;
  return w > 60 ? w : porDefecto;
}
const svg = (w, h, titulo) => `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(titulo)}" preserveAspectRatio="xMidYMid meet">`;
/** Lo proyectado, con cuatro cifras significativas y nunca por debajo de las
 *  decenas: un orden de magnitud, no un recuento. */
const aproximado = (v) => {
  const p = Math.max(10, 10 ** (Math.floor(Math.log10(v)) - 3));
  return `unos ${nf(Math.round(v / p) * p)}`;
};

/* ------------------------------------------- evolución con lo proyectado -- */
/** Lo observado en negro con un relleno tenue y lo proyectado en verde
 *  discontinuo hasta el punto del horizonte; una línea de puntos separa los
 *  dos tramos en el año base (celda P2, `evolucion_p`). */
function graficoEvolucion(e, w, h) {
  const P = PAPEL;
  const m = P ? { t: 6, r: 8, b: 13, l: 34 } : { t: 10, r: 14, b: 26, l: 52 };
  const fe = P ? 6.5 : 10;
  const X = e.observado.anios, Y = e.observado.valores;
  const XP = e.proyectado.anios, YP = e.proyectado.valores;
  const maximo = Math.max(...Y, ...YP);
  const paso = pasoEvolucion(maximo * 1.12, 5);
  const tope = Math.ceil(maximo * 1.12 / paso) * paso;
  m.l = Math.max(m.l, Math.round(nf(tope).length * fe * 0.58 + (P ? 4 : 8)));
  const x0 = X[0], x1 = XP[XP.length - 1];
  const px = (a) => m.l + (a - x0) / (x1 - x0) * (w - m.l - m.r);
  const py = (v) => h - m.b - v / tope * (h - m.t - m.b);
  const suelo = (h - m.b).toFixed(1);

  let rejilla = '', ejeY = '', ejeX = '';
  for (let v = 0; v <= tope + 1e-9; v += paso) {
    rejilla += `<line x1="${m.l}" y1="${py(v).toFixed(1)}" x2="${w - m.r}" y2="${py(v).toFixed(1)}" stroke="${V.rejilla}"/>`;
    ejeY += `<text x="${m.l - (P ? 5 : 9)}" y="${(py(v) + fe * .35).toFixed(1)}" text-anchor="end" font-size="${fe}" fill="${V.gris}">${nf(v)}</text>`;
  }
  // De cinco en cinco años; de diez en diez si los rótulos no caben (en el móvil se tocaban).
  // Si la serie arranca en un año redondo, su rótulo va pegado al eje y pide más hueco.
  const cadaAnios = px(x0 + 5) - px(x0) >= fe * (x0 % 5 === 0 ? 4.4 : 3.2) ? 5 : 10;
  for (let a = Math.ceil(x0 / cadaAnios) * cadaAnios; a <= x1; a += cadaAnios) {
    const enOrigen = px(a) <= m.l + 1;
    ejeX += `<text x="${(px(a) - (enOrigen ? 2 : 0)).toFixed(1)}" y="${h - (P ? 4 : 8)}" text-anchor="${enOrigen ? 'start' : 'middle'}" font-size="${fe}" fill="${V.gris}">${a}</text>`;
  }
  const tramo = (xs, ys) => suavizar(xs, ys).map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`);
  const obs = tramo(X, Y), pro = tramo(XP, YP);
  const area = (puntos, a, b) => `M${px(a).toFixed(1)},${suelo} L${puntos.join(' L')} L${px(b).toFixed(1)},${suelo}Z`;
  // «proyectado» va a la derecha del corte y no puede salirse del gráfico: si
  // no cabe (en el móvil), el cuerpo baja lo justo.
  const xb = px(e.base);
  const fr = acotar((w - xb - (P ? 4 : 7)) / ('proyectado'.length * 0.68), P ? 4.5 : 8, P ? 6 : 10);
  const yRotulo = (py(tope) + fr + (P ? 2 : 4)).toFixed(1);

  return svg(w, h, `Evolución de la población: observada de ${x0} a ${e.base} y proyectada hasta ${e.horizonte}`)
    + rejilla
    + `<path d="${area(obs, x0, e.base)}" fill="${V.negro}" fill-opacity=".06"/>`
    + `<path d="${area(pro, e.base, x1)}" fill="${V.verde}" fill-opacity=".12"/>`
    + `<line x1="${xb.toFixed(1)}" y1="${m.t}" x2="${xb.toFixed(1)}" y2="${suelo}" stroke="${V.corte}" stroke-width="${P ? .7 : 1}" stroke-dasharray="${P ? '1 2' : '1.5 3'}"/>`
    + `<line x1="${m.l}" y1="${suelo}" x2="${w - m.r}" y2="${suelo}" stroke="${V.eje}"/>`
    + `<polyline points="${obs.join(' ')}" fill="none" stroke="${V.negro}" stroke-width="${P ? 1.2 : 2}" stroke-linejoin="round"/>`
    + `<polyline points="${pro.join(' ')}" fill="none" stroke="${V.verde}" stroke-width="${P ? 1.6 : 2.6}" stroke-dasharray="${P ? '4 2.2' : '7 4'}" stroke-linejoin="round"/>`
    + `<circle cx="${px(x1).toFixed(1)}" cy="${py(YP[YP.length - 1]).toFixed(1)}" r="${P ? 2.6 : 4.5}" fill="${V.verde}"/>`
    + `<text x="${(xb - (P ? 3 : 6)).toFixed(1)}" y="${yRotulo}" text-anchor="end" font-size="${fr}" fill="${V.gris}">observado</text>`
    + `<text x="${(xb + (P ? 3 : 6)).toFixed(1)}" y="${yRotulo}" font-size="${fr}" font-weight="700" fill="${V.verde}">proyectado</text>`
    + ejeY + ejeX + '</svg>'
    + tablaOculta('Población observada y proyectada', ['Año', 'Habitantes'],
      [...X.map((a, i) => [a, nf(Y[i])]), ...XP.slice(1).map((a, i) => [`${a}, proyectado`, aproximado(YP[i + 1])])]);
}

/* ----------------------------------------------- variación media anual ---- */
/** Sin «+» en los positivos y sin «−0,0» (celda P2, `_cifra_tvma`). */
const cifraTvma = (v) => Math.abs(v) < 0.05 ? `0,0${UNI}%` : pct(v, 1);

/** El territorio, su isla y Canarias: lo observado en una casilla blanca con
 *  borde negro y lo proyectado en una verde (celda P2, `tvma_p`). */
function tablaTvma(e) {
  const [obs, pro] = e.tvma.periodos.map(([a, b]) => `${a}-${b}`);
  return `<table class="esc-tvma"><caption class="oculto">Variación media anual de la población</caption>`
    + `<thead><tr><th scope="col"><span class="oculto">Ámbito</span></th>`
    + `<th scope="col"><span class="oculto">${obs}, observada</span></th><th scope="col"><span class="oculto">${pro}, proyectada</span></th></tr></thead>`
    + `<tbody>${e.tvma.filas.map((f) => `<tr><th scope="row">${esc(f.rotulo)}</th>`
      + `<td><span class="obs">${cifraTvma(f.observada)}</span></td><td><span class="pro">${cifraTvma(f.proyectada)}</span></td></tr>`).join('')}</tbody></table>`
    + `<div class="leyenda esc-leyenda" aria-hidden="true"><span><i class="llave hueca"></i>${obs}</span><span><i class="llave" style="background:${V.verde}"></i>${pro}</span></div>`;
}

/* ------------------------------------------------- pirámide del horizonte -- */
/** Barras de 2035 en verde (hombres a la izquierda, mujeres a la derecha) en
 *  porcentaje sobre el propio total, con el contorno negro de 2025 encima, y
 *  los grupos de 85 en adelante juntos (celda P2, `piramide_p`). Escala
 *  propia, un 15 % por encima del grupo mayor, y marcas de dos en dos. */
function graficoPiramide(e, w) {
  const P = PAPEL;
  const pi = e.piramide, G = pi.edades.length;
  const b = pi.base, z = pi.horizonte;
  const maximo = Math.max(...b.hombres, ...b.mujeres, ...z.hombres, ...z.mujeres);
  const lim = maximo * 1.15;
  const fe = P ? 6.3 : 10.5;
  const fila = P ? 17 : 23, alto = fila * 0.8;
  const m = { t: P ? 2 : 4, r: P ? 4 : 8, b: P ? 22 : 38, l: P ? 46 : 78 };
  const h = m.t + G * fila + m.b;
  const cx = m.l + (w - m.l - m.r) / 2;
  const s = (w - m.l - m.r) / 2 / lim;
  const y = (i) => m.t + (G - 1 - i) * fila;   // el grupo 0 abajo
  const suelo = m.t + G * fila;
  const trazo = P ? .7 : 1;

  let rejilla = '', barras = '', contorno = '', edades = '', marcas = '';
  for (let i = 0; i <= G; i++) {
    const yy = (m.t + i * fila).toFixed(1);
    if (i < G) rejilla += `<line x1="${m.l}" y1="${yy}" x2="${w - m.r}" y2="${yy}" stroke="${V.rejilla}" stroke-width="${P ? .5 : .8}"/>`;
  }
  for (let i = 0; i < G; i++) {
    const y0 = (y(i) + (fila - alto) / 2).toFixed(1);
    barras += `<rect x="${(cx - z.hombres[i] * s).toFixed(1)}" y="${y0}" width="${(z.hombres[i] * s).toFixed(1)}" height="${alto.toFixed(1)}" fill="${V.medio}"/>`
      + `<rect x="${cx.toFixed(1)}" y="${y0}" width="${(z.mujeres[i] * s).toFixed(1)}" height="${alto.toFixed(1)}" fill="${V.claro}"/>`;
    // El contorno de 2025 se dibuja por dentro del trazo, para no ensanchar la barra.
    const media = trazo / 2;
    contorno += `<rect x="${(cx - b.hombres[i] * s + media).toFixed(1)}" y="${(+y0 + media).toFixed(1)}" width="${Math.max(0, b.hombres[i] * s - trazo).toFixed(1)}" height="${(alto - trazo).toFixed(1)}" fill="none" stroke="${V.contorno}" stroke-width="${trazo}"/>`
      + `<rect x="${(cx + media).toFixed(1)}" y="${(+y0 + media).toFixed(1)}" width="${Math.max(0, b.mujeres[i] * s - trazo).toFixed(1)}" height="${(alto - trazo).toFixed(1)}" fill="none" stroke="${V.contorno}" stroke-width="${trazo}"/>`;
    edades += `<text x="${m.l - (P ? 4 : 8)}" y="${(y(i) + fila / 2 + fe * .35).toFixed(1)}" text-anchor="end" font-size="${fe}" fill="${V.negro}">${esc(pi.edades[i])}</text>`;
  }
  for (let v = 0; v <= lim + 1e-9; v += 2) {
    for (const lado of v ? [-1, 1] : [1]) {
      marcas += `<text x="${(cx + lado * v * s).toFixed(1)}" y="${(suelo + fe + (P ? 3 : 6)).toFixed(1)}" text-anchor="middle" font-size="${fe}" fill="${V.negro}">${v}</text>`;
    }
  }
  const tituloEje = `<text x="${cx.toFixed(1)}" y="${(suelo + 2 * fe + (P ? 6 : 14)).toFixed(1)}" text-anchor="middle" font-size="${fe + (P ? .5 : 1)}" font-weight="700" fill="${V.negro}">%</text>`
    + `<text transform="translate(${(P ? fe : fe + 2).toFixed(1)} ${(m.t + G * fila / 2).toFixed(1)}) rotate(-90)" text-anchor="middle" font-size="${fe + (P ? .5 : 1)}" font-weight="700" fill="${V.negro}">Grupos de edad</text>`;

  const pc = (v) => nf(v, 1);
  return svg(w, h, `Estructura de la población en ${e.horizonte}, en porcentaje sobre el total, con el contorno de ${e.base}`)
    + rejilla + barras + contorno
    + `<line x1="${m.l}" y1="${suelo}" x2="${w - m.r}" y2="${suelo}" stroke="${V.eje}"/>`
    + edades + marcas + tituloEje + '</svg>'
    + tablaOculta(`Porcentaje sobre el total por sexo y grupo de edad, ${e.base} y ${e.horizonte}`,
      ['Grupo de edad', `Hombres ${e.base}`, `Hombres ${e.horizonte}`, `Mujeres ${e.base}`, `Mujeres ${e.horizonte}`],
      pi.edades.map((g, i) => [esc(g), pc(b.hombres[i]), pc(z.hombres[i]), pc(b.mujeres[i]), pc(z.mujeres[i])]).reverse());
}

const leyendaPiramide = (e) => `<span><i class="llave hueca"></i>Población ${e.base}</span>`
  + `<span><i class="llave" style="background:${V.medio}"></i>Hombres ${e.horizonte}</span>`
  + `<span><i class="llave" style="background:${V.claro}"></i>Mujeres ${e.horizonte}</span>`;

/* ----------------------------------------------------------- índices ------ */
/** Cada índice en el año base y en el horizonte, con el cambio entre ambos en
 *  porcentaje (celda P2, `indices_p`). */
function bloqueIndices(e) {
  return Object.values(e.indices).map((d) => {
    const cambio = (d.horizonte / d.base - 1) * 100;
    const r = Math.round(Math.abs(cambio));
    const flecha = r === 0 ? '' : cambio > 0 ? `${UNI}▲` : `${UNI}▼`;
    const dicho = r === 0 ? 'sin cambio' : `${cambio > 0 ? 'aumenta' : 'disminuye'} un ${nf(r)}${UNI}%`;
    return `<div class="esc-indice">
      <h3>${esc(d.etiqueta)}${d.unidad ? ` (${esc(d.unidad)})` : ''}</h3>
      <div class="esc-indice-fila">
        <dl class="esc-anios">
          <div><dt>${e.base}</dt><dd>${nf(d.base, d.decimales)}</dd></div>
          <div><dt>${e.horizonte}</dt><dd>${nf(d.horizonte, d.decimales)}</dd></div>
        </dl>
        <p class="esc-cambio"><span aria-hidden="true">${nf(r)}${UNI}%${flecha}</span><span class="oculto">Entre ${e.base} y ${e.horizonte}, ${dicho}</span></p>
      </div>
    </div>`;
  }).join('');
}

/* ------------------------------------------------------------- pintado ---- */
function migasDe(e) {
  if (e.tipo === 'municipio') {
    const m = INDICE.municipios.find((x) => x.codmun === e.codmun);
    return m ? [m.isla, comarcaDe(m)].filter(Boolean).join(' · ') : e.isla;
  }
  if (e.tipo === 'isla') return `Canarias · ${(INDICE.islas[e.nombre] || []).length} municipios`;
  if (e.tipo === 'provincia') {
    const p = INDICE.provincias.find((x) => x.slug === e.slug);
    return p ? `Canarias · ${p.islas.length} islas · ${p.municipios} municipios` : 'Canarias';
  }
  return `${INDICE.provincias.length} provincias · ${INDICE.islas_resumen.length} islas · ${INDICE.municipios.length} municipios`;
}

function pintar(e) {
  ESC = e;
  const el = (id) => document.getElementById(id);
  const de = { isla: ' de la isla', provincia: ' de la provincia' }[e.tipo] || '';
  document.title = tituloPagina(`${e.nombre} · Escenario demográfico ${e.horizonte}${de}`);
  el('migas').textContent = migasDe(e);
  el('nombre').textContent = e.nombre;
  el('periodo').textContent = `${e.base}-${e.horizonte}`;
  el('esc-titulo').textContent = `Escenario demográfico ${e.horizonte}`;
  el('sub-evolucion').textContent = `Habitantes, ${e.observado.anios[0]}–${e.horizonte}`;
  el('sub-tvma').textContent = `Observada entre ${e.tvma.periodos[0].join(' y ')} y proyectada entre ${e.tvma.periodos[1].join(' y ')}`;
  el('tit-piramide').textContent = `Estructura de la población en ${e.horizonte}`;
  el('sub-indices').textContent = `${e.base} y ${e.horizonte}, y cambio entre ambos años`;

  const wEv = PAPEL ? anchoPapel(8) : anchoDe('g-evolucion', 720);
  const wPi = PAPEL ? anchoPapel(8) : anchoDe('g-piramide', 720);
  const hEv = PAPEL ? Math.round(wEv * 0.55) : Math.round(acotar(wEv * 0.48, 240, 360));
  el('g-evolucion').innerHTML = graficoEvolucion(e, wEv, hEv);
  el('g-tvma').innerHTML = tablaTvma(e);
  el('g-piramide').innerHTML = graficoPiramide(e, wPi);
  el('leyenda-piramide').innerHTML = leyendaPiramide(e);
  el('g-indices').innerHTML = bloqueIndices(e);

  const consulta = consultaDe(claveDe(e));
  el('btn-ficha').href = rutaWeb(`ficha.html?${consulta}`);
  document.getElementById('sel-territorio').value = claveDe(e);
  history.replaceState(null, '', rutaWeb(`escenario.html?${consulta}`));
}

// Solo la última petición pinta; si falla, el selector vuelve a lo que se ve y se ofrece reintentar.
let peticion = null;
async function cargar(clave) {
  peticion?.abort();
  const esta = new AbortController();
  peticion = esta;
  const contenido = document.querySelector('main');
  contenido.setAttribute('aria-busy', 'true');
  const tardio = setTimeout(() => { if (esta === peticion) avisoCarga('estado-escenario', 'Cargando el escenario…'); }, 600);
  try {
    const e = await leerJSON(rutaEscenario(clave), esta.signal);
    if (esta !== peticion) return;
    const soltar = ESC ? cruce('.cabecera, .tarjeta > .cuerpo') : () => {};
    pintar(e);
    soltar();
    avisoCarga('estado-escenario');
  } catch (error) {
    if (esta !== peticion || error.name === 'AbortError') return;
    if (ESC) document.getElementById('sel-territorio').value = claveDe(ESC);
    else document.getElementById('nombre').textContent = 'Escenario sin cargar';
    avisoCarga('estado-escenario', 'No se ha podido cargar el escenario.'
      + (ESC ? ' Se mantiene el anterior.' : ''), () => cargar(clave));
  } finally {
    clearTimeout(tardio);
    if (esta === peticion) contenido.setAttribute('aria-busy', 'false');
  }
}

/* beforeprint llega antes de maquetar la hoja: se redibuja a la medida de la A4. */
addEventListener('beforeprint', () => { if (ESC) { PAPEL = true; pintar(ESC); } });
addEventListener('afterprint', () => { if (ESC) { PAPEL = false; pintar(ESC); } });
let temporizador = null, anchoPrevio = innerWidth;
addEventListener('resize', () => {
  if (!ESC || innerWidth === anchoPrevio) return;
  anchoPrevio = innerWidth;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => pintar(ESC), 180);
});

async function iniciar() {
  document.querySelectorAll('.rotulo[data-ico]').forEach((r) => r.insertAdjacentHTML('afterbegin', icono(r.dataset.ico, 26)));
  document.querySelectorAll('.btn[data-ico]').forEach((b) => b.insertAdjacentHTML('afterbegin', icono(b.dataset.ico, 15)));
  document.getElementById('btn-pdf').addEventListener('click', () => window.print());
  enlacesAbsolutos();
  document.querySelector('.placa-papel').innerHTML = logotipos();

  const tardio = setTimeout(() => avisoCarga('estado-escenario', 'Cargando los datos…'), 600);
  try {
    INDICE = await leerJSON('datos/indice.json');
  } finally {
    clearTimeout(tardio);
  }
  avisoCarga('estado-escenario');

  // El mismo desplegable que la ficha: Canarias y las provincias; después cada
  // isla abre su grupo con la isla entera y sigue con sus municipios.
  const sel = document.getElementById('sel-territorio');
  sel.innerHTML = `<optgroup label="Canarias">
      <option value="canarias">Canarias · todo el archipiélago</option>
      ${INDICE.provincias.map((p) => `<option value="provincia:${p.slug}">Provincia de ${esc(p.nombre)}</option>`).join('')}
    </optgroup>` + Object.entries(INDICE.islas).map(([isla, muns]) => {
    const i = INDICE.islas_resumen.find((x) => x.nombre === isla);
    return `<optgroup label="${esc(isla)}">`
      + (i ? `<option value="isla:${i.slug}">${esc(isla)} · toda la isla</option>` : '')
      + muns.map((n) => {
        const m = INDICE.municipios.find((x) => x.nombre === n);
        return m ? `<option value="${m.codmun}">${esc(n)}</option>` : '';
      }).join('') + '</optgroup>';
  }).join('');

  // ?municipio=38038, ?isla=tenerife, ?provincia=las-palmas o ?canarias; sin nada, Canarias.
  const params = new URLSearchParams(location.search);
  const valida = [...sel.options].map((o) => o.value);
  const pedida = params.has('municipio') ? params.get('municipio')
    : params.has('isla') ? `isla:${params.get('isla')}`
    : params.has('provincia') ? `provincia:${params.get('provincia')}` : 'canarias';
  const inicial = valida.includes(pedida) ? pedida : 'canarias';
  sel.value = inicial;
  sel.addEventListener('change', () => cargar(sel.value));
  await cargar(inicial);
}

iniciar().catch((e) => {
  document.getElementById('nombre').textContent = 'Escenario sin cargar';
  avisoCarga('estado-escenario', 'No se han podido cargar los datos.', () => location.reload());
  console.error(e);
});

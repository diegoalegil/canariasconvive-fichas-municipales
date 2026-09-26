/* Presentación en vídeo. Con el movimiento permitido, «Presentar» reproduce los
   seis capítulos de la presentación (las mismas cifras, rótulos y fuentes que
   las diapositivas fijas) como una pieza animada de 43,5 segundos. No hay nada
   grabado: cada fotograma se calcula con los datos de la ficha abierta, así que
   vale igual para los 88 municipios, las siete islas, las dos provincias y
   Canarias. Cada fotograma es una función del tiempo (`fotograma`): al
   reproducir, el reloj avanza con requestAnimationFrame, y pruebas/video.cjs lo
   recorre fotograma a fotograma para grabar un MP4. Con «reducir movimiento»
   no arranca y la presentación son las seis diapositivas fijas de ficha.js.
   Las reglas de Pedro valen igual: paleta azul, datos sin interpretar y la
   pirámide sin cifras en reposo. */

// Segundos de cada capítulo (las seis diapositivas). El primero abre con el mapa
// y el último cierra con los logotipos; el total, 43,5 s. Cada capítulo deja
// unos dos segundos con todos sus datos a la vista antes de la barrida.
const DURACIONES = [8.5, 7, 7, 4.5, 6, 10.5];
const COMIENZOS = DURACIONES.map((_, i) => DURACIONES.slice(0, i).reduce((a, b) => a + b, 0));
const DURACION = DURACIONES.reduce((a, b) => a + b, 0);
const CORTINILLA = 0.8;          // barrida diagonal entre capítulos, centrada en el corte
const FIN_PRELUDIO = 2.6;        // del mapa a la portada, dentro del primer capítulo
const FIN_DATOS = 7.5;           // del último capítulo al cierre con los logotipos
const EMPUJE = 0.022;            // la cámara se acerca despacio durante cada capítulo
// Los cortes con barrida: la pirámide pasa de una vista a otra transformándose, sin barrida.
const CORTES = [FIN_PRELUDIO, COMIENZOS[1], COMIENZOS[2], COMIENZOS[4], COMIENZOS[5], COMIENZOS[5] + FIN_DATOS];

/* ------------------------------------------------------------- curvas ---- */
const a01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Avance de 0 a 1 de un tramo que empieza en `desde` y dura `dura` segundos. */
const avance = (t, desde, dura) => a01((t - desde) / dura);
const eSalida = (p) => 1 - Math.pow(1 - p, 3);
const eExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const eVaiven = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** Con un pequeño rebote al final (se pasa un 10 % y vuelve). */
const eRebote = (p) => (p <= 0 ? 0 : 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2));

/* --------------------------------------------------------- utilidades ---- */
const SVGNS = 'http://www.w3.org/2000/svg';
function nodoSVG(nombre, atributos = {}) {
  const e = document.createElementNS(SVGNS, nombre);
  for (const [k, v] of Object.entries(atributos)) e.setAttribute(k, v);
  return e;
}

/** Entrada de un elemento: fundido, desplazamiento, escala y desenfoque que se
 *  resuelven en p = 1; entonces se le quitan los estilos y queda como la
 *  diapositiva fija. */
function entrada(el, p, { dx = 0, dy = 0, escala = 1, desenfoque = 0, rebote = false } = {}) {
  if (!el) return;
  if (p >= 1) { el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; return; }
  const op = eSalida(a01(p * 1.5));
  const mov = rebote ? eRebote(p) : eSalida(p);
  el.style.opacity = op.toFixed(3);
  el.style.transform = `translate(${(dx * (1 - mov)).toFixed(1)}px, ${(dy * (1 - mov)).toFixed(1)}px) scale(${(1 + (escala - 1) * (1 - mov)).toFixed(4)})`;
  el.style.filter = desenfoque ? `blur(${(desenfoque * (1 - op)).toFixed(2)}px)` : '';
}
/** Lo mismo para un elemento SVG, con opacidad solamente. */
const fundido = (el, p) => { if (el) el.setAttribute('opacity', p >= 1 ? 1 : eSalida(p).toFixed(3)); };

/** Una cifra que cuenta desde cero hasta la que ya está escrita: se toma el
 *  primer texto con dígitos del elemento, con lo que lleve delante y detrás
 *  («▲ », « %», « personas»), y en p = 1 vuelve el texto exacto. */
const CIFRA = /^([^\d]*?)(\d+(?:\.\d{3})*)(?:,(\d+))?([^\d]*)$/s;
function contador(el) {
  if (!el) return null;
  const recorrido = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    const m = CIFRA.exec(n.data);
    if (!m) continue;
    return {
      nodo: n, texto: n.data, antes: m[1], despues: m[4], dec: m[3] ? m[3].length : 0,
      valor: parseFloat(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : '')),
    };
  }
  return null;
}
function contar(c, p) {
  if (!c) return;
  c.nodo.data = p >= 1 ? c.texto : c.antes + nf(c.valor * eExpo(p), c.dec) + c.despues;
}

/* -------------------------------------------------- mapa del arranque ---- */
/** El archipiélago a 1920×1080 y el encuadre final sobre el territorio: el
 *  municipio, la isla o la provincia de la ficha; en Canarias, sin acercarse. */
function preludioMapa(f, ent) {
  if (!GEO) return null;
  const rasgos = GEO.features;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rasgos) {
    const [a, b, c, d] = r.properties.bbox;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
  }
  const W = 1920, H = 1080, pad = 110;
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const px = (x) => (x - x0) * s + ox, py = (y) => (y1 - y) * s + oy;
  const P = (c) => `${px(c[0]).toFixed(1)},${py(c[1]).toFixed(1)}`;
  const suyo = ent.canarias ? () => true
    : ent.isla ? (r) => r.properties.isla === f.nombre
    : ent.provincia ? (r) => PROVINCIA_DE[r.properties.isla] === f.nombre
    : (r) => r.properties.codmun === f.codmun;
  // Encuadre del territorio (en Canarias no hay acercamiento).
  let fx0 = Infinity, fy0 = Infinity, fx1 = -Infinity, fy1 = -Infinity;
  for (const r of rasgos.filter(suyo)) {
    const [a, b, c, d] = r.properties.bbox;
    fx0 = Math.min(fx0, px(a)); fx1 = Math.max(fx1, px(c)); fy0 = Math.min(fy0, py(d)); fy1 = Math.max(fy1, py(b));
  }
  const zoom = ent.canarias ? 1 : Math.min(12, 0.42 * W / (fx1 - fx0), 0.5 * H / (fy1 - fy0));
  // Las islas se encienden de oeste a este en la ficha de Canarias.
  const orden = Object.keys(INDICE?.islas || {});
  let base = '', luz = '';
  for (const r of rasgos) {
    const d = r.geometry.coordinates.map((pol) => pol.map((an) => 'M' + an.map(P).join('L') + 'Z').join('')).join('');
    base += `<path d="${d}" fill="${C.azulMedio}" stroke="${C.azul}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    if (suyo(r)) luz += `<path d="${d}" data-isla="${Math.max(0, orden.indexOf(r.properties.isla))}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="0.6" vector-effect="non-scaling-stroke" opacity="0"/>`;
  }
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><g class="camara">${base}${luz}</g></svg>`,
    centro: [(fx0 + fx1) / 2, (fy0 + fy1) / 2], zoom,
  };
}

/* ------------------------------------------------------------ escenas ---- */
/** Prepara el vídeo sobre la presentación ya montada y devuelve las seis
 *  escenas: cada una recibe el tiempo dentro de su capítulo y deja todo lo
 *  suyo como corresponde a ese instante (hacia delante y hacia atrás). */
function prepararEscenas(cont) {
  const f = FICHA, P = PRES.P, R = rotulosFicha(f, ENT);
  const capas = [...cont.querySelectorAll('.pres-diapo')];
  const escenario = cont.querySelector('.pres-escenario');
  const q = (capa, sel) => capas[capa].querySelector(sel);
  const qa = (capa, sel) => [...capas[capa].querySelectorAll(sel)];

  /* ---- arranque: el mapa, el nombre y la cortinilla; cierre con los logotipos ---- */
  // Si la geometría aún no ha llegado al abrir, el mapa se monta en cuanto llegue (`montarMapa`).
  let mapaInicio = preludioMapa(f, ENT);
  const preludio = document.createElement('div');
  preludio.className = 'pres-preludio';
  preludio.setAttribute('aria-hidden', 'true');
  const palabras = f.nombre.split(' ').map((p) => `<span class="palabra">${[...p].map((l) => `<span class="letra">${esc(l)}</span>`).join('')}</span>`).join(' ');
  preludio.innerHTML = `${mapaInicio ? mapaInicio.svg : ''}<i class="pres-preludio-velo"></i>
    <div class="pres-preludio-texto"><p>${esc(R.migas)}</p><div class="pres-preludio-nombre">${palabras}</div></div>`;
  const salida = document.createElement('div');
  salida.className = 'pres-salida';
  salida.setAttribute('aria-hidden', 'true');
  // Sin dirección web: el cierre no enseña dónde está alojada la web.
  salida.innerHTML = `<div class="pres-salida-logos">${logotipos()}</div>
    <p class="pres-salida-kicker">Fichas demográficas municipales</p>
    <p class="pres-salida-nombre">${esc(f.nombre)}</p>`;
  const cortinilla = document.createElement('div');
  cortinilla.className = 'pres-cortinilla';
  cortinilla.setAttribute('aria-hidden', 'true');
  cortinilla.innerHTML = '<i></i><i></i>';
  escenario.append(preludio, salida, cortinilla);

  let camara = preludio.querySelector('.camara');
  let luces = [...preludio.querySelectorAll('path[data-isla]')];
  function montarMapa() {
    if (mapaInicio || !GEO) return;
    mapaInicio = preludioMapa(f, ENT);
    if (!mapaInicio) return;
    preludio.insertAdjacentHTML('afterbegin', mapaInicio.svg);
    camara = preludio.querySelector('.camara');
    luces = [...preludio.querySelectorAll('path[data-isla]')];
  }
  const letras = [...preludio.querySelectorAll('.letra')];
  const kickerPreludio = preludio.querySelector('p');
  const bandas = [...cortinilla.children];

  /* ---- 1. Portada y cifras clave ---- */
  const portada = {
    kicker: q(0, '.pres-kicker'), nombre: q(0, 'h1'), anio: q(0, '.pres-anio'), hab: q(0, '.pres-hab'),
    cifras: q(0, '.pres-cifras'), celdas: qa(0, '.pres-cifras > div'), logos: q(0, '.pres-logos'),
  };
  const cuentaHab = contador(q(0, '.pres-hab b'));
  const cuentasCifras = portada.celdas.map((c) => [contador(c.querySelector('b')), contador(c.querySelector('em'))]);
  const T0 = FIN_PRELUDIO + 0.15;   // la portada arranca al pasar la cortinilla

  function escenaPortada(t) {
    // El mapa: el territorio se enciende y la cámara se acerca a él.
    montarMapa();
    if (mapaInicio) {
      const z = eVaiven(avance(t, 0.15, 2.1));
      const zoom = Math.exp(Math.log(mapaInicio.zoom) * z);
      const [cx, cy] = mapaInicio.centro;
      const vx = 960 + (cx - 960) * z, vy = 540 + (cy - 540) * z;             // lo que se mira
      const sx = 960 + (1190 - 960) * z * (ENT.canarias ? 0 : 1), sy = 540 - 60 * z * (ENT.canarias ? 0 : 1);   // dónde queda en pantalla
      camara.setAttribute('transform', `translate(${(sx - vx * zoom).toFixed(2)} ${(sy - vy * zoom).toFixed(2)}) scale(${zoom.toFixed(4)})`);
      for (const l of luces) {
        const retraso = ENT.canarias ? 0.25 + Number(l.dataset.isla) * 0.16 : 0.35;
        l.setAttribute('opacity', eSalida(avance(t, retraso, 0.55)).toFixed(3));
      }
    }
    entrada(kickerPreludio, avance(t, 0.7, 0.5), { dy: 16 });
    letras.forEach((l, i) => entrada(l, avance(t, 0.85 + i * 0.028, 0.5), { dy: 70, rebote: true }));

    // La portada, como la diapositiva fija.
    entrada(portada.kicker, avance(t, T0, 0.5), { dy: 18 });
    entrada(portada.nombre, avance(t, T0 + 0.1, 0.7), { escala: 1.16, desenfoque: 6, rebote: true });
    entrada(portada.anio, avance(t, T0 + 0.35, 0.7), { dx: 90, rebote: true });
    entrada(portada.hab, avance(t, T0 + 0.5, 0.5), { dy: 18 });
    contar(cuentaHab, avance(t, T0 + 0.5, 1.7));
    portada.cifras.style.setProperty('--regla', eSalida(avance(t, T0 + 0.9, 0.9)).toFixed(4));
    portada.celdas.forEach((c, k) => {
      entrada(c, avance(t, T0 + 1.1 + k * 0.18, 0.6), { dy: 44 });
      contar(cuentasCifras[k][0], avance(t, T0 + 1.2 + k * 0.18, 1.3));
      contar(cuentasCifras[k][1], avance(t, T0 + 1.3 + k * 0.18, 1.3));
    });
    entrada(portada.logos, avance(t, T0 + 2.4, 0.8), { dy: 14 });
  }

  /* ---- 2. Evolución: la curva se dibuja y la punta dice año y habitantes ---- */
  const evo = { titulo: q(1, 'h2'), fuente: q(1, '.pres-fuente'), svg: q(1, 'svg') };
  evo.linea = evo.svg.querySelector('polyline');
  evo.area = evo.svg.querySelector('path[fill^="url("]');
  evo.final = evo.svg.querySelector(':scope > circle');
  evo.rejilla = [...evo.svg.querySelectorAll(':scope > line')];
  evo.ejes = [...evo.svg.querySelectorAll(':scope > text')];
  evo.capsula = evo.svg.querySelector(':scope > g[transform]');
  evo.capsulaBase = evo.capsula?.getAttribute('transform') || '';
  const cuentaCapsula = contador(evo.capsula?.querySelector('text'));
  const largo = evo.linea.getTotalLength();
  const vb = evo.svg.viewBox.baseVal;
  const recorte = nodoSVG('clipPath', { id: 'pres-recorte-evolucion' });
  const recorteRect = nodoSVG('rect', { x: 0, y: 0, width: 0, height: vb.height });
  recorte.append(recorteRect);
  evo.svg.prepend(recorte);
  const punta = nodoSVG('g', { 'pointer-events': 'none' });
  const puntaCirculo = nodoSVG('circle', { r: 5, fill: C.azul, stroke: '#FFFFFF', 'stroke-width': 2 });
  const puntaTexto = nodoSVG('text', { 'font-size': 11.5, 'font-weight': 700, fill: C.negro, 'text-anchor': 'end',
    stroke: '#FFFFFF', 'stroke-width': 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke fill' });
  punta.append(puntaCirculo, puntaTexto);
  evo.svg.append(punta);
  const ev = f.evolucion;
  const primerPunto = evo.linea.getPointAtLength(0), ultimoPunto = evo.linea.getPointAtLength(largo);
  const cx = +evo.final.getAttribute('cx'), cy = +evo.final.getAttribute('cy');

  function escenaEvolucion(t) {
    entrada(evo.titulo, avance(t, 0.3, 0.6), { dx: -70 });
    evo.rejilla.forEach((l, i) => fundido(l, avance(t, 0.35 + i * 0.05, 0.45)));
    evo.ejes.forEach((x, i) => fundido(x, avance(t, 0.45 + i * 0.03, 0.45)));
    const d = eVaiven(avance(t, 0.7, 2.8));
    if (d >= 1) {
      evo.linea.removeAttribute('stroke-dasharray'); evo.linea.removeAttribute('stroke-dashoffset');
      evo.area.removeAttribute('clip-path');
    } else {
      evo.linea.setAttribute('stroke-dasharray', `${largo.toFixed(1)} ${largo.toFixed(1)}`);
      evo.linea.setAttribute('stroke-dashoffset', (largo * (1 - d)).toFixed(1));
      evo.area.setAttribute('clip-path', 'url(#pres-recorte-evolucion)');
    }
    const p = evo.linea.getPointAtLength(largo * d);
    recorteRect.setAttribute('width', p.x.toFixed(1));
    // La punta dice el último año ya dibujado con su dato (nunca un valor inventado).
    const enCurso = d > 0 && d < 1;
    punta.setAttribute('opacity', enCurso ? 1 : 0);
    if (enCurso) {
      const anio = ev.anios[0] + (p.x - primerPunto.x) / (ultimoPunto.x - primerPunto.x) * (ev.anios[ev.anios.length - 1] - ev.anios[0]);
      const i = Math.max(0, ev.anios.findLastIndex((a) => a <= anio + 1e-6));
      puntaCirculo.setAttribute('cx', p.x.toFixed(1)); puntaCirculo.setAttribute('cy', p.y.toFixed(1));
      puntaTexto.setAttribute('x', (p.x - 9).toFixed(1)); puntaTexto.setAttribute('y', (p.y - 11).toFixed(1));
      puntaTexto.textContent = `${ev.anios[i]} · ${nf(ev.valores[i])}`;
    }
    const pop = avance(t, 3.5, 0.45);
    evo.final.setAttribute('transform', pop >= 1 ? '' : `translate(${cx} ${cy}) scale(${eRebote(pop).toFixed(3)}) translate(${-cx} ${-cy})`);
    if (evo.capsula) {
      const c = avance(t, 3.6, 0.55);
      evo.capsula.setAttribute('transform', c >= 1 ? evo.capsulaBase : `${evo.capsulaBase} scale(${eRebote(c).toFixed(3)})`);
      evo.capsula.setAttribute('opacity', c >= 1 ? 1 : eSalida(a01(c * 2)).toFixed(3));
      contar(cuentaCapsula, avance(t, 3.65, 1));
    }
    entrada(evo.fuente, avance(t, 1, 0.6), { dy: 12 });
  }

  /* ---- 3 y 4. La pirámide crece desde el eje y luego pasa a «según origen» ---- */
  const pir = {
    titulo: q(2, 'h2'), leyenda: q(2, '#pres-leyenda'), fuente: q(2, '#pres-fuente-pir'),
    figura: q(2, '#pres-piramide'), svg: q(2, '#pres-piramide svg'),
  };
  pir.edades = [...pir.svg.querySelectorAll(':scope > text')];
  const n = P.edades.length;
  const anchos = P.vistas.map((v) => Object.fromEntries(LADOS_PI.map(([lado, , cl]) =>
    [lado, { r: v.relleno[cl].map((x) => P.escala(x, v.eje)), n: v.negro[cl].map((x) => P.escala(x, v.eje)) }])));
  let vistaPuesta = null;
  function ponerVista(vista) {
    if (vistaPuesta === vista) return;
    vistaPuesta = vista;
    PRES.vista = vista;
    const v = P.vistas[vista];
    pir.titulo.textContent = 'Estructura de la población · ' + v.etiqueta;
    pir.fuente.textContent = textoFuente(v.clave === 'municipio' ? 'piramide_nacimiento' : 'piramide');
    PRES.eje.innerHTML = P.ejeSVG(v.eje);
    presLeyenda();
  }
  /** Las barras a la anchura de `fr(lado, k)` y los marcos a la de `fn(lado, k)`. */
  function dibujarBarras(fr, fn) {
    for (const [lado, sg] of LADOS_PI) {
      const x0 = P.centro + sg * P.hueco / 2;
      for (let k = 0; k < n; k++) {
        const aR = fr(lado, k), aN = fn(lado, k);
        const rect = PRES.nodos[lado].r[k];
        rect.setAttribute('width', Math.max(0, aR).toFixed(2));
        rect.setAttribute('x', (sg < 0 ? x0 - aR : x0).toFixed(2));
        PRES.nodos[lado].n[k].setAttribute('d', P.glifo(x0, sg, aN, P.fy(k), P.relleno, P.trazo));
        PRES.actual[lado].r[k] = aR; PRES.actual[lado].n[k] = aN;
      }
    }
  }

  function escenaPiramide(t) {
    ponerVista(0);
    entrada(pir.titulo, avance(t, 0.3, 0.6), { dx: -70 });
    const eje = avance(t, 0.35, 0.6);
    PRES.eje.style.opacity = eje >= 1 ? '' : eSalida(eje).toFixed(3);
    pir.edades.forEach((e, k) => fundido(e, avance(t, 0.4 + k * 0.03, 0.4)));
    const A = anchos[0];
    dibujarBarras((lado, k) => A[lado].r[k] * eSalida(avance(t, 0.55 + k * 0.07, 0.75)),
                  (lado, k) => A[lado].n[k] * eSalida(avance(t, 2.3 + k * 0.05, 0.6)));
    entrada(pir.leyenda, avance(t, 3.5, 0.6), { dy: 14 });
    entrada(pir.fuente, avance(t, 3.7, 0.6), { dy: 10 });
    const acercar = eSalida(avance(t, 0, DURACIONES[2]));
    pir.figura.style.transform = acercar >= 1 ? '' : `scale(${(1.05 - 0.05 * acercar).toFixed(4)})`;
  }

  function escenaOrigen(t) {
    const m = eVaiven(avance(t, 0.35, 1.2));
    ponerVista(m < 0.5 ? 0 : 1);
    const A = anchos[0], B = anchos[1];
    dibujarBarras((lado, k) => A[lado].r[k] + (B[lado].r[k] - A[lado].r[k]) * m,
                  (lado, k) => A[lado].n[k] + (B[lado].n[k] - A[lado].n[k]) * m);
    // El eje, el título, la leyenda y la fuente se cambian a mitad de la transformación.
    const visible = m >= 1 ? 1 : a01(Math.abs(2 * m - 1) * 1.4);
    PRES.eje.style.opacity = visible >= 1 ? '' : visible.toFixed(3);
    for (const e of [pir.titulo, pir.leyenda, pir.fuente]) { e.style.opacity = visible >= 1 ? '' : visible.toFixed(3); e.style.transform = ''; e.style.filter = ''; }
    pir.edades.forEach((e) => e.setAttribute('opacity', 1));
    pir.figura.style.transform = '';
  }

  /* ---- 5. Índices: los bloques entran y las barras se llenan ---- */
  const ind = { titulo: q(3, 'h2'), sub: q(3, '.pres-sub'), fuente: q(3, '.pres-fuente'), bloques: qa(3, '.indice') };
  ind.partes = ind.bloques.map((b) => [...b.querySelectorAll('.peldano, .tramo')].map((x) => ({
    barra: x.querySelector('i'), cuenta: contador(x.querySelector('b')),
  })));
  function escenaIndices(t) {
    entrada(ind.titulo, avance(t, 0.3, 0.6), { dx: -70 });
    entrada(ind.sub, avance(t, 0.45, 0.6), { dx: -40 });
    ind.bloques.forEach((b, k) => {
      entrada(b, avance(t, 0.6 + k * 0.2, 0.6), { dy: 50 });
      ind.partes[k].forEach((x, j) => {
        const p = eSalida(avance(t, 0.8 + k * 0.2 + j * 0.06, 0.8));
        x.barra.style.transformOrigin = 'left center';
        x.barra.style.transform = p >= 1 ? '' : `scaleX(${p.toFixed(4)})`;
        contar(x.cuenta, avance(t, 0.8 + k * 0.2 + j * 0.06, 1.1));
      });
    });
    entrada(ind.fuente, avance(t, 1.8, 0.6), { dy: 10 });
  }

  /* ---- 6. Lugar de nacimiento y origen extranjero; cierre con los logotipos ---- */
  const nac = { titulos: qa(4, 'h2'), fuentes: qa(4, '.pres-fuente'), leyenda: q(4, '.leyenda') };
  nac.anillos = qa(4, '.pres-anillo').map((a, k) => {
    const svg = a.querySelector('svg'), r = svg.viewBox.baseVal.width / 2;
    const medio = r - 1 - 15, circ = 2 * Math.PI * medio;   // el anillo va de r − 1 a r − 30
    const mascara = nodoSVG('mask', { id: `pres-mascara-anillo-${k}` });
    const trazo = nodoSVG('circle', { cx: r, cy: r, r: medio, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 34, transform: `rotate(-90 ${r} ${r})` });
    mascara.append(trazo);
    const grupo = nodoSVG('g');
    grupo.append(...svg.querySelectorAll('path'));
    svg.append(mascara, grupo);
    return { caja: a, titulo: a.querySelector('h3'), grupo, trazo, circ, filas: [...a.querySelectorAll('.pres-reparto > div')].map((d) => [d, contador(d.querySelector('b'))]) };
  });
  const ext = { svg: q(4, '.pres-dos > div:last-child svg') };
  ext.barras = [...ext.svg.querySelectorAll(':scope > rect')].map((r) => ({ r, y: +r.getAttribute('y'), h: +r.getAttribute('height') }));
  ext.linea = ext.svg.querySelector(':scope > polyline');
  ext.largo = ext.linea ? ext.linea.getTotalLength() : 0;
  ext.cifra = ext.svg.querySelector(':scope > text[font-weight="700"]');
  ext.cuenta = contador(ext.cifra);
  ext.ejes = [...ext.svg.querySelectorAll(':scope > text:not([font-weight="700"])')];
  ext.rejilla = [...ext.svg.querySelectorAll(':scope > line')];
  const salidaPartes = [...salida.children];

  function escenaNacimiento(t) {
    nac.titulos.forEach((h, k) => entrada(h, avance(t, 0.3 + k * 0.15, 0.6), { dx: -60 }));
    nac.anillos.forEach((a, k) => {
      entrada(a.titulo, avance(t, 0.5 + k * 0.25, 0.5), { dy: 12 });
      const d = eVaiven(avance(t, 0.6 + k * 0.25, 1.5));
      if (d >= 1) a.grupo.removeAttribute('mask');
      else { a.grupo.setAttribute('mask', `url(#pres-mascara-anillo-${k})`); a.trazo.setAttribute('stroke-dasharray', `${(a.circ * d).toFixed(2)} ${a.circ.toFixed(2)}`); }
      a.filas.forEach(([fila, c], j) => {
        entrada(fila, avance(t, 1.2 + k * 0.25 + j * 0.12, 0.5), { dx: -30 });
        contar(c, avance(t, 1.2 + k * 0.25 + j * 0.12, 1.1));
      });
    });
    ext.rejilla.forEach((l, i) => fundido(l, avance(t, 0.6 + i * 0.05, 0.4)));
    ext.ejes.forEach((x, i) => fundido(x, avance(t, 0.7 + i * 0.02, 0.4)));
    const nb = ext.barras.length;
    ext.barras.forEach(({ r, y, h }, j) => {
      const p = eSalida(avance(t, 1.3 + j * 0.06, 0.5));
      r.setAttribute('y', (y + h * (1 - p)).toFixed(1));
      r.setAttribute('height', (h * p).toFixed(1));
    });
    if (ext.linea) {
      const d = eVaiven(avance(t, 2.2 + nb * 0.03, 1.8));
      if (d >= 1) { ext.linea.removeAttribute('stroke-dasharray'); ext.linea.removeAttribute('stroke-dashoffset'); }
      else { ext.linea.setAttribute('stroke-dasharray', `${ext.largo.toFixed(1)} ${ext.largo.toFixed(1)}`); ext.linea.setAttribute('stroke-dashoffset', (ext.largo * (1 - d)).toFixed(1)); }
    }
    if (ext.cifra) {
      const c = avance(t, 1.3 + nb * 0.06 + 0.2, 0.5);
      ext.cifra.setAttribute('opacity', c >= 1 ? 1 : eSalida(a01(c * 2)).toFixed(3));
      contar(ext.cuenta, avance(t, 1.3 + nb * 0.06 + 0.2, 1));
    }
    entrada(nac.leyenda, avance(t, 4.4, 0.6), { dy: 12 });
    nac.fuentes.forEach((x, k) => entrada(x, avance(t, 4.6 + k * 0.1, 0.6), { dy: 10 }));

    // El cierre: los tres logotipos, qué es y el territorio.
    salidaPartes.forEach((x, k) => entrada(x, avance(t, FIN_DATOS + 0.3 + k * 0.18, 0.7), { dy: 30, rebote: k === 0 }));
  }

  /** Las capas que van por encima de las diapositivas dependen solo del
   *  instante: el mapa del arranque, el cierre y la barrida diagonal (dos
   *  bandas, azul claro y azul, que cruzan el escenario y lo tapan en el corte). */
  function pasarCortinilla(t) {
    preludio.style.visibility = t < FIN_PRELUDIO ? 'visible' : 'hidden';
    salida.style.visibility = t >= COMIENZOS[5] + FIN_DATOS ? 'visible' : 'hidden';
    const corte = CORTES.find((c) => Math.abs(t - c) < CORTINILLA / 2);
    cortinilla.style.visibility = corte == null ? 'hidden' : 'visible';
    if (corte == null) return;
    const qv = eVaiven((t - corte + CORTINILLA / 2) / CORTINILLA);
    bandas.forEach((b, k) => {
      const x = -3300 + 5400 * qv - k * 140;
      b.style.transform = `translateX(${x.toFixed(1)}px) skewX(-18deg)`;
    });
  }

  return { escenas: [escenaPortada, escenaEvolucion, escenaPiramide, escenaOrigen, escenaIndices, escenaNacimiento], pasarCortinilla };
}

/* ------------------------------------------------------------ reloj ------ */
const VIDEO = { t: 0, reproduciendo: false, raf: 0, marca: 0, capitulo: -1, escenas: null, pasarCortinilla: null, cont: null };

/** El fotograma del instante `t`: capítulo, escena, cortinilla y barra de progreso. */
function fotograma(t) {
  t = acotar(t, 0, DURACION);
  VIDEO.t = t;
  let k = COMIENZOS.length - 1;
  while (k > 0 && t < COMIENZOS[k]) k--;
  const nuevo = k !== VIDEO.capitulo;
  if (nuevo) cambiarCapitulo(k);
  VIDEO.escenas[k](t - COMIENZOS[k]);
  if (nuevo) anunciarCapitulo(k);
  // La cámara se acerca despacio durante el capítulo (la pirámide lleva su propio acercamiento).
  const diapo = VIDEO.cont.querySelector('.pres-diapo.activa');
  const desde = k === 0 ? FIN_PRELUDIO : 0;
  const empuje = k === 2 || k === 3 ? 0 : EMPUJE * a01((t - COMIENZOS[k] - desde) / (DURACIONES[k] - desde));
  diapo.style.transform = empuje ? `scale(${(1 + empuje).toFixed(5)})` : '';
  VIDEO.pasarCortinilla(t);
  VIDEO.cont.querySelectorAll('.pres-barra b').forEach((b, j) => {
    b.style.transform = `scaleX(${a01((t - COMIENZOS[j]) / DURACIONES[j]).toFixed(4)})`;
  });
  botonVideo();   // al llegar al final, también buscando a mano, el botón dice «Volver a ver»
}

/** Como `presIr` en las diapositivas fijas: capa visible, contador y aviso. */
function cambiarCapitulo(k) {
  VIDEO.capitulo = k;
  PRES.paso = k + 1;
  const capa = PRES_CAPA[k];
  VIDEO.cont.querySelectorAll('.pres-diapo').forEach((d, j) => { d.classList.toggle('activa', j === capa); d.style.transform = ''; });
  document.getElementById('pres-contador').textContent = `${k + 1} / 6`;
  if (PRES.fila != null) { PRES.fila = null; presSenalar(); }
}
/** El aviso para el lector de pantalla, con el título que ya ha puesto la escena
 *  (en la pirámide, el de su vista). */
function anunciarCapitulo(k) {
  // La pirámide pasa a «según origen» a mitad del capítulo 4: se anuncia ya con su título.
  const titulo = k === 3 ? 'Estructura de la población · ' + PRES.P.vistas[1].etiqueta
    : VIDEO.cont.querySelector('.pres-diapo.activa h1, .pres-diapo.activa h2')?.textContent || '';
  document.getElementById('pres-anuncio').textContent = `Diapositiva ${k + 1} de 6: ${titulo}`;
}

function bucle(ahora) {
  if (!VIDEO.reproduciendo) return;
  const dt = Math.min(0.1, (ahora - VIDEO.marca) / 1000);   // tras una pestaña oculta no salta
  VIDEO.marca = ahora;
  fotograma(VIDEO.t + dt);
  if (VIDEO.t >= DURACION) { pausarVideo(); return; }
  VIDEO.raf = requestAnimationFrame(bucle);
}

function reproducirVideo() {
  if (VIDEO.t >= DURACION - 1e-3) fotograma(0);
  if (PRES.fila != null) { PRES.fila = null; presSenalar(); }
  VIDEO.reproduciendo = true;
  VIDEO.marca = performance.now();
  cancelAnimationFrame(VIDEO.raf);
  VIDEO.raf = requestAnimationFrame(bucle);
  botonVideo();
}
function pausarVideo() {
  VIDEO.reproduciendo = false;
  cancelAnimationFrame(VIDEO.raf);
  botonVideo();
}
const alternarVideo = () => (VIDEO.reproduciendo ? pausarVideo() : reproducirVideo());

function botonVideo() {
  const b = VIDEO.cont?.querySelector('.pres-play');
  if (!b) return;
  const fin = !VIDEO.reproduciendo && VIDEO.t >= DURACION - 1e-3;
  const etiqueta = VIDEO.reproduciendo ? 'Pausar' : fin ? 'Volver a ver' : 'Reproducir';
  if (b.getAttribute('aria-label') === etiqueta) return;
  b.setAttribute('aria-label', etiqueta);
  b.innerHTML = VIDEO.reproduciendo
    ? '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor"/><rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor"/></svg>'
    : fin ? '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M15.5 10a5.5 5.5 0 1 1-1.6-3.9M14.5 3v3.6h-3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6.5 4.2v11.6L15.8 10z" fill="currentColor"/></svg>';
}

/** Hasta dónde se ve un capítulo completo, antes de que llegue la barrida del
 *  siguiente (en el último, antes del cierre). */
const finCapitulo = (k) => (k === DURACIONES.length - 1 ? COMIENZOS[k] + FIN_DATOS : COMIENZOS[k] + DURACIONES[k]) - CORTINILLA / 2 - 0.05;

/** Ir a un capítulo (las flechas y las zonas laterales): reproduciendo, desde su
 *  comienzo, con la barrida; en pausa, ya completo. */
function videoIr(paso) {
  const k = acotar(paso, 1, 6) - 1;
  fotograma(VIDEO.reproduciendo ? COMIENZOS[k] : finCapitulo(k));
}
/** Recorrer la pirámide con ↑ ↓: el vídeo se para con el capítulo completo. */
function videoQuieto() {
  if (VIDEO.reproduciendo) pausarVideo();
  const k = VIDEO.capitulo;
  if (VIDEO.t < finCapitulo(k) - 0.01) fotograma(finCapitulo(k));
}

/** Arranca el vídeo sobre la presentación recién montada (ficha.js, `abrirPresentacion`). */
function iniciarVideo(cont) {
  VIDEO.cont = cont;
  VIDEO.capitulo = -1;
  Object.assign(VIDEO, prepararEscenas(cont));
  cont.classList.add('video');
  const controles = document.createElement('div');
  controles.className = 'pres-controles';
  controles.innerHTML = `<button class="pres-play" type="button"></button>
    <span class="pres-barra" aria-hidden="true">${DURACIONES.map(() => '<i><b></b></i>').join('')}</span>`;
  cont.append(controles);
  controles.querySelector('.pres-play').addEventListener('click', alternarVideo);
  // Un clic en el centro del escenario también pausa y reanuda (los lados cambian de capítulo).
  cont.querySelector('.pres-escenario').addEventListener('click', alternarVideo);
  PRES.eje.style.transition = 'none';
  PRES.video = { buscar: (t) => fotograma(t), pausar: pausarVideo, reproducir: reproducirVideo, duracion: DURACION, comienzos: COMIENZOS };
  fotograma(0);
  reproducirVideo();
}
function detenerVideo() {
  pausarVideo();
  // Las escenas guardan los nodos de la presentación cerrada: se sueltan.
  Object.assign(VIDEO, { cont: null, escenas: null, pasarCortinilla: null, capitulo: -1, t: 0 });
  PRES.video = null;
}

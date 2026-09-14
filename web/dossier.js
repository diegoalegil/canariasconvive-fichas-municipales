/* Dossier: las 88 fichas en un solo documento A4 (portada, guía de uso, índice,
   un separador por isla y una hoja por municipio), con los gráficos de ficha.js
   a medida de hoja. El orden es el de indice.json: islas de oeste a este y
   municipios por orden alfabético. */

let IDX = null, GEOD = null;
// La dirección de la guía, en la cabecera de cada hoja y en la guía del dossier (sin protocolo, para teclearla).
const DIRECCION_GUIA = new URL('guia.html', URL_PUBLICA_SITIO).href.replace(/^https?:\/\//, '');

/* ------------------------------------------------------- datos por isla --- */
/** Recuentos de la isla; el envejecimiento insular viene dentro de cada ficha.
 *  Sin edad media: no hay serie insular y promediar las municipales no es un dato. */
function resumenIsla(nombre, fichas) {
  const suyas = fichas.filter((f) => f.isla === nombre);
  const hab = suyas.reduce((a, f) => a + f.poblacion, 0);
  return {
    nombre, n: suyas.length, habitantes: hab,
    peso: hab / IDX.poblacion_canarias * 100,
    envejecimiento: suyas[0].indices.C10.isla,
    fichas: suyas,
  };
}

/* ----------------------------------------------------------- una ficha ---- */
function hojaFicha(f, pagina) {
  const wEv = anchoHoja(7), wEx = anchoHoja(5), wPi = anchoHoja(7), wCo = anchoHoja(6);
  const wMapa = Math.floor((anchoHoja(12) - 2 * mm(4)) / 3);
  const ev = f.evolucion;
  const niveles = nivelesMapas(f);
  const anom = f.componentes.anomalias || [];
  const piramide = construirPiramide(f.piramide, wPi, ALTO_PIRAMIDE_A4, 0);   // la misma que la ficha suelta impresa

  return `<article class="hoja hoja-ficha" data-pagina="${pagina}">
    <header class="d-cab">
      <p class="d-migas">${esc([f.isla, comarcaDe(f)].filter(Boolean).join(' · '))}</p>
      <div class="d-titular"><h2>${esc(f.nombre)}</h2><span class="d-anio">${f.anio}</span></div>
      <p class="d-hab"><b>${nf(f.poblacion)}</b><span>habitantes</span></p>
      <p class="pie-fuentes-papel">Método, fechas y enlace a cada recurso estadístico: ${esc(DIRECCION_GUIA)}</p>
    </header>

    <div class="cifras">${cifrasClave(f)}</div>

    <div class="rejilla">
      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('variacion', 13)}<div><h2>Evolución de la población</h2>
          <p>Habitantes, ${ev.anios[0]}–${ev.anios[ev.anios.length - 1]}</p></div></header>
        <div class="cuerpo"><figure>${graficoEvolucion(ev, wEv, mm(30), '-' + f.codmun)}</figure>${fuenteGrafico('evolucion')}</div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('extranjero', 13)}<div><h2>Origen extranjero</h2>
          <p>Porcentaje sobre el total</p></div></header>
        <div class="cuerpo"><figure>${graficoExtranjero(f.extranjero, wEx, mm(26))}</figure>
          <div class="leyenda">${leyendaExtranjero(f, 2)}</div>${fuenteGrafico('extranjero')}</div>
      </section>

      <section class="tarjeta">
        <header class="rotulo">${icono('territorio', 13)}<div><h2>El municipio en su entorno</h2>
          <p>Su puesto por población y el peso que tiene en cada ámbito</p></div></header>
        <div class="cuerpo"><div class="mapas${niveles.length === 2 ? ' dos' : ''}">
          ${niveles.map(([tit, filtro, r, lim]) => `
            <figure class="mapa">${mapa(GEOD, f.codmun, filtro, wMapa, mm(20), lim)}
              <figcaption class="mapa-pie"><b>${r.puesto}º de ${r.total}</b>
                <span>${esc(tit)}</span>
                <p><b>${nf(r.peso, 2)} %</b> <span>de su población</span></p></figcaption></figure>`).join('')}
        </div>${fuenteGrafico('mapas')}</div>
      </section>

      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('edad', 13)}<div><h2>Estructura de la población</h2></div></header>
        <div class="cuerpo"><figure>${piramide.svg}</figure>
          <div class="leyenda">${leyendaPiramide(piramide.vistas[0])}</div>${fuenteGrafico('piramide')}</div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('dependencia', 13)}<div><h2>Información geodemográfica</h2>
          <p>Los tres ámbitos, de menor a mayor valor</p></div></header>
        <div class="cuerpo">${bloqueIndices(f.indices, INDICES_FICHA)}${fuenteGrafico('indices')}</div>
      </section>

      <section class="tarjeta mitad">
        <header class="rotulo">${icono('relevo', 13)}<div><h2>Componentes del cambio poblacional</h2></div></header>
        <div class="cuerpo"><figure>${graficoComponentes(f.componentes, wCo, mm(anom.length ? 21 : 24))}</figure>
          <div class="leyenda">
            <span><i class="llave" style="background:#85B7EB"></i>Crecimiento vegetativo</span>
            <span><i class="llave" style="background:#185FA5"></i>Saldo migratorio</span>
          </div>
          ${anom.length ? `<p class="nota">${notaAnomalias(anom)}</p>` : ''}
          ${fuenteGrafico('componentes')}
        </div>
      </section>

      <section class="tarjeta mitad">
        <header class="rotulo">${icono('nacimiento', 13)}<div><h2>Lugar de nacimiento</h2>
          <p>De cada cien habitantes, dónde nacieron</p></div></header>
        <div class="cuerpo"><div class="anillos">
          ${[['Municipio', f.origen.municipio], ['Canarias', f.origen.canarias]].map(([t, v]) => `
            <div class="anillo"><h3>${t}</h3>${anilloOrigen(v, 30, 13)}
              <div class="reparto">${f.origen.categorias.map((cat, i) =>
                `<div><i style="background:${TONOS_ORIGEN[i]}"></i><span>${esc(cat)}</span><b>${nf(v[i], 1)}\u00a0%</b></div>`).join('')}
              </div></div>`).join('')}
        </div>${fuenteGrafico('nacimiento')}</div>
      </section>
    </div>

    <footer class="d-pie"><span>Canarias Convive · Fichas demográficas municipales</span><span>${pagina}</span></footer>
  </article>`;
}

/* --------------------------------------------------------- hojas fijas ---- */
function hojaPortada() {
  return `<article class="hoja hoja-portada">
    <div class="d-marca">Gobierno de Canarias · Universidad de La Laguna</div>
    <h1>Fichas demográficas<br>municipales de Canarias</h1>
    <p class="d-lede">Una ficha por cada uno de los 88 municipios del archipiélago:
      estructura de la población, evolución, índices geodemográficos y lugar de nacimiento.</p>
    <div class="d-portada-mapa">${mapaArchipielago()}</div>
    <div class="d-portada-pie">
      <div><b>${IDX.anio}</b><span>Población a 1 de enero</span></div>
      <div><b>${nf(IDX.poblacion_canarias)}</b><span>Habitantes</span></div>
      <div><b>88</b><span>Municipios · 7 islas</span></div>
    </div>
  </article>`;
}

function mapaArchipielago() {
  return mapa(GEOD, null, () => true, mm(174), mm(78), false);
}

/** Las definiciones son las de la guía en línea (INDICADORES, guia.js). */
function hojaGuia(fichas, pagina) {
  const anios = ['vegetativo', 'migratorio'].flatMap((clave) => fichas.flatMap((f) =>
    f.componentes.anios.filter((a, i) => f.componentes[clave][i] != null)));
  const anioComp = anios.length ? Math.max(...anios) : IDX.anio - 1;
  // Los organismos de los enlaces del índice (ISTAC, INE) más GRAFCAN, que firma los mapas.
  const organismos = [...new Set(Object.values(IDX.fuentes_indicadores || {})
    .flatMap((x) => (x.enlaces || []).map((e) => e.organismo)).filter(Boolean))];
  if (!organismos.includes('GRAFCAN')) organismos.push('GRAFCAN');
  const listaOrganismos = organismos.length > 1
    ? `${organismos.slice(0, -1).join(', ')} y ${organismos[organismos.length - 1]}` : organismos.join('');
  // Partida solo en las barras: un guion al final de línea se teclearía mal desde el papel.
  const guia = DIRECCION_GUIA.split('/').map((t) => `<span style="white-space:nowrap">${esc(t)}</span>`).join('/');
  const definicion = (x) => `<p><b>${esc(x.nombre)}.</b> ${esc(x.mide)}${x.unidad ? ` ${esc(x.unidad)}.` : ''}</p>`;
  return `<article class="hoja hoja-texto">
    <h2 class="d-titulo">Cómo usar este dossier</h2>
    <div class="d-cols">
      <div>
        <h3>El orden</h3>
        <p>Las 88 fichas van en el mismo orden que la portada y los selectores de la web: las
           islas de oeste a este y, dentro de cada isla, los municipios por orden alfabético.
           Cada municipio ocupa una hoja, y antes de cada grupo hay un separador con el
           conjunto de la isla.</p>
        <h3>Los datos</h3>
        <p>Población a 1 de enero de ${IDX.anio}. Las series de crecimiento
           vegetativo y saldo migratorio llegan hasta ${anioComp}, que es el último año cerrado.
           Las cifras de origen extranjero y de lugar de nacimiento cuentan dónde nació cada
           persona, con independencia de su nacionalidad.</p>
        <h3>Las fuentes</h3>
        <p>${esc(listaOrganismos)}. El enlace a cada recurso estadístico, con los años
           que cubre y la fecha del dato, está en la guía en línea de cada indicador:
           <b>${guia}</b></p>
      </div>
      <div>
        <h3>Qué mide cada indicador</h3>
        ${INDICADORES.map(definicion).join('')}
      </div>
    </div>
    <footer class="d-pie"><span>Canarias Convive · Fichas demográficas municipales</span><span>${pagina}</span></footer>
  </article>`;
}

function hojaIndice(grupos, pagina) {
  return `<article class="hoja hoja-texto">
    <h2 class="d-titulo">Índice de municipios</h2>
    <p class="d-sub">88 municipios · 7 islas · orden alfabético dentro de cada isla</p>
    <div class="d-indice">
      ${grupos.map((g) => `
        <div class="d-indice-grupo">
          <h3>${esc(g.nombre)} <em>separador ${g.paginaSeparador}</em></h3>
          ${g.fichas.map((f, i) => `<div><span>${esc(f.nombre)}</span><b>${g.paginaPrimera + i}</b></div>`).join('')}
        </div>`).join('')}
    </div>
    <footer class="d-pie"><span>Canarias Convive · Fichas demográficas municipales</span><span>${pagina}</span></footer>
  </article>`;
}

function hojaSeparador(g) {
  return `<article class="hoja hoja-separador">
    <p class="d-migas">Isla</p>
    <h2>${esc(g.nombre)}</h2>
    <p class="d-sub">${g.n} municipios · fichas ${g.paginaPrimera} a ${g.paginaPrimera + g.n - 1}</p>
    <div class="d-isla-datos">
      <div><b>${nf(g.habitantes)}</b><span>Habitantes en ${IDX.anio}</span></div>
      <div><b>${g.n}</b><span>Municipios</span></div>
      <div><b>${nf(g.peso, 1)} %</b><span>De la población de Canarias</span></div>
      <div><b>${nf(g.envejecimiento, 2)}</b><span>Envejecimiento de la isla</span></div>
    </div>
    <div class="d-isla-mapa">${mapa(GEOD, null, (x) => x.properties.isla === g.nombre, mm(120), mm(62), true)}</div>
    <div class="d-isla-lista">${g.fichas.map((f, i) =>
      `<span>${esc(f.nombre)} <em>${g.paginaPrimera + i}</em></span>`).join('')}</div>
    <footer class="d-pie"><span>Canarias Convive · ${esc(g.nombre)}</span><span>${g.paginaSeparador}</span></footer>
  </article>`;
}

/* ------------------------------------------------- reglas de la hoja ------ */
/** Copia el bloque @media print de estilos.css como reglas normales acotadas a
 *  .d-body .hoja: la vista previa del dossier es la ficha impresa. */
function traerReglasDeImpresion() {
  const salida = [];
  for (const hoja of document.styleSheets) {
    if (!hoja.href || !new URL(hoja.href).pathname.endsWith('/estilos.css')) continue;
    let reglas;
    try { reglas = hoja.cssRules; } catch { continue; }   // hoja de otro origen
    for (const r of reglas) {
      if (r.type !== CSSRule.MEDIA_RULE) continue;
      if (!/\bprint\b/.test(r.conditionText || '')) continue;
      if (/screen/.test(r.conditionText || '')) continue;
      for (const s of r.cssRules) {
        if (!s.selectorText) { salida.push(s.cssText); continue; }
        const sel = s.selectorText.split(',')
          .map((x) => `.d-body .hoja ${x.trim()}`).join(', ');
        salida.push(`${sel} { ${s.style.cssText} }`);
      }
    }
  }
  const est = document.createElement('style');
  est.id = 'reglas-hoja';
  est.textContent = salida.join('\n');
  document.head.appendChild(est);
  return salida.length;
}

/* --------------------------------------------------------------- montaje -- */
/** Las 88 fichas en paralelo; lo que falle se vuelve a pedir hasta dos veces
 *  antes de darse por vencido, sin tirar lo que ya llegó. */
async function leerFichas(codigos) {
  const fichas = new Map();
  let pendientes = codigos;
  for (let intento = 0; intento < 3 && pendientes.length; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, 800 * intento));
    const resultados = await Promise.allSettled(pendientes.map((c) => leerJSON(`datos/mun/${c}.json`)));
    pendientes = pendientes.filter((c, i) => {
      if (resultados[i].status === 'fulfilled') fichas.set(c, resultados[i].value);
      return resultados[i].status !== 'fulfilled';
    });
  }
  if (pendientes.length) throw new Error(`no se han podido leer ${pendientes.length} fichas`);
  return codigos.map((c) => fichas.get(c));
}

async function iniciarDossier() {
  modoHoja(true);
  const n = traerReglasDeImpresion();
  if (!n) throw new Error('no se han encontrado las reglas de impresión de estilos.css');
  const aviso = document.getElementById('d-aviso');

  [IDX, GEOD] = await Promise.all([
    leerJSON('datos/indice.json'),
    leerJSON('datos/geo/municipios.json'),
  ]);

  aviso.textContent = `Cargando las ${IDX.municipios.length} fichas…`;
  const fichas = await leerFichas(IDX.municipios.map((m) => m.codmun));

  // Orden: el de indice.json (islas de oeste a este), municipios por orden alfabético.
  const grupos = Object.keys(IDX.islas).map((isla) => {
    const g = resumenIsla(isla, fichas);
    g.fichas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return g;
  });

  // Numeración: 1 portada, 2 guía, 3 índice, y luego separador + fichas.
  let p = 4;
  for (const g of grupos) { g.paginaSeparador = p++; g.paginaPrimera = p; p += g.n; }

  aviso.textContent = 'Componiendo las hojas…';
  const partes = [hojaPortada(), hojaGuia(fichas, 2), hojaIndice(grupos, 3)];
  for (const g of grupos) {
    partes.push(hojaSeparador(g));
    g.fichas.forEach((f, i) => partes.push(hojaFicha(f, g.paginaPrimera + i)));
  }

  const principal = document.getElementById('dossier');
  principal.innerHTML = partes.join('');
  aviso.remove();
  document.getElementById('d-barra').hidden = false;
  document.getElementById('d-total').textContent = `${partes.length} hojas`;
  // En pantallas estrechas la hoja desborda de lado: el contenedor se hace enfocable para desplazarlo con las flechas.
  const enfocable = () => {
    if (principal.scrollWidth > principal.clientWidth + 1) principal.tabIndex = 0; else principal.removeAttribute('tabindex');
  };
  enfocable();
  addEventListener('resize', enfocable);
}

iniciarDossier().catch((e) => {
  avisoCarga('d-aviso', 'No se ha podido componer el dossier.', () => location.reload());
  console.error(e);
});

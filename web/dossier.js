/* =============================================================================
   DOSSIER IMPRIMIBLE · CANARIAS CONVIVE

   Las 88 fichas en un solo documento A4: portada, guía de uso, índice con
   páginas, un separador por isla y una hoja por municipio.

   Reutiliza los gráficos de ficha.js —el mismo código que dibuja la ficha en
   pantalla y en la hoja suelta— para que no haya dos versiones que mantener.
   ficha.js solo arranca solo si encuentra el selector de municipio, que aquí
   no existe.

   El orden es el de indice.json, el mismo que en la portada y los selectores:
   las islas de oeste a este y, dentro de cada una, los municipios por orden
   alfabético.
   ============================================================================= */

/* Anchos de hoja, los mismos que usa la ficha al imprimir. */
const HOJA_MM = 190;
const px = (mm) => Math.round(mm * 96 / 25.4);

let IDX = null, GEOD = null;


/* ------------------------------------------------------- datos por isla --- */
/** Lo que se puede decir de una isla sin inventar nada.
 *
 *  Habitantes y municipios son recuentos exactos. El peso sobre Canarias, una
 *  división. Envejecimiento sale de la hoja insular de Pedro, que viene dentro
 *  de cada ficha. La edad media de la isla NO se calcula aquí: no hay serie
 *  insular en los datos exportados, y promediar las medias municipales daría un
 *  número que no es el de nadie. */
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
  const anchoHojaPx = (cols) => {
    const col = (HOJA_MM - 11 * 2) / 12;
    return Math.round((col * cols + 2 * (cols - 1) - 6) * 96 / 25.4);
  };
  const wEv = anchoHojaPx(7), wEx = anchoHojaPx(5), wPi = anchoHojaPx(7), wCo = anchoHojaPx(6);
  const wMapa = Math.floor((anchoHojaPx(12) - 2 * px(4)) / 3);
  const c = f.cifras, ev = f.evolucion;
  const signo = c.tvma >= 0 ? '+' : '−';

  const niveles = nivelesMapas(f);   // en ficha.js; «en la comarca» y sin tercer mapa en El Hierro

  const anom = f.componentes.anomalias || [];

  return `<article class="hoja hoja-ficha" data-pagina="${pagina}">
    <header class="d-cab">
      <p class="d-migas">${esc([f.isla, comarcaDe(f)].filter(Boolean).join(' · '))}</p>
      <div class="d-titular"><h2>${esc(f.nombre)}</h2><span class="d-anio">${f.anio}</span></div>
      <p class="d-hab"><b>${nf(f.poblacion)}</b><span>habitantes</span></p>
    </header>

    <div class="cifras">
      ${[[`${signo}${nf(Math.abs(c.tvma), 1)}`, '%', 'Variación media anual', `${ev.anio_base}–${ev.anio_fin}`],
         [nf(c.edad_media, 1), 'años', 'Edad media', ''],
         [nf(c.pct_mujeres, 1), '%', 'Mujeres', `${nf(c.mujeres)} personas`],
         [nf(c.pct_hombres, 1), '%', 'Hombres', `${nf(c.hombres)} personas`],
        ].map(([cifra, uni, rot, pie]) => `
        <div class="cifra">
          <b>${cifra}${uni ? `<span>\u00a0${uni}</span>` : ''}</b>
          <i>${rot}</i>
          <em>${pie}</em>
        </div>`).join('')}
    </div>

    <div class="rejilla">
      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('variacion', 13)}<div><h2>Evolución de la población</h2>
          <p>Habitantes, ${ev.anios[0]}–${ev.anios[ev.anios.length - 1]}</p></div></header>
        <div class="cuerpo"><figure>${graficoEvolucion(ev, wEv, px(30), '-' + f.codmun)}</figure>${fuenteGrafico('evolucion')}</div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('extranjero', 13)}<div><h2>Origen extranjero</h2>
          <p>Porcentaje sobre el total</p></div></header>
        <div class="cuerpo"><figure>${graficoExtranjero(f.extranjero, wEx, px(26))}</figure>
          <div class="leyenda">
            <span><i class="llave" style="background:#1A1A1A;height:2px;border-radius:0"></i>Canarias <b>${nf(ultimoValido(f.extranjero.canarias), 1)} %</b></span>
          </div>${fuenteGrafico('extranjero')}</div>
      </section>

      <section class="tarjeta">
        <header class="rotulo">${icono('territorio', 13)}<div><h2>El municipio en su entorno</h2>
          <p>Su puesto por población y el peso que tiene en cada ámbito</p></div></header>
        <div class="cuerpo"><div class="mapas${niveles.length === 2 ? ' dos' : ''}">
          ${niveles.map(([tit, filtro, r, lim]) => `
            <figure class="mapa">${mapa(GEOD, f.codmun, filtro, wMapa, px(20), lim)}
              <figcaption class="mapa-pie"><b>${r.puesto}º de ${r.total}</b>
                <span>${esc(tit)}</span>
                <p><b>${nf(r.peso, 2)} %</b> <span>de su población</span></p></figcaption></figure>`).join('')}
        </div>${fuenteGrafico('mapas')}</div>
      </section>

      <!-- La piramide mide 65,5 mm, la misma altura que tenia cuando iba 11,5 mm
           mas alta que en la ficha suelta: la ficha ha crecido diez al retirar
           la lectura de debajo y la hoja del dossier no puede crecer (293,7 mm
           de 297 medidos con esta altura). -->
      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('edad', 13)}<div><h2>Estructura de la población</h2></div></header>
        <div class="cuerpo"><figure>${construirPiramide(f.piramide, wPi, ALTO_PIRAMIDE_A4 + px(1.5), 0).svg}</figure>
          <!-- La leyenda dice lo que la hoja dibuja. Antes anunciaba un Canarias
               que la pirámide no llegaba a pintar; ahora Canarias está, en
               barras negras huecas. -->
          <div class="leyenda">
            <span><i class="llave" style="background:#2E75B6"></i>Hombres</span>
            <span><i class="llave" style="background:#85B7EB"></i>Mujeres</span>
            <span><i class="llave hueca"></i>Canarias</span>
          </div>${fuenteGrafico('piramide')}</div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('dependencia', 13)}<div><h2>Información geodemográfica</h2>
          <p>Los tres ámbitos, de menor a mayor valor</p></div></header>
        <div class="cuerpo">${bloqueIndices(f.indices, ['C10', 'C11', 'C17', 'C14'])}${fuenteGrafico('indices')}</div>
      </section>

      <section class="tarjeta mitad">
        <header class="rotulo">${icono('relevo', 13)}<div><h2>Componentes del cambio poblacional</h2></div></header>
        <div class="cuerpo"><figure>${graficoComponentes(f.componentes, wCo, px(anom.length ? 21 : 24))}</figure>
          <div class="leyenda">
            <span><i class="llave" style="background:#85B7EB"></i>Crecimiento vegetativo</span>
            <span><i class="llave" style="background:#185FA5"></i>Saldo migratorio</span>
          </div>
          ${anom.length ? `<p class="nota">${anom.map((a) =>
            `En ${a.anio} no se representa el saldo migratorio (${nf(a.valor)}): corresponde a un ${a.motivo}.`).join(' ')}</p>` : ''}
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
  return mapa(GEOD, null, () => true, px(174), px(78), false);
}

/* Las definiciones son las mismas de la guía en línea (INDICADORES, guia.js):
   escritas aquí aparte se quedaban cortas y viejas. Las fuentes con enlace
   están en la guía en línea; el papel lleva su dirección. */
function hojaGuia(fichas) {
  const anios = ['vegetativo', 'migratorio'].flatMap((clave) => fichas.flatMap((f) =>
    f.componentes.anios.filter((a, i) => f.componentes[clave][i] != null)));
  const anioComp = anios.length ? Math.max(...anios) : IDX.anio - 1;
  /* Los organismos de los enlaces del índice (ISTAC, INE) más GRAFCAN, que no
     tiene enlace estadístico pero firma los límites municipales de los mapas
     (es la fuente que Pedro dictó para ellos). */
  const organismos = [...new Set(Object.values(IDX.fuentes_indicadores || {})
    .flatMap((x) => (x.enlaces || []).map((e) => e.organismo)).filter(Boolean))];
  if (!organismos.includes('GRAFCAN')) organismos.push('GRAFCAN');
  const listaOrganismos = organismos.length > 1
    ? `${organismos.slice(0, -1).join(', ')} y ${organismos[organismos.length - 1]}` : organismos.join('');
  // Partida solo en las barras, nunca en los guiones: un guion al final de
  // línea se lee como silabeo y se teclearía mal desde el papel.
  const guia = new URL('guia.html', URL_PUBLICA_SITIO).href.replace(/^https?:\/\//, '')
    .split('/').map((t) => `<span style="white-space:nowrap">${esc(t)}</span>`).join('/');
  const definicion = (x) => `<p><b>${esc(x.nombre.replace(/^Índice de /, (s) => s))}.</b> ${esc(x.mide)}${x.unidad ? ` ${esc(x.unidad)}.` : ''}</p>`;
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
    <footer class="d-pie"><span>Canarias Convive · Fichas demográficas municipales</span><span>2</span></footer>
  </article>`;
}

function hojaIndice(grupos) {
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
    <footer class="d-pie"><span>Canarias Convive · Fichas demográficas municipales</span><span>3</span></footer>
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
    <div class="d-isla-mapa">${mapa(GEOD, null, (x) => x.properties.isla === g.nombre, px(120), px(62), true)}</div>
    <div class="d-isla-lista">${g.fichas.map((f, i) =>
      `<span>${esc(f.nombre)} <em>${g.paginaPrimera + i}</em></span>`).join('')}</div>
    <footer class="d-pie"><span>Canarias Convive · ${esc(g.nombre)}</span><span>${g.paginaSeparador}</span></footer>
  </article>`;
}

/* ------------------------------------------------- reglas de la hoja ------ */
/** Copia el bloque @media print de estilos.css como reglas normales, acotadas a
 *  .d-body. Así la vista previa del dossier es exactamente la ficha impresa, y
 *  no hay dos juegos de reglas que se separen a la primera corrección. */
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
  const fichas = await Promise.all(IDX.municipios.map((m) =>
    leerJSON(`datos/mun/${m.codmun}.json`)));

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
  const partes = [hojaPortada(), hojaGuia(fichas), hojaIndice(grupos)];
  for (const g of grupos) {
    partes.push(hojaSeparador(g));
    g.fichas.forEach((f, i) => partes.push(hojaFicha(f, g.paginaPrimera + i)));
  }

  document.getElementById('dossier').innerHTML = partes.join('');
  aviso.remove();
  document.getElementById('d-barra').hidden = false;
  document.getElementById('d-total').textContent = `${partes.length} hojas`;
}

iniciarDossier().catch((e) => {
  avisoCarga('d-aviso', 'No se ha podido componer el dossier.', () => location.reload());
  console.error(e);
});

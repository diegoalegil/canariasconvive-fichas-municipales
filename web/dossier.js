/* =============================================================================
   DOSSIER IMPRIMIBLE · CANARIAS CONVIVE

   Las 88 fichas en un solo documento A4: portada, guía de uso, índice con
   páginas, un separador por isla y una hoja por municipio.

   Reutiliza los gráficos de ficha.js —el mismo código que dibuja la ficha en
   pantalla y en la hoja suelta— para que no haya dos versiones que mantener.
   ficha.js solo arranca solo si encuentra el selector de municipio, que aquí
   no existe.

   El orden es el mismo que el del visor: las islas de oeste a este y, dentro de
   cada una, los municipios por orden alfabético.
   ============================================================================= */

const ISLAS_OESTE_ESTE = ['El Hierro', 'La Palma', 'La Gomera', 'Tenerife',
                          'Gran Canaria', 'Fuerteventura', 'Lanzarote'];

/* Anchos de hoja, los mismos que usa la ficha al imprimir. */
const HOJA_MM = 190;
const px = (mm) => Math.round(mm * 96 / 25.4);

let IDX = null, GEOD = null;

const nfd = (v, d = 0) => v == null || !isFinite(v)
  ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const escd = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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

  const niveles = [
    ['Canarias', () => true, f.rankings.canarias, false],
    [f.isla, (g) => g.properties.isla === f.isla, f.rankings.isla, true],
    [f.comarca.replace(/^.*? - /, ''), (g) => g.properties.comarca === f.comarca, f.rankings.comarca, true],
  ];

  const anom = f.componentes.anomalias || [];

  return `<article class="hoja hoja-ficha" data-pagina="${pagina}">
    <header class="d-cab">
      <div>
        <p class="d-migas">${escd(f.isla)} · ${escd(f.comarca.replace(/^.*? - /, ''))}</p>
        <h2>${escd(f.nombre)} <span>${f.anio}</span></h2>
      </div>
      <div class="d-hab"><b>${nfd(f.poblacion)}</b><span>Habitantes · ${f.anio}</span></div>
    </header>

    <div class="cifras">
      ${[['variacion', `${signo}${nfd(Math.abs(c.tvma), 1)}`, '%', 'Variación media anual',
          chispa(ev.anios, ev.valores, ev.anio_base, anchoCelda(), px(5)), `<em>${ev.anio_base}–${ev.anio_fin}</em>`],
         ['edad', nfd(c.edad_media, 1), '', 'Edad media',
          barraEdad(c.edad_media, anchoCelda(), px(5)), `<em class="entre"><span>0</span><span>0–100 años</span><span>100</span></em>`],
         ['mujeres', nfd(c.pct_mujeres, 1), '%', 'Mujeres',
          puntos(c.pct_mujeres, C.azul), `<em>${nfd(c.mujeres)} personas</em>`],
         ['hombres', nfd(c.pct_hombres, 1), '%', 'Hombres',
          puntos(c.pct_hombres, C.azulMedio), `<em>${nfd(c.hombres)} personas</em>`],
        ].map(([ico, cifra, uni, rot, viz, pie]) => `
        <div class="cifra">
          <div class="cifra-dato">
            <b>${cifra}${uni ? `<span>${uni}</span>` : ''}</b>
            <i>${icono(ico, 12)}${rot}</i>
          </div>
          <div class="cifra-viz">${viz}</div>
          ${pie}
        </div>`).join('')}
    </div>

    <div class="rejilla">
      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('variacion', 13)}<div><h2>Evolución de la población</h2>
          <p>Habitantes, ${ev.anios[0]}–${ev.anios[ev.anios.length - 1]}</p></div></header>
        <div class="cuerpo"><figure>${graficoEvolucion(ev, wEv, px(30), '-' + f.codmun)}</figure></div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('extranjero', 13)}<div><h2>Origen extranjero</h2>
          <p>Porcentaje sobre el total</p></div></header>
        <div class="cuerpo"><figure>${graficoExtranjero(f.extranjero, wEx, px(26))}</figure>
          <div class="leyenda">
            <span><i class="llave" style="background:#85B7EB"></i>Municipio</span>
            <span><i class="llave" style="background:#185FA5"></i>Último dato</span>
            <span><i class="llave" style="background:#1A1A1A;height:2px;border-radius:0"></i>Canarias</span>
          </div></div>
      </section>

      <section class="tarjeta">
        <header class="rotulo">${icono('territorio', 13)}<div><h2>Dónde está el municipio</h2>
          <p>Su posición por población en Canarias, en su isla y en su comarca</p></div></header>
        <div class="cuerpo"><div class="mapas">
          ${niveles.map(([tit, filtro, r, lim]) => `
            <figure class="mapa">${mapa(GEOD, f.codmun, filtro, wMapa, px(20), lim)}
              <figcaption class="mapa-pie"><b>${r.puesto}º de ${r.total}</b>
                <span>en ${escd(tit)} · ${nfd(r.peso, 2)} % de su población</span></figcaption></figure>`).join('')}
        </div></div>
      </section>

      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('edad', 13)}<div><h2>Estructura de la población</h2>
          <p>Grupos de cinco años · ${f.anio}</p></div></header>
        <div class="cuerpo"><figure>${construirPiramide(f.piramide, wPi, px(60), 0).svg}</figure>
          <div class="leyenda">
            <span><i class="llave" style="background:#2E75B6"></i>Hombres</span>
            <span><i class="llave" style="background:#85B7EB"></i>Mujeres</span>
            <span><i class="llave hueca"></i>Canarias</span>
          </div></div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('dependencia', 13)}<div><h2>Información geodemográfica</h2>
          <p>De menor a mayor valor</p></div></header>
        <div class="cuerpo">${bloqueIndices(f.indices, ['C10', 'C11', 'C17', 'C14'], f.nombre, f.isla)}</div>
      </section>

      <section class="tarjeta mitad">
        <header class="rotulo">${icono('relevo', 13)}<div><h2>Componentes del cambio poblacional</h2>
          <p>Nacimientos menos defunciones y saldo migratorio</p></div></header>
        <div class="cuerpo"><figure>${graficoComponentes(f.componentes, wCo, px(24))}</figure>
          <div class="leyenda">
            <span><i class="llave" style="background:#85B7EB"></i>Crecimiento vegetativo</span>
            <span><i class="llave" style="background:#185FA5"></i>Saldo migratorio</span>
          </div>
          ${anom.length ? `<p class="nota">${anom.map((a) =>
            `En ${a.anio} no se representa el saldo migratorio (${nfd(a.valor)}): corresponde a un ${a.motivo}.`).join(' ')}</p>` : ''}
        </div>
      </section>

      <section class="tarjeta mitad">
        <header class="rotulo">${icono('nacimiento', 13)}<div><h2>Lugar de nacimiento</h2>
          <p>De cada cien habitantes, dónde nacieron</p></div></header>
        <div class="cuerpo"><div class="mosaicos">
          ${[['Municipio', f.origen.municipio], ['Canarias', f.origen.canarias]].map(([t, v]) => `
            <div class="mosaico"><h3>${t}</h3>${mosaicoOrigen(v, 6, 1.1)}
              <div class="reparto">${f.origen.categorias.map((cat, i) =>
                `<div><i style="background:${TONOS_ORIGEN[i]}"></i><span>${escd(cat)}</span><b>${nfd(v[i], 1)}%</b></div>`).join('')}
              </div></div>`).join('')}
        </div></div>
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
      <div><b>${IDX.anio}</b><span>Padrón municipal continuo a 1 de enero</span></div>
      <div><b>${nfd(IDX.poblacion_canarias)}</b><span>Habitantes</span></div>
      <div><b>88</b><span>Municipios · 7 islas</span></div>
    </div>
  </article>`;
}

function mapaArchipielago() {
  return mapa(GEOD, null, () => true, px(174), px(78), false);
}

function hojaGuia() {
  return `<article class="hoja hoja-texto">
    <h2 class="d-titulo">Cómo usar este dossier</h2>
    <div class="d-cols">
      <div>
        <h3>El orden</h3>
        <p>Las 88 fichas van en el mismo orden que el visor en línea: las islas de oeste a
           este y, dentro de cada isla, los municipios por orden alfabético. Cada municipio
           ocupa una hoja, y antes de cada grupo hay un separador con el conjunto de la isla.</p>
        <h3>Los datos</h3>
        <p>Padrón municipal continuo a 1 de enero de ${IDX.anio}. Las series de crecimiento
           vegetativo y saldo migratorio llegan hasta 2024, que es el último año cerrado.</p>
      </div>
      <div>
        <h3>Cómo leer los indicadores</h3>
        <p><b>Ningún indicador de estas fichas tiene un valor deseable.</b> Todos describen
           cómo se reparte una población; ninguno la califica.</p>
        <p>El envejecimiento es una <b>razón</b>: personas de 65 y más por cada persona menor
           de 15. Un 1 significa que los dos grupos son iguales; un 2, que el primero es el
           doble.</p>
        <p>Juventud, dependencia y reemplazo laboral van <b>por cien</b>: menores de 15 por
           cada cien personas de 15 a 64; menores de 15 y mayores de 64 juntos por cada cien
           de 15 a 64; y personas de 15 a 19 por cada cien de 60 a 64.</p>
        <p>Comparar un municipio con su isla o con Canarias sirve para situarlo, no para
           calificarlo. En los municipios de pocos habitantes, unas pocas personas mueven
           mucho un índice.</p>
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
          <h3>${escd(g.nombre)} <em>separador ${g.paginaSeparador}</em></h3>
          ${g.fichas.map((f, i) => `<div><span>${escd(f.nombre)}</span><b>${g.paginaPrimera + i}</b></div>`).join('')}
        </div>`).join('')}
    </div>
    <footer class="d-pie"><span>Canarias Convive · Fichas demográficas municipales</span><span>3</span></footer>
  </article>`;
}

function hojaSeparador(g) {
  return `<article class="hoja hoja-separador">
    <p class="d-migas">Isla</p>
    <h2>${escd(g.nombre)}</h2>
    <p class="d-sub">${g.n} municipios · fichas ${g.paginaPrimera} a ${g.paginaPrimera + g.n - 1}</p>
    <div class="d-isla-datos">
      <div><b>${nfd(g.habitantes)}</b><span>Habitantes en ${IDX.anio}</span></div>
      <div><b>${g.n}</b><span>Municipios</span></div>
      <div><b>${nfd(g.peso, 1)} %</b><span>De la población de Canarias</span></div>
      <div><b>${nfd(g.envejecimiento, 2)}</b><span>Envejecimiento de la isla</span></div>
    </div>
    <div class="d-isla-mapa">${mapa(GEOD, null, (x) => x.properties.isla === g.nombre, px(120), px(62), true)}</div>
    <div class="d-isla-lista">${g.fichas.map((f, i) =>
      `<span>${escd(f.nombre)} <em>${g.paginaPrimera + i}</em></span>`).join('')}</div>
    <footer class="d-pie"><span>Canarias Convive · ${escd(g.nombre)}</span><span>${g.paginaSeparador}</span></footer>
  </article>`;
}

/* ------------------------------------------------- reglas de la hoja ------ */
/** Copia el bloque @media print de estilos.css como reglas normales, acotadas a
 *  .d-body. Así la vista previa del dossier es exactamente la ficha impresa, y
 *  no hay dos juegos de reglas que se separen a la primera corrección. */
function traerReglasDeImpresion() {
  const salida = [];
  for (const hoja of document.styleSheets) {
    let reglas;
    try { reglas = hoja.cssRules; } catch { continue; }   // hoja de otro origen
    for (const r of reglas) {
      if (r.type !== CSSRule.MEDIA_RULE) continue;
      if (!/\bprint\b/.test(r.conditionText || '')) continue;
      if (/screen/.test(r.conditionText || '')) continue;
      for (const s of r.cssRules) {
        if (!s.selectorText) { salida.push(s.cssText); continue; }
        const sel = s.selectorText.split(',')
          .map((x) => `.d-body ${x.trim()}`).join(', ');
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
    fetch('datos/indice.json').then((r) => r.json()),
    fetch('datos/geo/municipios.json').then((r) => r.json()),
  ]);

  aviso.textContent = `Cargando las ${IDX.municipios.length} fichas…`;
  const fichas = await Promise.all(IDX.municipios.map((m) =>
    fetch(`datos/mun/${m.codmun}.json`).then((r) => r.json())));

  // Orden: islas de oeste a este, municipios por orden alfabético.
  const grupos = ISLAS_OESTE_ESTE.map((isla) => {
    const g = resumenIsla(isla, fichas);
    g.fichas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return g;
  });

  // Numeración: 1 portada, 2 guía, 3 índice, y luego separador + fichas.
  let p = 4;
  for (const g of grupos) { g.paginaSeparador = p++; g.paginaPrimera = p; p += g.n; }

  aviso.textContent = 'Componiendo las hojas…';
  const partes = [hojaPortada(), hojaGuia(), hojaIndice(grupos)];
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
  document.getElementById('d-aviso').textContent = 'No se ha podido componer el dossier.';
  console.error(e);
});

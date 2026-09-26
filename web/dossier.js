/* Dossier: las 98 fichas en un solo documento A4 (portada, guía de uso,
   índice, Canarias y, por cada provincia, su ficha seguida de las de sus
   islas, cada una con una hoja por municipio), con los gráficos de ficha.js a
   medida de hoja. El orden es el de indice.json: provincias e islas de oeste
   a este y municipios por orden alfabético. */

let IDX = null, GEOD = null;

/* ----------------------------------------------------------- una ficha ---- */
/** La tarjeta del entorno: los mapas del municipio o, por encima de él, el
 *  territorio en Canarias y la lista de lo que contiene (la misma que en
 *  pantalla: los municipios de la isla, las islas de la provincia o de
 *  Canarias; la hoja de cada uno está en el índice). */
function tarjetasEntorno(f, ent, R) {
  const niveles = nivelesMapas(f);
  const wMapa = ent.agregada ? anchoHoja(3) - mm(1) : Math.floor((anchoHoja(12) - 2 * mm(4)) / 3);
  const mapas = niveles.map(([tit, filtro, r, lim, foco, cuenta, titulo]) => `
    <figure class="mapa">${mapa(GEOD, foco, filtro, wMapa, mm(ent.agregada ? 11 : 20), lim, titulo)}
      ${(() => { const pie = pieMapa(r, tit, cuenta); return pie ? `<figcaption class="mapa-pie">${pie}</figcaption>` : ''; })()}</figure>`).join('');
  if (!ent.agregada) {
    return `<section class="tarjeta">
      <header class="rotulo">${icono('territorio', 13)}<div><h3>${R.entorno[0]}</h3>
        <p>${R.entorno[1]}</p></div></header>
      <div class="cuerpo"><div class="mapas${niveles.length === 2 ? ' dos' : ''}">${mapas}</div>${fuenteGrafico('mapas')}</div>
    </section>`;
  }
  return `<section class="tarjeta tercio entorno-isla${ent.canarias ? ' entorno-canarias' : ''}">
      <header class="rotulo">${icono('territorio', 13)}<div><h3>${R.entorno[0]}</h3>
        <p>${R.entorno[1]}</p></div></header>
      <div class="cuerpo"><div class="mapas isla">${mapas}</div>${ent.canarias ? `<div class="lista-provincias">${listaProvincias(f)}</div>` : ''}${fuenteGrafico('mapas')}</div>
    </section>
    <section class="tarjeta dos-tercios municipios-isla${ent.canarias ? ' municipios-canarias' : ''}">
      <header class="rotulo">${icono('poblacion', 13)}<div><h3>${R.lista[0]}</h3>
        <p>${R.lista[1]}</p></div></header>
      <div class="cuerpo">${ent.isla ? listaMunicipios(f) : listaIslas(f)}${fuenteGrafico(ent.isla ? 'municipios' : 'islas')}</div>
    </section>`;
}

function hojaFicha(f, pagina) {
  const ent = entidad(f);
  const wEv = anchoHoja(7), wEx = anchoHoja(5), wPi = anchoHoja(7), wCo = anchoHoja(6);
  const ev = f.evolucion;
  const anom = f.componentes.anomalias || [];
  const piramide = construirPiramide(f.piramide, wPi, ALTO_PIRAMIDE_A4, 0, ent.rotulo, ent.canarias);   // la misma que la ficha suelta impresa
  const R = rotulosFicha(f, ent);

  return `<article class="hoja hoja-ficha${ent.agregada ? ' hoja-isla' : ''}" data-pagina="${pagina}">
    <header class="d-cab">
      <p class="d-migas">${esc(R.migas)}</p>
      <div class="d-titular"><h2>${esc(f.nombre)}</h2><span class="d-anio">${f.anio}</span></div>
      <p class="d-hab"><b>${nf(f.poblacion)}</b><span>habitantes</span></p>
      <span class="placa placa-papel">${logotipos()}</span>
    </header>

    <div class="cifras">${cifrasClave(f)}</div>

    <div class="rejilla">
      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('variacion', 13)}<div><h3>Evolución de la población</h3>
          <p>Habitantes, ${ev.anios[0]}–${ev.anios[ev.anios.length - 1]}</p></div></header>
        <div class="cuerpo"><figure>${graficoEvolucion(ev, wEv, mm(30), '-' + ent.id)}</figure>${fuenteGrafico(claveEvolucion(ent))}</div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('extranjero', 13)}<div><h3>Origen extranjero</h3>
          <p>Porcentaje sobre el total de habitantes</p></div></header>
        <div class="cuerpo"><figure>${graficoExtranjero(f.extranjero, wEx, mm(26))}</figure>
          <div class="leyenda">${leyendaExtranjero(f, 2)}</div>${fuenteGrafico('extranjero')}</div>
      </section>

      ${tarjetasEntorno(f, ent, R)}

      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('edad', 13)}<div><h3>Estructura de la población</h3></div></header>
        <div class="cuerpo"><figure>${piramide.svg}</figure>
          <div class="leyenda">${leyendaPiramide(piramide.vistas[0])}</div>${fuenteGrafico('piramide')}</div>
      </section>

      <section class="tarjeta tercio indices">
        <header class="rotulo">${icono('dependencia', 13)}<div><h3>Información geodemográfica</h3>
          <p>${R.indices.replace(/ordenad[oa]s de menor/, 'de menor')}</p></div></header>   <!-- en la hoja, sin «ordenados» -->
        <div class="cuerpo">${ent.agregada ? `<div class="indices-isla">${bloqueIndicesIsla(f.indices, INDICES_FICHA, ent.provincia ? 'Provincia' : f.nombre)}</div>` : bloqueIndices(f.indices, INDICES_FICHA)}${fuenteGrafico('indices')}</div>
      </section>

      <section class="tarjeta mitad">
        <header class="rotulo">${icono('relevo', 13)}<div><h3>Componentes del cambio poblacional</h3></div></header>
        <div class="cuerpo"><figure>${graficoComponentes(f.componentes, wCo, mm(anom.length ? 21 : 24))}${anom.length ? `<figcaption class="nota">${notaAnomalias(anom)}</figcaption>` : ''}</figure>
          <div class="leyenda">
            <span><i class="llave" style="background:#85B7EB"></i>Crecimiento vegetativo</span>
            <span><i class="llave" style="background:#185FA5"></i>Saldo migratorio</span>
          </div>
          ${fuenteGrafico('componentes')}
        </div>
      </section>

      <section class="tarjeta mitad">
        <header class="rotulo">${icono('nacimiento', 13)}<div><h3>Lugar de nacimiento</h3>
          <p>De cada cien habitantes, dónde nacieron</p></div></header>
        <div class="cuerpo"><div class="anillos${ent.canarias ? ' uno' : ''}">
          ${(ent.canarias ? [['Canarias', f.origen.canarias]] : [[ent.rotulo, propia(f.origen)], ['Canarias', f.origen.canarias]]).map(([t, v]) => `
            <div class="anillo"><h4>${t}</h4>${anilloOrigen(v, 30, 13)}
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
    <span class="placa d-portada-placa">${logotipos()}</span>
    <h1>Fichas demográficas<br>municipales de Canarias</h1>
    <p class="d-lede">Una ficha por Canarias, por cada provincia, por cada isla y por cada uno de los 88 municipios
      del archipiélago: estructura de la población, evolución, índices geodemográficos y lugar de nacimiento.</p>
    <div class="d-portada-mapa" aria-hidden="true">${mapaArchipielago()}</div>
    <div class="d-portada-pie">
      <div><b>${IDX.anio}</b><span>Población a 1 de enero</span></div>
      <div><b>${nf(IDX.poblacion_canarias)}</b><span>Habitantes</span></div>
      <div><b>88</b><span>Municipios · 7 islas · 2 provincias</span></div>
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
  const definicion = (x) => `<p><b>${esc(x.nombre)}.</b> ${esc(x.mide)}${x.unidad ? ` ${esc(x.unidad)}.` : ''}</p>`;
  return `<article class="hoja hoja-texto">
    <h2 class="d-titulo">Cómo usar este dossier</h2>
    <div class="d-cols">
      <div>
        <h3>El orden</h3>
        <p>Las fichas van en el mismo orden que la portada y los selectores de la web: primero
           Canarias entera; después cada provincia, de oeste a este, con sus islas, y dentro de
           cada isla los municipios por orden alfabético. Cada provincia y cada isla abren su
           grupo con su propia ficha, que las sitúa en Canarias y lista lo que contienen; el
           índice da la hoja de cada territorio; después, un municipio por hoja.</p>
        <h3>Los datos</h3>
        <p>Población a 1 de enero de ${IDX.anio}. Las series de crecimiento
           vegetativo y saldo migratorio llegan hasta ${anioComp}, que es el último año cerrado.
           Las cifras de origen extranjero y de lugar de nacimiento cuentan dónde nació cada
           persona, con independencia de su nacionalidad.</p>
        <h3>Las fuentes</h3>
        <p>ISTAC (población, movimiento natural y migraciones) y GRAFCAN (límites
           municipales). Cada gráfico lleva la suya al pie.</p>
      </div>
      <div>
        <h3>Qué mide cada indicador</h3>
        ${INDICADORES.map(definicion).join('')}
      </div>
    </div>
    <footer class="d-pie"><span>Canarias Convive · Fichas demográficas municipales</span><span>${pagina}</span></footer>
  </article>`;
}

function hojaIndice(provincias, paginaCanarias, pagina) {
  return `<article class="hoja hoja-texto">
    <h2 class="d-titulo">Índice</h2>
    <p class="d-sub">Canarias · 2 provincias · 7 islas · 88 municipios · la ficha de cada provincia y de cada isla abre su grupo; los municipios, por orden alfabético</p>
    <div class="d-indice">
      <div class="d-indice-grupo d-indice-canarias"><h3>Canarias <em>toda la comunidad · ${paginaCanarias}</em></h3></div>
      ${provincias.map((p, k) => `
        <div class="d-indice-grupo d-indice-provincia${k ? ' siguiente' : ''}"><h3>${esc(p.nombre)} <em>la provincia · ${p.pagina}</em></h3></div>
        ${p.grupos.map((g) => `
        <div class="d-indice-grupo">
          <h3>${esc(g.nombre)} <em>la isla · ${g.paginaIsla}</em></h3>
          ${g.fichas.map((f, i) => `<div><span>${esc(f.nombre)}</span><b>${g.paginaPrimera + i}</b></div>`).join('')}
        </div>`).join('')}`).join('')}
    </div>
    <footer class="d-pie"><span>Canarias Convive · Fichas demográficas municipales</span><span>${pagina}</span></footer>
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
/** Las 98 fichas (y el índice y la geometría) en paralelo, rutas bajo datos/; lo que falle se vuelve a
 *  pedir hasta dos veces antes de darse por vencido, sin tirar lo que ya llegó. */
async function leerFichas(rutas) {
  const fichas = new Map();
  let pendientes = rutas;
  for (let intento = 0; intento < 3 && pendientes.length; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, 800 * intento));
    const resultados = await Promise.allSettled(pendientes.map((r) => leerJSON(`datos/${r}.json`)));
    pendientes = pendientes.filter((r, i) => {
      if (resultados[i].status === 'fulfilled') fichas.set(r, resultados[i].value);
      return resultados[i].status !== 'fulfilled';
    });
  }
  if (pendientes.length) throw new Error(`no se han podido leer ${pendientes.length} fichas`);
  return rutas.map((r) => fichas.get(r));
}

async function iniciarDossier() {
  modoHoja(true);
  const n = traerReglasDeImpresion();
  if (!n) throw new Error('no se han encontrado las reglas de impresión de estilos.css');
  const aviso = document.getElementById('d-aviso');

  [IDX, GEOD] = await leerFichas(['indice', 'geo/municipios']);   // con los mismos reintentos que las fichas

  const islas = IDX.islas_resumen, provincias = IDX.provincias;
  for (const pr of provincias) for (const slug of pr.islas) PROVINCIA_DE[islas.find((i) => i.slug === slug).nombre] = pr.nombre;
  aviso.textContent = `Cargando las ${IDX.municipios.length + islas.length + provincias.length + 1} fichas…`;
  const todas = await leerFichas(['canarias', ...provincias.map((pr) => `provincia/${pr.slug}`),
    ...islas.map((i) => `isla/${i.slug}`), ...IDX.municipios.map((m) => `mun/${m.codmun}`)]);
  const fichas = todas.filter((f) => f.tipo === 'municipio');

  // Orden: el de indice.json (provincias e islas de oeste a este), municipios por orden alfabético.
  const gruposDe = (slugs) => slugs.map((slug) => {
    const i = islas.find((x) => x.slug === slug);
    return {
      nombre: i.nombre,
      isla: todas.find((f) => f.tipo === 'isla' && f.slug === slug),
      fichas: fichas.filter((f) => f.isla === i.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    };
  });
  const bloques = provincias.map((pr) => ({
    nombre: pr.nombre,
    ficha: todas.find((f) => f.tipo === 'provincia' && f.slug === pr.slug),
    grupos: gruposDe(pr.islas),
  }));

  // Numeración: 1 portada, 2 guía, 3 índice, 4 Canarias, y luego cada provincia
  // con sus islas (la ficha de la isla + sus municipios).
  const paginaCanarias = 4;
  let p = 5;
  for (const b of bloques) {
    b.pagina = p++;
    for (const g of b.grupos) { g.paginaIsla = p++; g.paginaPrimera = p; p += g.fichas.length; }
  }

  aviso.textContent = 'Componiendo las hojas…';
  const partes = [hojaPortada(), hojaGuia(fichas, 2), hojaIndice(bloques, paginaCanarias, 3),
    hojaFicha(todas.find((f) => f.tipo === 'canarias'), paginaCanarias)];
  for (const b of bloques) {
    partes.push(hojaFicha(b.ficha, b.pagina));
    for (const g of b.grupos) {
      partes.push(hojaFicha(g.isla, g.paginaIsla));
      g.fichas.forEach((f, i) => partes.push(hojaFicha(f, g.paginaPrimera + i)));
    }
  }

  const principal = document.getElementById('dossier');
  principal.innerHTML = partes.join('');
  aviso.remove();
  document.getElementById('d-barra').hidden = false;
  document.getElementById('d-imprimir').addEventListener('click', () => window.print());
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

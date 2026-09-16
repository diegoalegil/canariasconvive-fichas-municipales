/* Dossier: las 95 fichas en un solo documento A4 (portada, guía de uso, índice
   y, por cada isla, su ficha seguida de una hoja por municipio), con los
   gráficos de ficha.js a medida de hoja. El orden es el de indice.json: islas
   de oeste a este y municipios por orden alfabético. */

let IDX = null, GEOD = null;
// La dirección de la web, en la guía del dossier (sin protocolo, para teclearla).
const DIRECCION_WEB = URL_PUBLICA_SITIO.replace(/^https?:\/\//, '').replace(/\/$/, '');

/* ----------------------------------------------------------- una ficha ---- */
/** La tarjeta del entorno: los mapas del municipio o, en la isla, la isla en
 *  Canarias y la lista de sus municipios (la misma que en pantalla; la hoja de
 *  cada uno está en el índice). */
function tarjetasEntorno(f, ent) {
  const niveles = nivelesMapas(f);
  const wMapa = ent.isla ? anchoHoja(3) - mm(1) : Math.floor((anchoHoja(12) - 2 * mm(4)) / 3);
  const mapas = niveles.map(([tit, filtro, r, lim, foco]) => `
    <figure class="mapa">${mapa(GEOD, foco, filtro, wMapa, mm(ent.isla ? 11 : 20), lim)}
      <figcaption class="mapa-pie">${r ? `<b>${r.puesto}.º de ${r.total}</b>
        <span>${esc(tit)}</span>
        <p><b>${pct(r.peso, 2)}</b> <span>de su población</span></p>` : `<b>${f.municipios.length}</b><span>${esc(tit)}</span>`}
      </figcaption></figure>`).join('');
  if (!ent.isla) {
    return `<section class="tarjeta">
      <header class="rotulo">${icono('territorio', 13)}<div><h2>El municipio en su entorno</h2>
        <p>Su puesto por población y el peso que tiene en cada ámbito</p></div></header>
      <div class="cuerpo"><div class="mapas${niveles.length === 2 ? ' dos' : ''}">${mapas}</div>${fuenteGrafico('mapas')}</div>
    </section>`;
  }
  return `<section class="tarjeta tercio entorno-isla">
      <header class="rotulo">${icono('territorio', 13)}<div><h2>La isla en Canarias</h2>
        <p>Su puesto y su peso por población</p></div></header>
      <div class="cuerpo"><div class="mapas isla">${mapas}</div>${fuenteGrafico('mapas')}</div>
    </section>
    <section class="tarjeta dos-tercios municipios-isla">
      <header class="rotulo">${icono('poblacion', 13)}<div><h2>Sus municipios</h2>
        <p>Los ${f.municipios.length} municipios de la isla y su peso demográfico de mayor a menor</p></div></header>
      <div class="cuerpo">${listaMunicipios(f)}${fuenteGrafico('municipios')}</div>
    </section>`;
}

function hojaFicha(f, pagina) {
  const ent = entidad(f);
  const wEv = anchoHoja(7), wEx = anchoHoja(5), wPi = anchoHoja(7), wCo = anchoHoja(6);
  const ev = f.evolucion;
  const anom = f.componentes.anomalias || [];
  const piramide = construirPiramide(f.piramide, wPi, ALTO_PIRAMIDE_A4, 0, ent.rotulo);   // la misma que la ficha suelta impresa
  const migas = ent.isla ? `Canarias · ${f.municipios.length} municipios` : [f.isla, comarcaDe(f)].filter(Boolean).join(' · ');

  return `<article class="hoja hoja-ficha${ent.isla ? ' hoja-isla' : ''}" data-pagina="${pagina}">
    <header class="d-cab">
      <p class="d-migas">${esc(migas)}</p>
      <div class="d-titular"><h2>${esc(f.nombre)}</h2><span class="d-anio">${f.anio}</span></div>
      <p class="d-hab"><b>${nf(f.poblacion)}</b><span>habitantes</span></p>
      <span class="placa placa-papel"><img src="${rutaWeb('img/logo-canariasconvive.png')}" alt="Canarias Convive"></span>
    </header>

    <div class="cifras">${cifrasClave(f)}</div>

    <div class="rejilla">
      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('variacion', 13)}<div><h2>Evolución de la población</h2>
          <p>Habitantes, ${ev.anios[0]}–${ev.anios[ev.anios.length - 1]}</p></div></header>
        <div class="cuerpo"><figure>${graficoEvolucion(ev, wEv, mm(30), '-' + ent.id)}</figure>${fuenteGrafico(ent.isla ? 'evolucion_isla' : 'evolucion')}</div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('extranjero', 13)}<div><h2>Origen extranjero</h2>
          <p>Porcentaje sobre el total</p></div></header>
        <div class="cuerpo"><figure>${graficoExtranjero(f.extranjero, wEx, mm(26))}</figure>
          <div class="leyenda">${leyendaExtranjero(f, 2)}</div>${fuenteGrafico('extranjero')}</div>
      </section>

      ${tarjetasEntorno(f, ent)}

      <section class="tarjeta dos-tercios">
        <header class="rotulo">${icono('edad', 13)}<div><h2>Estructura de la población</h2></div></header>
        <div class="cuerpo"><figure>${piramide.svg}</figure>
          <div class="leyenda">${leyendaPiramide(piramide.vistas[0])}</div>${fuenteGrafico('piramide')}</div>
      </section>

      <section class="tarjeta tercio">
        <header class="rotulo">${icono('dependencia', 13)}<div><h2>Información geodemográfica</h2>
          <p>${ent.isla ? 'Las siete islas y Canarias, de menor a mayor valor' : 'Los tres ámbitos, de menor a mayor valor'}</p></div></header>
        <div class="cuerpo">${ent.isla ? `<div class="indices-isla">${bloqueIndicesIsla(f.indices, INDICES_FICHA, f.nombre)}</div>` : bloqueIndices(f.indices, INDICES_FICHA)}${fuenteGrafico('indices')}</div>
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
          ${[[ent.rotulo, propia(f.origen)], ['Canarias', f.origen.canarias]].map(([t, v]) => `
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
    <p class="d-lede">Una ficha por cada isla y por cada uno de los 88 municipios del archipiélago:
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
  // Partida solo en las barras: un guion al final de línea se teclearía mal desde el papel.
  const web = DIRECCION_WEB.split('/').map((t) => `<span style="white-space:nowrap">${esc(t)}</span>`).join('/');
  const definicion = (x) => `<p><b>${esc(x.nombre)}.</b> ${esc(x.mide)}${x.unidad ? ` ${esc(x.unidad)}.` : ''}</p>`;
  return `<article class="hoja hoja-texto">
    <h2 class="d-titulo">Cómo usar este dossier</h2>
    <div class="d-cols">
      <div>
        <h3>El orden</h3>
        <p>Las fichas van en el mismo orden que la portada y los selectores de la web: las
           islas de oeste a este y, dentro de cada isla, los municipios por orden alfabético.
           Cada isla abre su grupo con su propia ficha, que sitúa la isla en Canarias y lista
           sus municipios con la hoja de cada uno; después, un municipio por hoja.</p>
        <h3>Los datos</h3>
        <p>Población a 1 de enero de ${IDX.anio}. Las series de crecimiento
           vegetativo y saldo migratorio llegan hasta ${anioComp}, que es el último año cerrado.
           Las cifras de origen extranjero y de lugar de nacimiento cuentan dónde nació cada
           persona, con independencia de su nacionalidad.</p>
        <h3>Las fuentes</h3>
        <p>ISTAC (población, movimiento natural y migraciones) y GRAFCAN (límites
           municipales). Cada gráfico lleva la suya al pie. Las fichas interactivas están en
           <b>${web}</b></p>
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
    <h2 class="d-titulo">Índice</h2>
    <p class="d-sub">7 islas · 88 municipios · la ficha de cada isla abre su grupo; los municipios, por orden alfabético</p>
    <div class="d-indice">
      ${grupos.map((g) => `
        <div class="d-indice-grupo">
          <h3>${esc(g.nombre)} <em>la isla · ${g.paginaIsla}</em></h3>
          ${g.fichas.map((f, i) => `<div><span>${esc(f.nombre)}</span><b>${g.paginaPrimera + i}</b></div>`).join('')}
        </div>`).join('')}
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
/** Las 95 fichas en paralelo (rutas bajo datos/); lo que falle se vuelve a
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

  [IDX, GEOD] = await Promise.all([
    leerJSON('datos/indice.json'),
    leerJSON('datos/geo/municipios.json'),
  ]);

  const islas = IDX.islas_resumen;
  aviso.textContent = `Cargando las ${IDX.municipios.length + islas.length} fichas…`;
  const todas = await leerFichas([...islas.map((i) => `isla/${i.slug}`), ...IDX.municipios.map((m) => `mun/${m.codmun}`)]);
  const fichas = todas.filter((f) => f.tipo !== 'isla');

  // Orden: el de indice.json (islas de oeste a este), municipios por orden alfabético.
  const grupos = islas.map((i) => ({
    nombre: i.nombre,
    isla: todas.find((f) => f.tipo === 'isla' && f.slug === i.slug),
    fichas: fichas.filter((f) => f.isla === i.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  }));

  // Numeración: 1 portada, 2 guía, 3 índice, y luego la ficha de la isla + sus municipios.
  let p = 4;
  for (const g of grupos) { g.paginaIsla = p++; g.paginaPrimera = p; p += g.fichas.length; }

  aviso.textContent = 'Componiendo las hojas…';
  const partes = [hojaPortada(), hojaGuia(fichas, 2), hojaIndice(grupos, 3)];
  for (const g of grupos) {
    partes.push(hojaFicha(g.isla, g.paginaIsla));
    g.fichas.forEach((f, i) => partes.push(hojaFicha(f, g.paginaPrimera + i)));
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

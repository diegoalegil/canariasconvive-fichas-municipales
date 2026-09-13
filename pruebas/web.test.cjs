/* Batería de interacciones e impresión en Chromium (Playwright + node:test).
   Reproduce los fallos de la auditoría del 13 de septiembre de 2026 y comprueba
   que no vuelven: última selección manda, comparador con tres plazas y sin
   duplicados, colores estables, errores visibles con reintento, menús de isla
   dentro de la pantalla, contraste de los nombres, tabla semántica, teclado
   tras redibujar e imprimir, foco de la presentación, leyenda de la pirámide
   con las palabras de Pedro, redondeo único, las 88 fichas en una A4 y el
   dossier de 98 hojas con su barra visible.

   Uso: npm test (o npm run test:web). Sirve web/ bajo /fichas/, como GitHub
   Pages, en un puerto libre. Sin red: los JSON salen del disco. Con
   MOTOR=webkit corre en el motor de Safari (sin el caso de papel: page.pdf
   solo existe en Chromium); en GitHub Actions corre en Chromium. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const MOTOR = process.env.MOTOR === 'webkit' ? webkit : chromium;
const SOLO_CHROMIUM = MOTOR !== chromium ? { skip: 'page.pdf solo existe en Chromium' } : {};

const RAIZ = path.resolve(__dirname, '..'), WEB = path.join(RAIZ, 'web');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
let navegador, servidor, base, indice;
const json = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const paginasPDF = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page(?:\s|\/|>)/g) || []).length;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function abrir(ruta, { ancho = 1280, alto = 900, movimiento = 'reduce' } = {}) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, reducedMotion: movimiento });
  const page = await contexto.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push('excepción: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push('consola: ' + m.text()); });
  await page.goto(base + ruta);
  return { contexto, page, errores };
}
const sinDesborde = async (page, donde) => {
  const d = await page.evaluate(() => ({ ventana: document.documentElement.clientWidth, contenido: document.documentElement.scrollWidth }));
  assert.ok(d.contenido <= d.ventana + 1, `${donde}: desborde horizontal ${JSON.stringify(d)}`);
};
/** Retrasa la respuesta de los JSON que cumplan el patrón, para forzar respuestas desordenadas. */
const retrasar = (page, patron, ms) => page.route(patron, async (ruta) => { await espera(ms); await ruta.continue(); });

before(async () => {
  indice = await json(path.join(WEB, 'datos/indice.json'));
  servidor = http.createServer(async (req, res) => {
    try {
      const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!ruta.startsWith('/fichas/')) { res.writeHead(404); res.end(); return; }
      const fichero = path.resolve(WEB, ruta.slice(8) || 'index.html');
      if (!fichero.startsWith(WEB + path.sep)) throw new Error('fuera de web/');
      const datos = await fs.readFile(fichero);
      res.setHeader('Content-Type', MIME[path.extname(fichero)] || 'application/octet-stream');
      res.end(datos);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${servidor.address().port}/fichas/`;
  navegador = await MOTOR.launch();
});
after(async () => { await navegador?.close(); await new Promise((r) => servidor?.close(r)); });

test('ficha: la última selección manda, el error se ve y se reintenta, y la TVMA se redondea una sola vez', async () => {
  const sitio = await json(path.join(RAIZ, 'sitio.json'));
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038');
  await page.waitForSelector('#fuente-g-origen');
  // Las Palmas tarda más que Betancuria: gana Betancuria, que fue la última.
  await retrasar(page, '**/datos/mun/35016.json', 500);
  await page.selectOption('#sel-municipio', '35016');
  await page.selectOption('#sel-municipio', '35007');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Betancuria');
  await espera(700);
  assert.equal(await page.locator('#nombre').textContent(), 'Betancuria');
  assert.equal(await page.locator('#sel-municipio').inputValue(), '35007');
  // La dirección visible es la estable, con vista previa: la misma que copia «Copiar enlace».
  assert.ok(page.url().endsWith('/fichas/m/35007.html'), page.url());
  assert.equal(await page.locator('#btn-comparar').evaluate((a) => a.href), base + 'comparar.html?m=35007');
  assert.equal(await page.locator('.barra a[data-ico="inicio"]').evaluate((a) => a.href), base + 'index.html');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), sitio.url_publica + 'm/35007.html');
  const envoltorio = await fs.readFile(path.join(WEB, 'm/35007.html'), 'utf8');
  const ogDesc = /<meta property="og:description" content="([^"]*)">/.exec(envoltorio)[1];
  assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), ogDesc, 'la descripción en ejecución es la del envoltorio');
  assert.ok(await page.locator('#estado-ficha').isHidden(), 'con una carga rápida no hay aviso');
  // Un municipio que no carga: aviso visible, el selector vuelve al que se ve.
  await page.route('**/datos/mun/35017.json', (r) => r.abort());
  await page.selectOption('#sel-municipio', '35017');
  await page.waitForFunction(() => document.getElementById('estado-ficha').textContent.includes('No se ha podido'));
  assert.ok(await page.locator('#estado-ficha').isVisible());
  assert.equal(await page.locator('#sel-municipio').inputValue(), '35007');
  assert.equal(await page.locator('#nombre').textContent(), 'Betancuria');
  await page.unroute('**/datos/mun/35017.json');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Puerto del Rosario');
  assert.ok(await page.locator('#estado-ficha').isHidden());
  // 3,148981… % se muestra 3,1 y no 3,2 (antes: 3,15 en el JSON y otro redondeo en pantalla).
  assert.match(await page.locator('#cifras').textContent(), /\+3,1 %/);
  // La petición abortada a propósito deja su «Failed to load resource» en la consola; el resto tiene que estar limpio.
  assert.deepEqual(errores.filter((e) => !e.includes('Failed to load resource')), []);
  await contexto.close();
});

test('ficha: rótulos por lugar de nacimiento, fuente y datos, teclado tras redibujar e imprimir', async () => {
  // Se entra por el envoltorio estático (el que reciben los rastreadores): redirige a la
  // ficha, que vuelve a poner la dirección estable y sigue cargando datos desde la raíz.
  const { page, contexto, errores } = await abrir('m/38038.html');
  await page.waitForSelector('#fuente-g-origen');
  assert.equal(await page.locator('#nombre').textContent(), 'Santa Cruz de Tenerife');
  assert.ok(page.url().endsWith('/fichas/m/38038.html'), page.url());
  await page.selectOption('#sel-municipio', '38001');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Adeje');
  assert.ok(page.url().endsWith('/fichas/m/38001.html'), page.url());
  await page.selectOption('#sel-municipio', '38038');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Santa Cruz de Tenerife');
  // El fragmento sobrevive al cambio de dirección y a la redirección del envoltorio.
  await page.goto(base + 'ficha.html?municipio=38038#g-evolucion');
  await page.waitForSelector('#fuente-g-origen');
  assert.ok(page.url().endsWith('/fichas/m/38038.html#g-evolucion'), page.url());
  await page.goto(base + 'm/38038.html#g-evolucion');
  await page.waitForSelector('#fuente-g-origen');
  await espera(300);
  assert.ok(page.url().endsWith('/fichas/m/38038.html#g-evolucion'), page.url());
  assert.ok((await page.evaluate(() => scrollY)) > 0, 'el ancla se aplica tras la redirección');
  await page.goto(base + 'ficha.html?municipio=38038');
  await page.waitForSelector('#fuente-g-origen');
  assert.equal(await page.locator('#btn-pdf-a3').count(), 0, 'sin botón de A3: la hoja es la A4 que pidió Pedro');
  await page.locator('.vista').nth(1).click();
  await espera(200);
  assert.equal(await page.locator('#leyenda-piramide').innerText(), 'Hombres españoles\nMujeres españolas\nExtranjeros', 'la leyenda que dictó Pedro');
  // En reposo la pirámide no enseña ninguna cifra (Pedro: «lo de todas las edades no debe salir»);
  // al señalar un grupo, las cifras van dentro del dibujo y la región viva las dice en palabras.
  assert.equal(await page.locator('#lectura-piramide').textContent(), '');
  assert.equal(await page.locator('#marcas-activas text').count(), 0);
  await page.locator('#g-piramide').focus();
  await page.keyboard.press('Home');
  assert.match(await page.locator('#lectura-piramide').textContent(), /^0 a 4 años\. Hombres españoles: .* Extranjeros: hombres .*, mujeres /);
  assert.equal(await page.locator('#marcas-activas text').count(), 2, 'una cifra por lado');
  assert.match(await page.locator('#marcas-activas text').first().textContent(), /^\d+,\d\d\u00a0% · \d+,\d\d\u00a0%$/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#lectura-piramide').textContent(), '');
  // El eje es el par más pequeño que cubre las barras, por pestaña y municipio: Santa Cruz 6 y 6,
  // Artenara 8 y 14, siempre con el tope rotulado. Sin horizontales.
  const rotulosEje = () => page.locator('#eje-piramide text').allTextContents().then((t) => [...new Set(t.map((x) => x.replace(/\s/g, '')))].join(' '));
  assert.equal(await rotulosEje(), '0% 2% 4% 6%');
  assert.equal(await page.locator('#g-piramide line').evaluateAll((ls) => ls.filter((l) => l.getAttribute('y1') === l.getAttribute('y2')).length), 0, 'sin líneas horizontales');
  // La fuente de cada gráfico, con la redacción de Pedro; la de la pirámide sigue a la pestaña.
  assert.equal(await page.locator('#fuente-g-piramide').textContent(), `Fuente: ISTAC. Población según sexo, edad y lugar de nacimiento, ${indice.anio}. Elaboración propia.`);
  await page.locator('.vista').nth(0).click();
  assert.equal(await page.locator('#fuente-g-piramide').textContent(), `Fuente: ISTAC. Población según sexo y grupos de edad, ${indice.anio}. Elaboración propia.`);
  assert.equal(await page.locator('.fuente-grafico').count(), 7, 'siete gráficos con fuente; las cifras clave no la llevan');
  assert.equal(await page.locator('#fuente-g-evolucion').textContent(), `Fuente: ISTAC. Cifras oficiales de población de los municipios, 1996–${indice.anio}.`);
  assert.equal(await page.locator('#fuente-mapas').textContent(), `Fuente: GRAFCAN, límites municipales; ISTAC, cifras de población ${indice.anio}. Elaboración propia.`);
  // Sin desplegables de datos en las tarjetas: la fuente cierra la tarjeta.
  assert.equal(await page.locator('.tarjeta details').count(), 0, 'las tarjetas no llevan desplegable');
  assert.equal(await page.locator('#g-evolucion').evaluate((e) => e.parentElement.lastElementChild.id), 'fuente-g-evolucion');
  // Cada redibujo (ancho nuevo, impresión) conectaba otro manejador de teclado y
  // una flecha saltaba varios grupos. Home + ↑ tiene que dar siempre "5 a 9".
  for (const ancho of [1280, 1000, 375]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await espera(350);
    await page.locator('#g-piramide').focus();
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowUp');
    assert.match(await page.locator('#lectura-piramide').textContent(), /^5 a 9 años/, `ancho ${ancho}`);
    await sinDesborde(page, `ficha a ${ancho}`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await espera(350);
  // Imprimir redibuja la ficha dos veces (beforeprint/afterprint). En WebKit no hay page.pdf:
  // se disparan los mismos eventos, que es a lo que responde el código.
  if (MOTOR === chromium) await page.pdf({ preferCSSPageSize: true });
  else await page.evaluate(() => { dispatchEvent(new Event('beforeprint')); dispatchEvent(new Event('afterprint')); });
  await espera(200);
  await page.locator('#g-piramide').focus();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowUp');
  assert.match(await page.locator('#lectura-piramide').textContent(), /^5 a 9 años/, 'tras imprimir');
  // Artenara: 6,62 % en un grupo sobre el total (eje 8) y 13,85 % entre los nacidos fuera (eje 14).
  await page.selectOption('#sel-municipio', '35005');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Artenara');
  await espera(1000);
  assert.equal(await rotulosEje(), '0% 2% 4% 6% 8%');
  await page.locator('.vista').nth(1).click();
  await espera(1000);
  assert.equal(await rotulosEje(), '0% 2% 4% 6% 8% 10% 12% 14%', 'rótulos de dos en dos, como en el cuaderno de Pedro');
  await page.locator('.vista').nth(0).click();
  await espera(1000);
  await page.selectOption('#sel-municipio', '38038');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Santa Cruz de Tenerife');
  // La evolución también se recorre con teclado.
  await page.locator('#g-evolucion').focus();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('#lectura-evolucion').textContent(), /^1998/);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('ficha: la presentación es modal, atrapa el foco y lo devuelve al botón', async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038');
  await page.waitForSelector('#fuente-g-origen');
  await page.locator('#btn-presentar').click();
  assert.equal(await page.locator('#presentacion').getAttribute('aria-modal'), 'true');
  assert.equal(await page.locator('main').evaluate((e) => e.inert), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Salir de la presentación', 'Mayús+Tab recién abierta va al último botón');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Anterior');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.getElementById('presentacion').contains(document.activeElement)), 'el foco no sale de la presentación');
  }
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await espera(900);
  assert.equal(await page.locator('#pres-contador').textContent(), '4 / 6');
  assert.match(await page.locator('#pres-leyenda').textContent(), /Hombres españolesMujeres españolasExtranjeros/);
  assert.equal(await page.locator('#pres-lectura').count(), 0, 'la presentación tampoco lleva el bloque de lectura');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#pres-piramide text[paint-order]').count(), 2, 'las cifras del grupo, en el dibujo');
  await page.keyboard.press('Escape');
  await espera(150);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'btn-presentar');
  assert.equal(await page.locator('main').evaluate((e) => e.inert), false);
  // Abierta con el ratón y sin nada enfocado (lo que hace Safari), el foco vuelve igual al botón.
  await page.evaluate(() => document.activeElement.blur());
  const caja = await page.locator('#btn-presentar').boundingBox();
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.waitForSelector('#presentacion');
  await page.keyboard.press('Escape');
  await espera(150);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'btn-presentar', 'abierta con el ratón, el foco vuelve al botón');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('ficha: el cambio de municipio no deja fantasmas y con movimiento reducido no hay ninguno', async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038', { movimiento: 'no-preference' });
  await page.waitForSelector('#fuente-g-origen');
  await page.selectOption('#sel-municipio', '38001');
  await espera(150);
  assert.ok((await page.locator('.fantasma').count()) > 0, 'el cruce deja fantasmas mientras dura');
  await espera(1200);
  assert.equal(await page.locator('.fantasma').count(), 0);
  await contexto.close();
  const r = await abrir('ficha.html?municipio=38038');
  await r.page.waitForSelector('#fuente-g-origen');
  await r.page.selectOption('#sel-municipio', '38001');
  await espera(60);
  assert.equal(await r.page.locator('.fantasma').count(), 0);
  assert.deepEqual(errores, []);
  await r.contexto.close();
});

test('comparador: tres plazas con respuestas lentas, sin duplicados, colores fijos por municipio, tabla y contraste', async () => {
  const { page, contexto, errores } = await abrir('comparar.html');
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent.startsWith('0 de 3'));
  await retrasar(page, '**/datos/mun/*.json', 250);
  await page.evaluate(() => {
    const s = document.getElementById('sel-anadir');
    for (const c of ['38038', '38038', '35016', '35007', '35017']) { s.value = c; s.dispatchEvent(new Event('change')); }
  });
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '3 de 3');
  await espera(600);
  assert.equal(await page.locator('[data-quitar]').count(), 3);
  assert.equal(await page.locator('#cmp-cuenta').textContent(), '3 de 3');
  const colores = async () => Object.fromEntries(await page.locator('.cmp-ficha').evaluateAll((els) => els.map((e) => [e.querySelector('button').dataset.quitar, e.style.getPropertyValue('--c')])));
  const antes = await colores();
  assert.equal(new Set(Object.values(antes)).size, 3, 'tres colores distintos');
  await page.locator('[data-quitar="38038"]').click();
  await espera(300);
  const despues = await colores();
  for (const [k, v] of Object.entries(despues)) assert.equal(v, antes[k], `${k} conserva su color al quitar el primero`);
  await page.selectOption('#sel-anadir', '35017');
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '3 de 3');
  await espera(600);
  assert.equal(new Set(Object.values(await colores())).size, 3);
  // Cifras: una tabla de verdad, y ningún nombre en el azul claro (2,1:1).
  assert.equal(await page.locator('table.cmp-tabla th[scope="row"]').count(), 5);
  assert.equal(await page.locator('table.cmp-tabla th[scope="col"]').count(), 4);
  const claros = await page.locator('#cmp-resultado *').evaluateAll((els) => els.filter((e) => e.childElementCount === 0 && e.textContent.trim() && getComputedStyle(e).color === 'rgb(133, 183, 235)').length);
  assert.equal(claros, 0, 'texto en #85B7EB sobre blanco');
  assert.equal(await page.locator('#fuente-cmp-piramides').textContent(), `Fuente: ISTAC. Población según sexo y grupos de edad, ${indice.anio}. Elaboración propia.`);
  assert.equal(await page.locator('#cmp-resultado details').count(), 0, 'el comparador tampoco lleva desplegables');
  for (const ancho of [1280, 375]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await espera(400);
    await sinDesborde(page, `comparador con 3 a ${ancho}`);
  }
  // Con uno y con dos municipios tampoco se desborda ni se rompe la tabla.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('[data-quitar="35007"]').click(); await espera(400);
  assert.equal(await page.locator('table.cmp-tabla th[scope="col"]').count(), 3);
  await page.locator('[data-quitar="35016"]').click(); await espera(400);
  assert.equal(await page.locator('table.cmp-tabla th[scope="col"]').count(), 2);
  const columnas = await page.locator('table.cmp-tabla th[scope="row"]').first().evaluate((e) => e.getBoundingClientRect().width);
  assert.ok(columnas < 220, `la columna de rótulos mide ${columnas} px con un municipio`);
  await sinDesborde(page, 'comparador con 1');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('comparador: el fallo de la carga inicial se ve y se puede reintentar', async () => {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await contexto.newPage();
  await page.route('**/datos/indice.json', (r) => r.abort());
  await page.goto(base + 'comparar.html');
  await page.waitForFunction(() => document.getElementById('estado-comparador').textContent.includes('No se han podido'));
  assert.ok(await page.locator('#estado-comparador').isVisible());
  await page.unroute('**/datos/indice.json');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent.startsWith('0 de 3'));
  await contexto.close();
});

test('portada: las siete islas abren dentro de la pantalla a 320, 375 y 1280, el buscador enseña el foco', async () => {
  const { page, contexto, errores } = await abrir('index.html', { ancho: 375, alto: 812 });
  await page.waitForSelector('.isla-menu');
  for (const ancho of [320, 375, 1280]) {
    await page.setViewportSize({ width: ancho, height: 812 });
    await espera(200);
    for (const boton of await page.locator('.isla-menu > button, .isla-menu > .chip').all()) {
      await boton.click();
      await espera(80);
      const caja = await page.locator('.isla-menu .desplegable:not([hidden])').boundingBox();
      assert.ok(caja && caja.x >= 0 && caja.x + caja.width <= ancho + 0.5, `menú fuera de la pantalla a ${ancho}: ${JSON.stringify(caja)}`);
      await sinDesborde(page, `portada con una isla abierta a ${ancho}`);
      await page.keyboard.press('Escape');
    }
  }
  assert.match(await page.locator('#tapa-anio').textContent(), /^Población a 1 de enero de \d{4}\.$/, 'rótulo de fecha sin atribuir al padrón');
  // Inicio y Fin con la lista abierta y el foco aún en el disparador.
  const chip = page.locator('.isla-menu > button, .isla-menu > .chip').first();
  const cajaChip = await chip.boundingBox();
  await page.mouse.click(cajaChip.x + cajaChip.width / 2, cajaChip.y + cajaChip.height / 2); await espera(80);
  assert.ok(await page.evaluate(() => document.activeElement !== document.body), 'abierta con el ratón, el foco está en el disparador');
  await page.keyboard.press('End');
  const opciones = page.locator('.isla-menu .desplegable:not([hidden]) a');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), await opciones.last().textContent(), 'Fin va a la última opción');
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), await opciones.first().textContent(), 'Inicio va a la primera opción');
  await page.keyboard.press('Escape');
  await page.locator('#buscar').focus();
  assert.notEqual(await page.locator('.buscador').evaluate((e) => getComputedStyle(e).outlineStyle), 'none');
  await page.fill('#buscar', 'guia');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForSelector('#fuente-g-origen');
  assert.match(await page.locator('#nombre').textContent(), /Guía/);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('guía: fuentes cargadas, variación media anual y edad media explicadas', async () => {
  const { page, contexto, errores } = await abrir('guia.html', { ancho: 375, alto: 812 });
  await page.waitForSelector('#detalle-guia-edad');
  assert.ok((await page.locator('.guia-formula').count()) >= 8);
  assert.match(await page.locator('#edad').textContent(), /102 años/);
  assert.match(await page.locator('#extranjero').textContent(), /independencia de su nacionalidad/);
  await sinDesborde(page, 'guía a 375');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('papel: las 88 fichas caben en una A4 y el dossier tiene 98 páginas con su barra', { timeout: 300000, ...SOLO_CHROMIUM }, async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038');
  for (const m of indice.municipios) {
    await page.goto(base + `ficha.html?municipio=${m.codmun}`);
    await page.waitForSelector('#fuente-g-origen');
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.equal(paginasPDF(pdf), 1, `A4 de ${m.nombre}`);
  }
  await page.goto(base + 'ficha.html?municipio=38048');
  await page.waitForSelector('#fuente-g-origen');
  const sitio = await json(path.join(RAIZ, 'sitio.json'));
  assert.equal(await page.locator('.pie-fuentes-papel a').textContent(), (sitio.url_publica + 'guia.html').replace(/^https?:\/\//, ''), 'el pie del papel lleva la dirección de la guía');
  // En la hoja se imprime la fuente de cada gráfico, y la ficha es una A4.
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.fuente-grafico:visible').count(), 7, 'siete fuentes en la hoja');
  assert.ok(await page.locator('.cabecera .pie-fuentes-papel').isVisible(), 'el camino a la guía va en la cabecera de la hoja');
  await page.emulateMedia({ media: null });
  const a4 = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal(paginasPDF(a4), 1);
  const caja = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(a4.toString('latin1'));
  assert.ok(caja && Math.abs(caja[1] / 72 * 25.4 - 210) < 1 && Math.abs(caja[2] / 72 * 25.4 - 297) < 1, `la hoja es una A4 (${caja && caja.slice(1).join(' × ')} pt)`);
  await page.goto(base + 'dossier.html');
  await page.waitForFunction(() => document.getElementById('d-total').textContent === '98 hojas', null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.locator('#d-barra').isVisible(), 'la barra del dossier se ve');
  const guiaDossier = await page.locator('.hoja-texto').first().textContent();
  const comp = (await json(path.join(WEB, 'datos/mun/38038.json'))).componentes;
  const ultimoAnio = Math.max(...comp.anios.filter((a, i) => comp.vegetativo[i] != null || comp.migratorio[i] != null));
  assert.ok(guiaDossier.includes(`hasta ${ultimoAnio}`), 'la guía del dossier calcula el último año de los componentes');
  for (const t of ['Variación media anual', 'Edad media', 'Lugar de nacimiento', 'Población a 1 de enero', 'guia.html']) assert.ok(guiaDossier.includes(t), `la guía del dossier no dice «${t}»`);
  assert.ok(!guiaDossier.includes('adrón'), 'la guía del dossier no atribuye los datos al padrón');
  assert.ok(await page.getByRole('button', { name: 'Imprimir o guardar en PDF' }).isVisible(), 'el botón de imprimir se ve');
  assert.equal(await page.locator('.hoja-ficha .fuente-grafico').count(), 88 * 7, 'cada gráfico del dossier lleva su fuente');
  const desbordan = await page.locator('.hoja').evaluateAll((els) => els.flatMap((e, i) => (e.scrollHeight > e.clientHeight + 1 ? [i + 1] : [])));
  assert.deepEqual(desbordan, [], 'hojas del dossier que se salen');
  const dossier = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal(paginasPDF(dossier), 98);
  assert.deepEqual(errores, []);
  await contexto.close();
});

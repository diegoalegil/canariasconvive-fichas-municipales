/* Batería de interacciones e impresión (Playwright + node:test): última
   selección manda, comparador con tres plazas y sin duplicados, colores
   estables, errores visibles con reintento, portada (cifras junto al título,
   desplegables de isla del mismo alto y dentro de la pantalla, Escape),
   rótulos que no se pisan en el móvil, eje de origen extranjero de 5 en 5 y
   la cifra final sobre la línea de Canarias, teclado tras redibujar e
   imprimir, nada señalado en la hoja impresa, El Hierro sin mapa repetido,
   foco de la presentación, leyenda de la pirámide, redondeo único, la ficha
   de cada isla (sus municipios, los índices de las siete y el mismo
   desplegable para pasar de la isla al municipio), el comparador de islas,
   la portada con una tarjeta por isla, las 88 fichas y las 7 de isla en una
   A4 y el dossier de 101 hojas, la ficha que pinta sin esperar a los mapas,
   los índices con teclado y el alto que la página enmarcada dice al marco.

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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
  // Ninguna página pide nada fuera de la web: ni tipografía ni recursos de terceros.
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:')) errores.push('petición externa: ' + u); });
  page.on('response', (r) => { if (r.status() >= 400) errores.push(`respuesta ${r.status()}: ${r.url()}`); });
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
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('700 16px Montserrat') && [...document.fonts].some((f) => f.family === 'Montserrat' && f.status === 'loaded')), 'Montserrat carga desde web/fonts/');
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
  await page.locator('.vista').nth(1).click();
  await espera(200);
  assert.equal(await page.locator('.vista').nth(1).textContent(), 'Municipio: Según origen', 'el nombre de la pestaña que dictó Pedro, con su mayúscula');
  assert.equal(await page.locator('#leyenda-piramide').innerText(), 'Hombres españoles\nMujeres españolas\nExtranjeros', 'la leyenda que dictó Pedro');
  // En reposo la pirámide no enseña ninguna cifra; al señalar un grupo, las cifras van
  // dentro del dibujo y la región viva las dice en palabras.
  assert.equal(await page.locator('#lectura-piramide').textContent(), '');
  assert.equal(await page.locator('#marcas-activas text').count(), 0);
  await page.locator('#g-piramide').focus();
  await page.keyboard.press('Home');
  assert.match(await page.locator('#lectura-piramide').textContent(), /^0 a 4 años\. Hombres españoles: .* Extranjeros: hombres .*, mujeres /);
  assert.equal(await page.locator('#marcas-activas text').count(), 2, 'una cifra por lado');
  assert.match(await page.locator('#marcas-activas text').first().textContent(), /^\d+,\d\d\u00a0% · \d+,\d\d\u00a0%$/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#lectura-piramide').textContent(), '');
  // El eje es el entero más pequeño que cubre las barras, por pestaña y municipio: Santa Cruz 5 y 6,
  // Artenara 7 y 14, siempre con el tope rotulado y sin el múltiplo anterior si queda pegado. Sin horizontales.
  const rotulosEje = () => page.locator('#eje-piramide text').allTextContents().then((t) => [...new Set(t.map((x) => x.replace(/\s/g, '')))].join(' '));
  assert.equal(await rotulosEje(), '0% 2% 4% 6%');
  assert.equal(await page.locator('#g-piramide line').evaluateAll((ls) => ls.filter((l) => l.getAttribute('y1') === l.getAttribute('y2')).length), 0, 'sin líneas horizontales');
  // La fuente de cada gráfico, con la redacción de Pedro; la de la pirámide sigue a la pestaña.
  assert.equal(await page.locator('#fuente-g-piramide').textContent(), `Fuente: ISTAC. Población según sexo, edad y lugar de nacimiento, ${indice.anio}.`);
  await page.locator('.vista').nth(0).click();
  assert.equal(await page.locator('#fuente-g-piramide').textContent(), `Fuente: ISTAC. Población según sexo y grupos de edad, ${indice.anio}.`);
  assert.equal(await page.locator('.fuente-grafico').count(), 7, 'siete gráficos con fuente; las cifras clave no la llevan');
  assert.equal(await page.locator('#fuente-g-evolucion').textContent(), `Fuente: ISTAC. Cifras oficiales de población de los municipios, 1996–${indice.anio}.`);
  assert.equal(await page.locator('#fuente-mapas').textContent(), `Fuente: GRAFCAN, límites municipales; ISTAC, cifras de población ${indice.anio}.`);
  assert.equal(await page.locator('#fuente-g-indices').textContent(), `Fuente: ISTAC. Población según sexo y edades, ${indice.anio}.`);
  assert.equal(await page.locator('.fuente-grafico').evaluateAll((ps) => ps.filter((p) => p.textContent.includes('Elaboración propia')).length), 0, 'ninguna fuente dice «Elaboración propia»');
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
    const [relleno, barra] = await page.evaluate(() => [parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop), document.querySelector('.barra').getBoundingClientRect().height]);
    assert.ok(relleno >= barra, `a ${ancho} las anclas quedarían bajo la barra: scroll-padding ${relleno} < barra ${barra}`);
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
  // Santa Cruz en la primera pestaña: 4,51 % en el grupo mayor, eje 5 (el 4 queda pegado y no se rotula).
  assert.equal(await rotulosEje(), '0% 2% 5%');
  // Alajeró, según origen: eje 9 (impar por encima de 8): el tope se dibuja y se rotula igualmente.
  await page.selectOption('#sel-municipio', '38003');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Alajeró');
  await espera(1000);
  await page.locator('.vista').nth(1).click();
  await espera(1000);
  assert.equal(await rotulosEje(), '0% 2% 4% 6% 9%', 'eje impar con el tope rotulado (el 8 queda pegado)');
  await page.locator('.vista').nth(0).click();
  await espera(600);
  // Artenara: 6,62 % en un grupo sobre el total (eje 7) y 13,85 % entre los nacidos fuera (eje 14).
  await page.selectOption('#sel-municipio', '35005');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Artenara');
  await espera(1000);
  assert.equal(await rotulosEje(), '0% 2% 4% 7%');
  await page.locator('.vista').nth(1).click();
  await espera(1000);
  assert.equal(await rotulosEje(), '0% 2% 4% 6% 8% 10% 12% 14%', 'rótulos de dos en dos, como en el cuaderno de Pedro');
  // En el móvil van de cuatro en cuatro y el tope se rotula sin el 12 pegado («14 %12 %»),
  // anclado hacia dentro para que no se salga del dibujo.
  await page.setViewportSize({ width: 375, height: 900 });
  await espera(500);
  assert.equal(await rotulosEje(), '0% 4% 8% 14%');
  assert.deepEqual(await solapes(page, '#eje-piramide text'), [], 'rótulos del eje de la pirámide que se pisan a 375');
  assert.ok(await page.locator('#eje-piramide text').evaluateAll((ts) => ts.every((t) => { const r = t.getBoundingClientRect(), s = t.ownerSVGElement.getBoundingClientRect(); return r.left >= s.left - 0.5 && r.right <= s.right + 0.5; })), 'ningún rótulo del eje se sale del dibujo');
  await page.setViewportSize({ width: 1280, height: 900 });
  await espera(500);
  await page.locator('.vista').nth(0).click();
  await espera(1000);
  await page.selectOption('#sel-municipio', '38038');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Santa Cruz de Tenerife');
  await espera(300);
  // Hombres de 100 o más en Santa Cruz: 9 personas, que no son «0,00 %».
  await page.locator('#g-piramide').focus();
  await page.keyboard.press('End');
  assert.match(await page.locator('#lectura-piramide').textContent(), /^100 o más años\. Hombres: < 0,01\u00a0%;/);
  await page.keyboard.press('Escape');
  // Una franja fijada con el clic no se pierde al redibujar ni se imprime. La fila de 90 a 94
  // tiene barras cortas: la cifra cabe fuera con holgura, sea cual sea la medida del texto.
  await page.locator('.franja[data-i="18"]').click();
  await espera(150);
  assert.equal(await page.evaluate(() => FILA), 18);
  const cajas = await page.locator('#marcas-activas text').evaluateAll((ts) => ts.map((t) => t.getBoundingClientRect().right));
  const barra = await page.locator('#ph18').evaluate((b) => b.getBoundingClientRect().left);
  assert.ok(cajas[0] < barra, 'la cifra de la izquierda cae fuera de la barra cuando cabe');
  // En la fila más larga la cifra no cabe fuera en una línea: va en dos líneas junto a la punta (puede
  // salir un poco del dibujo, sobre el relleno de la tarjeta) o dentro de la barra pegada a la punta; nunca en la base.
  const larga = await page.evaluate(() => { const r = [...document.querySelectorAll('#g-piramide rect[id^="ph"]')]; return r.reduce((m, b) => +b.getAttribute('width') > +m.getAttribute('width') ? b : m).id.slice(2); });
  await page.locator(`.franja[data-i="${larga}"]`).click();
  await espera(150);
  const dentro = await page.evaluate((i) => {
    const t = document.querySelector('#marcas-activas text[data-sg="-1"]'), b = document.getElementById('ph' + i);
    const rt = t.getBoundingClientRect(), rb = b.getBoundingClientRect(), svg = t.ownerSVGElement.getBoundingClientRect();
    return { cerca: rt.right <= rb.left + 1 || Math.abs(rt.left - rb.left) < 12, enBase: rt.right > rb.right - 20, fuera: rt.left < svg.left - 24, apilada: !!t.dataset.apilada };
  }, larga);
  assert.deepEqual(dentro, { cerca: true, enBase: false, fuera: false, apilada: true }, `fila ${larga}: ${JSON.stringify(dentro)}`);
  await page.locator(`.franja[data-i="18"]`).click();
  await espera(150);
  await page.setViewportSize({ width: 1100, height: 900 });
  await espera(500);
  await page.locator('.franja[data-i="3"]').hover();
  assert.equal(await page.evaluate(() => FILA), 18, 'tras redibujar, el ratón no cambia la franja fijada');
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await espera(150);
  assert.equal(await page.locator('#marcas-activas text').count(), 0, 'en la hoja no hay franja señalada');
  assert.equal(await page.locator('#franja-activa').getAttribute('opacity'), '0');
  assert.equal(await page.locator('#g-componentes svg text').evaluateAll((ts) => ts.map((t) => t.textContent).filter((t) => /^20\d\d$/.test(t)).length), 12, 'en la hoja el eje de componentes va cada dos años, con 2002');
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  await espera(150);
  assert.equal(await page.evaluate(() => FILA), 18, 'la franja fijada vuelve tras imprimir');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 900 });
  await espera(500);
  // La evolución también se recorre con teclado.
  await page.locator('#g-evolucion').focus();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('#lectura-evolucion').textContent(), /^1998/);
  // Origen extranjero: eje de 5 en 5 (Pedro), la cifra del último año por encima de la
  // línea de Canarias (Hermigua la llevaba atravesada) y, por encima del 40 %, rótulos cada 10.
  const ejeExtranjero = () => page.locator('#g-extranjero svg text').evaluateAll((ts) => {
    const pct = ts.map((t) => t.textContent.replace(/\s/g, '')).filter((t) => t.endsWith('%'));
    return { eje: pct.filter((t) => !t.includes(',')).join(' '), ultimo: pct.find((t) => t.includes(',')) };
  });
  assert.deepEqual(await ejeExtranjero(), { eje: '0% 5% 10% 15% 20% 25%', ultimo: '18,8%' });
  await page.selectOption('#sel-municipio', '38021');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Hermigua');
  await espera(400);
  assert.deepEqual(await ejeExtranjero(), { eje: '0% 5% 10% 15% 20% 25%', ultimo: '20,3%' });
  const cruce = await page.evaluate(() => {
    const svg = document.querySelector('#g-extranjero svg'), t = [...svg.querySelectorAll('text')].find((x) => x.textContent.includes(',')), r = t.getBoundingClientRect();
    const m = svg.querySelector('polyline').getScreenCTM();
    return svg.querySelector('polyline').getAttribute('points').split(' ').map((p) => p.split(',').map(Number))
      .filter(([x, y]) => { const px = m.a * x + m.e, py = m.d * y + m.f; return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom; }).length;
  });
  assert.equal(cruce, 0, 'la línea de Canarias no pasa por la cifra');
  await page.selectOption('#sel-municipio', '38001');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Adeje');
  await espera(400);
  assert.deepEqual(await ejeExtranjero(), { eje: '0% 10% 20% 30% 40% 50% 60%', ultimo: '56,5%' }, 'por encima del 40 %, rótulos cada 10 con la rejilla cada 5');
  // En El Hierro la comarca es la isla: dos mapas y migas sin repetir; el tercer mapa dice «en la comarca».
  assert.deepEqual(await page.locator('.mapa-pie span').allTextContents().then((t) => t.filter((x) => x.startsWith('en '))), ['en Canarias', 'en Tenerife', 'en la comarca']);
  assert.deepEqual(await page.locator('.mapa-pie > span').first().evaluate((s) => [getComputedStyle(s).fontWeight, getComputedStyle(s).color]), ['700', 'rgb(26, 26, 26)'], 'la unidad territorial en negrita negra');
  assert.match(await page.locator('.mapa-pie b').first().textContent(), /^\d+\.º de \d+$/, 'ordinal con punto');
  // La Oliva: el tope del eje no es múltiplo de 10 y se rotula igualmente, sin el 50 pegado; y las
  // tablas ocultas llevan la serie entera para el lector de pantalla.
  await page.selectOption('#sel-municipio', '35014');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'La Oliva');
  await espera(400);
  const oliva = await json(path.join(WEB, 'datos/mun/35014.json'));
  const tope = Math.ceil(Math.max(...oliva.extranjero.municipio.concat(oliva.extranjero.canarias).filter((v) => v != null)) / 5) * 5;
  assert.equal(tope % 10, 5, 'La Oliva sigue teniendo un tope que no es múltiplo de 10');
  const esperado = [...Array(tope / 5 + 1).keys()].map((k) => k * 5).filter((v) => v === tope || (v % 10 === 0 && tope - v >= 10)).map((v) => `${v}%`).join(' ');
  assert.equal((await ejeExtranjero()).eje, esperado, 'el tope siempre rotulado');
  assert.equal(await page.locator('#g-extranjero .oculto tbody tr').count(), oliva.extranjero.anios.length);
  assert.equal(await page.locator('#g-componentes .oculto tbody tr').count(), oliva.componentes.anios.filter((a) => a >= 2002).length);
  // El eje de componentes: cada lado con su tope (Güímar baja poco y su lado negativo es corto).
  await page.selectOption('#sel-municipio', '38020');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Güímar');
  await espera(400);
  const ejeComp = await page.locator('#g-componentes svg text').evaluateAll((ts) => ts.map((t) => t.textContent).filter((t) => !/^20\d\d$/.test(t)).map((t) => parseInt(t.replace(/\./g, ''), 10)));
  const comp = (await json(path.join(WEB, 'datos/mun/38020.json'))).componentes;
  const serie = comp.anios.flatMap((a, i) => a >= 2002 ? [comp.vegetativo[i], comp.migratorio[i]] : []).filter((v) => v != null);
  assert.ok(Math.max(...ejeComp) >= Math.max(...serie) && Math.min(...ejeComp) <= Math.min(...serie), `el eje cubre las barras: ${ejeComp}`);
  assert.ok(-Math.min(...ejeComp) < Math.max(...ejeComp) / 2, `el lado negativo se ajusta a sus barras: ${ejeComp}`);
  // Tías: municipio y Canarias empatan a 41,6 en dependencia y llevan el mismo tono.
  await page.selectOption('#sel-municipio', '35028');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Tías');
  await espera(400);
  const tonos = await page.locator('#g-indices .indice').nth(2).locator('.peldano').evaluateAll((ps) => ps.map((p) => [p.querySelector('b').textContent, p.querySelector('i').style.background]));
  assert.deepEqual(tonos.map((t) => t[0]), ['37,2', '41,6', '41,6']);
  assert.equal(tonos[1][1], tonos[2][1], 'el mismo valor, el mismo tono');
  assert.notEqual(tonos[0][1], tonos[1][1]);
  await page.selectOption('#sel-municipio', '38013');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Frontera');
  await espera(400);
  assert.equal(await page.locator('#migas').textContent(), 'El Hierro');
  assert.equal(await page.locator('#mapas figure').count(), 2);
  assert.ok(await page.locator('#mapas').evaluate((e) => e.classList.contains('dos')));
  assert.deepEqual(errores, []);
  await contexto.close();
});

/** Pares de textos SVG cuyas cajas se solapan. */
const solapes = (page, selector) => page.locator(selector).evaluateAll((ts) => {
  const r = ts.map((t) => [t.textContent.trim(), t.getBoundingClientRect()]), out = [];
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i][1], b = r[j][1];
    if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) out.push([r[i][0], r[j][0]]);
  }
  return out;
});

test('ficha de isla: sus municipios, los índices de las siete islas y el paso de la isla al municipio', async () => {
  const sitio = await json(path.join(RAIZ, 'sitio.json'));
  // Se entra por el envoltorio estático i/<isla>.html, que redirige a la ficha.
  const { page, contexto, errores } = await abrir('i/tenerife.html');
  await page.waitForSelector('#fuente-g-origen');
  assert.equal(await page.locator('#nombre').textContent(), 'Tenerife');
  assert.ok(page.url().endsWith('/fichas/i/tenerife.html'), page.url());
  assert.equal(await page.locator('#sel-municipio').inputValue(), 'isla:tenerife');
  assert.equal(await page.locator('#migas').textContent(), 'Canarias · 31 municipios');
  assert.equal(await page.locator('#btn-comparar').evaluate((a) => a.href), base + 'comparar.html?i=tenerife');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), sitio.url_publica + 'i/tenerife.html');
  const envoltorio = await fs.readFile(path.join(WEB, 'i/tenerife.html'), 'utf8');
  assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), /<meta property="og:description" content="([^"]*)">/.exec(envoltorio)[1]);
  assert.deepEqual(await page.locator('.vista').allTextContents(), ['Isla y Canarias', 'Isla: Según origen'], 'las pestañas dicen «Isla»');
  // Sus municipios: el enunciado de Pedro, los 31 de mayor a menor población, cada uno con enlace a su ficha.
  assert.equal(await page.locator('#sub-municipios').textContent(), 'Los 31 municipios de la isla y su peso demográfico de mayor a menor');
  const filas = await page.locator('.lista-mun li').evaluateAll((ls) => ls.map((l) => [l.querySelector('a').href, parseInt(l.querySelector('b').textContent.replace(/\./g, ''), 10)]));
  assert.equal(filas.length, 31);
  assert.ok(filas.every((f, i) => !i || f[1] <= filas[i - 1][1]), 'de mayor a menor');
  assert.equal(filas[0][0], base + 'm/38038.html');
  // La isla en Canarias (puesto de 7 y peso) y la isla con sus municipios.
  await page.waitForSelector('#mapas path');
  assert.equal(await page.locator('#mapas figure').count(), 2);
  assert.equal(await page.locator('.mapa-pie b').first().textContent(), '1.º de 7');
  await page.locator('.lista-mun li').first().hover();
  assert.equal(await page.locator('#mapas path[data-codmun="38038"]').getAttribute('fill'), '#185FA5', 'señalar un municipio lo destaca en el mapa');
  assert.equal(await page.locator('#mapas figure').first().locator('path[data-codmun]').count(), 0, 'el mapa de Canarias no lleva códigos: no responde al ratón');
  await page.locator('#mapas path[data-codmun="38001"]').hover();
  assert.equal(await page.locator('.lista-mun li.foco').getAttribute('data-codmun'), '38001', 'señalar en el mapa marca la fila');
  await page.mouse.move(5, 5);
  await espera(100);
  assert.equal(await page.locator('#mapas path[data-codmun="38001"]').getAttribute('fill'), '#85B7EB', 'al salir de los mapas se suelta el resaltado');
  assert.equal(await page.locator('.lista-mun li.foco').count(), 0);
  // Índices: las siete islas y Canarias de menor a mayor, la isla en azul.
  const escalera = await page.locator('.indice-isla').first().locator('.tramo').evaluateAll((ts) => ts.map((t) => [t.querySelector('span').textContent, parseFloat(t.querySelector('b').textContent.replace(',', '.')), t.classList.contains('propia')]));
  assert.equal(escalera.length, 8);
  assert.ok(escalera.every((e, i) => !i || e[1] >= escalera[i - 1][1]), 'de menor a mayor');
  assert.deepEqual(escalera.filter((e) => e[2]).map((e) => e[0]), ['Tenerife']);
  assert.equal(await page.locator('.fuente-grafico').count(), 8, 'ocho fuentes: la lista de municipios lleva la suya');
  assert.equal(await page.locator('#fuente-g-evolucion').textContent(), `Fuente: ISTAC. Cifras oficiales de población de las islas, 2000–${indice.anio}.`);
  assert.equal(await page.locator('.anillo h3').first().textContent(), 'Isla');
  assert.match(await page.locator('.cifra').nth(1).textContent().then((t) => t.replace(/\s+/g, ' ').trim()), /^\d+,\d años Edad media$/, 'la isla lleva su edad media');
  for (const ancho of [375, 1280]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await espera(400);
    await sinDesborde(page, `ficha de isla a ${ancho}`);
  }
  // La presentación: la escalera de las siete islas en los cuatro índices.
  await page.locator('#btn-presentar').click();
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
  await espera(700);
  assert.equal(await page.locator('.pres-indices-isla .tramo').count(), 32);
  assert.match(await page.locator('#presentacion .pres-kicker').textContent(), /31 municipios/);
  await page.keyboard.press('Escape');
  await espera(150);
  // De la isla al municipio y del municipio a otra isla, con el mismo desplegable.
  await page.selectOption('#sel-municipio', '38001');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Adeje');
  await espera(700);
  assert.ok(page.url().endsWith('/fichas/m/38001.html'), page.url());
  assert.equal(await page.locator('#sec-municipios').isHidden(), true, 'la tarjeta de municipios solo va en la isla');
  assert.equal(await page.locator('#mapas figure').count(), 3);
  assert.deepEqual(await page.locator('.vista').allTextContents(), ['Municipio y Canarias', 'Municipio: Según origen']);
  assert.equal(await page.locator('.fuente-grafico').count(), 7);
  assert.equal(await page.locator('#sub-indices').textContent(), 'Los tres ámbitos, ordenados de menor a mayor valor');
  await page.selectOption('#sel-municipio', 'isla:el-hierro');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'El Hierro');
  await espera(700);
  assert.ok(page.url().endsWith('/fichas/i/el-hierro.html'), page.url());
  assert.equal(await page.locator('.lista-mun li').count(), 3);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('fichas de Canarias y de provincia: sin referencia repetida, sus provincias e islas, y el paso entre ámbitos', async () => {
  const sitio = await json(path.join(RAIZ, 'sitio.json'));
  // Canarias entra por su envoltorio r/canarias.html.
  const { page, contexto, errores } = await abrir('r/canarias.html');
  await page.waitForSelector('#fuente-g-origen');
  assert.equal(await page.locator('#nombre').textContent(), 'Canarias');
  assert.ok(page.url().endsWith('/fichas/r/canarias.html'), page.url());
  assert.equal(await page.locator('#sel-municipio').inputValue(), 'canarias');
  assert.equal(await page.locator('#migas').textContent(), '2 provincias · 7 islas · 88 municipios');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), sitio.url_publica + 'r/canarias.html');
  const envoltorio = await fs.readFile(path.join(WEB, 'r/canarias.html'), 'utf8');
  assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), /<meta property="og:description" content="([^"]*)">/.exec(envoltorio)[1]);
  assert.equal(await page.locator('#sub-evolucion').textContent(), `Habitantes, 2000–${indice.anio}`, 'la serie regional va acotada como la de las islas');
  // La propia es la referencia: la pirámide va sin marco negro, el origen extranjero sin la línea de Canarias y un solo anillo.
  assert.deepEqual(await page.locator('.vista').allTextContents(), ['Canarias', 'Canarias: Según origen']);
  assert.equal(await page.locator('#leyenda-piramide .llave').count(), 2, 'la leyenda de la pirámide no lleva marco');
  assert.equal(await page.locator('#g-piramide path[stroke="#1A1A1A"]:not([d=""])').count(), 0, 'sin marco negro');
  assert.equal(await page.locator('#g-extranjero polyline').count(), 0, 'sin línea de referencia');
  assert.equal(await page.locator('#leyenda-extranjero').textContent(), '');
  assert.deepEqual(await page.locator('#g-extranjero table thead th').allTextContents(), ['Año', 'Canarias'], 'la tabla oculta no repite la columna');
  assert.equal(await page.locator('#g-origen .anillo').count(), 1);
  await page.locator('#g-piramide').focus(); await page.keyboard.press('ArrowUp'); await espera(150);
  assert.match(await page.locator('#lectura-piramide').textContent(), /^0 a 4 años\. Hombres: [\d,]+\u00a0%; Mujeres: [\d,]+\u00a0%\.$/, 'la lectura no nombra el marco');
  assert.equal(await page.locator('#marcas-activas rect').count(), 0, 'sin marcadores del marco');
  await page.locator('.vista').nth(1).click(); await espera(900);
  assert.equal(await page.locator('#leyenda-piramide .llave').count(), 3, 'según origen sí lleva el marco de extranjeros');
  await page.keyboard.press('Escape');
  // Sus provincias (con el tono del mapa) y sus islas, de mayor a menor, con enlace a su ficha.
  assert.equal(await page.locator('#tit-entorno').textContent(), 'Sus provincias');
  assert.equal(await page.locator('#tit-municipios').textContent(), 'Sus islas');
  assert.equal(await page.locator('#sub-municipios').textContent(), 'Las siete islas y su peso demográfico de mayor a menor');
  const provincias = await page.locator('#g-provincias li').evaluateAll((ls) => ls.map((l) => [l.querySelector('a').href, l.querySelector('.tono').style.background, l.querySelector('span').textContent]));
  assert.deepEqual(provincias.map((p) => p[0]), [base + 'p/las-palmas.html', base + 'p/santa-cruz-de-tenerife.html']);
  assert.deepEqual(provincias.map((p) => p[1]), ['rgb(24, 95, 165)', 'rgb(133, 183, 235)']);
  const islas = await page.locator('#g-municipios li').evaluateAll((ls) => ls.map((l) => [l.querySelector('a').href, parseInt(l.querySelector('b').textContent.replace(/\./g, ''), 10)]));
  assert.equal(islas.length, 7);
  assert.ok(islas.every((f, i) => !i || f[1] <= islas[i - 1][1]), 'de mayor a menor');
  assert.equal(islas[0][0], base + 'i/tenerife.html');
  await page.waitForSelector('#mapas path');
  assert.equal(await page.locator('#mapas figure').count(), 1);
  assert.equal(await page.locator('#mapas .mapa-pie').count(), 0, 'sin pie: la lista de provincias va debajo');
  assert.equal(await page.locator('#mapas path[data-provincia="Las Palmas"]').first().getAttribute('fill'), '#185FA5', 'cada provincia va de su tono');
  await page.locator('#g-municipios li[data-isla="El Hierro"]').hover();
  assert.equal(await page.locator('#mapas path[data-isla="El Hierro"]').first().getAttribute('fill'), '#185FA5', 'señalar una isla la destaca en el archipiélago');
  await page.mouse.move(5, 5); await espera(100);
  assert.equal(await page.locator('#mapas path[data-isla="El Hierro"]').first().getAttribute('fill'), '#85B7EB', 'y al salir recupera el tono de su provincia');
  // Índices: las siete islas y Canarias, y Canarias es la propia.
  const escalera = await page.locator('.indice-isla').first().locator('.tramo').evaluateAll((ts) => ts.map((t) => [t.querySelector('span').textContent, t.classList.contains('propia')]));
  assert.equal(escalera.length, 8);
  assert.deepEqual(escalera.filter((e) => e[1]).map((e) => e[0]), ['Canarias']);
  assert.equal(await page.locator('.fuente-grafico').count(), 8);
  assert.equal(await page.locator('#fuente-g-evolucion').textContent(), `Fuente: ISTAC. Cifras oficiales de población de Canarias, 2000–${indice.anio}.`);
  for (const ancho of [375, 1280]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await espera(400);
    await sinDesborde(page, `ficha de Canarias a ${ancho}`);
  }
  // A la provincia: sus islas, sus 54 municipios con su mapa, «Provincia» en la escalera y el peso sin puesto.
  await page.selectOption('#sel-municipio', 'provincia:santa-cruz-de-tenerife');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Santa Cruz de Tenerife');
  await espera(800);
  assert.ok(page.url().endsWith('/fichas/p/santa-cruz-de-tenerife.html'), page.url());
  assert.equal(await page.locator('#migas').textContent(), 'Canarias · 4 islas · 54 municipios');
  assert.deepEqual(await page.locator('.vista').allTextContents(), ['Provincia y Canarias', 'Provincia: Según origen']);
  assert.equal(await page.locator('#leyenda-piramide .llave').count(), 3, 'la provincia sí lleva el marco de Canarias');
  assert.equal(await page.locator('#sub-municipios').textContent(), 'Las 4 islas de la provincia y su peso demográfico de mayor a menor');
  assert.equal(await page.locator('#g-municipios li').count(), 4);
  assert.equal(await page.locator('#sub-municipios-provincia').textContent(), 'Los 54 municipios de la provincia y su peso demográfico de mayor a menor');
  assert.equal(await page.locator('#g-municipios-provincia li').count(), 54);
  assert.equal(await page.locator('#mapa-provincia path[data-codmun]').count(), 54, 'sus islas con los términos municipales, junto a la lista');
  await page.locator('#g-municipios-provincia li[data-codmun="38001"]').hover();
  assert.equal(await page.locator('#mapa-provincia path[data-codmun="38001"]').getAttribute('fill'), '#185FA5');
  assert.match(await page.locator('.mapa-pie').first().textContent().then((x) => x.replace(/\s+/g, ' ').trim()), /^\d+,\d\d % de la población de Canarias$/, 'solo el peso: entre dos provincias no hay puesto');
  const tramos = await page.locator('.indice-isla').first().locator('.tramo').evaluateAll((ts) => ts.map((t) => [t.querySelector('span').textContent, t.classList.contains('propia')]));
  assert.equal(tramos.length, 6, 'sus cuatro islas, la provincia y Canarias');
  assert.deepEqual(tramos.filter((e) => e[1]).map((e) => e[0]), ['Provincia']);
  assert.equal(await page.locator('.fuente-grafico').count(), 9, 'nueve fuentes: las dos listas llevan la suya');
  assert.equal(await page.locator('#btn-comparar').evaluate((a) => a.href), base + 'comparar.html?p=santa-cruz-de-tenerife');
  // Y de la provincia a un municipio: la ficha vuelve a la forma municipal.
  await page.selectOption('#sel-municipio', '38001');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Adeje');
  await espera(700);
  assert.equal(await page.locator('#sec-municipios-provincia').isHidden(), true);
  assert.equal(await page.locator('#g-provincias').textContent(), '');
  assert.equal(await page.locator('#mapas figure').count(), 3);
  assert.equal(await page.locator('#leyenda-piramide .llave').count(), 3);
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('ficha: pinta sin esperar a los mapas, los índices se recorren con teclado y las filas de la pirámide miden 24 px', async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038');
  // La geometría tarda: la ficha entera está pintada, con un hueco del tamaño de cada mapa y su pie.
  await retrasar(page, '**/datos/geo/municipios.json', 1500);
  await page.goto(base + 'ficha.html?municipio=38038');
  await page.waitForSelector('#fuente-g-origen');
  assert.equal(await page.locator('#mapas path').count(), 0, 'los mapas aún no han llegado');
  assert.equal(await page.locator('#mapas .mapa-hueco').count(), 3, 'un hueco por mapa');
  assert.equal(await page.locator('.mapa-pie b').first().textContent(), '2.º de 88', 'el pie va desde el principio (Santa Cruz es el segundo de Canarias)');
  assert.ok((await page.locator('#g-piramide rect[id^="ph"]').count()) === 21, 'la pirámide está pintada');
  await page.waitForSelector('#mapas path', { timeout: 5000 });
  assert.equal(await page.locator('#mapas .mapa-hueco').count(), 0, 'al llegar la geometría, los huecos son mapas');
  await page.unroute('**/datos/geo/municipios.json');
  // Si la geometría falla, la ficha se ve igual y se ofrece reintentar los mapas.
  await page.route('**/datos/geo/municipios.json', (r) => r.abort());
  await page.goto(base + 'ficha.html?municipio=38001');
  await page.waitForSelector('#fuente-g-origen');
  await page.waitForFunction(() => document.getElementById('estado-ficha').textContent.includes('mapas'));
  assert.equal(await page.locator('#nombre').textContent(), 'Adeje');
  await page.unroute('**/datos/geo/municipios.json');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await page.waitForSelector('#mapas path');
  assert.ok(await page.locator('#estado-ficha').isHidden(), 'el aviso se va al llegar los mapas');
  // Cada fila de la pirámide es un objetivo de puntero de al menos 24 px.
  const filas = await page.locator('#g-piramide .franja').evaluateAll((fs) => fs.map((f) => f.getBoundingClientRect().height));
  assert.ok(filas.length === 21 && Math.min(...filas) >= 24, `filas de ${Math.min(...filas).toFixed(2)} px`);
  // Los índices: el bloque se enfoca, las flechas señalan un ámbito en los cuatro, Enter fija, Escape suelta.
  await page.locator('#g-indices').focus();
  await page.keyboard.press('ArrowDown');
  let focos = await page.locator('#g-indices .peldano.foco').evaluateAll((ps) => ps.map((p) => p.dataset.ambito));
  assert.equal(focos.length, 4, 'el ámbito señalado se resalta en los cuatro índices');
  assert.equal(new Set(focos).size, 1);
  const primero = focos[0];
  await page.keyboard.press('ArrowDown');
  focos = await page.locator('#g-indices .peldano.foco').evaluateAll((ps) => ps.map((p) => p.dataset.ambito));
  assert.equal(focos.length, 4); assert.notEqual(focos[0], primero, 'la segunda flecha pasa al siguiente ámbito');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#g-indices').evaluate((e) => e.dataset.fijo), focos[0], 'Enter fija el ámbito');
  await page.locator('#g-piramide').focus();
  assert.equal(await page.locator('#g-indices .peldano.foco').count(), 4, 'fijado, sobrevive a perder el foco');
  await page.locator('#g-indices').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#g-indices .peldano.foco').count(), 0, 'Escape suelta');
  assert.equal(await page.locator('#g-indices').evaluate((e) => e.dataset.fijo), '');
  // Enmarcada en la propia web, la página dice su alto al marco.
  const marco = `<!DOCTYPE html><html><body><iframe id="f" src="${base}ficha.html?municipio=38038" width="1000" height="300"></iframe>
    <script>addEventListener('message', (e) => { if (e.data && e.data.fichas === 'alto') document.title = 'alto:' + e.data.alto; });</script></body></html>`;
  await page.route(base + 'marco.html', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: marco }));
  await page.goto(base + 'marco.html');
  await page.waitForFunction(() => document.title.startsWith('alto:'), null, { timeout: 15000 });
  assert.ok(parseInt(await page.title().then((t) => t.slice(5)), 10) > 1000, `el marco recibe el alto de la ficha (${await page.title()})`);
  assert.deepEqual(errores.filter((e) => !e.includes('Failed to load resource')), []);
  await contexto.close();
});

test('ficha en el móvil: los rótulos de evolución y componentes no se pisan ni tapan la curva', async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038', { ancho: 375, alto: 812 });
  await page.waitForSelector('#fuente-g-origen');
  for (const cod of ['38038', '38006', '38001', '35005']) {
    if (cod !== '38038') {
      await page.selectOption('#sel-municipio', cod);
      await page.waitForFunction((c) => document.getElementById('sel-municipio').value === c && document.getElementById('nombre').textContent !== '', cod);
      await espera(700);
    }
    for (const ancho of [320, 375, 414]) {
      await page.setViewportSize({ width: ancho, height: 812 });
      await espera(400);
      // El rótulo «Variación acumulada…» queda por encima de la rejilla, sin puntos de la curva debajo.
      const ev = await page.evaluate(() => {
        const svg = document.querySelector('#g-evolucion svg'), t = [...svg.querySelectorAll('text')].find((x) => x.textContent.startsWith('Variación'));
        const r = t.getBoundingClientRect(), s = svg.getBoundingClientRect(), m = svg.querySelector('polyline').getScreenCTM();
        const rejilla = Math.min(...[...svg.querySelectorAll('line')].map((l) => +l.getAttribute('y1'))) * m.d + m.f;
        const bajo = svg.querySelector('polyline').getAttribute('points').split(' ').map((p) => p.split(',').map(Number))
          .filter(([x, y]) => { const px = m.a * x + m.e, py = m.d * y + m.f; return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom; }).length;
        return { bajo, dentro: r.bottom <= rejilla + 0.5, arriba: r.top >= s.top - 0.5 };
      });
      assert.deepEqual(ev, { bajo: 0, dentro: true, arriba: true }, `${cod} a ${ancho}: rótulo de evolución ${JSON.stringify(ev)}`);
      assert.deepEqual(await solapes(page, '#g-evolucion svg text'), [], `${cod} a ${ancho}: textos de evolución que se pisan`);
      assert.deepEqual(await solapes(page, '#g-componentes svg text'), [], `${cod} a ${ancho}: años de componentes que se pisan`);
      assert.deepEqual(await solapes(page, '#g-extranjero svg text'), [], `${cod} a ${ancho}: textos de origen extranjero que se pisan`);
    }
  }
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('ficha: la presentación es modal, atrapa el foco y lo devuelve al botón', async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038');
  await page.waitForSelector('#fuente-g-origen');
  await page.locator('#btn-presentar').click();
  assert.equal(await page.locator('#presentacion').getAttribute('aria-modal'), 'true');
  assert.equal(await page.locator('main').evaluate((e) => e.inert), true);
  assert.equal(await page.locator('main').getAttribute('aria-hidden'), 'true', 'el fondo queda fuera del lector de pantalla');
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
  assert.equal(await page.locator('.pres-cifras > div').count(), 4, 'la presentación lleva las cuatro cifras, con la edad media');
  assert.match(await page.locator('.pres-cifras > div').nth(1).textContent(), /^\d+,\d\u00a0añosEdad media$/);
  assert.match(await page.locator('#pres-leyenda').textContent(), /Hombres españolesMujeres españolasExtranjeros/);
  assert.equal(await page.locator('#pres-lectura').count(), 0, 'la presentación tampoco lleva el bloque de lectura');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#pres-piramide text[paint-order]').count(), 2, 'las cifras del grupo, en el dibujo');
  await page.keyboard.press('Escape');
  await espera(150);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'btn-presentar');
  assert.equal(await page.locator('main').evaluate((e) => e.inert), false);
  assert.equal(await page.locator('main').getAttribute('aria-hidden'), null);
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
  assert.equal(await page.locator('table.cmp-tabla th[scope="row"]').count(), 5, 'habitantes, edad media, variación, mujeres y hombres');
  assert.equal(await page.locator('table.cmp-tabla th[scope="col"]').count(), 4);
  const claros = await page.locator('#cmp-resultado *').evaluateAll((els) => els.filter((e) => e.childElementCount === 0 && e.textContent.trim() && getComputedStyle(e).color === 'rgb(133, 183, 235)').length);
  assert.equal(claros, 0, 'texto en #85B7EB sobre blanco');
  assert.equal(await page.locator('#fuente-cmp-piramides').textContent(), `Fuente: ISTAC. Población según sexo y grupos de edad, ${indice.anio}.`);
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
  // Un solo criterio de orden, de mayor a menor, que manda en todas las secciones y en la tira de elegidos.
  await page.selectOption('#sel-anadir', '38038'); await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '2 de 3'); await espera(400);
  await page.selectOption('#sel-orden-indices', 'C10'); await espera(400);
  assert.equal(await page.locator('#sel-orden-cifras').inputValue(), '', 'elegir un índice deja la cifra clave sin elección');
  const tira = await page.locator('#cmp-elegidos .cmp-ficha b').allTextContents();
  const envejecimiento = await Promise.all(['35017', '38038'].map(async (c) => { const f = await json(path.join(WEB, `datos/mun/${c}.json`)); return [f.nombre, f.indices.C10.municipio]; }));
  assert.deepEqual(tira, envejecimiento.sort((a, b) => b[1] - a[1]).map((x) => x[0]), 'de mayor a menor envejecimiento');
  assert.deepEqual(await page.locator('#cmp-piramides .cmp-col h3').allTextContents(), tira);
  assert.equal(await page.locator('.cmp-aviso').count(), 0, 'sin avisos bajo las pirámides');
  assert.equal(await page.locator('#cmp-nacimiento .cmp-barra-val b').evaluateAll((bs) => new Set(bs.map((b) => b.style.color)).size), 3, 'cada cifra del lugar de nacimiento con el tono de su tramo');
  const anillos = await page.locator('#cmp-extranjero .cmp-col').evaluateAll((cs) => cs.map((c) => [c.querySelector('p b').textContent, c.querySelector('path').getAttribute('fill')]));
  assert.ok(anillos.every((a) => a[1] === '#185FA5') && anillos.map((a) => parseFloat(a[0].replace(',', '.'))).every((v, i, l) => !i || v <= l[i - 1]), `anillos de un solo azul y de mayor a menor: ${JSON.stringify(anillos)}`);
  await page.selectOption('#sel-orden-cifras', 'poblacion'); await espera(300);
  // Quitar con el teclado deja el foco en el siguiente botón de quitar, y el último en el selector de añadir.
  await page.locator('[data-quitar]').first().focus(); await page.keyboard.press('Enter'); await espera(400);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.quitar !== undefined), true, 'el foco pasa al siguiente botón de quitar');
  await page.keyboard.press('Enter'); await espera(400);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sel-anadir', 'sin municipios, el foco va al selector');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('comparador: islas con islas y municipios con municipios; cambiar de modo vacía la comparación', async () => {
  const { page, contexto, errores } = await abrir('comparar.html?i=gran-canaria,tenerife');
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '2 de 3');
  await espera(500);
  assert.equal(await page.locator('#cmp-titulo').textContent(), 'Comparar islas');
  assert.ok(page.url().endsWith('?i=gran-canaria,tenerife'), `${page.url()}: la dirección conserva el orden en que se añadieron`);
  assert.deepEqual(await page.locator('.cmp-cab span').allTextContents(), ['Isla', 'Isla']);
  assert.deepEqual(await page.locator('#cmp-elegidos .cmp-ficha b').allTextContents(), ['Tenerife', 'Gran Canaria'], 'las columnas, de mayor a menor población');
  assert.equal(await page.locator('#sel-anadir option').count(), 8, 'las siete islas y el rótulo');
  assert.equal(await page.locator('#sub-nacimiento').textContent(), 'Cada barra suma el 100\u00a0% de su isla');
  assert.equal(await page.locator('#cmp-piramides .cmp-col').count(), 2);
  assert.equal(await page.locator('#cmp-indices .peldano').count(), 4 * 3, 'dos islas y Canarias en cada índice');
  await page.selectOption('#sel-orden-cifras', 'edad_media'); await espera(400);
  const edades = await page.locator('.cmp-tabla tbody tr').nth(1).locator('.cmp-val').allTextContents();
  assert.ok(edades.length === 2 && parseFloat(edades[0].replace(',', '.')) >= parseFloat(edades[1].replace(',', '.')), `por edad media, de mayor a menor: ${edades}`);
  await page.selectOption('#sel-orden-cifras', 'poblacion'); await espera(300);
  await sinDesborde(page, 'comparador de islas');
  // A municipios: la comparación se vacía y el desplegable cambia; nunca se mezclan.
  await page.locator('.cmp-modo [data-modo="municipios"]').click();
  await espera(400);
  assert.equal(await page.locator('#cmp-cuenta').textContent(), '0 de 3');
  assert.equal(await page.locator('#cmp-titulo').textContent(), 'Comparar municipios');
  assert.equal(await page.locator('#sel-anadir optgroup').count(), 7);
  assert.match(await page.locator('#cmp-vacio').textContent(), /Elige un municipio/);
  await page.selectOption('#sel-anadir', '38038');
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '1 de 3');
  await espera(400);
  assert.ok(page.url().endsWith('?m=38038'), page.url());
  await page.locator('.cmp-modo [data-modo="islas"]').click();
  await espera(400);
  assert.equal(await page.locator('#cmp-cuenta').textContent(), '0 de 3');
  assert.ok(page.url().endsWith('?islas'), `${page.url()}: sin nada elegido, la dirección conserva el modo`);
  assert.match(await page.locator('#cmp-vacio').textContent(), /Elige una isla/);
  // A provincias: entran las dos de golpe (comparar por provincia es compararlas).
  await page.locator('.cmp-modo [data-modo="provincias"]').click();
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '2 de 3');
  await espera(900);
  assert.equal(await page.locator('#cmp-titulo').textContent(), 'Comparar provincias');
  assert.ok(page.url().endsWith('?p=santa-cruz-de-tenerife,las-palmas'), page.url());
  assert.deepEqual(await page.locator('.cmp-cab span').allTextContents(), ['Provincia', 'Provincia']);
  assert.deepEqual(await page.locator('#cmp-elegidos .cmp-ficha b').allTextContents(), ['Las Palmas', 'Santa Cruz de Tenerife'], 'de mayor a menor población');
  assert.equal(await page.locator('#sel-anadir option').count(), 3, 'las dos provincias y el rótulo');
  assert.equal(await page.locator('#cmp-indices .peldano').count(), 4 * 3, 'dos provincias y Canarias en cada índice');
  await sinDesborde(page, 'comparador de provincias');
  await contexto.close();
  // ?p=<una> deja una sola; ?provincias, las dos.
  const otra = await abrir('comparar.html?p=las-palmas');
  await otra.page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '1 de 3');
  assert.deepEqual(await otra.page.locator('#cmp-elegidos .cmp-ficha b').allTextContents(), ['Las Palmas']);
  await otra.page.goto(base + 'comparar.html?provincias');
  await otra.page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '2 de 3');
  // Cambiar de modo y volver antes de que lleguen las provincias no las duplica ni pasa del máximo.
  await retrasar(otra.page, '**/datos/provincia/*.json', 700);
  for (const modo of ['islas', 'provincias', 'islas', 'provincias']) {
    await otra.page.locator(`.cmp-modo [data-modo="${modo}"]`).click();
    await espera(120);
  }
  await espera(2500);
  assert.deepEqual(await otra.page.locator('#cmp-elegidos .cmp-ficha b').allTextContents(), ['Las Palmas', 'Santa Cruz de Tenerife'], 'ir y volver de modo no duplica las provincias');
  assert.equal(await otra.page.locator('#cmp-cuenta').textContent(), '2 de 3');
  assert.ok(otra.page.url().endsWith('?p=santa-cruz-de-tenerife,las-palmas'), otra.page.url());
  assert.deepEqual(errores.concat(otra.errores), []);
  await otra.contexto.close();
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

test('portada: siete tarjetas iguales, cada una despliega la isla entera y sus municipios dentro de la pantalla; el buscador enseña el foco', async () => {
  const { page, contexto, errores } = await abrir('index.html', { ancho: 375, alto: 812 });
  await page.waitForSelector('.isla-menu');
  assert.deepEqual(await page.locator('.isla-nombre').allTextContents(), ['El Hierro', 'La Palma', 'La Gomera', 'Tenerife', 'Gran Canaria', 'Fuerteventura', 'Lanzarote'], 'islas de oeste a este, como en el índice');
  // Canarias entera arriba y el rótulo de cada provincia sobre sus islas, los tres con enlace a su ficha.
  assert.equal(await page.locator('#banda-canarias').getAttribute('href'), 'ficha.html?canarias');
  assert.equal((await page.locator('#banda-canarias').textContent()).trim(), 'CanariasVer la ficha', 'sin cifras: las de la cabecera ya son las de Canarias');
  assert.deepEqual(await page.locator('.provincia-cab').evaluateAll((as) => as.map((a) => [a.querySelector('b').textContent, a.getAttribute('href')])),
    [['Santa Cruz de Tenerife', 'ficha.html?provincia=santa-cruz-de-tenerife'], ['Las Palmas', 'ficha.html?provincia=las-palmas']]);
  // En una columna, cada provincia va justo encima de sus islas.
  const orden = await page.locator('#islas > *').evaluateAll((es) => es.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((e) => e.querySelector('b, .isla-nombre').textContent));
  assert.deepEqual(orden, ['Santa Cruz de Tenerife', 'El Hierro', 'La Palma', 'La Gomera', 'Tenerife', 'Las Palmas', 'Gran Canaria', 'Fuerteventura', 'Lanzarote']);
  for (const ancho of [320, 375, 1280]) {
    await page.setViewportSize({ width: ancho, height: 812 });
    await espera(200);
    for (const boton of await page.locator('.isla-menu > .isla-tarjeta').all()) {
      await boton.click();
      await espera(80);
      const caja = await page.locator('.isla-menu .desplegable:not([hidden])').boundingBox();
      assert.ok(caja && caja.x >= 0 && caja.x + caja.width <= ancho + 0.5, `menú fuera de la pantalla a ${ancho}: ${JSON.stringify(caja)}`);
      await sinDesborde(page, `portada con una isla abierta a ${ancho}`);
      await page.keyboard.press('Escape');
    }
    // Las siete tarjetas miden lo mismo (y a 1280 van en una fila); los siete desplegables miden lo mismo.
    const cajas = await page.locator('.isla-tarjeta').evaluateAll((cs) => cs.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
    assert.equal(new Set(cajas.map((c) => `${c[1]}×${c[2]}`)).size, 1, `a ${ancho} las tarjetas no miden lo mismo: ${JSON.stringify(cajas)}`);
    if (ancho === 1280) assert.equal(new Set(cajas.map((c) => c[0])).size, 1, 'a 1280 las siete tarjetas en una fila');
    if (ancho === 1280) {
      const cabs = await page.locator('.provincia-cab').evaluateAll((as) => as.map((a) => { const r = a.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left), Math.round(r.right)]; }));
      const tarjetas = await page.locator('.isla-tarjeta').evaluateAll((cs) => cs.map((c) => Math.round(c.getBoundingClientRect().left)));
      assert.ok(cabs[0][0] === cabs[1][0] && cabs[0][0] < cajas[0][0] && cabs[0][1] === tarjetas[0] && cabs[0][2] < tarjetas[4] && cabs[1][1] === tarjetas[4],
        `a 1280 los rótulos van en una fila, cada uno sobre sus islas: ${JSON.stringify([cabs, tarjetas])}`);
    }
  }
  assert.deepEqual([...new Set(await page.locator('.isla-menu .desplegable').evaluateAll((ds) => ds.map((d) => { d.hidden = false; const h = d.getBoundingClientRect().height; d.hidden = true; return h; })))], [292], 'desplegables del mismo alto');
  // Bajo el título no hay nada; las cuatro cifras van a la derecha del título.
  assert.equal(await page.locator('#tapa-anio').count(), 0, 'sin línea bajo el título');
  assert.ok(await page.evaluate(() => document.querySelector('.tapa-datos').getBoundingClientRect().top < document.querySelector('.tapa-texto').getBoundingClientRect().bottom), 'a 1280 las cifras van junto al título');
  // Cada lista abre con la ficha de la isla entera, en otro color, y sigue con sus municipios por orden alfabético.
  await page.locator('.isla-menu > .isla-tarjeta').nth(3).click();
  await espera(100);
  const lista = page.locator('.isla-menu .desplegable:not([hidden])');
  assert.equal(await lista.getAttribute('aria-label'), 'Fichas de Tenerife');
  assert.equal(await lista.locator('a').count(), 32, 'la isla y sus 31 municipios');
  assert.equal(await lista.locator('a').first().evaluate((a) => a.href), base + 'ficha.html?isla=tenerife');
  assert.match(await lista.locator('a').first().textContent(), /Toda la isla966\.469 habitantes/);
  assert.equal(await lista.locator('a').nth(1).textContent(), 'Adeje');
  assert.notEqual(await lista.locator('a').first().evaluate((a) => getComputedStyle(a).backgroundColor), await lista.locator('a').nth(1).evaluate((a) => getComputedStyle(a).backgroundColor), 'la isla entera va en otro color que sus municipios');
  assert.equal(await page.locator('.isla-tarjeta[aria-expanded="true"] .isla-nombre').textContent(), 'Tenerife');
  // Inicio y Fin con la lista abierta y el foco aún en el disparador; Escape devuelve el foco.
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), await lista.locator('a').last().textContent(), 'Fin va a la última opción');
  await page.keyboard.press('Home');
  assert.match(await page.evaluate(() => document.activeElement.textContent), /^Toda la isla/, 'Inicio va a la isla entera');
  await page.keyboard.press('Escape');
  await espera(60);
  assert.equal(await page.locator('.isla-menu .desplegable:not([hidden])').count(), 0, 'Escape cierra la lista');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('isla-tarjeta')), true, 'y devuelve el foco a la tarjeta');
  // Abierta con el ratón y sin nada enfocado (lo que hace Safari), las teclas llegan igual.
  await page.evaluate(() => document.activeElement.blur());
  const cajaTarjeta = await page.locator('.isla-menu > .isla-tarjeta').first().boundingBox();
  await page.mouse.click(cajaTarjeta.x + cajaTarjeta.width / 2, cajaTarjeta.y + cajaTarjeta.height / 2); await espera(80);
  assert.ok(await page.evaluate(() => document.activeElement !== document.body), 'abierta con el ratón, el foco está en el disparador');
  await page.keyboard.press('ArrowDown');
  assert.match(await page.evaluate(() => document.activeElement.textContent), /^Toda la isla/, 'la flecha entra en la lista');
  await page.keyboard.press('Escape');
  // El buscador es un combobox: el foco no sale del campo, la opción activa se señala con
  // aria-activedescendant y Escape cierra la lista sin reabrirla. Las islas salen antes que los municipios.
  await page.fill('#buscar', 'san');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'buscar', 'el foco se queda en el campo');
  const activa = await page.locator('#buscar').getAttribute('aria-activedescendant');
  assert.ok(activa, 'hay opción activa');
  assert.equal(await page.locator(`#${activa}[role="option"][aria-selected="true"]`).count(), 1, 'la opción activa existe y está seleccionada');
  await page.keyboard.press('ArrowDown');
  assert.notEqual(await page.locator('#buscar').getAttribute('aria-activedescendant'), activa, 'la segunda flecha baja a otra opción');
  assert.equal(await page.locator('#resultados [aria-selected="true"]').count(), 1);
  await page.keyboard.press('Escape');
  await espera(60);
  assert.equal(await page.locator('#resultados').isHidden(), true, 'Escape cierra el buscador');
  assert.equal(await page.locator('#buscar').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#buscar').getAttribute('aria-activedescendant'), null);
  await page.fill('#buscar', 'zzzz');
  assert.equal(await page.locator('#resultados [role="option"][aria-disabled="true"]').count(), 1, 'sin resultados, una opción inactiva lo dice');
  await page.fill('#buscar', 'la ');
  assert.deepEqual(await page.locator('#resultados a').evaluateAll((as) => as.slice(0, 3).map((a) => a.textContent)), ['Las PalmasToda la provincia', 'La GomeraToda la isla', 'La PalmaToda la isla'], 'la provincia y las islas, antes que los municipios');
  await page.fill('#buscar', 'santa cruz'); await espera(250);
  assert.deepEqual(await page.locator('#resultados a').evaluateAll((as) => as.slice(0, 2).map((a) => [a.textContent, a.getAttribute('href')])),
    [['Santa Cruz de TenerifeToda la provincia', 'ficha.html?provincia=santa-cruz-de-tenerife'], ['Santa Cruz de La PalmaLa Palma', 'ficha.html?municipio=38037']], 'la provincia, antes que los municipios');
  await page.fill('#buscar', 'canarias'); await espera(250);
  assert.deepEqual(await page.locator('#resultados a').evaluateAll((as) => as.slice(0, 1).map((a) => [a.textContent, a.getAttribute('href'), a.id])), [['CanariasTodo el archipiélago', 'ficha.html?canarias', 'res-canarias']]);
  await page.fill('#buscar', '');
  await page.locator('#buscar').focus();
  assert.notEqual(await page.locator('.buscador').evaluate((e) => getComputedStyle(e).outlineStyle), 'none');
  await page.fill('#buscar', 'guia');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForSelector('#fuente-g-origen');
  assert.match(await page.locator('#nombre').textContent(), /Guía/);
  await page.goto(base + 'index.html');
  await page.waitForSelector('.isla-menu');
  await page.fill('#buscar', 'tene');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#fuente-g-origen');
  assert.equal(await page.locator('#nombre').textContent(), 'Tenerife', 'Enter abre la primera opción: la isla');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('marca: ?marca=obiten cambia logotipos, títulos, enlaces y papel; sin parámetro o con una marca desconocida, Canarias Convive', async () => {
  const sitio = await json(path.join(RAIZ, 'sitio.json'));
  const marca = sitio.marcas.obiten;
  const { page, contexto, errores } = await abrir('index.html?marca=obiten');
  await page.waitForSelector('.isla-menu');
  const estado = () => page.evaluate(() => ({
    marca: document.documentElement.dataset.marca, titulo: document.title,
    logo: (document.querySelector('.marca img') || document.querySelector('.tapa-marca .placa img')).getAttribute('src').split('/').pop(),
    alt: (document.querySelector('.marca img') || document.querySelector('.tapa-marca .placa img')).alt,
    placa: document.querySelector('.placa-papel img')?.getAttribute('src').split('/').pop(),
  }));
  assert.deepEqual(await estado(), { marca: 'obiten', titulo: `Fichas demográficas municipales · ${marca.nombre}`, logo: 'logo-obiten.png', alt: marca.nombre, placa: undefined });
  // Los enlaces llevan la marca al pulsarlos; la ficha la conserva al cambiar de territorio y en «Copiar enlace».
  await page.locator('#banda-canarias').click();
  await page.waitForSelector('#fuente-g-origen');
  assert.ok(page.url().endsWith('/fichas/r/canarias.html?marca=obiten'), page.url());
  assert.deepEqual(await estado(), { marca: 'obiten', titulo: `Canarias · Ficha demográfica · ${marca.nombre}`, logo: 'logo-obiten.png', alt: marca.nombre, placa: 'logo-obiten.png' });
  await page.selectOption('#sel-municipio', '38038');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Santa Cruz de Tenerife');
  await espera(300);
  assert.ok(page.url().endsWith('/fichas/m/38038.html?marca=obiten'), page.url());
  // El portapapeles se lee solo en Chromium (WebKit no concede el permiso): en los dos se captura lo que se escribe.
  await page.evaluate(() => { navigator.clipboard.writeText = (t) => { window.__copiado = t; return Promise.resolve(); }; });
  await page.locator('#btn-compartir').click();
  await espera(200);
  assert.equal(await page.evaluate(() => window.__copiado), `${sitio.url_publica}m/38038.html?marca=obiten`);
  // La presentación y la hoja llevan el logotipo de la marca; en el papel, el año no queda tapado por la placa.
  await page.locator('#btn-presentar').click();
  await espera(300);
  assert.equal(await page.locator('.pres-logo').getAttribute('src').then((s) => s.split('/').pop()), 'logo-obiten.png');
  await page.keyboard.press('Escape');
  await espera(200);
  await page.emulateMedia({ media: 'print' });
  await espera(200);
  const cajas = await page.evaluate(() => { const r = (e) => e.getBoundingClientRect().toJSON(); return { placa: r(document.querySelector('.placa-papel')), anio: r(document.getElementById('anio')) }; });
  assert.ok(cajas.placa.left >= cajas.anio.right, `la placa va a la derecha del año: ${JSON.stringify(cajas)}`);
  await page.emulateMedia({ media: null });
  // El comparador desde el botón, con la marca; el sobre m/<código>.html?marca= la pasa a la ficha.
  await page.locator('#btn-comparar').click();
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent.startsWith('1 de 3'));
  assert.ok(page.url().endsWith('?m=38038&marca=obiten'), page.url());
  assert.equal(await page.title(), `Comparar municipios · ${marca.nombre}`);
  await page.goto(base + 'i/tenerife.html?marca=juntas');
  await page.waitForSelector('#fuente-g-origen');
  assert.equal(await page.locator('.marca img').getAttribute('alt'), sitio.marcas.juntas.nombre);
  assert.ok((await page.locator('.marca img').boundingBox()).height > 40, 'el logotipo cuadrado va más alto que el de Canarias Convive');
  // El dossier: la placa de cada hoja, los pies y la línea de entidades de la portada.
  await page.goto(base + 'dossier.html?marca=obiten');
  await page.waitForFunction(() => document.getElementById('d-total').textContent === '101 hojas', null, { timeout: 120000 });
  assert.equal(await page.locator('.placa-papel img[src$="logo-obiten.png"]').count(), 98);
  assert.equal(await page.locator('.d-marca').textContent(), marca.entidades);
  assert.equal(await page.locator('.d-portada-placa img').getAttribute('src').then((s) => s.split('/').pop()), 'logo-obiten.png', 'la portada del dossier lleva el logotipo');
  assert.equal(await page.locator('.d-pie span').first().textContent(), `${marca.nombre} · Fichas demográficas municipales`);
  assert.deepEqual(errores, []);
  await contexto.close();
  // Otra pestaña sin parámetro, o con una marca que no existe: Canarias Convive.
  const otra = await abrir('ficha.html?municipio=38038');
  await otra.page.waitForSelector('#fuente-g-origen');
  assert.equal(await otra.page.title(), 'Santa Cruz de Tenerife · Fichas municipales · Canarias Convive');
  assert.ok(otra.page.url().endsWith('/fichas/m/38038.html'), otra.page.url());
  await otra.page.goto(base + 'ficha.html?municipio=38038&marca=zzz');
  await otra.page.waitForSelector('#fuente-g-origen');
  assert.equal(await otra.page.evaluate(() => document.documentElement.dataset.marca + ' ' + document.querySelector('.marca img').getAttribute('src').split('/').pop()), 'canariasconvive logo-canariasconvive-menu.png');
  assert.deepEqual(otra.errores, []);
  await otra.contexto.close();
});

test('portada: si fallan los datos, el buscador se desactiva y el aviso se anuncia', async () => {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await contexto.newPage();
  await page.route('**/datos/indice.json', (r) => r.abort());
  await page.goto(base + 'index.html');
  await page.waitForFunction(() => document.getElementById('estado-portada').textContent.includes('No se han podido'));
  assert.ok(await page.locator('#estado-portada').isVisible());
  assert.equal(await page.locator('#estado-portada').getAttribute('role'), 'status');
  assert.equal(await page.locator('#buscar').isDisabled(), true, 'sin datos el buscador queda desactivado');
  assert.equal(await page.locator('.tapa.espera').count(), 0, 'la portada se ve aunque fallen los datos');
  await contexto.close();
});

test('dossier: una petición fallida se reintenta, el aviso es una región de estado y en pantallas estrechas se desplaza con teclado', { timeout: 240000 }, async () => {
  const { page, contexto, errores } = await abrir('index.html');
  let fallada = 0;
  await page.route('**/datos/mun/38024.json', (r) => { if (!fallada++) r.abort(); else r.continue(); });
  assert.match(await fs.readFile(path.join(WEB, 'dossier.html'), 'utf8'), /id="d-aviso" role="status" aria-live="polite"/);
  await page.goto(base + 'dossier.html');
  await page.waitForFunction(() => document.getElementById('d-total').textContent === '101 hojas', null, { timeout: 180000 });
  assert.equal(fallada, 2, 'la ficha que falló se volvió a pedir');
  assert.equal(await page.locator('#dossier').getAttribute('tabindex'), null, 'a 1280 la hoja cabe y no hace falta enfocar el contenedor');
  await page.setViewportSize({ width: 375, height: 812 });
  await espera(300);
  assert.equal(await page.locator('#dossier').getAttribute('tabindex'), '0', 'a 375 el contenedor se puede enfocar y desplazar');
  // La petición abortada a propósito deja su rastro en la consola (Chromium y WebKit lo dicen distinto).
  assert.deepEqual(errores.filter((e) => !e.includes('Failed to load resource') && !e.includes('Load failed')), []);
  await contexto.close();
});

test('enmarcada en otro sitio, la ficha se sustituye por el aviso; en la propia web, no', async () => {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await contexto.newPage();
  const marco = (src) => `<!DOCTYPE html><html><body><iframe id="f" src="${src}" width="1000" height="800"></iframe></body></html>`;
  // Otro sitio: un segundo servidor en otro puerto (otro origen) que enmarca la ficha.
  const otro = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(marco(base + 'ficha.html?municipio=38038')); });
  await new Promise((r) => otro.listen(0, '127.0.0.1', r));
  await page.goto(`http://127.0.0.1:${otro.address().port}/pagina.html`);
  // El marco es de otro origen: se espera a que Playwright vea su navegación al aviso.
  let dentro = null;
  for (let i = 0; i < 100 && !dentro; i++) { dentro = page.frames().find((f) => f.url().includes('enmarcada.html')); if (!dentro) await espera(100); }
  assert.ok(dentro, `la ficha enmarcada en otro sitio pasa al aviso (marcos: ${page.frames().map((f) => f.url()).join(', ')})`);
  await dentro.waitForSelector('h1');
  assert.match(await dentro.locator('h1').textContent(), /Canarias Convive/);
  assert.equal(await dentro.locator('a.btn').getAttribute('target'), '_top');
  // La misma ficha enmarcada desde la propia web se muestra.
  await page.route(base + 'embebida.html', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: marco(base + 'ficha.html?municipio=38038') }));
  await page.goto(base + 'embebida.html');
  const propia = page.frames().find((f) => f.url().includes('ficha.html'));
  await propia.waitForSelector('#fuente-g-origen');
  assert.equal(await propia.locator('#nombre').textContent(), 'Santa Cruz de Tenerife');
  await new Promise((r) => otro.close(r));
  await contexto.close();
});

test('guía: los enunciados de Pedro, sin edad media ni desplegables de fuente', async () => {
  const { page, contexto, errores } = await abrir('guia.html', { ancho: 375, alto: 812 });
  await page.waitForSelector('#guia-fichas .tarjeta');
  assert.equal(await page.locator('#guia-fichas .tarjeta').count(), await page.locator('.guia-formula').count(), 'todas las tarjetas de la guía llevan fórmula');
  // A dos columnas, las tarjetas de cada fila miden lo mismo y la última, sola, va a todo el ancho.
  await page.setViewportSize({ width: 1280, height: 900 });
  await espera(300);
  const cajas = await page.locator('#guia-fichas .tarjeta').evaluateAll((ts) => ts.map((t) => { const r = t.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), Math.round(r.width)]; }));
  const filas = new Map();
  for (const [top, alto] of cajas) filas.set(top, [...(filas.get(top) || []), alto]);
  for (const [top, altos] of filas) assert.equal(new Set(altos).size, 1, `fila a ${top}: alturas ${altos}`);
  assert.ok(cajas.at(-1)[2] > cajas[0][2] * 1.8, 'la última tarjeta, sola, ocupa todo el ancho');
  await page.setViewportSize({ width: 375, height: 812 });
  await espera(300);
  assert.equal(await page.locator('#edad').count(), 0, 'sin edad media');
  assert.equal(await page.locator('details').count(), 0, 'sin desplegables de fuente y fecha');
  assert.match(await page.locator('#tvma').textContent(), /Ritmo constante al que habría crecido la población cada año/);
  assert.match(await page.locator('#dependencia').textContent(), /menores de 15 y mayores de 64 años por cada cien entre 15 y 64 años/);
  assert.match(await page.locator('#extranjero').textContent(), /Personas nacidas fuera de España por cada cien habitantes\./);
  await sinDesborde(page, 'guía a 375');
  // El exponente de la variación media anual va arriba, pegado a la fracción.
  const sup = await page.locator('#tvma .frm sup').evaluate((s) => { const f = s.previousElementSibling.getBoundingClientRect(), r = s.getBoundingClientRect(); return { arriba: r.top <= f.top + 4, pegado: r.left - f.right < 8 }; });
  assert.deepEqual(sup, { arriba: true, pegado: true }, 'exponente 1/n');
  // Un salto del índice deja el título del indicador por debajo de la barra pegajosa.
  await page.locator('#guia-indice a[href="#reemplazo"]').click();
  await espera(300);
  assert.ok(await page.evaluate(() => document.querySelector('#reemplazo h2').getBoundingClientRect().top >= document.querySelector('.barra').getBoundingClientRect().bottom), 'el título del indicador se ve entero');
  assert.deepEqual(errores, []);
  await contexto.close();
});

test('papel: las 88 fichas, las 7 de isla, las 2 de provincia y la de Canarias caben en una A4 y el dossier tiene 101 páginas con su barra', { timeout: 360000, ...SOLO_CHROMIUM }, async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038');
  await page.waitForSelector('#fuente-g-origen');   // navegar con el índice en vuelo dejaba un «Failed to fetch»
  for (const m of indice.municipios) {
    await page.goto(base + `ficha.html?municipio=${m.codmun}`);
    await page.waitForSelector('#fuente-g-origen');
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.equal(paginasPDF(pdf), 1, `A4 de ${m.nombre}`);
  }
  for (const [u, n] of [...indice.islas_resumen.map((i) => [`ficha.html?isla=${i.slug}`, `la isla de ${i.nombre}`]),
                        ...indice.provincias.map((p) => [`ficha.html?provincia=${p.slug}`, `la provincia de ${p.nombre}`]), ['ficha.html?canarias', 'Canarias']]) {
    await page.goto(base + u);
    await page.waitForSelector('#fuente-g-origen');
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.equal(paginasPDF(pdf), 1, `A4 de ${n}`);
  }
  // En la hoja de la provincia no va la lista de municipios (el índice del dossier la tiene); sí la de sus islas.
  await page.goto(base + 'ficha.html?provincia=las-palmas');
  await page.waitForSelector('#fuente-g-origen');
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('#sec-municipios-provincia').isVisible(), false);
  assert.equal(await page.locator('#g-municipios li:visible').count(), 3);
  assert.equal(await page.locator('.fuente-grafico:visible').count(), 8);
  await page.emulateMedia({ media: null });
  await page.goto(base + 'ficha.html?municipio=38048');
  await page.waitForSelector('#fuente-g-origen');
  const sitio = await json(path.join(RAIZ, 'sitio.json'));
  assert.equal(await page.locator('.pie-fuentes-papel').count(), 0, 'sin el pie de la guía en el papel');
  // En la hoja se imprime la fuente de cada gráfico, la marca del programa va en la cabecera, y la ficha es una A4.
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.fuente-grafico:visible').count(), 7, 'siete fuentes en la hoja');
  assert.ok(await page.locator('.cabecera .placa-papel img').isVisible(), 'la marca del programa va en la cabecera de la hoja');
  assert.ok(await page.locator('.cabecera .placa-papel img').evaluate((i) => i.complete && i.naturalWidth > 0), 'el logotipo carga');
  assert.equal(await page.locator('.cifra').count(), 4, 'cuatro cifras clave, con la edad media');
  await page.emulateMedia({ media: null });
  const a4 = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal(paginasPDF(a4), 1);
  const caja = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(a4.toString('latin1'));
  assert.ok(caja && Math.abs(caja[1] / 72 * 25.4 - 210) < 1 && Math.abs(caja[2] / 72 * 25.4 - 297) < 1, `la hoja es una A4 (${caja && caja.slice(1).join(' × ')} pt)`);
  await page.goto(base + 'dossier.html');
  await page.waitForFunction(() => document.getElementById('d-total').textContent === '101 hojas', null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.locator('#d-barra').isVisible(), 'la barra del dossier se ve');
  const guiaDossier = await page.locator('.hoja-texto').first().textContent();
  const comp = (await json(path.join(WEB, 'datos/mun/38038.json'))).componentes;
  const ultimoAnio = Math.max(...comp.anios.filter((a, i) => comp.vegetativo[i] != null || comp.migratorio[i] != null));
  assert.ok(guiaDossier.includes(`hasta ${ultimoAnio}`), 'la guía del dossier calcula el último año de los componentes');
  for (const t of ['Variación media anual', 'Lugar de nacimiento', 'Población a 1 de enero', sitio.url_publica.replace(/^https?:\/\//, '').replace(/\/$/, ''), 'GRAFCAN']) assert.ok(guiaDossier.includes(t), `la guía del dossier no dice «${t}»`);
  assert.ok(!guiaDossier.includes('Edad media') && !guiaDossier.includes('Elaboración propia'), 'la guía del dossier no dice edad media ni elaboración propia');
  assert.ok(!guiaDossier.includes('adrón'), 'la guía del dossier no atribuye los datos al padrón');
  assert.ok(!guiaDossier.includes('mueven mucho'), 'la guía del dossier no orienta la lectura');
  assert.equal(await page.locator('.hoja-ficha .mapas.dos').count(), 3, 'las tres hojas de El Hierro llevan dos mapas');
  assert.equal(await page.locator('.hoja-isla').count(), 10, 'Canarias, las dos provincias y cada isla abren su grupo');
  assert.deepEqual(await page.locator('.hoja-ficha').evaluateAll((hs) => hs.slice(0, 3).map((h) => h.querySelector('.d-migas').textContent)),
    ['2 provincias · 7 islas · 88 municipios', 'Canarias · 4 islas · 54 municipios', 'Canarias · 3 municipios'], 'Canarias, la provincia occidental y El Hierro abren el dossier');
  assert.equal(await page.locator('.hoja-ficha').first().locator('path[stroke="#1A1A1A"]:not([d=""])').count(), 0, 'la pirámide de Canarias va sin marco también en el dossier');
  assert.deepEqual(await page.locator('.hoja-ficha').nth(1).locator('.lista-mun span').allTextContents().then((t) => t.map((x) => x.replace(/\s/g, ''))), ['88,9%', '7,9%', '2,1%', '1,1%'], 'la hoja de la provincia lista sus islas con su peso');
  assert.deepEqual(await page.locator('.hoja-isla').nth(2).locator('.lista-mun span').allTextContents().then((t) => t.map((x) => x.replace(/\s/g, ''))), ['44,2%', '38,8%', '17,0%'], 'la lista de la isla lleva el peso de cada municipio, también en papel');
  assert.equal(await page.locator('.hoja-ficha:not(.hoja-isla) .d-migas').first().textContent(), 'El Hierro', 'la primera hoja municipal es de El Hierro, sin comarca repetida');
  assert.match(await page.locator('.hoja-texto').nth(1).textContent(), /Canarias toda la comunidad · 4.*Santa Cruz de Tenerife la provincia · 5.*El Hierro la isla · 6.*Las Palmas la provincia · 64/s, 'el índice lleva la hoja de Canarias, de cada provincia y de cada isla');
  assert.ok(await page.getByRole('button', { name: 'Imprimir o guardar en PDF' }).isVisible(), 'el botón de imprimir se ve');
  assert.equal(await page.locator('.hoja-ficha .fuente-grafico').count(), 88 * 7 + 10 * 8, 'cada gráfico del dossier lleva su fuente (ocho por encima del municipio)');
  assert.equal(await page.locator('.hoja-ficha .d-cab .placa-papel:visible').count(), 98, 'cada hoja del dossier lleva la marca del programa en la cabecera');
  const desbordan = await page.locator('.hoja').evaluateAll((els) => els.flatMap((e, i) => (e.scrollHeight > e.clientHeight + 1 ? [i + 1] : [])));
  assert.deepEqual(desbordan, [], 'hojas del dossier que se salen');
  const dossier = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal(paginasPDF(dossier), 101);
  assert.deepEqual(errores, []);
  await contexto.close();
});

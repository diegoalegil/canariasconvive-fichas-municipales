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
   la portada con el mapa, las 88 fichas y las 7 de isla en una A4 y el
   dossier de 98 hojas.

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
  assert.equal(await page.locator('.vista').nth(1).textContent(), 'Municipio: según origen', 'el nombre de la pestaña que dictó Pedro');
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
  assert.deepEqual(await page.locator('.vista').allTextContents(), ['Isla y Canarias', 'Isla: según origen'], 'las pestañas dicen «Isla»');
  // Sus municipios: los 31 de mayor a menor población, cada uno con enlace a su ficha.
  const filas = await page.locator('.lista-mun li').evaluateAll((ls) => ls.map((l) => [l.querySelector('a').href, parseInt(l.querySelector('b').textContent.replace(/\./g, ''), 10)]));
  assert.equal(filas.length, 31);
  assert.ok(filas.every((f, i) => !i || f[1] <= filas[i - 1][1]), 'de mayor a menor');
  assert.equal(filas[0][0], base + 'm/38038.html');
  // La isla en Canarias (puesto de 7 y peso) y la isla con sus municipios.
  assert.equal(await page.locator('#mapas figure').count(), 2);
  assert.equal(await page.locator('.mapa-pie b').first().textContent(), '1.º de 7');
  await page.locator('.lista-mun li').first().hover();
  assert.equal(await page.locator('#mapas path[data-codmun="38038"]').getAttribute('fill'), '#185FA5', 'señalar un municipio lo destaca en el mapa');
  // Índices: las siete islas y Canarias de menor a mayor, la isla en azul.
  const escalera = await page.locator('.indice-isla').first().locator('.tramo').evaluateAll((ts) => ts.map((t) => [t.querySelector('span').textContent, parseFloat(t.querySelector('b').textContent.replace(',', '.')), t.classList.contains('propia')]));
  assert.equal(escalera.length, 8);
  assert.ok(escalera.every((e, i) => !i || e[1] >= escalera[i - 1][1]), 'de menor a mayor');
  assert.deepEqual(escalera.filter((e) => e[2]).map((e) => e[0]), ['Tenerife']);
  assert.equal(await page.locator('.fuente-grafico').count(), 8, 'ocho fuentes: la lista de municipios lleva la suya');
  assert.equal(await page.locator('#fuente-g-evolucion').textContent(), `Fuente: ISTAC. Cifras oficiales de población de las islas, 2000–${indice.anio}.`);
  assert.equal(await page.locator('.anillo h3').first().textContent(), 'Isla');
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
  assert.deepEqual(await page.locator('.vista').allTextContents(), ['Municipio y Canarias', 'Municipio: según origen']);
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
  assert.equal(await page.locator('.pres-cifras > div').count(), 3, 'la presentación tampoco lleva edad media');
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
  assert.equal(await page.locator('table.cmp-tabla th[scope="row"]').count(), 4, 'habitantes, variación, mujeres y hombres; sin edad media');
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

test('portada: el mapa y las pestañas eligen la isla, el panel ofrece primero la isla entera y el buscador enseña el foco', async () => {
  const { page, contexto, errores } = await abrir('index.html', { ancho: 375, alto: 812 });
  await page.waitForSelector('.pestana');
  assert.equal(await page.locator('.isla-mapa').count(), 7, 'las siete islas en el mapa');
  assert.deepEqual(await page.locator('.pestana span').allTextContents(), ['El Hierro', 'La Palma', 'La Gomera', 'Tenerife', 'Gran Canaria', 'Fuerteventura', 'Lanzarote'], 'islas de oeste a este, como en el índice');
  assert.equal(await page.locator('.panel-vacio').count(), 1, 'sin isla elegida, el panel lo dice');
  for (const ancho of [320, 375, 1280]) {
    await page.setViewportSize({ width: ancho, height: 812 });
    await espera(300);
    await sinDesborde(page, `portada a ${ancho}`);
    assert.ok(await page.locator('.mapa-islas svg').evaluate((s) => s.getBoundingClientRect().width > 200), `el mapa se dibuja a ${ancho}`);
  }
  // Bajo el título no hay nada; las cuatro cifras van a la derecha del título.
  assert.equal(await page.locator('#tapa-anio').count(), 0, 'sin línea bajo el título');
  assert.ok(await page.evaluate(() => document.querySelector('.tapa-datos').getBoundingClientRect().top < document.querySelector('.tapa-texto').getBoundingClientRect().bottom), 'a 1280 las cifras van junto al título');
  // Elegir en el mapa: la pestaña se marca y el panel ofrece la isla entera y luego sus municipios.
  await page.locator('.isla-mapa[data-isla="tenerife"]').click();
  await espera(300);
  assert.equal(await page.locator('[role="tab"][aria-selected="true"] span').textContent(), 'Tenerife');
  assert.ok(await page.locator('.isla-mapa[data-isla="tenerife"]').evaluate((g) => g.classList.contains('activa')));
  assert.equal(await page.locator('.isla-entera').evaluate((a) => a.href), base + 'ficha.html?isla=tenerife');
  assert.match(await page.locator('.isla-entera').textContent(), /Toda la isla · 966\.469 habitantes · 31 municipios/);
  assert.equal(await page.locator('.panel-muns a').count(), 31);
  assert.equal(await page.locator('.panel-muns a').first().textContent(), 'Adeje', 'municipios por orden alfabético');
  assert.ok(page.url().endsWith('#tenerife'), page.url());
  assert.ok(await page.evaluate(() => { const a = document.querySelector('.isla-entera'), m = document.querySelector('.panel-muns a'); return getComputedStyle(a).backgroundColor !== getComputedStyle(m).backgroundColor; }), 'la isla entera va en otro color que sus municipios');
  // Las pestañas con teclado: las flechas cambian de isla y la eligen.
  await page.locator('[role="tab"][aria-selected="true"]').focus();
  await page.keyboard.press('ArrowRight');
  await espera(250);
  assert.equal(await page.locator('[role="tab"][aria-selected="true"] span').textContent(), 'Gran Canaria');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.isla), 'gran-canaria', 'el foco va con la pestaña');
  assert.equal(await page.locator('.panel-muns a').count(), 21);
  await page.keyboard.press('Home');
  await espera(250);
  assert.equal(await page.locator('[role="tab"][aria-selected="true"] span').textContent(), 'El Hierro');
  assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1, 'una sola pestaña en el orden del tabulador');
  // Un enlace con #lanzarote abre la portada con esa isla elegida.
  await page.goto(base + 'index.html#lanzarote');
  await page.waitForSelector('.isla-entera');
  assert.equal(await page.locator('.isla-entera b').textContent(), 'Lanzarote');
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
  assert.deepEqual(await page.locator('#resultados a').evaluateAll((as) => as.slice(0, 2).map((a) => a.textContent)), ['La GomeraToda la isla', 'La PalmaToda la isla'], 'las islas, antes que los municipios');
  await page.fill('#buscar', '');
  await page.locator('#buscar').focus();
  assert.notEqual(await page.locator('.buscador').evaluate((e) => getComputedStyle(e).outlineStyle), 'none');
  await page.fill('#buscar', 'guia');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForSelector('#fuente-g-origen');
  assert.match(await page.locator('#nombre').textContent(), /Guía/);
  await page.goto(base + 'index.html');
  await page.waitForSelector('.pestana');
  await page.fill('#buscar', 'tene');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#fuente-g-origen');
  assert.equal(await page.locator('#nombre').textContent(), 'Tenerife', 'Enter abre la primera opción: la isla');
  assert.deepEqual(errores, []);
  await contexto.close();
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
  await page.waitForFunction(() => document.getElementById('d-total').textContent === '98 hojas', null, { timeout: 180000 });
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

test('papel: las 88 fichas y las 7 de isla caben en una A4 y el dossier tiene 98 páginas con su barra', { timeout: 360000, ...SOLO_CHROMIUM }, async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038');
  await page.waitForSelector('#fuente-g-origen');   // navegar con el índice en vuelo dejaba un «Failed to fetch»
  for (const m of indice.municipios) {
    await page.goto(base + `ficha.html?municipio=${m.codmun}`);
    await page.waitForSelector('#fuente-g-origen');
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.equal(paginasPDF(pdf), 1, `A4 de ${m.nombre}`);
  }
  for (const i of indice.islas_resumen) {
    await page.goto(base + `ficha.html?isla=${i.slug}`);
    await page.waitForSelector('#fuente-g-origen');
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.equal(paginasPDF(pdf), 1, `A4 de la isla de ${i.nombre}`);
  }
  await page.goto(base + 'ficha.html?municipio=38048');
  await page.waitForSelector('#fuente-g-origen');
  const sitio = await json(path.join(RAIZ, 'sitio.json'));
  assert.equal(await page.locator('.pie-fuentes-papel').count(), 0, 'sin el pie de la guía en el papel');
  // En la hoja se imprime la fuente de cada gráfico, la marca del programa va en la cabecera, y la ficha es una A4.
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.fuente-grafico:visible').count(), 7, 'siete fuentes en la hoja');
  assert.ok(await page.locator('.cabecera .placa-papel img').isVisible(), 'la marca del programa va en la cabecera de la hoja');
  assert.ok(await page.locator('.cabecera .placa-papel img').evaluate((i) => i.complete && i.naturalWidth > 0), 'el logotipo carga');
  assert.equal(await page.locator('.cifra').count(), 3, 'tres cifras clave, sin edad media');
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
  for (const t of ['Variación media anual', 'Lugar de nacimiento', 'Población a 1 de enero', sitio.url_publica.replace(/^https?:\/\//, '').replace(/\/$/, ''), 'GRAFCAN']) assert.ok(guiaDossier.includes(t), `la guía del dossier no dice «${t}»`);
  assert.ok(!guiaDossier.includes('Edad media') && !guiaDossier.includes('Elaboración propia'), 'la guía del dossier no dice edad media ni elaboración propia');
  assert.ok(!guiaDossier.includes('adrón'), 'la guía del dossier no atribuye los datos al padrón');
  assert.ok(!guiaDossier.includes('mueven mucho'), 'la guía del dossier no orienta la lectura');
  assert.equal(await page.locator('.hoja-ficha .mapas.dos').count(), 3, 'las tres hojas de El Hierro llevan dos mapas');
  assert.equal(await page.locator('.hoja-isla').count(), 7, 'la ficha de cada isla abre su grupo');
  assert.equal(await page.locator('.hoja-ficha').first().evaluate((h) => h.classList.contains('hoja-isla') && h.querySelector('.d-migas').textContent), 'Canarias · 3 municipios', 'la primera hoja es la de la isla de El Hierro');
  assert.deepEqual(await page.locator('.hoja-isla').first().locator('.lista-mun i').allTextContents(), ['7', '6', '5'], 'la lista de la isla lleva la hoja de cada municipio (de mayor a menor población)');
  assert.equal(await page.locator('.hoja-ficha:not(.hoja-isla) .d-migas').first().textContent(), 'El Hierro', 'la primera hoja municipal es de El Hierro, sin comarca repetida');
  assert.match(await page.locator('.hoja-texto').nth(1).textContent(), /El Hierro la isla · 4/, 'el índice lleva la hoja de la ficha de cada isla');
  assert.ok(await page.getByRole('button', { name: 'Imprimir o guardar en PDF' }).isVisible(), 'el botón de imprimir se ve');
  assert.equal(await page.locator('.hoja-ficha .fuente-grafico').count(), 88 * 7 + 7 * 8, 'cada gráfico del dossier lleva su fuente (ocho en cada isla)');
  assert.equal(await page.locator('.hoja-ficha .d-cab .placa-papel:visible').count(), 95, 'cada hoja del dossier lleva la marca del programa en la cabecera');
  const desbordan = await page.locator('.hoja').evaluateAll((els) => els.flatMap((e, i) => (e.scrollHeight > e.clientHeight + 1 ? [i + 1] : [])));
  assert.deepEqual(desbordan, [], 'hojas del dossier que se salen');
  const dossier = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal(paginasPDF(dossier), 98);
  assert.deepEqual(errores, []);
  await contexto.close();
});

/* Batería de interacciones e impresión en Chromium (Playwright + node:test).
   Reproduce los fallos de la auditoría del 13 de septiembre de 2026 y comprueba
   que no vuelven: última selección manda, comparador con tres plazas y sin
   duplicados, colores estables, errores visibles con reintento, menús de isla
   dentro de la pantalla, contraste de los nombres, tabla semántica, teclado
   tras redibujar e imprimir, foco de la presentación, rótulos por lugar de
   nacimiento, redondeo único, las 88 fichas en una A4, la A3 ampliada y el
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
const zlib = require('node:zlib');
/** Tamaño efectivo de cada texto de un PDF de Chromium: Tf × escala(Tm × CTM),
 *  entrando en los Form XObject, donde Chromium mete el contenido transformado.
 *  Sirve para demostrar que la A3 amplía de verdad, no solo que cabe. */
function medirPDF(pdf) {
  const mul = (a, b) => [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3], a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3], a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5]];
  const d = pdf.toString('latin1');
  const objs = {}; for (const m of d.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objs[m[1]] = m[2];
  const flujo = (o) => { const L = +(/\/Length\s+(\d+)/.exec(o) || [0, 0])[1]; const i = o.indexOf('stream') + 7; try { return zlib.inflateSync(Buffer.from(o.slice(i, i + L), 'latin1')).toString('latin1'); } catch { return ''; } };
  const xobjects = (o) => { const r = /\/XObject\s*<<([^>]*)>>/.exec(o); const out = {}; if (r) for (const m of r[1].matchAll(/\/(\w+)\s+(\d+) 0 R/g)) out[m[1]] = m[2]; return out; };
  const tam = []; let glifos = 0;
  const recorrer = (recursos, contenido, ctm0) => {
    const xo = xobjects(recursos);
    const tok = contenido.match(/\[[^\]]*\]|<[0-9A-Fa-f]*>|\([^)]*\)|\/[^\s\[\]<>(/]+|-?\d*\.?\d+|[A-Za-z*'"]+/g) || [];
    let ctm = ctm0, tm = [1, 0, 0, 1, 0, 0], tf = 1, nombre = null, cadena = ''; const pila = []; let nums = [];
    for (const k of tok) {
      if (/^-?\d*\.?\d+$/.test(k)) { nums.push(+k); continue; }
      if (k[0] === '/') { nombre = k.slice(1); continue; }
      if (k[0] === '<' || k[0] === '[' || k[0] === '(') { cadena = k; continue; }
      if (k === 'q') pila.push(ctm); else if (k === 'Q') ctm = pila.pop() || ctm;
      else if (k === 'cm') ctm = mul(nums.slice(-6), ctm);
      else if (k === 'Tm') tm = nums.slice(-6); else if (k === 'BT') tm = [1, 0, 0, 1, 0, 0];
      else if (k === 'Tf') tf = nums[nums.length - 1];
      else if (k === 'Tj' || k === 'TJ') {
        const m = mul(tm, ctm); tam.push(tf * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])));
        // Glifos dibujados (un byte por glifo en las fuentes simples de Chromium): la cifra que
        // tiene que coincidir entre A4 y A3. El número de operadores no sirve, porque Chromium
        // parte las líneas en tramos distintos según la escala.
        for (const h of cadena.matchAll(/<([0-9A-Fa-f]*)>/g)) glifos += h[1].length / 2;
      }
      else if (k === 'Do' && nombre && xo[nombre]) { const x = objs[xo[nombre]]; const mx = /\/Matrix\s*\[([^\]]+)\]/.exec(x); recorrer(x, flujo(x), mul(mx ? mx[1].trim().split(/\s+/).map(Number) : [1, 0, 0, 1, 0, 0], ctm)); }
      nums = [];
    }
  };
  let mediaBox = null;
  for (const o of Object.values(objs)) {
    if (!/\/Type\s*\/Page\b/.test(o) || /\/Type\s*\/Pages/.test(o)) continue;
    const mb = /\/MediaBox\s*\[([^\]]+)\]/.exec(o); if (mb && !mediaBox) mediaBox = mb[1].trim().split(/\s+/).map(Number);
    const c = /\/Contents\s+(\d+) 0 R/.exec(o); if (c) recorrer(o, flujo(objs[c[1]]), [1, 0, 0, 1, 0, 0]);
  }
  tam.sort((a, b) => a - b);
  return { paginas: paginasPDF(pdf), anchoMm: mediaBox ? mediaBox[2] / 72 * 25.4 : 0, textos: tam.length, glifos, min: tam[0], max: tam[tam.length - 1] };
}
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
  await page.waitForSelector('#datos-g-piramide');
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
  await page.waitForSelector('#datos-g-piramide');
  assert.equal(await page.locator('#nombre').textContent(), 'Santa Cruz de Tenerife');
  assert.ok(page.url().endsWith('/fichas/m/38038.html'), page.url());
  await page.selectOption('#sel-municipio', '38001');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Adeje');
  assert.ok(page.url().endsWith('/fichas/m/38001.html'), page.url());
  await page.selectOption('#sel-municipio', '38038');
  await page.waitForFunction(() => document.getElementById('nombre').textContent === 'Santa Cruz de Tenerife');
  // El fragmento sobrevive al cambio de dirección y a la redirección del envoltorio.
  await page.goto(base + 'ficha.html?municipio=38038#g-evolucion');
  await page.waitForSelector('#datos-g-piramide');
  assert.ok(page.url().endsWith('/fichas/m/38038.html#g-evolucion'), page.url());
  await page.goto(base + 'm/38038.html#g-evolucion');
  await page.waitForSelector('#datos-g-piramide');
  await espera(300);
  assert.ok(page.url().endsWith('/fichas/m/38038.html#g-evolucion'), page.url());
  assert.ok((await page.evaluate(() => scrollY)) > 0, 'el ancla se aplica tras la redirección');
  await page.goto(base + 'ficha.html?municipio=38038');
  await page.waitForSelector('#datos-g-piramide');
  const a3btn = page.locator('#btn-pdf-a3');
  assert.equal(await a3btn.getAttribute('aria-label'), null, 'el nombre accesible es el texto visible');
  assert.equal((await a3btn.textContent()).trim(), 'Imprimir en A3');
  assert.ok((await a3btn.getAttribute('title') || '').includes('A3'));
  await page.locator('.vista').nth(1).click();
  await espera(200);
  assert.equal(await page.locator('#leyenda-piramide').innerText(), 'Hombres nacidos en España\nMujeres nacidas en España\nNacidos en el extranjero');
  // En reposo la pirámide no enseña ninguna cifra (Pedro: «lo de todas las edades no debe salir»);
  // al señalar un grupo, las cifras van dentro del dibujo y la región viva las dice en palabras.
  assert.equal(await page.locator('#lectura-piramide').textContent(), '');
  assert.equal(await page.locator('#marcas-activas text').count(), 0);
  await page.locator('#g-piramide').focus();
  await page.keyboard.press('Home');
  assert.match(await page.locator('#lectura-piramide').textContent(), /^0 a 4 años\. Hombres nacidos en España: .* Nacidos en el extranjero: hombres .*, mujeres /);
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
  assert.deepEqual(await page.locator('.datos-detalle > summary').allTextContents(), ['Método de cálculo', 'Datos y método', 'Datos y método', 'Método de cálculo', ...Array(4).fill('Datos y método')]);
  assert.equal(await page.locator('#fuente-g-evolucion + details').getAttribute('id'), 'datos-g-evolucion', 'la fuente va justo antes del desplegable');
  // Datos y método: plegado, con enlace https y la tabla de las 21 edades.
  const detalle = page.locator('#datos-g-piramide');
  assert.equal(await detalle.getAttribute('open'), null);
  await detalle.locator('summary').click();
  assert.equal(await detalle.locator('tbody tr').count(), 42);
  assert.ok((await detalle.locator('a[href^="https://"]').count()) >= 1);
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
  assert.equal(await rotulosEje(), '0% 4% 8% 12% 14%');
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
  await page.waitForSelector('#datos-g-piramide');
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
  assert.match(await page.locator('#pres-leyenda').textContent(), /nacidos en España/);
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
  await page.waitForSelector('#datos-g-piramide');
  await page.selectOption('#sel-municipio', '38001');
  await espera(150);
  assert.ok((await page.locator('.fantasma').count()) > 0, 'el cruce deja fantasmas mientras dura');
  await espera(1200);
  assert.equal(await page.locator('.fantasma').count(), 0);
  await contexto.close();
  const r = await abrir('ficha.html?municipio=38038');
  await r.page.waitForSelector('#datos-g-piramide');
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
  assert.equal(await page.locator('#datos-cmp-piramides table').count(), 6);
  assert.equal(await page.locator('#fuente-cmp-piramides').textContent(), `Fuente: ISTAC. Población según sexo y grupos de edad, ${indice.anio}. Elaboración propia.`);
  assert.equal(await page.locator('#cmp-extranjero .fuente-grafico + details > summary').textContent(), 'Datos y método');
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
  await page.waitForSelector('#datos-g-piramide');
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

test('papel: las 88 fichas caben en una A4, la A3 amplía la misma hoja y el dossier tiene 98 páginas con su barra', { timeout: 300000, ...SOLO_CHROMIUM }, async () => {
  const { page, contexto, errores } = await abrir('ficha.html?municipio=38038');
  for (const m of indice.municipios) {
    await page.goto(base + `ficha.html?municipio=${m.codmun}`);
    await page.waitForSelector('#datos-g-piramide');
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.equal(paginasPDF(pdf), 1, `A4 de ${m.nombre}`);
  }
  // «Imprimir en A3»: una hoja A3 con los mismos textos que la A4 y todos un 41 % más
  // grandes, medido dentro del PDF (antes la hoja era A3 pero el texto seguía a 17 pt).
  await page.goto(base + 'ficha.html?municipio=38048');
  await page.waitForSelector('#datos-g-piramide');
  const sitio = await json(path.join(RAIZ, 'sitio.json'));
  assert.equal(await page.locator('.pie-fuentes-papel a').textContent(), (sitio.url_publica + 'guia.html').replace(/^https?:\/\//, ''), 'el pie del papel lleva la dirección de la guía');
  // En la hoja se imprime la fuente de cada gráfico y no el desplegable de datos.
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.fuente-grafico:visible').count(), 7, 'siete fuentes en la hoja');
  assert.equal(await page.locator('.datos-detalle:visible').count(), 0, 'el desplegable no se imprime');
  assert.ok(await page.locator('.cabecera .pie-fuentes-papel').isVisible(), 'el camino a la guía va en la cabecera de la hoja');
  await page.emulateMedia({ media: null });
  const a4 = medirPDF(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  await page.evaluate(() => { const real = window.print; window.print = () => {}; imprimirFicha(true); window.print = real; });
  // Papel A3 elegido en el diálogo: la condición de la ampliación se evalúa contra ese papel.
  const a3 = medirPDF(await page.pdf({ format: 'A3', printBackground: true, margin: { top: '12.7mm', right: '14.1mm', bottom: '9.9mm', left: '14.1mm' } }));
  // Si el usuario deja A4 (o carta), tiene que salir la A4 de siempre, no una hoja encogida.
  await page.evaluate(() => { const real = window.print; window.print = () => {}; imprimirFicha(true); window.print = real; });
  const a4Dejada = medirPDF(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '9mm', right: '10mm', bottom: '7mm', left: '10mm' } }));
  assert.equal(a4Dejada.paginas, 1, 'A3 pedido con A4 dejado: una hoja');
  assert.ok(Math.abs(a4Dejada.anchoMm - 210) < 1 && Math.abs(a4Dejada.max - a4.max) < 0.01 && Math.abs(a4Dejada.min - a4.min) < 0.01, `A3 pedido con A4 dejado: título ${a4Dejada.max.toFixed(2)} pt (A4 normal ${a4.max.toFixed(2)})`);
  await page.evaluate(() => { const real = window.print; window.print = () => {}; imprimirFicha(true); window.print = real; });
  const carta = medirPDF(await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '9mm', right: '10mm', bottom: '7mm', left: '10mm' } }));
  assert.equal(carta.paginas, 1, 'A3 pedido con carta dejada: una hoja');
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  assert.equal(await page.locator('#formato-impresion').count(), 0, 'la hoja de estilo de la A3 se retira al acabar');
  assert.equal(a3.paginas, 1, 'A3 en una hoja');
  assert.ok(Math.abs(a3.anchoMm - 297) < 1, `la hoja mide ${a3.anchoMm.toFixed(1)} mm de ancho, no 297`);
  assert.equal(a3.glifos, a4.glifos, 'la A3 lleva los mismos textos que la A4');
  assert.ok(a4.glifos > 2000, `glifos contados en la A4: ${a4.glifos}`);
  assert.ok(a3.max / a4.max > 1.40 && a3.max / a4.max < 1.43, `título ${a4.max.toFixed(2)} pt en A4 y ${a3.max.toFixed(2)} pt en A3`);
  assert.ok(a3.min / a4.min > 1.40 && a3.min / a4.min < 1.43, `texto menor ${a4.min.toFixed(2)} pt en A4 y ${a3.min.toFixed(2)} pt en A3`);
  const otraVezA4 = medirPDF(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  assert.ok(Math.abs(otraVezA4.max - a4.max) < 0.01 && otraVezA4.paginas === 1, 'tras la A3, la A4 vuelve a ser la de siempre');
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

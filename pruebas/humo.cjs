/* Humo sobre la web publicada: tras cada despliegue, comprueba en la dirección
   real que las páginas cargan con su política de contenido, sin errores de
   consola, con la versión de recursos del repositorio y con lo esencial de
   cada una en su sitio. No sustituye a la batería (web.test.cjs): la
   complementa donde la batería no llega, el alojamiento.
   Uso: npm run humo [-- base]   (o NODE_PATH=$(npm root -g) node pruebas/humo.cjs [base] sin npm ci)
   La base por defecto es la URL pública de sitio.json. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const sitio = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sitio.json'), 'utf8'));
const base = (process.argv[2] || sitio.url_publica).replace(/\/?$/, '/');
const version = /estilos\.css\?v=(\d+)/.exec(fs.readFileSync(path.join(RAIZ, 'web/ficha.html'), 'utf8'))[1];
const logos = JSON.stringify(sitio.logos.map((l) => l.nombre));

const errores = [];
const ok = (condicion, que) => { if (!condicion) errores.push(`FALLA: ${que}`); };

(async () => {
  const navegador = await chromium.launch();
  const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  const consola = [];
  page.on('pageerror', (e) => consola.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consola.push(`${m.text()} @ ${m.location().url}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon|no-existe/.test(r.url())) consola.push(`HTTP ${r.status()} ${r.url()}`); });
  const logosDe = (sel) => page.locator(sel).evaluateAll((is) => is.map((i) => i.alt + (i.complete && i.naturalWidth > 0 ? '' : ' (no carga)')));

  // Las cinco páginas: política de contenido y versión de recursos. Cada una
  // termina sus descargas antes de pasar a la siguiente: marcharse a mitad
  // corta las peticiones y la portada anota un «Failed to fetch» que no es suyo.
  for (const p of ['index.html', 'ficha.html?municipio=38038', 'comparar.html', 'guia.html', 'dossier.html']) {
    const respuesta = await page.goto(base + p, { waitUntil: 'networkidle', timeout: 180000 });
    ok(respuesta.ok(), `${p} responde ${respuesta.status()}`);
    ok(await page.locator('meta[http-equiv="Content-Security-Policy"]').count() === 1, `${p} lleva su política de contenido`);
    ok(await page.evaluate((v) => [...document.scripts].filter((s) => s.src).every((s) => s.src.endsWith(`?v=${v}`)), version), `${p} carga los recursos v=${version}`);
  }

  // Portada: los tres logotipos, la banda de Canarias y las siete islas.
  await page.goto(base + 'index.html');
  await page.waitForSelector('.isla-menu');
  ok(JSON.stringify(await logosDe('.tapa-marca .placa img')) === logos, 'los tres logotipos en la portada');
  ok(await page.locator('.isla-menu').count() === 7 && await page.locator('#banda-canarias').count() === 1, 'siete islas y la banda de Canarias');

  // Ficha municipal, por su sobre: redirige, pinta los ocho bloques con su fuente y la cabecera lleva los tres logotipos.
  await page.goto(base + 'm/38038.html');
  await page.waitForSelector('#fuente-g-origen');
  ok(/\/m\/38038\.html$/.test(page.url()), `el sobre deja la dirección m/38038.html (${page.url()})`);
  ok(await page.locator('#nombre').textContent() === 'Santa Cruz de Tenerife', 'la ficha de Santa Cruz de Tenerife');
  ok(await page.locator('.fuente-grafico').count() >= 7, 'las fuentes de los gráficos');
  ok(JSON.stringify(await logosDe('.marca img')) === logos, 'los tres logotipos en la cabecera');
  await page.emulateMedia({ media: 'print' });
  ok(JSON.stringify(await logosDe('.placa-papel img')) === logos, 'los tres logotipos en la placa del papel');
  await page.emulateMedia({ media: null });

  // Isla, provincia y Canarias, por sus sobres.
  await page.goto(base + 'i/tenerife.html');
  await page.waitForSelector('#fuente-g-origen');
  ok(await page.locator('#g-municipios li').count() === 31, 'la ficha de Tenerife lista sus 31 municipios');
  await page.goto(base + 'p/las-palmas.html');
  await page.waitForSelector('#fuente-g-origen');
  ok(await page.locator('#g-municipios-provincia li').count() === 34 && await page.locator('#g-municipios li').count() === 3, 'la ficha de Las Palmas: 3 islas y 34 municipios');
  await page.goto(base + 'r/canarias.html');
  await page.waitForSelector('#fuente-g-origen');
  ok(await page.locator('#migas').textContent() === '2 provincias · 7 islas · 88 municipios', 'la ficha de Canarias');

  // Comparador: tres municipios y las dos provincias.
  await page.goto(base + 'comparar.html?m=38038,35016,38023');
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '3 de 3');
  ok(await page.locator('#cmp-piramides svg').count() === 3, 'el comparador con tres municipios');
  await page.goto(base + 'comparar.html?provincias');
  await page.waitForFunction(() => document.getElementById('cmp-cuenta').textContent === '2 de 2');
  ok(await page.locator('#cmp-intro').textContent() === 'Las dos provincias.', 'el comparador de provincias');

  // La 404 con su icono (solo el alojamiento la sirve; un servidor local da la suya), y el dossier entero.
  const r404 = await page.goto(base + 'no-existe.html');
  ok(r404.status() === 404, `una dirección inexistente responde 404 (${r404.status()})`);
  if (await page.locator('link[rel="icon"]').count() === 1) {
    ok(await page.locator('link[rel="icon"]').evaluate((l) => fetch(l.href).then((r) => r.ok)), 'el icono de la 404 carga');
  }
  await page.goto(base + 'dossier.html');
  await page.waitForFunction(() => document.getElementById('d-total').textContent === '101 hojas', null, { timeout: 180000 });
  ok(await page.locator('.hoja-ficha').count() === 98 && await page.locator('.placa-papel').count() === 98, 'el dossier con sus 98 fichas y sus placas');

  await navegador.close();
  const ruido = consola.filter((m) => !/favicon|no-existe/.test(m));   // la 404 a propósito no es ruido
  if (ruido.length) errores.push(`consola: ${ruido.join(' | ')}`);
  console.log(errores.length ? errores.join('\n') : `humo v=${version}: todo en verde en ${base} (política de contenido en las cinco páginas, sin errores de consola)`);
  process.exit(errores.length ? 1 : 0);
})();

/* Medidas del papel: cuánto mide cada ficha en la A4 (límite 281 mm) y cada
   hoja del dossier (límite 297 mm; la hoja recorta por lo bajo sin avisar).
   Uso: NODE_PATH=$(npm root -g) node pruebas/medir-papel.cjs [base]
   La base es la web servida (por defecto http://localhost:8140/). Imprime las
   peores fichas municipales, las diez agregadas (islas, provincias y Canarias)
   y las peores hojas del dossier; las cifras del README salen de aquí. */
const { chromium } = require('playwright');

const base = (process.argv[2] || 'http://localhost:8140/').replace(/\/?$/, '/');
const MM = 25.4 / 96;
const mm = (px) => (px * MM).toFixed(1);

(async () => {
  const navegador = await chromium.launch();
  const indice = await (await fetch(base + 'datos/indice.json')).json();

  // ---- Ficha en A4: panel a 718 px, medio print y el redibujado de beforeprint.
  const ctx = await navegador.newContext({ viewport: { width: 718, height: 1100 } });
  const page = await ctx.newPage();
  await page.emulateMedia({ media: 'print' });
  const consultas = [
    ...indice.municipios.map((m) => [m.nombre, `municipio=${m.codmun}`]),
    ...indice.islas_resumen.map((i) => [i.nombre, `isla=${i.slug}`]),
    ...indice.provincias.map((p) => [p.nombre, `provincia=${p.slug}`]),
    ['Canarias', 'canarias'],
  ];
  const medidas = [];
  for (const [nombre, consulta] of consultas) {
    await page.goto(`${base}ficha.html?${consulta}`);
    await page.waitForSelector('#fuente-g-origen');
    await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
    await page.waitForTimeout(250);
    const alto = await page.evaluate(() => document.querySelector('.envoltorio').getBoundingClientRect().height);
    medidas.push([nombre, alto, consulta.startsWith('municipio')]);
  }
  await ctx.close();
  const municipales = medidas.filter((m) => m[2]).sort((a, b) => b[1] - a[1]);
  console.log('FICHA A4 (límite 281 mm). Peores municipales:');
  for (const [nombre, alto] of municipales.slice(0, 4)) console.log(`  ${mm(alto)} mm  ${nombre}`);
  console.log('Agregadas:');
  for (const [nombre, alto] of medidas.filter((m) => !m[2])) console.log(`  ${mm(alto)} mm  ${nombre}`);

  // ---- Dossier: cada hoja con la altura libre, para ver cuánto pide de verdad.
  const pd = await navegador.newPage({ viewport: { width: 1000, height: 1100 } });
  await pd.goto(base + 'dossier.html');
  await pd.waitForFunction(() => document.getElementById('d-total').textContent === '101 hojas', null, { timeout: 180000 });
  await pd.addStyleTag({ content: '.hoja { height: auto !important; min-height: 0 !important; }' });
  await pd.waitForTimeout(500);
  const hojas = await pd.evaluate(() => [...document.querySelectorAll('.hoja')].map((h, i) => [i + 1, (h.querySelector('h1, h2') || {}).textContent || h.className, h.offsetHeight, h.classList.contains('hoja-isla')]));
  await pd.close();
  console.log('DOSSIER (límite 297 mm). Hojas de Canarias, provincias e islas:');
  for (const [n, titulo, alto] of hojas.filter((h) => h[3])) console.log(`  ${mm(alto)} mm  hoja ${n} ${titulo.trim()}`);
  console.log('Peores hojas:');
  for (const [n, titulo, alto] of [...hojas].sort((a, b) => b[2] - a[2]).slice(0, 4)) console.log(`  ${mm(alto)} mm  hoja ${n} ${titulo.trim()}`);
  await navegador.close();
})();

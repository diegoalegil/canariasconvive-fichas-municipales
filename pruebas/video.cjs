/* Graba en MP4 la presentación en vídeo de una ficha (web/video.js), fotograma
   a fotograma: abre la ficha a 1920×1080, para el reloj del vídeo, pide cada
   instante con PRES.video.buscar(t), hace la captura y se la pasa a ffmpeg.
   Como cada fotograma es una función del tiempo, el MP4 sale idéntico al que se
   ve en la web, sin saltos aunque el equipo vaya lento.
   Uso: npm run video -- <ficha> [salida.mp4] [--fps 30] [--base URL] [--musica pista.mp3]
     <ficha>: municipio=38038, isla=tenerife, provincia=las-palmas o canarias.
     --musica: una pista de audio para el fondo; se corta a la duración del
     vídeo (o se repite si es más corta) y se funde al final. La web no lleva
     sonido: la música solo va en el MP4, y sus derechos son cosa de quien la ponga.
   La base por defecto es la web publicada (sitio.json); con --base
   http://localhost:8140/ se graba la copia local. Necesita ffmpeg (brew install
   ffmpeg) y Playwright con Chromium. */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const i = args.indexOf(nombre);
  if (i < 0) return porDefecto;
  const valor = args[i + 1];
  args.splice(i, 2);
  return valor;
};
const sitio = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'sitio.json'), 'utf8'));
const fps = Number(opcion('--fps', 30));
const base = opcion('--base', sitio.url_publica).replace(/\/?$/, '/');
const musica = opcion('--musica', null);
if (musica && !fs.existsSync(musica)) { console.error(`No existe la pista ${musica}`); process.exit(2); }
const [ficha, salidaPedida] = args;
if (!ficha || !/^(municipio=\d{5}|isla=[a-z-]+|provincia=[a-z-]+|canarias)$/.test(ficha)) {
  console.error('Uso: npm run video -- <municipio=38038 | isla=tenerife | provincia=las-palmas | canarias> [salida.mp4] [--fps 30] [--base URL] [--musica pista.mp3]');
  process.exit(2);
}
const salida = path.resolve(salidaPedida || `ficha-${ficha.replace(/^.*=/, '')}.mp4`);

(async () => {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await contexto.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(`${base}ficha.html?${ficha}`);
  await page.waitForSelector('#fuente-g-origen');
  // El arranque es el mapa de Canarias: se espera a la geometría y a la tipografía.
  await page.waitForFunction(() => typeof GEO !== 'undefined' && GEO, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.click('#btn-presentar');
  await page.waitForSelector('#presentacion.video');
  const duracion = await page.evaluate(() => {
    PRES.video.pausar();
    document.getElementById('presentacion').classList.add('grabando');
    return PRES.video.duracion;
  });

  const audio = musica
    ? ['-stream_loop', '-1', '-i', musica, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k',
      '-af', `afade=t=in:d=0.4,afade=t=out:st=${(duracion - 2.5).toFixed(2)}:d=2.5`]
    : [];
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-t', duracion.toFixed(3), '-movflags', '+faststart', salida],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const terminado = new Promise((ok, mal) => {
    ffmpeg.on('error', (e) => mal(e.code === 'ENOENT' ? new Error('No se encuentra ffmpeg: brew install ffmpeg') : e));
    ffmpeg.on('close', (codigo) => (codigo === 0 ? ok() : mal(new Error(`ffmpeg terminó con el código ${codigo}`))));
  });
  // Si ffmpeg falla a mitad (sin ffmpeg, una carpeta de salida que no existe), el
  // bucle se para y el error llega limpio al final, no como excepción suelta.
  let fallo = null, cerrado = false;
  terminado.catch((e) => { fallo = e; }).finally(() => { cerrado = true; });
  ffmpeg.stdin.on('error', () => {});
  // Con el búfer lleno se espera a que ffmpeg lo vacíe (o a que se cierre), sin dejar escuchadores colgados.
  const vaciado = () => new Promise((r) => {
    const listo = () => { ffmpeg.stdin.off('drain', listo); ffmpeg.off('close', listo); r(); };
    ffmpeg.stdin.once('drain', listo);
    ffmpeg.once('close', listo);
  });

  const total = Math.round(duracion * fps);
  for (let i = 0; i <= total && !cerrado; i++) {
    await page.evaluate((t) => PRES.video.buscar(t), i / fps);
    const imagen = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (fallo || cerrado) break;
    if (!ffmpeg.stdin.write(imagen)) await vaciado();
    if (i % fps === 0) process.stdout.write(`\r${Math.round(i / total * 100)} %`);
  }
  ffmpeg.stdin.end();
  await terminado;
  await navegador.close();
  if (errores.length) { console.error('\nErrores en la página:', errores); process.exit(1); }
  console.log(`\r${path.relative(process.cwd(), salida)}: ${duracion} s a ${fps} fps, ${(fs.statSync(salida).size / 1e6).toFixed(1)} MB`);
})().catch((e) => { console.error('\n' + e.message); process.exit(1); });

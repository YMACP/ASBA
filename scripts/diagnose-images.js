// Diagnose why article images do not render.
const path = require('node:path');
const fs = require('node:fs');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const USER_DATA = path.join(OUT, 'img-data');
process.env.ASBA_USER_DATA = USER_DATA;
fs.rmSync(USER_DATA, { recursive: true, force: true });
fs.mkdirSync(path.join(USER_DATA, 'data'), { recursive: true });
fs.copyFileSync(path.join(OUT, 'sync-data', 'asba.db'), path.join(USER_DATA, 'data', 'asba.db'));

require('../src/main/main.js');
const { app, BrowserWindow, net } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  await sleep(5500);
  const win = BrowserWindow.getAllWindows()[0];
  const consoleMsgs = [];
  win.webContents.on('console-message', (_e, level, message) => consoleMsgs.push({ level, message: String(message).slice(0, 300) }));

  // pick an article known to contain images
  await win.webContents.executeJavaScript(`(() => {
    const t = [...document.querySelectorAll('.article-item')].find((el) => /electronics design/.test(el.innerText));
    if (t) t.click();
  })()`);
  await sleep(2500);

  const info = await win.webContents.executeJavaScript(`(() => {
    const imgs = [...document.images];
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return {
      article: (document.querySelector('.article-head h1') || {}).innerText || null,
      imgCount: imgs.length,
      csp: csp ? csp.content : null,
      samples: imgs.slice(0, 6).map((i) => ({ src: i.getAttribute('src'), currentSrc: i.currentSrc, complete: i.complete, w: i.naturalWidth, h: i.naturalHeight, display: getComputedStyle(i).display, rect: Math.round(i.getBoundingClientRect().width) })),
    };
  })()`);

  // network check from the main process
  const urls = info.samples.map((s) => s.src).filter(Boolean).slice(0, 3);
  const netResults = [];
  for (const u of urls) {
    try {
      const res = await net.fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', Referer: 'https://www.anthropic.com/' } });
      netResults.push({ u: u.slice(0, 120), status: res.status, type: res.headers.get('content-type') });
    } catch (e) {
      netResults.push({ u: u.slice(0, 120), error: e.message });
    }
  }

  fs.writeFileSync(path.join(OUT, 'img-diag.json'), JSON.stringify({ info, netResults, consoleMsgs: consoleMsgs.slice(-20) }, null, 2), 'utf8');
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'img-diag.png'), img.toPNG());
  app.quit();
});

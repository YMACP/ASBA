// Second image diagnosis: network events + fresh Image() + renderer fetch.
const path = require('node:path');
const fs = require('node:fs');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const USER_DATA = path.join(OUT, 'img-data2');
process.env.ASBA_USER_DATA = USER_DATA;
fs.rmSync(USER_DATA, { recursive: true, force: true });
fs.mkdirSync(path.join(USER_DATA, 'data'), { recursive: true });
fs.copyFileSync(path.join(OUT, 'sync-data', 'asba.db'), path.join(USER_DATA, 'data', 'asba.db'));

require('../src/main/main.js');
const { app, BrowserWindow } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const IMG = 'https://assets.claude.com/c791040ab28139a02eb618d69fc865f8b1ccc5e0.png?w=3840&q=75&fm=webp&fit=max';

app.whenReady().then(async () => {
  await sleep(5000);
  const win = BrowserWindow.getAllWindows()[0];
  const reqs = [];
  win.webContents.session.webRequest.onBeforeRequest((details, cb) => {
    if (/\.(png|webp|jpe?g|gif|svg)(\?|$)/i.test(details.url) || details.url.includes('assets.claude.com')) {
      reqs.push({ url: details.url.slice(0, 140), type: details.resourceType, time: Date.now() });
    }
    cb({});
  });
  win.webContents.session.webRequest.onCompleted((details) => {
    if (/assets\.claude\.com|images\.ctfassets/.test(details.url)) {
      reqs.push({ done: details.url.slice(0, 140), status: details.statusCode, type: details.resourceType });
    }
  });
  win.webContents.session.webRequest.onErrorOccurred((details) => {
    if (/assets\.claude\.com|images\.ctfassets/.test(details.url)) {
      reqs.push({ error: details.url.slice(0, 140), err: details.error, type: details.resourceType });
    }
  });

  await win.webContents.executeJavaScript(`(() => {
    const t = [...document.querySelectorAll('.article-item')].find((el) => /electronics design/.test(el.innerText));
    if (t) t.click();
  })()`);
  await sleep(2500);

  const fresh = await win.webContents.executeJavaScript(`new Promise((resolve) => {
    const im = new Image();
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    im.onload = () => finish({ loaded: true, w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = (e) => finish({ loaded: false, err: String(e) });
    im.src = ${JSON.stringify(IMG)};
    setTimeout(() => finish({ timeout: true, complete: im.complete, currentSrc: im.currentSrc, w: im.naturalWidth }), 6000);
  })`);

  const fetchTest = await win.webContents.executeJavaScript(`fetch(${JSON.stringify(IMG)}, { mode: 'cors' }).then(async (r) => ({ ok: r.ok, status: r.status, type: r.type, len: (await r.blob()).size })).catch((e) => ({ error: String(e) }))`);

  const imgs = await win.webContents.executeJavaScript(`[...document.images].slice(0, 4).map(i => ({ complete: i.complete, w: i.naturalWidth, src: i.getAttribute('src').slice(0, 80) }))`);

  await sleep(1500);
  fs.writeFileSync(path.join(OUT, 'img-diag2.json'), JSON.stringify({ fresh, fetchTest, imgs, reqs: reqs.slice(-30) }, null, 2), 'utf8');
  app.quit();
});

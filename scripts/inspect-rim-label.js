// Open the wet-lab article, scroll to the rim-label images, screenshot them.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9406);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p, timeout: 3000 }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await get('/json/list')).find((x) => x.type === 'page'); } catch { /* retry */ }
    if (!target) await sleep(500);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 0;
  const waiting = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) {
      const w = waiting.get(m.id); waiting.delete(m.id);
      m.error ? w.reject(new Error(JSON.stringify(m.error))) : w.resolve(m.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; waiting.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  await send('Runtime.enable', {});
  await send('Page.enable', {});
  const run = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };

  await run(`(() => { const i = document.querySelector('.search input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Measuring how AI agents handle everyday wet-lab science'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(1500);
  await run(`(() => { const el = [...document.querySelectorAll('.article-item')].find((x) => x.innerText.includes('wet-lab science')); if (el) el.click(); })()`);
  await sleep(3500);

  // Scroll the rim-label image into view.
  const found = await run(`(() => {
    const imgs = [...document.querySelectorAll('.article-body img')];
    const idx = imgs.findIndex((i) => /rim label/i.test(i.alt || ''));
    if (idx < 0) return { ok: false, alts: imgs.map((i) => (i.alt || '').slice(0, 40)) };
    const img = imgs[idx];
    const s = document.querySelector('.reader-scroll');
    s.scrollTop = img.getBoundingClientRect().top + s.scrollTop - 80;
    return { ok: true, idx, alt: img.alt, src: img.getAttribute('src') };
  })()`);
  await sleep(6000);

  const state = await run(`(() => {
    const imgs = [...document.querySelectorAll('.article-body img')];
    const img = imgs.find((i) => /rim label/i.test(i.alt || '')) || imgs[4];
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    return {
      alt: img.alt,
      src: img.getAttribute('src'),
      complete: img.complete,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      css: { width: cs.width, height: cs.height, maxWidth: cs.maxWidth, objectFit: cs.objectFit },
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      total: imgs.length,
    };
  })()`);

  const clip = { x: state.rect.x, y: state.rect.y, width: Math.max(1, Math.min(state.rect.w, 1200)), height: Math.max(1, Math.min(state.rect.h, 900)), scale: 1 };
  const shot = await send('Page.captureScreenshot', { format: 'png', clip });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'rim-label.png'), Buffer.from(shot.data, 'base64'));

  console.log(JSON.stringify({ found, state }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

// Inspect the two reported articles in the running app: image geometry, styles, network state.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9405);
const TITLE = process.argv[3] || 'Introducing GPT‑5.5';
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

  await run(`(() => { const i = document.querySelector('.search input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(TITLE)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(1500);
  const opened = await run(`(() => { const el = [...document.querySelectorAll('.article-item')].find((x) => x.innerText.includes(${JSON.stringify(TITLE)})); if (!el) return false; el.click(); return true; })()`);
  if (!opened) throw new Error('article not found');
  await sleep(6000);

  const info = await run(`(() => {
    const body = document.querySelector('.article-body');
    const imgs = [...body.querySelectorAll('img')];
    return imgs.map((img, n) => {
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      let clip = null;
      for (let a = img.parentElement; a && a !== body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflow !== 'visible' && s.overflow !== 'auto' && s.overflow !== 'scroll') { clip = a.tagName + '.' + (a.className || '') + ' overflow=' + s.overflow; break; }
      }
      return {
        n,
        alt: (img.alt || '').slice(0, 60),
        src: (img.getAttribute('src') || '').slice(0, 110),
        complete: img.complete,
        w: img.naturalWidth,
        h: img.naturalHeight,
        rectW: Math.round(r.width),
        rectH: Math.round(r.height),
        disp: cs.display,
        vis: cs.visibility,
        opacity: cs.opacity,
        loading: img.loading,
        cls: img.className,
        clip,
        parent: img.parentElement ? img.parentElement.tagName + '.' + (img.parentElement.className || '') : null,
      };
    });
  })()`);

  const net = await run(`(() => {
    const rs = performance.getEntriesByType('resource').filter((e) => /ctfassets|cdn\.openai/.test(e.name));
    return rs.slice(-8).map((e) => ({ name: e.name.slice(0, 100), size: e.transferSize, ms: Math.round(e.duration), initiator: e.initiatorType }));
  })()`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'problem-article.png'), Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify({ title: TITLE, images: info, resources: net }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

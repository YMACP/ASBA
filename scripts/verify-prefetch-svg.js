// Check prefetch (no scrolling) and the padded-SVG crop.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9407);
const MODE = process.argv[3] || 'gpt55';
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

  const title = MODE === 'wetlab' ? 'Measuring how AI agents handle everyday wet-lab science' : 'Introducing GPT‑5.5';
  await run(`(() => { const i = document.querySelector('.search input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(title)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(1500);
  await run(`(() => { const el = [...document.querySelectorAll('.article-item')].find((x) => x.innerText.includes(${JSON.stringify(MODE === 'wetlab' ? 'wet-lab science' : 'GPT‑5.5')})); if (el) el.click(); })()`);
  await sleep(12000);

  const state = await run(`(() => {
    const imgs = [...document.querySelectorAll('.article-body img')];
    const svg = imgs.find((i) => /Enlarged rim label/i.test(i.alt || ''));
    return {
      total: imgs.length,
      ok: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      pending: imgs.filter((i) => !i.complete).length,
      failed: imgs.filter((i) => i.classList.contains('img-failed')).length,
      lazy: imgs.filter((i) => i.loading === 'lazy').length,
      svg: svg ? { srcKind: (svg.getAttribute('src') || '').slice(0, 30), w: svg.naturalWidth, h: svg.naturalHeight } : null,
    };
  })()`);

  if (MODE === 'wetlab') {
    const rect = await run(`(() => {
      const img = [...document.querySelectorAll('.article-body img')].find((i) => /Enlarged rim label/i.test(i.alt || ''));
      if (!img) return null;
      const s = document.querySelector('.reader-scroll');
      s.scrollTop = img.getBoundingClientRect().top + s.scrollTop - 100;
      const r = img.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    })()`);
    await sleep(3000);
    if (rect) {
      const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: rect.x, y: Math.max(0, rect.y), width: Math.min(rect.w, 1100), height: Math.min(rect.h, 900), scale: 1 } });
      fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'rim-svg-fixed.png'), Buffer.from(shot.data, 'base64'));
    }
  }

  console.log(JSON.stringify({ mode: MODE, state }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

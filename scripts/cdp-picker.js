// Verify the rising circular translation picker.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9435);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function json(p) {
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
    try { target = (await json('/json/list')).find((x) => x.type === 'page'); } catch { /* retry */ }
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

  await run(`(() => { const el = document.querySelectorAll('.article-item')[7]; if (el) el.click(); })()`);
  await sleep(1500);
  await run(`(() => { const b = [...document.querySelectorAll('.reader-tools .btn')].find((x) => /翻译/.test(x.innerText)); if (b) b.click(); })()`);
  await sleep(140);
  const mid = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'picker-rising.png'), Buffer.from(mid.data, 'base64'));
  await sleep(700);

  const state = await run(`(() => {
    const circles = [...document.querySelectorAll('.pick-circle')];
    return {
      count: circles.length,
      texts: circles.map((c) => c.innerText.replace(/\\s+/g, ' ').trim()),
      rects: circles.map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      opacity: circles.map((c) => getComputedStyle(c).opacity),
    };
  })()`);

  const settled = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'picker-settled.png'), Buffer.from(settled.data, 'base64'));

  // Click outside to dismiss.
  await run(`(() => { const p = document.querySelector('.translate-picker'); if (p) p.click(); })()`);
  await sleep(300);
  const dismissed = await run(`(() => !document.querySelector('.translate-picker'))()`);

  // Reopen and choose the LLM circle (no key -> settings should open).
  await run(`(() => { const b = [...document.querySelectorAll('.reader-tools .btn')].find((x) => /翻译/.test(x.innerText)); if (b) b.click(); })()`);
  await sleep(700);
  await run(`(() => { const c = [...document.querySelectorAll('.pick-circle')].find((x) => x.innerText.includes('大模型')); if (c) c.click(); })()`);
  await sleep(600);
  const llm = await run(`(() => ({ picker: !!document.querySelector('.translate-picker'), settings: document.querySelector('.modal-head h3')?.innerText === '设置' }))()`);

  console.log(JSON.stringify({ state, dismissed, llm }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

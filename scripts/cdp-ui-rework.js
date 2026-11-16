// Inspect the reworked navigation UI and capture a screenshot.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9418);
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
  if (!target) throw new Error('no target');

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

  await sleep(1200);
  const state = await run(`(() => {
    const text = (el) => (el ? el.innerText.replace(/\\s+/g, ' ').trim() : null);
    return {
      brand: text(document.querySelector('.brand')),
      windowTitle: document.title,
      listTitle: text(document.querySelector('.list-head h2')),
      groups: [...document.querySelectorAll('.list-group-head')].map(text),
      sidebar: [...document.querySelectorAll('.side-item')].map(text),
      hasSideNote: document.querySelectorAll('.side-note').length,
      hasAllEntry: [...document.querySelectorAll('.side-item')].some((x) => x.innerText.includes('全部文章')),
    };
  })()`);

  // Click the OpenAI group header via the sidebar and confirm the list scrolls.
  const scrolled = await run(`(async () => {
    const scroller = document.querySelector('.list-scroll');
    const before = scroller.scrollTop;
    const item = [...document.querySelectorAll('.side-item')].find((x) => x.innerText.includes('OpenAI'));
    if (!item) return null;
    item.click();
    await new Promise((r) => setTimeout(r, 900));
    return { before, after: Math.round(scroller.scrollTop) };
  })()`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'ui-rework.png'), Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify({ state, scrolled }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

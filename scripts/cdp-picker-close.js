// Verify wider gap and smooth fall on outside click.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9437);
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
  await sleep(1400);
  await run(`(() => { const b = [...document.querySelectorAll('.reader-tools .btn')].find((x) => /翻译/.test(x.innerText)); if (b) b.click(); })()`);
  await sleep(800);

  const gap = await run(`(() => {
    const c = [...document.querySelectorAll('.pick-circle')].map((x) => x.getBoundingClientRect());
    return { count: c.length, gap: Math.round(c[1].x - (c[0].x + c[0].width)), left: Math.round(c[0].x), right: Math.round(c[1].x) };
  })()`);

  // Click the backdrop, then sample during the fall.
  await run(`(() => { document.querySelector('.translate-picker').click(); })()`);
  await sleep(110);
  const during = await run(`(() => {
    const p = document.querySelector('.translate-picker');
    const c = p ? [...p.querySelectorAll('.pick-circle')] : [];
    return {
      present: !!p,
      leaving: p ? p.classList.contains('leaving') : false,
      styles: c.map((x) => { const r = x.getBoundingClientRect(); return { top: Math.round(r.top), opacity: getComputedStyle(x).opacity }; }),
    };
  })()`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'picker-falling.png'), Buffer.from(shot.data, 'base64'));

  await sleep(400);
  const after = await run(`(() => !document.querySelector('.translate-picker'))()`);

  console.log(JSON.stringify({ gap, during, closed: after }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

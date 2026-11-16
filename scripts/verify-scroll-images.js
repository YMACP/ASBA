// Minimal scroll test: open article, walk to bottom, report image completion.
const http = require('node:http');
const PORT = Number(process.argv[2] || 9402);
const TITLE = process.argv[3] || 'An alignment assessment of recent cybersecurity incidents';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function list() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list', timeout: 3000 }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await list()).find((x) => x.type === 'page'); } catch { /* retry */ }
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
  const run = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };

  // Search then click the matching list item.
  await run(`(() => { const i = document.querySelector('.search input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(TITLE)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(1200);
  const opened = await run(`(() => { const el = [...document.querySelectorAll('.article-item')].find((x) => x.innerText.includes(${JSON.stringify(TITLE)})); if (!el) return false; el.click(); return true; })()`);
  if (!opened) throw new Error('article not in list');
  await sleep(2000);

  const metrics = () => run(`(() => {
    const imgs = [...document.querySelectorAll('.article-body img')];
    const scroller = document.querySelector('.reader-scroll');
    return {
      total: imgs.length,
      ok: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      pending: imgs.filter((i) => !i.complete).length,
      lazy: imgs.filter((i) => i.loading === 'lazy').length,
      failed: imgs.filter((i) => i.classList.contains('img-failed')).length,
      top: Math.round(scroller.scrollTop),
      max: scroller.scrollHeight - scroller.clientHeight,
    };
  })()`);

  const samples = [await metrics()];
  const max = samples[0].max;
  for (let pos = 800; pos <= max + 800; pos += 800) {
    await run(`(() => { document.querySelector('.reader-scroll').scrollTop = ${pos}; })()`);
    await sleep(700);
    samples.push(await metrics());
  }
  await sleep(4000);
  samples.push(await metrics());

  const last = samples[samples.length - 1];
  console.log(JSON.stringify({ title: TITLE, total: last.total, ok: last.ok, pending: last.pending, lazy: last.lazy, failed: last.failed, samples: samples.length, lastTop: last.top, max }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

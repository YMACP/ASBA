// Check whether offscreen images load on demand while scrolling (packaged app via CDP).
const http = require('node:http');
const PORT = Number(process.argv[2] || 9336);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

async function waitTarget(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const list = await getJson('/json/list');
      const p = (list || []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch { /* retry */ }
    await sleep(1000);
  }
  throw new Error('no target');
}

async function main() {
  const target = await waitTarget(60000);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable', {});
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  await evalJs(`(() => { const t=[...document.querySelectorAll('.article-item')].find(el=>/electronics design/.test(el.innerText)); if(t) t.click(); })()`);
  await sleep(3500);
  const sample = () => evalJs(`(() => {
    const imgs = [...document.images];
    const rs = document.querySelector('.reader-scroll');
    return {
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      pending: imgs.filter(i => !i.complete).length,
      total: imgs.length,
      scrollTop: Math.round(rs.scrollTop),
      resourceImgs: performance.getEntriesByType('resource').filter(e => e.initiatorType === 'img' || /\\.(png|webp|jpe?g)/.test(e.name)).length,
    };
  })()`);

  const before = await sample();
  const positions = [2000, 6000, 10000, 14000];
  const after = [];
  for (const p of positions) {
    await evalJs(`(() => { const rs = document.querySelector('.reader-scroll'); rs.scrollTop = ${p}; })()`);
    await sleep(2500);
    after.push({ at: p, ...(await sample()) });
  }
  console.log(JSON.stringify({ before, after }, null, 2));
  ws.close();
}

main().catch((e) => { console.error('FAILED', e.message); process.exit(1); });

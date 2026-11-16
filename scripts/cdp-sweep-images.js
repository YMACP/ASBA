// Sweep several articles in the running app and report per-article image outcomes.
const http = require('node:http');
const PORT = Number(process.argv[2] || 9395);
const LIMIT = Number(process.argv[3] || 20);
const WAIT = Number(process.argv[4] || 4500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: p, timeout: 3000 }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

async function waitTarget() {
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    try {
      const list = await getJson('/json/list');
      const t = (list || []).find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch { /* retry */ }
    await sleep(300);
  }
  throw new Error('no CDP target');
}

async function main() {
  const target = await waitTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable', {});
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  const results = [];
  for (let i = 0; i < LIMIT; i++) {
    const count = await evalJs(`document.querySelectorAll('.article-item').length`);
    if (i >= count) break;
    await evalJs(`(() => { const el = document.querySelectorAll('.article-item')[${i}]; if (el) el.click(); })()`);
    await sleep(WAIT);
    const state = await evalJs(`(() => {
      const imgs = [...document.querySelectorAll('.article-body img')];
      return {
        title: (document.querySelector('.article-head h1') || {}).innerText || '',
        total: imgs.length,
        ok: imgs.filter((x) => x.complete && x.naturalWidth > 0).length,
        failed: imgs.filter((x) => x.classList.contains('img-failed')).length,
        missing: imgs.filter((x) => x.classList.contains('img-missing')).length,
        pending: imgs.filter((x) => !x.complete).length,
        notice: [...document.querySelectorAll('.notice')].some((n) => /图片/.test(n.innerText)),
      };
    })()`);
    results.push({ i, ...state });
  }

  const problems = results.filter((r) => r.failed > 0 || r.missing > 0);
  console.log(JSON.stringify({ checked: results.length, problems, all: results }, null, 2));
  ws.close();
}

main().catch((e) => { console.error(e.stack || e); process.exit(1); });

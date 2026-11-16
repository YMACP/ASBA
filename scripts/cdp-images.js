// Inspect image loading in the packaged app through CDP (Network events + DOM state).
const http = require('node:http');

const PORT = Number(process.argv[2] || 9334);
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

function rpc(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result);
    }
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

async function main() {
  const target = await waitTarget(60000);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const send = rpc(ws);
  const events = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Network.responseReceived' && /\.(png|webp|jpe?g)/i.test(m.params.response.url)) {
      events.push({ kind: 'response', status: m.params.response.status, url: m.params.response.url.slice(0, 120) });
    }
    if (m.method === 'Network.loadingFailed') {
      events.push({ kind: 'failed', error: m.params.errorText, type: m.params.type, url: (m.params.blockedReason || '') });
    }
  });
  await send('Network.enable', {});
  await send('Runtime.enable', {});

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  const results = {};
  for (const [key, keyword] of [['anthropic', 'electronics design'], ['openai', 'Frontier intelligence']]) {
    await evalJs(`(() => {
      const t = [...document.querySelectorAll('.article-item')].find((el) => el.innerText.includes(${JSON.stringify(keyword)}));
      if (t) t.click();
      return !!t;
    })()`);
    await sleep(4500);
    results[key] = await evalJs(`(() => {
      const imgs = [...document.images];
      return {
        title: (document.querySelector('.article-head h1') || {}).innerText,
        count: imgs.length,
        loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
        failed: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
        pending: imgs.filter((i) => !i.complete).length,
        samples: imgs.slice(0, 3).map((i) => ({ src: i.getAttribute('src').slice(0, 100), complete: i.complete, w: i.naturalWidth, current: i.currentSrc.slice(0, 100) })),
      };
    })()`);
  }
  results.events = events.slice(-40);
  console.log(JSON.stringify(results, null, 2));
  ws.close();
}

main().catch((e) => { console.error('FAILED', e.message); process.exit(1); });

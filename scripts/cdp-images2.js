// Probe image pipeline inside the packaged app: CSP logs, fetch, Image(), request events.
const http = require('node:http');
const PORT = Number(process.argv[2] || 9335);
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
  const events = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result);
    } else if (m.method) {
      events.push(m);
    }
  });
  return { send: (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  }), events };
}

async function main() {
  const target = await waitTarget(60000);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const { send, events } = rpc(ws);
  await send('Network.enable', {});
  await send('Log.enable', {});
  await send('Runtime.enable', {});

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  await evalJs(`(() => { const t=[...document.querySelectorAll('.article-item')].find(el=>/electronics design/.test(el.innerText)); if(t) t.click(); })()`);
  await sleep(4000);

  const url = 'https://assets.claude.com/c791040ab28139a02eb618d69fc865f8b1ccc5e0.png?w=3840&q=75&fm=webp&fit=max';
  const probe = await evalJs(`(async () => {
    const url = ${JSON.stringify(url)};
    let f;
    try { const r = await fetch(url); f = { ok: r.ok, status: r.status }; } catch (e) { f = { err: String(e) }; }
    const img = await new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ ok: true, w: im.naturalWidth });
      im.onerror = (e) => resolve({ ok: false, err: String(e) });
      im.src = url;
      setTimeout(() => resolve({ timeout: true, complete: im.complete, current: im.currentSrc, w: im.naturalWidth }), 8000);
    });
    const domImgs = [...document.images].map(i => ({ complete: i.complete, w: i.naturalWidth, src: i.getAttribute('src').slice(0, 60) }));
    return { fetch: f, image: img, csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content, domImgs };
  })()`);

  const logs = events.filter((e) => e.method === 'Log.entryAdded').map((e) => ({ level: e.params.entry.level, text: String(e.params.entry.text).slice(0, 300), source: e.params.entry.source }));
  const netEvents = events
    .filter((e) => e.method === 'Network.requestWillBeSent' && /assets\.claude|ctfassets/.test(e.params.request.url))
    .map((e) => ({ url: e.params.request.url.slice(0, 110), type: e.params.type }));
  const failures = events.filter((e) => e.method === 'Network.loadingFailed').map((e) => ({ error: e.params.errorText, type: e.params.type, blocked: e.params.blockedReason }));

  console.log(JSON.stringify({ probe, logs: logs.slice(-15), netEvents: netEvents.slice(-10), failures: failures.slice(-10) }, null, 2));
  ws.close();
}

main().catch((e) => { console.error('FAILED', e.message); process.exit(1); });

// Measure time from launch until the article list is actually rendered (CDP).
const { spawn, execSync } = require('node:child_process');
const http = require('node:http');

const EXE = process.argv[2];
const PORT = Number(process.argv[3] || 9340);
const TIMEOUT = Number(process.argv[4] || 60000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path, timeout: 1500 }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

async function connect() {
  const end = Date.now() + TIMEOUT;
  while (Date.now() < end) {
    try {
      const list = await getJson('/json/list');
      const p = (list || []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch { /* not up yet */ }
    await sleep(120);
  }
  throw new Error('devtools target never appeared');
}

async function main() {
  const t0 = Date.now();
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(EXE, [`--remote-debugging-port=${PORT}`, '--remote-allow-origins=*'], { stdio: 'ignore', windowsHide: false, env });
  let ms = null;
  let title = null;
  try {
    const target = await connect();
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
      const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params }));
    });
    await send('Runtime.enable', {});
    const end = Date.now() + TIMEOUT;
    while (Date.now() < end) {
      const r = await send('Runtime.evaluate', {
        expression: `({ count: document.querySelectorAll('.article-item').length, title: document.title })`,
        returnByValue: true,
      });
      const v = r.result.value || {};
      if (v.count > 0) {
        ms = Date.now() - t0;
        title = v.title;
        break;
      }
      await sleep(100);
    }
    ws.close();
  } finally {
    try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }); } catch { /* ignore */ }
  }
  console.log(JSON.stringify({ exe: EXE, msToList: ms, title }));
  process.exit(ms ? 0 : 2);
}

main().catch((e) => { console.error('FAILED', e.message); process.exit(3); });

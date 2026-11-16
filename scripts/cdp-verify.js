// Final packaged-app verification: light theme, image preload, screenshot via CDP.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9337);
const OUT = path.join(process.env.TEMP, 'asba_probe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: p, timeout: 5000 }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
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
  const target = await waitTarget(90000);
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
  await send('Page.enable', {});
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  await evalJs(`(() => { const t=[...document.querySelectorAll('.article-item')].find(el=>/electronics design/.test(el.innerText)); if(t) t.click(); })()`);
  await sleep(7000);

  const state = await evalJs(`(() => {
    const imgs = [...document.images];
    const rs = document.querySelector('.reader-scroll');
    return {
      bg: getComputedStyle(document.body).backgroundColor,
      readerBg: getComputedStyle(document.querySelector('.reader')).backgroundColor,
      title: (document.querySelector('.article-head h1')||{}).innerText,
      images: { total: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length },
      scroll: { top: Math.round(rs.scrollTop), clientH: rs.clientHeight, scrollH: rs.scrollHeight },
    };
  })()`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'pkg-light.png'), Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify(state, null, 2));
  ws.close();
}

main().catch((e) => { console.error('FAILED', e.message); process.exit(1); });

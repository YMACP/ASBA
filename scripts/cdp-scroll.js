// Verify scrolling inside the packaged app via Chrome DevTools Protocol.
const http = require('node:http');

const PORT = Number(process.argv[2] || 9333);

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitTargets(deadlineMs) {
  const end = Date.now() + deadlineMs;
  let lastErr;
  while (Date.now() < end) {
    try {
      const list = await getJson('/json/list');
      const page = (list || []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (e) {
      lastErr = e;
    }
    await sleep(1000);
  }
  throw lastErr || new Error('no page target');
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, { resolve, reject });
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
}

async function main() {
  const target = await waitTargets(60000);
  console.log('target:', target.url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', (e) => reject(new Error('ws error')));
  });
  const send = cdp(ws);

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  // wait for the reader to render an article
  let info = null;
  for (let i = 0; i < 30; i++) {
    info = await evalJs(`(() => {
      const rs = document.querySelector('.reader-scroll');
      const h1 = document.querySelector('.article-head h1');
      return rs ? { hasArticle: !!h1, title: h1 ? h1.innerText.slice(0, 40) : null, scrollTop: Math.round(rs.scrollTop), clientH: rs.clientHeight, scrollH: rs.scrollHeight } : null;
    })()`);
    if (info && info.hasArticle && info.scrollH > info.clientH + 50) break;
    await sleep(500);
  }
  console.log('before:', JSON.stringify(info));

  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 1200, y: 600, deltaX: 0, deltaY: -500 });
  await sleep(800);
  const afterWheel = await evalJs(`(() => {
    const rs = document.querySelector('.reader-scroll');
    return { scrollTop: Math.round(rs.scrollTop), clientH: rs.clientHeight, scrollH: rs.scrollHeight };
  })()`);
  console.log('after wheel:', JSON.stringify(afterWheel));

  const jumped = await evalJs(`(() => {
    const rs = document.querySelector('.reader-scroll');
    rs.scrollTop = rs.scrollHeight;
    return Math.round(rs.scrollTop);
  })()`);
  await sleep(400);
  const afterJump = await evalJs(`Math.round(document.querySelector('.reader-scroll').scrollTop)`);
  console.log('jump to bottom:', jumped, '=>', afterJump);

  const ok = afterWheel.scrollTop > 0 && afterJump > 0;
  console.log('RESULT:', ok ? 'SCROLL_OK' : 'SCROLL_BROKEN');
  ws.close();
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error('CDP check failed:', e.message);
  process.exit(3);
});

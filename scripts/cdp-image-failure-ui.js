// Verify image failure states, retry UI, and the missing-source notice in the reader.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9390);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(process.env.TEMP, 'asba_probe');

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
  await send('Page.enable', {});
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  // Open the top item, which the fixture sorts to 2099.
  const opened = await evalJs(`(() => {
    const first = document.querySelector('.article-item');
    if (!first) return null;
    first.click();
    return first.innerText.slice(0, 80);
  })()`);

  await sleep(6000);
  const state = await evalJs(`(() => {
    const body = document.querySelector('.article-body');
    const imgs = [...(body ? body.querySelectorAll('img') : [])];
    const notice = [...document.querySelectorAll('.notice')].map((n) => n.innerText.replace(/\\s+/g, ' ').trim());
    const buttons = [...document.querySelectorAll('.notice button')].map((b) => b.innerText.trim());
    return {
      title: document.querySelector('.article-head h1')?.innerText,
      imgCount: imgs.length,
      imgs: imgs.map((i, n) => ({ n, src: (i.getAttribute('src') || '').slice(0, 80), dataset: !!i.dataset.asbaSource, complete: i.complete, w: i.naturalWidth, failed: i.classList.contains('img-failed'), loaded: i.classList.contains('img-loaded') })),
      notice,
      buttons,
    };
  })()`);

  // Exercise the retry button, then confirm the UI remains responsive.
  const clicked = await evalJs(`(() => {
    const b = [...document.querySelectorAll('.notice button')].find((x) => x.innerText.includes('重新加载图片'));
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await sleep(3500);
  const afterRetry = await evalJs(`(() => {
    const imgs = [...document.querySelectorAll('.article-body img')];
    return {
      failed: imgs.filter((i) => i.classList.contains('img-failed')).length,
      retrying: imgs.filter((i) => i.classList.contains('img-retrying')).length,
      loaded: imgs.filter((i) => i.classList.contains('img-loaded')).length,
    };
  })()`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'image-failure-ui.png'), Buffer.from(shot.data, 'base64'));

  console.log(JSON.stringify({ opened, state, retryButtonClicked: clicked, afterRetry }, null, 2));
  ws.close();
}

main().catch((e) => { console.error(e.stack || e); process.exit(1); });

// Verify the UI batch: sidebar, list counts, reader labels, settings layout.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9426);
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
  await send('Page.enable', {});
  const run = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  };

  await sleep(1500);
  const main = await run(`(() => {
    const rect = (el) => el ? Math.round(el.getBoundingClientRect().right) : null;
    const head = document.querySelector('.list-head .count');
    const group = document.querySelector('.list-group-head .list-group-count');
    return {
      sidebarTitle: document.querySelector('.sidebar-head')?.innerText.trim(),
      sidebar: [...document.querySelectorAll('.side-item')].map((x) => x.innerText.replace(/\\s+/g, ' ').trim()),
      hasLogos: document.querySelectorAll('.side-logo svg').length,
      sidebarWidth: Math.round(document.querySelector('.sidebar').getBoundingClientRect().width),
      groupCountRight: rect(group),
      totalCountRight: rect(head),
      enBadges: [...document.querySelectorAll('.ai-foot .badge')].filter((b) => b.innerText === 'EN').length,
    };
  })()`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'ui-batch-main.png'), Buffer.from(shot.data, 'base64'));

  // Reader toolbar labels
  const reader = await run(`(() => {
    const segs = [...document.querySelectorAll('.seg button')].map((b) => b.innerText.trim());
    const btns = [...document.querySelectorAll('.reader-tools .btn')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim());
    return { segs, btns };
  })()`);

  // Settings
  await run(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.title === '设置'); if (b) b.click(); })()`);
  await sleep(800);
  const settings = await run(`(() => {
    const labels = [...document.querySelectorAll('.modal .field > label')].map((x) => x.innerText.trim());
    const tabs = [...document.querySelectorAll('.proto-tabs button')].map((x) => x.innerText.trim());
    const checks = [...document.querySelectorAll('.check span')].map((x) => x.innerText.trim());
    return {
      title: document.querySelector('.modal-head h3')?.innerText,
      labels, tabs, checks,
      hasFooterNote: /设置会立即/.test(document.querySelector('.modal-foot')?.innerText || ''),
      hasPreset: /快速预设/.test(document.querySelector('.modal-body')?.innerText || ''),
      hasHint: /DPAPI|只填域名|极短的请求/.test(document.querySelector('.modal-body')?.innerText || ''),
      hasRemoved: /并发批次数|每批字符数|Temperature|最大输出 Token/.test(document.querySelector('.modal-body')?.innerText || ''),
    };
  })()`);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'ui-batch-settings.png'), Buffer.from(shot2.data, 'base64'));

  console.log(JSON.stringify({ main, reader, settings }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

// End-to-end machine translation test via the UI.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.argv[2] || 9430);
const TITLE = process.argv[3] || 'Introducing Images 2.6';
const MATCH = process.argv[4] || 'Introducing Images 2.6';
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

  await run(`(() => { const i = document.querySelector('.search input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(TITLE)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(1300);
  await run(`(() => { const el = [...document.querySelectorAll('.article-item')].find((x) => x.innerText.includes(${JSON.stringify(MATCH)})); if (el) el.click(); })()`);
  await sleep(2000);

  await run(`(() => { const b = [...document.querySelectorAll('.reader-tools .btn')].find((x) => x.innerText.includes('翻译成中文')); if (b) b.click(); })()`);
  await sleep(700);
  const modal = await run(`(() => [...document.querySelectorAll('.choice-modal .choice b')].map((x) => x.innerText.trim()))()`);

  await run(`(() => { const b = [...document.querySelectorAll('.choice-modal .choice')].find((x) => x.innerText.includes('机器翻译')); if (b) b.click(); })()`);

  let state = null;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    state = await run(`(() => {
      const seg = [...document.querySelectorAll('.seg button')].map((b) => ({ text: b.innerText.trim(), disabled: b.disabled }));
      const body = document.querySelector('.article-body');
      const text = body ? body.innerText.slice(0, 160) : '';
      const banner = document.querySelector('.sync-banner')?.innerText.replace(/\\s+/g, ' ').trim() || '';
      return { seg, sample: text, banner, zh: /[\\u4e00-\\u9fff]/.test(text) };
    })()`);
    if (state.seg[1] && !state.seg[1].disabled && state.banner === '') break;
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.env.TEMP, 'asba_probe', 'machine-translation.png'), Buffer.from(shot.data, 'base64'));
  console.log(JSON.stringify({ title: TITLE, modalOptions: modal, state }, null, 2));
  ws.close();
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

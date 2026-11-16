// Probe 5b: OpenAI EN listing stats -> JSON report, with hard logging.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const OUT = path.join(process.env.TEMP, 'asba_probe');
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, 'probe5b.log');
fs.writeFileSync(LOG, 'start ' + new Date().toISOString() + '\n');
const log = (...a) => { try { fs.appendFileSync(LOG, a.map(String).join(' ') + '\n'); } catch {} };
process.on('uncaughtException', (e) => { log('UNCAUGHT:', e.stack || e.message); app.exit(1); });
process.on('unhandledRejection', (e) => { log('REJECTION:', (e && (e.stack || e.message)) || e); });

app.setPath('userData', path.join(OUT, 'userData5b'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = {};

async function run() {
  log('ready');
  const ses = session.fromPartition('persist:probe5b');
  ses.setUserAgent(UA, 'en-US,en;q=0.9');
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { session: ses } });
  win.webContents.setUserAgent(UA);
  win.webContents.on('did-fail-load', (e, code, desc, url) => log('fail-load', code, desc, url));
  log('loading');
  await win.loadURL('https://openai.com/research/index/', { userAgent: UA });
  log('loaded');
  await sleep(6000);
  report.initial = await win.webContents.executeJavaScript(`({url:location.href, lang:document.documentElement.lang, title:document.title, text:document.body.innerText.slice(0,400)})`);
  log('initial', JSON.stringify(report.initial));
  report.steps = [];
  let prev = -1;
  for (let i = 0; i < 6; i++) {
    const n = await win.webContents.executeJavaScript(`document.querySelectorAll('a[href^="/index/"], a[href^="https://openai.com/index/"]').length`);
    const btn = await win.webContents.executeJavaScript(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/load more|show more|加载更多/i.test(x.innerText||'')); return b?b.innerText.trim():null; })()`);
    report.steps.push({ i, cards: n, btn });
    log('step', i, n, btn);
    if (n === prev || !btn) break;
    prev = n;
    await win.webContents.executeJavaScript(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/load more|show more|加载更多/i.test(x.innerText||'')); b.scrollIntoView(); b.click(); })()`);
    await sleep(3000);
  }
  report.final = await win.webContents.executeJavaScript(`(() => {
    const items = [...document.querySelectorAll('a[href^="/index/"], a[href^="https://openai.com/index/"]')].map(a=>({href:a.getAttribute('href'), text:(a.innerText||'').replace(/\\s+/g,' ').trim().slice(0,140)}));
    return { count: items.length, sample: items.slice(0,4), tail: items.slice(-3), text: document.body.innerText.slice(0,900) };
  })()`);
  fs.writeFileSync(path.join(OUT, 'probe5b.json'), JSON.stringify(report, null, 2), 'utf8');
  log('written');
  win.destroy();
  app.quit();
}

app.whenReady().then(run).catch((e) => { log('RUN ERROR', e.stack || e.message); fs.writeFileSync(path.join(OUT, 'probe5b.json'), JSON.stringify({ error: e.stack || e.message }, null, 2)); app.exit(1); });

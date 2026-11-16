// Debug which net.fetch options work in Electron's session.
const path = require('node:path');
const fs = require('node:fs');
const { app, net } = require('electron');
const { CrawlBrowser } = require('../src/main/browser');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const LOG = path.join(OUT, 'debug-fetch.log');
fs.writeFileSync(LOG, 'start ' + new Date().toISOString() + '\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
process.on('unhandledRejection', (e) => { log('REJECTION', (e && (e.stack || e.message)) || e); });
app.setPath('userData', path.join(OUT, 'userData-debug'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const URL1 = 'https://openai.com/index/a-thousand-fewer-paths-to-root/';

async function tryFetch(label, fn) {
  const t = Date.now();
  try {
    const r = await fn();
    log(label, 'OK', Date.now() - t, 'ms', 'status=' + r.status, 'len=' + r.len);
    return r;
  } catch (e) {
    log(label, 'ERR', Date.now() - t, 'ms', e && (e.stack || e.message));
    return null;
  }
}

async function run() {
  const b = new CrawlBrowser('openai');
  const t0 = Date.now();
  try {
    await b.load('https://openai.com/research/index/', { waitAfter: 500 });
    log('warm OK', Date.now() - t0);
  } catch (e) {
    log('warm ERR', e.message);
  }
  log('warm done');
  const ses = b.ses;

  await tryFetch('A-minimal', async () => {
    const res = await ses.fetch(URL1, { headers: { 'User-Agent': UA } });
    const text = await res.text();
    return { status: res.status, len: text.length, hasToc: text.includes('data-toc-content') };
  });

  await tryFetch('B-signal-credentials', async () => {
    const res = await ses.fetch(URL1, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(45000),
    });
    const text = await res.text();
    return { status: res.status, len: text.length, hasToc: text.includes('data-toc-content') };
  });

  await tryFetch('C-global-fetch-cookie', async () => {
    const cookies = await ses.cookies.get({ domain: 'openai.com' });
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const res = await fetch(URL1, { headers: { 'User-Agent': UA, Accept: 'text/html', Cookie: cookieHeader } });
    const text = await res.text();
    return { status: res.status, len: text.length, hasToc: text.includes('data-toc-content') };
  });

  await tryFetch('D-net-fetch', async () => {
    const res = await net.fetch(URL1, { headers: { 'User-Agent': UA } });
    const text = await res.text();
    return { status: res.status, len: text.length, hasToc: text.includes('data-toc-content') };
  });

  log('done');
  b.close();
  app.quit();
}
app.whenReady().then(run).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });

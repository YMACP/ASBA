// Does a blank (unloaded) window keep session.fetch alive after the warm window closes?
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');
const { CrawlBrowser } = require('../src/main/browser');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const LOG = path.join(OUT, 'debug-keeper.log');
fs.writeFileSync(LOG, 'start\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-keeper'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const URL1 = 'https://openai.com/index/a-thousand-fewer-paths-to-root/';

async function main() {
  const warm = new CrawlBrowser('openai');
  await warm.load('https://openai.com/research/index/', { waitAfter: 300 });
  log('warm ok');
  warm.close();
  log('warm closed');

  const keeper = new CrawlBrowser('openai');
  keeper.ensure();
  log('keeper created');
  await new Promise((r) => setTimeout(r, 1200));

  const t = Date.now();
  try {
    const res = await keeper.ses.fetch(URL1, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
    const text = await res.text();
    log('fetch OK', Date.now() - t, res.status, text.length, text.includes('data-toc-content'));
  } catch (e) {
    log('fetch ERR', Date.now() - t, e.message);
  }
  keeper.close();
  app.quit();
}
app.whenReady().then(main);

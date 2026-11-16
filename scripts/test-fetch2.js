// Verify article extraction through the warmed session fetch (no listing crawl).
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');
const { CrawlBrowser } = require('../src/main/browser');
const openai = require('../src/main/adapters/openai');

const OUT = path.join(process.env.TEMP, 'asba_probe');
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, 'test-fetch2.log');
fs.writeFileSync(LOG, 'start ' + new Date().toISOString() + '\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-fetch2'));

async function run() {
  const report = { fetches: [] };
  const b = new CrawlBrowser('openai');
  const t0 = Date.now();
  try {
    await b.load('https://openai.com/research/index/', { waitAfter: 1000 });
    report.warmMs = Date.now() - t0;
    log('warm ' + report.warmMs);
  } catch (e) {
    report.warmError = e.message;
    log('warm error ' + e.message);
  }
  b.close();

  const ctx = { progress: () => {}, browser: null };
  for (const url of [
    'https://openai.com/index/a-thousand-fewer-paths-to-root/',
    'https://openai.com/index/measuring-how-ai-agents-handle-wet-lab-science/',
    'https://openai.com/index/openai-gym-beta/',
  ]) {
    const t = Date.now();
    try {
      const a = await openai.fetchArticle(ctx, url);
      report.fetches.push({
        url, ms: Date.now() - t, title: a.title, textLen: a.content_text.length,
        htmlLen: (a.content_html || '').length, imgs: ((a.content_html || '').match(/<img/g) || []).length,
        selector: a.used_selector, published: a.published_at, lang: a.lang,
      });
      log('ok ' + url + ' ' + (Date.now() - t) + 'ms');
    } catch (e) {
      report.fetches.push({ url, error: e.stack || e.message, ms: Date.now() - t });
      log('err ' + url + ' ' + e.message);
    }
  }
  if (ctx.fallbackBrowser) ctx.fallbackBrowser.close();
  fs.writeFileSync(path.join(OUT, 'test-fetch2.json'), JSON.stringify(report, null, 2), 'utf8');
  log('done');
  app.quit();
}
app.whenReady().then(run).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });

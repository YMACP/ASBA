// Validate the fast session-fetch path for OpenAI after CF warm-up.
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

const OUT = path.join(process.env.TEMP, 'asba_probe');
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, 'test-openai2.log');
fs.writeFileSync(LOG, '');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-test2'));

async function run() {
  const openai = require('../src/main/adapters/openai');
  const { CrawlBrowser } = require('../src/main/browser');
  const report = {};

  const b = new CrawlBrowser('test-openai2');
  try {
    const t0 = Date.now();
    const items = await openai.discover({ progress: (p) => { report.lastMsg = p.message; }, browser: b });
    report.discovery = { count: items.length, ms: Date.now() - t0, sample: items.slice(0, 2) };
  } catch (e) {
    report.discovery = { error: e.stack || e.message };
  }
  b.close();

  report.fetches = [];
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
        imgs: ((a.content_html || '').match(/<img/g) || []).length, selector: a.used_selector,
        published: a.published_at, lang: a.lang,
      });
    } catch (e) {
      report.fetches.push({ url, error: e.message, ms: Date.now() - t });
    }
  }
  if (ctx.fallbackBrowser) { try { ctx.fallbackBrowser.close(); } catch {} }

  fs.writeFileSync(path.join(OUT, 'test-openai2.json'), JSON.stringify(report, null, 2), 'utf8');
  app.quit();
}
app.whenReady().then(run).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });

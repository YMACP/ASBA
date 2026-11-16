// Validate adapters against live pages (run with electron, not node).
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

const OUT = path.join(process.env.TEMP, 'asba_probe');
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, 'test-crawl.log');
fs.writeFileSync(LOG, '');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });

app.setPath('userData', path.join(OUT, 'userData-test'));

async function run() {
  const anthropic = require('../src/main/adapters/anthropic');
  const openai = require('../src/main/adapters/openai');
  const { CrawlBrowser } = require('../src/main/browser');

  const report = { anthropic: [], openai: [] };

  for (const url of [
    'https://www.anthropic.com/research/agents-judgment-calls',
    'https://www.anthropic.com/research/project-swap',
    'https://www.anthropic.com/research/zero-days',
  ]) {
    const t0 = Date.now();
    try {
      const a = await anthropic.fetchArticle({ progress: () => {} }, url);
      report.anthropic.push({
        url, ok: true, ms: Date.now() - t0,
        title: a.title, published: a.published_at, author: a.author,
        textLen: a.content_text.length, htmlLen: (a.content_html || '').length,
        imgs: ((a.content_html || '').match(/<img/g) || []).length,
        selector: a.used_selector, lang: a.lang,
        head: a.content_text.slice(0, 160),
      });
      fs.writeFileSync(path.join(OUT, 'anth-' + url.split('/').pop() + '.content.html'), a.content_html || '');
    } catch (e) {
      report.anthropic.push({ url, ok: false, error: e.message });
    }
  }

  const b = new CrawlBrowser('test-openai');
  report.openaiDiscovery = {};
  try {
    const t0 = Date.now();
    const items = await openai.discover({ progress: (p) => { report.openaiDiscovery.message = p.message; }, browser: b });
    report.openaiDiscovery = { count: items.length, ms: Date.now() - t0, sample: items.slice(0, 3), last: items.slice(-2) };
  } catch (e) {
    report.openaiDiscovery = { error: e.stack || e.message };
  }

  for (const url of [
    'https://openai.com/index/a-thousand-fewer-paths-to-root/',
    'https://openai.com/index/measuring-how-ai-agents-handle-wet-lab-science/',
  ]) {
    const t0 = Date.now();
    try {
      const a = await openai.fetchArticle({ progress: () => {}, browser: b }, url);
      report.openai.push({
        url, ok: true, ms: Date.now() - t0,
        title: a.title, published: a.published_at, author: a.author,
        textLen: a.content_text.length, htmlLen: (a.content_html || '').length,
        imgs: ((a.content_html || '').match(/<img/g) || []).length,
        selector: a.used_selector, lang: a.lang,
        head: a.content_text.slice(0, 200),
      });
      fs.writeFileSync(path.join(OUT, 'openai-' + url.split('/').filter(Boolean).pop() + '.content.html'), a.content_html || '');
    } catch (e) {
      report.openai.push({ url, ok: false, error: e.stack || e.message });
    }
  }
  b.close();

  fs.writeFileSync(path.join(OUT, 'test-crawl.json'), JSON.stringify(report, null, 2), 'utf8');
  log('done');
  app.quit();
}

app.whenReady().then(run).catch((e) => { log('RUN ERROR', e.stack || e.message); app.exit(1); });

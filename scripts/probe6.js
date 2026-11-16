// Probe 6: try session.fetch with Cloudflare cookies (fast path) + encoding check.
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');
const { CrawlBrowser } = require('../src/main/browser');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const LOG = path.join(OUT, 'probe6.log');
fs.writeFileSync(LOG, '');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-p6'));

async function run() {
  const report = {};
  // encoding check
  try {
    const f = fs.readdirSync(OUT).find((x) => x.startsWith('anth-agents') && x.endsWith('.html'));
    const html = fs.readFileSync(path.join(OUT, f), 'utf8');
    const m = html.match(/<h1[^>]*>([^<]{0,80})/);
    report.encoding = { file: f, titleSlice: m ? m[1] : null, hasCurlyApos: html.includes('\u2019'), hasMojibake: html.includes('鈥') };
  } catch (e) {
    report.encoding = { error: e.message };
  }

  const b = new CrawlBrowser('probe6');
  const t0 = Date.now();
  await b.load('https://openai.com/research/index/', { waitAfter: 2500 });
  report.indexLoadMs = Date.now() - t0;
  const cookies = await b.ses.cookies.get({ domain: 'openai.com' });
  report.cookies = cookies.map((c) => c.name);

  const urls = [
    'https://openai.com/index/a-thousand-fewer-paths-to-root/',
    'https://openai.com/index/measuring-how-ai-agents-handle-wet-lab-science/',
  ];
  report.fetches = [];
  for (const u of urls) {
    const started = Date.now();
    try {
      const res = await b.ses.fetch(u, {
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' },
      });
      const html = await res.text();
      report.fetches.push({
        url: u, status: res.status, ms: Date.now() - started, len: html.length,
        hasToc: html.includes('data-toc-content'),
        hasChallenge: /just a moment|challenge-platform/i.test(html),
        head: html.slice(0, 120),
      });
    } catch (e) {
      report.fetches.push({ url: u, error: e.message, ms: Date.now() - started });
    }
  }

  // also time a plain browser load of an article for comparison
  const t1 = Date.now();
  await b.load(urls[0], { waitAfter: 1500 });
  report.browserLoadArticleMs = Date.now() - t1;
  b.close();

  fs.writeFileSync(path.join(OUT, 'probe6.json'), JSON.stringify(report, null, 2), 'utf8');
  app.quit();
}
app.whenReady().then(run).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });

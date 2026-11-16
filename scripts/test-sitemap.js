// Test OpenAI sitemap discovery through the warmed Cloudflare session.
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');
const { CrawlBrowser } = require('../src/main/browser');

const OUT = path.join(process.env.TEMP, 'asba_probe');
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, 'test-sitemap.log');
fs.writeFileSync(LOG, 'start ' + new Date().toISOString() + '\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-sitemap'));

async function run() {
  const b = new CrawlBrowser('sitemap');
  const report = {};
  try {
    const t0 = Date.now();
    await b.load('https://openai.com/', { waitAfter: 1200 });
    report.homeMs = Date.now() - t0;
    log('home loaded');
    const candidates = [
      'https://openai.com/sitemap.xml',
      'https://openai.com/sitemap_index.xml',
      'https://openai.com/sitemap-index.xml',
    ];
    report.sitemaps = [];
    for (const u of candidates) {
      try {
        const res = await b.ses.fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' }, signal: AbortSignal.timeout(20000) });
        const text = await res.text();
        const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
        report.sitemaps.push({
          url: u, status: res.status, len: text.length, locs: locs.length,
          indexLocs: locs.filter((x) => /\/index\//.test(x)).length,
          sample: locs.slice(0, 3),
          isIndex: /<sitemapindex/.test(text),
        });
      } catch (e) {
        report.sitemaps.push({ url: u, error: e.message });
      }
    }
    fs.writeFileSync(path.join(OUT, 'sitemap_sample.txt'), JSON.stringify(report, null, 2), 'utf8');
  } finally {
    b.close();
  }
  app.quit();
}
app.whenReady().then(run).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });

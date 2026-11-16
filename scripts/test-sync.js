// End-to-end sync test against a throwaway database.
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

const OUT = path.join(process.env.TEMP, 'asba_probe');
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, 'test-sync.log');
fs.writeFileSync(LOG, 'start ' + new Date().toISOString() + '\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-sync'));

async function run() {
  const { DB } = require('../src/main/db');
  const { Crawler } = require('../src/main/crawler');
  const dataDir = path.join(OUT, 'sync-data');
  fs.rmSync(dataDir, { recursive: true, force: true });
  const db = new DB(dataDir);
  const crawler = new Crawler(db);
  const report = { sites: [], started: new Date().toISOString() };

  for (const site of db.getSites()) {
    log('=== sync ' + site.key);
    const t0 = Date.now();
    let lastLog = 0;
    try {
      await crawler.syncSite(site.id, (p) => {
        if (p.phase === 'fetch' && p.done - lastLog >= 20) {
          lastLog = p.done;
          log(`  ${p.done}/${p.total} ${p.message.slice(0, 80)}`);
        } else if (p.phase === 'discover') {
          log('  discover: ' + p.message);
        } else if (p.phase === 'done' || p.phase === 'error') {
          log('  ' + p.phase + ': ' + p.message);
        }
      });
      const s = db.getSites().find((x) => x.id === site.id);
      report.sites.push({ key: site.key, ms: Date.now() - t0, ok: true, articles: s.article_count, fetched: s.fetched_count });
      log(`=== ${site.key} done in ${Date.now() - t0}ms`);
    } catch (e) {
      report.sites.push({ key: site.key, ms: Date.now() - t0, ok: false, error: e.message });
      log(`=== ${site.key} FAILED ${e.message}`);
    }
  }

  // sample rows
  const list = db.listArticles({ limit: 5, offset: 0 });
  report.sample = list.rows.map((r) => ({ id: r.id, title: r.title, date: r.published_at, lang: r.lang, site: r.site_name, words: r.word_count, excerpt: (r.excerpt || '').slice(0, 80) }));
  report.total = list.total;
  const first = list.rows[0];
  if (first) {
    const full = db.getArticle(first.id);
    report.articleCheck = { id: full.id, htmlLen: (full.content_html || '').length, textLen: (full.content_text || '').length };
  }
  fs.writeFileSync(path.join(OUT, 'test-sync.json'), JSON.stringify(report, null, 2), 'utf8');
  db.close();
  log('ALL DONE');
  app.quit();
}

app.whenReady().then(run).catch((e) => { log('RUN ERROR', e.stack || e.message); app.exit(1); });

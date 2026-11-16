// Incremental sync of the existing test database (fills previously failed articles).
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const LOG = path.join(OUT, 'test-sync2.log');
fs.writeFileSync(LOG, 'start ' + new Date().toISOString() + '\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-sync2'));

async function run() {
  const { DB } = require('../src/main/db');
  const { Crawler } = require('../src/main/crawler');
  const db = new DB(path.join(OUT, 'sync-data'));
  const crawler = new Crawler(db);
  const report = {};
  for (const site of db.getSites()) {
    const t0 = Date.now();
    let last = 0;
    try {
      await crawler.syncSite(site.id, (p) => {
        if (p.phase === 'fetch' && p.done - last >= 20) { last = p.done; log('  ' + p.done + '/' + p.total + ' ' + String(p.message).slice(0, 70)); }
        if (p.phase === 'discover' && p.done) log('  discover done ' + p.total);
        if (p.phase === 'done' || p.phase === 'error') log('  ' + p.phase + ' ' + p.message);
      });
      report[site.key] = { ok: true, ms: Date.now() - t0 };
    } catch (e) {
      report[site.key] = { ok: false, ms: Date.now() - t0, error: e.message };
    }
  }
  report.sites = db.getSites().map((s) => ({ key: s.key, articles: s.article_count, fetched: s.fetched_count }));
  fs.writeFileSync(path.join(OUT, 'test-sync2.json'), JSON.stringify(report, null, 2), 'utf8');
  db.close();
  log('ALL DONE');
  app.quit();
}
app.whenReady().then(run).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });

// PDF export test (dialog bypassed via dirOverride).
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const LOG = path.join(OUT, 'test-pdf.log');
fs.writeFileSync(LOG, 'start\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-pdf'));

async function run() {
  const { DB } = require('../src/main/db');
  const { exportArticlePdf } = require('../src/main/pdf');
  const db = new DB((process.env.ASBA_TEST_DB || path.join(OUT, 'sync-data')));
  const report = {};
  const list = db.listArticles({ limit: 50, offset: 0 });
  const en = list.rows.find((r) => r.lang === 'en' && r.translated);
  const zh = en;
  const dir = path.join(OUT, 'pdf-out');
  fs.rmSync(dir, { recursive: true, force: true });

  if (en) {
    const article = db.getArticle(en.id);
    for (const lang of ['en', 'zh']) {
      try {
        const t0 = Date.now();
        const res = await exportArticlePdf({ article, lang, defaultDir: dir, parent: null, dirOverride: dir });
        const stat = res.path ? fs.statSync(res.path) : null;
        const head = res.path ? fs.readFileSync(res.path).subarray(0, 5).toString() : '';
        report[lang] = { ok: true, ms: Date.now() - t0, path: res.path, bytes: stat?.size, magic: head };
        log(lang, 'ok', stat?.size);
      } catch (e) {
        report[lang] = { ok: false, error: e.stack || e.message };
        log(lang, 'err', e.message);
      }
    }
  } else {
    report.error = 'no translated article';
  }
  fs.writeFileSync(path.join(OUT, 'test-pdf.json'), JSON.stringify(report, null, 2), 'utf8');
  db.close();
  app.quit();
}
app.whenReady().then(run).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });


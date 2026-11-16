// Translation pipeline test against the mock LLM and the sync-test database.
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const LOG = path.join(OUT, 'test-translate.log');
fs.writeFileSync(LOG, 'start ' + new Date().toISOString() + '\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-translate'));

async function run() {
  const { DB } = require('../src/main/db');
  const { translateArticle } = require('../src/main/translate');
  const llm = require('../src/main/llm');
  const db = new DB((process.env.ASBA_TEST_DB || path.join(OUT, 'sync-data')));
  const report = { protocols: {}, article: null };

  const base = { apiKey: 'mock-key', maxTokens: 4096, temperature: 0.2, chunkChars: 1200, concurrency: 2 };
  for (const [protocol, baseUrl] of [
    ['chat', 'http://127.0.0.1:8765/v1'],
    ['messages', 'http://127.0.0.1:8765'],
    ['responses', 'http://127.0.0.1:8765/v1'],
  ]) {
    try {
      const t0 = Date.now();
      const r = await llm.request({ ...base, protocol, baseUrl, model: 'mock-model' }, {
        system: 'test', user: JSON.stringify(['Hello world', 'Second sentence']), maxTokens: 512, timeout: 15000, retries: 0,
      });
      report.protocols[protocol] = { ok: true, ms: Date.now() - t0, text: r.text.slice(0, 120) };
    } catch (e) {
      report.protocols[protocol] = { ok: false, error: e.message };
    }
  }

  // find a fetched English article
  const list = db.listArticles({ limit: 50, offset: 0 });
  const target = list.rows.find((r) => r.lang === 'en' && r.fetched_at && !r.translated);
  if (!target) {
    report.article = { error: 'no English article found', rows: list.rows.length };
  } else {
    const t0 = Date.now();
    try {
      const res = await translateArticle({
        db,
        articleId: target.id,
        llmSettings: { ...base, protocol: 'chat', baseUrl: 'http://127.0.0.1:8765/v1', model: 'mock-model' },
        emit: (p) => { if (p.done && p.total && p.done % 5 === 0) log('translate progress', p.done + '/' + p.total); },
      });
      const full = db.getArticle(target.id);
      const zh = (full.translated_html || '').match(/[\u4e00-\u9fff]/g) || [];
      report.article = {
        id: target.id, title: target.title, ms: Date.now() - t0, ...res,
        translatedHtmlLen: (full.translated_html || '').length,
        cjkChars: zh.length,
        titleZh: full.title_zh,
        sampleHtml: (full.translated_html || '').slice(0, 400),
      };
    } catch (e) {
      report.article = { id: target.id, error: e.stack || e.message };
    }
  }

  fs.writeFileSync(path.join(OUT, 'test-translate.json'), JSON.stringify(report, null, 2), 'utf8');
  db.close();
  log('done');
  app.quit();
}
app.whenReady().then(run).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });


// Export an image-heavy article to PDF and screenshot pages 2-3 of the result.
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');
const { exportArticlePdf } = require('../src/main/pdf');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const LOG = path.join(OUT, 'test-pdf-images.log');
fs.writeFileSync(LOG, 'start\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-pdfimg'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const { DB } = require('../src/main/db');
  const dbDir = path.join(OUT, 'pdfimg-db');
  fs.rmSync(dbDir, { recursive: true, force: true });
  fs.mkdirSync(dbDir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', 'seed.db'), path.join(dbDir, 'asba.db'));
  const db = new DB(dbDir);
  const row = db.listArticles({ limit: 600 }).rows.find((r) => /electronics design/.test(r.title));
  const article = db.getArticle(row.id);
  const dir = path.join(OUT, 'pdf-images');
  fs.rmSync(dir, { recursive: true, force: true });
  const res = await exportArticlePdf({ article, lang: 'en', defaultDir: dir, parent: null, dirOverride: dir });
  log('pdf', res.path, fs.statSync(res.path).size);

  for (const page of [2, 3]) {
    const win = new BrowserWindow({ show: false, width: 1000, height: 1300, webPreferences: { plugins: true } });
    await win.loadURL(pathToFileURL(res.path).href + `#page=${page}&zoom=80`);
    await sleep(2500);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `pdf-page-${page}.png`), img.toPNG());
    win.destroy();
  }
  db.close();
  log('done');
  app.quit();
}).catch((e) => { log('RUN ERR', e.stack || e.message); app.exit(1); });

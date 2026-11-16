// Debug the zh PDF path failure and capture a preview image.
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow } = require('electron');
const { buildHtml } = require('../src/main/pdf');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const LOG = path.join(OUT, 'debug-pdf.log');
fs.writeFileSync(LOG, 'start\n');
const log = (...a) => fs.appendFileSync(LOG, a.map(String).join(' ') + '\n');
process.on('uncaughtException', (e) => { log('UNCAUGHT', e.stack || e.message); app.exit(1); });
app.setPath('userData', path.join(OUT, 'userData-pdfdbg'));

async function run() {
  const { DB } = require('../src/main/db');
  const db = new DB(process.env.ASBA_TEST_DB || path.join(OUT, 'ui-data', 'data'));
  const row = db.listArticles({ limit: 50 }).rows.find((r) => r.translated);
  const article = db.getArticle(row.id);
  const html = buildHtml(article, 'zh');
  const tmp = path.join(OUT, 'zh-debug.html');
  fs.writeFileSync(tmp, html, 'utf8');
  log('tmp exists', fs.existsSync(tmp), 'bytes', fs.statSync(tmp).size, 'htmlLen', html.length);

  const win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true } });
  win.webContents.on('did-fail-load', (e, code, desc, url) => log('did-fail-load', code, desc, url));
  try {
    await win.loadFile(tmp);
    log('loadFile OK');
    await new Promise((r) => setTimeout(r, 1200));
    const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.55, bottom: 0.5, left: 0.6, right: 0.6 } });
    const out = path.join(OUT, 'zh-debug.pdf');
    fs.writeFileSync(out, pdf);
    log('pdf bytes', pdf.length);
  } catch (e) {
    log('ERROR', e.stack || e.message);
  }
  // preview: open the generated PDF in Electron's viewer and screenshot page 1 frame
  try {
    const out = path.join(OUT, 'zh-debug.pdf');
    if (fs.existsSync(out)) {
      const v = new BrowserWindow({ show: false, width: 900, height: 1200 });
      await v.loadURL('file:///' + out.replace(/\\/g, '/'));
      await new Promise((r) => setTimeout(r, 2500));
      const img = await v.webContents.capturePage();
      fs.writeFileSync(path.join(OUT, 'pdf-preview.png'), img.toPNG());
      log('preview saved');
      v.destroy();
    }
  } catch (e) {
    log('preview error', e.message);
  }
  win.destroy();
  db.close();
  app.quit();
}
app.whenReady().then(run);

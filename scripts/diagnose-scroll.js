// Diagnose scrolling in the reader pane.
const path = require('node:path');
const fs = require('node:fs');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const USER_DATA = path.join(OUT, 'scroll-data');
process.env.ASBA_USER_DATA = USER_DATA;
// fresh copy of the crawled DB
fs.rmSync(USER_DATA, { recursive: true, force: true });
fs.mkdirSync(path.join(USER_DATA, 'data'), { recursive: true });
fs.copyFileSync(path.join(OUT, 'sync-data', 'asba.db'), path.join(USER_DATA, 'data', 'asba.db'));

require('../src/main/main.js');
const { app, BrowserWindow } = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  await sleep(6000);
  const win = BrowserWindow.getAllWindows()[0];
  await win.webContents.executeJavaScript(`(() => { const a = document.querySelector('.article-item'); if (a) a.click(); })()`);
  await sleep(2000);
  const before = await win.webContents.executeJavaScript(`(() => {
    const rs = document.querySelector('.reader-scroll');
    const r = document.querySelector('.reader');
    const ws = document.querySelector('.workspace');
    const app = document.querySelector('.app');
    const box = (el) => el ? { top: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height) } : null;
    return {
      win: { w: innerWidth, h: innerHeight },
      bodyScrollH: document.body.scrollHeight,
      bodyOverflow: getComputedStyle(document.body).overflow,
      app: box(app), workspace: box(ws), reader: box(r), readerScroll: box(rs),
      rsClientH: rs && rs.clientHeight, rsScrollH: rs && rs.scrollHeight,
      rsOverflowY: rs && getComputedStyle(rs).overflowY,
      articleLen: document.querySelector('.article-body')?.innerHTML.length || 0,
    };
  })()`);
  const after = await win.webContents.executeJavaScript(`(() => {
    const rs = document.querySelector('.reader-scroll');
    if (!rs) return null;
    rs.scrollTop = 5000;
    const a = rs.scrollTop;
    const ws = document.querySelector('.workspace');
    return { scrollTop: a, innerScrollOk: a > 0, workspaceH: Math.round(ws.getBoundingClientRect().height) };
  })()`);
  fs.writeFileSync(path.join(OUT, 'scroll-diag.json'), JSON.stringify({ before, after }, null, 2), 'utf8');
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'scroll-after.png'), img.toPNG());
  app.quit();
});

// Verify scrolling with a real wheel event, then capture the result.
const path = require('node:path');
const fs = require('node:fs');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const USER_DATA = path.join(OUT, 'scroll-data2');
process.env.ASBA_USER_DATA = USER_DATA;
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
  await sleep(1500);

  const read = () => win.webContents.executeJavaScript(`(() => {
    const rs = document.querySelector('.reader-scroll');
    const title = document.querySelector('.article-head h1');
    const rect = title ? title.getBoundingClientRect() : null;
    return { scrollTop: rs ? Math.round(rs.scrollTop) : -1, titleTop: rect ? Math.round(rect.top) : null, rsScrollH: rs ? rs.scrollHeight : 0, rsClientH: rs ? rs.clientHeight : 0 };
  })()`);

  const before = await read();
  // real wheel events over the article area
  for (let i = 0; i < 6; i++) {
    win.webContents.sendInputEvent({ type: 'mouseWheel', x: 1100, y: 600, deltaX: 0, deltaY: -400, canScroll: true });
    await sleep(120);
  }
  await sleep(700);
  const afterWheel = await read();
  const img1 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'scroll-wheel.png'), img1.toPNG());

  // also jump deep into the article and verify the title left the viewport
  const jumped = await win.webContents.executeJavaScript(`(() => {
    const rs = document.querySelector('.reader-scroll');
    rs.scrollTop = rs.scrollHeight;
    const t = document.querySelector('.article-head h1');
    return { scrollTop: Math.round(rs.scrollTop), titleTop: t ? Math.round(t.getBoundingClientRect().top) : null };
  })()`);
  await sleep(600);
  const img2 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'scroll-bottom.png'), img2.toPNG());

  fs.writeFileSync(path.join(OUT, 'scroll-diag2.json'), JSON.stringify({ before, afterWheel, jumped }, null, 2), 'utf8');
  app.quit();
});

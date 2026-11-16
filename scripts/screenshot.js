// Launch the real app against a prepared userData dir and capture screenshots.
const path = require('node:path');
const fs = require('node:fs');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const USER_DATA = process.env.ASBA_USER_DATA || path.join(OUT, 'ui-data');
process.env.ASBA_USER_DATA = USER_DATA;

require('../src/main/main.js');
const { app, BrowserWindow } = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  await sleep(6000);
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) { fs.writeFileSync(path.join(OUT, 'shot.log'), 'no window'); app.quit(); return; }
  const save = async (name) => {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, name), img.toPNG());
  };
  await save('ui-main.png');
  try {
    await win.webContents.executeJavaScript(`(() => { const b = document.querySelector('button[title="设置"]'); if (b) b.click(); return !!b; })()`);
    await sleep(1200);
    await save('ui-settings.png');
    await win.webContents.executeJavaScript(`(() => { const b = document.querySelector('.modal-head .icon-btn'); if (b) b.click(); })()`);
    await sleep(600);
    await win.webContents.executeJavaScript(`(() => { const a = document.querySelector('.article-item'); if (a) a.click(); })()`);
    await sleep(2500);
    await save('ui-reader.png');
  } catch (e) {
    fs.writeFileSync(path.join(OUT, 'shot.log'), String(e.stack || e.message));
  }
  fs.writeFileSync(path.join(OUT, 'shot.log'), 'ok');
  app.quit();
});

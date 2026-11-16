// Verify image preloading at top of article + capture the new light theme.
const path = require('node:path');
const fs = require('node:fs');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const USER_DATA = path.join(OUT, 'ui-light');
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
  const evalJs = (js) => win.webContents.executeJavaScript(js, true);

  await evalJs(`(() => { const t=[...document.querySelectorAll('.article-item')].find(el=>/electronics design/.test(el.innerText)); if(t) t.click(); })()`);
  await sleep(6000);

  const imgState = await evalJs(`(() => {
    const imgs = [...document.images];
    const rs = document.querySelector('.reader-scroll');
    return {
      total: imgs.length,
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      pending: imgs.filter(i => !i.complete).length,
      scrollTop: Math.round(rs.scrollTop),
      themeBg: getComputedStyle(document.body).backgroundColor,
      readerBg: getComputedStyle(document.querySelector('.reader')).backgroundColor,
    };
  })()`);

  const img1 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'light-main.png'), img1.toPNG());

  await evalJs(`(() => { const b=document.querySelector('button[title="设置"]'); if(b) b.click(); })()`);
  await sleep(1000);
  const img2 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'light-settings.png'), img2.toPNG());

  fs.writeFileSync(path.join(OUT, 'light-diag.json'), JSON.stringify(imgState, null, 2), 'utf8');
  app.quit();
});

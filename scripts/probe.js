// Temporary probe: dump DOM + verify node:sqlite inside Electron.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(process.env.TEMP, 'asba_probe');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

async function run() {
  let sqliteState = 'unknown';
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec('create table t(a text)');
    db.prepare('insert into t values (?)').run('ok');
    sqliteState = JSON.stringify(db.prepare('select * from t').get());
    db.close();
  } catch (e) {
    sqliteState = 'ERROR: ' + e.message;
  }
  console.log('electron=' + process.versions.electron + ' node=' + process.versions.node + ' chrome=' + process.versions.chrome);
  console.log('node:sqlite => ' + sqliteState);

  const targets = [
    { name: 'openai_index', url: 'https://openai.com/zh-Hans-CN/research/' },
    { name: 'anth_index', url: 'https://www.anthropic.com/research' },
    { name: 'anth_article', url: 'https://www.anthropic.com/research/agents-judgment-calls' },
  ];

  for (const t of targets) {
    const win = new BrowserWindow({
      show: false,
      width: 1440,
      height: 1000,
      webPreferences: { session: session.fromPartition('persist:probe'), javascript: true },
    });
    win.webContents.setUserAgent(UA);
    win.webContents.setBackgroundThrottling(false);
    let status = '';
    try {
      await win.loadURL(t.url, { userAgent: UA });
      await new Promise((r) => setTimeout(r, 7000));
      const info = await win.webContents.executeJavaScript(`(() => ({
        title: document.title,
        url: location.href,
        textLen: document.body ? document.body.innerText.length : 0,
        textHead: document.body ? document.body.innerText.slice(0, 600) : '',
        links: document.body ? [...document.querySelectorAll('a')].map(a => a.href).slice(0, 80) : [],
        html: document.documentElement.outerHTML
      }))()`);
      fs.writeFileSync(path.join(OUT, t.name + '.html'), info.html, 'utf8');
      status = `title=${info.title} | url=${info.url} | textLen=${info.textLen}`;
      console.log(`\n### ${t.name}: ${status}`);
      console.log(info.textHead.replace(/\s+/g, ' ').slice(0, 400));
      if (t.name === 'openai_index') console.log('links sample:', info.links.slice(0, 30).join('\n'));
      if (t.name === 'anth_index') console.log('links sample:', info.links.filter((l) => l.includes('/research/')).slice(0, 30).join('\n'));
    } catch (e) {
      console.log(`\n### ${t.name}: ERROR ${e.message}`);
    }
    win.destroy();
  }
  app.quit();
}

app.whenReady().then(run).catch((e) => {
  console.error(e);
  app.exit(1);
});

// Probe 4: can we force English on openai.com? + load-more behaviour.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const OUT = path.join(process.env.TEMP, 'asba_probe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const ses = session.fromPartition('persist:probe4');
  ses.setUserAgent(UA, 'en-US,en;q=0.9');
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { session: ses } });
  win.webContents.setUserAgent(UA);
  await win.loadURL('https://openai.com/research/index/', { userAgent: UA });
  await sleep(6000);
  let r = await win.webContents.executeJavaScript(`({url: location.href, lang: document.documentElement.lang, title: document.title, text: document.body.innerText.slice(0,200)})`);
  console.log('forced EN =>', JSON.stringify(r, null, 1));

  // count + load more loop
  let prev = -1;
  for (let i = 0; i < 4; i++) {
    const n = await win.webContents.executeJavaScript(`new Set([...document.querySelectorAll('a[href*="/index/"]')].map(a=>a.href)).size`);
    console.log('page links:', n, 'prev:', prev);
    if (n === prev) break;
    prev = n;
    const clicked = await win.webContents.executeJavaScript(`(() => {
      const b = [...document.querySelectorAll('button,a')].find(x => /load more|加载更多|show more/i.test((x.innerText||'').trim()));
      if (b) { b.scrollIntoView(); b.click(); return (b.innerText||'').trim(); }
      return null;
    })()`);
    console.log('click:', clicked);
    if (!clicked) break;
    await sleep(3000);
  }
  // final listing snapshot: anchors with card text
  const cards = await win.webContents.executeJavaScript(`(() => {
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/index/"]')) {
      const t = (a.innerText || '').replace(/\\s+/g,' ').trim();
      if (t) out.push({href: a.href, text: t.slice(0,120)});
    }
    return { count: out.length, sample: out.slice(0, 6), tail: out.slice(-4) };
  })()`);
  console.log(JSON.stringify(cards, null, 1));
  fs.writeFileSync(path.join(OUT, 'openai_index_after_load.html'), await win.webContents.executeJavaScript('document.documentElement.outerHTML'), 'utf8');
  win.destroy();
  app.quit();
}
app.whenReady().then(run).catch((e) => { console.error(e); app.exit(1); });

// Probe 3: OpenAI English index pagination + article DOM.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const OUT = path.join(process.env.TEMP, 'asba_probe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const win = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { session: session.fromPartition('persist:probe3') } });
  win.webContents.setUserAgent(UA);

  console.log('### openai EN research index');
  await win.loadURL('https://openai.com/research/index/', { userAgent: UA });
  await sleep(6000);
  let info = await win.webContents.executeJavaScript(`(() => {
    const links = [...document.querySelectorAll('a[href*="/index/"]')].map(a=>a.href);
    const btns = [...document.querySelectorAll('button')].map(b=>b.innerText.trim());
    return {url:location.href, title:document.title, n:new Set(links).size, btns, text:document.body.innerText.slice(0,500)};
  })()`);
  console.log(JSON.stringify(info, null, 1));

  for (let i = 0; i < 2; i++) {
    const clicked = await win.webContents.executeJavaScript(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => /load more|加载更多/i.test(x.innerText));
      if (b) { b.click(); return b.innerText.trim(); }
      return null;
    })()`);
    console.log('clicked:', clicked);
    await sleep(3500);
    const n = await win.webContents.executeJavaScript(`new Set([...document.querySelectorAll('a[href*="/index/"]')].map(a=>a.href)).size`);
    console.log('links after click:', n);
  }

  console.log('\n### openai EN article');
  const win2 = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { session: session.fromPartition('persist:probe3') } });
  win2.webContents.setUserAgent(UA);
  await win2.loadURL('https://openai.com/index/introducing-gpt-6-1-sol/', { userAgent: UA });
  await sleep(6000);
  const art = await win2.webContents.executeJavaScript(`(() => ({
    title: document.title, url: location.href, textLen: document.body.innerText.length,
    h1: (document.querySelector('h1')||{}).innerText || '',
    jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>s.textContent).join('\\n').slice(0,1500),
    html: document.documentElement.outerHTML
  }))()`);
  fs.writeFileSync(path.join(OUT, 'openai_article.html'), art.html, 'utf8');
  console.log(JSON.stringify({ title: art.title, url: art.url, textLen: art.textLen, h1: art.h1 }, null, 1));
  console.log(art.jsonld);
  const nl = await win2.webContents.executeJavaScript(`document.body.innerText.slice(0,600)`);
  console.log('--- text ---\n' + nl);

  win.destroy(); win2.destroy();
  app.quit();
}
app.whenReady().then(run).catch((e) => { console.error(e); app.exit(1); });

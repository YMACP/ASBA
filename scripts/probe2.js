// Probe 2: OpenAI research index + Anthropic retry with diagnostics.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const OUT = path.join(process.env.TEMP, 'asba_probe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

async function load(win, url, waitMs) {
  win.webContents.on('did-fail-load', (e, code, desc, validatedURL) => {
    console.log(`  did-fail-load ${code} ${desc} ${validatedURL}`);
  });
  try {
    await win.loadURL(url, { userAgent: UA });
  } catch (e) {
    console.log('  loadURL threw: ' + e.message);
  }
  await new Promise((r) => setTimeout(r, waitMs));
}

async function run() {
  {
    const win = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { session: session.fromPartition('persist:probe2') } });
    win.webContents.setUserAgent(UA);
    console.log('### openai research index');
    await load(win, 'https://openai.com/zh-Hans-CN/research/index/', 8000);
    const info = await win.webContents.executeJavaScript(`(() => {
      const links = [...document.querySelectorAll('a[href*="/index/"]')].map(a => ({href:a.href, text:a.innerText.replace(/\\s+/g,' ').trim().slice(0,120)}));
      const uniq = []; const seen = new Set();
      for (const l of links) { if(!seen.has(l.href)){seen.add(l.href); uniq.push(l);} }
      const buttons = [...document.querySelectorAll('button')].map(b=>b.innerText.replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0,40);
      return {title:document.title, url:location.href, textLen:document.body.innerText.length,
        text:document.body.innerText.slice(0,2500), links:uniq.slice(0,60), buttons,
        html: document.documentElement.outerHTML};
    })()`);
    fs.writeFileSync(path.join(OUT, 'openai_research_index.html'), info.html, 'utf8');
    console.log(JSON.stringify({ title: info.title, url: info.url, textLen: info.textLen, linkCount: info.links.length, buttons: info.buttons }, null, 1));
    console.log('--- first links ---');
    console.log(info.links.slice(0, 12).map((l) => l.href + '  ||  ' + l.text).join('\n'));
    console.log('--- text head ---');
    console.log(info.text.slice(0, 1200));
    win.destroy();
  }

  {
    const win = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { session: session.fromPartition('persist:probe2') } });
    win.webContents.setUserAgent(UA);
    console.log('\n### anthropic research retry');
    await load(win, 'https://www.anthropic.com/research', 8000);
    try {
      const info = await win.webContents.executeJavaScript(`(() => ({title:document.title, url:location.href, textLen:document.body?document.body.innerText.length:0, text:document.body?document.body.innerText.slice(0,800):'', html:document.documentElement.outerHTML}))()`);
      fs.writeFileSync(path.join(OUT, 'anth_index2.html'), info.html, 'utf8');
      console.log(JSON.stringify({ title: info.title, url: info.url, textLen: info.textLen }, null, 1));
      console.log(info.text.slice(0, 300));
    } catch (e) {
      console.log('eval error: ' + e.message);
      console.log('url=' + win.webContents.getURL());
    }
    win.destroy();
  }
  app.quit();
}

app.whenReady().then(run).catch((e) => { console.error(e); app.exit(1); });

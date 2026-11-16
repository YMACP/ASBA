'use strict';

const { BrowserWindow, session } = require('electron');
const { sleep } = require('./util');
const { UA } = require('./net');
const { applyToSession } = require('./proxy');

/**
 * Headless Chromium helper used for sites protected by JS challenges (Cloudflare)
 * or that need client-side rendering. One persistent session per site.
 */
class CrawlBrowser {
  constructor(siteKey, { width = 1440, height = 1000, showImages = false } = {}) {
    this.siteKey = siteKey;
    this.width = width;
    this.height = height;
    this.showImages = showImages;
    this.win = null;
    this.ses = CrawlBrowser.sessionFor(siteKey);
    this.ses.setUserAgent(UA, 'en-US,en;q=0.9');
    this.ready = applyToSession(this.ses).catch(() => {});
  }

  static sessionFor(siteKey) {
    const ses = session.fromPartition(`persist:crawl-${siteKey}`);
    ses.setUserAgent(UA, 'en-US,en;q=0.9');
    return ses;
  }

  ensure() {
    if (this.win && !this.win.isDestroyed()) return this.win;
    this.win = new BrowserWindow({
      show: false,
      width: this.width,
      height: this.height,
      skipTaskbar: true,
      webPreferences: {
        session: this.ses,
        backgroundThrottling: false,
        images: this.showImages,
        javascript: true,
        sandbox: true,
      },
    });
    this.win.webContents.setUserAgent(UA, 'en-US,en;q=0.9');
    this.win.webContents.setAudioMuted(true);
    return this.win;
  }

  async load(url, { timeout = 60000, waitAfter = 2500, expectText = true } = {}) {
    await this.ready;
    const win = this.ensure();
    const wc = win.webContents;
    let done = false;
    const finished = new Promise((resolve) => {
      const onLoad = () => { done = true; resolve('load'); };
      const onFail = (_e, code, desc) => { done = true; resolve(`fail:${code}:${desc}`); };
      wc.once('did-finish-load', onLoad);
      wc.once('did-fail-load', onFail);
    });
    try {
      wc.loadURL(url, { userAgent: UA });
    } catch {
      /* handled below */
    }
    const result = await Promise.race([finished, sleep(timeout).then(() => (done ? 'load' : 'timeout'))]);
    wc.removeAllListeners('did-finish-load');
    wc.removeAllListeners('did-fail-load');
    if (String(result).startsWith('fail')) throw new Error(`load failed ${result} ${url}`);
    await sleep(waitAfter);
    if (expectText) {
      const isChallenge = await this.eval(`(() => {
        const t = document.body ? document.body.innerText.slice(0, 300) : '';
        return /just a moment|checking your browser|verify you are human/i.test(t);
      })()`).catch(() => false);
      if (isChallenge) {
        await sleep(6000);
        const still = await this.eval(`(() => /just a moment|checking your browser|verify you are human/i.test(document.body ? document.body.innerText.slice(0,300) : ''))()`).catch(() => false);
        if (still) throw new Error('Cloudflare challenge did not pass');
      }
    }
    return result;
  }

  async eval(js) {
    await this.ready;
    const win = this.ensure();
    return win.webContents.executeJavaScript(js, true);
  }

  async outerHTML() {
    return this.eval('document.documentElement.outerHTML');
  }

  close() {
    try {
      if (this.win && !this.win.isDestroyed()) this.win.destroy();
    } catch { /* ignore */ }
    this.win = null;
  }
}

module.exports = { CrawlBrowser, UA };

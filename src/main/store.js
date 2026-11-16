'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');

const DEFAULTS = {
  protocol: 'chat',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
  maxTokens: 4096,
  temperature: 0.2,
  concurrency: 3,
  chunkChars: 2600,
  context1M: false,
  maxOutput128K: false,
  pdfDir: '',
  pdfDirCustom: false,
  proxyHost: '',
  proxyPort: '',
};

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = { ...DEFAULTS };
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const hadPdfDirCustom = Object.prototype.hasOwnProperty.call(raw, 'pdfDirCustom');
      const downloads = app.getPath('downloads');
      const keyEnc = raw.apiKeyEnc;
      delete raw.apiKeyEnc;
      this.data = { ...DEFAULTS, ...raw };
      // Migrate settings written before pdfDirCustom existed: a path that is
      // not the default Downloads folder was explicitly chosen by the user.
      if (!hadPdfDirCustom && raw.pdfDir && raw.pdfDir !== downloads) {
        this.data.pdfDirCustom = true;
      }
      if (keyEnc && safeStorage.isEncryptionAvailable()) {
        try {
          this.data.apiKey = safeStorage.decryptString(Buffer.from(keyEnc, 'base64'));
        } catch {
          this.data.apiKey = '';
        }
      } else if (keyEnc) {
        this.data.apiKey = Buffer.from(keyEnc, 'base64').toString('utf8');
      }
    } catch {
      this.data = { ...DEFAULTS };
    }
    if (!this.data.pdfDir) {
      try {
        this.data.pdfDir = app.getPath('downloads');
      } catch {
        this.data.pdfDir = '';
      }
    }
  }

  get() {
    return { ...this.data };
  }

  getLlm() {
    const { protocol, baseUrl, model, apiKey, maxTokens, temperature, concurrency, chunkChars, context1M, maxOutput128K } = this.data;
    return { protocol, baseUrl, model, apiKey, maxTokens, temperature, concurrency, chunkChars, context1M, maxOutput128K };
  }

  save(patch) {
    const next = { ...this.data, ...(patch || {}) };
    // numeric coercion
    for (const k of ['maxTokens', 'concurrency', 'chunkChars']) {
      const v = Number(next[k]);
      if (Number.isFinite(v) && v > 0) next[k] = Math.floor(v);
    }
    const t = Number(next.temperature);
    if (Number.isFinite(t)) next.temperature = Math.min(2, Math.max(0, t));

    const toWrite = { ...next };
    delete toWrite.apiKey;
    if (next.apiKey && safeStorage.isEncryptionAvailable()) {
      toWrite.apiKeyEnc = safeStorage.encryptString(String(next.apiKey)).toString('base64');
    } else if (next.apiKey) {
      toWrite.apiKeyEnc = Buffer.from(String(next.apiKey), 'utf8').toString('base64');
    } else {
      toWrite.apiKeyEnc = '';
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(toWrite, null, 2), 'utf8');
    this.data = next;
    return this.get();
  }
}

module.exports = { Store, DEFAULTS };

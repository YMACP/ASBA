'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ipcMain, shell, dialog, app } = require('electron');
const { testConnection } = require('./llm');
const { listModels } = require('./models');
const { translateArticle } = require('./translate');
const { translateArticleMachine } = require('./machine');
const { exportArticlePdf } = require('./pdf');
const { applyProxy, getProxyStatus, testProxy } = require('./proxy');

function registerIpc({ db, store, crawler, getWindow }) {
  const send = (channel, payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  };

  // throttle "data changed" so the list refreshes without hammering the renderer
  let changeTimer = null;
  const notifyChanged = () => {
    if (changeTimer) return;
    changeTimer = setTimeout(() => {
      changeTimer = null;
      send('data:changed', { at: Date.now() });
    }, 700);
  };

  // For packaged builds this is the app.asar mtime, i.e. the packaging time.
  const buildTime = (() => {
    try {
      return fs.statSync(app.getAppPath()).mtime.toISOString();
    } catch {
      return null;
    }
  })();

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    buildTime,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    userData: app.getPath('userData'),
    dbPath: db.file,
    platform: process.platform,
  }));

  ipcMain.handle('sites:list', () => db.getSites());

  ipcMain.handle('sites:sync', async (event, { siteId }) => {
    const site = db.getSite(siteId);
    if (!site) throw new Error('站点不存在');
    if (crawler.isRunning(siteId)) throw new Error('该站点正在同步');
    const task = crawler.syncSite(siteId, (p) => {
      send('sync:progress', p);
      if (p.articleId) notifyChanged();
    });
    // fire and forget progress updates; await completion for the caller
    try {
      await task;
      notifyChanged();
      return { ok: true, sites: db.getSites() };
    } catch (e) {
      send('sync:progress', { siteId, phase: 'error', message: e.message });
      throw e;
    }
  });

  ipcMain.handle('sites:cancel', (event, { siteId }) => ({ ok: crawler.cancel(siteId) }));

  ipcMain.handle('articles:list', (event, params) => db.listArticles(params || {}));

  ipcMain.handle('articles:get', (event, id) => {
    const a = db.getArticle(Number(id));
    if (!a) throw new Error('文章不存在');
    return a;
  });

  ipcMain.handle('articles:refetch', async (event, { siteId, articleId }) => {
    const art = await crawler.fetchOne(siteId, articleId);
    notifyChanged();
    return art;
  });

  ipcMain.handle('translate:run', async (event, { articleId }) => {
    const settings = store.getLlm();
    const result = await translateArticle({
      db,
      articleId: Number(articleId),
      llmSettings: settings,
      emit: (p) => send('translate:progress', p),
    });
    notifyChanged();
    return { ok: true, ...result, article: db.getArticle(Number(articleId)) };
  });

  ipcMain.handle('translate:machine', async (event, { articleId }) => {
    const result = await translateArticleMachine({
      db,
      articleId: Number(articleId),
      emit: (p) => send('translate:progress', p),
    });
    notifyChanged();
    return { ok: true, ...result, article: db.getArticle(Number(articleId)) };
  });

  ipcMain.handle('translate:delete', (event, { articleId }) => {
    db.deleteTranslation(Number(articleId));
    notifyChanged();
    return { ok: true };
  });

  ipcMain.handle('settings:get', () => {
    const s = store.get();
    return { ...s, apiKey: s.apiKey || '' };
  });

  ipcMain.handle('settings:save', async (event, patch) => {
    const saved = store.save(patch || {});
    await applyProxy(saved);
    return saved;
  });

  ipcMain.handle('proxy:status', () => getProxyStatus());
  ipcMain.handle('proxy:test', (event, payload) => testProxy(payload || {}));

  ipcMain.handle('settings:test', async (event, override) => {
    const s = { ...store.getLlm(), ...(override || {}) };
    return testConnection(s);
  });

  ipcMain.handle('models:list', async (event, payload) => {
    return listModels(payload || {});
  });

  ipcMain.handle('pdf:export', async (event, { articleId, lang }) => {
    const article = db.getArticle(Number(articleId));
    if (!article) throw new Error('文章不存在');
    if (lang === 'zh' && !article.translated_html) throw new Error('还没有中文译文，请先翻译');
    if (!article.content_html) throw new Error('正文尚未抓取');
    const res = await exportArticlePdf({
      article,
      lang: lang === 'zh' ? 'zh' : 'en',
      defaultDir: store.get().pdfDir,
      parent: getWindow(),
    });
    if (!res.canceled && res.dir) store.save({ pdfDir: res.dir, pdfDirCustom: true });
    return res;
  });

  ipcMain.handle('shell:reveal', async (event, target) => {
    const p = String(target || '');
    if (!p) return false;
    shell.showItemInFolder(p);
    return true;
  });

  ipcMain.handle('dir:choose', async () => {
    const res = await dialog.showOpenDialog(getWindow() || undefined, {
      title: '选择默认 PDF 保存目录',
      defaultPath: store.get().pdfDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths.length) return null;
    store.save({ pdfDir: res.filePaths[0], pdfDirCustom: true });
    return res.filePaths[0];
  });

  ipcMain.handle('shell:open', async (event, url) => {
    const u = String(url || '');
    if (!/^https?:\/\//i.test(u)) throw new Error('仅支持打开 http(s) 链接');
    await shell.openExternal(u);
    return true;
  });
}

module.exports = { registerIpc };

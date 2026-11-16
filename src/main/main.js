'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { DB } = require('./db');
const { Store } = require('./store');
const { Crawler } = require('./crawler');
const { registerIpc } = require('./ipc');
const { applyProxy } = require('./proxy');

const isDev = !!process.env.ASBA_DEV_URL;
const appIcon = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.ico')
  : path.join(__dirname, '..', '..', 'build', 'icon.ico');

const BOOT_LOG = process.env.ASBA_BOOT_LOG || '';
function boot(msg) {
  if (!BOOT_LOG) return;
  try {
    fs.appendFileSync(BOOT_LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch { /* ignore */ }
}
process.on('uncaughtException', (e) => boot('UNCAUGHT ' + (e && (e.stack || e.message))));
process.on('unhandledRejection', (e) => boot('REJECTION ' + ((e && (e.stack || e.message)) || e)));
boot('module loaded');

if (process.env.ASBA_USER_DATA) {
  app.setPath('userData', process.env.ASBA_USER_DATA);
}

let mainWindow = null;
let db = null;
let store = null;
let crawler = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1120,
    minHeight: 700,
    show: false,
    backgroundColor: '#f6f1e6',
    icon: appIcon,
    title: 'ASBA',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    boot('ready-to-show');
    mainWindow.show();
  });
  mainWindow.webContents.on('did-finish-load', () => boot('renderer loaded'));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => boot(`renderer fail ${code} ${desc}`));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (!url.startsWith('file://') && !url.startsWith(current.split('#')[0])) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ASBA_DEV_URL);
  } else {
    const rendererFile = path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html');
    if (!fs.existsSync(rendererFile)) {
      boot('renderer missing ' + rendererFile);
      dialog.showErrorBox(
        'ASBA 无法启动',
        '安装文件不完整（缺少界面资源）。请重新运行 ASBA 安装程序，或从官网重新下载安装包。'
      );
      app.quit();
      return;
    }
    mainWindow.loadFile(rendererFile);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  boot('app ready');
  app.setAppUserModelId('com.asba.desktop');
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  // First run: ship a pre-crawled database so the app opens with content.
  try {
    const dbFile = path.join(dataDir, 'asba.db');
    const seed = path.join(process.resourcesPath || '', 'seed.db');
    if (!fs.existsSync(dbFile) && process.resourcesPath && fs.existsSync(seed)) {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.copyFileSync(seed, dbFile);
      boot('seed copied');
    }
  } catch (e) { boot('seed error ' + e.message); }
  try {
    db = new DB(dataDir);
    boot('db opened');
    store = new Store();
    await applyProxy(store.get());
    boot('proxy ready');
    crawler = new Crawler(db);
    boot('services ready');
    registerIpc({ db, store, crawler, getWindow: () => mainWindow });
    boot('ipc ready');
    createWindow();
    boot('window created');
  } catch (e) {
    boot('STARTUP ERROR ' + (e && (e.stack || e.message)));
    throw e;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  try {
    const { disposePrintWindow } = require('./pdf');
    disposePrintWindow();
  } catch { /* ignore */ }
  try {
    if (crawler) {
      for (const siteId of Array.from(crawler.runs.keys())) crawler.cancel(siteId);
    }
    if (db) db.close();
  } catch { /* ignore */ }
});

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

function subscribe(channel, cb) {
  const handler = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('asba', {
  info: () => invoke('app:info'),
  sites: {
    list: () => invoke('sites:list'),
    sync: (siteId) => invoke('sites:sync', { siteId }),
    cancel: (siteId) => invoke('sites:cancel', { siteId }),
  },
  articles: {
    list: (params) => invoke('articles:list', params),
    get: (id) => invoke('articles:get', id),
    refetch: (siteId, articleId) => invoke('articles:refetch', { siteId, articleId }),
  },
  translate: {
    run: (articleId) => invoke('translate:run', { articleId }),
    machine: (articleId) => invoke('translate:machine', { articleId }),
    remove: (articleId) => invoke('translate:delete', { articleId }),
  },
  settings: {
    get: () => invoke('settings:get'),
    save: (patch) => invoke('settings:save', patch),
    test: (override) => invoke('settings:test', override),
  },
  models: {
    list: (payload) => invoke('models:list', payload),
  },
  proxy: {
    status: () => invoke('proxy:status'),
    test: (payload) => invoke('proxy:test', payload),
  },
  pdf: {
    export: (articleId, lang) => invoke('pdf:export', { articleId, lang }),
    chooseDir: () => invoke('dir:choose'),
  },
  openExternal: (url) => invoke('shell:open', url),
  reveal: (target) => invoke('shell:reveal', target),
  onSyncProgress: (cb) => subscribe('sync:progress', cb),
  onTranslateProgress: (cb) => subscribe('translate:progress', cb),
  onDataChanged: (cb) => subscribe('data:changed', cb),
});

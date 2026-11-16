import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ArticleList from './components/ArticleList.jsx';
import Reader from './components/Reader.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { IconRefresh, IconSearch, IconSettings, IconClose } from './components/Icons.jsx';
import { GoogleMark, DeepSeekMark } from './components/BrandLogos.jsx';
import asbaWordmark from './assets/asba-wordmark.png';

const api = window.asba;
const LAST_ARTICLE_KEY = 'asba:lastArticleId';

const NETWORK_RE = /网络不可达|ERR_|ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|timed?\s*out|abort|fetch failed|load failed|net::|代理|连接失败/i;
const isNetworkError = (e) => NETWORK_RE.test(String((e && (e.message || e)) || ''));

let toastSeq = 0;

export default function App() {
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [scrollToken, setScrollToken] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selectedId, setSelectedId] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(LAST_ARTICLE_KEY));
      return Number.isFinite(saved) && saved > 0 ? saved : null;
    } catch {
      return null;
    }
  });
  const [article, setArticle] = useState(null);
  const [lang, setLang] = useState('en');
  const [loadingList, setLoadingList] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [syncState, setSyncState] = useState(null);
  const [syncingSite, setSyncingSite] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translateChoiceOpen, setTranslateChoiceOpen] = useState(false);
  const [pickerLeaving, setPickerLeaving] = useState(false);
  const loadedArticleId = useRef(null);
  const [translateProgress, setTranslateProgress] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [proxyStatus, setProxyStatus] = useState(null);
  const [appInfo, setAppInfo] = useState(null);
  const [toasts, setToasts] = useState([]);
  const syncingRef = useRef(null);

  const toast = useCallback((msg, type = 'ok', action = null) => {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, msg, type, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'err' ? 9000 : 5000);
  }, []);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 260);
    return () => clearTimeout(t);
  }, [query]);

  const loadSites = useCallback(async () => {
    try {
      setSites(await api.sites.list());
    } catch (e) {
      toast('读取站点失败：' + e.message, 'err');
    }
  }, [toast]);

  useEffect(() => {
    if (!api) return;
    loadSites();
    api.settings.get().then(setSettings).catch(() => {});
    api.proxy.status().then(setProxyStatus).catch(() => {});
    api.info().then(setAppInfo).catch(() => {});
  }, [loadSites]);

  // load list
  useEffect(() => {
    let alive = true;
    setLoadingList(true);
    api.articles
      .list({ siteId: null, q: debounced || null, limit: 2000, offset: 0 })
      .then((res) => {
        if (!alive) return;
        setRows(res.rows);
        setTotal(res.total);
        // Never auto-open an article on first launch. Only keep the article
        // restored from the previous session when it still exists in the list.
        setSelectedId((prev) => (prev && res.rows.some((r) => r.id === prev) ? prev : null));
      })
      .catch((e) => alive && toast('读取文章失败：' + e.message, 'err'))
      .finally(() => alive && setLoadingList(false));
    return () => {
      alive = false;
    };
  }, [debounced, refresh, toast]);

  // Remember the article so the next launch can restore it. A fresh profile
  // has no value here, which leaves the reader blank on first launch.
  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(LAST_ARTICLE_KEY, String(selectedId));
      else localStorage.removeItem(LAST_ARTICLE_KEY);
    } catch { /* ignore unavailable storage */ }
  }, [selectedId]);

  // load selected article
  useEffect(() => {
    let alive = true;
    if (!selectedId) {
      setArticle(null);
      return () => { alive = false; };
    }
    api.articles
      .get(selectedId)
      .then((a) => {
        if (!alive) return;
        setArticle(a);
        // Reset to the source language only when switching articles; keep the
        // 译文 tab selected after translating (refresh reloads the same row).
        if (loadedArticleId.current !== a.id) {
          loadedArticleId.current = a.id;
          setLang('en');
        }
      })
      .catch((e) => alive && toast('读取正文失败：' + e.message, 'err'));
    return () => {
      alive = false;
    };
  }, [selectedId, refresh, toast]);

  // event subscriptions
  useEffect(() => {
    if (!api) return undefined;
    const offSync = api.onSyncProgress((p) => {
      setSyncState(p);
      if (p.phase === 'done' || p.phase === 'error') {
        setTimeout(() => {
          setSyncState((cur) => (cur && cur.siteId === p.siteId && (cur.phase === 'done' || cur.phase === 'error') ? null : cur));
        }, 4500);
      }
    });
    const offTranslate = api.onTranslateProgress((p) => {
      if (p && p.articleId === selectedId) setTranslateProgress(p);
    });
    const offData = api.onDataChanged(() => setRefresh((x) => x + 1));
    return () => {
      offSync && offSync();
      offTranslate && offTranslate();
      offData && offData();
    };
  }, [selectedId]);

  const runSync = useCallback(
    async (siteId) => {
      if (syncingRef.current) return;
      syncingRef.current = siteId;
      setSyncingSite(siteId);
      setSyncState({ siteId, phase: 'discover', message: '准备同步…', done: 0, total: 0 });
      try {
        const res = await api.sites.sync(siteId);
        if (res && res.sites) setSites(res.sites);
        toast('同步完成', 'ok');
      } catch (e) {
        if (isNetworkError(e)) {
          const noProxy = proxyStatus && !proxyStatus.configured;
          toast(noProxy ? '网络不可达，请在设置中配置代理' : '网络不可达', 'err', noProxy ? { label: '打开设置', fn: () => setSettingsOpen(true) } : null);
        } else {
          toast('同步失败', 'err');
        }
      } finally {
        syncingRef.current = null;
        setSyncingSite(null);
        setRefresh((x) => x + 1);
        loadSites();
      }
    },
    [loadSites, toast, proxyStatus]
  );

  const syncAll = useCallback(async () => {
    if (syncingRef.current) return;
    for (const s of sites) {
      // sequential to keep politeness and clear progress
      // eslint-disable-next-line no-await-in-loop
      await runSync(s.id);
    }
  }, [sites, runSync]);

  const cancelSync = useCallback(async () => {
    if (syncState) {
      await api.sites.cancel(syncState.siteId).catch(() => {});
    }
  }, [syncState]);

  const translate = useCallback(async () => {
    if (!article) return;
    if (!settings || !settings.apiKey) {
      setSettingsOpen(true);
      return;
    }
    setTranslating(true);
    setTranslateProgress({ done: 0, total: 0, message: '准备中…' });
    try {
      const res = await api.translate.run(article.id);
      if (res.article) setArticle(res.article);
      setLang('zh');
      setRefresh((x) => x + 1);
      toast('翻译完成', 'ok');
      loadSites();
    } catch (e) {
      console.error('翻译失败', e);
      if (isNetworkError(e)) {
        const noProxy = proxyStatus && !proxyStatus.configured;
        toast(noProxy ? '网络不可达，请在设置中配置代理' : '网络不可达', 'err', noProxy ? { label: '打开设置', fn: () => setSettingsOpen(true) } : null);
      } else {
        toast('翻译失败', 'err');
      }
    } finally {
      setTranslating(false);
      setTranslateProgress(null);
    }
  }, [article, settings, toast, loadSites, proxyStatus]);

  const pickTranslation = useCallback((run) => {
    setPickerLeaving(true);
    setTimeout(() => {
      setPickerLeaving(false);
      setTranslateChoiceOpen(false);
      run();
    }, 220);
  }, []);

  const closePicker = useCallback(() => {
    if (pickerLeaving) return;
    setPickerLeaving(true);
    setTimeout(() => {
      setPickerLeaving(false);
      setTranslateChoiceOpen(false);
    }, 240);
  }, [pickerLeaving]);

  const machineTranslate = useCallback(async () => {
    setTranslateChoiceOpen(false);
    if (!article) return;
    setTranslating(true);
    setTranslateProgress({ done: 0, total: 0, message: '机器翻译中...' });
    try {
      const res = await api.translate.machine(article.id);
      if (res.article) setArticle(res.article);
      setLang('zh');
      setRefresh((x) => x + 1);
      toast('翻译完成', 'ok');
      loadSites();
    } catch (e) {
      console.error('机器翻译失败', e);
      if (/Google限流|429/.test(String(e.message || ''))) {
        toast('Google限流', 'err');
      } else if (isNetworkError(e)) {
        const noProxy = proxyStatus && !proxyStatus.configured;
        toast(noProxy ? '网络不可达，请在设置中配置代理' : '网络不可达', 'err', noProxy ? { label: '打开设置', fn: () => setSettingsOpen(true) } : null);
      } else {
        toast('翻译失败', 'err');
      }
    } finally {
      setTranslating(false);
      setTranslateProgress(null);
    }
  }, [article, toast, loadSites, proxyStatus]);

  const exportPdf = useCallback(
    async (targetLang) => {
      if (!article) return;
      setExporting(true);
      try {
        const res = await api.pdf.export(article.id, targetLang);
        if (res && !res.canceled) {
          toast('PDF 已保存：' + res.path, 'ok', { label: '打开所在文件夹', fn: () => api.reveal(res.path) });
        }
      } catch (e) {
        toast('导出失败：' + e.message, 'err');
      } finally {
        setExporting(false);
      }
    },
    [article, toast]
  );

  const refetch = useCallback(async () => {
    if (!article) return;
    setRefetching(true);
    try {
      const a = await api.articles.refetch(article.site_id, article.id);
      setArticle(a);
      setRefresh((x) => x + 1);
      toast('正文已更新', 'ok');
    } catch (e) {
      toast('抓取失败：' + e.message, 'err');
    } finally {
      setRefetching(false);
    }
  }, [article, toast]);

  const openSettings = useCallback(async () => {
    try {
      setSettings(await api.settings.get());
      setProxyStatus(await api.proxy.status());
    } catch { /* ignore */ }
    setSettingsOpen(true);
  }, []);

  const saveSettings = useCallback(
    async (form) => {
      const saved = await api.settings.save(form);
      setSettings(saved);
      setProxyStatus(await api.proxy.status());
      toast('设置已保存', 'ok');
    },
    [toast]
  );

  const chooseDir = useCallback(async () => {
    const dir = await api.pdf.chooseDir();
    if (dir) toast('默认目录已更新', 'ok');
    return dir;
  }, [toast]);

  const openOriginal = useCallback((url) => {
    api.openExternal(url).catch((e) => toast('打开失败：' + e.message, 'err'));
  }, [toast]);

  const activeName = '文章';

  const syncPct = syncState && syncState.total ? Math.min(100, Math.round(((syncState.done || 0) / syncState.total) * 100)) : 0;
  const listHint = debounced ? `搜索 “${debounced}”` : syncingSite ? '同步进行中，列表会自动更新…' : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-wordmark" src={asbaWordmark} alt="ASBA" />
          <div className="brand-text">
            <span>AI安全前沿研究</span>
          </div>
        </div>
        <div className="search">
          <IconSearch size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题、摘要或正文…"
            spellCheck={false}
          />
        </div>
        <div className="top-actions">
          <button className="btn" onClick={syncAll} disabled={!!syncingSite}>
            {syncingSite ? <span className="spinner" /> : <IconRefresh size={14} />}
            {syncingSite ? '同步中…' : '同步全部'}
          </button>
          <button className="icon-btn" title="设置" onClick={openSettings}>
            <IconSettings size={17} />
          </button>
        </div>
      </header>

      {syncState ? (
        <div className="sync-banner">
          {syncState.phase === 'done' || syncState.phase === 'error' ? null : <span className="spinner" />}
          <span className="msg">
            {syncState.siteName ? `[${syncState.siteName}] ` : ''}
            {syncState.message || '同步中…'}
          </span>
          <span className="bar">
            <i style={{ width: `${syncState.phase === 'discover' ? 8 : syncPct}%` }} />
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            {syncState.total ? `${syncState.done || 0}/${syncState.total}` : ''}
          </span>
          {syncState.phase === 'done' || syncState.phase === 'error' ? null : (
            <button className="btn small" onClick={cancelSync}>
              取消
            </button>
          )}
        </div>
      ) : null}

      <div className="workspace">
        <Sidebar
          sites={sites}
          activeSite={activeSite}
          onSelect={(id) => {
            setActiveSite(id);
            setScrollToken((n) => n + 1);
          }}
          onSync={runSync}
          syncingSite={syncingSite}
        />
        <ArticleList
          rows={rows}
          total={total}
          loading={loadingList}
          selectedId={selectedId}
          onSelect={setSelectedId}
          title={activeName}
          hint={listHint}
          sites={sites}
          activeSite={activeSite}
          scrollToken={scrollToken}
        />
        <Reader
          article={article}
          lang={lang}
          setLang={setLang}
          translating={translating}
          translateProgress={translateProgress}
          exporting={exporting}
          refetching={refetching}
          onTranslate={() => setTranslateChoiceOpen(true)}
          onExportPdf={exportPdf}
          onRefetch={refetch}
          onOpenOriginal={openOriginal}
        />
      </div>

      {translateChoiceOpen ? (
        <div
          className={'translate-picker' + (pickerLeaving ? ' leaving' : '')}
          onClick={closePicker}
        >
          <button
            type="button"
            className="pick-circle"
            onClick={(e) => { e.stopPropagation(); pickTranslation(machineTranslate); }}
          >
            <span className="pick-icon"><GoogleMark size={30} /></span>
            <b>机器翻译</b>
            <span className="pick-sub">谷歌直译，速度更快</span>
          </button>
          <button
            type="button"
            className="pick-circle"
            onClick={(e) => { e.stopPropagation(); pickTranslation(translate); }}
          >
            <span className="pick-icon"><DeepSeekMark size={30} /></span>
            <b>大模型翻译</b>
            <span className="pick-sub">大模型精翻，效果更好</span>
          </button>
        </div>
      ) : null}

      <SettingsModal
        open={settingsOpen}
        initial={settings}
        appInfo={appInfo}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
        onTest={(form) => api.settings.test(form)}
        onChooseDir={chooseDir}
        proxyStatus={proxyStatus}
        onTestProxy={async (form) => {
          const r = await api.proxy.test({ host: form.proxyHost, port: form.proxyPort });
          toast(r.ok ? `代理可用（${r.latency}ms）` : `代理不可用：${r.error || ''}`, r.ok ? 'ok' : 'err');
        }}
      />

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.type}>
            <span className="toast-msg">{t.msg}</span>
            {t.action ? (
              <button className="link" onClick={() => { t.action.fn(); setToasts((x) => x.filter((i) => i.id !== t.id)); }}>
                {t.action.label}
              </button>
            ) : null}
            <button className="link" style={{ marginLeft: 'auto' }} onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}>
              <IconClose size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

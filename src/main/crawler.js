'use strict';

const anthropic = require('./adapters/anthropic');
const openai = require('./adapters/openai');
const deepmind = require('./adapters/deepmind');
const microsoft = require('./adapters/microsoft');
const unit42 = require('./adapters/unit42');
const hiddenlayer = require('./adapters/hiddenlayer');
const meta = require('./adapters/meta');
const invariant = require('./adapters/invariant');
const zenity = require('./adapters/zenity');
const matrix = require('./adapters/matrix');
const xbow = require('./adapters/xbow');
const projectzero = require('./adapters/projectzero');
const aisle = require('./adapters/aisle');
const zeropath = require('./adapters/zeropath');
const sybil = require('./adapters/sybil');
const simon = require('./adapters/simon');
const embrace = require('./adapters/embrace');
const carlini = require('./adapters/carlini');
const thacker = require('./adapters/thacker');
const { CrawlBrowser } = require('./browser');

const ADAPTERS = {
  anthropic,
  openai,
  deepmind,
  microsoft,
  unit42,
  hiddenlayer,
  meta,
  invariant,
  zenity,
  matrix,
  xbow,
  projectzero,
  aisle,
  zeropath,
  sybil,
  simon,
  embrace,
  carlini,
  thacker,
};

class Crawler {
  constructor(db) {
    this.db = db;
    this.runs = new Map();
  }

  adapterFor(site) {
    const a = ADAPTERS[site.adapter];
    if (!a) throw new Error(`没有适配器: ${site.adapter}`);
    return a;
  }

  isRunning(siteId) {
    return this.runs.has(siteId);
  }

  cancel(siteId) {
    const run = this.runs.get(siteId);
    if (!run) return false;
    run.cancelled = true;
    for (const b of run.browsers) b.close();
    return true;
  }

  /**
   * Full sync: discover -> upsert -> fetch pending articles.
   * @param {number} siteId
   * @param {(p:object)=>void} emit
   */
  async syncSite(siteId, emit) {
    if (this.runs.has(siteId)) throw new Error('该站点正在同步中');
    const site = this.db.getSite(siteId);
    if (!site) throw new Error('站点不存在');
    const adapter = this.adapterFor(site);
    const run = { cancelled: false, browsers: [] };
    this.runs.set(siteId, run);
    const progress = (p) => {
      if (run.cancelled) return;
      try {
        emit({ ...p, siteId, siteName: site.name });
      } catch { /* renderer gone */ }
    };

    let discoveryBrowser = null;
    try {
      progress({ phase: 'discover', message: '正在获取文章列表…' });
      if (adapter.discoveryBrowser) {
        discoveryBrowser = new CrawlBrowser(site.key);
        run.browsers.push(discoveryBrowser);
      }
      const discoveryCtx = { progress, browser: discoveryBrowser };
      const items = await adapter.discover(discoveryCtx);
      const discovered = this.db.upsertDiscovered(siteId, items);
      progress({ phase: 'discover', done: true, message: `索引到 ${discovered.length} 篇文章`, total: discovered.length });

      if (discoveryBrowser) {
        discoveryBrowser.close();
        run.browsers = run.browsers.filter((b) => b !== discoveryBrowser);
        discoveryBrowser = null;
      }

      const pending = this.db.pendingArticles(siteId, 2000);
      progress({ phase: 'fetch', done: 0, total: pending.length, message: pending.length ? '开始抓取正文…' : '所有文章已是最新' });

      if (pending.length) {
        let ok = 0;
        let failed = 0;
        const queue = pending.slice();
        const workers = [];
        const concurrency = Math.max(1, Math.min(adapter.concurrency || 3, queue.length));
        for (let w = 0; w < concurrency; w++) {
          const workerBrowser = adapter.usesBrowser ? new CrawlBrowser(site.key) : null;
          if (workerBrowser) run.browsers.push(workerBrowser);
          const workerCtx = { progress, browser: workerBrowser };
          workers.push(
            (async () => {
              try {
                while (queue.length && !run.cancelled) {
                  const item = queue.shift();
                  const started = Date.now();
                  try {
                    const art = await adapter.fetchArticle(workerCtx, item.url);
                    if (!art || !art.content_html || art.content_text.length < 80) {
                      throw new Error('未能提取到正文内容');
                    }
                    // The listing carries the authoritative publication date
                    // and title; several sites use a generic site-name <h1>.
                    if (item.published_at) art.published_at = item.published_at;
                    if (item.title) art.title = item.title;
                    this.db.saveContent(item.id, art);
                    ok++;
                    progress({
                      phase: 'fetch',
                      done: ok + failed,
                      total: pending.length,
                      title: art.title,
                      message: `已抓取：${art.title || item.url}`,
                      articleId: item.id,
                      ms: Date.now() - started,
                    });
                  } catch (e) {
                    failed++;
                    this.db.setFetchError(item.id, e.message);
                    progress({
                      phase: 'fetch',
                      done: ok + failed,
                      total: pending.length,
                      title: item.title || item.url,
                      message: `失败：${(item.title || item.url).slice(0, 60)} — ${e.message}`,
                      articleId: item.id,
                      error: true,
                    });
                  }
                }
              } finally {
                if (adapter.cleanup) {
                  try { adapter.cleanup(workerCtx); } catch { /* ignore */ }
                }
                if (workerBrowser) {
                  workerBrowser.close();
                  run.browsers = run.browsers.filter((b) => b !== workerBrowser);
                }
              }
            })()
          );
        }
        await Promise.all(workers);

        this.db.touchSite(siteId);
        progress({
          phase: 'done',
          done: ok + failed,
          total: pending.length,
          message: run.cancelled
            ? `已取消（成功 ${ok}，失败 ${failed}）`
            : `同步完成：成功 ${ok}，失败 ${failed}`,
          cancelled: run.cancelled,
        });
      } else {
        this.db.touchSite(siteId);
        progress({ phase: 'done', done: 0, total: 0, message: '同步完成（无新增）' });
      }
      return { ok: true };
    } catch (e) {
      progress({ phase: 'error', message: `同步失败：${e.message}` });
      throw e;
    } finally {
      for (const b of run.browsers) b.close();
      this.runs.delete(siteId);
    }
  }

  /** Refetch a single article (used by the UI "重新抓取" action). */
  async fetchOne(siteId, articleId) {
    const site = this.db.getSite(siteId);
    const adapter = this.adapterFor(site);
    const article = this.db.getArticle(articleId);
    if (!article) throw new Error('文章不存在');
    const ctx = { progress: () => {}, browser: null };
    try {
      const art = await adapter.fetchArticle(ctx, article.url);
      if (!art || !art.content_html) throw new Error('未能提取到正文');
      if (article.published_at) art.published_at = article.published_at;
      this.db.saveContent(articleId, art);
      return this.db.getArticle(articleId);
    } finally {
      if (adapter.cleanup) {
        try { adapter.cleanup(ctx); } catch { /* ignore */ }
      }
    }
  }
}

module.exports = { Crawler };

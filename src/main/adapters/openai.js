'use strict';

const { sleep } = require('../util');
const { extractArticle } = require('../extract');
const { CrawlBrowser } = require('../browser');
const { normalizeDate } = require('../util');

const INDEX_URL = 'https://openai.com/research/index/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const LIST_JS = `(() => {
  const out = [];
  const seen = new Set();
  const anchors = document.querySelectorAll('a[href*="/index/"]');
  for (const a of anchors) {
    let u;
    try { u = new URL(a.href, location.href); } catch (e) { continue; }
    if (!/^\\/index\\/[^/]+\\/?$/.test(u.pathname)) continue;
    if (u.pathname.startsWith('/research/')) continue;
    if (seen.has(u.pathname)) continue;
    seen.add(u.pathname);
    let card = a;
    for (let i = 0; i < 5 && card && card.querySelector; i++) {
      if (card.querySelector('time')) break;
      card = card.parentElement;
    }
    const timeEl = card ? card.querySelector('time') : null;
    const wrap = a.firstElementChild;
    let titleEl = wrap;
    let descEl = null;
    if (wrap) {
      descEl = wrap.querySelector('p');
      if (descEl && wrap.firstElementChild && wrap.firstElementChild !== descEl) titleEl = wrap.firstElementChild;
    }
    const label = a.getAttribute('aria-label') || '';
    const labelParts = label.split(' - ');
    let category = null;
    if (card) {
      const cat = timeEl && timeEl.previousElementSibling;
      if (cat && cat.innerText && cat.innerText.trim().length < 40) category = cat.innerText.trim();
    }
    if (labelParts.length >= 3) category = labelParts[1].trim();
    const labelDate = (label.match(/([A-Z][a-z]{2,8} \\d{1,2}, \\d{4})/) || [])[1] || null;
    const title = ((titleEl && titleEl.innerText) || labelParts[0] || '').replace(/\\s+/g, ' ').trim();
    out.push({
      url: u.origin + u.pathname,
      title,
      description: ((descEl && descEl.innerText) || '').replace(/\\s+/g, ' ').trim(),
      category,
      date: timeEl ? (timeEl.getAttribute('datetime') || timeEl.innerText.trim()) : labelDate,
    });
  }
  return out;
})()`;

const COUNT_JS = `document.querySelectorAll('a[href^="/index/"]').length`;

// A live BrowserWindow is required for session.fetch() to keep working in this
// Electron version (fetching with a closed/hidden session crashes the network
// service). So we keep one warm window with the index page for the whole run.
let warm = null;
let warmPending = null;

async function ensureWarm() {
  if (warm && warm.win && !warm.win.isDestroyed()) return warm;
  if (warmPending) return warmPending;
  warmPending = (async () => {
    const b = new CrawlBrowser('openai');
    await b.load(INDEX_URL, { waitAfter: 1200 });
    warm = b;
    return b;
  })()
    .catch((e) => {
      throw e;
    })
    .finally(() => {
      warmPending = null;
    });
  return warmPending;
}

function looksLikeArticle(html) {
  return !!html && html.includes('data-toc-content');
}

async function fetchViaSession(url) {
  const b = await ensureWarm();
  const res = await b.ses.fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(45000),
  });
  const html = await res.text();
  return { status: res.status, html };
}

module.exports = {
  key: 'openai',
  name: 'OpenAI Research',
  discoveryBrowser: false,
  usesBrowser: false,
  concurrency: 4,
  indexUrl: INDEX_URL,
  articleSelectors: ['[data-toc-content]', 'article'],

  async discover(ctx) {
    const b = await ensureWarm();
    ctx.progress({ phase: 'discover', message: '读取 OpenAI Research 索引…' });
    const map = new Map();
    let idleRounds = 0;
    for (let round = 0; round < 100; round++) {
      const items = await b.eval(LIST_JS).catch(() => []);
      let added = 0;
      for (const it of items) {
        if (!it.url || map.has(it.url)) continue;
        map.set(it.url, it);
        added++;
      }
      if (added) {
        ctx.progress({
          phase: 'discover',
          message: `已发现 ${map.size} 篇文章…`,
          total: map.size,
        });
      }
      idleRounds = added ? 0 : idleRounds + 1;
      if (idleRounds >= 2) break;

      const before = await b.eval(COUNT_JS).catch(() => 0);
      const clicked = await b
        .eval(`(() => {
          const btn = [...document.querySelectorAll('button')].find((x) => /^load more$/i.test((x.innerText || '').trim()));
          if (!btn) return false;
          btn.scrollIntoView({ block: 'center' });
          btn.click();
          return true;
        })()`)
        .catch(() => false);
      if (!clicked) {
        await b.eval('window.scrollTo(0, document.body.scrollHeight)').catch(() => {});
        await sleep(800);
        const again = await b
          .eval(`[...document.querySelectorAll('button')].some((x) => /^load more$/i.test((x.innerText || '').trim()))`)
          .catch(() => false);
        if (!again) break;
        continue;
      }
      for (let t = 0; t < 6; t++) {
        await sleep(320);
        const n = await b.eval(COUNT_JS).catch(() => before);
        if (n > before) break;
      }
    }
    const items = [...map.values()].map((it) => ({
      url: it.url,
      title: it.title || null,
      category: it.category || null,
      published_at: normalizeDate(it.date),
      excerpt: it.description ? it.description.slice(0, 400) : null,
    }));
    ctx.progress({ phase: 'discover', message: `索引完成：${items.length} 篇`, total: items.length });
    return items;
  },

  async fetchArticle(ctx, url) {
    let html = null;
    const candidates = [url];
    // Some English OpenAI URLs return a regional 500 while the same article
    // is available under a locale prefix. Try those before giving up.
    if (/^https:\/\/openai\.com\/index\//i.test(url)) {
      candidates.push(url.replace('https://openai.com/index/', 'https://openai.com/en-GB/index/'));
      candidates.push(url.replace('https://openai.com/index/', 'https://openai.com/en-US/index/'));
    }
    for (const candidate of candidates) {
      try {
        const r = await fetchViaSession(candidate);
        if (r.status === 200) {
          html = r.html;
          break;
        }
      } catch {
        /* try the next locale */
      }
    }

    let art = html ? extractArticle(html, url, { selectors: this.articleSelectors }) : null;
    if (!art || !art.content_html || art.content_text.length < 200) {
      // Never navigate the shared warm window (workers would abort each other);
      // use a dedicated window per worker instead.
      if (!ctx.fallbackBrowser) ctx.fallbackBrowser = new CrawlBrowser('openai', { showImages: true });
      const b = ctx.fallbackBrowser;
      await b.load(url, { waitAfter: 2000 });
      const full = await b.outerHTML();
      const a2 = extractArticle(full, url, { selectors: this.articleSelectors });
      if (!art || a2.content_text.length > (art.content_text || '').length) art = a2;
    }
    return art;
  },

  cleanup(ctx) {
    if (ctx.fallbackBrowser) {
      try { ctx.fallbackBrowser.close(); } catch { /* ignore */ }
      ctx.fallbackBrowser = null;
    }
  },

  cancel() {
    if (warm) {
      try { warm.close(); } catch { /* ignore */ }
      warm = null;
    }
  },
};

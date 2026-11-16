'use strict';

const { JSDOM } = require('jsdom');
const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { parseRss } = require('./rss');

const FEED = 'https://www.microsoft.com/en-us/security/blog/feed/';
const INDEX = 'https://www.microsoft.com/en-us/security/blog/';
const HEADERS = { 'Accept-Language': 'en-US,en;q=0.9' };

// TechCommunity blocks its inline image endpoint with HTTP 403 for non-browser
// clients. Those images would otherwise render as broken icons in Reader.
function stripBlockedImages(result) {
  if (!result?.content_html) return result;
  const dom = new JSDOM(`<body>${result.content_html}</body>`);
  const doc = dom.window.document;
  for (const img of doc.querySelectorAll('img')) {
    const src = img.getAttribute('src') || '';
    if (/techcommunity\.microsoft\.com\/t5\/s\/gxcuf89792\/images\//i.test(src)) img.remove();
  }
  result.content_html = doc.body.innerHTML;
  return result;
}

function discoverFromHtml(html) {
  const doc = new JSDOM(html).window.document;
  const out = [];
  const seen = new Set();
  for (const a of doc.querySelectorAll('a[href*="/security/blog/"]')) {
    const href = a.getAttribute('href') || '';
    let url;
    try { url = new URL(href, INDEX).href; } catch { continue; }
    const m = url.match(/\/security\/blog\/(\d{4})\/(\d{2})\/(\d{2})\/([^/?#]+)\/?$/);
    if (!m) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const title = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!title) continue;
    out.push({
      url,
      title,
      published_at: new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`).toISOString(),
      excerpt: null,
    });
  }
  return out;
}

module.exports = {
  key: 'microsoft',
  name: 'Microsoft',
  usesBrowser: true,
  concurrency: 4,
  articleSelectors: ['article', 'main'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 Microsoft Security 文章源…' });
    try {
      const xml = await fetchText(FEED, {
        headers: { Accept: 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8', ...HEADERS },
      });
      const items = parseRss(xml);
      if (items.length) return items;
    } catch { /* fall through to HTML */ }
    const html = await fetchText(INDEX, { headers: HEADERS });
    return discoverFromHtml(html);
  },

  async fetchArticle(ctx, url) {
    try {
      const html = await fetchText(url, { headers: HEADERS });
      return stripBlockedImages(extractArticle(html, url, { selectors: this.articleSelectors }));
    } catch (e) {
      // Some feed entries redirect to techcommunity.microsoft.com behind an Azure
      // WAF JS challenge; let the embedded Chromium solve it and return the DOM.
      if (!ctx.browser) throw e;
      try {
        await ctx.browser.load(url, { waitAfter: 2500 });
        const html = await ctx.browser.outerHTML();
        return stripBlockedImages(extractArticle(html, url, { selectors: this.articleSelectors }));
      } catch {
        throw e;
      }
    }
  },
};

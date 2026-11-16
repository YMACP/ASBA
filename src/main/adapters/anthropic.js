'use strict';

const { fetchText } = require('../net');
const { extractArticle } = require('../extract');

const SITEMAP = 'https://www.anthropic.com/sitemap.xml';
const RESERVED = new Set(['https://www.anthropic.com/research', 'https://www.anthropic.com/research/']);

module.exports = {
  key: 'anthropic',
  name: 'Anthropic Research',
  usesBrowser: false,
  concurrency: 4,
  articleSelectors: ['[data-article-body]', 'article'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 sitemap.xml…' });
    const xml = await fetchText(SITEMAP);
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    const items = [];
    const seen = new Set();
    for (const u of urls) {
      let p;
      try {
        p = new URL(u);
      } catch {
        continue;
      }
      if (p.hostname !== 'www.anthropic.com') continue;
      if (!p.pathname.startsWith('/research/')) continue;
      if (p.pathname.startsWith('/research/team/')) continue;
      if (p.pathname === '/research' || p.pathname === '/research/') continue;
      const clean = p.origin + p.pathname.replace(/\/$/, '');
      if (seen.has(clean)) continue;
      seen.add(clean);
      items.push({ url: clean, title: null });
    }
    // newest first is unknown here; the crawler orders by published date after fetch
    return items;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

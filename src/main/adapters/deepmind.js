'use strict';

const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { normalizeDate } = require('../util');
const { decodeXml } = require('./rss');

const BASE = 'https://deepmind.google/research/publications/';
const MAX_PAGES = 12;

function parsePage(html) {
  const items = [];
  const re = /<a[^>]+href=["']?(https:\/\/deepmind\.google\/research\/publications\/\d+\/?)["']?[^>]*>[\s\S]*?<span\s+class=["']?list-group__date["']?[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span\s+class=["']?list-group__description["']?[^>]*>([\s\S]*?)<\/span>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1].replace(/\/?$/, '/');
    const date = decodeXml(m[2]).replace(/\s+/g, ' ').trim();
    const title = decodeXml(m[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!title) continue;
    items.push({ url, title, published_at: normalizeDate(date), excerpt: null });
  }
  return items;
}

module.exports = {
  key: 'deepmind',
  name: 'Google',
  usesBrowser: false,
  concurrency: 4,
  articleSelectors: ['main', 'article'],

  async discover(ctx) {
    const seen = new Set();
    const out = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? BASE : `${BASE}page/${page}/`;
      ctx.progress({ phase: 'discover', message: `读取 DeepMind 出版物第 ${page} 页…` });
      let html;
      try {
        html = await fetchText(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
      } catch (e) {
        if (page === 1) throw e;
        break;
      }
      const items = parsePage(html);
      let added = 0;
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        out.push(item);
        added++;
      }
      if (!added) break;
      if (ctx.progress) ctx.progress({ phase: 'discover', message: `已发现 ${out.length} 篇 DeepMind 出版物…`, total: out.length });
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

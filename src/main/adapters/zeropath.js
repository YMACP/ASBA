'use strict';

const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { parseRss } = require('./rss');

const FEED = 'https://zeropath.com/blog/rss.xml';
const MAX_POSTS = 60;

module.exports = {
  key: 'zeropath',
  name: 'ZeroPath',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.prose', 'article', 'main'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 ZeroPath 博客源…' });
    const xml = await fetchText(FEED);
    const seen = new Set();
    const out = [];
    for (const item of parseRss(xml)) {
      if (!/\/blog\//.test(item.url)) continue;
      let url;
      try { url = new URL(item.url); } catch { continue; }
      url.search = '';
      url.hash = '';
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      out.push({ ...item, url: url.href });
      if (out.length >= MAX_POSTS) break;
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

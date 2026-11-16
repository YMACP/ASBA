'use strict';

const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { parseRss } = require('./rss');

const FEED = 'https://unit42.paloaltonetworks.com/category/threat-research/feed/';
const MAX_PAGES = 4;

module.exports = {
  key: 'unit42',
  name: 'Unit 42',
  usesBrowser: false,
  concurrency: 2,
  articleSelectors: ['.be__contents-wrapper', '.be__contents', 'main'],

  async discover(ctx) {
    const seen = new Set();
    const out = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? FEED : `${FEED}?paged=${page}`;
      ctx.progress({ phase: 'discover', message: `读取 Unit 42 威胁研究第 ${page} 页…` });
      let xml;
      try {
        xml = await fetchText(url, { headers: { Accept: 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8' } });
      } catch (e) {
        if (page === 1) throw e;
        break;
      }
      const items = parseRss(xml);
      let added = 0;
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        out.push(item);
        added++;
      }
      if (!added) break;
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

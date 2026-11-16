'use strict';

const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { parseRss } = require('./rss');

const FEED = 'https://xbow.com/blog/feed.xml';

module.exports = {
  key: 'xbow',
  name: 'XBOW',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.prose', 'article', 'main'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 XBOW 博客源…' });
    const xml = await fetchText(FEED, { headers: { Accept: 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8' } });
    return parseRss(xml);
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

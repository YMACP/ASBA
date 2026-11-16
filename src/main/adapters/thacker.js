'use strict';

const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { parseRss } = require('./rss');

const FEED = 'https://josephthacker.com/feed.xml';

module.exports = {
  key: 'thacker',
  name: 'Joseph Thacker',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.post-body', '.content', 'main'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 Joseph Thacker 博客源…' });
    const xml = await fetchText(FEED, { headers: { Accept: 'application/atom+xml,application/xml;q=0.9,*/*;q=0.8' } });
    return parseRss(xml);
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

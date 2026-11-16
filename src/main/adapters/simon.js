'use strict';

const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { parseRss } = require('./rss');

const FEED = 'https://simonwillison.net/atom/everything/';

module.exports = {
  key: 'simon',
  name: 'Simon Willison',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.entry-content', '.beat-content', '.entry'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 Simon Willison 博客源…' });
    const xml = await fetchText(FEED, { headers: { Accept: 'application/atom+xml,application/xml;q=0.9,*/*;q=0.8' } });
    return parseRss(xml);
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

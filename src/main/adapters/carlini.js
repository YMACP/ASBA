'use strict';

const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { parseRss } = require('./rss');

const FEED = 'https://nicholas.carlini.com/writing/feed.xml';

module.exports = {
  key: 'carlini',
  name: 'Nicholas Carlini',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.inner', '.boxed'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 Nicholas Carlini 博客源…' });
    const xml = await fetchText(FEED);
    return parseRss(xml);
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

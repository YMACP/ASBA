'use strict';

const { JSDOM } = require('jsdom');
const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { parseRss } = require('./rss');

const FEED = 'https://embracethered.com/blog/index.xml';

function repairImages(result) {
  if (!result?.content_html) return result;
  const dom = new JSDOM(`<body>${result.content_html}</body>`);
  const doc = dom.window.document;
  for (const img of [...doc.querySelectorAll('img')]) {
    const src = img.getAttribute('src') || '';
    // Wikimedia no longer serves this particular 260px SVG thumb (400).
    const wiki = src.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/([^/]+\/[^/]+\/[^/]+)\/\d+px-[^/]+$/i);
    if (wiki) img.setAttribute('src', `https://upload.wikimedia.org/wikipedia/commons/${wiki[1]}`);
    // The PenTest Magazine cover was removed upstream.
    if (/^https:\/\/pentestmag\.com\/wp-content\/uploads\/2020\/06\/PT3\.jpg/i.test(src)) img.remove();
  }
  result.content_html = doc.body.innerHTML;
  return result;
}

module.exports = {
  key: 'embrace',
  name: 'Embrace The Red',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['article > section', 'article', 'main'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 Embrace The Red 博客源…' });
    const xml = await fetchText(FEED);
    return parseRss(xml).filter((item) => /\/blog\/posts\//.test(item.url));
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return repairImages(extractArticle(html, url, { selectors: this.articleSelectors }));
  },
};

'use strict';

const { JSDOM } = require('jsdom');
const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { normalizeDate } = require('../util');

const INDEX = 'https://www.runsybil.com/blog';
const MAX_PAGES = 6;

module.exports = {
  key: 'sybil',
  name: 'RunSybil',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.fs-toc_richtext', '.section_content-blog', 'main'],

  async discover(ctx) {
    const seen = new Set();
    const out = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? INDEX : `${INDEX}?e3bb924e_page=${page}`;
      ctx.progress({ phase: 'discover', message: `读取 RunSybil 第 ${page} 页…` });
      const html = await fetchText(url);
      const doc = new JSDOM(html).window.document;
      let added = 0;
      for (const a of doc.querySelectorAll('a[href^="/blog/"]')) {
        const href = a.getAttribute('href') || '';
        if (!/^\/blog\/[^/?#]+$/.test(href)) continue;
        const full = new URL(href, INDEX).href;
        if (seen.has(full)) continue;
        const title = a.querySelector('h3')?.textContent.replace(/\s+/g, ' ').trim();
        if (!title) continue;
        seen.add(full);
        const dateText = [...a.querySelectorAll('div')]
          .map((el) => el.textContent.trim())
          .find((t) => /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(t)) || '';
        out.push({ url: full, title, excerpt: null, published_at: normalizeDate(dateText) });
        added++;
      }
      if (!added) break;
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

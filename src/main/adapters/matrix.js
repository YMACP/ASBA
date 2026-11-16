'use strict';

const { JSDOM } = require('jsdom');
const { fetchText } = require('../net');
const { extractArticle } = require('../extract');

const INDEX = 'https://matrix.tencent.com/zh/articles';
const MAX_PAGES = 5;

// Matrix's CMS emits a tracking/pixel <img> pointing at the Tencent Security
// homepage between each real figure. Browsers cannot decode that HTML as an
// image, so Reader shows a broken-image icon for every occurrence.
function stripPlaceholders(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const img of doc.querySelectorAll('img')) {
    const src = (img.getAttribute('src') || '').trim();
    if (!src || /^https?:\/\/security\.tencent\.com\/?$/i.test(src)) img.remove();
  }
  return dom.serialize();
}

function parseZhDate(text) {
  const m = String(text || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = {
  key: 'matrix',
  name: '腾讯朱雀实验室',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.prose-editorial', 'article'],

  async discover(ctx) {
    const seen = new Set();
    const out = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? INDEX : `${INDEX}?page=${page}`;
      ctx.progress({ phase: 'discover', message: `读取腾讯朱雀实验室第 ${page} 页…` });
      let html;
      try {
        html = await fetchText(url);
      } catch (e) {
        if (page === 1) throw e;
        break;
      }
      const doc = new JSDOM(html).window.document;
      let added = 0;
      for (const article of doc.querySelectorAll('article.group')) {
        const link = article.querySelector('h2 a[href^="/zh/"], a[href^="/zh/20"]');
        if (!link) continue;
        const href = link.getAttribute('href');
        if (!/^\/zh\/\d{4}\/\d{2}\/\d{2}\//.test(href)) continue;
        const full = new URL(href, INDEX).href;
        if (seen.has(full)) continue;
        seen.add(full);
        const title = (article.querySelector('h2')?.textContent || link.textContent || '').replace(/\s+/g, ' ').trim();
        const dateText = [...article.querySelectorAll('span')]
          .map((s) => s.textContent)
          .find((t) => /\d{4}年\d{1,2}月\d{1,2}日/.test(t)) || '';
        const excerpt = article.querySelector('p')?.textContent.replace(/\s+/g, ' ').trim() || null;
        if (!title) continue;
        out.push({ url: full, title, excerpt, published_at: parseZhDate(dateText) });
        added++;
      }
      if (!added) break;
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(stripPlaceholders(html), url, { selectors: this.articleSelectors });
  },
};

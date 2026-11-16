'use strict';

const { JSDOM } = require('jsdom');
const { fetchText } = require('../net');
const { extractArticle } = require('../extract');

const INDEX = 'https://projectzero.google/';
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function parsePzDate(text) {
  const m = String(text || '').trim().match(/^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/);
  if (!m || MONTHS[m[2]] === undefined) return null;
  const d = new Date(Date.UTC(Number(m[1]), MONTHS[m[2]], Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

module.exports = {
  key: 'projectzero',
  name: 'Project Zero',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.post-content', 'article'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 Google Project Zero…' });
    const html = await fetchText(INDEX, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    const doc = new JSDOM(html).window.document;
    const seen = new Set();
    const out = [];
    for (const article of doc.querySelectorAll('article')) {
      const a = article.querySelector('.post-title a');
      if (!a) continue;
      const href = a.getAttribute('href') || '';
      if (!/^\/\d{4}\/\d{2}\/[^/]+\.html$/.test(href)) continue;
      const url = new URL(href, INDEX).href;
      if (seen.has(url)) continue;
      seen.add(url);
      const title = a.textContent.replace(/\s+/g, ' ').trim();
      const date = article.querySelector('.post-date')?.textContent || '';
      const author = article.querySelector('.post-author')?.textContent.replace(/\s+/g, ' ').trim() || null;
      const excerpt = article.querySelector('.post-content-snippet')?.textContent.replace(/\s+/g, ' ').trim() || null;
      out.push({ url, title, author, excerpt, published_at: parsePzDate(date) });
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    return extractArticle(html, url, { selectors: this.articleSelectors });
  },
};

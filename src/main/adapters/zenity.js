'use strict';

const { JSDOM } = require('jsdom');
const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { normalizeDate } = require('../util');

const INDEX = 'https://zenity.io/blog';

// The Zenity article body starts with an embedded "Ask AI" widget and ends
// with an "All Articles" button. Keep the editorial Key Takeaways block but
// drop the interactive chrome.
function stripChrome(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const el of doc.querySelectorAll('.prose > .not-prose')) {
    if (/Ask AI/i.test(el.textContent || '')) el.remove();
  }
  for (const a of doc.querySelectorAll('.prose a.button')) {
    if (/All Articles/i.test(a.textContent || '')) a.remove();
  }
  return dom.serialize();
}

module.exports = {
  key: 'zenity',
  name: 'Zenity',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.prose', 'main'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 Zenity 博客…' });
    const html = await fetchText(INDEX);
    const doc = new JSDOM(html).window.document;
    const seen = new Set();
    const out = [];
    for (const a of doc.querySelectorAll('a[href^="/blog/"]')) {
      const href = a.getAttribute('href') || '';
      if (!/^\/blog\/[^/?#]+$/.test(href)) continue;
      const url = new URL(href, INDEX).href;
      if (seen.has(url)) continue;
      seen.add(url);
      const title = a.querySelector('h2, h3')?.textContent.replace(/\s+/g, ' ').trim();
      if (!title) continue;
      const time = a.querySelector('time[datetime]') || a.closest('div')?.querySelector('time[datetime]');
      out.push({
        url,
        title,
        excerpt: null,
        published_at: time ? normalizeDate(time.getAttribute('datetime')) : null,
      });
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(stripChrome(html), url, { selectors: this.articleSelectors });
  },
};

'use strict';

const { JSDOM } = require('jsdom');
const { fetchText } = require('../net');
const { extractArticle } = require('../extract');

const INDEX = 'https://www.hiddenlayer.com/innovation-hub/research';
const ORIGIN = 'https://www.hiddenlayer.com';

// The article page appends Webflow chrome that is not article content: the
// social-share row, a "related research" card grid (with gray image.svg
// placeholders), and the newsletter CTA banner. Readability otherwise keeps
// them, producing broken placeholders and an unstyled CTA image at the bottom.
function stripChrome(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const el of doc.querySelectorAll('.toc_bottom, .share-link')) el.remove();
  for (const el of doc.querySelectorAll('.cms-list-research')) {
    const section = el.closest('section');
    (section || el.closest('.w-dyn-list') || el).remove();
  }
  for (const el of doc.querySelectorAll('.cta-3')) {
    const section = el.closest('section');
    (section || el).remove();
  }
  return dom.serialize();
}

module.exports = {
  key: 'hiddenlayer',
  name: 'HiddenLayer',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['article', 'main'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 HiddenLayer 研究列表…' });
    const html = await fetchText(INDEX);
    const doc = new JSDOM(html).window.document;
    const seen = new Set();
    const out = [];
    for (const a of doc.querySelectorAll('a[href^="/research/"]')) {
      const href = a.getAttribute('href') || '';
      if (!/^\/research\/[^/?#]+$/.test(href)) continue;
      const url = ORIGIN + href;
      if (seen.has(url)) continue;
      seen.add(url);
      const card = a.closest('.w-dyn-item') || a.closest('[role="listitem"]') || a.parentElement;
      const titleEl = card && card.querySelector('[fs-list-field="title"]');
      const summaryEl = card && card.querySelector('[fs-list-field="summary"]');
      const title = (titleEl ? titleEl.textContent : a.textContent || '').replace(/\s+/g, ' ').trim();
      const summary = summaryEl ? summaryEl.textContent.replace(/\s+/g, ' ').trim() : '';
      if (!title) continue;
      out.push({ url, title, excerpt: summary || null, published_at: null });
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(stripChrome(html), url, { selectors: this.articleSelectors });
  },
};

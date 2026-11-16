'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { fetchText } = require('../net');
const { extractArticle } = require('../extract');
const { normalizeDate } = require('../util');

const INDEX = 'https://invariantlabs.ai/blog';
const BROKEN_DATAFLOW = 'https://invariantlabs-ai.github.io/docs/assets/guardrails/dataflow.svg';
const DATAFLOW_URI = 'data:image/svg+xml;base64,' + fs
  .readFileSync(path.join(__dirname, '..', 'assets', 'invariant-dataflow.svg'))
  .toString('base64');

// The Guardrails article links to a dataflow.svg that has been removed from
// the published docs site (404). The original diagram is recoverable from the
// docs repository history, embedded here so the article stays self-contained.
// The same article also ships its author list as escaped <br/> text; decode
// those entities before Readability so they render as real line breaks.
function repairHtml(html) {
  return html.split(BROKEN_DATAFLOW).join(DATAFLOW_URI);
}

module.exports = {
  key: 'invariant',
  name: 'Invariantlabs',
  usesBrowser: false,
  concurrency: 3,
  articleSelectors: ['.entry-content', 'article.full', 'article'],

  async discover(ctx) {
    ctx.progress({ phase: 'discover', message: '读取 Invariant Labs 博客…' });
    const html = await fetchText(INDEX);
    const doc = new JSDOM(html).window.document;
    const seen = new Set();
    const out = [];
    for (const a of doc.querySelectorAll('a[rel="bookmark"]')) {
      let url;
      try { url = new URL(a.getAttribute('href'), INDEX); } catch { continue; }
      if (url.hostname !== 'invariantlabs.ai' || !url.pathname.startsWith('/blog/')) continue;
      const href = url.href;
      if (seen.has(href)) continue;
      seen.add(href);
      const card = a.querySelector('article.preview') || a.parentElement;
      const title = (card.querySelector('h3.entry-title') || a).textContent.replace(/\s+/g, ' ').trim();
      const dateText = card.querySelector('h4.date')?.textContent || '';
      const excerpt = card.querySelector('.entry-content')?.textContent.replace(/\s+/g, ' ').trim() || null;
      if (!title) continue;
      out.push({ url: href, title, excerpt, published_at: normalizeDate(dateText) });
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url);
    return extractArticle(repairHtml(html), url, { selectors: this.articleSelectors });
  },
};

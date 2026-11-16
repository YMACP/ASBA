'use strict';

const { JSDOM } = require('jsdom');
const { nativeImage } = require('electron');
const { fetchText, fetchUrl, UA } = require('../net');
const { extractArticle } = require('../extract');
const { normalizeDate } = require('../util');

const ORG = 'facebookresearch';
const BASE = `https://github.com/orgs/${ORG}/repositories`;
const MAX_PAGES = 3;

// GitHub README images can be served through short-lived signed
// private-user-images URLs (JWT expires after a few minutes). Inline those
// bytes when the article is fetched so the cached article and seed.db keep
// working long after the signature has expired.
async function inlineExpiringImages(content) {
  if (!content) return content;
  const dom = new JSDOM(`<body>${content}</body>`);
  const doc = dom.window.document;
  const cache = new Map();
  for (const img of [...doc.querySelectorAll('img')]) {
    const src = img.getAttribute('src') || '';
    // camo caches a readthedocs badge that currently returns 502; the badge is
    // decorative and has no useful alt text.
    if (/^https:\/\/camo\.githubusercontent\.com\/0a135b74/i.test(src)) {
      img.remove();
      continue;
    }
    if (!/^https:\/\/private-user-images\.githubusercontent\.com\//i.test(src)) continue;
    let data = cache.get(src);
    if (data === undefined) {
      try {
        const res = await fetchUrl(src, {
          headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8' },
          redirect: 'follow',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = (res.headers.get('content-type') || '').split(';')[0].toLowerCase();
        if (!/^image\//.test(type)) throw new Error('not an image');
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 400 * 1024) {
          // README screenshots/GIFs can be tens of MB. Re-encode large images
          // as bounded JPEGs so the article and seed.db stay manageable.
          const image = nativeImage.createFromBuffer(buf);
          if (image.isEmpty()) throw new Error('cannot decode image');
          const size = image.getSize();
          const resized = size.width > 1200 ? image.resize({ width: 1200, quality: 'good' }) : image;
          const jpeg = resized.toJPEG(72);
          if (!jpeg.length) throw new Error('cannot encode image');
          data = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
        } else {
          data = `data:${type};base64,${buf.toString('base64')}`;
        }
      } catch {
        data = null;
      }
      cache.set(src, data);
    }
    if (data) img.setAttribute('src', data);
    else img.remove();
  }
  return doc.body.innerHTML;
}

function parsePage(html) {
  const doc = new JSDOM(html).window.document;
  const items = [];
  const seen = new Set();
  for (const a of doc.querySelectorAll(`a[href^="/${ORG}/"]`)) {
    const href = a.getAttribute('href') || '';
    if (!new RegExp(`^/${ORG}/[^/]+$`).test(href)) continue;
    const repo = href.split('/')[2];
    if (!repo || seen.has(repo)) continue;
    seen.add(repo);
    const li = a.closest('li');
    const descEl = li && li.querySelector('.repos-list-description, [class*="FormattedDescription"]');
    const timeEl = li && li.querySelector('relative-time, time');
    const dateText = timeEl ? timeEl.getAttribute('datetime') || timeEl.textContent : null;
    items.push({
      url: `https://github.com${href}`,
      title: (a.textContent || repo).replace(/\s+/g, ' ').trim(),
      excerpt: descEl ? descEl.textContent.replace(/\s+/g, ' ').trim() : null,
      published_at: normalizeDate(dateText),
    });
  }
  return items;
}

module.exports = {
  key: 'meta',
  name: 'Meta Research',
  usesBrowser: false,
  concurrency: 2,
  articleSelectors: ['article.markdown-body', 'article'],

  async discover(ctx) {
    const seen = new Set();
    const out = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = page === 1 ? BASE : `${BASE}?page=${page}`;
      ctx.progress({ phase: 'discover', message: `读取 Meta Research 仓库第 ${page} 页…` });
      let html;
      try {
        html = await fetchText(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
      } catch (e) {
        if (page === 1) throw e;
        break;
      }
      const items = parsePage(html);
      let added = 0;
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        out.push(item);
        added++;
      }
      if (!added) break;
    }
    return out;
  },

  async fetchArticle(ctx, url) {
    const html = await fetchText(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    const result = extractArticle(html, url, { selectors: this.articleSelectors });
    result.content_html = await inlineExpiringImages(result.content_html);
    return result;
  },
};

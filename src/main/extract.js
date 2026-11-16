'use strict';

const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { detectLang, htmlToText, normalizeDate } = require('./util');

const ALLOWED = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'figure', 'figcaption', 'img', 'a', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
  'sup', 'sub', 'br', 'hr', 'span', 'mark', 'small', 'picture', 'source', 'div',
]);

const DROP = new Set([
  'script', 'style', 'iframe', 'form', 'button', 'input', 'select', 'textarea', 'svg', 'canvas',
  'noscript', 'video', 'audio', 'link', 'meta', 'nav', 'footer',
]);

function parseJsonLd(doc) {
  const out = [];
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const txt = s.textContent || '';
    if (!txt.trim()) continue;
    try {
      const data = JSON.parse(txt);
      const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const type = String(it['@type'] || '');
        if (/Article|BlogPosting|NewsArticle|WebPage/i.test(type) || it.headline) out.push(it);
      }
    } catch { /* ignore malformed */ }
  }
  return out;
}

function cleanAuthor(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '');
}

function pickMeta(doc, names) {
  for (const n of names) {
    const el =
      doc.querySelector(`meta[property="${n}"]`) ||
      doc.querySelector(`meta[name="${n}"]`) ||
      doc.querySelector(`meta[itemprop="${n}"]`);
    if (el && el.getAttribute('content')) return el.getAttribute('content');
  }
  return null;
}

function absolutize(doc, baseUrl) {
  const abs = (v) => {
    if (!v) return v;
    try {
      return new URL(v, baseUrl).href;
    } catch {
      return v;
    }
  };
  const imageUrl = (v) => {
    if (!v || !v.trim()) return null;
    try {
      const url = new URL(v.trim(), baseUrl);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  };
  // srcset entries can use either width or density descriptors. Choose the
  // largest available candidate; the reader can request a smaller CDN version.
  const fromSrcset = (value) => {
    if (!value || /^\s*data:/i.test(value)) return null;
    let best = null;
    for (const part of value.split(',')) {
      const fields = part.trim().split(/\s+/);
      const url = imageUrl(fields[0]);
      if (!url) continue;
      const descriptor = fields[1] || '';
      const score = /^\d+w$/.test(descriptor) ? parseInt(descriptor, 10)
        : /^\d+(?:\.\d+)?x$/.test(descriptor) ? parseFloat(descriptor) * 1000 : 0;
      if (!best || score > best.score) best = { url, score };
    }
    return best?.url || null;
  };
  for (const a of doc.querySelectorAll('a[href]')) a.setAttribute('href', abs(a.getAttribute('href')));
  for (const img of doc.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    const lazy = ['data-src', 'data-original', 'data-lazy-src', 'data-original-src']
      .map((key) => imageUrl(img.getAttribute(key))).find(Boolean);
    const lazySrcset = fromSrcset(img.getAttribute('data-srcset'));
    const srcset = fromSrcset(img.getAttribute('srcset'));
    const picture = img.closest('picture');
    const pictureSrc = picture && [...picture.querySelectorAll('source')]
      .map((source) => fromSrcset(source.getAttribute('data-srcset')) || fromSrcset(source.getAttribute('srcset'))
        || imageUrl(source.getAttribute('src'))).find(Boolean);
    // Responsive and lazy sources are the images the original page actually
    // displays; src is often only a tiny or transparent placeholder.
    const selected = lazy || lazySrcset || srcset || pictureSrc || imageUrl(src) || (src && /^data:image\//i.test(src) ? src : null);
    if (selected) img.setAttribute('src', selected);
    else img.removeAttribute('src');
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.removeAttribute('loading');
    img.setAttribute('loading', 'eager');
  }
  for (const source of doc.querySelectorAll('source')) source.remove();
}

function cleanNode(doc, root) {
  // Remove unwanted subtrees
  root.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) {
      el.remove();
      return;
    }
    if (el.getAttribute('aria-hidden') === 'true') {
      el.remove();
      return;
    }
    if (tag === 'aside') {
      el.remove();
      return;
    }
  });

  // Unwrap unsupported elements but keep their text
  const all = [...root.querySelectorAll('*')];
  for (const el of all) {
    if (el.parentNode == null) continue;
    const tag = el.tagName.toLowerCase();
    if (ALLOWED.has(tag)) continue;
    const frag = doc.createDocumentFragment();
    while (el.firstChild) frag.appendChild(el.firstChild);
    el.replaceWith(frag);
  }

  // Drop attributes except a small whitelist
  for (const el of root.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    const keep = new Set();
    if (tag === 'a') { keep.add('href'); keep.add('title'); }
    if (tag === 'img') { keep.add('src'); keep.add('alt'); keep.add('width'); keep.add('height'); }
    if (tag === 'td' || tag === 'th') { keep.add('colspan'); keep.add('rowspan'); }
    if (tag === 'ol') { keep.add('start'); }
    if (tag === 'code' || tag === 'pre') { keep.add('class'); }
    for (const attr of [...el.attributes]) {
      if (!keep.has(attr.name)) el.removeAttribute(attr.name);
    }
    if (tag === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    if (tag === 'div') {
      // divs are allowed only as generic wrappers; keep them for structure
    }
  }

  // Remove empty paragraphs / headings
  for (const el of [...root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')]) {
    if (!el.textContent.trim() && !el.querySelector('img')) el.remove();
  }
}

function containerContent(doc, selector, baseUrl) {
  const el = doc.querySelector(selector);
  if (!el) return null;
  const clone = el.cloneNode(true);
  const holder = doc.createElement('div');
  holder.appendChild(clone);
  // Normalize lazy and responsive image URLs while their original attributes
  // and <picture><source> elements are still present.
  absolutize(holder, baseUrl);
  cleanNode(doc, holder);
  const html = holder.innerHTML.trim();
  if (!html) return null;
  return html;
}

/**
 * Extract a readable article from a full HTML document.
 * @param {string} html
 * @param {string} url
 * @param {{selectors?: string[]}} opts
 */
function extractArticle(html, url, opts = {}) {
  const dom = new JSDOM(html, { url, contentType: 'text/html' });
  const { document } = dom.window;
  const ld = parseJsonLd(document)[0] || {};

  const heading =
    document.querySelector('h1')?.textContent?.trim() ||
    ld.headline ||
    pickMeta(document, ['og:title', 'twitter:title']) ||
    document.title;

  let contentHtml = null;
  let usedSelector = null;
  for (const sel of opts.selectors || []) {
    contentHtml = containerContent(document, sel, url);
    if (contentHtml && htmlToText(contentHtml).length > 300) {
      usedSelector = sel;
      break;
    }
    contentHtml = null;
  }

  let text = contentHtml ? htmlToText(contentHtml) : '';
  if (!contentHtml || text.length < 300) {
    try {
      // Resolve lazy and responsive sources before Readability can remove
      // their attributes or <picture> elements. Leave the original document
      // intact for the metadata extraction below.
      const readableDoc = document.cloneNode(true);
      absolutize(readableDoc, url);
      const art = new Readability(readableDoc, { charThreshold: 200 }).parse();
      if (art && art.content) {
        const tmp = new JSDOM(`<body>${art.content}</body>`, { url });
        const holder = tmp.window.document.body;
        absolutize(holder, url);
        cleanNode(tmp.window.document, holder);
        contentHtml = holder.innerHTML;
        text = htmlToText(contentHtml);
        usedSelector = usedSelector || 'readability';
      }
    } catch { /* ignore */ }
  }

  const published =
    normalizeDate(ld.datePublished) ||
    normalizeDate(pickMeta(document, ['article:published_time', 'datePublished', 'date'])) ||
    normalizeDate(document.querySelector('time[datetime]')?.getAttribute('datetime'));

  const authorRaw =
    (typeof ld.author === 'string' ? ld.author : ld.author?.name) ||
    pickMeta(document, ['author', 'article:author']) ||
    document.querySelector('[rel="author"]')?.textContent?.trim() ||
    null;
  const author = authorRaw ? cleanAuthor(authorRaw) : null;

  const excerpt =
    ld.description ||
    pickMeta(document, ['og:description', 'description', 'twitter:description']) ||
    '';

  const cover =
    (Array.isArray(ld.image) ? ld.image[0] : ld.image) ||
    pickMeta(document, ['og:image', 'twitter:image']) ||
    document.querySelector('article img')?.getAttribute('src') ||
    null;

  const textContent = text || '';
  return {
    title: String(heading || '').replace(/\s+/g, ' ').trim(),
    author: author ? String(author).trim() : null,
    published_at: published,
    excerpt: String(excerpt || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    cover_url: cover ? new URL(cover, url).href : null,
    content_html: contentHtml,
    content_text: textContent,
    word_count: textContent ? textContent.split(/\s+/).filter(Boolean).length : 0,
    lang: detectLang(textContent),
    used_selector: usedSelector,
  };
}

module.exports = { extractArticle };

'use strict';

const { normalizeDate } = require('../util');

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, num) => {
      try { return String.fromCodePoint(Number(num)); } catch { return ''; }
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripTags(value) {
  return decodeXml(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseRss(xml) {
  const items = [];
  const push = (item) => {
    if (item && item.url && !items.some((x) => x.url === item.url)) items.push(item);
  };
  const blocks = String(xml || '').match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const pick = (tag) => {
      const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeXml(m[1]) : '';
    };
    const title = pick('title').replace(/\s+/g, ' ').trim();
    const link = pick('link') || pick('guid');
    if (!title || !link) continue;
    const rawDesc = pick('description');
    const excerpt = stripTags(rawDesc).slice(0, 280);
    const date = normalizeDate(pick('pubDate') || pick('updated') || pick('published'));
    push({
      url: link.trim(),
      title,
      published_at: date,
      author: pick('dc:creator') || pick('author') || null,
      excerpt: excerpt || null,
    });
  }

  // Atom feeds (Simon Willison, Joseph Thacker, etc.) use <entry> and an
  // href-based <link>. Keep both formats so callers can share the adapter.
  const entries = String(xml || '').match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const block of entries) {
    const pick = (tag) => {
      const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeXml(m[1]) : '';
    };
    const title = pick('title').replace(/\s+/g, ' ').trim();
    let link = '';
    const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
    const alternate = links.find((attrs) => /rel=["']alternate["']/i.test(attrs)) || links[0] || '';
    const href = alternate.match(/href=["']([^"']+)["']/i);
    if (href) link = decodeXml(href[1]);
    if (!link) link = pick('id');
    if (!title || !link) continue;
    const body = pick('content') || pick('summary');
    const author = pick('author') || pick('name');
    push({
      url: link.trim(),
      title,
      published_at: normalizeDate(pick('published') || pick('updated')),
      author: author ? author.replace(/\s+/g, ' ').trim() : null,
      excerpt: stripTags(body).slice(0, 280) || null,
    });
  }
  return items;
}

module.exports = { parseRss, decodeXml, stripTags };

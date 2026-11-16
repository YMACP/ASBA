'use strict';

const crypto = require('node:crypto');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha1(s) {
  return crypto.createHash('sha1').update(String(s), 'utf8').digest('hex');
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Very small CJK / Latin language heuristic: returns 'zh' | 'en' */
function detectLang(text) {
  if (!text) return 'en';
  const sample = String(text).slice(0, 4000);
  const cjk = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  const latin = (sample.match(/[A-Za-z]/g) || []).length;
  if (cjk === 0) return 'en';
  if (cjk * 4 > latin) return 'zh';
  return cjk / (cjk + latin) > 0.15 ? 'zh' : 'en';
}

function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeFilename(name, fallback = 'article') {
  let s = String(name || '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/^\.+/, '').slice(0, 120);
  if (!s) s = fallback;
  return s;
}

function normalizeDate(input) {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fmtDateZh(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

module.exports = { sleep, sha1, escapeHtml, detectLang, htmlToText, sanitizeFilename, normalizeDate, fmtDateZh };

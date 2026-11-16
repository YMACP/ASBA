'use strict';

const { JSDOM } = require('jsdom');
const { collectBlocks } = require('./translate');
const { sleep } = require('./util');
const { fetchUrl, isNetworkError } = require('./net');

const ENDPOINT = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=zh-CN';
const MAX_CHARS = 6000;
const MAX_ATTEMPTS = 3;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function taggedError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function isRateLimit(status, body) {
  if (status === 429) return true;
  const text = String(body || '');
  return /too many requests|captcha|unusual traffic|automated queries|we're sorry|rate limit|quota/i.test(text);
}

function splitLongText(text, max = 3000) {
  const value = String(text || '');
  if (value.length <= max) return value ? [value] : [];
  const parts = [];
  let rest = value;
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    let cut = -1;
    const matches = [...window.matchAll(/[.!?。！？](?=\s|$)/g)];
    if (matches.length) cut = matches[matches.length - 1].index + 1;
    if (cut <= 0) {
      const space = rest.lastIndexOf(' ', max);
      cut = space > max * 0.5 ? space : max;
    }
    const piece = rest.slice(0, cut).trim();
    if (piece) parts.push(piece);
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

function makeGroups(blocks, max = MAX_CHARS) {
  const groups = [];
  let current = [];
  let size = 0;
  for (const block of blocks) {
    const text = String(block.text || '');
    if (!text) continue;
    if (current.length && size + text.length > max) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(block);
    size += text.length;
  }
  if (current.length) groups.push(current);
  return groups;
}

async function translateGoogle(texts) {
  const nonce = `[[ASBA_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}]]`;
  const joined = texts.join(`\n\n${nonce}\n\n`);
  const body = new URLSearchParams({ q: joined });

  let res;
  try {
    res = await fetchUrl(ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: {
        'User-Agent': UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: body.toString(),
    });
  } catch (e) {
    if (isNetworkError(e)) throw taggedError('NETWORK', '网络不可达');
    throw e;
  }

  const raw = await res.text();
  if (isRateLimit(res.status, raw)) throw taggedError('RATE_LIMIT', 'Google限流');
  if (!res.ok) throw taggedError('HTTP', `Google 翻译失败（HTTP ${res.status}）`);

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw taggedError('PARSE', 'Google 翻译返回了非 JSON 响应');
  }
  const segments = Array.isArray(data) ? data : null;
  if (!segments) throw taggedError('PARSE', 'Google 翻译返回结构异常');
  const translated = segments.map((seg) => (typeof seg === 'string' ? seg : (seg && seg[0]) || '')).join('');
  if (!translated.trim()) throw taggedError('EMPTY', 'Google 翻译返回空译文');

  if (texts.length === 1) return [normalizeSpace(translated.replaceAll(nonce, ''))];
  const parts = translated.split(nonce).map((x) => normalizeSpace(x));
  if (parts.length !== texts.length) throw taggedError('ALIGN', 'Google 翻译分块对齐失败');
  return parts;
}

async function translateGroupWithRetry(texts) {
  let lastError = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await translateGoogle(texts);
    } catch (e) {
      lastError = e;
      if (e.code === 'RATE_LIMIT') {
        if (attempt >= 1) throw e;
        await sleep(1800);
        continue;
      }
      if (e.code === 'NETWORK') {
        if (attempt >= 1) throw e;
        await sleep(1200);
        continue;
      }
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError || taggedError('UNKNOWN', '翻译失败');
}

async function translateArticleMachine({ db, articleId, emit }) {
  const art = db.getArticleForTranslation(articleId);
  if (!art) throw new Error('文章不存在');
  if (!art.content_html || art.content_html.length < 20) throw new Error('正文尚未抓取，请先同步文章');
  if (art.lang === 'zh') throw new Error('原文已经是中文，无需翻译');

  const dom = new JSDOM(`<body>${art.content_html}</body>`);
  const doc = dom.window.document;
  const blocks = collectBlocks(doc);
  if (!blocks.length) throw new Error('没有找到可翻译的文本块');

  const progress = (p) => {
    try {
      emit({ phase: 'translate', articleId, ...p });
    } catch { /* ignore */ }
  };

  progress({ done: 0, total: blocks.length, message: '机器翻译中...' });

  let done = 0;
  let failed = 0;
  let lastError = null;
  const groups = makeGroups(blocks);

  for (const group of groups) {
    try {
      const texts = group.map((b) => String(b.text || ''));
      const translated = await translateGroupWithRetry(texts);
      group.forEach((block, i) => {
        if (translated[i]) block.el.textContent = translated[i];
        else failed++;
      });
    } catch (e) {
      lastError = lastError || e;
      if (e.code === 'NETWORK' || e.code === 'RATE_LIMIT') throw e;
      // 分块对齐/解析失败时退回逐块请求
      for (const block of group) {
        try {
          const text = String(block.text || '');
          const parts = [];
          for (const piece of splitLongText(text)) {
            const [out] = await translateGroupWithRetry([piece]);
            if (out) parts.push(out);
          }
          const zh = normalizeSpace(parts.join(''));
          if (zh) block.el.textContent = zh;
          else failed++;
        } catch (inner) {
          failed++;
          lastError = lastError || inner;
          if (inner.code === 'NETWORK' || inner.code === 'RATE_LIMIT') throw inner;
        }
      }
    }
    done += group.length;
    progress({ done, total: blocks.length, message: '机器翻译中...' });
  }

  if (failed === blocks.length) {
    if (lastError && lastError.code === 'NETWORK') throw taggedError('NETWORK', '网络不可达');
    if (lastError && lastError.code === 'RATE_LIMIT') throw taggedError('RATE_LIMIT', 'Google限流');
    throw new Error(`翻译失败：${lastError ? lastError.message : '未知错误'}`);
  }

  let titleZh = null;
  const title = normalizeSpace(art.title || '');
  if (title && /[A-Za-z]{2,}/.test(title) && !/[\u4e00-\u9fff]/.test(title)) {
    try {
      const [out] = await translateGroupWithRetry([title]);
      titleZh = out || null;
    } catch {
      titleZh = null;
    }
  }

  db.saveTranslation(articleId, { titleZh, html: doc.body.innerHTML, model: 'Google Translate' });
  progress({ done: blocks.length, total: blocks.length, message: '机器翻译完成' });
  return { blocks: blocks.length, translated: blocks.length - failed, failed, titleZh, engine: 'google' };
}

module.exports = { translateArticleMachine };

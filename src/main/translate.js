'use strict';

const { JSDOM } = require('jsdom');
const { sha1, sleep } = require('./util');
const llm = require('./llm');

const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th,dt,dd';
const NESTED_SELECTOR = 'p,ul,ol,li,table,td,th,blockquote,pre,figure,h1,h2,h3,h4,h5,h6,section';

const SYSTEM_PROMPT = [
  '你是一名资深的 AI 研究文章译者，负责把英文 AI 研究博客翻译成准确、通顺的简体中文。',
  '用户会给出一个 JSON 字符串数组，请逐条翻译，并只输出一个 JSON 字符串数组。',
  '硬性要求：',
  '1. 输出数组的长度、顺序必须与输入完全一致；',
  '2. 每个元素只包含译文纯文本，不要包含 HTML 标签、Markdown 记号、引号或编号；',
  '3. 不要合并、拆分或省略任何一条；',
  '4. 保留专有名词（公司名、模型名、API 名、代码标识符）的英文原文；',
  '5. 不要输出解释、前后缀或 ``` 代码块，只输出 JSON 数组本身。',
].join('\n');

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function isTranslatable(text) {
  if (!text) return false;
  if (!/[\u4e00-\u9fff]/.test(text) && !/[A-Za-z]{2,}/.test(text)) return false;
  // ignore pure urls / emails
  if (/^(https?:\/\/|mailto:)\S+$/.test(text)) return false;
  return true;
}

function collectBlocks(doc) {
  const blocks = [];
  for (const el of doc.querySelectorAll(BLOCK_SELECTOR)) {
    if (el.closest('pre') || el.closest('code')) continue;
    if (el.querySelector(NESTED_SELECTOR)) continue;
    const text = normalizeSpace(el.textContent);
    if (!isTranslatable(text)) continue;
    blocks.push({ el, text });
  }
  return blocks;
}

function parseArray(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const tryParse = (t) => {
    try {
      const v = JSON.parse(t);
      if (Array.isArray(v)) return v;
      if (v && Array.isArray(v.translations)) return v.translations;
      if (v && Array.isArray(v.result)) return v.result;
      return null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(s);
  if (direct) return direct;
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start >= 0 && end > start) {
    const inner = tryParse(s.slice(start, end + 1));
    if (inner) return inner;
  }
  return null;
}

function chunkBlocks(blocks, maxChars) {
  const chunks = [];
  let cur = [];
  let size = 0;
  const limit = Math.max(600, maxChars || 2600);
  for (const b of blocks) {
    const len = b.text.length;
    if (cur.length && size + len > limit) {
      chunks.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += len;
    if (len > limit) {
      // single oversized block gets its own chunk
      chunks.push(cur);
      cur = [];
      size = 0;
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

async function translateBatch(texts, settings, attempt = 0) {
  const user = JSON.stringify(texts);
  const maxTokens = settings.maxOutput128K
    ? 128000
    : Math.min(8192, Math.max(1024, Math.ceil(texts.join('').length * 1.4)));
  const system =
    attempt === 0
      ? SYSTEM_PROMPT
      : SYSTEM_PROMPT + '\n6. 特别注意：上一次的输出不是合法的 JSON 数组，请严格只输出 JSON 数组。';
  const { text } = await llm.request(settings, {
    system,
    user,
    maxTokens,
    temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.2,
    timeout: 180000,
    retries: 2,
  });
  const arr = parseArray(text);
  if (!arr || arr.length !== texts.length) {
    throw new Error(`返回条目数不匹配（期望 ${texts.length}，实际 ${arr ? arr.length : '解析失败'}）`);
  }
  return arr.map((x) => (typeof x === 'string' ? x : String(x)));
}

/**
 * Translate one article and persist the result.
 */
async function translateArticle({ db, articleId, llmSettings, emit }) {
  const art = db.getArticleForTranslation(articleId);
  if (!art) throw new Error('文章不存在');
  if (!art.content_html || art.content_html.length < 20) throw new Error('正文尚未抓取，请先同步文章');
  if (art.lang === 'zh') throw new Error('原文已经是中文，无需翻译');
  if (!llmSettings.apiKey) throw new Error('请先在设置中填写大模型 API Key');

  const dom = new JSDOM(`<body>${art.content_html}</body>`);
  const doc = dom.window.document;
  const blocks = collectBlocks(doc);
  if (!blocks.length) throw new Error('没有找到可翻译的文本块');

  const title = normalizeSpace(art.title || '');
  const progress = (p) => {
    try {
      emit({ phase: 'translate', articleId, ...p });
    } catch { /* ignore */ }
  };

  // 1) cache
  const byHash = new Map();
  const pending = [];
  for (const b of blocks) {
    const hash = sha1(b.text);
    let zh = byHash.get(hash);
    if (zh === undefined) {
      zh = db.getCachedTranslation(hash);
      if (zh) byHash.set(hash, zh);
    }
    if (zh) continue;
    pending.push({ block: b, hash, text: b.text });
  }
  progress({ done: 0, total: pending.length, message: `共 ${blocks.length} 个文本块（缓存命中 ${blocks.length - pending.length}）` });

  const model = llmSettings.model;
  if (pending.length) {
    // A large context window (1M) allows bigger translation batches, which
    // means fewer round trips for long articles.
    const chunkLimit = llmSettings.context1M
      ? Math.max(Number(llmSettings.chunkChars) || 2600, 12000)
      : llmSettings.chunkChars;
    const chunks = chunkBlocks(pending, chunkLimit);
    const parallel = Math.max(1, Math.min(4, Number(llmSettings.concurrency) || 2));
    let done = 0;
    for (let i = 0; i < chunks.length; i += parallel) {
      const group = chunks.slice(i, i + parallel);
      await Promise.all(
        group.map(async (chunk) => {
          const texts = chunk.map((b) => b.text);
          let out;
          try {
            out = await translateBatch(texts, llmSettings, 0);
          } catch (e) {
            progress({ done, total: pending.length, message: `批次失败，重试中：${e.message.slice(0, 80)}` });
            await sleep(800);
            out = await translateBatch(texts, llmSettings, 1);
          }
          chunk.forEach((item, idx) => {
            const zh = normalizeSpace(out[idx]);
            if (!zh) return;
            byHash.set(item.hash, zh);
            db.putCachedTranslation(item.hash, item.text, zh, model);
          });
          done += chunk.length;
          progress({ done, total: pending.length, message: `翻译中… ${done}/${pending.length}` });
        })
      );
    }
  }

  // 2) rewrite blocks
  let translatedCount = 0;
  for (const b of blocks) {
    const zh = byHash.get(sha1(b.text));
    if (!zh) continue;
    b.el.textContent = zh;
    translatedCount++;
  }

  // 3) title
  let titleZh = null;
  if (title && isTranslatable(title)) {
    const h = sha1('title::' + title);
    titleZh = db.getCachedTranslation(h);
    if (!titleZh) {
      try {
        const out = await translateBatch([title], llmSettings, 0);
        titleZh = normalizeSpace(out[0]);
        db.putCachedTranslation(h, title, titleZh, model);
      } catch {
        titleZh = null;
      }
    }
  }

  db.saveTranslation(articleId, { titleZh, html: doc.body.innerHTML, model });
  progress({ done: pending.length, total: pending.length, message: `翻译完成（${translatedCount} 个文本块）` });
  return { blocks: blocks.length, translated: translatedCount, cached: blocks.length - pending.length, titleZh };
}

module.exports = { translateArticle, collectBlocks, parseArray };

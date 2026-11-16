'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const SITE_SEED = [
  {
    key: 'anthropic',
    name: 'Anthropic',
    home_url: 'https://www.anthropic.com',
    index_url: 'https://www.anthropic.com/research',
    adapter: 'anthropic',
    lang: 'en',
    accent: '#d97757',
  },
  {
    key: 'openai',
    name: 'OpenAI',
    home_url: 'https://openai.com',
    index_url: 'https://openai.com/research/index/',
    adapter: 'openai',
    lang: 'en',
    accent: '#10a37f',
  },
  {
    key: 'deepmind',
    name: 'Google',
    home_url: 'https://deepmind.google',
    index_url: 'https://deepmind.google/research/publications/',
    adapter: 'deepmind',
    lang: 'en',
    accent: '#4285f4',
  },
  {
    key: 'microsoft',
    name: 'Microsoft',
    home_url: 'https://www.microsoft.com/en-us/security/blog/',
    index_url: 'https://www.microsoft.com/en-us/security/blog/',
    adapter: 'microsoft',
    lang: 'en',
    accent: '#0078d4',
  },
  {
    key: 'unit42',
    name: 'paloalto',
    home_url: 'https://unit42.paloaltonetworks.com/',
    index_url: 'https://unit42.paloaltonetworks.com/category/threat-research/',
    adapter: 'unit42',
    lang: 'en',
    accent: '#fa582d',
  },
  {
    key: 'hiddenlayer',
    name: 'HiddenLayer',
    home_url: 'https://www.hiddenlayer.com/',
    index_url: 'https://www.hiddenlayer.com/innovation-hub/research',
    adapter: 'hiddenlayer',
    lang: 'en',
    accent: '#14b8a6',
  },
  {
    key: 'meta',
    name: 'Meta',
    home_url: 'https://github.com/facebookresearch',
    index_url: 'https://github.com/facebookresearch',
    adapter: 'meta',
    lang: 'en',
    accent: '#0866ff',
  },
  {
    key: 'invariant',
    name: 'Invariantlabs',
    home_url: 'https://invariantlabs.ai',
    index_url: 'https://invariantlabs.ai/blog',
    adapter: 'invariant',
    lang: 'en',
    accent: '#6360fd',
  },
  {
    key: 'zenity',
    name: 'Zenity',
    home_url: 'https://zenity.io',
    index_url: 'https://zenity.io/blog',
    adapter: 'zenity',
    lang: 'en',
    accent: '#7c3aed',
  },
  {
    key: 'matrix',
    name: '腾讯朱雀实验室',
    home_url: 'https://matrix.tencent.com',
    index_url: 'https://matrix.tencent.com/zh/articles',
    adapter: 'matrix',
    lang: 'zh',
    accent: '#1d5bff',
  },
  {
    key: 'xbow',
    name: 'XBOW',
    home_url: 'https://xbow.com',
    index_url: 'https://xbow.com/blog',
    adapter: 'xbow',
    lang: 'en',
    accent: '#f2542d',
  },
  {
    key: 'projectzero',
    name: 'Project Zero',
    home_url: 'https://projectzero.google',
    index_url: 'https://projectzero.google/',
    adapter: 'projectzero',
    lang: 'en',
    accent: '#ea4335',
  },
  {
    key: 'aisle',
    name: 'AISLE',
    home_url: 'https://aisle.com',
    index_url: 'https://aisle.com/blog',
    adapter: 'aisle',
    lang: 'en',
    accent: '#f97316',
  },
  {
    key: 'zeropath',
    name: 'ZeroPath',
    home_url: 'https://zeropath.com',
    index_url: 'https://zeropath.com/blog',
    adapter: 'zeropath',
    lang: 'en',
    accent: '#2563eb',
  },
  {
    key: 'sybil',
    name: 'RunSybil',
    home_url: 'https://www.runsybil.com',
    index_url: 'https://www.runsybil.com/blog',
    adapter: 'sybil',
    lang: 'en',
    accent: '#0ea5e9',
  },
  {
    key: 'simon',
    name: 'Simon Willison',
    home_url: 'https://simonwillison.net',
    index_url: 'https://simonwillison.net/',
    adapter: 'simon',
    lang: 'en',
    accent: '#6b7280',
  },
  {
    key: 'embrace',
    name: 'Embrace The Red',
    home_url: 'https://embracethered.com',
    index_url: 'https://embracethered.com/blog/index.html',
    adapter: 'embrace',
    lang: 'en',
    accent: '#b91c1c',
  },
  {
    key: 'carlini',
    name: 'Nicholas Carlini',
    home_url: 'https://nicholas.carlini.com',
    index_url: 'https://nicholas.carlini.com/',
    adapter: 'carlini',
    lang: 'en',
    accent: '#111827',
  },
  {
    key: 'thacker',
    name: 'Joseph Thacker',
    home_url: 'https://josephthacker.com',
    index_url: 'https://josephthacker.com/',
    adapter: 'thacker',
    lang: 'en',
    accent: '#0f766e',
  },
];

class DB {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'asba.db');
    this.db = new DatabaseSync(this.file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    this.migrate();
    this.seed();
    this.prepare();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        home_url TEXT,
        index_url TEXT,
        adapter TEXT NOT NULL,
        lang TEXT DEFAULT 'en',
        accent TEXT,
        enabled INTEGER DEFAULT 1,
        last_sync_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT,
        category TEXT,
        author TEXT,
        published_at TEXT,
        excerpt TEXT,
        cover_url TEXT,
        content_html TEXT,
        content_text TEXT,
        lang TEXT,
        word_count INTEGER DEFAULT 0,
        fetched_at TEXT,
        fetch_error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(site_id, url)
      );
      CREATE INDEX IF NOT EXISTS idx_articles_site ON articles(site_id, published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
      CREATE TABLE IF NOT EXISTS translations (
        article_id INTEGER PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
        title_zh TEXT,
        content_html TEXT,
        model TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS translation_cache (
        hash TEXT PRIMARY KEY,
        src TEXT,
        zh TEXT,
        model TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  seed() {
    const stmt = this.db.prepare(
      `INSERT INTO sites (key, name, home_url, index_url, adapter, lang, accent)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         name = excluded.name,
         home_url = excluded.home_url,
         index_url = excluded.index_url,
         adapter = excluded.adapter,
         accent = excluded.accent`
    );
    for (const s of SITE_SEED) stmt.run(s.key, s.name, s.home_url, s.index_url, s.adapter, s.lang, s.accent);
  }

  prepare() {
    if (this.q) return;
    const p = (sql) => this.db.prepare(sql);
    this.q = {
      sites: p(`SELECT s.*,
                 (SELECT COUNT(*) FROM articles a WHERE a.site_id = s.id) AS article_count,
                 (SELECT COUNT(*) FROM articles a WHERE a.site_id = s.id AND a.content_html IS NOT NULL) AS fetched_count,
                 (SELECT COUNT(*) FROM articles a JOIN translations t ON t.article_id = a.id WHERE a.site_id = s.id) AS translated_count
               FROM sites s ORDER BY s.id`),
      siteById: p('SELECT * FROM sites WHERE id = ?'),
      touchSite: p(`UPDATE sites SET last_sync_at = datetime('now') WHERE id = ?`),
      upsertArticle: p(`
        INSERT INTO articles (site_id, url, title, category, published_at, excerpt, cover_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(site_id, url) DO UPDATE SET
          title = COALESCE(excluded.title, articles.title),
          category = COALESCE(excluded.category, articles.category),
          published_at = COALESCE(excluded.published_at, articles.published_at),
          excerpt = COALESCE(excluded.excerpt, articles.excerpt),
          cover_url = COALESCE(excluded.cover_url, articles.cover_url)
      `),
      idByUrl: p('SELECT id FROM articles WHERE site_id = ? AND url = ?'),
      pending: p(`SELECT id, url, title, published_at FROM articles
                  WHERE site_id = ? AND (content_html IS NULL OR length(content_html) < 50)
                  ORDER BY published_at DESC LIMIT ?`),
      list: p(`
        SELECT a.id, a.site_id, a.url, a.title, a.category, a.author, a.published_at, a.excerpt,
               a.cover_url, a.lang, a.word_count, a.fetched_at, a.fetch_error,
               (t.article_id IS NOT NULL) AS translated,
               s.name AS site_name, s.accent AS site_accent
        FROM articles a
        JOIN sites s ON s.id = a.site_id
        LEFT JOIN translations t ON t.article_id = a.id
        WHERE (@siteId IS NULL OR a.site_id = @siteId)
          AND (@q IS NULL OR a.title LIKE @like OR a.excerpt LIKE @like OR a.content_text LIKE @like)
        ORDER BY (a.published_at IS NULL), a.published_at DESC, a.id DESC
        LIMIT @limit OFFSET @offset
      `),
      count: p(`
        SELECT COUNT(*) AS n FROM articles a
        WHERE (@siteId IS NULL OR a.site_id = @siteId)
          AND (@q IS NULL OR a.title LIKE @like OR a.excerpt LIKE @like OR a.content_text LIKE @like)
      `),
      article: p(`
        SELECT a.*, s.name AS site_name, s.home_url AS site_home, s.accent AS site_accent,
               t.title_zh, t.content_html AS translated_html, t.model AS translated_model, t.created_at AS translated_at
        FROM articles a JOIN sites s ON s.id = a.site_id
        LEFT JOIN translations t ON t.article_id = a.id
        WHERE a.id = ?
      `),
      saveContent: p(`
        UPDATE articles SET content_html = ?, content_text = ?, lang = ?, author = ?,
          published_at = COALESCE(articles.published_at, ?), excerpt = ?, cover_url = ?, word_count = ?, fetched_at = datetime('now'),
          fetch_error = NULL, title = COALESCE(?, title)
        WHERE id = ?
      `),
      setError: p(`UPDATE articles SET fetch_error = ?, fetched_at = datetime('now') WHERE id = ?`),
      saveTranslation: p(`
        INSERT INTO translations (article_id, title_zh, content_html, model)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(article_id) DO UPDATE SET title_zh = excluded.title_zh,
          content_html = excluded.content_html, model = excluded.model, created_at = datetime('now')
      `),
      deleteTranslation: p('DELETE FROM translations WHERE article_id = ?'),
      cacheGet: p('SELECT zh FROM translation_cache WHERE hash = ?'),
      cachePut: p(`INSERT INTO translation_cache (hash, src, zh, model) VALUES (?, ?, ?, ?)
                   ON CONFLICT(hash) DO UPDATE SET zh = excluded.zh, model = excluded.model`),
      articleSite: p('SELECT site_id, url, title, content_html, content_text, lang, author, published_at, excerpt, cover_url FROM articles WHERE id = ?'),
    };
  }

  close() {
    try { this.db.close(); } catch { /* ignore */ }
  }

  getSites() {
    return this.q.sites.all();
  }

  getSite(id) {
    return this.q.siteById.get(id);
  }

  touchSite(id) {
    this.q.touchSite.run(id);
  }

  /** Insert stubs from a discovery pass. Returns [{id, url, title, isNew}] */
  upsertDiscovered(siteId, items) {
    const out = [];
    for (const it of items) {
      const url = String(it.url || '').trim();
      if (!url) continue;
      const before = this.q.idByUrl.get(siteId, url);
      this.q.upsertArticle.run(
        siteId,
        url,
        it.title || null,
        it.category || null,
        it.published_at || null,
        it.excerpt || null,
        it.cover_url || null
      );
      const row = this.q.idByUrl.get(siteId, url);
      out.push({ id: row.id, url, title: it.title || null, isNew: !before });
    }
    return out;
  }

  pendingArticles(siteId, limit = 500) {
    return this.q.pending.all(siteId, limit);
  }

  listArticles({ siteId = null, q = null, limit = 50, offset = 0 } = {}) {
    const query = (q || '').trim();
    const base = {
      siteId: siteId || null,
      q: query || null,
      like: query ? `%${query}%` : null,
    };
    const rows = this.q.list.all({ ...base, limit, offset });
    const total = this.q.count.get(base).n;
    return { rows, total };
  }

  getArticle(id) {
    return this.q.article.get(id);
  }

  getArticleForTranslation(id) {
    return this.q.articleSite.get(id);
  }

  saveContent(id, data) {
    this.q.saveContent.run(
      data.content_html || null,
      data.content_text || null,
      data.lang || null,
      data.author || null,
      data.published_at || null,
      data.excerpt || null,
      data.cover_url || null,
      data.word_count || 0,
      data.title || null,
      id
    );
  }

  setFetchError(id, msg) {
    this.q.setError.run(String(msg || 'unknown error').slice(0, 500), id);
  }

  saveTranslation(articleId, { titleZh, html, model }) {
    this.q.saveTranslation.run(articleId, titleZh || null, html, model || null);
  }

  deleteTranslation(articleId) {
    this.q.deleteTranslation.run(articleId);
  }

  getCachedTranslation(hash) {
    const row = this.q.cacheGet.get(hash);
    return row ? row.zh : null;
  }

  putCachedTranslation(hash, src, zh, model) {
    this.q.cachePut.run(hash, src, zh, model || null);
  }
}

module.exports = { DB, SITE_SEED };

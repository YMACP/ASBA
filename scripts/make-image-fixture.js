// Create an isolated user-data copy with image fixture articles (never touches real DB).
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const OUT = path.join(process.env.TEMP, 'asba_probe', 'imgfix');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

const src = path.join(process.env.APPDATA, 'ASBA', 'data', 'asba.db');
const dst = path.join(OUT, 'data', 'asba.db');
fs.copyFileSync(src, dst);
// Copy the write-ahead log too so the snapshot matches the live database.
for (const suffix of ['-wal', '-shm']) {
  if (fs.existsSync(src + suffix)) fs.copyFileSync(src + suffix, dst + suffix);
}
const db = new DatabaseSync(dst);

const longText = 'Diagnostic fixture body text. '.repeat(40);

// 1. Fixture with a broken remote URL + a placeholder-only image.
const brokenHtml = `<p>${longText}</p>
<p><img src="https://invalid.invalid/does-not-exist.png" alt="broken remote"></p>
<p><img alt="lost address"></p>
<p><img src="https://www.anthropic.com/_next/image?url=https%3A%2F%2Fimg.youtube.com%2Fvi%2F2MJDdzSXL74%2Fmaxresdefault.jpg&amp;w=3840&amp;q=75" alt="next proxy image"></p>`;

db.prepare(`INSERT INTO articles (site_id, url, title, category, author, published_at, excerpt, content_html, content_text, lang, word_count, fetched_at)
  VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 'en', ?, datetime('now'))
  ON CONFLICT(site_id, url) DO UPDATE SET content_html=excluded.content_html, title=excluded.title`)
  .run('https://fixture.local/image-diagnostics', 'Image diagnostics fixture', 'Test',
    'Fixture', '2099-01-01T00:00:00Z', 'Fixture for image failure states.',
    brokenHtml, longText, 40);

// 2. Fixture with 60 valid ctfassets + claude images would be slow; reuse real
// article ids instead for happy-path checks. Just report them.
const heavy = db.prepare(`SELECT id, title, (length(content_html) - length(replace(content_html, '<img', '<img'))) AS n
  FROM articles WHERE content_html IS NOT NULL ORDER BY length(content_html) DESC LIMIT 3`).all();
console.log('fixture db:', dst);
console.log(JSON.stringify(heavy, null, 2));
db.close();

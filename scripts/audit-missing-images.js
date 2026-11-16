// Compare cached image-less Anthropic articles against their live pages.
const { DatabaseSync } = require('node:sqlite');
const { JSDOM } = require('jsdom');
const path = require('node:path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const db = new DatabaseSync(path.join(process.env.APPDATA, 'ASBA', 'data', 'asba.db'), { readOnly: true });
const rows = db.prepare(`SELECT id,title,url FROM articles
  WHERE site_id=1 AND content_html IS NOT NULL AND content_html NOT LIKE '%<img%'
  ORDER BY id LIMIT 12`).all();

(async () => {
  for (const row of rows) {
    let summary;
    try {
      const res = await fetch(row.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
      if (!res.ok) { summary = `HTTP ${res.status}`; }
      else {
        const html = await res.text();
        const dom = new JSDOM(html, { url: row.url });
        const body = dom.window.document.querySelector('[data-article-body]') || dom.window.document.body;
        const imgs = [...body.querySelectorAll('img')];
        summary = JSON.stringify({
          imgs: imgs.length,
          lazy: imgs.filter((i) => i.getAttribute('data-src') || i.getAttribute('data-srcset')).length,
          srcset: imgs.filter((i) => i.getAttribute('srcset')).length,
          picture: body.querySelectorAll('picture').length,
          noSrc: imgs.filter((i) => !i.getAttribute('src')).length,
        });
      }
    } catch (e) {
      summary = 'ERR ' + e.message;
    }
    console.log(JSON.stringify({ id: row.id, title: row.title.slice(0, 70), url: row.url.replace('https://www.anthropic.com/research/', ''), live: summary }));
  }
  db.close();
})();

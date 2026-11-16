// Dump article HTML image markup for the two problem articles.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(path.join(process.env.APPDATA, 'ASBA', 'data', 'asba.db'), { readOnly: true });
for (const id of [224, 213]) {
  const row = db.prepare('SELECT id,title,url,content_html FROM articles WHERE id=?').get(id);
  const imgs = [...String(row.content_html).matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  console.log('\n===', row.id, row.title, '| imgs', imgs.length);
  imgs.slice(0, 6).forEach((t, i) => console.log(i, t.slice(0, 320)));
  const fig = [...String(row.content_html).matchAll(/<figure[\s\S]{0,400}?<\/figure>/g)].slice(0, 2).map((m) => m[0].slice(0, 400));
  console.log('figures sample:', JSON.stringify(fig, null, 1).slice(0, 900));
}
db.close();

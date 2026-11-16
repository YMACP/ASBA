const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, '..', 'seed.db'), { readOnly: true });
for (const siteId of [1, 2]) {
  const row = db.prepare('select id, title, content_html from articles where site_id = ? and content_html is not null order by published_at desc limit 1').get(siteId);
  if (!row) continue;
  const imgs = [...row.content_html.matchAll(/<img[^>]*>/g)].map((m) => m[0]).slice(0, 6);
  console.log(`\n=== site ${siteId}: ${row.title}`);
  console.log('content html len', row.content_html.length);
  console.log(imgs.join('\n'));
  const srcs = [...row.content_html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  console.log('src count', srcs.length, 'sample', srcs.slice(0, 5));
  console.log('has srcset?', /srcset=/.test(row.content_html), '| data: uris:', srcs.filter((s) => s.startsWith('data:')).length);
}
db.close();

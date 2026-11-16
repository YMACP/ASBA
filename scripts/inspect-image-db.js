const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const dbPath = process.argv[2] || path.join(process.env.APPDATA, 'ASBA', 'data', 'asba.db');
const db = new DatabaseSync(dbPath, { readOnly: true });
const rows = db.prepare(`SELECT id, site_id, title, url, content_html FROM articles WHERE content_html IS NOT NULL`).all();
const hosts = new Map();
const examples = [];
let total = 0;
let invalid = 0;
for (const r of rows) {
  const matches = [...String(r.content_html).matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  for (const tag of matches) {
    total++;
    const src = (tag.match(/\bsrc="([^"]*)"/i) || [])[1] || '';
    const alt = (tag.match(/\balt="([^"]*)"/i) || [])[1] || '';
    let u;
    try { u = new URL(src); } catch { invalid++; if(examples.length<30) examples.push({id:r.id,site:r.site_id,title:r.title,src,tag:tag.slice(0,250)}); continue; }
    hosts.set(u.hostname, (hosts.get(u.hostname)||0)+1);
    if (!/^https?:$/.test(u.protocol) || /^(?:data:|about:|javascript:)/i.test(src)) {
      invalid++;
      if (examples.length<30) examples.push({id:r.id,site:r.site_id,title:r.title,src,alt});
    }
  }
}
console.log(JSON.stringify({dbPath, articles:rows.length, imageTags:total, invalid, hosts:[...hosts].sort((a,b)=>b[1]-a[1]), examples},null,2));
db.close();

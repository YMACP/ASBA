// Offline test of jsdom + Readability extraction on saved pages.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const OUT = path.join(process.env.TEMP, 'asba_probe');
for (const f of ['anth_article.html', 'openai_article.html']) {
  const p = path.join(OUT, f);
  if (!fs.existsSync(p)) { console.log(f + ' missing'); continue; }
  const html = fs.readFileSync(p, 'utf8');
  const t0 = Date.now();
  const dom = new JSDOM(html, { url: f.startsWith('openai') ? 'https://openai.com/index/x/' : 'https://www.anthropic.com/research/x' });
  const doc = dom.window.document;
  const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent);
  const art = new Readability(doc).parse();
  console.log('\n=== ' + f + ' (' + html.length + ' bytes, parse ' + (Date.now() - t0) + 'ms) ===');
  console.log('jsonld:', (ld[0] || '').slice(0, 300));
  if (!art) { console.log('READABILITY FAILED'); continue; }
  console.log('title:', art.title);
  console.log('byline:', art.byline, '| site:', art.siteName);
  console.log('textLen:', art.textContent.length, '| htmlLen:', art.content.length);
  console.log('excerpt:', art.excerpt);
  console.log('imgs in content:', (art.content.match(/<img/g) || []).length);
  console.log('html head:', art.content.slice(0, 300));
}

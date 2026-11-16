// Compare container-based extraction against Readability.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const OUT = path.join(process.env.TEMP, 'asba_probe');

const cases = [
  { f: 'anth_article.html', sels: ['[data-article-body]', 'article', 'main'] },
  { f: 'openai_article.html', sels: ['[data-toc-content]', 'article', 'main', '[class*="article"]'] },
];

for (const c of cases) {
  const html = fs.readFileSync(path.join(OUT, c.f), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.com/x' });
  const doc = dom.window.document;
  console.log('\n=== ' + c.f + ' ===');
  console.log('body textLen', doc.body.innerText ? doc.body.innerText.length : 'n/a');
  for (const sel of c.sels) {
    const el = doc.querySelector(sel);
    if (!el) { console.log(sel, '=> none'); continue; }
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    console.log(sel, '=> text', txt.length, '| html', el.innerHTML.length, '| imgs', el.querySelectorAll('img').length, '| h2s', el.querySelectorAll('h2').length);
    console.log('   head:', txt.slice(0, 160));
  }
  // element frequency of data-* attrs
  const attrs = new Map();
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of el.attributes || []) if (a.name.startsWith('data-') && a.name !== 'data-reactroot') attrs.set(a.name, (attrs.get(a.name) || 0) + 1);
  });
  console.log('top data attrs:', [...attrs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map((e) => e[0] + ':' + e[1]).join(', '));
}

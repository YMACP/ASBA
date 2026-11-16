// Inspect OpenAI card DOM structure from saved English index.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const OUT = path.join(process.env.TEMP, 'asba_probe');
const f = path.join(OUT, 'openai_index_after_load.html');
console.log('exists', fs.existsSync(f));
const html = fs.readFileSync(f, 'utf8');
const dom = new JSDOM(html, { url: 'https://openai.com/research/index/' });
const doc = dom.window.document;
const anchors = [...doc.querySelectorAll('a[href^="/index/"], a[href^="https://openai.com/index/"]')];
console.log('anchors', anchors.length);
for (const a of anchors.slice(0, 4)) {
  let el = a;
  const chain = [];
  for (let i = 0; i < 7 && el; i++) {
    chain.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').slice(0, 3).join('.') : ''} [${(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)}]`);
    el = el.parentElement;
  }
  console.log('\nANCHOR', a.getAttribute('href'), '\n text:', (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120));
  console.log(chain.join('\n  ^ '));
}
console.log('\n--- time elements ---');
for (const t of [...doc.querySelectorAll('time')].slice(0, 5)) {
  console.log(t.outerHTML.slice(0, 200), '| parent:', t.parentElement.className, '|', t.parentElement.textContent.replace(/\s+/g, ' ').trim().slice(0, 100));
}

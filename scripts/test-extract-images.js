// Offline regression test: lazy/srcset/picture sources survive extraction.
const assert = require('node:assert');
const { extractArticle } = require('../src/main/extract');

const page = (body) => `<!doctype html><html><head>
<script type="application/ld+json">{"@type":"Article","headline":"Fixture","datePublished":"2026-01-02T00:00:00Z"}</script>
</head><body><article data-article-body>${body}
${'<p>' + 'Body text for extraction. '.repeat(30) + '</p>'}
</article></body></html>`;

function run(name, html, check) {
  const art = extractArticle(html, 'https://example.com/post', { selectors: ['[data-article-body]'] });
  check(art, name);
  console.log('ok -', name);
}

// 1. data-src placeholder
run('data-src wins over placeholder', page(`
  <p><img src="/placeholder.gif" data-src="/img/real.png" alt="real"></p>
`), (art) => {
  assert.match(art.content_html, /https:\/\/example\.com\/img\/real\.png/);
  assert.doesNotMatch(art.content_html, /placeholder\.gif/);
});

// 2. data-srcset only
run('data-srcset with width descriptors', page(`
  <p><img src="data:image/gif;base64,R0lGOD" data-srcset="/img/s-640.png 640w, /img/s-1600.png 1600w" alt="set"></p>
`), (art) => {
  assert.match(art.content_html, /https:\/\/example\.com\/img\/s-1600\.png/);
});

// 3. srcset with density descriptors
run('srcset x descriptors', page(`
  <p><img src="/img/low.png" srcset="/img/low.png 1x, /img/high@2x.png 2x" alt="density"></p>
`), (art) => {
  assert.match(art.content_html, /https:\/\/example\.com\/img\/high@2x\.png/);
});

// 4. picture/source only
run('picture source fallback', page(`
  <p><picture><source srcset="/img/pic-800.webp 800w, /img/pic-1400.webp 1400w"><img alt="pic"></picture></p>
`), (art) => {
  assert.match(art.content_html, /https:\/\/example\.com\/img\/pic-1400\.webp/);
});

// 5. relative src absolutized through reader rewrite
run('relative src kept absolute', page(`
  <p><img src="/img/plain.png" alt="plain"></p>
`), (art) => {
  assert.match(art.content_html, /src="https:\/\/example\.com\/img\/plain\.png"/);
});

// 6. javascript:/data placeholder cannot leak
run('unsafe src removed', page(`
  <p><img src="javascript:alert(1)" alt="bad"></p>
`), (art) => {
  const tags = art.content_html.match(/<img[^>]*>/g) || [];
  assert.equal(tags.length, 1);
  assert.doesNotMatch(tags[0], /javascript:/i);
  assert.doesNotMatch(tags[0], /\ssrc=/);
});

// 7. Readability fallback path keeps lazy sources
const readabilityHtml = `<html><body><div id="main"><h1>Readable</h1>
${'<p>' + 'Readability needs enough text to parse this article body. '.repeat(20) + '</p>'}
<p><img src="data:image/gif;base64,R0lGOD" data-src="/img/readability.png" alt="r"></p>
</div></body></html>`;
const readableArt = extractArticle(readabilityHtml, 'https://example.com/read');
assert.ok(/readability\.png/.test(readableArt.content_html), 'readability path should keep lazy image');
console.log('ok - readability fallback keeps lazy image');

console.log('\nall extraction checks passed');

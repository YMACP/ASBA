// Load the live OpenAI article in the crawl browser and inspect how the rim-label
// SVG is cropped by the site (wrapper classes / styles).
const { app } = require('electron');
const { CrawlBrowser } = require('../src/main/browser');

app.whenReady().then(async () => {
  const browser = new CrawlBrowser('openai');
  try {
    await browser.load('https://openai.com/index/measuring-how-ai-agents-handle-wet-lab-science/', { waitAfter: 3000 });
    const out = await browser.eval(`(() => {
      const img = [...document.images].find((i) => /rim-label/i.test(i.currentSrc || i.src));
      if (!img) return { found: false, total: document.images.length };
      const chain = [];
      let el = img;
      for (let i = 0; i < 5 && el; i++) {
        const cs = getComputedStyle(el);
        chain.push({
          tag: el.tagName,
          cls: String(el.className || '').slice(0, 200),
          style: (el.getAttribute('style') || '').slice(0, 300),
          overflow: cs.overflow,
          aspectRatio: cs.aspectRatio,
          height: cs.height,
          width: cs.width,
          maxHeight: cs.maxHeight,
          objectFit: cs.objectFit,
          display: cs.display,
        });
        el = el.parentElement;
      }
      const r = img.getBoundingClientRect();
      return {
        found: true,
        src: img.currentSrc || img.src,
        natural: [img.naturalWidth, img.naturalHeight],
        rect: [Math.round(r.width), Math.round(r.height)],
        chain,
        outer: img.closest('figure') ? img.closest('figure').outerHTML.slice(0, 1500) : null,
      };
    })()`);
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    browser.close();
    app.quit();
  }
});

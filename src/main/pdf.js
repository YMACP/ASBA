'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog } = require('electron');
const { sanitizeFilename, escapeHtml, fmtDateZh, sleep } = require('./util');

const CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #17181c; }
  body {
    font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.75; -webkit-print-color-adjust: exact;
  }
  .page { max-width: 760px; margin: 0 auto; padding: 4px 0 24px; }
  .kicker { font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; color: #b45309; font-weight: 700; margin-bottom: 10px; }
  h1.title { font-size: 22pt; line-height: 1.3; margin: 0 0 8px; font-weight: 800; letter-spacing: -0.01em; }
  .subtitle { font-size: 10pt; color: #5b616e; margin: 0 0 14px; }
  .meta { font-size: 8.8pt; color: #6b7280; padding: 8px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; margin-bottom: 22px; display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .meta a { color: #6b7280; text-decoration: none; word-break: break-all; }
  article.content { font-size: 10.8pt; }
  article.content h1, article.content h2, article.content h3, article.content h4 {
    line-height: 1.35; margin: 1.5em 0 .55em; font-weight: 700; break-after: avoid;
  }
  article.content h1 { font-size: 17pt; }
  article.content h2 { font-size: 14pt; border-left: 3px solid #d97757; padding-left: 10px; }
  article.content h3 { font-size: 12pt; }
  article.content p { margin: 0 0 .85em; }
  article.content a { color: #0b62c4; text-decoration: underline; word-break: break-all; }
  article.content img { max-width: 100% !important; height: auto !important; display: block; margin: 14px auto; break-inside: avoid; }
  article.content figure { margin: 16px 0; break-inside: avoid; }
  article.content figcaption { font-size: 8.8pt; color: #6b7280; text-align: center; margin-top: 6px; }
  article.content ul, article.content ol { margin: 0 0 .9em; padding-left: 1.5em; }
  article.content li { margin: .25em 0; }
  article.content blockquote { margin: 1em 0; padding: 8px 14px; border-left: 3px solid #e5e7eb; color: #374151; background: #fafafa; }
  article.content pre { background: #f6f8fa; border: 1px solid #eaeef2; border-radius: 8px; padding: 10px 12px; overflow: auto; white-space: pre-wrap; word-break: break-word; font-size: 8.6pt; break-inside: avoid; }
  article.content code { font-family: "Cascadia Mono", Consolas, "Courier New", monospace; font-size: .92em; background: #f3f4f6; padding: 1px 4px; border-radius: 4px; }
  article.content pre code { background: none; padding: 0; font-size: 1em; }
  article.content table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 9.2pt; break-inside: avoid; }
  article.content th, article.content td { border: 1px solid #e5e7eb; padding: 6px 8px; vertical-align: top; text-align: left; }
  article.content th { background: #f9fafb; font-weight: 600; }
  article.content hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.4em 0; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 8pt; color: #9ca3af; display: flex; justify-content: space-between; gap: 10px; }
  .badge { display: inline-block; font-size: 8pt; font-weight: 700; color: #92400e; background: #fef3c7; border-radius: 4px; padding: 1px 6px; margin-left: 6px; vertical-align: middle; }
  @media print { .page { max-width: none; } article.content a { color: #0b62c4; } }
`;

// Print pages are ~760 CSS px wide; request 1600 px CDN variants instead of
// the stored 3840 px URLs so exports don't download tens of megabytes.
function shrinkImageUrls(html) {
  return String(html || '').replace(/https?:\/\/[^"'\s>]+/g, (raw) => {
    try {
      const url = new URL(raw.replace(/&amp;/g, '&'));
      if (url.hostname !== 'assets.claude.com' && url.hostname !== 'images.ctfassets.net') return raw;
      for (const key of ['w', 'width']) {
        const value = Number(url.searchParams.get(key));
        if (Number.isFinite(value) && value > 1600) url.searchParams.set(key, '1600');
      }
      return url.href.replace(/&/g, '&amp;');
    } catch {
      return raw;
    }
  });
}

function buildHtml(article, lang) {
  const isZh = lang === 'zh';
  const title = isZh && article.title_zh ? article.title_zh : article.title || 'Untitled';
  const body = shrinkImageUrls(isZh ? article.translated_html : article.content_html);
  const site = article.site_name || '';
  const date = article.published_at ? fmtDateZh(article.published_at) : '';
  const description = article.excerpt ? `<p class="subtitle">${escapeHtml(article.excerpt)}</p>` : '';
  return `<!doctype html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<base href="${escapeHtml(article.url)}">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="page">
  <div class="kicker">${escapeHtml(site)}${article.category ? ' · ' + escapeHtml(article.category) : ''}</div>
  <h1 class="title">${escapeHtml(title)}${isZh ? '<span class="badge">中文</span>' : ''}</h1>
  ${description}
  <div class="meta">
    ${article.author ? `<span>${escapeHtml(article.author)}</span>` : ''}
    ${date ? `<span>${date}</span>` : ''}
    <span><a href="${escapeHtml(article.url)}">${escapeHtml(article.url)}</a></span>
  </div>
  <article class="content">${body || '<p>（正文为空）</p>'}</article>
  <div class="footer">
    <span>ASBA · AI 安全前沿研究聚合</span>
    <span>${isZh ? '中文译文' : '英文原文'} · 导出于 ${fmtDateZh(new Date().toISOString())}</span>
  </div>
</div>
</body>
</html>`;
}

async function waitForReady(win, timeoutMs = 25000) {
  // Chromium defers offscreen images; force them for the print snapshot.
  await win.webContents
    .executeJavaScript(
      `(async () => {
        const imgs = [...document.images];
        await Promise.all(imgs.map((img) => new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve(true);
          const pre = new Image();
          const done = () => resolve(true);
          pre.onload = () => { try { img.src = img.src; } catch (e) {} done(); };
          pre.onerror = done;
          pre.src = img.src;
          setTimeout(done, 9000);
        })));
        return imgs.length;
      })()`,
      true
    )
    .catch(() => 0);

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const pending = await win.webContents
      .executeJavaScript(`(async () => {
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
        return [...document.images].filter((i) => !i.complete).length;
      })()`, true)
      .catch(() => 0);
    if (!pending) return true;
    await sleep(400);
  }
  return false;
}

function uniquePath(dir, base) {
  let candidate = path.join(dir, base + '.pdf');
  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${i}).pdf`);
    i++;
  }
  return candidate;
}

let printWindow = null;

function getPrintWindow() {
  if (printWindow && !printWindow.isDestroyed()) return printWindow;
  printWindow = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: true },
  });
  return printWindow;
}

function disposePrintWindow() {
  try {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
  } catch { /* ignore */ }
  printWindow = null;
}

/**
 * @param {{article:object, lang:'en'|'zh', defaultDir:string, parent:Electron.BrowserWindow|null}} opts
 */
async function exportArticlePdf({ article, lang, defaultDir, parent, dirOverride }) {
  const titleForFile = (lang === 'zh' && article.title_zh ? article.title_zh : article.title) || 'article';
  const base = sanitizeFilename(titleForFile, 'article');
  let dir = dirOverride || null;
  let outPath = null;
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
  } else {
    const picked = await dialog.showSaveDialog(parent || undefined, {
      title: '导出 PDF',
      defaultPath: path.join(defaultDir || app.getPath('downloads'), `${base}.pdf`),
      buttonLabel: '保存',
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    if (picked.canceled || !picked.filePath) return { canceled: true };
    outPath = /\.pdf$/i.test(picked.filePath) ? picked.filePath : `${picked.filePath}.pdf`;
    dir = path.dirname(outPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmp = path.join(app.getPath('temp'), `asba-print-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmp, buildHtml(article, lang), 'utf8');

  const win = getPrintWindow();
  try {
    let loadErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await win.loadURL(pathToFileURL(tmp).href);
        loadErr = null;
        break;
      } catch (e) {
        loadErr = e;
        await sleep(350);
      }
    }
    if (loadErr) throw loadErr;
    await waitForReady(win);
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margins: { top: 0.55, bottom: 0.5, left: 0.6, right: 0.6 },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7px;color:#9ca3af;padding:0 14mm;display:flex;justify-content:space-between;font-family:'Microsoft YaHei',Arial,sans-serif;">
        <span>${escapeHtml(article.site_name || 'ASBA')}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    });
    if (!outPath) outPath = uniquePath(dir, base);
    fs.writeFileSync(outPath, pdf);
    return { canceled: false, path: outPath, dir };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch { /* ignore */ }
  }
}

module.exports = { exportArticlePdf, buildHtml, disposePrintWindow };

import React, { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  IconTranslate, IconDownload, IconExternal, IconRefresh, IconAlert, IconBook,
} from './Icons.jsx';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// The reader column is ~712 CSS px wide; 1280 px still covers high-DPI
// displays while keeping CDN payloads about a quarter of the 3840 px original.
const IMAGE_WIDTH = 1280;
const IMAGE_QUALITY = 80;

function resizeImageUrl(raw, width = IMAGE_WIDTH, quality = null) {
  if (!raw || /^(?:data:|blob:)/i.test(raw)) return raw;
  try {
    const u = new URL(raw, window.location.href);
    const host = u.hostname.toLowerCase();
    // Only adjust the two image CDNs known to accept arbitrary image widths.
    // Next.js image proxies can reject widths outside their configured list.
    if (host !== 'assets.claude.com' && host !== 'images.ctfassets.net') return u.href;

    for (const key of ['w', 'width']) {
      const current = Number(u.searchParams.get(key));
      if (Number.isFinite(current) && current > width) u.searchParams.set(key, String(width));
    }
    if (quality !== null) {
      const q = Number(u.searchParams.get('q'));
      if (Number.isFinite(q) && q > quality) u.searchParams.set('q', String(quality));
    }
    return u.href;
  } catch {
    return raw;
  }
}

function articleHtml(html, articleUrl) {
  if (!html) return '';
  const safe = DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel', 'colspan', 'rowspan', 'loading'] });
  const template = document.createElement('template');
  template.innerHTML = safe;
  for (const img of template.content.querySelectorAll('img')) {
    let source = img.getAttribute('src') || '';
    if (source && !/^(?:data:|blob:)/i.test(source)) {
      try { source = new URL(source, articleUrl || window.location.href).href; } catch { source = ''; }
    }
    img.dataset.asbaSource = source;
    const display = source ? resizeImageUrl(source, IMAGE_WIDTH, IMAGE_QUALITY) : '';
    img.dataset.asbaLo = display;
    if (display) img.setAttribute('src', display);
    else img.removeAttribute('src');
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  }
  return template.innerHTML;
}

// Some sites serve an SVG "canvas" that contains one bitmap with large empty
// padding (e.g. a label photo centered in a 780x695 box). Displayed as-is the
// image looks half empty. When the SVG is just one padded raster, show the
// raster itself, which is what the original layout crops to.
async function normalizePaddedSvg(img) {
  const source = img.dataset.asbaSource || '';
  if (!/\.svg(?:[?#]|$)/i.test(source)) return;
  try {
    const res = await fetch(source, { mode: 'cors' });
    if (!res.ok) return;
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return;
    const images = [...svg.querySelectorAll('image')];
    const others = [...svg.children].filter((el) => !['image', 'title', 'desc', 'metadata', 'defs', 'style'].includes(el.nodeName.toLowerCase()));
    if (images.length !== 1 || others.length) return;
    const node = images[0];
    const href = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
    if (!/^data:image\/(?:png|jpe?g|webp|gif)[;,]/i.test(href)) return;
    const box = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (box.length !== 4 || !box[2] || !box[3]) return;
    const w = Number(node.getAttribute('width')) || box[2];
    const h = Number(node.getAttribute('height')) || box[3];
    const coverage = (w * h) / (box[2] * box[3]);
    if (!(coverage > 0.05 && coverage < 0.9)) return;
    img.dataset.asbaLo = href;
    img.src = href;
  } catch { /* keep the original SVG */ }
}

function imageRetryCandidates(img) {
  const source = img.dataset.asbaSource || img.currentSrc || img.src;
  const candidates = [];
  const add = (u) => { if (u && !candidates.includes(u)) candidates.push(u); };
  for (const w of [1100, 800]) add(resizeImageUrl(source, w, 78));
  // Try the original URL last in case a CDN dislikes transformed parameters.
  add(source);
  return candidates;
}

export default function Reader({
  article,
  lang,
  setLang,
  translating,
  translateProgress,
  exporting,
  refetching,
  onTranslate,
  onExportPdf,
  onRefetch,
  onOpenOriginal,
}) {
  const html = article ? (lang === 'zh' ? article.translated_html : article.content_html) : '';
  const clean = useMemo(() => articleHtml(html, article?.url), [html, article?.url]);
  const [imageIssues, setImageIssues] = useState({ failed: 0, missing: 0 });
  const bodyRef = useRef(null);
  const readerScrollRef = useRef(null);
  const retryFailedImagesRef = useRef(null);

  useEffect(() => {
    if (readerScrollRef.current) readerScrollRef.current.scrollTop = 0;
    setImageIssues({ failed: 0, missing: 0 });
  }, [article?.id]);

  // Keep DOM loading authoritative: avoid creating a second request with
  // new Image() for every DOM image. A viewport margin lets Chromium load the
  // next images shortly before scrolling reaches them.
  useEffect(() => {
    const root = bodyRef.current;
    const scroller = readerScrollRef.current;
    if (!root || !scroller) return undefined;
    const imgs = Array.from(root.querySelectorAll('img'));
    if (!imgs.length) return undefined;

    const retryState = new WeakMap();
    const retrying = new WeakSet();
    const updateIssues = () => {
      const failed = imgs.filter((img) => img.classList.contains('img-failed')).length;
      const missing = imgs.filter((img) => img.classList.contains('img-missing')).length;
      setImageIssues((prev) => (prev.failed === failed && prev.missing === missing ? prev : { failed, missing }));
    };
    const markMissing = (img) => {
      img.classList.add('img-missing');
      if (!img.alt) img.alt = '图片地址缺失';
    };
    const markLoaded = (img) => {
      if (img.naturalWidth > 0) {
        retrying.delete(img);
        img.classList.remove('img-failed', 'img-retrying');
        img.classList.add('img-loaded');
        updateIssues();
      }
    };
    const markFailed = (img) => {
      retrying.delete(img);
      img.classList.remove('img-retrying');
      img.classList.add('img-failed');
      if (!img.alt) img.alt = '图片加载失败';
      updateIssues();
    };
    const handleError = (img) => {
      if (retrying.has(img)) return;
      const tried = retryState.get(img) || new Set([img.getAttribute('src') || '']);
      const next = imageRetryCandidates(img).find((u) => u && !tried.has(u));
      if (!next) {
        markFailed(img);
        return;
      }
      tried.add(next);
      retryState.set(img, tried);
      retrying.add(img);
      img.classList.add('img-retrying');
      img.src = next;
    };
    const onLoad = (e) => markLoaded(e.currentTarget);
    const onError = (e) => handleError(e.currentTarget);
    const nearViewport = (img) => {
      const box = img.getBoundingClientRect();
      const parent = scroller.getBoundingClientRect();
      return box.bottom >= parent.top - 900 && box.top <= parent.bottom + 900;
    };
    for (const img of imgs) {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      if (!img.dataset.asbaSource) {
        markMissing(img);
      } else if (img.complete && img.naturalWidth > 0) {
        markLoaded(img);
      } else if (img.complete && img.naturalWidth === 0 && img.currentSrc && nearViewport(img)) {
        // A cached/fast failure may happen before React's effect attaches its
        // listener. Recover visible failures instead of leaving broken icons.
        handleError(img);
      }
    }

    retryFailedImagesRef.current = () => {
      for (const img of imgs) {
        if (!img.classList.contains('img-failed')) continue;
        const source = img.dataset.asbaSource;
        if (!source) continue;
        retryState.delete(img);
        retrying.delete(img);
        img.classList.remove('img-failed', 'img-retrying', 'img-loaded');
        img.src = img.dataset.asbaLo || resizeImageUrl(source);
      }
      updateIssues();
    };
    updateIssues();

    // Normalize padded SVG wrappers (one embedded bitmap + empty canvas).
    let cancelled = false;
    for (const img of imgs) normalizePaddedSvg(img);

    // Background warm-up in document order, bounded concurrency, so scrolling
    // finds pictures ready instead of blank.
    const prefetchTimer = setTimeout(async () => {
      const queue = imgs.filter((img) => img.dataset.asbaSource && !img.classList.contains('img-missing'));
      let cursor = 0;
      const worker = async () => {
        while (!cancelled && cursor < queue.length) {
          const img = queue[cursor++];
          if (!img || img.complete) continue;
          img.loading = 'eager';
          await new Promise((resolve) => {
            if (img.complete) { resolve(); return; }
            let timer = 0;
            const done = () => {
              img.removeEventListener('load', done);
              img.removeEventListener('error', done);
              clearTimeout(timer);
              resolve();
            };
            timer = setTimeout(done, 12000);
            img.addEventListener('load', done);
            img.addEventListener('error', done);
          });
        }
      };
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    }, 400);

    // Geometry-based activation. IntersectionObserver stops delivering
    // callbacks while the window is occluded or backgrounded, which left
    // images permanently lazy until the next intersection. Scrolling and
    // layout checks below do not depend on that delivery.
    const VIEWPORT_MARGIN = 1200;
    let raf = 0;
    const activate = () => {
      raf = 0;
      const rootRect = scroller.getBoundingClientRect();
      for (const img of imgs) {
        if (img.loading === 'eager') continue;
        const rect = img.getBoundingClientRect();
        if (rect.bottom > rootRect.top - VIEWPORT_MARGIN && rect.top < rootRect.bottom + VIEWPORT_MARGIN) {
          img.loading = 'eager';
        }
      }
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(activate);
    };
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Initial pass, then re-check after fonts/images change layout.
    activate();
    const settleTimer = setTimeout(schedule, 600);
    const settleTimer2 = setTimeout(schedule, 2000);

    let observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target;
          img.loading = 'eager';
          const index = imgs.indexOf(img);
          if (index >= 0 && imgs[index + 1]) imgs[index + 1].loading = 'eager';
          observer.unobserve(img);
        }
      }, { root: scroller, rootMargin: `${VIEWPORT_MARGIN}px 0px`, threshold: 0 });
      imgs.forEach((img) => observer.observe(img));
    }

    return () => {
      cancelled = true;
      clearTimeout(prefetchTimer);
      observer?.disconnect();
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
      clearTimeout(settleTimer2);
      for (const img of imgs) {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      }
    };
  }, [article?.id, lang, clean]);

  if (!article) {
    return (
      <section className="reader">
        <div className="empty-reader">
          <IconBook size={30} />
          <div className="big">选择左侧文章开始阅读</div>
        </div>
      </section>
    );
  }

  const title = lang === 'zh' && article.title_zh ? article.title_zh : article.title;
  const hasTranslation = !!article.translated_html;
  const isChineseSource = article.lang === 'zh';
  const canTranslate = !isChineseSource && !!article.content_html;
  const date = fmtDate(article.published_at);
  const pct =
    translateProgress && translateProgress.total
      ? Math.min(100, Math.round((translateProgress.done / translateProgress.total) * 100))
      : 0;

  const onClickContent = (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (a && a.href && /^https?:/.test(a.href)) {
      e.preventDefault();
      window.asba.openExternal(a.href);
    }
  };

  return (
    <section className="reader">
      <div className="reader-top">
        <div className="seg">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
            原文
          </button>
          <button
            className={lang === 'zh' ? 'on' : ''}
            onClick={() => setLang('zh')}
            disabled={!hasTranslation}
            title={hasTranslation ? '查看译文' : '尚未翻译'}
          >
            译文
          </button>
        </div>
        <div className="reader-tools">
          {canTranslate ? (
            <button className="btn" onClick={onTranslate} disabled={translating}>
              {translating ? <span className="spinner" /> : <IconTranslate size={14} />}
              {translating ? '翻译中…' : hasTranslation ? '重新翻译' : '翻译成中文'}
            </button>
          ) : null}
          <button
            className="btn"
            onClick={() => onExportPdf(lang)}
            disabled={exporting || !html || (lang === 'zh' && !hasTranslation)}
          >
            {exporting ? <span className="spinner" /> : <IconDownload size={14} />}
            {exporting ? '导出中…' : '导出 PDF'}
          </button>
          <button className="icon-btn" title="打开原文" onClick={() => onOpenOriginal(article.url)}>
            <IconExternal size={15} />
          </button>
          <button
            className="icon-btn"
            title="重新抓取正文"
            onClick={onRefetch}
            disabled={refetching}
          >
            {refetching ? <span className="spinner" /> : <IconRefresh size={15} />}
          </button>
        </div>
      </div>

      {translating && translateProgress ? (
        <div className="sync-banner">
          <span className="spinner" />
          <span className="msg">
            {(translateProgress.message || '').startsWith('机器翻译') ? translateProgress.message : '大模型翻译中...'}
          </span>
          <span className="bar">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            {pct}%
          </span>
        </div>
      ) : null}

      <div className="reader-scroll" ref={readerScrollRef}>
        <div className="reader-inner">
          <div className="article-head">
            <div className="kicker">
              {article.site_name}
              {article.category ? <span>· {article.category}</span> : null}
              {lang === 'zh' ? <span className="badge orange">中文译文</span> : null}
            </div>
            <h1>{title}</h1>
            {article.excerpt && lang === 'en' ? <p className="excerpt">{article.excerpt}</p> : null}
            <div className="article-meta">
              {article.author ? <span>{article.author}</span> : null}
              {date ? <span>{date}</span> : null}
              {article.word_count ? <span>{article.word_count} 词</span> : null}
              <span>
                <a href={article.url} onClick={(e) => { e.preventDefault(); onOpenOriginal(article.url); }}>
                  原文链接
                </a>
              </span>

            </div>
          </div>

          {article.fetch_error ? (
            <div className="notice error">
              <IconAlert size={16} />
              <div>
                上次抓取失败：{article.fetch_error}
                <div style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={onRefetch}>重试抓取</button>
                </div>
              </div>
            </div>
          ) : null}

          {!article.content_html ? (
            <div className="notice warn">
              <IconAlert size={16} />
              <div>
                正文尚未抓取，可能还没同步完成。
                <div style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={onRefetch} disabled={refetching}>
                    {refetching ? '抓取中…' : '立即抓取正文'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {imageIssues.missing > 0 || imageIssues.failed > 0 ? (
            <div className="notice warn" style={{ marginBottom: 18 }}>
              <IconAlert size={16} />
              <div>
                {imageIssues.missing > 0 ? `有 ${imageIssues.missing} 张图片在本地缓存中缺少地址，需重新抓取正文恢复。` : null}
                {imageIssues.missing > 0 && imageIssues.failed > 0 ? ' ' : null}
                {imageIssues.failed > 0 ? `有 ${imageIssues.failed} 张图片加载失败。` : null}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {imageIssues.failed > 0 ? (
                    <button className="btn small" onClick={() => retryFailedImagesRef.current?.()}>
                      重新加载图片
                    </button>
                  ) : null}
                  {imageIssues.missing > 0 ? (
                    <button className="btn small" onClick={onRefetch} disabled={refetching}>
                      {refetching ? '抓取中…' : '重新抓取正文'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {clean ? (
            <article className="article-body" ref={bodyRef} onClick={onClickContent} dangerouslySetInnerHTML={{ __html: clean }} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

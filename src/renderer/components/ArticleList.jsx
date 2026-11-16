import React, { useEffect, useRef } from 'react';
import VendorMark from './VendorMark.jsx';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function ArticleList({
  rows, total, loading, selectedId, onSelect, title, hint,
  sites = [], activeSite = null, scrollToken = 0,
}) {
  const scrollRef = useRef(null);
  const headerRefs = useRef(new Map());

  // Sidebar clicks jump to the matching site section instead of filtering the
  // list, so the middle pane always shows every article grouped by site.
  useEffect(() => {
    if (!activeSite || !scrollToken) return;
    const header = headerRefs.current.get(activeSite);
    const scroller = scrollRef.current;
    if (!header || !scroller) return;
    const top = header.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - 4), behavior: 'smooth' });
  }, [activeSite, scrollToken]);

  const groups = sites
    .map((s) => ({ site: s, rows: rows.filter((a) => a.site_id === s.id) }))
    .filter((g) => g.rows.length > 0);
  const known = new Set(sites.map((s) => s.id));
  const orphan = rows.filter((a) => !known.has(a.site_id));
  if (orphan.length) groups.push({ site: { id: 'other', name: '其他', accent: '#888' }, rows: orphan });

  return (
    <section className="listpane">
      <div className="list-head">
        <h2>{title}</h2>
        <span className="count">{total} 篇</span>
      </div>
      {hint ? <div className="list-status">{hint}</div> : null}
      <div className="list-scroll" ref={scrollRef}>
        {loading && !rows.length ? (
          <div className="list-status">正在加载…</div>
        ) : null}
        {!loading && !rows.length ? (
          <div className="list-status">还没有文章。点击右上角「同步全部」开始抓取。</div>
        ) : null}
        {groups.map(({ site, rows: siteRows }) => (
          <div key={site.id} className="list-group">
            <div
              className="list-group-head"
              ref={(el) => {
                if (el) headerRefs.current.set(site.id, el);
                else headerRefs.current.delete(site.id);
              }}
            >
              <span className="list-group-logo"><VendorMark site={site} size={14} /></span>
              <span className="list-group-name">{site.name}</span>
              <span className="list-group-count">{siteRows.length} 篇</span>
            </div>
            {siteRows.map((a) => (
              <div
                key={a.id}
                className={'article-item' + (selectedId === a.id ? ' active' : '')}
                onClick={() => onSelect(a.id)}
              >
                <div className="ai-top">
                  <span>{fmtDate(a.published_at)}</span>
                  {a.category ? <span className="badge gray">{a.category}</span> : null}
                </div>
                <div className="ai-title">{a.title || a.url}</div>
                {a.excerpt ? <div className="ai-excerpt">{a.excerpt}</div> : null}
                <div className="ai-foot">
                  {a.translated ? <span className="badge green">中文译文</span> : null}
                  {a.fetch_error ? <span className="badge err">抓取失败</span> : null}
                  {!a.fetched_at ? <span className="badge">待抓取</span> : null}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

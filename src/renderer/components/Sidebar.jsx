import React from 'react';
import { IconRefresh } from './Icons.jsx';
import VendorMark from './VendorMark.jsx';

export default function Sidebar({ sites, activeSite, onSelect, onSync, syncingSite }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>厂商</span>
      </div>
      <div className="side-scroll">
        {sites.map((s) => (
          <div
            key={s.id}
            className={'side-item' + (activeSite === s.id ? ' active' : '') + (s.key === 'matrix' ? ' side-item-zh' : '')}
            onClick={() => onSelect(s.id)}
            title={s.index_url}
          >
            <span className="side-logo"><VendorMark site={s} /></span>
            <span className="side-name">{s.name}</span>
            <span className="side-count">{s.article_count}</span>
            <button
              className="side-sync"
              title="同步"
              disabled={!!syncingSite}
              onClick={(e) => {
                e.stopPropagation();
                onSync(s.id);
              }}
            >
              {syncingSite === s.id ? <span className="spinner" /> : <IconRefresh size={14} />}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

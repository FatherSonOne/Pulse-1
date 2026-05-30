// WorkingSetDock — right rail. The reframed clipboard: same
// searchClipboardService + search_clipboard backing, framed as "the set
// you're assembling." Quick note · clipped items (pin/delete) · notes↔
// categories toggle · expand/collapse · count badge · Export set.
//
// Behavior ported verbatim from the legacy clipboard sidebar. Neutral
// throughout — no coral (CLAUDE.md §4). "Export set" exports the dock as
// Markdown via the existing clipboard exporter (the only clipboard-typed
// export; CSV is SearchResult-typed).
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §4.6
import { Plus, Pin, X, Folder, StickyNote, Maximize2, Minimize2, Download } from 'lucide-react';
import { searchClipboardService } from '../../services/searchClipboardService';
import type { UseUnifiedSearch } from './useUnifiedSearch';
import { formatTimestamp, stripHtml } from './searchFormat';

interface WorkingSetDockProps {
  s: UseUnifiedSearch;
}

export default function WorkingSetDock({ s }: WorkingSetDockProps) {
  return (
    <div className="sw-dock-inner">
      <div className="sw-dock-head">
        <h3 className="sw-dock-title">
          Working Set
          {s.clipboardItems.length > 0 && <span className="sw-dock-badge">{s.clipboardItems.length}</span>}
        </h3>
        <div className="sw-dock-head-actions">
          <button type="button" className="sw-icon-btn"
            onClick={() => s.setClipboardView(v => v === 'notes' ? 'categories' : 'notes')}
            title={s.clipboardView === 'notes' ? 'Show categories' : 'Show notes'}
            aria-label="Toggle Working Set view">
            {s.clipboardView === 'notes' ? <Folder size={14} /> : <StickyNote size={14} />}
          </button>
          <button type="button" className="sw-icon-btn"
            onClick={() => s.setClipboardExpanded(v => !v)}
            title={s.clipboardExpanded ? 'Collapse' : 'Expand'}
            aria-label={s.clipboardExpanded ? 'Collapse Working Set' : 'Expand Working Set'}>
            {s.clipboardExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Quick note */}
      <div className="sw-dock-note">
        <input
          className="sw-dock-note-input"
          placeholder="Quick note… Enter to save"
          title="Quick note input"
          value={s.quickNoteText}
          onChange={e => s.setQuickNoteText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') s.handleQuickNote(); }}
          aria-label="Add quick note to Working Set"
        />
        <button type="button" className="sw-dock-note-add" onClick={s.handleQuickNote} title="Add note" aria-label="Add note">
          <Plus size={15} />
        </button>
      </div>

      {/* Items */}
      <div className="sw-dock-items">
        {s.clipboardItems.map(item => (
          <div key={item.id} className="sw-dock-card">
            <div className="sw-dock-card-row">
              <p className="sw-dock-card-title">{item.title}</p>
              <div className="sw-dock-card-actions">
                <button type="button" className="sw-dock-card-btn"
                  title={item.pinned ? 'Unpin' : 'Pin'} aria-label={item.pinned ? 'Unpin item' : 'Pin item'}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await searchClipboardService.updateClipboardItem(s.userId, item.id, { pinned: !item.pinned });
                    s.loadClipboardItems();
                  }}>
                  <Pin size={11} className={`sw-dock-pin ${item.pinned ? 'is-pinned' : ''}`} />
                </button>
                <button type="button" className="sw-dock-card-btn sw-dock-card-del"
                  title="Remove" aria-label="Remove item"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await searchClipboardService.deleteClipboardItem(s.userId, item.id);
                    s.loadClipboardItems();
                  }}>
                  <X size={11} />
                </button>
              </div>
            </div>
            <p className="sw-dock-card-preview">{stripHtml(item.content)}</p>
            <div className="sw-dock-card-meta">
              <span>{formatTimestamp(new Date(item.createdAt))}</span>
              {item.category && <span className="sw-dock-card-tag">{item.category}</span>}
            </div>
          </div>
        ))}

        {s.clipboardItems.length === 0 && (
          <div className="sw-dock-empty">
            <StickyNote size={26} className="sw-dock-empty-icon" />
            <p>Clip search results or<br />add quick notes here</p>
          </div>
        )}
      </div>

      {/* Export set */}
      {s.clipboardItems.length > 0 && (
        <div className="sw-dock-footer">
          <button type="button" className="sw-dock-export" onClick={() => s.handleExport('markdown')}>
            <Download size={13} /> Export set
          </button>
        </div>
      )}
    </div>
  );
}

// SearchWorkbench — flag-ON entry for the Search "Workbench" redesign.
//
// Phase 2: the real 3-column shell (facet cockpit · results · Working Set
// dock) + the working toolbar. The facet rail (Phase 3), dense results table
// (Phase 4), Cards/Map (Phase 5), and Working Set dock (Phase 6) are still
// region placeholders — the toolbar, view toggle, panel toggles, search,
// voice, operators, save, and export are all live now.
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §2, §5.1
import './search-workbench.css';
import { Table, LayoutGrid, MapPin } from 'lucide-react';
import { useUnifiedSearch } from './useUnifiedSearch';
import SearchToolbar from './SearchToolbar';
import { SaveSearchModal } from '../SaveSearchModal';

interface SearchWorkbenchProps {
  isDarkMode?: boolean;
}

export default function SearchWorkbench(_props: SearchWorkbenchProps = {}) {
  const s = useUnifiedSearch();

  return (
    <div className="search-workbench">
      <SearchToolbar s={s} />

      {/* Save-search modal (opened from the toolbar Bookmark) */}
      <SaveSearchModal
        isOpen={s.showSaveModal}
        onClose={() => s.setShowSaveModal(false)}
        query={s.searchQuery}
        filters={{ ...s.filters, types: s.selectedTypes.size > 0 ? Array.from(s.selectedTypes) : undefined }}
        userId={s.userId}
        onSaved={s.reloadSavedSearches}
      />

      <div
        className={`sw-body ${s.showFilters ? 'has-facets' : ''} ${s.showClipboard ? 'has-dock' : ''}`}
        style={{
          gridTemplateColumns: `${s.showFilters ? 'var(--sw-facet-w, 232px)' : '0px'} minmax(0, 1fr) ${s.showClipboard ? (s.clipboardExpanded ? '420px' : 'var(--sw-dock-w, 260px)') : '0px'}`,
        }}
      >
        {/* ── LEFT: facet cockpit (Phase 3) ──────────────────────────────── */}
        <aside className={`sw-facets ${s.showFilters ? '' : 'is-hidden'}`} aria-label="Filters">
          <div className="sw-region-placeholder">Facet cockpit — Phase 3</div>
        </aside>

        {/* ── CENTER: results ────────────────────────────────────────────── */}
        <main className="sw-results" id="search-main">
          {/* ARIA live region — result count announcements (preserved) */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sw-sr-only">
            {s.loading ? 'Searching…' : s.sortedResults.length > 0 ? `${s.sortedResults.length} results for "${s.searchQuery}"` : ''}
          </div>

          {/* Interim center: per-view placeholder. Table keeps a live result
              list so search remains demonstrable until Phase 4's dense table. */}
          {s.viewMode === 'table' && (
            <div className="sw-center-table">
              {s.searchQuery.trim() && !s.loading && (
                <p className="sw-interim-meta">
                  {s.sortedResults.length} result{s.sortedResults.length !== 1 ? 's' : ''}
                  {s.searchErrors.length > 0 && ` · ${s.searchErrors.length} source error${s.searchErrors.length !== 1 ? 's' : ''}`}
                </p>
              )}
              {!s.searchQuery.trim() && (
                <div className="sw-region-placeholder sw-center-empty">
                  Working memory — Phase 7
                </div>
              )}
              <ul className="sw-interim-list">
                {s.sortedResults.slice(0, s.visibleCount).map(r => (
                  <li key={r.id} className="sw-interim-row">
                    <span className="sw-interim-row-type">{r.type}</span>
                    <span className="sw-interim-row-title">{r.title}</span>
                    <span className="sw-interim-row-sender">{r.sender || ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.viewMode === 'cards' && (
            <div className="sw-region-placeholder sw-center-empty">
              <LayoutGrid size={18} /> Cards view — Phase 5
            </div>
          )}

          {s.viewMode === 'map' && (
            <div className="sw-region-placeholder sw-center-empty">
              <MapPin size={18} /> Map view — Phase 5
            </div>
          )}

          {s.viewMode !== 'table' && s.viewMode !== 'cards' && s.viewMode !== 'map' && (
            <div className="sw-region-placeholder sw-center-empty">
              <Table size={18} /> Results — Phase 4
            </div>
          )}
        </main>

        {/* ── RIGHT: Working Set dock (Phase 6) ──────────────────────────── */}
        <aside className={`sw-dock ${s.showClipboard ? '' : 'is-hidden'}`} aria-label="Working Set">
          <div className="sw-region-placeholder">Working Set — Phase 6</div>
        </aside>
      </div>
    </div>
  );
}

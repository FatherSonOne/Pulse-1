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
// Verbatim-reuse bridge: SearchResultCard (Cards) and SearchMapView (Map) are
// styled by the legacy sheet (--search-* vars + .result-*/.map rules). It only
// adds dead, non-colliding rules to the Workbench; Phase 11 migrates the
// still-needed card/map rules here before deleting the legacy component.
import '../UnifiedSearchRedesign.css';
import { useUnifiedSearch } from './useUnifiedSearch';
import SearchToolbar from './SearchToolbar';
import FacetCockpit from './FacetCockpit';
import ResultsTable from './ResultsTable';
import ResultsCards from './ResultsCards';
import SearchMapView from '../SearchMapView';
import { SaveSearchModal } from '../SaveSearchModal';
import { SearchDetailPanel } from '../SearchDetailPanel';

interface SearchWorkbenchProps {
  isDarkMode?: boolean;
}

export default function SearchWorkbench({ isDarkMode = false }: SearchWorkbenchProps = {}) {
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
        {/* ── LEFT: facet cockpit ────────────────────────────────────────── */}
        <aside className={`sw-facets ${s.showFilters ? '' : 'is-hidden'}`} aria-label="Filters">
          <FacetCockpit s={s} />
        </aside>

        {/* ── CENTER: results ────────────────────────────────────────────── */}
        <main className="sw-results" id="search-main">
          {/* ARIA live region — result count announcements (preserved) */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sw-sr-only">
            {s.loading ? 'Searching…' : s.sortedResults.length > 0 ? `${s.sortedResults.length} results for "${s.searchQuery}"` : ''}
          </div>

          {s.viewMode === 'table' && (
            s.isEmptyState
              ? <div className="sw-region-placeholder sw-center-empty">Working memory — Phase 7</div>
              : <ResultsTable s={s} />
          )}

          {s.viewMode === 'cards' && (
            s.isEmptyState
              ? <div className="sw-region-placeholder sw-center-empty">Working memory — Phase 7</div>
              : <ResultsCards s={s} />
          )}

          {s.viewMode === 'map' && (
            <SearchMapView
              results={s.sortedResults}
              center={s.geoCenter}
              isDarkMode={isDarkMode}
              onSelect={s.setDetailResult}
            />
          )}
        </main>

        {/* ── RIGHT: Working Set dock (Phase 6) ──────────────────────────── */}
        <aside className={`sw-dock ${s.showClipboard ? '' : 'is-hidden'}`} aria-label="Working Set">
          <div className="sw-region-placeholder">Working Set — Phase 6</div>
        </aside>
      </div>

      {/* Result detail panel — opened from a table row (click / Enter). */}
      <SearchDetailPanel
        result={s.detailResult}
        onClose={() => s.setDetailResult(null)}
        onClip={r => { s.handleClipResult(r); s.setDetailResult(null); }}
      />
    </div>
  );
}

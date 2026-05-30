// SearchWorkbench — flag-ON entry for the Search "Workbench" redesign.
//
// Phase 1 interim: a minimal surface that consumes useUnifiedSearch so the
// extracted controller can be exercised live (and so the dev v1⇄v2 toggle has
// something real to show). The full 3-col shell + toolbar lands in Phase 2,
// the facet cockpit in Phase 3, the dense table in Phase 4, etc. — each phase
// progressively replaces this interim body.
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md
import './search-workbench.css';
import { Search, Loader2 } from 'lucide-react';
import { useUnifiedSearch } from './useUnifiedSearch';

interface SearchWorkbenchProps {
  isDarkMode?: boolean;
}

export default function SearchWorkbench(_props: SearchWorkbenchProps = {}) {
  const s = useUnifiedSearch();

  return (
    <div className="search-workbench">
      <div className="sw-interim">
        <div className="sw-interim-banner" role="status">
          Search Workbench — building (Phase 1: controller wired). Full shell lands next.
        </div>

        <div className="sw-interim-input-row">
          <Search size={16} className="sw-interim-input-icon" aria-hidden="true" />
          <input
            ref={s.searchInputRef}
            className="sw-interim-input"
            placeholder="Search everything — messages, tasks, contacts, decisions…"
            value={s.searchQuery}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search across everything"
            onChange={e => s.setSearchQuery(e.target.value)}
          />
          {s.loading && <Loader2 size={16} className="sw-interim-spinner" aria-label="Searching" />}
        </div>

        {s.searchQuery.trim() && !s.loading && (
          <p className="sw-interim-meta">
            {s.sortedResults.length} result{s.sortedResults.length !== 1 ? 's' : ''}
            {s.searchErrors.length > 0 && ` · ${s.searchErrors.length} source error${s.searchErrors.length !== 1 ? 's' : ''}`}
          </p>
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
    </div>
  );
}

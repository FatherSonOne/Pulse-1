// ResultsHeader — chrome shared by the Table and Cards views: source-error
// badges, geo chip/error bar, the no-results state, the meta row (count ·
// Group · Sort), and the batch action toolbar. Kept view-agnostic so Table
// and Cards stay DRY. Neutral throughout — no coral (CLAUDE.md §4).
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §4.2, §4.3, §4.9
import { Search, MapPin } from 'lucide-react';
import { describeGeoFilter } from '../../services/geoSearchParser';
import type { UseUnifiedSearch, GroupMode } from './useUnifiedSearch';

interface ResultsHeaderProps {
  s: UseUnifiedSearch;
}

const GROUP_MODES: { id: GroupMode; label: string }[] = [
  { id: 'date',         label: 'Date' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'none',         label: 'None' },
];

function activeFilterCount(s: UseUnifiedSearch): number {
  const f = s.filters;
  let n = s.selectedTypes.size;
  if (f.dateFrom || f.dateTo) n += 1;
  if (f.sender) n += 1;
  if (f.source) n += 1;
  if (f.tags && f.tags.length) n += 1;
  if (f.priority) n += 1;
  return n;
}

export default function ResultsHeader({ s }: ResultsHeaderProps) {
  const results = s.sortedResults;
  const visible = results.slice(0, s.visibleCount);
  const filterCount = activeFilterCount(s);

  return (
    <>
      {/* Source error badges */}
      {s.searchErrors.length > 0 && (
        <div className="sw-source-errors">
          {s.searchErrors.map(err => (
            <span key={err.source} className="sw-source-error" title={err.error}>
              ⚠ {err.source === 'gmail' ? 'Gmail disconnected' : `${err.source} unavailable`}
            </span>
          ))}
        </div>
      )}

      {/* Geo chip / error bar */}
      {(s.activeGeoFilter || s.geoFilterError) && (
        <div className="sw-geo-bar" role="status">
          {s.activeGeoFilter && !s.geoFilterError && (
            <span className="sw-geo-chip"><MapPin size={12} />{describeGeoFilter(s.activeGeoFilter)}</span>
          )}
          {s.geoFilterError && <span className="sw-geo-error">{s.geoFilterError}</span>}
        </div>
      )}

      {/* No results */}
      {!s.loading && results.length === 0 && s.searchQuery.trim() && (
        <div className="sw-no-results">
          <Search size={22} className="sw-no-results-icon" />
          <h3>Nothing found for "{s.searchQuery}"</h3>
          <p>Try different keywords, or search by date, person, or topic.</p>
        </div>
      )}

      {/* Meta row: count · group · sort */}
      {results.length > 0 && (
        <div className="sw-meta-row">
          <p className="sw-meta-count">
            {Math.min(s.visibleCount, results.length)} of {results.length} result{results.length !== 1 ? 's' : ''}
            {filterCount > 0 && ` · ${filterCount} filter${filterCount !== 1 ? 's' : ''}`}
          </p>
          <div className="sw-meta-controls">
            <div className="sw-segmented" role="group" aria-label="Group results">
              <span className="sw-segmented-label">Group</span>
              {GROUP_MODES.map(g => (
                <button key={g.id} type="button"
                  className={`sw-segmented-btn ${s.groupMode === g.id ? 'is-active' : ''}`}
                  onClick={() => s.setGroupMode(g.id)}
                  aria-pressed={s.groupMode === g.id ? 'true' : 'false'}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="sw-segmented" role="group" aria-label="Sort results">
              <span className="sw-segmented-label">Sort</span>
              <button type="button"
                className={`sw-segmented-btn ${s.sort.field === 'timestamp' ? 'is-active' : ''}`}
                onClick={() => s.setSort({ field: 'timestamp', order: 'desc' })}
                aria-pressed={s.sort.field === 'timestamp' ? 'true' : 'false'}>
                Recent
              </button>
              <button type="button"
                className={`sw-segmented-btn ${s.sort.field === 'relevance' ? 'is-active' : ''}`}
                onClick={() => s.setSort({ field: 'relevance', order: 'desc' })}
                aria-pressed={s.sort.field === 'relevance' ? 'true' : 'false'}>
                Relevance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch action toolbar */}
      {s.selectedResults.size > 0 && (
        <div className="sw-batch-bar">
          <span className="sw-batch-count">{s.selectedResults.size} selected</span>
          <button type="button" className="sw-batch-btn" aria-label="Select all visible results"
            onClick={() => s.setSelectedResults(new Set(visible.map(r => r.id)))}>
            Select all
          </button>
          <button type="button" className="sw-batch-btn is-primary" onClick={s.handleBatchClip}>Clip all</button>
          <button type="button" className="sw-batch-btn" onClick={s.handleBatchExport}>Export CSV</button>
          <button type="button" className="sw-batch-btn is-ghost" onClick={() => s.setSelectedResults(new Set())}>Clear</button>
        </div>
      )}
    </>
  );
}

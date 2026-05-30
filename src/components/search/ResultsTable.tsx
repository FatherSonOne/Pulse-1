// ResultsTable — the center workbench surface (Table view).
//
// Shared chrome (errors/geo/meta/sort/batch/no-results) comes from
// ResultsHeader; this renders the sticky column header + grouped rows
// (Date lanes / Conversation / None via buildLanes) + infinite-scroll
// sentinel + skeleton. The scroll container carries the ported
// results-keydown handler; rows keep role="article"/tabIndex/data-result-id.
//
// Neutral throughout — no coral (CLAUDE.md §4).
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §4.3
import React from 'react';
import type { UseUnifiedSearch } from './useUnifiedSearch';
import { SearchResultSkeleton } from '../SearchResultSkeleton';
import ResultsHeader from './ResultsHeader';
import ResultRow from './ResultRow';
import { buildLanes } from './searchFormat';

interface ResultsTableProps {
  s: UseUnifiedSearch;
}

export default function ResultsTable({ s }: ResultsTableProps) {
  const results = s.sortedResults;
  const visible = results.slice(0, s.visibleCount);
  const lanes = buildLanes(s.groupMode, visible, s.groupedResults);

  return (
    <div className="sw-table-wrap">
      <ResultsHeader s={s} />

      {(results.length > 0 || s.loading) && (
        <div className="sw-table" role="search" aria-label="Search results" onKeyDown={s.handleResultsKeyDown}>
          {/* Sticky column header */}
          <div className="sw-col-header" aria-hidden="true">
            <span className="sw-col-select" />
            <span className="sw-col-type">Type</span>
            <span className="sw-col-subject">Subject</span>
            <span className="sw-col-person">Person</span>
            <span className="sw-col-when">When</span>
          </div>

          {lanes.map(lane => (
            <React.Fragment key={lane.key}>
              {lane.label && (
                <div className="sw-lane-header">
                  <span className="sw-lane-label">{lane.label}</span>
                  <span className="sw-lane-count">{lane.items.length}</span>
                </div>
              )}
              {lane.items.map(r => (
                <ResultRow
                  key={r.id}
                  result={r}
                  isSelected={s.selectedResults.has(r.id)}
                  isExpanded={s.expandedResultId === r.id}
                  onSelect={s.toggleResultSelect}
                  onDetail={s.setDetailResult}
                />
              ))}
            </React.Fragment>
          ))}

          {s.loading && <SearchResultSkeleton count={6} />}

          {!s.loading && s.visibleCount < results.length && (
            <div ref={s.sentinelRef} className="sw-scroll-sentinel" aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
}

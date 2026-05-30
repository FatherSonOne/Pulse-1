// ResultsCards — the secondary Cards view. Wraps the legacy SearchResultCard
// verbatim (select, badge, snippet, inline peek), honoring the same
// Date/Conversation/None grouping headers as the table. Shares ResultsHeader
// chrome. Cards keep role="article"/data-result-id so the ported keyboard
// handler works here too.
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §4.4
import React from 'react';
import type { UseUnifiedSearch } from './useUnifiedSearch';
import { SearchResultSkeleton } from '../SearchResultSkeleton';
import { SearchResultCard } from '../SearchResultCard';
import ResultsHeader from './ResultsHeader';
import { buildLanes } from './searchFormat';

interface ResultsCardsProps {
  s: UseUnifiedSearch;
}

export default function ResultsCards({ s }: ResultsCardsProps) {
  const results = s.sortedResults;
  const visible = results.slice(0, s.visibleCount);
  const lanes = buildLanes(s.groupMode, visible, s.groupedResults);

  return (
    <div className="sw-cards-wrap">
      <ResultsHeader s={s} />

      {(results.length > 0 || s.loading) && (
        <div className="sw-cards" role="search" aria-label="Search results" onKeyDown={s.handleResultsKeyDown}>
          {lanes.map(lane => (
            <React.Fragment key={lane.key}>
              {lane.label && (
                <div className="sw-lane-header sw-lane-header--cards">
                  <span className="sw-lane-label">{lane.label}</span>
                  <span className="sw-lane-count">{lane.items.length}</span>
                </div>
              )}
              {lane.items.map(r => (
                <SearchResultCard
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

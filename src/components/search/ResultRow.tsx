// ResultRow — one dense row of the Workbench results table.
// Columns: select · Type · Subject + inline preview · Person · When.
//
// MUST keep role="article", tabIndex={0}, and data-result-id so the ported
// results-keydown handler (↑↓ nav, → peek, ← collapse, Enter open, Esc) works
// unchanged (Invariant #5). Inline peek expands the row in place. Neutral
// throughout — no coral on selection/hover (CLAUDE.md §4).
//
// Spec: docs/SEARCH_WORKBENCH_REDESIGN_HANDOFF_2026-05-30.md §4.3
import React from 'react';
import { Check } from 'lucide-react';
import type { SearchResult } from '../../services/unifiedSearchService';
import { getResultIcon, formatTimestamp } from './searchFormat';

interface ResultRowProps {
  result: SearchResult;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onDetail: (result: SearchResult) => void;
}

const ResultRow = React.memo(function ResultRow({
  result, isSelected, isExpanded, onSelect, onDetail,
}: ResultRowProps) {
  const Icon = getResultIcon(result.type);
  const channelName = (result.metadata as any)?.channelName as string | undefined;
  const person = result.sender || result.senderEmail || channelName || '';
  const initial = person ? person.slice(0, 1).toUpperCase() : '';

  return (
    <div
      className={`sw-row ${isSelected ? 'is-selected' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      role="article"
      tabIndex={0}
      data-result-id={result.id}
      onClick={() => onDetail(result)}
      onKeyDown={e => { if (e.key === 'Enter') onDetail(result); }}
    >
      <div className="sw-row-main">
        <button
          type="button"
          className={`sw-row-select ${isSelected ? 'is-on' : ''}`}
          title={isSelected ? 'Deselect' : 'Select'}
          aria-label={isSelected ? 'Deselect result' : 'Select result'}
          aria-pressed={isSelected ? 'true' : 'false'}
          onClick={e => onSelect(result.id, e)}
        >
          {isSelected && <Check size={11} />}
        </button>

        <span className="sw-row-type" title={result.type.replace('_', ' ')}>
          <Icon size={12} />
          <span className="sw-row-type-label">{result.type.replace('_', ' ')}</span>
        </span>

        <span className="sw-row-subject">
          <span className="sw-row-title">{result.title}</span>
          {result.content && <span className="sw-row-preview">{result.content}</span>}
        </span>

        <span className="sw-row-person" title={person}>
          {initial && <span className="sw-row-avatar" aria-hidden="true">{initial}</span>}
          <span className="sw-row-person-name">{person}</span>
        </span>

        <span className="sw-row-when">{formatTimestamp(result.timestamp)}</span>
      </div>

      {/* Inline peek — ArrowRight expands; ← / Esc collapse; Enter opens panel. */}
      {isExpanded && (
        <div className="sw-row-peek">
          <p className="sw-row-peek-text">{result.content}</p>
          <div className="sw-row-peek-meta">
            {result.sender && (
              <span><span className="sw-row-peek-label">From</span> {result.sender}</span>
            )}
            {channelName && (
              <span><span className="sw-row-peek-label">Channel</span> {channelName}</span>
            )}
            <span className="sw-row-peek-hint">Enter to open · ← to collapse</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default ResultRow;

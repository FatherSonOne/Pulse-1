/**
 * CitationChip — inline `[n]` footnote chip (handoff Phase 3, P0).
 *
 * A small coral numbered chip that opens the cited source. Coral is on-budget
 * (citations are an AI-grounding surface, CLAUDE.md §4). Clicking calls back to
 * open the matched document in DocumentViewer with the cited passage
 * highlighted; when no matching document is found, it renders non-interactive.
 */

import React from 'react';

export interface CitationChipProps {
  n: number;
  /** Provided when the citation resolved to a known document. */
  onClick?: () => void;
  title?: string;
}

export const CitationChip: React.FC<CitationChipProps> = ({ n, onClick, title }) => {
  const interactive = !!onClick;
  return (
    <span
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick!();
              }
            }
          : undefined
      }
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        verticalAlign: 'middle',
        borderRadius: 4,
        background: 'var(--pulse-coral-bg-12)',
        color: 'var(--pulse-coral-fg)',
        fontFamily: 'var(--pulse-font-mono)',
        fontSize: 9,
        fontWeight: 600,
        lineHeight: 1,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background var(--pulse-duration) var(--pulse-ease)',
      }}
    >
      {n}
    </span>
  );
};

export default CitationChip;

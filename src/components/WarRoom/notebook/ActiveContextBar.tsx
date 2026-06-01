/**
 * ActiveContextBar — first-class "what's grounding the AI" strip.
 *
 * Promotes the formerly-faint active-context indicator into an always-visible
 * coral control at the top of the Sources pane. This is an AI-output surface
 * (it describes the AI's grounding), so coral is on-budget here (CLAUDE.md §4 /
 * handoff §4.2). Reads counts live from the store-derived props passed by
 * SourcesPane; toggling any source updates it in lockstep.
 *
 * Grounding contract (handoff invariant 2): `activeContextDocs.size === 0`
 * means "all docs ground the AI", so we surface that as "All N sources" rather
 * than "0 of N".
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

export interface ActiveContextBarProps {
  /** Completed docs currently in activeContextDocs. */
  activeCount: number;
  /** Total completed (ready) docs. */
  total: number;
  /** True when activeContextDocs.size === 0 → AI grounds on ALL docs. */
  usingAll: boolean;
}

export const ActiveContextBar: React.FC<ActiveContextBarProps> = ({
  activeCount,
  total,
  usingAll,
}) => {
  const grounded = total > 0 && (usingAll || activeCount > 0);

  const label =
    total === 0
      ? 'No sources grounding the AI yet'
      : usingAll
        ? `All ${total} source${total !== 1 ? 's' : ''} grounding the AI`
        : `${activeCount} of ${total} grounding the AI`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 12px',
        borderBottom: '1px solid var(--pulse-border)',
        background: grounded ? 'var(--pulse-coral-bg-08)' : 'transparent',
        flexShrink: 0,
      }}
    >
      <span
        className={grounded ? 'wr-data-pulse' : ''}
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: grounded ? 'var(--pulse-coral)' : 'var(--pulse-ink-3)',
          boxShadow: grounded ? '0 0 5px var(--pulse-coral)' : 'none',
        }}
      />
      <Sparkles
        size={12}
        style={{ color: grounded ? 'var(--pulse-coral-fg)' : 'var(--pulse-ink-3)', flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: grounded ? 'var(--pulse-coral-fg)' : 'var(--pulse-ink-3)',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default ActiveContextBar;

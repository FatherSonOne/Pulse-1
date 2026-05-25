import React from 'react';
import { Moment, MomentType } from './useConversationMoments';

/**
 * SpineNode — one message's cell on the Path D intelligence spine
 * (MESSAGES_REDESIGN_HANDOFF_2026-05-24, step 5). Renders the vertical
 * connector line plus either a small neutral dot (ordinary message) or a
 * tone-colored marker (a detected moment). Stacking nodes down the message
 * list forms the continuous "editorial spine".
 *
 * Presentational + host-agnostic: the conversation host renders one
 * <SpineNode> in each message row's left gutter, passing the moment (if any)
 * from detectMoments(). Styles + motion live in messages.css (.msg-spine-*).
 *
 * Tones are the status vocabulary, never coral (coral = AI output only):
 *   decision → positive · question → info · needs-reply → warning (+ pulse).
 */

interface SpineNodeProps {
  moment?: Moment;
  /** Message index in the list — drives the staggered entrance animation. */
  index: number;
  /** Trim the connector above the first / below the last node. */
  isFirst?: boolean;
  isLast?: boolean;
  className?: string;
}

const MOMENT_META: Record<MomentType, { tone: string; label: string }> = {
  decision: { tone: 'var(--pulse-tone-positive)', label: 'Decision' },
  question: { tone: 'var(--pulse-tone-info)', label: 'Open question' },
  'needs-reply': { tone: 'var(--pulse-tone-warning)', label: 'Needs reply' },
};

export const SpineNode: React.FC<SpineNodeProps> = ({
  moment,
  index,
  isFirst = false,
  isLast = false,
  className = '',
}) => {
  const meta = moment ? MOMENT_META[moment.type] : null;
  // Cap the stagger so long threads don't accumulate huge delays.
  const animationDelay = `${Math.min(index, 12) * 70}ms`;

  return (
    <div
      className={`msg-spine-cell ${className}`}
      role={meta ? 'img' : 'presentation'}
      aria-label={meta?.label}
    >
      <span
        className={`msg-spine-line ${isFirst ? 'is-first' : ''} ${isLast ? 'is-last' : ''}`}
        aria-hidden="true"
      />
      {meta ? (
        <span
          className={`msg-spine-moment ${moment!.type === 'needs-reply' ? 'msg-spine-moment--pulse' : ''}`}
          style={{ ['--spine-tone' as string]: meta.tone, animationDelay }}
          title={meta.label}
          aria-hidden="true"
        />
      ) : (
        <span className="msg-spine-dot" style={{ animationDelay }} aria-hidden="true" />
      )}
    </div>
  );
};

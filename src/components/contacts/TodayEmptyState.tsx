// ============================================
// TODAY EMPTY STATE
// Shown when the Today feed has no items. Recommends concrete next
// moves rather than declaring the work done (Pulse's operator is
// running ten things; "All caught up" is rarely true). Voice is
// chief-of-staff peer, not productivity blog.
// ============================================

import React, { useEffect, useState } from 'react';
import { RotateCw, Snowflake, Target } from 'lucide-react';

interface TodayEmptyStateProps {
  onRefresh?: () => void;
  /** Switch to People with the cold-leads smart list applied. */
  onShowColdContacts?: () => void;
  /** Open the goal modal for the most-at-risk top contact. */
  onSetCheckInGoal?: () => void;
}

export const TodayEmptyState: React.FC<TodayEmptyStateProps> = ({
  onRefresh,
  onShowColdContacts,
  onSetCheckInGoal,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center h-full py-12 px-6 text-center transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="max-w-md w-full">
        <h2
          className="text-2xl font-light text-zinc-900 dark:text-zinc-50 mb-2"
          style={{ letterSpacing: '-0.02em' }}
        >
          Today's clear.
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-8">
          Nothing on the feed right now. Two moves to keep the rest of the week light.
        </p>

        <div className="grid gap-3 text-left">
          {onShowColdContacts && (
            <button
              type="button"
              onClick={onShowColdContacts}
              className="group flex items-start gap-3 p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-rose-300 dark:hover:border-rose-400/40 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--pulse-tone-info-soft)' }}
              >
                <Snowflake className="w-4 h-4" style={{ color: 'var(--pulse-tone-info)' }} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  See who's gone cold
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Filter People by relationships you haven't touched in 30 days. One reply usually breaks the chill.
                </div>
              </div>
            </button>
          )}

          {onSetCheckInGoal && (
            <button
              type="button"
              onClick={onSetCheckInGoal}
              className="group flex items-start gap-3 p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-rose-300 dark:hover:border-rose-400/40 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--pulse-rose-soft)' }}
              >
                <Target className="w-4 h-4" style={{ color: 'var(--pulse-rose)' }} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Set a check-in goal
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Pick a top contact, choose a cadence. Pulse surfaces them on Today before they slip.
                </div>
              </div>
            </button>
          )}
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="mt-8 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
            style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
          >
            <RotateCw className="w-3 h-3" aria-hidden="true" />
            Check again
          </button>
        )}
      </div>
    </div>
  );
};

export default TodayEmptyState;

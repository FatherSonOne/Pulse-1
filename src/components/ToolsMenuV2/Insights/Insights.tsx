// src/components/ToolsMenuV2/Insights/Insights.tsx
// PR 3b — Surface 3 · slim Tools menu · Insights tile body.
//
// Same state-machine envelope as ThreadSummary, but the generated
// payload is a flat chip list (topic frequencies) plus a small set of
// highlight cards (unresolved questions, decisions made). No determinate
// progress — Insights is a fixed-shape extraction.
//
// Coral usage: ONE instance in this file (output card AI chip; the error
// state reuses the same chip — counted once).
//
// Future wiring: replace stubProvider in useInsights.ts with a call to
// the Supabase Gemini edge function.

import React, { useEffect, useMemo } from 'react';
import { X as XIcon, RotateCw } from 'lucide-react';
import AiChip from '../AiChip';
import InsightsSkeleton from './InsightsSkeleton';
import { useInsights } from './useInsights';
import type { ToolsMenuTileBodyProps } from '../types';
import { TOUCH_TARGET_PX, type InsightsProvider } from '../types';

interface InsightsProps extends ToolsMenuTileBodyProps {
  suggestionProvider?: InsightsProvider;
}

export const Insights: React.FC<InsightsProps> = ({
  threadId,
  messageCount,
  isDarkMode,
  suggestionProvider,
}) => {
  const { state, generate, cancel } = useInsights({
    threadId,
    messageCount,
    suggestionProvider,
  });

  // Auto-start on mount per the spec's flow (user already opted in).
  useEffect(() => {
    if (state.kind === 'idle') {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const announcement = useMemo(() => {
    if (state.kind === 'generated') {
      return `Insights ready. ${state.chips.length} topics across ${state.sourceMessages} messages.`;
    }
    if (state.kind === 'error') return `Insights failed. ${state.message}`;
    return '';
  }, [state]);

  const cardBg = isDarkMode
    ? 'bg-zinc-900/60 border-white/10'
    : 'bg-white border-black/10';

  return (
    <div className="space-y-3">
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      {state.kind === 'generating' ? (
        <div
          role="status"
          aria-live="polite"
          className={['rounded-xl border p-4 space-y-3', cardBg].join(' ')}
        >
          <InsightsSkeleton isDarkMode={isDarkMode} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={cancel}
              style={{ minHeight: TOUCH_TARGET_PX }}
              className={[
                'inline-flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                isDarkMode
                  ? 'text-zinc-300 hover:bg-white/5'
                  : 'text-zinc-600 hover:bg-black/5',
              ].join(' ')}
            >
              <XIcon size={14} aria-hidden="true" />
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {state.kind === 'generated' ? (
        <div className={['relative rounded-xl border p-4', cardBg].join(' ')}>
          {/* Coral usage #5: Insights output card chip */}
          <span className="absolute top-3 right-3">
            <AiChip decorative={false} />
          </span>
          <div className="flex flex-wrap gap-2 pr-14">
            {state.chips.map((chip) => (
              <span
                key={chip.id}
                className={[
                  'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                  isDarkMode
                    ? 'bg-white/5 text-zinc-200 border border-white/10'
                    : 'bg-black/[0.04] text-zinc-700 border border-black/[0.06]',
                ].join(' ')}
              >
                {chip.label}
              </span>
            ))}
          </div>
          {state.highlights.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {state.highlights.map((h) => (
                <li
                  key={h.id}
                  className={[
                    'rounded-lg p-3',
                    isDarkMode
                      ? 'bg-white/[0.03] border border-white/[0.06]'
                      : 'bg-black/[0.02] border border-black/[0.05]',
                  ].join(' ')}
                >
                  <p
                    className={[
                      'text-xs font-semibold uppercase tracking-wide',
                      isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
                    ].join(' ')}
                  >
                    {h.title}
                  </p>
                  <p
                    className={[
                      'mt-1 text-sm leading-relaxed',
                      isDarkMode ? 'text-zinc-100' : 'text-zinc-800',
                    ].join(' ')}
                  >
                    {h.detail}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          <div
            className={[
              'mt-4 pt-3 border-t flex items-center justify-between flex-wrap gap-2',
              isDarkMode ? 'border-white/10' : 'border-black/[0.06]',
            ].join(' ')}
          >
            <p
              className={[
                'text-[11px]',
                isDarkMode ? 'text-zinc-500' : 'text-zinc-500',
              ].join(' ')}
            >
              Patterns across {state.sourceMessages} messages
            </p>
            <button
              type="button"
              onClick={generate}
              style={{ minHeight: TOUCH_TARGET_PX }}
              className={[
                'inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                isDarkMode
                  ? 'text-zinc-200 hover:bg-white/5'
                  : 'text-zinc-700 hover:bg-black/5',
              ].join(' ')}
            >
              <RotateCw size={12} aria-hidden="true" />
              Regenerate
            </button>
          </div>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div
          role="alert"
          className={['relative rounded-xl border p-4', cardBg].join(' ')}
        >
          {/* AI chip persists on retry per spec — same coral consumer
              (Insights output card) in its error variant; not a new
              instance in the 4-token budget. */}
          <span className="absolute top-3 right-3">
            <AiChip decorative={false} />
          </span>
          <p
            className={[
              'text-sm pr-14',
              isDarkMode ? 'text-zinc-200' : 'text-zinc-800',
            ].join(' ')}
          >
            Couldn’t generate insights.{' '}
            <button
              type="button"
              onClick={generate}
              className="font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded-sm"
            >
              Try again
            </button>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default Insights;

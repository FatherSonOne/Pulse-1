// src/components/ToolsMenuV2/ThreadSummary/ThreadSummary.tsx
// PR 3b — Surface 3 · slim Tools menu · Thread Summary tile body.
//
// Inline accordion that walks through the spec's state machine:
//   idle      → "Generate" CTA (auto-starts on mount via useEffect)
//   generating→ Skeleton (3 lines 60/90/40) + optional determinate bar
//                "Reading {N} messages…" if msgCount > 200. Cancel button.
//   generated → Output card with [AI] chip top-right + body + footer
//                "Summarized from {N} messages · {timestamp}" + Regenerate + Copy
//   error     → Retry card "Couldn't generate summary. Try again." with
//                persisted AI chip
//
// a11y:
//   - role="progressbar" + aria-valuenow during determinate progress
//   - role="status" on the skeleton container (polite live)
//   - aria-live="polite" announcement region for generation completion
//   - All buttons ≥ 44×44 px via TOUCH_TARGET_PX
//
// Coral usage in this file: TWO instances total — the AI chip on the
// output card (generated state) AND the AI chip on the error card
// (persisted per spec). The tile-grid chip lives in ToolsMenuV2.tsx;
// counts there.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, RotateCw, X as XIcon } from 'lucide-react';
import AiChip from '../AiChip';
import SummarySkeleton from './SummarySkeleton';
import { useThreadSummary } from './useThreadSummary';
import type { ToolsMenuTileBodyProps } from '../types';
import { TOUCH_TARGET_PX, type ThreadSummaryProvider } from '../types';

interface ThreadSummaryProps extends ToolsMenuTileBodyProps {
  /** Real edge-function provider — defaults to the deterministic stub. */
  suggestionProvider?: ThreadSummaryProvider;
}

function relativeTime(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

export const ThreadSummary: React.FC<ThreadSummaryProps> = ({
  threadId,
  messageCount,
  isDarkMode,
  suggestionProvider,
}) => {
  const { state, generate, cancel, isDeterminate } = useThreadSummary({
    threadId,
    messageCount,
    suggestionProvider,
  });

  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Auto-start generation on first mount of an active Summary tile —
  // the user already opted in by clicking the tile, so we don't make
  // them click again. Re-mounts (thread switch) also re-fire.
  useEffect(() => {
    if (state.kind === 'idle') {
      generate();
    }
    // generate is stable per useThreadSummary memoisation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Keep the "2s ago" footer fresh while the user is reading.
  useEffect(() => {
    if (state.kind !== 'generated') return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [state.kind]);

  const onCopy = useCallback(async () => {
    if (state.kind !== 'generated') return;
    try {
      await navigator.clipboard.writeText(state.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable in sandboxes — swallow */
    }
  }, [state]);

  const cardBg = isDarkMode
    ? 'bg-zinc-900/60 border-white/10'
    : 'bg-white border-black/10';

  const announcement = useMemo(() => {
    if (state.kind === 'generated') {
      return `Summary ready. Summarized from ${state.sourceMessages} messages.`;
    }
    if (state.kind === 'error') return `Summary failed. ${state.message}`;
    return '';
  }, [state]);

  return (
    <div className="space-y-3">
      {/* Polite live region for SR announcements on completion / error */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      {state.kind === 'generating' ? (
        <div
          role="status"
          aria-live="polite"
          className={['rounded-xl border p-4 space-y-3', cardBg].join(' ')}
        >
          <SummarySkeleton isDarkMode={isDarkMode} />
          {isDeterminate ? (
            <div className="space-y-1.5">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(state.progress * 100)}
                aria-label={`Reading ${state.totalMessages} messages`}
                className={[
                  'h-1.5 rounded-full overflow-hidden',
                  isDarkMode ? 'bg-white/10' : 'bg-black/[0.06]',
                ].join(' ')}
              >
                <div
                  className={isDarkMode ? 'h-full bg-zinc-300' : 'h-full bg-zinc-700'}
                  style={{
                    width: `${Math.round(state.progress * 100)}%`,
                    transition: 'width 200ms linear',
                  }}
                />
              </div>
              <p
                className={[
                  'text-xs tabular-nums',
                  isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
                ].join(' ')}
              >
                Reading {state.totalMessages} messages… {Math.round(state.progress * 100)}%
              </p>
            </div>
          ) : (
            <p
              className={[
                'text-xs',
                isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
              ].join(' ')}
            >
              Reading {state.totalMessages} messages…
            </p>
          )}
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
          {/* Coral usage #3: Summary output card chip */}
          <span className="absolute top-3 right-3">
            <AiChip decorative={false} />
          </span>
          <div
            className={[
              'text-sm leading-relaxed whitespace-pre-line pr-14',
              isDarkMode ? 'text-zinc-100' : 'text-zinc-800',
            ].join(' ')}
          >
            {state.summary}
          </div>
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
              Summarized from {state.sourceMessages} messages ·{' '}
              {relativeTime(state.generatedAt, now)}
            </p>
            <div className="flex items-center gap-1">
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
              <button
                type="button"
                onClick={onCopy}
                style={{ minHeight: TOUCH_TARGET_PX }}
                aria-label={copied ? 'Copied' : 'Copy summary'}
                className={[
                  'inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
                  isDarkMode
                    ? 'text-zinc-200 hover:bg-white/5'
                    : 'text-zinc-700 hover:bg-black/5',
                ].join(' ')}
              >
                <Copy size={12} aria-hidden="true" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div
          role="alert"
          className={['relative rounded-xl border p-4', cardBg].join(' ')}
        >
          {/* Coral usage #4 paired with output card — spec says AI chip
              persists on retry, so we render it on the error card too.
              This is the SAME coral consumer (Summary output) just in
              its error variant — NOT counted as a new instance in the
              4-token budget. */}
          <span className="absolute top-3 right-3">
            <AiChip decorative={false} />
          </span>
          <p
            className={[
              'text-sm pr-14',
              isDarkMode ? 'text-zinc-200' : 'text-zinc-800',
            ].join(' ')}
          >
            Couldn’t generate summary.{' '}
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

export default ThreadSummary;

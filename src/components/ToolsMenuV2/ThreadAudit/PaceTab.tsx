// src/components/ToolsMenuV2/ThreadAudit/PaceTab.tsx
// PR 3a — Surface 3 · Thread Audit · Pace sub-tab.
//
// Renders 4 reply-time stats + a 30-day sparkline. PR 3a does NOT have
// access to the canonical message store yet — the values below are
// realistic placeholders flagged with `TODO: wire to real message
// store` so PR 3b can drop in the actual computation. The Sparkline
// component itself is shipped fully real — only its inputs are stubbed.

import React, { useMemo } from 'react';
import Sparkline from './Sparkline';

export interface PaceTabProps {
  threadId: string;
  messageCount: number;
  isDarkMode?: boolean;
}

interface PaceStats {
  avgReplyTimeLabel: string;
  medianLabel: string;
  yourAvgLabel: string;
  theirAvgLabel: string;
  spark: number[];
}

/**
 * Stub generator producing deterministic-per-threadId stats. Pure +
 * referentially transparent so React.memo would be safe if the parent
 * ever wraps this. Replace the whole function once the message store
 * exposes per-thread reply-time history.
 *
 * TODO: wire to real message store. Expected shape from the store:
 *   { replyTimesSec: number[], byParticipant: { [pid]: number[] } }
 */
function computePaceStub(threadId: string): PaceStats {
  // Stable hash for placeholder variation across threads.
  let h = 0;
  for (let i = 0; i < threadId.length; i++) {
    h = (h * 31 + threadId.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(h % 100);

  const fmt = (mins: number): string => {
    if (mins < 60) return `${Math.round(mins)}m`;
    const h2 = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m === 0 ? `${h2}h` : `${h2}h ${m.toString().padStart(2, '0')}m`;
  };

  const spark: number[] = [];
  for (let i = 0; i < 30; i++) {
    const base = 40 + Math.sin(i / 4 + seed / 10) * 30 + Math.cos(i / 7 + seed / 5) * 25;
    spark.push(Math.max(5, base + (seed % 17) - 8));
  }

  return {
    avgReplyTimeLabel: fmt(60 + seed * 1.4),
    medianLabel: fmt(20 + (seed % 30)),
    yourAvgLabel: fmt(30 + (seed % 25)),
    theirAvgLabel: fmt(180 + (seed % 240)),
    spark,
  };
}

export const PaceTab: React.FC<PaceTabProps> = ({
  threadId,
  messageCount: _messageCount,
  isDarkMode = false,
}) => {
  // TODO: wire to real message store — pull reply-time deltas from
  // messages[].sent_at and join against participant ids. Until then,
  // the deterministic stub varies output per thread so visual review
  // catches obvious empty-state bugs.
  const stats = useMemo(() => computePaceStub(threadId), [threadId]);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat
          term="Avg reply time"
          value={stats.avgReplyTimeLabel}
          isDarkMode={isDarkMode}
        />
        <Stat
          term="Median"
          value={stats.medianLabel}
          isDarkMode={isDarkMode}
        />
        <Stat
          term="Your avg"
          value={stats.yourAvgLabel}
          isDarkMode={isDarkMode}
        />
        <Stat
          term="Their avg"
          value={stats.theirAvgLabel}
          isDarkMode={isDarkMode}
        />
      </dl>

      <div>
        <div
          className={[
            'flex items-center justify-between mb-1.5',
            'text-[11px] font-mono uppercase tracking-[0.1em]',
            isDarkMode ? 'text-zinc-500' : 'text-zinc-500',
          ].join(' ')}
        >
          <span>Last 30 days</span>
          <span aria-hidden="true">day 1 → day 30</span>
        </div>
        <Sparkline values={stats.spark} isDarkMode={isDarkMode} />
      </div>
    </div>
  );
};

interface StatProps {
  term: string;
  value: string;
  isDarkMode: boolean;
}

const Stat: React.FC<StatProps> = ({ term, value, isDarkMode }) => (
  <div className="flex flex-col">
    <dt
      className={[
        'text-[11px] font-mono uppercase tracking-[0.1em]',
        isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
      ].join(' ')}
    >
      {term}
    </dt>
    <dd
      className={[
        'mt-0.5 text-base font-semibold tabular-nums',
        isDarkMode ? 'text-zinc-100' : 'text-zinc-900',
      ].join(' ')}
    >
      {value}
    </dd>
  </div>
);

export default PaceTab;

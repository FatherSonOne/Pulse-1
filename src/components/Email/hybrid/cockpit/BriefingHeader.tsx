// BriefingHeader — Cockpit's editorial top.
// Meta strip (date / counts) → serif headline → body + Start-Triage CTA → rule.
// Phase 2: consumes BriefingMeta from useCockpitData; falls back to mock when
// the hook hasn't produced data yet (loading / unconnected).
import React from 'react';
import { Layers } from 'lucide-react';
import { MOCK_BRIEFING } from '../data/mockEmails';
import type { BriefingMeta } from '../data/useCockpitData';

interface BriefingHeaderProps {
  compact?: boolean;
  meta?: BriefingMeta | null;
  triageQueueSize?: number;
  onStartTriage?: () => void;
  /** True briefly after a `pulse_focus_nudge` deep-link from Daily Overview. */
  nudgeFocused?: boolean;
}

export const BriefingHeader: React.FC<BriefingHeaderProps> = ({
  compact = false,
  meta,
  triageQueueSize,
  onStartTriage,
  nudgeFocused = false,
}) => {
  const m: BriefingMeta = meta ?? {
    greeting: MOCK_BRIEFING.greeting,
    dateStr: MOCK_BRIEFING.dateStr,
    newSinceMorning: MOCK_BRIEFING.newSinceMorning,
    needsYou: MOCK_BRIEFING.needsYou,
    batched: MOCK_BRIEFING.batched,
    headlineLead: MOCK_BRIEFING.headlineLead,
    headlineNames: MOCK_BRIEFING.headlineNames,
    body: MOCK_BRIEFING.body,
  };

  return (
    <div className={`px-6 pt-6 pb-5 md:px-10 md:pt-8 md:pb-6 ${compact ? '' : ''} border-b pulse-border-color`}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-rose-color">
          DAILY BRIEFING · {m.dateStr.toUpperCase()}
        </div>
        <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">
          {m.newSinceMorning} NEW SINCE 6 AM · {m.needsYou} NEED YOU · {m.batched} BATCHED
        </div>
      </div>

      <h1
        className={`cockpit-headline leading-[1.1] tracking-tight mb-3 ${
          compact ? 'text-[22px] md:text-[24px]' : 'text-[24px] md:text-[34px]'
        } ${nudgeFocused ? 'pulse-rose-color' : 'pulse-ink-color'}`}
        style={nudgeFocused ? { transition: 'color 1.5s ease' } : undefined}
      >
        {m.headlineLead}
        <br />
        <span className="pulse-ink-3-color italic">{m.headlineNames}</span>
      </h1>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13.5px] pulse-ink-2-color max-w-[520px] leading-relaxed flex-1 min-w-[280px]">
          {m.body}
        </p>
        {onStartTriage && (
          <button onClick={onStartTriage} className="triage-cta shrink-0" type="button">
            <span className="glow-dot" />
            <Layers className="w-4 h-4" />
            <span>Start triage</span>
            {triageQueueSize != null && triageQueueSize > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-pulse bg-white/20">
                {triageQueueSize} TO CLEAR
              </span>
            )}
          </button>
        )}
      </div>

      <div className="editorial-rule mt-6" />
    </div>
  );
};

export default BriefingHeader;

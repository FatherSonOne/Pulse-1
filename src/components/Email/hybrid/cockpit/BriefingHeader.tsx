// BriefingHeader — Cockpit's editorial top.
// Meta strip (date / counts) → serif headline → body + Start-Triage CTA → rule.
import React from 'react';
import { Layers } from 'lucide-react';
import { MOCK_BRIEFING, MOCK_EMAILS } from '../data/mockEmails';

interface BriefingHeaderProps {
  compact?: boolean;
  triageQueueSize?: number;
  onStartTriage?: () => void;
}

export const BriefingHeader: React.FC<BriefingHeaderProps> = ({
  compact = false,
  triageQueueSize,
  onStartTriage,
}) => {
  const newSince = MOCK_EMAILS.filter((e) => e.unread).length || MOCK_BRIEFING.newSinceMorning;

  return (
    <div className={`${compact ? 'px-6 pt-6 pb-5' : 'px-10 pt-8 pb-6'} border-b pulse-border-color`}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-rose-color">
          DAILY BRIEFING · {MOCK_BRIEFING.dateStr.toUpperCase()}
        </div>
        <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">
          {newSince} NEW SINCE 6 AM · {MOCK_BRIEFING.needsYou} NEED YOU · {MOCK_BRIEFING.batched} BATCHED
        </div>
      </div>

      <h1
        className={`cockpit-headline pulse-ink-color leading-[1.1] tracking-tight mb-3 ${
          compact ? 'text-[24px]' : 'text-[34px]'
        }`}
      >
        {MOCK_BRIEFING.headlineLead}
        <br />
        <span className="pulse-ink-3-color italic">{MOCK_BRIEFING.headlineNames}</span>
      </h1>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13.5px] pulse-ink-2-color max-w-[520px] leading-relaxed flex-1 min-w-[280px]">
          {MOCK_BRIEFING.body}
        </p>
        {onStartTriage && (
          <button onClick={onStartTriage} className="triage-cta shrink-0" type="button">
            <span className="glow-dot" />
            <Layers className="w-4 h-4" />
            <span>Start triage</span>
            {triageQueueSize != null && (
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

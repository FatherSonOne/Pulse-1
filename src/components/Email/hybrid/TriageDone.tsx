// TriageDone — end state: rose halo + serif headline + 3-stat card + actions.
// Per handoff §6 step 7: stats are static for Phase 3; Phase 4+ wires real
// per-session numbers.
import React from 'react';
import { Check } from 'lucide-react';

interface TriageDoneProps {
  onReset: () => void;
  onDismiss?: () => void;
  summary?: string;
}

export const TriageDone: React.FC<TriageDoneProps> = ({
  onReset,
  onDismiss,
  summary = 'You cleared the queue. Average ~14 sec per email — your fastest session this week.',
}) => (
  <div className="text-center max-w-[480px] fade-up">
    <div className="relative inline-flex items-center justify-center w-16 h-16 mb-5">
      <div className="done-halo w-16 h-16" />
      <div className="relative w-16 h-16 inline-flex items-center justify-center rounded-full pulse-rose-bg-soft-color pulse-rose-color">
        <Check className="w-7 h-7" />
      </div>
    </div>

    <h2
      className="text-3xl pulse-ink-color tracking-tight mb-2"
      style={{ fontFamily: 'var(--pulse-font-serif)', fontWeight: 500 }}
    >
      Queue cleared.
    </h2>
    <p className="pulse-ink-2-color mb-5 leading-relaxed">{summary}</p>

    <div className="inline-flex items-center gap-4 mb-6 px-4 py-2.5 rounded-xl pulse-coral-bg-08-color border pulse-border-color">
      <div className="text-left">
        <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">STREAK</div>
        <div className="text-[15px] pulse-ink-color tnum font-semibold">3 days</div>
      </div>
      <div className="w-px h-7" style={{ background: 'var(--pulse-border-strong)' }} />
      <div className="text-left">
        <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">AVG PER EMAIL</div>
        <div className="text-[15px] pulse-ink-color tnum font-semibold">14s</div>
      </div>
      <div className="w-px h-7" style={{ background: 'var(--pulse-border-strong)' }} />
      <div className="text-left">
        <div className="text-[10px] font-mono-pulse tracking-wide-mono pulse-ink-3-color">VS LAST WEEK</div>
        <div className="text-[15px] pulse-rose-color tnum font-semibold">−22%</div>
      </div>
    </div>

    <div className="flex items-center justify-center gap-3">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-2 rounded-lg pulse-rose-bg-color text-white text-[13px] font-medium"
        >
          Back to Cockpit
        </button>
      )}
      <button
        type="button"
        onClick={onReset}
        className="px-4 py-2 rounded-lg border pulse-border-color text-[13px] font-medium pulse-ink-color"
      >
        Run again
      </button>
    </div>
  </div>
);

export default TriageDone;

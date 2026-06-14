// TriageDone — end state: rose halo + serif headline + one editorial
// sentence + actions. Replaces the earlier streak / avg / vs-last-week
// triplet, which was a hero-metric template (an absolute ban in
// DESIGN.md) and a habit-tracker register the brand explicitly rejects.
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
  summary = 'Queue cleared — your inbox is quiet for now.',
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
    <p className="pulse-ink-2-color mb-6 leading-relaxed max-w-[400px] mx-auto">{summary}</p>

    <div className="flex items-center justify-center gap-3">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-2 rounded-lg pulse-rose-bg-color text-white text-[13px] font-medium transition-transform active:scale-[0.97]"
        >
          Back to Cockpit
        </button>
      )}
      <button
        type="button"
        onClick={onReset}
        className="px-4 py-2 rounded-lg border pulse-border-color text-[13px] font-medium pulse-ink-color transition-transform active:scale-[0.97]"
      >
        Run again
      </button>
    </div>
  </div>
);

export default TriageDone;

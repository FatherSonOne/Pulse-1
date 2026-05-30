/**
 * CaughtUp — the Triage empty state when the queue clears (handoff §4.3).
 * Offers the two forward moves: start a decision, or let Pulse AI line up
 * what's next. Both route to the create flows (wired in Phase 10).
 */
import { CheckCircle2, Plus, Sparkles } from 'lucide-react';

interface CaughtUpProps {
  onNewDecision: () => void;
  onAskAI: () => void;
}

export function CaughtUp({ onNewDecision, onAskAI }: CaughtUpProps) {
  return (
    <div className="ck-caughtup" role="status" aria-live="polite">
      <span className="ck-caughtup-badge"><CheckCircle2 size={30} /></span>
      <span className="ck-caughtup-eyebrow">Queue clear</span>
      <h3 className="ck-caughtup-title">You're caught up.</h3>
      <p className="ck-caughtup-sub">
        Nothing needs you right now. Plan ahead with a decision, or let Pulse AI line up what's next.
      </p>
      <div className="ck-caughtup-actions">
        <button type="button" className="ck-new" onClick={onNewDecision}>
          <Plus size={15} /> New decision
        </button>
        <button type="button" className="ck-caughtup-ghost" onClick={onAskAI}>
          <Sparkles size={15} /> Ask Pulse AI
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { AppView } from '../../types';
import { getPulseNudges, Nudge } from '../../services/pulseNudgesService';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';

interface PulseNudgesWidgetProps {
  workspaceId: string | null | undefined;
  authUserId: string | null | undefined;
  staleAwaitingReply: { contactName: string; ageDays: number; threadId: string } | null;
  setView: (view: AppView) => void;
  askQuery: string;
  setAskQuery: (s: string) => void;
  askResponse: string | null;
  setAskResponse: (s: string | null) => void;
  askLoading: boolean;
  onAsk: () => void;
}

// Receive-surface replacement for the old "Ask Pulse AI" send-surface. Three
// pieces, in priority order:
//  1. Top 3-4 nudges synthesized server-side once per dashboard mount
//  2. A small inline ask-anything field at the bottom as fallback
//  3. The answer panel (when the inline ask fires)
const PulseNudgesWidget: React.FC<PulseNudgesWidgetProps> = ({
  workspaceId,
  authUserId,
  staleAwaitingReply,
  setView,
  askQuery,
  setAskQuery,
  askResponse,
  setAskResponse,
  askLoading,
  onAsk,
}) => {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loadingNudges, setLoadingNudges] = useState(true);
  const [askFocused, setAskFocused] = useState(false);

  useEffect(() => {
    if (!workspaceId || !authUserId) {
      setLoadingNudges(false);
      return;
    }
    let active = true;
    void getPulseNudges({
      workspaceId,
      authUserId,
      staleAwaitingReply: staleAwaitingReply ?? null,
    })
      .then(rows => {
        if (active) setNudges(rows);
      })
      .catch(err => {
        console.warn('[PulseNudgesWidget] nudges load failed', err);
        if (active) setNudges([]);
      })
      .finally(() => {
        if (active) setLoadingNudges(false);
      });
    return () => { active = false; };
  }, [workspaceId, authUserId, staleAwaitingReply?.threadId, staleAwaitingReply?.ageDays]);

  const dispatchNudge = (nudge: Nudge): void => {
    const { cta } = nudge;
    if (cta.focusNoteId) {
      sessionStorage.setItem('pulse_focus_note', cta.focusNoteId);
    }
    if (cta.focusDecisionId) {
      sessionStorage.setItem('pulse_focus_decision', cta.focusDecisionId);
    }
    if (cta.event) {
      window.dispatchEvent(new CustomEvent(cta.event.type, { detail: cta.event.detail }));
      return;
    }
    if (cta.view) {
      setView(cta.view);
    }
  };

  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-xl p-5 border border-zinc-200 dark:border-white/[0.06] transition-colors duration-150">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-rose-500 dark:text-rose-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pulse Nudges</h3>
        </div>
        <AIProvenanceChip vendor="PULSE AI" type="NUDGES" />
      </div>

      {loadingNudges ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-400 dark:text-zinc-500" />
        </div>
      ) : nudges.length === 0 ? (
        <p className="px-1 py-4 text-xs text-zinc-500 dark:text-zinc-400">
          Nothing to flag. You're caught up.
        </p>
      ) : (
        <ul className="space-y-px mb-3" aria-live="polite">
          {nudges.map(n => (
            <li key={n.id} className="flex items-start gap-3 px-1 py-2 group">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-2" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">{n.text}</p>
                <button
                  data-strip-row
                  onClick={() => dispatchNudge(n)}
                  className="pulse-label text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded mt-1"
                >
                  {n.cta.label}
                  <span aria-hidden="true"> →</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Tiny inline ask — fallback for "I want to ask anything else." Not the
          primary affordance anymore. */}
      <form
        onSubmit={(e) => { e.preventDefault(); onAsk(); }}
        className="pt-3 border-t border-zinc-100 dark:border-white/[0.06]"
      >
        <div className="relative">
          <input
            type="text"
            value={askQuery}
            onChange={(e) => setAskQuery(e.target.value)}
            onFocus={() => setAskFocused(true)}
            onBlur={() => { if (!askQuery.trim()) setAskFocused(false); }}
            placeholder="Ask Pulse AI anything"
            className={`w-full bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-lg px-3 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/20 focus:outline-none transition-all pr-9 ${
              askFocused ? 'py-3' : 'py-2'
            }`}
            style={{ transitionDuration: '200ms', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
          <button
            type="submit"
            disabled={askLoading || !askQuery.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            aria-label="Send"
          >
            {askLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </form>

      {askResponse && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06] animate-fade-in">
          <AIProvenanceChip vendor="PULSE AI" type="ANSWER" className="mb-2" />
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 line-clamp-4">{askResponse}</p>
          <div className="flex items-center justify-between mt-2.5">
            <button
              onClick={() => setView(AppView.LIVE_AI)}
              className="pulse-label text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
            >
              OPEN PULSE AI →
            </button>
            <button
              onClick={() => setAskResponse(null)}
              className="pulse-label text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded"
            >
              CLEAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PulseNudgesWidget;

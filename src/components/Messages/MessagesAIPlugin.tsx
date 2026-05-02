/**
 * MessagesAIPlugin
 *
 * Phase 5d.5 — AI affordances for `MessagesSplitView`.
 *
 * Per the audit: AI in legacy `Messages.tsx` isn't a single component —
 * it's a network of effects + state driving multiple disparate UI
 * surfaces (catch-up card, nudge bar, draft hint, async suggestion,
 * team health, handoff card). Trying to migrate the whole thing as one
 * plugin would mean rewriting the orchestration.
 *
 * What this plugin DOES extract — the most-trafficked, most-extractable
 * surfaces:
 *
 *   1. `useMessagesAIContext()` — hook that runs per-conversation AI
 *      fetches (catch-up summary, thread context, team health, nudge)
 *      on conversation change. Returns `{ catchUp, threadContext,
 *      teamHealth, nudge, isLoading }`.
 *
 *   2. `useMessagesAIDraft()` — hook that runs draft analysis +
 *      meeting-intent detection on input change with an 800ms debounce.
 *      Returns `{ draftAnalysis, asyncSuggestion }`.
 *
 *   3. `<MessagesCatchUpCard />` — presentational component for the
 *      catch-up summary. Renders summary + decisions + blockers +
 *      action items in a dismissible card.
 *
 *   4. `<MessagesNudgeBar />` — presentational component for an AI
 *      coaching nudge ("follow up with X", "consider de-escalating", etc.).
 *
 * What's deliberately deferred:
 *   - Handoff card (deeply tied to outcome state — Phase 5d.6 territory).
 *   - Team health badge (small surface, no real plugin value).
 *   - The Phase 3-11 "MessageEnhancements" bundle (Phase 5d.6).
 *   - Smart reply panel (already its own component in MessageEnhancements).
 *
 * All AI calls go through `geminiService` which is in turn routed
 * through `ai-router` server-side (per Sessions 2-3). Trial caps and
 * usage limits are enforced automatically — no extra plumbing needed.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  generateCatchUpSummary,
  generateThreadContext,
  generateNudge,
  analyzeTeamHealth,
  analyzeDraftIntent,
  detectMeetingIntent,
} from '../../services/geminiService';
import type {
  AsyncSuggestion,
  CatchUpSummary,
  DraftAnalysis,
  Nudge,
  TeamHealth,
  ThreadContext,
} from '../../types';

// ──────────────────────────────────────────────────────────────
// Hook: per-conversation AI context (catch-up, nudge, team health)
// ──────────────────────────────────────────────────────────────

interface UseMessagesAIContextOptions {
  /** Stable conversation id — refetches when it changes. */
  conversationId: string | null;
  /** Whatever shape the host wants to feed as conversation history.
   *  Typically `messages.map(m => \`${sender}: ${text}\`).join('\n')`. */
  conversationHistory: string;
  /** Skip all AI fetches. Use this to gate by feature flag, trial
   *  status, or if the active conversation is a bot chat. */
  enabled?: boolean;
  /** Skip the catch-up summary specifically. The legacy gates this on
   *  unread count or message count > 5; pass that decision in. */
  shouldFetchCatchUp?: boolean;
  /** Deprecated — kept for back-compat with legacy callers; the router
   *  manages provider keys server-side. */
  apiKey?: string;
}

interface MessagesAIContextResult {
  catchUp: CatchUpSummary | null;
  threadContext: ThreadContext | null;
  teamHealth: TeamHealth | null;
  nudge: Nudge | null;
  isLoading: boolean;
  /** Force refetch (e.g. after the user sends a message). */
  refetch: () => void;
}

export function useMessagesAIContext({
  conversationId,
  conversationHistory,
  enabled = true,
  shouldFetchCatchUp = true,
  apiKey,
}: UseMessagesAIContextOptions): MessagesAIContextResult {
  const [catchUp, setCatchUp] = useState<CatchUpSummary | null>(null);
  const [threadContext, setThreadContext] = useState<ThreadContext | null>(null);
  const [teamHealth, setTeamHealth] = useState<TeamHealth | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refetchTick, setRefetchTick] = useState(0);
  // Track in-flight fetches so we can ignore stale responses on
  // rapid conversation switching.
  const fetchIdRef = useRef(0);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  useEffect(() => {
    // Reset state on conversation change to avoid showing stale AI
    // output from a previous thread.
    setCatchUp(null);
    setThreadContext(null);
    setTeamHealth(null);
    setNudge(null);

    if (!enabled || !conversationId || !conversationHistory) return;

    const id = ++fetchIdRef.current;
    const key = apiKey ?? '';

    setIsLoading(true);
    void Promise.all([
      shouldFetchCatchUp ? generateCatchUpSummary(key, conversationHistory) : Promise.resolve(null),
      generateThreadContext(key, conversationHistory),
      analyzeTeamHealth(key, conversationHistory),
      generateNudge(key, conversationHistory),
    ])
      .then(([catchUpResult, ctx, health, nudgeResult]) => {
        if (id !== fetchIdRef.current) return; // stale
        if (catchUpResult) setCatchUp(catchUpResult);
        if (ctx) setThreadContext(ctx);
        if (health) setTeamHealth(health);
        if (nudgeResult) setNudge(nudgeResult);
      })
      .catch((err) => {
        console.error('[MessagesAI] context fetch failed:', err);
      })
      .finally(() => {
        if (id === fetchIdRef.current) setIsLoading(false);
      });
  }, [conversationId, conversationHistory, enabled, shouldFetchCatchUp, apiKey, refetchTick]);

  return { catchUp, threadContext, teamHealth, nudge, isLoading, refetch };
}

// ──────────────────────────────────────────────────────────────
// Hook: draft analysis + meeting-intent detection
// ──────────────────────────────────────────────────────────────

interface UseMessagesAIDraftOptions {
  /** Current draft text. */
  draft: string;
  /** Skip all draft AI. */
  enabled?: boolean;
  /** Debounce in ms before firing. Defaults to 800. */
  debounceMs?: number;
  /** Minimum draft length before firing. Defaults to 6. */
  minLength?: number;
  /** Deprecated — router manages keys. */
  apiKey?: string;
}

interface MessagesAIDraftResult {
  draftAnalysis: DraftAnalysis | null;
  asyncSuggestion: AsyncSuggestion | null;
  /** Manually clear both signals (e.g., after the user accepts or
   *  dismisses the suggestion, or after sending). */
  clear: () => void;
}

export function useMessagesAIDraft({
  draft,
  enabled = true,
  debounceMs = 800,
  minLength = 6,
  apiKey,
}: UseMessagesAIDraftOptions): MessagesAIDraftResult {
  const [draftAnalysis, setDraftAnalysis] = useState<DraftAnalysis | null>(null);
  const [asyncSuggestion, setAsyncSuggestion] = useState<AsyncSuggestion | null>(null);
  const timerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const clear = useCallback(() => {
    setDraftAnalysis(null);
    setAsyncSuggestion(null);
  }, []);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!enabled || draft.length < minLength) {
      setDraftAnalysis(null);
      setAsyncSuggestion(null);
      return;
    }

    const id = ++requestIdRef.current;
    const key = apiKey ?? '';

    timerRef.current = window.setTimeout(async () => {
      try {
        const [analysis, deflection] = await Promise.all([
          analyzeDraftIntent(key, draft),
          detectMeetingIntent(key, draft),
        ]);
        if (id !== requestIdRef.current) return; // stale

        // Filter weak / social-only signals — same heuristic as legacy.
        if (analysis && analysis.confidence > 0.7 && analysis.intent !== 'social') {
          setDraftAnalysis(analysis);
        } else {
          setDraftAnalysis(null);
        }
        if (deflection?.detected) {
          setAsyncSuggestion(deflection);
        } else {
          setAsyncSuggestion(null);
        }
      } catch (err) {
        console.error('[MessagesAI] draft analysis failed:', err);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [draft, enabled, debounceMs, minLength, apiKey]);

  return { draftAnalysis, asyncSuggestion, clear };
}

// ──────────────────────────────────────────────────────────────
// Component: catch-up summary card
// ──────────────────────────────────────────────────────────────

interface MessagesCatchUpCardProps {
  catchUp: CatchUpSummary;
  onDismiss?: () => void;
  className?: string;
}

export const MessagesCatchUpCard: React.FC<MessagesCatchUpCardProps> = ({
  catchUp,
  onDismiss,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(true);

  const hasDecisions = catchUp.decisionsMade?.length > 0;
  const hasBlockers = catchUp.blockers?.length > 0;
  const hasActions = catchUp.actionItems?.length > 0;

  return (
    <div
      className={`bg-zinc-50 dark:bg-white/[0.03] ring-1 ring-zinc-200 dark:ring-white/[0.06] rounded-xl p-4 ${className}`}
      role="region"
      aria-label="Catch-up summary"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-rose-500/15 ring-1 ring-rose-500/30 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-rose-500 dark:text-rose-bright" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            PULSE AI · CATCH UP
          </div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Catch up
            </h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse' : 'Expand'}
                className="p-1 rounded hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                {expanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
              </button>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Dismiss catch-up"
                  className="p-1 rounded hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  <X className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {catchUp.summary}
          </p>

          {expanded && (hasDecisions || hasBlockers || hasActions) && (
            <div className="mt-3 space-y-2">
              {hasDecisions && (
                <CatchUpSection
                  icon={<CheckCircle2 className="w-3 h-3" />}
                  label="Decisions"
                  items={catchUp.decisionsMade}
                  tone="emerald"
                />
              )}
              {hasBlockers && (
                <CatchUpSection
                  icon={<Zap className="w-3 h-3" />}
                  label="Blockers"
                  items={catchUp.blockers}
                  tone="amber"
                />
              )}
              {hasActions && (
                <CatchUpSection
                  icon={<ListChecks className="w-3 h-3" />}
                  label="Action items"
                  items={catchUp.actionItems}
                  tone="blue"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CatchUpSection: React.FC<{
  icon: React.ReactNode;
  label: string;
  items: string[];
  tone: 'emerald' | 'amber' | 'blue';
}> = ({ icon, label, items, tone }) => {
  const toneClasses = {
    emerald: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/[0.08] ring-1 ring-emerald-500/30',
    amber: 'text-amber-700 dark:text-amber-400 bg-amber-500/[0.08] ring-1 ring-amber-500/30',
    blue: 'text-blue-700 dark:text-blue-400 bg-blue-500/[0.08] ring-1 ring-blue-500/30',
  }[tone];

  return (
    <div>
      <div className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] font-medium px-2 py-0.5 rounded ${toneClasses}`}>
        {icon}
        {label}
      </div>
      <ul className="mt-1 space-y-0.5 pl-1">
        {items.map((item, i) => (
          <li
            key={`${label}-${i}`}
            className="text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-1.5"
          >
            <span className="text-rose-400 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Component: nudge bar
// ──────────────────────────────────────────────────────────────

interface MessagesNudgeBarProps {
  nudge: Nudge;
  onAccept?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const NUDGE_LABELS: Record<Nudge['type'], string> = {
  follow_up: 'Follow up',
  clarify: 'Clarify',
  de_escalate: 'De-escalate',
  praise: 'Recognize',
};

const NUDGE_TONES: Record<Nudge['type'], string> = {
  follow_up: 'ring-1 ring-blue-500/30 bg-blue-500/[0.06] dark:bg-blue-500/[0.08] text-blue-700 dark:text-blue-300',
  clarify: 'ring-1 ring-amber-500/30 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] text-amber-700 dark:text-amber-300',
  de_escalate: 'ring-1 ring-rose-500/30 bg-rose-500/[0.06] dark:bg-rose-500/[0.08] text-rose-700 dark:text-rose-300',
  praise: 'ring-1 ring-emerald-500/30 bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300',
};

export const MessagesNudgeBar: React.FC<MessagesNudgeBarProps> = ({
  nudge,
  onAccept,
  onDismiss,
  className = '',
}) => (
  <div
    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${NUDGE_TONES[nudge.type]} ${className}`}
    role="status"
    aria-label={`Nudge: ${NUDGE_LABELS[nudge.type]}`}
  >
    <div className="flex-shrink-0">
      {nudge.type === 'follow_up' && <Bell className="w-4 h-4" />}
      {nudge.type === 'clarify' && <Brain className="w-4 h-4" />}
      {nudge.type === 'de_escalate' && <Sparkles className="w-4 h-4" />}
      {nudge.type === 'praise' && <CheckCircle2 className="w-4 h-4" />}
    </div>
    <div className="flex-1 min-w-0">
      <span className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium opacity-70 mr-2">PULSE AI · {NUDGE_LABELS[nudge.type].toUpperCase()}</span>
      <span className="text-xs opacity-90">{nudge.message}</span>
    </div>
    <div className="flex items-center gap-1 flex-shrink-0">
      {onAccept && (
        <button
          type="button"
          onClick={onAccept}
          className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] font-medium bg-transparent hover:bg-white/40 dark:hover:bg-white/[0.06] rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
        >
          Apply
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss nudge"
          className="p-1 rounded hover:bg-white/40 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  </div>
);

export default {
  useMessagesAIContext,
  useMessagesAIDraft,
  MessagesCatchUpCard,
  MessagesNudgeBar,
};

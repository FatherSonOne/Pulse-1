// useTriageQueue — pure selector exposing the live Triage queue.
// The actual freeze (deriving queueIds from emailStore.emails on session start)
// lives in EmailHybridClient so only one component owns the side effect.
// Both EmailHybridClient (for Cockpit's clearedIds / triageRemaining) and
// TriageView (for the focal card) call this hook.
import { useMemo } from 'react';
import { useEmailStore } from '../../../../store/emailStore';
import { useEmailUIStore } from '../../../../store/emailUIStore';
import { cachedEmailToRow, type EmailRow } from './emailRow';
import type { CachedEmail } from '../../../../services/emailSyncService';

/** Priority cutoff — emails below this score don't enter the queue. */
export const TRIAGE_PRIORITY_THRESHOLD = 60;

/** Hard cap on a single triage session (handoff §5.5 — 20 feels great). */
export const TRIAGE_LIMIT = 20;

export interface TriageQueueData {
  /** Frozen at session start. Length is the queue counter denominator. */
  queueIds: string[];
  idx: number;
  /** View-model for the email at the current idx, or null if unresolvable. */
  currentRow: EmailRow | null;
  remaining: number;
  /** 0–100 percentage shown on the progress rail. */
  progress: number;
  isDone: boolean;
  /** Items already dispatched in the current session — used for CLEARED pips. */
  clearedIds: string[];
  /** Items remaining in the queue (positional slice from idx onward). */
  upcomingIds: string[];
}

/** Build a fresh queue from current inbox emails. Exported for the freeze effect. */
export function computeFreshTriageQueue(emails: CachedEmail[]): string[] {
  return emails
    .filter((e) => !e.is_read && (e.ai_priority_score || 0) >= TRIAGE_PRIORITY_THRESHOLD)
    .sort((a, b) => (b.ai_priority_score || 0) - (a.ai_priority_score || 0))
    .slice(0, TRIAGE_LIMIT)
    .map((e) => e.id);
}

export function useTriageQueue(): TriageQueueData {
  const emails = useEmailStore((s) => s.emails);
  const triageState = useEmailUIStore((s) => s.triageState);
  const triageQueueIds = useEmailUIStore((s) => s.triageQueueIds);

  return useMemo<TriageQueueData>(() => {
    const emailById = new Map(emails.map((e) => [e.id, e]));
    const idx = triageState.idx;
    const currentId = triageQueueIds[idx] ?? null;
    const currentCached = currentId ? emailById.get(currentId) || null : null;
    const currentRow = currentCached ? cachedEmailToRow(currentCached) : null;

    const total = triageQueueIds.length;
    const remaining = Math.max(0, total - idx);
    const progress = total === 0 ? 100 : (idx / total) * 100;
    const isDone = total > 0 && idx >= total;

    return {
      queueIds: triageQueueIds,
      idx,
      currentRow,
      remaining,
      progress,
      isDone,
      clearedIds: triageQueueIds.slice(0, idx),
      upcomingIds: triageQueueIds.slice(idx),
    };
  }, [emails, triageQueueIds, triageState.idx]);
}

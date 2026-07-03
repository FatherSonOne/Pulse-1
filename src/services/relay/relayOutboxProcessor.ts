// Relay outbox processor (app-dev sweep #1) — the drain loop that turns a
// durable, persisted recording into a delivered quick_vox message.
//
// Design:
//  * Single-flight: one drain runs at a time (`processing` guard), so a burst of
//    triggers (enqueue + online + interval) can't double-send an entry.
//  * Exponential backoff: a failed send reschedules with a growing delay rather
//    than hammering a flaky network. After MAX_AUTO_ATTEMPTS the entry parks in
//    'failed' and waits for an explicit user retry (never silently dropped).
//  * Connectivity-aware: skips work while offline and drains on the next 'online'.
//  * Event bus: emits sending/sent/failed by id so the UI can reconcile its
//    optimistic bubble without polling IndexedDB.
//
// Scope (this sweep): drives the Direct/quick_vox path via
// voxModeService.uploadAndSendQuickVox. Other Vox modes reuse this same outbox
// in a follow-up (#1b).

import { supabase } from '../supabase';
import { voxModeService } from './voxModeService';
import { relayOutbox, RelayOutboxEntry } from './relayOutbox';
import type { QuickVoxMessage } from './voxModeTypes';

export type OutboxEvent =
  | { type: 'sending'; id: string }
  | { type: 'sent'; id: string; message: QuickVoxMessage }
  | { type: 'failed'; id: string; entry: RelayOutboxEntry };

// Backoff schedule by attempt count (ms). Index 0 = first retry delay after the
// 1st failure, and so on. Length also sets the auto-retry ceiling.
const BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 300_000];
const MAX_AUTO_ATTEMPTS = BACKOFF_MS.length; // parks in 'failed' after this

let processing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
const listeners = new Set<(e: OutboxEvent) => void>();

/** Subscribe to outbox lifecycle events. Returns an unsubscribe fn. */
export function onOutboxEvent(cb: (e: OutboxEvent) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(e: OutboxEvent): void {
  listeners.forEach((l) => {
    try {
      l(e);
    } catch (err) {
      console.error('[relayOutbox] listener threw:', err);
    }
  });
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Drain every sendable entry for the current user once. Safe to call from any
 * trigger — re-entrant calls are collapsed by the `processing` guard.
 */
export async function processOutbox(): Promise<void> {
  if (processing) return;
  if (isOffline()) {
    // The 'online' listener will re-drive us; nothing to schedule.
    return;
  }
  processing = true;
  try {
    // getSession() reads the persisted session from local storage — no network,
    // so this resolves the sender id even right after coming back online (unlike
    // getUser(), whose token-validation round-trip returns null while offline and
    // broke the whole feature the first time round).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return; // not signed in — leave the queue intact for later

    const now = Date.now();
    const all = await relayOutbox.getAll(user.id);
    const sendable = all
      .filter(
        (e) =>
          e.status !== 'sending' &&
          e.attempts < MAX_AUTO_ATTEMPTS &&
          e.nextAttemptAt <= now,
      )
      // Oldest first so messages deliver in the order they were spoken.
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const entry of sendable) {
      await relayOutbox.update(entry.id, { status: 'sending' });
      emit({ type: 'sending', id: entry.id });

      let sent: QuickVoxMessage | null = null;
      try {
        sent = await voxModeService.uploadAndSendQuickVox(
          entry.recipientId,
          entry.blob,
          entry.duration,
          entry.transcript,
          entry.analysis,
        );
      } catch (err) {
        console.error('[relayOutbox] send threw:', err);
        sent = null;
      }

      if (sent) {
        // Remove BEFORE emitting so a listener that re-triggers the processor
        // can't pick this entry up again.
        await relayOutbox.remove(entry.id);
        emit({ type: 'sent', id: entry.id, message: sent });
        continue;
      }

      const attempts = entry.attempts + 1;
      const parked = attempts >= MAX_AUTO_ATTEMPTS;
      const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
      const updated: RelayOutboxEntry = {
        ...entry,
        attempts,
        lastError: 'send failed',
        // 'failed' = parked awaiting manual retry; 'pending' = will auto-retry.
        status: parked ? 'failed' : 'pending',
        nextAttemptAt: Date.now() + delay,
      };
      await relayOutbox.update(entry.id, {
        attempts: updated.attempts,
        lastError: updated.lastError,
        status: updated.status,
        nextAttemptAt: updated.nextAttemptAt,
      });
      emit({ type: 'failed', id: entry.id, entry: updated });
    }
  } finally {
    processing = false;
    await scheduleNextDrain();
  }
}

/**
 * Arm a single timer for the soonest future auto-retry, so a message that failed
 * with a backoff delay still gets picked up even with no other trigger.
 */
async function scheduleNextDrain(): Promise<void> {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (isOffline()) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  const all = await relayOutbox.getAll(user.id);
  const waiting = all.filter(
    (e) => e.status === 'pending' && e.attempts < MAX_AUTO_ATTEMPTS,
  );
  if (waiting.length === 0) return;

  const soonest = Math.min(...waiting.map((e) => e.nextAttemptAt));
  const delay = Math.max(0, soonest - Date.now());
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void processOutbox();
  }, delay);
}

/**
 * Force a parked ('failed') entry back into the auto-retry lane — the hook for a
 * user-facing "Retry" tap. Resets attempts so the backoff starts fresh.
 */
export async function retryOutboxEntry(id: string): Promise<void> {
  await relayOutbox.update(id, {
    status: 'pending',
    attempts: 0,
    nextAttemptAt: Date.now(),
    lastError: undefined,
  });
  void processOutbox();
}

/** Delete an entry the user has abandoned. */
export async function discardOutboxEntry(id: string): Promise<void> {
  await relayOutbox.remove(id);
}

/**
 * Wire connectivity triggers and run an initial drain. Idempotent — safe to call
 * from app bootstrap and again from a component mount. Should be invoked once at
 * app startup so queued messages deliver regardless of which screen is open.
 */
export function initRelayOutbox(): void {
  if (initialized) {
    void processOutbox();
    return;
  }
  initialized = true;
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void processOutbox());
  }
  void processOutbox();
}

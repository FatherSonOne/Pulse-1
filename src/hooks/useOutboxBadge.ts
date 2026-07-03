// useOutboxBadge — live count of the durable Relay send-outbox for the rail.
//
// The trust gap this closes: the durable outbox paints an optimistic bubble and
// an inline Retry INSIDE the open Direct thread, but a voice queued (or parked
// 'failed') for a contact you're NOT currently viewing — or while you sit in the
// Inbox — is otherwise invisible. This hook exposes a small {pending, failed}
// count so the SourcesRail can badge the Direct entry from any view, the way
// WhatsApp's global clock/exclamation does. Recomputes on every outbox
// lifecycle event; best-effort (never throws into the UI).

import { useEffect, useState } from 'react';
import { relayOutbox } from '../services/relay/relayOutbox';
import { onOutboxEvent, initRelayOutbox } from '../services/relay/relayOutboxProcessor';

export interface OutboxBadge {
  /** Still trying: 'pending' (awaiting/auto-retrying) + 'sending' (in flight). */
  pending: number;
  /** Parked after the auto-retry ceiling — needs an explicit user retry. */
  failed: number;
}

const EMPTY: OutboxBadge = { pending: 0, failed: 0 };

/**
 * @param userId auth uid (entries are scoped to the sender's auth uid at enqueue).
 */
export function useOutboxBadge(userId: string | null | undefined): OutboxBadge {
  const [badge, setBadge] = useState<OutboxBadge>(EMPTY);

  useEffect(() => {
    if (!userId) {
      setBadge(EMPTY);
      return;
    }
    let cancelled = false;

    const recompute = async () => {
      try {
        const all = await relayOutbox.getAll(userId);
        if (cancelled) return;
        let pending = 0;
        let failed = 0;
        for (const e of all) {
          if (e.status === 'failed') failed += 1;
          else pending += 1; // 'pending' | 'sending'
        }
        setBadge({ pending, failed });
      } catch {
        /* best-effort — a badge is never worth surfacing an error for */
      }
    };

    const unsub = onOutboxEvent(() => void recompute());
    void recompute();
    // Arm the processor (idempotent) so counts drain even if no thread is open.
    try {
      initRelayOutbox();
    } catch {
      /* noop */
    }

    return () => {
      cancelled = true;
      unsub();
    };
  }, [userId]);

  return badge;
}

export default useOutboxBadge;

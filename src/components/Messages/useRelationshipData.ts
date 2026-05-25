/**
 * useRelationshipData — host-agnostic derivation for the Path D
 * "relationship rail" (MESSAGES_REDESIGN_HANDOFF_2026-05-24, step 4).
 *
 * The rail is "the messenger that remembers the relationship": open items,
 * the last decision, and reply pace for the active contact. Pulse has two
 * Messages surfaces (legacy monolith + V2 MessagesSplitView) with different
 * message models (PulseMessage / legacy Message / ChannelMessage), so this
 * module works on a single normalized `RailMessage` shape. Each host maps its
 * native messages to RailMessage[] and the derivation produces the rail's
 * read-only data.
 *
 * Data availability is honest, not faked:
 *   - pace            — always derivable (timestamps + direction)
 *   - open items      — only where the message model carries a task ref
 *   - last decision   — only where the message model carries a decision
 * Pulse DMs (PulseMessage) and V2 (ChannelMessage) currently carry neither
 * task nor decision data, so those surfaces show pace + the "all clear"
 * empty state. Wiring open-items / decisions to the real Decisions & Tasks
 * surface per-contact is the documented follow-up.
 */

export interface RailMessage {
  id: string;
  /** true = the current user ("you") sent it; false = the other party. */
  isOutbound: boolean;
  /** epoch milliseconds. */
  timestamp: number;
  /** message body text. Optional — the rail doesn't need it, but the Path D
   *  intelligence spine's question heuristic does (see useConversationMoments). */
  text?: string;
  /** present when this message spawned an inline task (the task title). */
  taskTitle?: string;
  /** present when this message carries a decision/proposal. */
  decision?: {
    text: string;
    status: 'open' | 'approved' | 'rejected';
    type: 'proposal' | 'final';
  };
}

export interface OpenItem {
  id: string;
  title: string;
}

export interface LastDecision {
  id: string;
  text: string;
  status: 'open' | 'approved' | 'rejected';
}

export interface Pace {
  /** mean time you take to reply to them, in ms; null when no data. */
  youReplyMs: number | null;
  /** mean time they take to reply to you, in ms; null when no data. */
  themReplyMs: number | null;
  /** total messages exchanged — the relationship's volume. */
  volume: number;
}

export interface RelationshipData {
  openItems: OpenItem[];
  lastDecision: LastDecision | null;
  pace: Pace;
}

/**
 * Derive the rail's read-only data from a normalized message list. Pure and
 * order-independent (sorts defensively by timestamp).
 */
export function deriveRelationship(messages: RailMessage[]): RelationshipData {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  // Open items — messages that spawned a task.
  const openItems: OpenItem[] = sorted
    .filter((m) => m.taskTitle && m.taskTitle.trim().length > 0)
    .map((m) => ({ id: m.id, title: m.taskTitle!.trim() }));

  // Last decision — most recent message carrying one.
  let lastDecision: LastDecision | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const d = sorted[i].decision;
    if (d) {
      lastDecision = { id: sorted[i].id, text: d.text, status: d.status };
      break;
    }
  }

  // Pace — mean reply latency across direction changes (a "reply" is a message
  // whose sender differs from the message before it).
  let youSum = 0;
  let youCount = 0;
  let themSum = 0;
  let themCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.isOutbound === cur.isOutbound) continue; // same speaker, not a reply
    const delta = cur.timestamp - prev.timestamp;
    if (delta <= 0) continue;
    if (cur.isOutbound) {
      youSum += delta;
      youCount += 1;
    } else {
      themSum += delta;
      themCount += 1;
    }
  }

  return {
    openItems,
    lastDecision,
    pace: {
      youReplyMs: youCount ? Math.round(youSum / youCount) : null,
      themReplyMs: themCount ? Math.round(themSum / themCount) : null,
      volume: sorted.length,
    },
  };
}

/** Format a reply latency for display: "<1m", "28m", "1h 02m", "—" for null. */
export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem ? `${hours}h ${rem.toString().padStart(2, '0')}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

import { RailMessage } from './useRelationshipData';

/**
 * useConversationMoments — detection for the Path D intelligence spine
 * (MESSAGES_REDESIGN_HANDOFF_2026-05-24, step 5).
 *
 * The spine surfaces AI-detected "moments" inline in the conversation. This is
 * **Phase 1: deterministic + conservative** (the handoff's "high-confidence
 * only") — no AI dependency, anchored to specific message ids. A Phase 2
 * `ai-router`-backed detector will augment/replace these with model-found
 * decisions and questions (returning the same { messageId, type, confidence }
 * shape), so callers won't change.
 *
 * Reuses the rail's normalized `RailMessage` so one adapted message array feeds
 * both the relationship rail and the spine.
 *
 * Heuristics (a message gets at most one moment; precedence
 * decision > needs-reply > question):
 *   - decision    — message carries structured decision data (legacy threads).
 *   - needs-reply — the conversation currently ends on an inbound message with
 *                   no outbound after it (the single trailing unanswered turn).
 *   - question    — an inbound message whose text ends in '?' with no outbound
 *                   reply after it (an unanswered question).
 */

export type MomentType = 'decision' | 'question' | 'needs-reply';

export interface Moment {
  messageId: string;
  type: MomentType;
  /** 0..1. Heuristics are conservative by construction; Phase 2 AI sets real
   *  model confidence and callers can threshold on it. */
  confidence: number;
}

const QUESTION_RE = /\?\s*$/;

function endsWithQuestion(text?: string): boolean {
  return !!text && QUESTION_RE.test(text.trim());
}

/**
 * Detect inline moments anchored to message ids. Pure and order-independent
 * (sorts defensively by timestamp). Returns a Map keyed by message id.
 */
export function detectMoments(messages: RailMessage[]): Map<string, Moment> {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const moments = new Map<string, Moment>();

  // decision — structured decision data present (highest precedence).
  for (const m of sorted) {
    if (m.decision) {
      moments.set(m.id, { messageId: m.id, type: 'decision', confidence: 1 });
    }
  }

  // Index of the last outbound message — anything inbound after it is unanswered.
  let lastOutboundIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].isOutbound) {
      lastOutboundIdx = i;
      break;
    }
  }

  // needs-reply — the conversation ends on an inbound message.
  const last = sorted[sorted.length - 1];
  if (last && !last.isOutbound && !moments.has(last.id)) {
    moments.set(last.id, { messageId: last.id, type: 'needs-reply', confidence: 0.9 });
  }

  // question — unanswered inbound questions (no outbound after them).
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (m.isOutbound || moments.has(m.id)) continue;
    if (!endsWithQuestion(m.text)) continue;
    const answered = i < lastOutboundIdx; // an outbound exists after this message
    if (!answered) {
      moments.set(m.id, { messageId: m.id, type: 'question', confidence: 0.7 });
    }
  }

  return moments;
}

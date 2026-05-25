import { useEffect, useMemo, useRef, useState } from 'react';
import { processWithModel } from '../../services/geminiService';
import { RailMessage } from './useRelationshipData';

/**
 * useConversationMoments — detection for the Path D intelligence spine
 * (MESSAGES_REDESIGN_HANDOFF_2026-05-24, step 5).
 *
 * The spine surfaces AI-detected "moments" inline in the conversation:
 *
 *   - Phase 1 (`detectMoments`) — deterministic + conservative heuristics, no
 *     AI dependency, anchored to specific message ids. Painted immediately.
 *   - Phase 2 (`detectMomentsAI`) — an `ai-router`-backed detector that returns
 *     model-found decisions / questions / needs-reply with real confidence,
 *     in the same { messageId, type, confidence } shape. Server-side only
 *     (routes through processWithModel → ai-router; no client API key).
 *
 * `useConversationMoments` orchestrates the two: heuristics render instantly,
 * then the AI result is merged in when it resolves (heuristics are the fallback
 * on any AI failure). Callers receive a Map<id, Moment> exactly as before.
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

// ── Phase 2: ai-router-backed detection ──────────────────────────────────────

/** Cap the transcript sent to the model (mirrors conversationIntelligence's 50). */
const MAX_AI_MESSAGES = 60;
/** Per-message text clamp — keeps token cost bounded on long messages. */
const MAX_TEXT_LEN = 280;
/** Conservative floor: drop any moment the model is not reasonably sure about. */
const AI_CONFIDENCE_FLOOR = 0.6;

const VALID_TYPES: ReadonlySet<string> = new Set<MomentType>([
  'decision',
  'question',
  'needs-reply',
]);

function stripCodeFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

/** Parse a JSON array from a model response, tolerating fences / prose wrapping. */
function parseJsonArray(raw: string): any[] | null {
  const cleaned = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Model wrapped the array in prose — extract the first [...] block.
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

/**
 * AI moment detection via the ai-router (server-side; no client API key).
 * Returns a Map<id, Moment> on success, or null on any failure / empty router
 * response so callers fall back to the heuristic `detectMoments`. Messages are
 * referenced to the model by a stable [index] (not their UUID) and mapped back
 * here, so the model never has to echo long ids.
 */
export async function detectMomentsAI(
  messages: RailMessage[],
): Promise<Map<string, Moment> | null> {
  if (messages.length < 2) return null;

  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const window = sorted.slice(-MAX_AI_MESSAGES);

  const transcript = window
    .map((m, i) => {
      const speaker = m.isOutbound ? 'Me' : 'Them';
      const text =
        (m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LEN) || '(no text)';
      return `[${i}] ${speaker}: ${text}`;
    })
    .join('\n');

  const prompt = `You are analyzing a one-to-one conversation to surface only HIGH-CONFIDENCE "moments" for an inline timeline. Be conservative — most messages are NOT moments.

Flag a message ONLY when it clearly matches one type:
- "decision": a concrete decision, agreement, or commitment is made or confirmed IN this message (e.g. "let's go with X", "approved", "we'll ship Friday").
- "question": this message asks a direct question that is still unanswered by any later message.
- "needs-reply": this is the latest message from the OTHER person ("Them") and clearly expects a response from "Me".

Rules:
- At most ONE moment per message; choose the strongest.
- Only include a moment with confidence >= 0.6. Prefer fewer, high-signal moments — aim for at most 5 total.
- "needs-reply" may apply to at most ONE message (the final unanswered "Them" message).
- Reference messages ONLY by their [index] number.

Conversation:
${transcript}

Return ONLY a JSON array, no prose and no markdown:
[{"index": 0, "type": "question", "confidence": 0.8}]
If there are no clear moments, return [].`;

  let raw: string | null;
  try {
    // The model arg is router-ignored (router picks per task); kept for intent.
    raw = await processWithModel(prompt, 'gemini-2.5-flash-lite');
  } catch (err) {
    console.error('[moments:ai] router call failed', err);
    return null;
  }
  if (!raw) return null;

  const parsed = parseJsonArray(raw);
  if (!parsed) return null;

  // 1. validate entries → window-relative candidates.
  type Candidate = { index: number; id: string; type: MomentType; confidence: number };
  const candidates: Candidate[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const index = (entry as any).index;
    const type = (entry as any).type;
    const confidence = typeof (entry as any).confidence === 'number' ? (entry as any).confidence : 0;
    if (!Number.isInteger(index) || index < 0 || index >= window.length) continue;
    if (!VALID_TYPES.has(type)) continue;
    if (confidence < AI_CONFIDENCE_FLOOR) continue;
    candidates.push({ index, id: window[index].id, type, confidence });
  }

  // 2. one moment per message (keep the higher-confidence claim).
  const byId = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = byId.get(c.id);
    if (!existing || c.confidence > existing.confidence) byId.set(c.id, c);
  }

  // 3. collapse needs-reply to the single latest message.
  const needsReply = [...byId.values()].filter((c) => c.type === 'needs-reply');
  if (needsReply.length > 1) {
    const keep = needsReply.reduce((a, b) => (b.index > a.index ? b : a));
    for (const c of needsReply) if (c.id !== keep.id) byId.delete(c.id);
  }

  const out = new Map<string, Moment>();
  for (const c of byId.values()) {
    out.set(c.id, { messageId: c.id, type: c.type, confidence: c.confidence });
  }
  return out;
}

/**
 * Merge heuristic + AI moment maps. AI augments/upgrades per message id;
 * structured decisions (heuristic confidence 1) are ground truth and always
 * win; needs-reply is constrained to the heuristic's single trailing-inbound
 * message (or dropped entirely when the conversation does not end on an
 * unanswered inbound, since any AI needs-reply elsewhere would be spurious).
 */
export function mergeMoments(
  heuristic: Map<string, Moment>,
  ai: Map<string, Moment> | null,
): Map<string, Moment> {
  if (!ai) return heuristic;

  const merged = new Map(heuristic);
  for (const [id, m] of ai) merged.set(id, m); // AI wins per message id

  // Structured decisions are facts, not guesses — never let AI drop them.
  for (const [id, m] of heuristic) {
    if (m.type === 'decision' && m.confidence === 1) merged.set(id, m);
  }

  // needs-reply is only valid on the heuristic's trailing-inbound message.
  let trailingId: string | null = null;
  for (const [id, m] of heuristic) {
    if (m.type === 'needs-reply') {
      trailingId = id;
      break;
    }
  }
  for (const [id, m] of [...merged]) {
    if (m.type === 'needs-reply' && id !== trailingId) merged.delete(id);
  }

  return merged;
}

export interface UseConversationMomentsOptions {
  /** Stable id of the active conversation — re-runs AI detection on change. */
  conversationId: string | null;
  /** Gate AI detection (e.g. off for bot chats or when no conversation is open).
   *  Heuristics still run regardless. Defaults to true. */
  enabled?: boolean;
  /** Skip the AI call below this message count (heuristics-only). Defaults to 4. */
  minMessages?: number;
  /** Debounce before the AI call. Defaults to 600ms. */
  debounceMs?: number;
}

/**
 * Hook form of the spine detector: heuristics painted synchronously, the
 * ai-router result merged in asynchronously (and cached per conversation
 * signature so re-opens are instant). Uses the MessagesAIPlugin stale-guard
 * pattern — a newer run always supersedes an in-flight one.
 */
export function useConversationMoments(
  messages: RailMessage[],
  {
    conversationId,
    enabled = true,
    minMessages = 4,
    debounceMs = 600,
  }: UseConversationMomentsOptions,
): Map<string, Moment> {
  const heuristic = useMemo(() => detectMoments(messages), [messages]);
  const [aiMoments, setAiMoments] = useState<Map<string, Moment> | null>(null);

  // Read latest messages without making the effect depend on array identity;
  // `signature` captures material change (conversation + size + last id).
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const reqIdRef = useRef(0);
  const cacheRef = useRef<Map<string, Map<string, Moment>>>(new Map());

  const lastId = messages.length ? messages[messages.length - 1].id : '';
  const signature = `${conversationId ?? ''}:${messages.length}:${lastId}`;

  useEffect(() => {
    // Drop stale AI output the instant the conversation / state changes.
    setAiMoments(null);

    if (!enabled || !conversationId || messages.length < minMessages) return;

    const cached = cacheRef.current.get(signature);
    if (cached) {
      setAiMoments(cached);
      return;
    }

    const reqId = ++reqIdRef.current;
    const timer = window.setTimeout(() => {
      void detectMomentsAI(messagesRef.current).then((result) => {
        if (reqId !== reqIdRef.current) return; // stale — superseded by a newer run
        if (result) {
          cacheRef.current.set(signature, result);
          setAiMoments(result);
        }
      });
    }, debounceMs);

    return () => window.clearTimeout(timer);
    // `signature` encodes conversationId + messages.length + last id; the rest
    // are primitives. messagesRef is read inside, intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, minMessages, debounceMs]);

  return useMemo(() => mergeMoments(heuristic, aiMoments), [heuristic, aiMoments]);
}

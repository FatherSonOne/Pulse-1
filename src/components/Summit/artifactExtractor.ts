/**
 * Heuristic classifier that turns a final transcript line into a structured
 * artifact (decision / task / question / reference) or returns null to skip.
 *
 * Intentionally conservative — false positives clutter the panel; false
 * negatives are fine because the user can manually add anything missed.
 *
 * References are NOT auto-extracted here; they will be populated by realtime
 * tool calls in a later phase. This keeps the classifier focused on the three
 * speech-derivable kinds.
 */

import type { ArtifactKind, SessionArtifact } from './voiceSessionStore';

const MIN_WORDS = 4;
const MAX_LEN = 280;

const DECISION_PATTERNS: RegExp[] = [
  /\b(we|i)('?ll| will| are going to| are gonna)?\s+(decide|decided|going with|go with)\b/i,
  /\b(decision|the call) is\b/i,
  /\b(agreed|confirmed|locked (it )?in|signed off)\b/i,
  /\b(let'?s|we'?ll) go with\b/i,
  /\bfinal (answer|call|decision)\b/i,
];

const TASK_PATTERNS: RegExp[] = [
  /^(i'?ll|i will|you'?ll|you will|we'?ll|we will)\s+\w+/i,
  /\b(todo|to-do|action item|follow[- ]?up)\b/i,
  /\b(need to|have to|must|should)\s+\w+/i,
  /\b(by|before|due) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next \w+|end of (day|week|month)|eod|eow)\b/i,
];

const QUESTION_PATTERNS: RegExp[] = [
  /\?\s*$/, // ends with question mark
  /\b(open question|tbd|unclear|need to (confirm|figure out|decide))\b/i,
  /\b(what|how|when|where|why|who|which) (do|does|did|will|would|should|are|is|can|could)\b/i,
];

const PRIORITY_HINTS: Array<[RegExp, 'urgent' | 'high' | 'medium']> = [
  [/\b(urgent|asap|right away|immediately)\b/i, 'urgent'],
  [/\b(important|high priority|priority)\b/i, 'high'],
];

const DATE_HINTS: Array<[RegExp, () => string]> = [
  [/\btomorrow\b/i, () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }],
  [/\beod|end of day\b/i, () => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }],
  [/\beow|end of week\b/i, () => {
    const d = new Date();
    d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7);
    return d.toISOString();
  }],
];

function classify(text: string): ArtifactKind | null {
  if (DECISION_PATTERNS.some((re) => re.test(text))) return 'decision';
  if (TASK_PATTERNS.some((re) => re.test(text))) return 'task';
  if (QUESTION_PATTERNS.some((re) => re.test(text))) return 'question';
  return null;
}

function extractMeta(kind: ArtifactKind, text: string): SessionArtifact['meta'] | undefined {
  if (kind !== 'task') return undefined;
  const meta: NonNullable<SessionArtifact['meta']> = {};
  for (const [re, level] of PRIORITY_HINTS) {
    if (re.test(text)) {
      meta.priority = level;
      break;
    }
  }
  for (const [re, build] of DATE_HINTS) {
    if (re.test(text)) {
      meta.dueDate = build();
      break;
    }
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

export interface ExtractInput {
  text: string;
  speaker: 'user' | 'assistant';
}

export interface ExtractResult {
  kind: ArtifactKind;
  content: string;
  meta?: SessionArtifact['meta'];
}

/**
 * Returns a typed candidate or null if the line shouldn't become an artifact.
 * Caller wraps it in a SessionArtifact (id, timestamp, source).
 */
export function extractArtifact(input: ExtractInput): ExtractResult | null {
  const trimmed = input.text.trim();
  if (!trimmed) return null;
  if (trimmed.split(/\s+/).length < MIN_WORDS) return null;

  // Split on sentence terminators so a long turn produces at most one
  // artifact per sentence, and only the first match wins.
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sentence of sentences) {
    const kind = classify(sentence);
    if (!kind) continue;
    const content = sentence.length > MAX_LEN ? sentence.slice(0, MAX_LEN - 1) + '…' : sentence;
    return {
      kind,
      content,
      meta: extractMeta(kind, sentence),
    };
  }

  return null;
}

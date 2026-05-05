// src/services/memoryBriefingService.ts
// Builds a structured briefing from a set of archived conversations.
// Synthesis runs through the central ai-router (task `thread_digest`).
// The deterministic skeleton always renders — AI fills the narrative sections.

import { invokeAIJson } from './ai/aiService';
import { AIRouterError } from './ai/errors';
import type { ArchiveItem, ArchiveType } from '../types';

export interface MemoryBriefingThread {
  topic: string;
  state: string;
  latestItemId?: string;
}

export interface MemoryBriefingDecision {
  outcome: string;
  itemId?: string;
}

export interface MemoryBriefing {
  subject: string;
  sourceCount: number;
  rangeStart: Date;
  rangeEnd: Date;
  lastContact: { date: Date; summary: string; itemId?: string } | null;
  threads: MemoryBriefingThread[];
  decisions: MemoryBriefingDecision[];
  openQuestions: string[];
  talkingPoints: string[];
  sourceItemIds: string[];
  /** 'pulse_ai' when AI synthesis succeeded, 'skeleton' when only deterministic data is present. */
  provenance: 'pulse_ai' | 'skeleton';
}

interface AIBriefingPayload {
  last_contact_summary: string | null;
  threads: Array<{ topic: string; state: string; source_item_id?: string | null }>;
  decisions: Array<{ outcome: string; source_item_id?: string | null }>;
  open_questions: string[];
  talking_points: string[];
}

const SYSTEM_PROMPT = `You synthesize briefings for a solo operator across their archived conversations.

Rules:
- Output ONLY valid JSON matching the schema in the user prompt — no prose, no markdown fences.
- Every fact you state must be grounded in the supplied items. Cite a source_item_id where the schema asks for one.
- Be specific. "Discussed pricing" is bad. "Sarah pushed for tiered pricing at the May 03 call" is good.
- Active threads = topics that have appeared more than once and have not been closed.
- Decisions = explicit resolutions, conclusions, or commitments.
- Open questions = things that were raised but never answered.
- Talking points = 3 imperative-tone suggestions for the next conversation. Short. Specific.
- If something is missing or unknown, return an empty array — never fabricate.
- Never use em dashes. Use commas, colons, periods, parentheses.`;

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

const itemToSnippet = (item: ArchiveItem): string => {
  const date = item.date instanceof Date ? item.date : new Date(item.date);
  const dateStr = isNaN(date.getTime()) ? 'unknown' : date.toISOString().slice(0, 10);
  const typeLabel = item.type.replace(/_/g, ' ');
  const tags = [...(item.tags || []), ...(item.aiTags || [])].slice(0, 4).join(', ');
  const body = item.aiSummary || item.content || item.title;
  return `[id:${item.id}] ${dateStr} · ${typeLabel}${tags ? ` · tags: ${tags}` : ''}\nTitle: ${item.title}\n${truncate(body, 600)}`;
};

const buildPrompt = (items: ArchiveItem[], subject: string): string => {
  const sorted = [...items].sort((a, b) => {
    const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return db - da;
  });

  // Cap input size
  const capped = sorted.slice(0, 30);

  const corpus = capped.map(itemToSnippet).join('\n\n---\n\n');

  return `Subject of briefing: ${subject}
Number of items provided: ${capped.length}${items.length > capped.length ? ` (truncated from ${items.length})` : ''}

Schema (return JSON exactly matching this shape):
{
  "last_contact_summary": "1-sentence summary of the most recent item, or null if you can't say specifically",
  "threads": [
    { "topic": "short topic name (2-4 words)", "state": "one-sentence current state", "source_item_id": "id of latest item where this thread appears" }
  ],
  "decisions": [
    { "outcome": "one-sentence decision/conclusion", "source_item_id": "id of item where decision was reached" }
  ],
  "open_questions": [
    "one-sentence question that remains unresolved"
  ],
  "talking_points": [
    "imperative-tone short bullet for the next conversation"
  ]
}

Constraints:
- threads: 0-3 entries, each non-trivial.
- decisions: 0-5 entries, only if explicit.
- open_questions: 0-4 entries.
- talking_points: 1-3 entries.

Items (most recent first):

${corpus}`;
};

const datesOf = (items: ArchiveItem[]) => {
  const ts = items
    .map(i => (i.date instanceof Date ? i.date : new Date(i.date)).getTime())
    .filter(t => !isNaN(t));
  if (ts.length === 0) {
    const now = new Date();
    return { rangeStart: now, rangeEnd: now };
  }
  return { rangeStart: new Date(Math.min(...ts)), rangeEnd: new Date(Math.max(...ts)) };
};

const skeletonOf = (items: ArchiveItem[], subject: string): MemoryBriefing => {
  const sorted = [...items].sort((a, b) => {
    const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
    const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
    return db - da;
  });
  const latest = sorted[0];
  const { rangeStart, rangeEnd } = datesOf(sorted);
  return {
    subject,
    sourceCount: sorted.length,
    rangeStart,
    rangeEnd,
    lastContact: latest
      ? {
          date: latest.date instanceof Date ? latest.date : new Date(latest.date),
          summary: latest.aiSummary || truncate(latest.title, 120),
          itemId: latest.id,
        }
      : null,
    threads: [],
    decisions: [],
    openQuestions: [],
    talkingPoints: [],
    sourceItemIds: sorted.map(i => i.id),
    provenance: 'skeleton',
  };
};

export interface BuildMemoryBriefingArgs {
  items: ArchiveItem[];
  subject: string;
  /** Optional override; defaults to thread_digest. */
  task?: 'thread_digest' | 'meeting_summary' | 'calendar_prep';
}

export async function buildMemoryBriefing({
  items,
  subject,
  task = 'thread_digest',
}: BuildMemoryBriefingArgs): Promise<MemoryBriefing> {
  if (items.length < 2) {
    throw new Error('Briefing needs at least 2 items.');
  }

  const skeleton = skeletonOf(items, subject);
  const prompt = buildPrompt(items, subject);

  try {
    const ai = await invokeAIJson<AIBriefingPayload>(task, prompt, {
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.4,
    });

    const itemIdSet = new Set(items.map(i => i.id));
    const scrubId = (id?: string | null): string | undefined =>
      id && itemIdSet.has(id) ? id : undefined;

    return {
      ...skeleton,
      provenance: 'pulse_ai',
      lastContact: skeleton.lastContact && ai.last_contact_summary
        ? { ...skeleton.lastContact, summary: ai.last_contact_summary }
        : skeleton.lastContact,
      threads: (ai.threads || []).slice(0, 3).map(t => ({
        topic: t.topic,
        state: t.state,
        latestItemId: scrubId(t.source_item_id),
      })),
      decisions: (ai.decisions || []).slice(0, 5).map(d => ({
        outcome: d.outcome,
        itemId: scrubId(d.source_item_id),
      })),
      openQuestions: (ai.open_questions || []).slice(0, 4),
      talkingPoints: (ai.talking_points || []).slice(0, 3),
    };
  } catch (err) {
    if (err instanceof AIRouterError) {
      // Return skeleton on AI failure; UI surfaces the degraded state.
      return skeleton;
    }
    throw err;
  }
}

/** Render a briefing to plain markdown for clipboard / email. */
export function memoryBriefingToMarkdown(b: MemoryBriefing): string {
  const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const lines: string[] = [
    `# Briefing · ${b.subject}`,
    '',
    `${b.sourceCount} conversations · ${fmtDate(b.rangeStart)} to ${fmtDate(b.rangeEnd)}`,
    '',
  ];
  if (b.lastContact) {
    lines.push('## Last contact', `${fmtDate(b.lastContact.date)} · ${b.lastContact.summary}`, '');
  }
  if (b.threads.length) {
    lines.push('## Active threads');
    b.threads.forEach(t => lines.push(`- **${t.topic}** · ${t.state}`));
    lines.push('');
  }
  if (b.decisions.length) {
    lines.push('## Decisions');
    b.decisions.forEach(d => lines.push(`- ${d.outcome}`));
    lines.push('');
  }
  if (b.openQuestions.length) {
    lines.push('## Open questions');
    b.openQuestions.forEach(q => lines.push(`- ${q}`));
    lines.push('');
  }
  if (b.talkingPoints.length) {
    lines.push('## Talking points');
    b.talkingPoints.forEach(p => lines.push(`- ${p}`));
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/** Pretty type-label helper. */
export const typeOf = (t: ArchiveType) => t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

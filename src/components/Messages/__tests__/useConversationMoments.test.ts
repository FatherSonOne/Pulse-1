// Unit tests for the Path D intelligence-spine moment detection
// (MESSAGES_REDESIGN_HANDOFF_2026-05-24, step 5 — Phase 1 heuristics +
// Phase 2 ai-router detection + merge). All pure / mockable — no auth needed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectMoments,
  detectMomentsAI,
  mergeMoments,
  type Moment,
} from '../useConversationMoments';
import type { RailMessage } from '../useRelationshipData';
import { processWithModel } from '../../../services/geminiService';

// useConversationMoments imports only processWithModel from geminiService.
vi.mock('../../../services/geminiService', () => ({
  processWithModel: vi.fn(),
}));

const mockProcess = vi.mocked(processWithModel);

function m(
  id: string,
  isOutbound: boolean,
  ts: number,
  text = '',
  extra: Partial<RailMessage> = {},
): RailMessage {
  return { id, isOutbound, timestamp: ts, text, ...extra };
}

const DECISION: RailMessage['decision'] = { text: 'ship it', status: 'approved', type: 'final' };

describe('detectMoments (Phase 1 heuristics)', () => {
  it('flags structured decision data regardless of direction', () => {
    const out = detectMoments([
      m('a', false, 1, 'hi'),
      m('b', true, 2, 'we decided', { decision: DECISION }),
    ]);
    expect(out.get('b')).toEqual({ messageId: 'b', type: 'decision', confidence: 1 });
  });

  it('flags the trailing inbound message as needs-reply', () => {
    const out = detectMoments([m('a', true, 1, 'yo'), m('b', false, 2, 'hey')]);
    expect(out.get('b')?.type).toBe('needs-reply');
  });

  it('does not flag needs-reply when the conversation ends on an outbound', () => {
    const out = detectMoments([m('a', false, 1, 'hi'), m('b', true, 2, 'hello')]);
    expect([...out.values()].some((x) => x.type === 'needs-reply')).toBe(false);
  });

  it('flags an unanswered inbound question, but not an answered one', () => {
    // 'a' is answered (outbound 'b' follows); 'c' is an unanswered trailing question.
    const out = detectMoments([
      m('a', false, 1, 'ready?'),
      m('b', true, 2, 'yes'),
      m('c', false, 3, 'when?'),
    ]);
    expect(out.has('a')).toBe(false);
    // 'c' is trailing inbound → needs-reply takes precedence over question.
    expect(out.get('c')?.type).toBe('needs-reply');
  });

  it('flags a mid-thread unanswered question as question, trailing as needs-reply', () => {
    const out = detectMoments([
      m('a', true, 1, 'hi'),
      m('b', false, 2, 'can you send it?'),
      m('c', false, 3, 'still there'),
    ]);
    expect(out.get('b')?.type).toBe('question');
    expect(out.get('c')?.type).toBe('needs-reply');
  });
});

describe('mergeMoments', () => {
  it('returns the heuristic map unchanged when AI is null', () => {
    const heuristic = new Map<string, Moment>([
      ['a', { messageId: 'a', type: 'needs-reply', confidence: 0.9 }],
    ]);
    expect(mergeMoments(heuristic, null)).toBe(heuristic);
  });

  it('lets AI add a moment on a message the heuristic did not flag', () => {
    const ai = new Map<string, Moment>([
      ['x', { messageId: 'x', type: 'decision', confidence: 0.8 }],
    ]);
    expect(mergeMoments(new Map(), ai).get('x')?.type).toBe('decision');
  });

  it('keeps structured decisions (confidence 1) even if AI disagrees', () => {
    const heuristic = new Map<string, Moment>([
      ['b', { messageId: 'b', type: 'decision', confidence: 1 }],
    ]);
    const ai = new Map<string, Moment>([
      ['b', { messageId: 'b', type: 'question', confidence: 0.95 }],
    ]);
    expect(mergeMoments(heuristic, ai).get('b')?.type).toBe('decision');
  });

  it('confines needs-reply to the heuristic trailing message', () => {
    const heuristic = new Map<string, Moment>([
      ['last', { messageId: 'last', type: 'needs-reply', confidence: 0.9 }],
    ]);
    const ai = new Map<string, Moment>([
      ['mid', { messageId: 'mid', type: 'needs-reply', confidence: 0.8 }],
    ]);
    const merged = mergeMoments(heuristic, ai);
    expect(merged.get('last')?.type).toBe('needs-reply');
    expect(merged.has('mid')).toBe(false);
  });

  it('drops AI needs-reply entirely when the heuristic has none', () => {
    const ai = new Map<string, Moment>([
      ['x', { messageId: 'x', type: 'needs-reply', confidence: 0.9 }],
    ]);
    expect(mergeMoments(new Map(), ai).has('x')).toBe(false);
  });
});

describe('detectMomentsAI (Phase 2 ai-router)', () => {
  const convo = [
    m('a', false, 1, 'q1?'),
    m('b', true, 2, 'ok'),
    m('c', false, 3, 'decided X'),
  ];

  beforeEach(() => {
    mockProcess.mockReset();
  });

  it('returns null without calling the router for <2 messages', async () => {
    const out = await detectMomentsAI([m('a', false, 1)]);
    expect(out).toBeNull();
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('maps [index] back to message ids and returns a Moment map', async () => {
    mockProcess.mockResolvedValue(
      JSON.stringify([
        { index: 0, type: 'question', confidence: 0.8 },
        { index: 2, type: 'decision', confidence: 0.9 },
      ]),
    );
    const out = await detectMomentsAI(convo);
    expect(out?.get('a')).toEqual({ messageId: 'a', type: 'question', confidence: 0.8 });
    expect(out?.get('c')?.type).toBe('decision');
  });

  it('drops moments below the confidence floor (0.6)', async () => {
    mockProcess.mockResolvedValue(JSON.stringify([{ index: 0, type: 'question', confidence: 0.4 }]));
    expect((await detectMomentsAI(convo))?.size).toBe(0);
  });

  it('drops invalid types and out-of-range indices', async () => {
    mockProcess.mockResolvedValue(
      JSON.stringify([
        { index: 0, type: 'banana', confidence: 0.9 },
        { index: 99, type: 'question', confidence: 0.9 },
      ]),
    );
    expect((await detectMomentsAI(convo))?.size).toBe(0);
  });

  it('keeps the higher-confidence claim when a message is double-flagged', async () => {
    mockProcess.mockResolvedValue(
      JSON.stringify([
        { index: 0, type: 'question', confidence: 0.7 },
        { index: 0, type: 'decision', confidence: 0.9 },
      ]),
    );
    expect((await detectMomentsAI(convo))?.get('a')?.type).toBe('decision');
  });

  it('collapses multiple needs-reply to the latest message', async () => {
    const inbound = [m('a', false, 1), m('b', false, 2), m('c', false, 3)];
    mockProcess.mockResolvedValue(
      JSON.stringify([
        { index: 0, type: 'needs-reply', confidence: 0.8 },
        { index: 2, type: 'needs-reply', confidence: 0.7 },
      ]),
    );
    const out = await detectMomentsAI(inbound);
    expect(out?.has('a')).toBe(false);
    expect(out?.get('c')?.type).toBe('needs-reply');
  });

  it('parses a fenced ```json block', async () => {
    mockProcess.mockResolvedValue('```json\n[{"index":0,"type":"question","confidence":0.9}]\n```');
    expect((await detectMomentsAI(convo))?.get('a')?.type).toBe('question');
  });

  it('extracts a JSON array wrapped in prose', async () => {
    mockProcess.mockResolvedValue(
      'Sure! Here are the moments: [{"index":0,"type":"question","confidence":0.9}] — hope that helps.',
    );
    expect((await detectMomentsAI(convo))?.get('a')?.type).toBe('question');
  });

  it('returns null on an empty router response', async () => {
    mockProcess.mockResolvedValue(null);
    expect(await detectMomentsAI(convo)).toBeNull();
  });

  it('returns null when the router throws', async () => {
    mockProcess.mockRejectedValue(new Error('router 500'));
    expect(await detectMomentsAI(convo)).toBeNull();
  });

  it('returns null on unparseable output', async () => {
    mockProcess.mockResolvedValue('no json here at all');
    expect(await detectMomentsAI(convo)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import {
  isBreakoutMsg,
  makeBreakoutStart,
  makeBreakoutRecall,
  makeBreakoutBroadcast,
  makeBreakoutAck,
  findMyAssignment,
  applyBreakoutMsg,
  initialBreakoutState,
  type BreakoutAssignment,
} from './breakoutProtocol';

const A: BreakoutAssignment = { participant: 'sess-A', roomUrl: 'https://d.co/rA', roomName: 'rA' };
const B: BreakoutAssignment = { participant: 'sess-B', roomUrl: 'https://d.co/rB', roomName: 'rB' };

describe('isBreakoutMsg', () => {
  it('accepts each valid variant', () => {
    expect(isBreakoutMsg(makeBreakoutStart('bk1', [A, B], 123))).toBe(true);
    expect(isBreakoutMsg(makeBreakoutRecall('bk1'))).toBe(true);
    expect(isBreakoutMsg(makeBreakoutBroadcast('bk1', 'hi'))).toBe(true);
    expect(isBreakoutMsg(makeBreakoutAck('bk1', 'sess-A', 'moved'))).toBe(true);
  });

  it('rejects chat and junk so the chat branch is never hijacked', () => {
    expect(isBreakoutMsg({ type: 'chat', text: 'hello', sender: 'Me' })).toBe(false);
    expect(isBreakoutMsg(null)).toBe(false);
    expect(isBreakoutMsg(undefined)).toBe(false);
    expect(isBreakoutMsg('breakout-start')).toBe(false);
    expect(isBreakoutMsg({ type: 'breakout-start' })).toBe(false); // missing assignments
    expect(isBreakoutMsg({ type: 'breakout-broadcast', breakoutId: 'x' })).toBe(false); // missing text
  });
});

describe('findMyAssignment', () => {
  it('returns the matching assignment by session id', () => {
    expect(findMyAssignment([A, B], 'sess-B')).toEqual(B);
  });
  it('returns null when unassigned or no session id', () => {
    expect(findMyAssignment([A, B], 'sess-Z')).toBeNull();
    expect(findMyAssignment([A, B], null)).toBeNull();
  });
});

describe('applyBreakoutMsg reducer', () => {
  it('breakout-start stores this client’s own assignment', () => {
    const next = applyBreakoutMsg(initialBreakoutState, makeBreakoutStart('bk1', [A, B], 999), 'sess-B');
    expect(next).toEqual({
      active: true,
      breakoutId: 'bk1',
      endsAt: 999,
      myAssignment: B,
      lastBroadcast: null,
    });
  });

  it('breakout-start with no matching assignment leaves myAssignment null but still active', () => {
    const next = applyBreakoutMsg(initialBreakoutState, makeBreakoutStart('bk1', [A], null), 'sess-Z');
    expect(next.active).toBe(true);
    expect(next.myAssignment).toBeNull();
  });

  it('breakout-broadcast appends text only for the active session', () => {
    const active = applyBreakoutMsg(initialBreakoutState, makeBreakoutStart('bk1', [B], null), 'sess-B');
    const withMsg = applyBreakoutMsg(active, makeBreakoutBroadcast('bk1', '2 min left'), 'sess-B');
    expect(withMsg.lastBroadcast).toBe('2 min left');
  });

  it('ignores a broadcast for a different breakout session', () => {
    const active = applyBreakoutMsg(initialBreakoutState, makeBreakoutStart('bk1', [B], null), 'sess-B');
    const stale = applyBreakoutMsg(active, makeBreakoutBroadcast('bk-OTHER', 'nope'), 'sess-B');
    expect(stale.lastBroadcast).toBeNull();
  });

  it('breakout-recall resets to initial state', () => {
    const active = applyBreakoutMsg(initialBreakoutState, makeBreakoutStart('bk1', [B], null), 'sess-B');
    const recalled = applyBreakoutMsg(active, makeBreakoutRecall('bk1'), 'sess-B');
    expect(recalled).toEqual(initialBreakoutState);
  });

  it('ignores a recall for a session this client is not in', () => {
    const active = applyBreakoutMsg(initialBreakoutState, makeBreakoutStart('bk1', [B], null), 'sess-B');
    const other = applyBreakoutMsg(active, makeBreakoutRecall('bk-OTHER'), 'sess-B');
    expect(other).toBe(active); // unchanged reference
  });

  it('breakout-ack is host bookkeeping — receiver state unchanged', () => {
    const active = applyBreakoutMsg(initialBreakoutState, makeBreakoutStart('bk1', [B], null), 'sess-B');
    const after = applyBreakoutMsg(active, makeBreakoutAck('bk1', 'sess-B', 'moved'), 'sess-B');
    expect(after).toBe(active);
  });
});

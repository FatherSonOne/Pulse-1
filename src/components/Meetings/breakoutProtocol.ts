/**
 * breakoutProtocol.ts
 * Pure, framework-agnostic protocol for host-orchestrated breakout rooms.
 *
 * Breakouts ride the SAME Daily app-message channel as in-meeting chat
 * (`daily.sendAppMessage(payload, '*')` + the `app-message` event in
 * PulseVideoRoom). The host is the source of truth; participants react to
 * messages. This module owns the wire shapes, a type guard, message builders,
 * and a pure receiver-state reducer so the routing logic is unit-testable
 * WITHOUT a live Daily call (see breakoutProtocol.test.ts).
 *
 * No Daily SDK, React, or DOM here — keep it pure.
 *
 * Naming note: we use `breakoutId` for the host-generated identifier of a
 * breakout *session*, and `participant` for a Daily **session_id** (stable for
 * a connection). The handoff §6 sketched these as `sessionId`; finalized here
 * with clearer names per the doc's "finalize in P1" note.
 */

/** One participant's sub-room assignment for an active breakout session. */
export interface BreakoutAssignment {
  /** Daily session_id of the assigned participant. */
  participant: string;
  /** Full Daily room URL of the sub-room to join. */
  roomUrl: string;
  /** Daily room name of the sub-room (for token minting + cleanup). */
  roomName: string;
}

/**
 * Discriminated union of every breakout app-message. Sent alongside, never in
 * place of, `{ type: 'chat' }`. App-messages are best-effort and room-scoped
 * (they do NOT cross into sub-rooms — see handoff R3), so a broadcast must be
 * re-sent into each sub-room by a member of that room.
 */
export type BreakoutMsg =
  | {
      type: 'breakout-start';
      /** Host-generated id for this breakout session. */
      breakoutId: string;
      /** Epoch ms when the breakout auto-recalls, or null for no timer. */
      endsAt: number | null;
      /** Per-participant sub-room assignments (keyed on Daily session_id). */
      assignments: BreakoutAssignment[];
    }
  | { type: 'breakout-recall'; breakoutId: string }
  | { type: 'breakout-broadcast'; breakoutId: string; text: string }
  | {
      type: 'breakout-ack';
      breakoutId: string;
      /** Daily session_id of the acking participant. */
      participant: string;
      state: 'moved' | 'returned';
    };

export const BREAKOUT_MSG_TYPES = [
  'breakout-start',
  'breakout-recall',
  'breakout-broadcast',
  'breakout-ack',
] as const;

/**
 * Runtime guard — narrows an untyped app-message `data` payload to a
 * `BreakoutMsg`. Validates the discriminant AND the fields each variant relies
 * on, so a malformed message can't crash the reducer.
 */
export function isBreakoutMsg(data: unknown): data is BreakoutMsg {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  switch (d.type) {
    case 'breakout-start':
      return typeof d.breakoutId === 'string' && Array.isArray(d.assignments);
    case 'breakout-recall':
      return typeof d.breakoutId === 'string';
    case 'breakout-broadcast':
      return typeof d.breakoutId === 'string' && typeof d.text === 'string';
    case 'breakout-ack':
      return typeof d.breakoutId === 'string' && typeof d.participant === 'string';
    default:
      return false;
  }
}

// ── Message builders (host side) ─────────────────────────────────────────────

export function makeBreakoutStart(
  breakoutId: string,
  assignments: BreakoutAssignment[],
  endsAt: number | null = null,
): Extract<BreakoutMsg, { type: 'breakout-start' }> {
  return { type: 'breakout-start', breakoutId, endsAt, assignments };
}

export function makeBreakoutRecall(
  breakoutId: string,
): Extract<BreakoutMsg, { type: 'breakout-recall' }> {
  return { type: 'breakout-recall', breakoutId };
}

export function makeBreakoutBroadcast(
  breakoutId: string,
  text: string,
): Extract<BreakoutMsg, { type: 'breakout-broadcast' }> {
  return { type: 'breakout-broadcast', breakoutId, text };
}

export function makeBreakoutAck(
  breakoutId: string,
  participant: string,
  state: 'moved' | 'returned',
): Extract<BreakoutMsg, { type: 'breakout-ack' }> {
  return { type: 'breakout-ack', breakoutId, participant, state };
}

/** Find this client's assignment in a start message, or null if unassigned. */
export function findMyAssignment(
  assignments: BreakoutAssignment[],
  mySessionId: string | null,
): BreakoutAssignment | null {
  if (!mySessionId) return null;
  return assignments.find((a) => a.participant === mySessionId) ?? null;
}

// ── Receiver state (each client's view of the breakout it's in) ──────────────

export interface BreakoutReceiverState {
  /** Is a breakout session currently active for this client? */
  active: boolean;
  /** Identifier of the active breakout session (host-generated). */
  breakoutId: string | null;
  /** Epoch ms when the breakout auto-recalls, or null for no timer. */
  endsAt: number | null;
  /** This client's assigned sub-room, or null if unassigned / host-stays-in-main. */
  myAssignment: BreakoutAssignment | null;
  /** Most recent host broadcast text (null if none yet). */
  lastBroadcast: string | null;
}

export const initialBreakoutState: BreakoutReceiverState = {
  active: false,
  breakoutId: null,
  endsAt: null,
  myAssignment: null,
  lastBroadcast: null,
};

/**
 * Pure reducer: fold a received breakout message into the client's receiver
 * state. Does NOT perform any Daily moves — P1 wires routing + state only; the
 * actual leave()/join() lands in P3. Recall and broadcast only apply to the
 * session this client is currently in (`breakoutId` match) so a stale message
 * from a prior session is ignored.
 */
export function applyBreakoutMsg(
  state: BreakoutReceiverState,
  msg: BreakoutMsg,
  mySessionId: string | null,
): BreakoutReceiverState {
  switch (msg.type) {
    case 'breakout-start':
      return {
        active: true,
        breakoutId: msg.breakoutId,
        endsAt: msg.endsAt,
        myAssignment: findMyAssignment(msg.assignments, mySessionId),
        lastBroadcast: null,
      };
    case 'breakout-recall':
      // Ignore a recall for a session we're not in (best-effort dedup).
      if (state.active && state.breakoutId !== msg.breakoutId) return state;
      return { ...initialBreakoutState };
    case 'breakout-broadcast':
      if (!state.active || state.breakoutId !== msg.breakoutId) return state;
      return { ...state, lastBroadcast: msg.text };
    case 'breakout-ack':
      // Host-side bookkeeping; receivers ignore.
      return state;
    default:
      return state;
  }
}

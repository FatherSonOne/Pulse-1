/**
 * breakoutService.ts
 * Host-side orchestration for Meetings → Breakout Rooms (P3+).
 *
 * Reuses the existing Daily backend (no new edge function): one ephemeral Daily
 * sub-room per populated breakout room via createPulseRoom(), then persists the
 * session + assignments (D3) to the host-owned meeting_breakout_* tables. The
 * returned assignments are what the host broadcasts over the Daily app-message
 * channel so each participant client can mint its own token and move.
 *
 * The realtime MOVE itself (leave()/join()) happens on each participant client —
 * see the move effect in PulseVideoRoom's MeetingRoom. This service only does
 * the host's create + persist and hands back the wire payload.
 */

import { supabase } from './supabaseClient';
import { createPulseRoom, deleteRoom } from './pulseVideoService';
import type { BreakoutAssignment } from '../components/Meetings/breakoutProtocol';

/** A populated breakout room, as assembled by the host's BreakoutController. */
export interface BreakoutPlanRoom {
  /** Friendly label, e.g. "Room 1" (used for the Daily sub-room title). */
  name: string;
  /** Daily session_ids assigned to this room. */
  memberIds: string[];
}

export interface StartedBreakout {
  breakoutId: string;
  endsAt: number | null;
  assignments: BreakoutAssignment[];
  /** Daily room NAMES of the created sub-rooms (for cleanup on recall, P4). */
  subRoomNames: string[];
}

/**
 * Create the sub-rooms, persist the session + assignments, and return the
 * assignment payload for the host to broadcast. Rooms with zero members are
 * skipped. Throws if nothing is assigned or the user isn't signed in.
 *
 * @param nameOf resolves a Daily session_id to a display name (for the audit
 *               snapshot column); pure read, no side effects.
 */
export async function startBreakout(
  mainRoomName: string,
  rooms: BreakoutPlanRoom[],
  durationMinutes: number,
  nameOf: (sessionId: string) => string,
): Promise<StartedBreakout> {
  const populated = rooms.filter(r => r.memberIds.length > 0);
  if (populated.length === 0) {
    throw new Error('Assign at least one participant to a room before starting.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to start a breakout.');

  // 1. One ephemeral Daily sub-room per populated room (backend already exists).
  const created = await Promise.all(populated.map(async (r) => {
    const { roomUrl, roomName } = await createPulseRoom(undefined, `Breakout · ${r.name}`);
    return { plan: r, roomUrl, roomName };
  }));

  // 2. Per-participant assignments (keyed on Daily session_id).
  const assignments: BreakoutAssignment[] = created.flatMap(c =>
    c.plan.memberIds.map(sid => ({ participant: sid, roomUrl: c.roomUrl, roomName: c.roomName })),
  );

  const endsAt = durationMinutes > 0 ? Date.now() + durationMinutes * 60_000 : null;

  // 3. Persist the session (host-owned; RLS WITH CHECK enforces host_user_id = auth.uid()).
  const { data: sessionRow, error: sErr } = await supabase
    .from('meeting_breakout_sessions')
    .insert({
      main_room_name: mainRoomName,
      host_user_id: user.id,
      status: 'active',
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    })
    .select('id')
    .single();
  if (sErr || !sessionRow) {
    throw new Error(`Failed to persist breakout session: ${sErr?.message ?? 'unknown error'}`);
  }
  const breakoutId = sessionRow.id as string;

  // 4. Persist assignments. Non-fatal: the app-message transport still moves
  //    everyone even if the durable record write fails — log and continue.
  const assignmentRows = created.flatMap(c => c.plan.memberIds.map(sid => ({
    session_id: breakoutId,
    participant_session_id: sid,
    participant_name: nameOf(sid),
    sub_room_name: c.roomName,
    sub_room_url: c.roomUrl,
    state: 'assigned' as const,
  })));
  const { error: aErr } = await supabase.from('meeting_breakout_assignments').insert(assignmentRows);
  if (aErr) {
    console.warn('[breakout] assignment persistence failed (transport still active):', aErr.message);
  }

  return { breakoutId, endsAt, assignments, subRoomNames: created.map(c => c.roomName) };
}

/**
 * Mark a breakout session ended and reap its ephemeral sub-rooms (D4). Used by
 * recall (P4). Best-effort: a failed delete falls back to Daily's 24h expiry.
 */
export async function endBreakout(breakoutId: string, subRoomNames: string[]): Promise<void> {
  const { error } = await supabase
    .from('meeting_breakout_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', breakoutId);
  if (error) console.warn('[breakout] failed to mark session ended:', error.message);

  await Promise.all(subRoomNames.map(name =>
    deleteRoom(name).catch(e => console.warn('[breakout] delete-room failed:', name, e)),
  ));
}

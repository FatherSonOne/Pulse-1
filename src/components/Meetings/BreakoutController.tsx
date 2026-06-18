/**
 * BreakoutController.tsx
 * Host-only breakout-rooms control surface that runs INSIDE the live Daily call
 * (rendered within MeetingRoom, i.e. inside <DailyProvider>). Unlike the legacy
 * dashboard BreakoutRoomsModal — which is handed a static Contact[] invite list
 * and has no call object — this controller reads LIVE participants from
 * useParticipantIds() and (P3+) drives real Daily room creation + moves over
 * app-messages.
 *
 * P2 scope: scaffold only. Renders the 3-panel assignment UI (reusing the
 * existing meetings-breakout-* styles) populated with live remote participants.
 * Assignment (select → assign → unassign), add/rename room, and the duration
 * picker are interactive local state. Start / Broadcast / Recall are INERT here
 * — they're wired to real Daily orchestration in P3–P5.
 *
 * Gating: the parent (MeetingRoom) mounts this only when `isHost` AND the
 * `breakoutRooms` feature flag is on, so non-hosts and un-flagged sessions never
 * see it.
 */

import React, { useState } from 'react';
import { useDaily, useParticipantIds, useLocalSessionId } from '@daily-co/daily-react';
import { SplitSquareVertical, X, Plus, Play, Megaphone, Users, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { startBreakout, type StartedBreakout } from '../../services/breakoutService';
import { makeBreakoutStart } from './breakoutProtocol';

// Local copy of the breakout differentiation palette (the modal's BREAKOUT_COLORS
// is a non-exported const in MeetingsComponents; duplicated here to avoid coupling
// this in-call component to the dashboard module).
const BREAKOUT_COLORS = ['#f43f5e', '#fb7185', '#ec4899', '#f97316', '#eab308', '#a855f7'];

// Deterministic avatar tint for a live participant (no Contact.avatarColor here).
const avatarColorFor = (seed: string): string => {
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BREAKOUT_COLORS[hash % BREAKOUT_COLORS.length];
};

/** A breakout room draft, keyed by live Daily session_ids (not Contact ids). */
interface BreakoutRoomDraft {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

interface BreakoutControllerProps {
  /** Daily room NAME of the main meeting (FK key for persistence). */
  mainRoomName: string;
  /** Friendly meeting title (display only). */
  meetingName: string;
  onClose: () => void;
}

export const BreakoutController: React.FC<BreakoutControllerProps> = ({ mainRoomName, meetingName, onClose }) => {
  const daily = useDaily();
  const localId = useLocalSessionId();
  // Assignable pool = remote participants (the host orchestrates and, by default,
  // stays in the main room — see handoff D2). Reactive: re-renders on join/leave.
  const remoteIds = useParticipantIds({ filter: 'remote' });

  // Names resolved from the live snapshot. useParticipantIds drives re-render on
  // join/leave so this stays fresh enough for the scaffold; a mid-call rename
  // without an id change is a P7 nicety.
  const snapshot = daily?.participants();
  const nameOf = (id: string): string =>
    (id === localId
      ? snapshot?.local?.user_name?.trim() || 'You'
      : snapshot?.[id]?.user_name?.trim() || 'Guest');

  const [rooms, setRooms] = useState<BreakoutRoomDraft[]>([
    { id: 'room-1', name: 'Room 1', color: BREAKOUT_COLORS[0], memberIds: [] },
    { id: 'room-2', name: 'Room 2', color: BREAKOUT_COLORS[1], memberIds: [] },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(15);
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [starting, setStarting] = useState(false);
  // The active breakout session once started (null = not started). Recall/End
  // wiring that consumes this lands in P4.
  const [activeSession, setActiveSession] = useState<StartedBreakout | null>(null);

  const assignedIds = new Set(rooms.flatMap(r => r.memberIds));
  // Drop any assigned id that has since left the call (best-effort live sync).
  const unassigned = remoteIds.filter(id => !assignedIds.has(id));
  const totalAssigned = rooms.reduce((s, r) => s + r.memberIds.filter(id => remoteIds.includes(id)).length, 0);

  const assignToRoom = (roomId: string) => {
    if (!selectedId) return;
    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, memberIds: [...r.memberIds, selectedId] } : r,
    ));
    setSelectedId(null);
  };

  const unassignFromRoom = (roomId: string, participantId: string) => {
    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, memberIds: r.memberIds.filter(id => id !== participantId) } : r,
    ));
  };

  const addRoom = () => {
    const idx = rooms.length;
    setRooms(prev => [...prev, {
      id: `room-${idx + 1}-${remoteIds.length}`,
      name: `Room ${idx + 1}`,
      color: BREAKOUT_COLORS[idx % BREAKOUT_COLORS.length],
      memberIds: [],
    }]);
  };

  const renameRoom = (roomId: string, name: string) => {
    setRooms(prev => prev.map(r => (r.id === roomId ? { ...r, name } : r)));
  };

  // P3: real orchestration. Create one Daily sub-room per populated room, persist
  // the session + assignments, then broadcast breakout-start so each participant
  // client mints its own token and moves (leave()->join()). The host stays in the
  // main room (D2). Recall/cleanup is wired in P4; broadcast-to-rooms in P5.
  const handleStart = async () => {
    if (!daily || starting || activeSession) return;
    setStarting(true);
    try {
      const plan = rooms.map(r => ({
        name: r.name,
        memberIds: r.memberIds.filter(id => remoteIds.includes(id)),
      }));
      const started = await startBreakout(mainRoomName, plan, timerMinutes, nameOf);
      daily.sendAppMessage(
        makeBreakoutStart(started.breakoutId, started.assignments, started.endsAt),
        '*',
      );
      setActiveSession(started);
      toast.success('Breakout started — participants are moving to their rooms.', {
        duration: 4000, position: 'bottom-right',
      });
    } catch (err) {
      console.error('[breakout] start failed:', err);
      toast.error(err instanceof Error ? err.message : 'Could not start the breakout.', {
        duration: 5000, position: 'bottom-right',
      });
    } finally {
      setStarting(false);
    }
  };

  // P3 placeholders — wired in P4 (recall + cleanup) and P5 (broadcast). Kept
  // inert here so a started breakout isn't torn down without the participant
  // return-move (which lands in P4); otherwise deleting sub-rooms would strand
  // people mid-breakout.
  const handleSendBroadcast = () => {
    console.debug('[breakout] Broadcast (wired in P5)', broadcastMsg);
    setBroadcastMode(false);
    setBroadcastMsg('');
  };
  const handleRecall = () => {
    console.debug('[breakout] Recall (wired in P4)');
    onClose();
  };

  return (
    <div className="meetings-modal-overlay" onClick={onClose}>
      <div className="meetings-modal meetings-modal--wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <div className="meetings-modal-header">
          <div className="meetings-modal-title">
            <SplitSquareVertical />
            Breakout Rooms
          </div>
          <button className="meetings-modal-close" onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="meetings-modal-body" style={{ padding: 0 }}>
          <div className="meetings-breakout-layout">
            {/* Panel 1: Unassigned (live remote participants) */}
            <div className="meetings-breakout-panel">
              <div className="meetings-breakout-panel-title">
                Unassigned ({unassigned.length})
              </div>
              {remoteIds.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mtg-text-muted)', textAlign: 'center', paddingTop: 20 }}>
                  Waiting for participants to join
                </div>
              ) : unassigned.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mtg-text-muted)', textAlign: 'center', paddingTop: 20 }}>
                  All participants assigned
                </div>
              ) : unassigned.map(id => {
                const name = nameOf(id);
                return (
                  <div
                    key={id}
                    className={`meetings-breakout-participant-chip ${selectedId === id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(selectedId === id ? null : id)}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: avatarColorFor(name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    {name}
                  </div>
                );
              })}
            </div>

            {/* Panel 2: Rooms */}
            <div className="meetings-breakout-panel">
              <div className="meetings-breakout-panel-title">
                Rooms ({rooms.length}) {selectedId && <span style={{ color: 'var(--mtg-accent-primary)' }}>· click room to assign</span>}
              </div>
              {rooms.map(room => (
                <div
                  key={room.id}
                  className={`meetings-breakout-room-card ${selectedId ? 'drop-target' : ''}`}
                  onClick={() => selectedId && assignToRoom(room.id)}
                >
                  <div className="meetings-breakout-room-header">
                    <div className="meetings-breakout-room-dot" style={{ background: room.color }} />
                    <input
                      className="meetings-breakout-room-name"
                      value={room.name}
                      onClick={e => e.stopPropagation()}
                      onChange={e => renameRoom(room.id, e.target.value)}
                    />
                    <span style={{ fontSize: 11, color: 'var(--mtg-text-muted)' }}>
                      {room.memberIds.filter(id => remoteIds.includes(id)).length} people
                    </span>
                  </div>
                  <div className="meetings-breakout-participants">
                    {room.memberIds.filter(id => remoteIds.includes(id)).length === 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--mtg-text-muted)', fontStyle: 'italic' }}>
                        Empty · assign participants
                      </span>
                    ) : room.memberIds.filter(id => remoteIds.includes(id)).map(id => (
                      <div key={id} className="meetings-breakout-assigned-chip">
                        {nameOf(id)}
                        <button
                          className="meetings-breakout-assigned-remove"
                          onClick={e => { e.stopPropagation(); unassignFromRoom(room.id, id); }}
                        >
                          <X />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button className="meetings-breakout-add-room" onClick={addRoom}>
                <Plus /> Add Room
              </button>
            </div>

            {/* Panel 3: Controls */}
            <div className="meetings-breakout-panel">
              <div className="meetings-breakout-panel-title">Controls</div>
              <div className="meetings-breakout-controls">
                {/* Duration picker */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--mtg-text-muted)', marginBottom: 8 }}>
                    Duration
                  </div>
                  <div className="meetings-pill-btns" style={{ flexWrap: 'wrap' }}>
                    {[5, 10, 15, 20, 30].map(m => (
                      <button
                        key={m}
                        className={`meetings-pill-btn ${timerMinutes === m ? 'active' : ''}`}
                        onClick={() => setTimerMinutes(m)}
                        style={{ fontSize: 11 }}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start (P3: real). Disabled once a session is active. */}
                <button
                  className="meetings-breakout-start-btn"
                  disabled={starting || !!activeSession || totalAssigned === 0}
                  onClick={handleStart}
                >
                  {starting ? (
                    <><Loader2 size={16} className="animate-spin" />Starting…</>
                  ) : activeSession ? (
                    <><SplitSquareVertical />Breakout Active</>
                  ) : (
                    <><Play />Start Breakout</>
                  )}
                </button>

                {/* Broadcast (inert in P2) */}
                {broadcastMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      className="meetings-chat-input"
                      placeholder="Message to all rooms..."
                      value={broadcastMsg}
                      onChange={e => setBroadcastMsg(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="meetings-breakout-broadcast-btn"
                        style={{ flex: 1 }}
                        onClick={() => { setBroadcastMode(false); setBroadcastMsg(''); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="meetings-breakout-start-btn"
                        style={{ flex: 1, marginTop: 0 }}
                        disabled={!broadcastMsg.trim()}
                        onClick={handleSendBroadcast}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="meetings-breakout-broadcast-btn" onClick={() => setBroadcastMode(true)}>
                    <Megaphone /> Broadcast to All
                  </button>
                )}

                {/* Recall (inert in P2 — just closes) */}
                <button className="meetings-breakout-recall-btn" onClick={handleRecall}>
                  <Users /> Call Everyone Back
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="meetings-modal-footer">
          <span style={{ fontSize: 12, color: 'var(--mtg-text-muted)' }}>
            {totalAssigned} of {remoteIds.length} participants assigned
            {meetingName ? ` · ${meetingName}` : ''}
          </span>
          <button className="meetings-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

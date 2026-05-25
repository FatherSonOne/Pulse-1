// Voice Rooms — Relay's Live peer surface.
//
// Renders in-flow inside Relay's Live tab (no modal overlay). The left rail
// organizes channels into four mono-labeled sections (YOU / TEAMS / CONTACTS
// / AD-HOC); the right pane runs a state machine across no-selection → solo
// recording → channel-idle → in-call; an opt-in AI sidecar slides in from
// the right and a pre-join sheet handles getUserMedia (device picker, input
// level meter, mute-on-join, permission states).
//
// Authored under /impeccable across six passes on 2026-05-13: shape, then
// Phase 1 structural rebuild, then colorize / typeset / clarify / harden /
// polish. The TEAMS and CONTACTS sections render quiet captions for now —
// real workspace + contact wiring is a follow-up.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Contact } from '../../types';
import { voiceRoomService } from '../../services/voiceRoomService';
import { useRelayStudio, StudioCard, StudioMasthead } from './studio';

import { Brain, ChevronLeft, Code2, Coffee, Gamepad2, Lock, Mic, MicOff, Monitor, Music, PhoneOff, Plus, Radio, Rocket, Settings, Square, UserPlus, Users, Volume2, VolumeX, X, type LucideIcon } from 'lucide-react';
import { VoxEmptyState } from './VoxEmptyState';

// Maps the legacy `fa-*` icon keys stored on voice_rooms rows to their Lucide
// equivalents. Existing DB rows keep working without a data migration — only
// the renderer changes. Future polish can rename the key namespace.
const ROOM_ICON_BY_KEY: Record<string, LucideIcon> = {
  'fa-microphone': Mic,
  'fa-microphone-slash': MicOff,
  'fa-users': Users,
  'fa-brain': Brain,
  'fa-gamepad': Gamepad2,
  'fa-music': Music,
  'fa-code': Code2,
  'fa-coffee': Coffee,
  'fa-rocket': Rocket,
};

const RoomIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  const Icon = ROOM_ICON_BY_KEY[name] ?? Mic;
  return <Icon className={className} aria-hidden />;
};

// ============================================
// TYPES
// ============================================

interface VoiceRoom {
  id: string;
  name: string;
  icon: string;
  color: string;
  participants: RoomParticipant[];
  maxParticipants: number;
  isPrivate: boolean;
  category?: string;
  description?: string;
  createdAt: Date;
  settings: RoomSettings;
}

interface RoomParticipant {
  userId: string;
  name: string;
  avatarColor: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  joinedAt: Date;
  isScreenSharing?: boolean;
}

interface RoomSettings {
  bitrate: number;
  voiceActivity: boolean;
  echoCancel: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

// Selected-channel id space — namespaced strings so we don't collide with
// real room ids. 'solo' is the always-present LIVE · YOU row; 'room:<id>'
// targets an ad-hoc room without joining it.
type SelectedChannelId = 'solo' | `room:${string}` | null;

interface VoiceRoomsProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  currentUser: {
    id: string;
    name: string;
    avatarColor: string;
  };
}

// ============================================
// VOICE ROOMS COMPONENT
// ============================================
// Wired to voiceRoomService for Supabase persistence.
// NOTE: Requires voice_rooms & voice_room_participants tables.
// If those tables do not exist yet, the component gracefully
// falls back to local-only state and logs the error.

export const VoiceRooms: React.FC<VoiceRoomsProps> = ({
  isOpen,
  onClose: _onClose,
  contacts: _contacts,
  currentUser,
}) => {
  // State
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<SelectedChannelId>(null);
  const studio = useRelayStudio();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  // Pre-join sheet — opens after Go Live, before getUserMedia is requested.
  // Phase 1 scaffold: shows a placeholder confirm; Phase 2d (harden) wires
  // the real device picker, level meter, and permission handling.
  const [preJoinRoomId, setPreJoinRoomId] = useState<string | null>(null);
  // AI sidecar — opt-in per the shape brief, default off. State persists in
  // memory only for Phase 1; Phase 2d may move it to localStorage per channel.
  const [showAISidecar, setShowAISidecar] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // ============================================
  // LOAD ROOMS ON MOUNT
  // ============================================

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadRooms = async () => {
      setIsLoadingRooms(true);
      setLoadError(null);
      try {
        const fetched = await voiceRoomService.getRooms();
        if (cancelled) return;

        // Map service shape -> component shape (field name alignment)
        const mapped: VoiceRoom[] = fetched.map((r) => ({
          id: r.id,
          name: r.name,
          icon: r.icon || 'fa-microphone',
          color: r.color,
          participants: (r.participants || []).map((p) => ({
            userId: p.userId,
            name: p.userName,
            avatarColor: p.avatarColor || 'bg-slate-500',
            isMuted: p.isMuted ?? false,
            isDeafened: false,
            isSpeaking: p.isSpeaking ?? false,
            joinedAt: p.joinedAt ? new Date(p.joinedAt) : new Date(),
          })),
          maxParticipants: r.maxParticipants,
          isPrivate: r.isPrivate,
          category: r.category,
          description: r.description,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          settings: {
            bitrate: r.settings?.bitrate ?? 64000,
            voiceActivity: r.settings?.voiceActivity ?? true,
            echoCancel: r.settings?.echoCancel ?? true,
            noiseSuppression: r.settings?.noiseSuppression ?? true,
            autoGainControl: r.settings?.autoGainControl ?? true,
          },
        }));

        setRooms(mapped);
      } catch (err) {
        if (cancelled) return;
        console.error('[VoiceRooms] Failed to load rooms:', err);
        setLoadError("Couldn't load rooms. Backend may need setup.");
      } finally {
        if (!cancelled) setIsLoadingRooms(false);
      }
    };

    loadRooms();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // ============================================
  // ROOM ACTIONS
  // ============================================

  // Join with a stream prepared by the pre-join sheet. The sheet owns the
  // getUserMedia call so permission/device/level UI happens before the user
  // is "in." Phase 2d (harden) split this from the legacy auto-join flow —
  // joinRoom now assumes permission is already granted.
  const joinRoom = useCallback((
    roomId: string,
    stream: MediaStream,
    options: { muteOnJoin: boolean },
  ) => {
    try {
      if (options.muteOnJoin) {
        stream.getAudioTracks().forEach(t => (t.enabled = false));
        setIsMuted(true);
      }
      setAudioStream(stream);

      // Setup audio analysis for voice activity on the prepared stream.
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Persist join to backend (fire-and-forget; local state updates immediately)
      voiceRoomService
        .joinRoom(roomId, currentUser.id, currentUser.name, currentUser.avatarColor)
        .catch((err) => console.error('[VoiceRooms] Backend joinRoom failed:', err));

      setRooms(prev => prev.map(room => {
        if (room.id === roomId) {
          return {
            ...room,
            participants: [
              ...room.participants,
              {
                userId: currentUser.id,
                name: currentUser.name,
                avatarColor: currentUser.avatarColor,
                isMuted: options.muteOnJoin,
                isDeafened: false,
                isSpeaking: false,
                joinedAt: new Date(),
              },
            ],
          };
        }
        return room;
      }));

      setActiveRoomId(roomId);
      detectVoiceActivity();
    } catch (error) {
      console.error('Failed to join room:', error);
      // Stream came from the sheet; release it on failure so we don't leak a mic.
      stream.getTracks().forEach(t => t.stop());
    }
  }, [currentUser]);

  // Delete an ad-hoc room. Confirms if other participants are present so a
  // misclick on a populated room doesn't quietly drop everyone. If the user
  // is currently in that room, leave first.
  const deleteRoom = useCallback((roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const others = room.participants.filter(p => p.userId !== currentUser.id);
    if (others.length > 0) {
      const ok = window.confirm(`Delete "${room.name}"? ${others.length} other${others.length === 1 ? '' : 's'} ${others.length === 1 ? 'is' : 'are'} in the call.`);
      if (!ok) return;
    }

    if (activeRoomId === roomId) {
      // Tear down the active call before deleting.
      if (audioStream) {
        audioStream.getTracks().forEach(t => t.stop());
        setAudioStream(null);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setActiveRoomId(null);
      setIsMuted(false);
      setIsDeafened(false);
    }

    if (selectedChannelId === `room:${roomId}`) {
      setSelectedChannelId(null);
    }

    setRooms(prev => prev.filter(r => r.id !== roomId));

    voiceRoomService
      .deleteRoom(roomId)
      .catch((err) => console.error('[VoiceRooms] Backend deleteRoom failed:', err));
  }, [rooms, currentUser.id, activeRoomId, audioStream, selectedChannelId]);

  const leaveRoom = useCallback(() => {
    if (!activeRoomId) return;

    // Stop audio stream
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Cancel animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Persist leave to backend (fire-and-forget)
    voiceRoomService
      .leaveRoom(activeRoomId, currentUser.id)
      .catch((err) => console.error('[VoiceRooms] Backend leaveRoom failed:', err));

    // Remove user from room (optimistic local update)
    setRooms(prev => prev.map(room => {
      if (room.id === activeRoomId) {
        return {
          ...room,
          participants: room.participants.filter(p => p.userId !== currentUser.id),
        };
      }
      return room;
    }));

    setActiveRoomId(null);
    setIsMuted(false);
    setIsDeafened(false);
  }, [activeRoomId, audioStream, currentUser.id]);

  // ============================================
  // VOICE ACTIVITY DETECTION
  // ============================================

  const detectVoiceActivity = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const checkActivity = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      // Speaking-detector threshold. Tuned to react to a normal speaking
      // voice through getUserMedia's noise-suppressed signal; below this the
      // analyser still picks up keyboard taps and HVAC. A user-facing
      // sensitivity slider could surface this in a later settings sweep.
      const SPEAKING_THRESHOLD = 30;
      const isSpeaking = average > SPEAKING_THRESHOLD;

      setSpeakingUsers(prev => {
        const next = new Set(prev);
        if (isSpeaking && !isMuted) {
          next.add(currentUser.id);
        } else {
          next.delete(currentUser.id);
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(checkActivity);
    };

    checkActivity();
  }, [currentUser.id, isMuted]);

  // ============================================
  // AUDIO CONTROLS
  // ============================================

  const toggleMute = useCallback(() => {
    if (audioStream) {
      audioStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  }, [audioStream, isMuted]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened(!isDeafened);
    if (!isDeafened) {
      setIsMuted(true);
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }
  }, [audioStream, isDeafened]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioStream]);

  // ============================================
  // RENDER
  // ============================================

  if (!isOpen) return null;

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  // Resolve selectedChannelId → the room object the user is contemplating
  // (channel-idle state). When the user is actually IN a call, activeRoom
  // takes precedence.
  const selectedRoom = selectedChannelId?.startsWith('room:')
    ? rooms.find(r => r.id === selectedChannelId.slice(5))
    : undefined;
  const selectedIsSolo = selectedChannelId === 'solo';

  // Live = has at least one participant — drives the masthead "LIVE NOW · N"
  // count + each card's LIVE/EMPTY dot. inDetail decides browse (masthead +
  // room grid) vs detail (solo / channel-idle / in-call call view).
  const liveRooms = rooms.filter(r => r.participants.length > 0);
  const inDetail = !!activeRoom || selectedIsSolo || !!selectedRoom;

  return (
    <div className="h-full flex bg-[var(--pulse-canvas-soft)]">
      {/* BROWSE — Path C "Voice rooms": a shared masthead + an auto-fitting
          grid of room studio-cards. No inner rail — the grid IS the
          navigation, and a card's Join opens the pre-join sheet → joinRoom →
          the in-call view below. Solo + New ride the masthead's right slot so
          the grid stays rooms-only, matching the playground. The auto-fill
          grid reflows from 2-up to 1-up on a narrow Relay pane WITHOUT a
          viewport media query, so the studio styling never vanishes. */}
      {!inDetail ? (
        <main className={`flex-1 overflow-y-auto ${studio.singlePane ? 'px-4' : 'px-7'} pt-6 pb-12`}>
          <StudioMasthead
            tone={liveRooms.length > 0 ? 'rose' : 'default'}
            eyebrowIcon={liveRooms.length > 0 ? (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 pulse-dot-anim" aria-hidden />
            ) : undefined}
            eyebrow={liveRooms.length > 0 ? `Live now · ${liveRooms.length} room${liveRooms.length === 1 ? '' : 's'}` : 'Voice rooms'}
            title="Voice rooms"
            subtitle="Drop in. Talk over voice. Walk away."
            right={
              <>
                <button
                  type="button"
                  onClick={() => setSelectedChannelId('solo')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Solo
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateRoom(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New room
                </button>
              </>
            }
          />

          {isLoadingRooms ? (
            <div className="text-zinc-500 text-sm py-10 text-center">Loading rooms…</div>
          ) : loadError ? (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 max-w-md">
              <p className="text-xs text-[var(--pulse-ink-2)] mb-2">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoadingRooms(true);
                  setLoadError(null);
                  voiceRoomService.getRooms().then((fetched) => {
                    setRooms(fetched.map((r) => ({
                      id: r.id, name: r.name, icon: r.icon || 'fa-microphone',
                      color: r.color, participants: [], maxParticipants: r.maxParticipants,
                      isPrivate: r.isPrivate, category: r.category, description: r.description,
                      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                      settings: { bitrate: 64000, voiceActivity: true, echoCancel: true, noiseSuppression: true, autoGainControl: true },
                    })));
                  }).catch(() => setLoadError("Still can't reach rooms.")).finally(() => setIsLoadingRooms(false));
                }}
                className="text-xs text-[var(--pulse-rose)] underline transition"
              >
                Retry
              </button>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16 text-zinc-500">
              <div className="w-16 h-16 rounded-full bg-[var(--pulse-surface)] border border-[var(--pulse-border)] flex items-center justify-center mb-4">
                <Radio className="w-7 h-7 text-zinc-500" aria-hidden />
              </div>
              <p className="text-sm text-[var(--pulse-ink-2)]">No rooms yet</p>
              <button
                type="button"
                onClick={() => setShowCreateRoom(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> New room
              </button>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {rooms.map(room => {
                const present = room.participants.length;
                const live = present > 0;
                const host = room.participants[0]?.name;
                return (
                  <StudioCard
                    key={room.id}
                    onClick={() => setPreJoinRoomId(room.id)}
                    className="group relative p-5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`w-2 h-2 rounded-full ${live ? 'pulse-dot-anim' : ''}`}
                        style={{ background: live ? 'var(--pulse-rose)' : 'var(--pulse-ink-3)' }}
                        aria-hidden
                      />
                      <span
                        className="text-[10px] font-mono uppercase tracking-[0.1em]"
                        style={{ color: live ? 'var(--pulse-rose)' : 'var(--pulse-ink-3)' }}
                      >
                        {live ? 'Live' : 'Empty'}
                      </span>
                      <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500">
                        {present} present
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-[var(--pulse-ink)] flex items-center gap-2 min-w-0">
                      {room.isPrivate && <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" aria-hidden />}
                      <span className="truncate">{room.name}</span>
                    </div>
                    <div className="text-[12px] text-zinc-500 mt-0.5">
                      {live ? `Hosted by ${host}` : 'No one yet'}
                    </div>
                    {live && (
                      <div className="mt-4 flex items-end gap-1" style={{ height: 28 }}>
                        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.85, 0.4, 0.7, 0.55].map((v, i) => (
                          <i
                            key={i}
                            className="pulse-wf-live-bar"
                            style={{ width: 3, height: v * 28, background: 'var(--pulse-rose)', borderRadius: 1.5, animationDelay: `${i * 0.08}s` }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPreJoinRoomId(room.id); }}
                          className="ml-auto px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-medium transition"
                        >
                          Join room
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                      className="absolute right-3 top-3 w-6 h-6 rounded-md flex items-center justify-center text-[var(--pulse-ink-2)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-600 dark:hover:text-red-300 hover:bg-[var(--pulse-surface-raised)] transition"
                      aria-label={`Delete ${room.name}`}
                      title="Delete room"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </StudioCard>
                );
              })}
            </div>
          )}
        </main>
      ) : (
      /* DETAIL — state-driven: in-call (participant grid + controls), solo
         recording, or channel-idle (Go Live). A back control returns to the
         grid, except mid-call where Leave is the exit. */
      <main className="flex-1 flex flex-col min-w-0">
        {!activeRoom && (
          <div className="shrink-0 px-3 py-2 border-b border-[var(--pulse-border)]">
            <button
              type="button"
              onClick={() => setSelectedChannelId(null)}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] transition"
              aria-label="Back to rooms"
            >
              <ChevronLeft className="w-4 h-4" /> Rooms
            </button>
          </div>
        )}
        {activeRoom ? (
          <>
            {/* Room Header */}
            <div className="px-6 py-4 border-b border-[var(--pulse-border)] bg-[rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl ${activeRoom.color} flex items-center justify-center text-[var(--pulse-ink)]`}>
                    <RoomIcon name={activeRoom.icon} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--pulse-ink)]">{activeRoom.name}</h3>
                    <p className="text-sm text-[var(--pulse-ink-2)]">{activeRoom.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* AI provenance chip — matches the DESIGN.md signature
                      pattern: mono uppercase, coral dot prefix when active. */}
                  <button
                    onClick={() => setShowAISidecar(v => !v)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-[0.1em] transition flex items-center gap-2 ${
                      showAISidecar
                        ? 'bg-rose-500/15 text-[var(--pulse-rose)] border border-rose-500/30'
                        : 'text-[var(--pulse-ink-2)] hover:bg-[var(--pulse-surface-raised)] border border-transparent'
                    }`}
                    aria-pressed={showAISidecar}
                    title={showAISidecar ? 'Stop AI listening' : 'Start AI listening'}
                  >
                    {showAISidecar ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" aria-hidden />
                    ) : (
                      <Radio className="w-3 h-3" aria-hidden />
                    )}
                    {showAISidecar ? 'PULSE · LISTENING' : 'AI SIDECAR'}
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-10 h-10 rounded-full hover:bg-[var(--pulse-surface-raised)] flex items-center justify-center text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] transition"
                  >
                    <Settings />
                  </button>
                </div>
              </div>
            </div>

            {/* Participants Grid */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeRoom.participants.map(participant => (
                  <div
                    key={participant.userId}
                    className={`p-4 rounded-xl bg-[var(--pulse-surface)] border transition ${
                      speakingUsers.has(participant.userId)
                        ? 'border-rose-500 shadow-lg shadow-rose-500/20'
                        : 'border-[var(--pulse-border)]'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-16 h-16 rounded-full ${participant.avatarColor} flex items-center justify-center text-white text-2xl font-bold relative mb-3 ${speakingUsers.has(participant.userId) ? 'ring-4 ring-rose-400 ring-opacity-50 animate-pulse' : ''}`}>
                        {participant.name.charAt(0)}
                        {participant.isScreenSharing && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <Monitor className="text-[10px] text-[var(--pulse-ink)]" />
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-[var(--pulse-ink)] text-sm">{participant.name}</span>
                      <div className="flex items-center gap-2 mt-2">
                        {participant.isMuted && (
                          <span className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center">
                            <MicOff className="w-3 h-3 text-red-600 dark:text-red-300" aria-hidden />
                          </span>
                        )}
                        {participant.isDeafened && (
                          <span className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center">
                            <VolumeX className="w-3 h-3 text-red-600 dark:text-red-300" aria-hidden />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: Math.max(0, 4 - activeRoom.participants.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-4 rounded-xl border border-dashed border-[var(--pulse-border)] flex items-center justify-center min-h-[150px]">
                    <div className="text-center text-zinc-600">
                      <UserPlus className="w-6 h-6 mb-2 mx-auto" aria-hidden />
                      <p className="text-xs">Open seat</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="px-6 py-4 border-t border-[var(--pulse-border)] bg-[rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-center gap-4">
                {/* Mute / Deafen — active state uses the soft-red tint pattern
                    (bg-red-500/15 + border + lifted text) instead of solid red.
                    The toggle state is a status indicator, not a destructive
                    action; solid red is reserved for Leave below per the
                    universal hang-up convention. */}
                <button
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition border ${
                    isMuted
                      ? 'bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-300 border-red-500/30'
                      : 'bg-[var(--pulse-surface-raised)] hover:bg-[var(--pulse-surface-raised)] text-[var(--pulse-ink)] border-transparent'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-6 h-6" aria-hidden /> : <Mic className="w-6 h-6" aria-hidden />}
                </button>

                <button
                  onClick={toggleDeafen}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition border ${
                    isDeafened
                      ? 'bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-300 border-red-500/30'
                      : 'bg-[var(--pulse-surface-raised)] hover:bg-[var(--pulse-surface-raised)] text-[var(--pulse-ink)] border-transparent'
                  }`}
                  title={isDeafened ? 'Unmute speakers' : 'Mute speakers'}
                >
                  {isDeafened ? <VolumeX className="w-6 h-6" aria-hidden /> : <Volume2 className="w-6 h-6" aria-hidden />}
                </button>

                <button
                  className="w-14 h-14 rounded-full bg-[var(--pulse-surface-raised)] hover:bg-[var(--pulse-surface-raised)] text-[var(--pulse-ink)] flex items-center justify-center transition"
                  title="Share screen"
                >
                  <Monitor className="text-xl" />
                </button>

                <button
                  onClick={leaveRoom}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition"
                  title="Leave call"
                >
                  <PhoneOff className="text-xl" />
                </button>
              </div>
            </div>
          </>
        ) : selectedIsSolo ? (
          // Solo recording — Phase 1 scaffold. Phase 2d wires the actual
          // recording flow (getUserMedia → MediaRecorder → upload → Pulse note).
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-full bg-[var(--pulse-surface)] border border-[var(--pulse-border)] flex items-center justify-center mx-auto mb-5">
                <Mic className="w-8 h-8 text-zinc-500" />
              </div>
              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 mb-2">LIVE · SOLO</p>
              <h3 className="text-lg font-semibold text-[var(--pulse-ink)] mb-2">Talk to yourself, get a Pulse note</h3>
              <p className="text-sm text-[var(--pulse-ink-2)] leading-relaxed mb-6">
                Record 30 seconds to 5 minutes. Pulse transcribes and lands it in Notes.
              </p>
              <button
                disabled
                className="px-5 py-2.5 rounded-lg bg-rose-500/40 text-white text-sm font-medium opacity-60 cursor-not-allowed inline-flex items-center gap-2"
                title="Recording opens with mic access — wired soon"
              >
                <Square className="w-4 h-4" />
                Start recording
              </button>
              <p className="text-[10px] text-zinc-600 mt-3">Recording opens with mic access. Wired soon.</p>
            </div>
          </div>
        ) : selectedRoom ? (
          // Channel-idle — ad-hoc room is selected but the user hasn't joined.
          // Single Go Live CTA opens the pre-join sheet.
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--pulse-border)]">
              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500">LIVE · AD-HOC</p>
            </div>
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center max-w-md">
                <div className={`w-20 h-20 rounded-2xl ${selectedRoom.color} flex items-center justify-center text-[var(--pulse-ink)] mx-auto mb-5`}>
                  <RoomIcon name={selectedRoom.icon} className="w-9 h-9" />
                </div>
                <h3 className="text-xl font-semibold text-[var(--pulse-ink)] mb-1">{selectedRoom.name}</h3>
                {selectedRoom.description && (
                  <p className="text-sm text-[var(--pulse-ink-2)] leading-relaxed mb-5">{selectedRoom.description}</p>
                )}
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 mb-6">
                  {selectedRoom.participants.length}/{selectedRoom.maxParticipants} · {selectedRoom.isPrivate ? 'PRIVATE' : 'OPEN'}
                </div>
                <button
                  onClick={() => setPreJoinRoomId(selectedRoom.id)}
                  className="px-6 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition inline-flex items-center gap-2"
                >
                  <Radio className="w-4 h-4" />
                  Go Live
                </button>
              </div>
            </div>
          </div>
        ) : (
          // No selection — landing. Routed through the shared VoxEmptyState so
          // Live matches every other source. Recent-activity content lands here
          // in Phase 2d.
          <div className="flex-1 min-h-0">
            <VoxEmptyState
              mode="live"
              icon={Radio}
              eyebrow="Live"
              title="No room selected"
              description="Pick a contact or team to go live, or start a solo recording."
            />
          </div>
        )}
      </main>
      )}

      {/* AI sidecar — opt-in panel that slides in from the right when toggled.
          Always mounted (Phase 2d streams the live transcript here); width
          animates from 0 → 320px so the right-pane reflows smoothly. */}
      <aside
        className={`shrink-0 border-l border-[var(--pulse-border)] bg-[var(--pulse-surface)] overflow-hidden transition-[width] duration-[220ms] ease-out ${
          showAISidecar && !studio.singlePane ? 'w-80' : 'w-0'
        }`}
        aria-hidden={!showAISidecar}
      >
        {showAISidecar && (
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--pulse-border)] flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--pulse-rose)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" aria-hidden />
                PULSE · LISTENING
              </span>
              <button
                onClick={() => setShowAISidecar(false)}
                className="text-zinc-500 hover:text-[var(--pulse-ink)] transition"
                aria-label="Close AI sidecar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Live transcript and summary stream here while listening is on.
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* Pre-join sheet — placeholder. Phase 2d wires the real device picker,
          input level meter, mute-on-join toggle, and permission flow. For
          Phase 1 this is a minimal confirm so the path through the UI works. */}
      {preJoinRoomId && (
        <PreJoinSheet
          roomName={rooms.find(r => r.id === preJoinRoomId)?.name ?? ''}
          onCancel={() => setPreJoinRoomId(null)}
          onConfirm={(stream, options) => {
            const target = preJoinRoomId;
            setPreJoinRoomId(null);
            joinRoom(target, stream, options);
          }}
        />
      )}

      {/* Create Room Modal */}
      {showCreateRoom && (
        <CreateRoomModal
          existingNames={rooms.map(r => r.name)}
          onClose={() => setShowCreateRoom(false)}
          onCreate={async (room) => {
            // Persist to backend; use returned room (with server-generated id) if available
            try {
              const persisted = await voiceRoomService.createRoom({
                name: room.name,
                icon: room.icon,
                color: room.color,
                maxParticipants: room.maxParticipants,
                isPrivate: room.isPrivate,
                category: room.category,
                description: room.description,
                settings: room.settings,
              });
              if (persisted) {
                const mapped: VoiceRoom = {
                  id: persisted.id,
                  name: persisted.name,
                  icon: persisted.icon || room.icon,
                  color: persisted.color,
                  participants: [],
                  maxParticipants: persisted.maxParticipants,
                  isPrivate: persisted.isPrivate,
                  category: persisted.category,
                  description: persisted.description,
                  createdAt: persisted.createdAt ? new Date(persisted.createdAt) : new Date(),
                  settings: {
                    bitrate: persisted.settings?.bitrate ?? 64000,
                    voiceActivity: persisted.settings?.voiceActivity ?? true,
                    echoCancel: persisted.settings?.echoCancel ?? true,
                    noiseSuppression: persisted.settings?.noiseSuppression ?? true,
                    autoGainControl: persisted.settings?.autoGainControl ?? true,
                  },
                };
                setRooms(prev => [...prev, mapped]);
              } else {
                // Backend returned null — fall back to local-only room
                console.warn('[VoiceRooms] createRoom returned null, using local room');
                setRooms(prev => [...prev, room]);
              }
            } catch (err) {
              console.error('[VoiceRooms] Backend createRoom failed, using local room:', err);
              setRooms(prev => [...prev, room]);
            }
            setShowCreateRoom(false);
          }}
        />
      )}
    </div>
  );
};

// ============================================
// PRE-JOIN SHEET
// ============================================
// Owns the getUserMedia handshake. Surfaces permission state, device
// selection, and an input level meter before the user is "in." Hands the
// prepared MediaStream to joinRoom on confirm so we don't request the mic
// twice or leak streams when the user cancels.

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'no-mic' | 'error';

interface PreJoinSheetProps {
  roomName: string;
  onCancel: () => void;
  onConfirm: (stream: MediaStream, options: { muteOnJoin: boolean }) => void;
}

const PreJoinSheet: React.FC<PreJoinSheetProps> = ({ roomName, onCancel, onConfirm }) => {
  const [permission, setPermission] = useState<PermissionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [muteOnJoin, setMuteOnJoin] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);

  // Refs for the test stream's audio plumbing — kept out of state to avoid
  // re-render churn on level updates.
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const stopTestStream = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setInputLevel(0);
  }, []);

  const acquireStream = useCallback(async (deviceId?: string) => {
    setErrorMessage(null);
    setPermission('requesting');
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Replace any prior test stream cleanly so devices can be re-picked.
      stopTestStream();
      streamRef.current = stream;

      // Set up the level meter on the new stream.
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setInputLevel(Math.min(100, Math.round(avg * 1.4)));
        animationRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Labels are only visible after permission is granted (browser security),
      // so enumerate AFTER getUserMedia succeeds.
      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all.filter(d => d.kind === 'audioinput');
      setDevices(mics);
      setSelectedDeviceId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? mics[0]?.deviceId ?? '');
      setPermission('granted');
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setPermission('denied');
      } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
        setPermission('no-mic');
      } else if (e?.name === 'NotReadableError') {
        setPermission('error');
        setErrorMessage('Mic is in use by another app. Close it and retry.');
      } else {
        setPermission('error');
        setErrorMessage(e?.message ?? 'Unknown microphone error.');
      }
    }
  }, [stopTestStream]);

  // Kick off the mic request on mount. Clean up on unmount so a cancelled
  // sheet doesn't leak a stream.
  useEffect(() => {
    void acquireStream();
    return () => {
      stopTestStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    void acquireStream(deviceId);
  };

  const handleCancel = () => {
    stopTestStream();
    onCancel();
  };

  const handleConfirm = () => {
    if (!streamRef.current) return;
    // Hand ownership of the stream to the parent. Don't stop the tracks —
    // joinRoom uses this exact stream and owns its lifecycle from here. We
    // do close the meter's AudioContext though; the parent builds its own.
    const stream = streamRef.current;
    streamRef.current = null;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    onConfirm(stream, { muteOnJoin });
  };

  return (
    <div className="fixed inset-0 pulse-modal-scrim flex items-center justify-center z-[60] animate-fadeIn">
      <div className="bg-[var(--pulse-canvas-soft)] rounded-2xl w-full max-w-sm mx-4 border border-[var(--pulse-border)] animate-scaleIn">
        <div className="p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 mb-2">{roomName.toUpperCase()}</p>
          <h3 className="text-base font-semibold text-[var(--pulse-ink)] mb-4">Go live in {roomName}?</h3>

          {permission === 'requesting' && (
            <p className="text-sm text-[var(--pulse-ink-2)] leading-relaxed">Requesting mic access…</p>
          )}

          {permission === 'denied' && (
            <div className="text-sm leading-relaxed">
              <p className="text-[var(--pulse-ink)] mb-2">Pulse needs mic access to go live.</p>
              <p className="text-[var(--pulse-ink-2)]">Open your browser site settings, allow microphone, then retry.</p>
              <button
                onClick={() => void acquireStream(selectedDeviceId || undefined)}
                className="mt-3 text-xs font-mono uppercase tracking-[0.1em] text-[var(--pulse-rose)] hover:text-[var(--pulse-rose)] transition"
              >
                Retry
              </button>
            </div>
          )}

          {permission === 'no-mic' && (
            <p className="text-sm text-[var(--pulse-ink)] leading-relaxed">No microphone detected. Plug one in and retry.</p>
          )}

          {permission === 'error' && (
            <div className="text-sm leading-relaxed">
              <p className="text-[var(--pulse-ink)] mb-2">{errorMessage}</p>
              <button
                onClick={() => void acquireStream(selectedDeviceId || undefined)}
                className="mt-1 text-xs font-mono uppercase tracking-[0.1em] text-[var(--pulse-rose)] hover:text-[var(--pulse-rose)] transition"
              >
                Retry
              </button>
            </div>
          )}

          {permission === 'granted' && (
            <div className="space-y-4">
              {/* Device picker — labels are only populated post-permission. */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 mb-1">
                  Microphone
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--pulse-surface-raised)] rounded-lg text-sm text-[var(--pulse-ink)] border border-[var(--pulse-border-strong)] focus:border-rose-500 focus:outline-none"
                >
                  {devices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input level meter — 24 segments give granular feedback. The
                  last 6 segments tint red as a clip-zone cue. */}
              <div>
                <p className="block text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-500 mb-1.5">
                  Input level
                </p>
                <div
                  className="flex items-end gap-[2px] h-3"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={inputLevel}
                  aria-label="Microphone input level"
                >
                  {Array.from({ length: 24 }).map((_, i) => {
                    const threshold = (i + 1) * (100 / 24);
                    const lit = inputLevel >= threshold;
                    const hotZone = i >= 18;
                    return (
                      <span
                        key={i}
                        className={`flex-1 rounded-sm ${
                          lit
                            ? hotZone
                              ? 'bg-red-400'
                              : 'bg-rose-400'
                            : 'bg-[var(--pulse-surface-raised)]'
                        } ${i < 12 ? 'h-2' : 'h-3'}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Mute-on-join — for landing silent in a noisy call. */}
              <label className="flex items-center gap-2 text-sm text-[var(--pulse-ink)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={muteOnJoin}
                  onChange={(e) => setMuteOnJoin(e.target.checked)}
                  className="w-4 h-4 accent-rose-500"
                />
                Mute on join
              </label>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--pulse-border)] flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-2 bg-[var(--pulse-surface-raised)] text-[var(--pulse-ink)] rounded-lg text-sm font-medium hover:bg-[var(--pulse-surface-raised)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={permission !== 'granted'}
            className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Go Live
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CREATE ROOM MODAL
// ============================================

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (room: VoiceRoom) => void;
  existingNames: string[];
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, onCreate, existingNames }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [maxParticipants, setMaxParticipants] = useState(25);
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('fa-microphone');
  const [selectedColor, setSelectedColor] = useState('bg-indigo-500');

  const icons = ['fa-microphone', 'fa-users', 'fa-brain', 'fa-gamepad', 'fa-music', 'fa-code', 'fa-coffee', 'fa-rocket'];
  // Decorative palette for user-pickable room color. Status hues are
  // deliberately excluded (Status-Stays-Status rule): no emerald (Done),
  // orange (Blocked), red (Critical), yellow (Pending), blue-500 (In
  // Progress). Brand rose is excluded too — it's reserved for live state.
  const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-sky-500', 'bg-cyan-500', 'bg-teal-500', 'bg-slate-500'];

  const trimmed = name.trim();
  const isDuplicate = trimmed.length > 0 && existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase());

  const handleCreate = () => {
    if (!trimmed || isDuplicate) return;

    // Stable UUIDs avoid the Date.now() collision risk when two tabs create
    // rooms in the same millisecond. The backend may overwrite this id when
    // it persists (see VoiceRooms parent onCreate); the local-fallback path
    // keeps this one.
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newRoom: VoiceRoom = {
      id,
      name: trimmed,
      icon: selectedIcon,
      color: selectedColor,
      participants: [],
      maxParticipants,
      isPrivate,
      category,
      description: description.trim() || undefined,
      createdAt: new Date(),
      settings: {
        bitrate: 64000,
        voiceActivity: true,
        echoCancel: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    onCreate(newRoom);
  };

  return (
    <div className="fixed inset-0 pulse-modal-scrim flex items-center justify-center z-[60] animate-fadeIn">
      <div className="bg-[var(--pulse-canvas-soft)] rounded-2xl w-full max-w-md mx-4 border border-[var(--pulse-border)] animate-scaleIn">
        <div className="p-4 border-b border-[var(--pulse-border)] flex items-center justify-between">
          <h3 className="font-bold text-[var(--pulse-ink)]">Create ad-hoc room</h3>
          <button onClick={onClose} className="text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] transition">
            <X />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-[var(--pulse-ink-2)] mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday briefing"
              maxLength={60}
              aria-invalid={isDuplicate}
              className={`w-full px-3 py-2 bg-[var(--pulse-surface-raised)] rounded-lg text-[var(--pulse-ink)] border focus:outline-none ${
                isDuplicate ? 'border-red-500/60 focus:border-red-500' : 'border-[var(--pulse-border-strong)] focus:border-rose-500'
              }`}
            />
            {isDuplicate && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-300">A room with this name already exists.</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-[var(--pulse-ink-2)] mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this for?"
              className="w-full px-3 py-2 bg-[var(--pulse-surface-raised)] rounded-lg text-[var(--pulse-ink)] border border-[var(--pulse-border-strong)] focus:border-rose-500 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-[var(--pulse-ink-2)] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--pulse-surface-raised)] rounded-lg text-[var(--pulse-ink)] border border-[var(--pulse-border-strong)] focus:border-rose-500 focus:outline-none"
            >
              <option value="General">General</option>
              <option value="Meetings">Meetings</option>
              <option value="Work">Work</option>
              <option value="Social">Social</option>
              <option value="Priority">Priority</option>
            </select>
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-xs text-[var(--pulse-ink-2)] mb-2">Icon</label>
            <div className="flex flex-wrap gap-2">
              {icons.map(icon => (
                <button
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition border ${
                    selectedIcon === icon
                      ? 'bg-rose-500/15 text-[var(--pulse-rose)] border-rose-500/30'
                      : 'bg-[var(--pulse-surface-raised)] text-[var(--pulse-ink-2)] hover:bg-[var(--pulse-surface-raised)] border-transparent'
                  }`}
                >
                  <RoomIcon name={icon} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs text-[var(--pulse-ink-2)] mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full ${color} transition transform ${
                    selectedColor === color ? 'ring-2 ring-[var(--pulse-ink)] ring-offset-2 ring-offset-[var(--pulse-canvas-soft)] scale-110' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Max Participants */}
          <div>
            <label className="block text-xs text-[var(--pulse-ink-2)] mb-1">Max people: {maxParticipants}</label>
            <input
              type="range"
              min={2}
              max={50}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
              className="w-full accent-rose-500"
            />
          </div>

          {/* Private Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--pulse-ink)]">Private</span>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-12 h-6 rounded-full transition ${isPrivate ? 'bg-rose-500' : 'bg-[var(--pulse-surface-raised)]'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transform transition ${isPrivate ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--pulse-border)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[var(--pulse-surface-raised)] text-[var(--pulse-ink)] rounded-lg font-medium hover:bg-[var(--pulse-surface-raised)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!trimmed || isDuplicate}
            className="flex-1 py-2.5 bg-rose-500 text-white rounded-lg font-medium hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceRooms;

// Shared playback / recording / chrome state for the Relay Voice Studio shell.
//
// One provider sits inside Relay.tsx and exposes state to the SourcesRail,
// StudioFooter, FloatingMic, and any mode body (RelayTriageStream, ClassicMode,
// …) that wants to drive playback or react to recording. Mode bodies that
// don't need it can ignore it — the existing per-mode local-only behavior
// keeps working until they're migrated to the studio-card pattern (Phase 2).
//
// Why a context, not a hook:
// - StudioFooter + FloatingMic live at the shell level (outside the mode
//   body), and need to stay in sync with whatever the mode body is playing.
// - SPACE → record is a global shortcut; centralizing the toggle means the
//   shortcut handler and the floating mic both call the same function.
// - Playback progress animates on a single interval; keeping it in context
//   means we never have two timers fighting each other.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/** A voice the studio can play. Sender-shape is intentionally permissive so
 *  every mode body can hand off whatever it has without a transform. */
export interface NowPlayingVoice {
  id: string;
  sender: string;
  /** "0:19" — mm:ss. parseDur() in StudioFooter splits this. */
  dur: string;
  /** Free-form: 'dm' | 'quick' | 'note' | 'broadcast' | 'channel' | string. */
  type: string;
  /** Optional transcript for karaoke highlighting. */
  transcript?: string | null;
  /** Optional source tag for analytics / smart playlists. */
  source?: string;
}

export interface RelayStudioState {
  // ── playback ────────────────────────────────────────────────────────────
  nowPlaying: NowPlayingVoice | null;
  isPlaying: boolean;
  /** 0 → 1, advanced by an interval while isPlaying && !isRecording. */
  progress: number;

  // ── recording ───────────────────────────────────────────────────────────
  isRecording: boolean;
  recordingSec: number;

  // ── chrome ──────────────────────────────────────────────────────────────
  railCollapsed: boolean;
}

export interface RelayStudioApi extends RelayStudioState {
  /** Set nowPlaying and start playback from 0. */
  play: (v: NowPlayingVoice) => void;
  /** Toggle pause/resume on the current nowPlaying. No-op if nothing playing. */
  togglePlay: () => void;
  /** Stop playback and clear nowPlaying. */
  stop: () => void;
  /** Toggle the recording surface. Auto-pauses playback when starting. */
  toggleRecording: () => void;
  /** Cancel the active recording (no send). */
  cancelRecording: () => void;
  /** Stop the active recording and notionally send (delegate decides where). */
  stopAndSendRecording: () => void;
  /** Toggle the sources rail collapsed state. Persists to localStorage. */
  toggleRail: () => void;
}

const RelayStudioContext = createContext<RelayStudioApi | null>(null);

const RAIL_COLLAPSED_KEY = 'pulse.relay.railCollapsed';
/** Progress increment per tick. 0.008 over 100ms ≈ 12.5s for a full pass —
 *  long enough that short voices (0:02 … 0:19) feel like they're actually
 *  playing, short enough that demo loops don't bore reviewers. */
const PROGRESS_TICK = 0.008;
const PROGRESS_TICK_MS = 100;

function readInitialRailCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RAIL_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

interface ProviderProps {
  children: React.ReactNode;
  /** Optional: called when a recording is sent. The composer / mode body
   *  hooks into this to do the actual upload. */
  onRecordingSent?: () => void;
  /** Optional: called when a recording is cancelled (cleanup hook). */
  onRecordingCancelled?: () => void;
}

export const RelayStudioProvider: React.FC<ProviderProps> = ({ children, onRecordingSent, onRecordingCancelled }) => {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingVoice | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [railCollapsed, setRailCollapsed] = useState<boolean>(readInitialRailCollapsed);

  // Progress ticker — runs only while playing and not recording. Auto-loops
  // when it hits 1 so the demo state stays alive without consumer intervention.
  useEffect(() => {
    if (!isPlaying || isRecording) return;
    const id = window.setInterval(() => {
      setProgress(p => (p >= 0.99 ? 0 : Math.min(1, p + PROGRESS_TICK)));
    }, PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, isRecording]);

  // Recording timer — increments every 1s while recording.
  useEffect(() => {
    if (!isRecording) return;
    const id = window.setInterval(() => setRecordingSec(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [isRecording]);

  // Persist rail-collapsed state across sessions. CLAUDE.md: cheap UX win,
  // no DB schema needed.
  useEffect(() => {
    try {
      window.localStorage.setItem(RAIL_COLLAPSED_KEY, railCollapsed ? '1' : '0');
    } catch {
      // ignore quota / privacy-mode failures
    }
  }, [railCollapsed]);

  // Stable handler refs so consumers in shortcut hooks don't trigger re-renders.
  const recordingSentRef = useRef(onRecordingSent);
  const recordingCancelledRef = useRef(onRecordingCancelled);
  recordingSentRef.current = onRecordingSent;
  recordingCancelledRef.current = onRecordingCancelled;

  const play = useCallback((v: NowPlayingVoice) => {
    setNowPlaying(v);
    setProgress(0);
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(p => !p);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setNowPlaying(null);
    setProgress(0);
  }, []);

  const toggleRecording = useCallback(() => {
    setIsRecording(prev => {
      if (prev) {
        setRecordingSec(0);
        return false;
      }
      // Starting a recording — pause any playback so audio doesn't compete.
      setIsPlaying(false);
      return true;
    });
  }, []);

  const cancelRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingSec(0);
    recordingCancelledRef.current?.();
  }, []);

  const stopAndSendRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingSec(0);
    recordingSentRef.current?.();
  }, []);

  const toggleRail = useCallback(() => setRailCollapsed(c => !c), []);

  const value = useMemo<RelayStudioApi>(() => ({
    nowPlaying,
    isPlaying,
    progress,
    isRecording,
    recordingSec,
    railCollapsed,
    play,
    togglePlay,
    stop,
    toggleRecording,
    cancelRecording,
    stopAndSendRecording,
    toggleRail,
  }), [
    nowPlaying, isPlaying, progress, isRecording, recordingSec, railCollapsed,
    play, togglePlay, stop, toggleRecording, cancelRecording, stopAndSendRecording, toggleRail,
  ]);

  return <RelayStudioContext.Provider value={value}>{children}</RelayStudioContext.Provider>;
};

export function useRelayStudio(): RelayStudioApi {
  const ctx = useContext(RelayStudioContext);
  if (!ctx) {
    throw new Error('useRelayStudio must be called inside <RelayStudioProvider>');
  }
  return ctx;
}

/** Optional variant for components that may render outside the provider
 *  (e.g. legacy mode bodies during the Phase-2 migration). Returns null
 *  instead of throwing — caller falls back to local state. */
export function useRelayStudioOptional(): RelayStudioApi | null {
  return useContext(RelayStudioContext);
}

// Shared playback / recording / chrome state for the Relay Voice Studio shell.
//
// One provider sits inside Relay.tsx and exposes state to the SourcesRail,
// StudioFooter, FloatingMic, and any mode body (RelayTriageStream, ClassicMode,
// …) that wants to drive playback or react to recording.
//
// Why a context, not a hook:
// - StudioFooter + FloatingMic live at the shell level (outside the mode
//   body), and need to stay in sync with whatever the mode body is playing.
// - SPACE → record is a global shortcut; centralizing the toggle means the
//   shortcut handler and the floating mic both call the same function.
// - The provider owns a SINGLE real <audio> element. That buys three things
//   for free: (a) only one voice plays at a time across the whole Relay
//   surface, (b) the StudioFooter is a true transport — its play/pause/scrub
//   drive the actual audio, its progress is the actual currentTime, and (c)
//   playback survives a mode switch (start a voice in Inbox, navigate to
//   Direct, it keeps playing in the footer). URL resolution + the legacy
//   `voxer` bucket fallback live here so every mode inherits them.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { resolveAudioUrl, legacyAudioUrl } from '../../../services/relay/resolveAudioUrl';

/** A voice the studio can play. Sender-shape is intentionally permissive so
 *  every mode body can hand off whatever it has without a transform. */
export interface NowPlayingVoice {
  id: string;
  sender: string;
  /** "0:19" — mm:ss. Display fallback when real duration metadata is absent. */
  dur: string;
  /** Free-form: 'dm' | 'quick' | 'note' | 'broadcast' | 'channel' | string. */
  type: string;
  /** Optional transcript for karaoke highlighting. */
  transcript?: string | null;
  /** Optional source tag for analytics / smart playlists. */
  source?: string;
  /** Raw stored audio_url (bare path or full URL). Resolved + dual-read
   *  fallback handled internally by play(). When absent, the voice can be
   *  set as "selected" but won't actually play. */
  audioUrl?: string | null;
}

export interface RelayStudioState {
  // ── playback ────────────────────────────────────────────────────────────
  nowPlaying: NowPlayingVoice | null;
  isPlaying: boolean;
  /** 0 → 1, real audio currentTime / duration. */
  progress: number;
  /** Seconds — real audio currentTime. */
  currentTime: number;
  /** Seconds — real audio duration (0 until metadata loads). */
  duration: number;

  // ── recording ───────────────────────────────────────────────────────────
  isRecording: boolean;
  recordingSec: number;

  // ── chrome ──────────────────────────────────────────────────────────────
  railCollapsed: boolean;
}

export interface RelayStudioApi extends RelayStudioState {
  /** Load + play a voice from 0. Resumes in place if it's already nowPlaying
   *  and merely paused. */
  play: (v: NowPlayingVoice) => void;
  /** Pause/resume the current voice. No-op if nothing is loaded. */
  togglePlay: () => void;
  /** Stop playback and clear nowPlaying. */
  stop: () => void;
  /** Scrub to a 0→1 fraction of the current voice. */
  seek: (fraction: number) => void;
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [railCollapsed, setRailCollapsed] = useState<boolean>(readInitialRailCollapsed);

  // Single shared <audio>. Created once; lives for the provider's lifetime.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Recording timer — increments every 1s while recording.
  useEffect(() => {
    if (!isRecording) return;
    const id = window.setInterval(() => setRecordingSec(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [isRecording]);

  // Persist rail-collapsed state across sessions.
  useEffect(() => {
    try {
      window.localStorage.setItem(RAIL_COLLAPSED_KEY, railCollapsed ? '1' : '0');
    } catch {
      // ignore quota / privacy-mode failures
    }
  }, [railCollapsed]);

  const recordingSentRef = useRef(onRecordingSent);
  const recordingCancelledRef = useRef(onRecordingCancelled);
  recordingSentRef.current = onRecordingSent;
  recordingCancelledRef.current = onRecordingCancelled;

  // nowPlaying in a ref so play() can compare without re-creating the callback.
  const nowPlayingRef = useRef<NowPlayingVoice | null>(null);
  nowPlayingRef.current = nowPlaying;

  const play = useCallback((v: NowPlayingVoice) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Re-play of the already-loaded voice → resume in place, don't reload.
    if (nowPlayingRef.current?.id === v.id && audio.src) {
      audio.play().catch(() => setIsPlaying(false));
      return;
    }

    setNowPlaying(v);
    setCurrentTime(0);
    setDuration(0);

    if (!v.audioUrl) {
      // Nothing to actually play — leave it "selected" but paused.
      setIsPlaying(false);
      return;
    }

    audio.pause();
    audio.src = resolveAudioUrl(v.audioUrl);
    audio.currentTime = 0;

    // Dual-read fallback: if the canonical relay URL errors (legacy asset
    // pre-cutover), retry once against the voxer bucket before giving up.
    const onError = () => {
      audio.removeEventListener('error', onError);
      const fallback = legacyAudioUrl(v.audioUrl);
      if (fallback && fallback !== audio.src) {
        audio.src = fallback;
        audio.play().catch(() => setIsPlaying(false));
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener('error', onError, { once: true });
    audio.play().catch(() => setIsPlaying(false));
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setNowPlaying(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const seek = useCallback((fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    audio.currentTime = clamped * audio.duration;
    setCurrentTime(audio.currentTime);
  }, []);

  const toggleRecording = useCallback(() => {
    setIsRecording(prev => {
      if (prev) {
        setRecordingSec(0);
        return false;
      }
      // Starting a recording — pause any playback so audio doesn't compete.
      audioRef.current?.pause();
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

  // Derive progress from real currentTime / duration. Falls back to 0 before
  // metadata loads (duration === 0).
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const value = useMemo<RelayStudioApi>(() => ({
    nowPlaying,
    isPlaying,
    progress,
    currentTime,
    duration,
    isRecording,
    recordingSec,
    railCollapsed,
    play,
    togglePlay,
    stop,
    seek,
    toggleRecording,
    cancelRecording,
    stopAndSendRecording,
    toggleRail,
  }), [
    nowPlaying, isPlaying, progress, currentTime, duration, isRecording, recordingSec, railCollapsed,
    play, togglePlay, stop, seek, toggleRecording, cancelRecording, stopAndSendRecording, toggleRail,
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

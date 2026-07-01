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
import { getPlayableUrl } from '../../../services/relay/resolveAudioUrl';
import { type PlaybackSpeed, PLAYBACK_SPEEDS } from '../../../hooks/usePlaybackSpeed';

export type { PlaybackSpeed };

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
  /** Playback rate (0.5 / 0.75 / 1 / 1.25 / 1.5 / 2). Single source of truth:
   *  the footer's speed control AND every mode's per-message speed picker read
   *  + write this, so they can never disagree. Persisted to localStorage. */
  playbackRate: PlaybackSpeed;

  // ── recording ───────────────────────────────────────────────────────────
  isRecording: boolean;
  recordingSec: number;
  /** True once the focused mode has registered a recording controller, so the
   *  shell (FloatingMic / footer) knows the record gesture drives real capture
   *  rather than the notional fallback. */
  hasRecorder: boolean;

  // ── chrome ──────────────────────────────────────────────────────────────
  /** EFFECTIVE collapsed state of the sources rail = the user's manual
   *  preference OR an auto-collapse forced by a narrow pane. SourcesRail reads
   *  this to render; `toggleRail` still flips the manual preference. */
  railCollapsed: boolean;

  // ── responsive (driven by the measured Relay pane width) ──────────────────
  /** Measured Relay pane width in px (0 before the first measure). */
  paneWidth: number;
  /** Width available to the mode body = paneWidth − effective rail width. */
  bodyWidth: number;
  /** True when the pane is too narrow to afford the labelled rail, so it is
   *  forced to the icon strip regardless of the user's manual preference. */
  railAutoCollapsed: boolean;
  /** True when the mode body is too narrow to show a master + detail pair side
   *  by side — master-detail modes should show one pane at a time. */
  singlePane: boolean;
  /** True when the mode body is phone-grade narrow (< MOBILE_PANE_W). Surfaces
   *  adopt phone chrome — rail-as-sheet, full-bleed, larger touch targets —
   *  rather than the desktop split. Strictly narrower than `singlePane`. */
  isMobilePane: boolean;
  /** True when the sources rail should present as an off-canvas sheet / bottom
   *  bar instead of the inline 200/64px column. Equals `isMobilePane` today;
   *  named separately so the rail-shell change keys off intent, not raw width. */
  railAsSheet: boolean;
}

/** A mode's recording controller. The studio shell (FloatingMic / SPACE /
 *  footer RECORDING surface) drives these, but the mode owns the actual
 *  capture and its own enhance / transcribe / preview → send pipeline. Tap
 *  semantics: start() begins, stop() ends and hands off to the mode's in-pane
 *  preview, cancel() discards. */
export interface RelayRecorder {
  start: () => void;
  stop: () => void;
  cancel: () => void;
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
  /** Set the shared playback rate; applies immediately to the audio element. */
  setPlaybackRate: (rate: PlaybackSpeed) => void;
  /** Cycle to the next preset rate (0.75 → 1 → 1.25 → 1.5 → 2 → 0.75). */
  cyclePlaybackRate: () => void;
  /** Toggle recording. If the focused mode registered a recorder, this drives
   *  the mode's own capture (tap: start ↔ stop → its preview); otherwise it
   *  falls back to the notional surface toggle. Auto-pauses playback. */
  toggleRecording: () => void;
  /** Cancel the active recording (no send) — delegates to the mode recorder. */
  cancelRecording: () => void;
  /** Stop the active recording — delegates to the mode recorder, which hands
   *  off to its in-pane preview. (Footer label is "Stop".) */
  stopAndSendRecording: () => void;
  /** Register the focused mode's recording controller; returns an unregister.
   *  Only one mode is mounted at a time, so only one recorder is ever active. */
  registerRecorder: (rec: RelayRecorder) => () => void;
  /** The focused mode reports whether it is currently capturing, so the footer
   *  RECORDING surface + the FloatingMic icon reflect the truth. */
  notifyRecording: (active: boolean) => void;
  /** Toggle the sources rail collapsed state. Persists to localStorage. */
  toggleRail: () => void;
}

const RelayStudioContext = createContext<RelayStudioApi | null>(null);

const RAIL_COLLAPSED_KEY = 'pulse.relay.railCollapsed';

// Responsive thresholds, all in terms of the measured Relay *pane* width (not
// the viewport). Below RAIL_AUTOCOLLAPSE_W the labelled rail is forced to the
// icon strip to reclaim ~136px for the mode body. SINGLE_PANE_W is a *body*
// width (pane − rail): below it, master + detail can't sit side by side.
const RAIL_AUTOCOLLAPSE_W = 900;
const SINGLE_PANE_W = 560;
const RAIL_W_EXPANDED = 200;
const RAIL_W_COLLAPSED = 64;
// Phone-grade body width. Below this the surface should adopt phone chrome
// (rail-as-sheet / bottom-bar, full-bleed, larger touch targets) rather than
// the desktop split. Strictly narrower than SINGLE_PANE_W (560, the master +
// detail cutoff): a portrait tablet can be single-pane yet still want the
// inline desktop rail. Added for the mobile studio-shell pass — see
// docs/RELAY_MOBILE_STUDIO_SHELL_HANDOFF_2026-06-15.md.
const MOBILE_PANE_W = 480;
// Shared with the legacy usePlaybackSpeed hook so an existing saved preference
// carries over to the unified studio rate.
const PLAYBACK_RATE_KEY = 'voxer-playback-speed';

function readInitialRailCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RAIL_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function readInitialPlaybackRate(): PlaybackSpeed {
  if (typeof window === 'undefined') return 1;
  try {
    const saved = parseFloat(window.localStorage.getItem(PLAYBACK_RATE_KEY) || '');
    if ((PLAYBACK_SPEEDS as readonly number[]).includes(saved)) return saved as PlaybackSpeed;
  } catch {
    /* ignore */
  }
  return 1;
}

interface ProviderProps {
  children: React.ReactNode;
  /** Measured width of the Relay pane in px (from useElementWidth in Relay.tsx).
   *  Drives the responsive layout signals. 0 until the first measure. */
  paneWidth?: number;
  /** Optional: called when a recording is sent. The composer / mode body
   *  hooks into this to do the actual upload. */
  onRecordingSent?: () => void;
  /** Optional: called when a recording is cancelled (cleanup hook). */
  onRecordingCancelled?: () => void;
}

export const RelayStudioProvider: React.FC<ProviderProps> = ({ children, paneWidth = 0, onRecordingSent, onRecordingCancelled }) => {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingVoice | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [railCollapsed, setRailCollapsed] = useState<boolean>(readInitialRailCollapsed);
  const [playbackRate, setPlaybackRateState] = useState<PlaybackSpeed>(readInitialPlaybackRate);
  const [hasRecorder, setHasRecorder] = useState(false);

  // The focused mode's recording controller + a live mirror of isRecording so
  // toggleRecording can decide start-vs-stop without a stale capture.
  const recorderRef = useRef<RelayRecorder | null>(null);
  const isRecordingRef = useRef(false);
  isRecordingRef.current = isRecording;

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

  // Monotonic token to cancel a superseded async URL-sign. play() bumps it and
  // the in-flight signer bails if a newer play()/stop() has moved on — so a slow
  // sign for voice A can't clobber the src of voice B the user just started.
  const playTokenRef = useRef(0);

  // playbackRate in a ref so the []-dep play() reads the current rate, not a
  // stale capture.
  const playbackRateRef = useRef<PlaybackSpeed>(playbackRate);
  playbackRateRef.current = playbackRate;

  // Persist the rate so it survives reloads (shared key with usePlaybackSpeed).
  useEffect(() => {
    try {
      window.localStorage.setItem(PLAYBACK_RATE_KEY, String(playbackRate));
    } catch {
      /* ignore */
    }
  }, [playbackRate]);

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
    audio.playbackRate = playbackRateRef.current;

    // Sign the stored ref lazily so playback works from a private bucket.
    // getPlayableUrl already tries the canonical relay bucket then the legacy
    // voxer bucket (subsuming the old dual-read fallback) and passes blob:/data:
    // through untouched. Signing is async, so stamp a token and bail if a newer
    // play()/stop() supersedes this one before the URL resolves.
    const token = ++playTokenRef.current;
    void (async () => {
      const src = await getPlayableUrl(v.audioUrl);
      if (playTokenRef.current !== token) return; // superseded — drop it
      // If even the signed URL fails to load (e.g. 403 on a private bucket),
      // fall back to "paused, not crashed" rather than spinning.
      const onError = () => setIsPlaying(false);
      audio.addEventListener('error', onError, { once: true });
      audio.src = src;
      audio.currentTime = 0;
      audio.play().catch(() => setIsPlaying(false));
    })();
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
    // Cancel any in-flight sign so a late resolve can't restart playback.
    playTokenRef.current++;
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
    const rec = recorderRef.current;
    if (rec) {
      // A mode owns capture — drive its tap toggle. Its own state change flows
      // back through notifyRecording, which updates isRecording + the timer.
      if (isRecordingRef.current) {
        rec.stop();
      } else {
        audioRef.current?.pause();
        rec.start();
      }
      return;
    }
    // Notional fallback (no mode recorder registered).
    setIsRecording(prev => {
      if (prev) {
        setRecordingSec(0);
        return false;
      }
      audioRef.current?.pause();
      return true;
    });
  }, []);

  const cancelRecording = useCallback(() => {
    recorderRef.current?.cancel();
    setIsRecording(false);
    setRecordingSec(0);
    recordingCancelledRef.current?.();
  }, []);

  const stopAndSendRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec) {
      // Stop → the mode shows its in-pane preview; notifyRecording(false) will
      // clear isRecording. Reset the footer timer now.
      rec.stop();
      setRecordingSec(0);
      return;
    }
    setIsRecording(false);
    setRecordingSec(0);
    recordingSentRef.current?.();
  }, []);

  // Mode registration. Only the focused mode is mounted, so the latest
  // registrant wins; unregister clears recording state if it was mid-capture.
  const registerRecorder = useCallback((rec: RelayRecorder) => {
    recorderRef.current = rec;
    setHasRecorder(true);
    return () => {
      if (recorderRef.current === rec) {
        recorderRef.current = null;
        setHasRecorder(false);
        setIsRecording(false);
        setRecordingSec(0);
      }
    };
  }, []);

  // The focused mode reports its capture state; drives the footer + mic. The
  // existing recordingSec timer keys off isRecording, so it starts/stops here.
  const notifyRecording = useCallback((active: boolean) => {
    setIsRecording(active);
    if (!active) setRecordingSec(0);
  }, []);

  const toggleRail = useCallback(() => setRailCollapsed(c => !c), []);

  const setPlaybackRate = useCallback((rate: PlaybackSpeed) => {
    setPlaybackRateState(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRateState(prev => {
      const idx = PLAYBACK_SPEEDS.indexOf(prev);
      const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  // Derive progress from real currentTime / duration. Falls back to 0 before
  // metadata loads (duration === 0).
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // ── responsive derivation (from the measured pane width) ──────────────────
  // Auto-collapse the rail when the pane is too narrow to afford labels; the
  // effective collapsed state is the user's manual preference OR the auto one.
  // bodyWidth is what's left for the mode body; below SINGLE_PANE_W a master +
  // detail pair can't coexist. paneWidth === 0 (pre-measure) keeps the wide
  // defaults so first paint doesn't flash a collapsed layout.
  const railAutoCollapsed = paneWidth > 0 && paneWidth < RAIL_AUTOCOLLAPSE_W;
  const effectiveRailCollapsed = railCollapsed || railAutoCollapsed;
  const railWidthPx = effectiveRailCollapsed ? RAIL_W_COLLAPSED : RAIL_W_EXPANDED;
  const bodyWidth = paneWidth > 0 ? Math.max(0, paneWidth - railWidthPx) : 0;
  const singlePane = bodyWidth > 0 && bodyWidth < SINGLE_PANE_W;
  // Phone-grade signals for the mobile studio-shell pass. Pane-derived (never a
  // viewport media query) to stay consistent with the rest of Relay. Exposed
  // for the later phases to consume; nothing reads them yet.
  const isMobilePane = bodyWidth > 0 && bodyWidth < MOBILE_PANE_W;
  const railAsSheet = isMobilePane;

  const value = useMemo<RelayStudioApi>(() => ({
    nowPlaying,
    isPlaying,
    progress,
    currentTime,
    duration,
    playbackRate,
    isRecording,
    recordingSec,
    hasRecorder,
    railCollapsed: effectiveRailCollapsed,
    paneWidth,
    bodyWidth,
    railAutoCollapsed,
    singlePane,
    isMobilePane,
    railAsSheet,
    play,
    togglePlay,
    stop,
    seek,
    setPlaybackRate,
    cyclePlaybackRate,
    toggleRecording,
    cancelRecording,
    stopAndSendRecording,
    registerRecorder,
    notifyRecording,
    toggleRail,
  }), [
    nowPlaying, isPlaying, progress, currentTime, duration, playbackRate, isRecording, recordingSec, hasRecorder,
    effectiveRailCollapsed, paneWidth, bodyWidth, railAutoCollapsed, singlePane, isMobilePane, railAsSheet,
    play, togglePlay, stop, seek, setPlaybackRate, cyclePlaybackRate, toggleRecording, cancelRecording, stopAndSendRecording, registerRecorder, notifyRecording, toggleRail,
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

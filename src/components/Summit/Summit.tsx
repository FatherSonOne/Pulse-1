import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  X,
  Settings,
  FileText,
  Share2,
  Download,
  Archive,
  Mail,
  Copy,
  Trash2,
  Plus,
  ChevronDown,
  Volume2,
  VolumeX,
  Brain,
  Clock,
  Check,
  Edit3,
  ExternalLink,
  Loader2,
  AlertCircle,
  Paperclip,
  CloudUpload,
  FolderOpen,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePulseAI } from '../../contexts/PulseAIContext';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import {
  RealtimeVoiceAgentRef,
  VoiceSettings,
  ContextFile,
  AIParticipantMode,
} from '../WarRoom/RealtimeVoiceAgent';
import { RealtimeHistoryItem } from '../../services/realtimeAgentService';
import TranscriptBreathing, { type RailLine, type VoiceState } from './TranscriptBreathing';
import SessionsCanvas, { type LiveSessionView, type SessionExportTarget, type SummitMeterView } from './SessionsCanvas';
import {
  loadVoiceSessions,
  loadVoiceSessionsRemote,
  saveVoiceSession,
  saveVoiceSessionRemote,
  deleteVoiceSession,
  deleteVoiceSessionRemote,
  summarizeForTakeaway,
  formatDuration,
  emptyArtifacts,
  type VoiceSessionRecord,
  type StoredVoiceNote,
  type SessionArtifacts,
  type SessionArtifact,
  type ArtifactKind,
} from './voiceSessionStore';
import { extractArtifact } from './artifactExtractor';
import { findNewToolArtifacts } from './toolCallRouter';
import ArtifactPanel from './ArtifactPanel';
import EndSessionSheet, {
  type EndSessionDestinations,
  type EndSessionProgress,
  type EndSessionTargetKey,
  type EndSessionTargetStatus,
} from './EndSessionSheet';
import {
  exportToWarRoom,
  pushDecisions,
  pushTasks,
  renderMarkdown,
  type SummitSessionPayload,
} from './summitExportService';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useSummitEntitlement } from '../../hooks/useSummitEntitlement';
import './Summit.css';

// Sentinel value stored in `openaiApiKey` state when the user is on the
// hosted-minutes path. RealtimeVoiceAgent treats any non-`sk-` non-empty
// value as "go through the edge function with workspace_id" — so the
// sentinel just needs to be non-empty and not look like a personal key.
const HOSTED_SENTINEL = '__pulse_hosted__';

const SUMMIT_INTRO_KEY = 'summit_intro_seen_v1';

/* ── Crash-resilient Summit metering ──────────────────────────
 * A dropped session-end report (network error, crash, tab close) used to lose
 * the hosted minutes silently. We stamp a pending marker in localStorage
 * before each report and replay un-cleared markers on next mount; the server
 * dedups on session_id (record_summit_minutes), so replays never double-count. */
const PENDING_METER_KEY = 'pulse_summit_pending_meter';
interface PendingMeter {
  sessionId: string;
  workspaceId: string;
  durationSec: number;
}
function readPendingMeters(): PendingMeter[] {
  try {
    const raw = localStorage.getItem(PENDING_METER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingMeter[]) : [];
  } catch {
    return [];
  }
}
function writePendingMeters(list: PendingMeter[]): void {
  try {
    localStorage.setItem(PENDING_METER_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* quota / private mode — non-fatal */
  }
}
function addPendingMeter(m: PendingMeter): void {
  if (!m.sessionId || !m.workspaceId) return;
  writePendingMeters([m, ...readPendingMeters().filter((x) => x.sessionId !== m.sessionId)]);
}
function clearPendingMeter(sessionId: string): void {
  writePendingMeters(readPendingMeters().filter((x) => x.sessionId !== sessionId));
}
async function flushPendingMeter(m: PendingMeter): Promise<boolean> {
  try {
    const { supabase } = await import('../../services/supabase');
    const { error } = await supabase.functions.invoke('summit-session-end', {
      body: { workspace_id: m.workspaceId, duration_sec: m.durationSec, session_id: m.sessionId },
    });
    if (error) return false;
    clearPendingMeter(m.sessionId);
    return true;
  } catch {
    return false;
  }
}

const RealtimeVoiceAgent = lazy(() =>
  import('../WarRoom/RealtimeVoiceAgent').then((m) => ({ default: m.RealtimeVoiceAgent }))
);

export interface VoiceNote {
  id: string;
  content: string;
  timestamp: Date;
  type: 'auto' | 'manual' | 'highlight';
  speaker?: 'user' | 'assistant';
  duration?: number;
  isEditing?: boolean;
}

/** Forward-path alias. New code in Summit/ should use `SessionNote`; the
 * `VoiceNote` name remains as the active export until call sites migrate. */
export type SessionNote = VoiceNote;

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioLevel?: number;
}

interface SummitProps {
  apiKey?: string;
  userId?: string;
  onClose: () => void;
  onSendToArchive?: (notes: VoiceNote[]) => void;
  onSendToEmail?: (notes: VoiceNote[]) => void;
}

const isMobilePlatform =
  Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const EXAMPLE_PROMPTS = [
  'Summarize my unread Pulse messages',
  'Review my next 3 meetings',
  'Draft replies to overdue threads',
];

const RAIL_LINE_MAX = 60;

const truncateForRail = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length <= RAIL_LINE_MAX) return trimmed;
  return trimmed.slice(0, RAIL_LINE_MAX - 1) + '…';
};

// Outlook caps mailto at ~2k chars; Gmail (web) ~8k; Apple Mail ~30k.
// We pick a safe-ish 1800 below which most clients open without truncating.
const MAILTO_BODY_MAX = 1800;

// Window in which an auto artifact is considered a duplicate of a fresh
// tool artifact (the model spoke + called the tool nearly together).
const TOOL_DEDUPE_WINDOW_MS = 8000;

/**
 * Token-set Jaccard-ish similarity for two short artifact strings. Returns
 * the fraction of meaningful tokens (≥3 chars) shared between the two,
 * normalized by the smaller token set so paraphrases score high. Cheap and
 * good enough for "did the model just say this same thing?" — not a real
 * NLP similarity.
 */
const artifactSimilarity = (a: string, b: string): number => {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3),
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((w) => {
    if (tb.has(w)) inter += 1;
  });
  return inter / Math.min(ta.size, tb.size);
};

/**
 * Trigger a Markdown download. Wraps the blob → object URL → click flow with
 * a deferred `revokeObjectURL` so Safari/Firefox don't cancel the download
 * when the URL is freed inside the same tick.
 */
const downloadMarkdown = (markdown: string, filename: string): void => {
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer the revoke so Safari/Firefox don't cancel the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/**
 * Open a mail client draft with the rendered Markdown as the body. Outlook
 * caps mailto at ~2k chars, so when the body is over MAILTO_BODY_MAX we
 * skip the broken draft and copy to clipboard instead. Returns 'opened',
 * 'copied', or 'failed' so callers can toast accurately.
 */
const openEmailDraft = async (
  markdown: string,
  subject = 'Summit session',
): Promise<'opened' | 'copied' | 'failed'> => {
  if (markdown.length > MAILTO_BODY_MAX) {
    try {
      await navigator.clipboard.writeText(markdown);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(markdown)}`;
    window.open(url);
    return 'opened';
  } catch {
    return 'failed';
  }
};

const Summit: React.FC<SummitProps> = ({
  apiKey,
  userId = 'anonymous',
  onClose,
  onSendToArchive,
  onSendToEmail,
}) => {
  /* ── Workspace bridge (hoisted — needed by the token resolver below) ── */
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? '';

  /* ── Entitlements (used by intro copy + post-session messaging) ─── */
  const { isTrialing, pulseTier } = useEntitlements();

  /* ── Summit entitlement (BYO vs hosted, caps, trial state) ──── */
  // Single source of truth: meter values, session-length cap, and any
  // pre-flight access reason. No network call here — the hook reads from
  // entitlements + the local BYO key metadata table.
  const summitEnt = useSummitEntitlement();

  /* ── Token resolution ─────────────────────────────────────── */
  // No edge function call at mount. The actual token mint happens once,
  // inside RealtimeVoiceAgent on Connect (with workspace_id forwarded).
  //
  //   openaiApiKey holds either:
  //     - the personal BYO `sk-…` key (BYO mode), OR
  //     - HOSTED_SENTINEL (hosted mode — agent will mint via edge fn), OR
  //     - '' (workspace not loaded yet, or no entitlement)
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [isResolvingToken, setIsResolvingToken] = useState<boolean>(true);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenErrorCode, setTokenErrorCode] = useState<string | null>(null);
  const [tokenAttempt, setTokenAttempt] = useState(0);
  // Local override for the session-end usage bump (POST returns the new
  // monthly total; reflect it immediately in the meter without waiting for
  // the next entitlements refresh).
  const [usedMinutesOverride, setUsedMinutesOverride] = useState<number | null>(null);
  // Guard against firing the 60-second warning toast more than once.
  const warnedNearEndRef = useRef(false);

  // Derived values consumed throughout the component.
  const isByoSession = summitEnt.isByoMode;
  const sessionMaxSec = summitEnt.sessionMaxSec || 1800;
  const usedMinutes = usedMinutesOverride ?? summitEnt.usedMinutes;
  const capMinutes = summitEnt.capMinutes;

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      setIsResolvingToken(true);
      setTokenError(null);
      setTokenErrorCode(null);
      try {
        // Priority 1: explicit prop (debug / admin override)
        if (apiKey) {
          if (!cancelled) setOpenaiApiKey(apiKey);
          return;
        }

        // Wait for the hook before deciding.
        if (summitEnt.isLoading) return;

        // Priority 2: personal BYO key on file.
        if (summitEnt.isByoMode) {
          const { fetchByoKey } = await import('../../services/byoKeyService');
          const byoKey = await fetchByoKey();
          if (cancelled) return;
          if (byoKey) {
            setOpenaiApiKey(byoKey);
            return;
          }
          // Hook said BYO but plaintext came back null — fall through to
          // hosted and let the entitlement check below handle it.
        }

        // Priority 3: hosted, gated by tier + monthly cap.
        if (!workspaceId) {
          setTokenError('Workspace not loaded yet. Reload Pulse and try again.');
          setOpenaiApiKey('');
          return;
        }
        if (!summitEnt.hasAccess) {
          const reason = summitEnt.reason;
          setTokenErrorCode(reason ? reason.toUpperCase() : null);
          if (reason === 'no_subscription') {
            setTokenError('Summit requires a Pulse Team or Growth plan. Upgrade to unlock live voice.');
          } else if (reason === 'wrong_tier') {
            setTokenError('Summit is not included in your current plan. Switch to Team or Growth, or add your own OpenAI key in Settings.');
          } else if (reason === 'trial_cap') {
            setTokenError('You have used your 15 trial minutes. Upgrade to Pulse Team for 60 min/month, or add your own OpenAI key.');
          } else if (reason === 'over_cap') {
            setTokenError('You have used your monthly Summit minutes. Wait for the next billing period, upgrade, or add your own OpenAI key.');
          }
          setOpenaiApiKey('');
          return;
        }
        // Hosted + entitled: agent will mint at connect time via the edge
        // function. The sentinel just signals "ready, hosted path".
        setOpenaiApiKey(HOSTED_SENTINEL);
        // New session — clear any prior session-end usage override so the
        // meter reflects the canonical hook value.
        setUsedMinutesOverride(null);
      } finally {
        if (!cancelled) setIsResolvingToken(false);
      }
    };
    resolve();
    return () => { cancelled = true; };
  }, [
    apiKey,
    tokenAttempt,
    workspaceId,
    summitEnt.isLoading,
    summitEnt.isByoMode,
    summitEnt.hasAccess,
    summitEnt.reason,
  ]);

  const retryToken = useCallback(() => {
    setTokenAttempt((n) => n + 1);
  }, []);

  /* ── Voice + session state ────────────────────────────────── */
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [history, setHistory] = useState<RealtimeHistoryItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<VoiceSessionRecord[]>([]);

  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [artifacts, setArtifacts] = useState<SessionArtifacts>(() => emptyArtifacts());
  const [artifactsCollapsed, setArtifactsCollapsed] = useState(false);
  // Mobile (<=680px, matching Summit.css): start the artifact panel collapsed
  // to a right-edge handle so the voice canvas owns the screen. Tapping the
  // handle pulls it up as a full-bleed sheet; the sheet header collapses it
  // back. Desktop keeps the panel open inline.
  const isMobileSummit = useMediaQuery('(max-width: 680px)');
  useEffect(() => {
    if (isMobileSummit) setArtifactsCollapsed(true);
  }, [isMobileSummit]);
  const [showNotes, setShowNotes] = useState(false);
  const [autoNotes, setAutoNotes] = useState(true);
  const [newNoteText, setNewNoteText] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  const [showSettings, setShowSettings] = useState(false);

  // First-visit explainer. Gated by localStorage so it shows once per browser.
  // Suppressed entirely if the user already has a BYO key on file (they
  // clearly know what they're doing).
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (apiKey) return false; // debug/admin override path — skip
    try {
      return localStorage.getItem(SUMMIT_INTRO_KEY) !== 'true';
    } catch {
      return false; // private mode / quota — don't pester
    }
  });

  useEffect(() => {
    if (!showIntro) return;
    let cancelled = false;
    (async () => {
      try {
        const { getByoKeyStatus } = await import('../../services/byoKeyService');
        const status = await getByoKeyStatus();
        if (!cancelled && status.hasKey) {
          // User already has a key — they don't need the intro.
          setShowIntro(false);
          try { localStorage.setItem(SUMMIT_INTRO_KEY, 'true'); } catch { /* noop */ }
        }
      } catch { /* hook fails silently — leave the intro shown */ }
    })();
    return () => { cancelled = true; };
  }, [showIntro]);

  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    try { localStorage.setItem(SUMMIT_INTRO_KEY, 'true'); } catch { /* noop */ }
  }, []);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voice: 'alloy',
    turnDetection: 'semantic_vad',
    noiseReduction: 'near_field',
    language: 'en',
  });
  const [aiMode, setAiMode] = useState<AIParticipantMode>('active');

  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [contextText, setContextText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentRef = useRef<RealtimeVoiceAgentRef>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  // Tracks which function_call/function_result pairs have already been
  // mirrored into artifact buckets, so a re-emitted history update doesn't
  // duplicate them. Reset when a new session starts.
  const routedToolPairsRef = useRef<Set<string>>(new Set());

  const isNative = Capacitor.isNativePlatform();

  /* ── Pulse AI bridge ──────────────────────────────────────── */
  const pulseAI = usePulseAI();
  const pulseDataPrompt = pulseAI.buildPulseDataPrompt();

  /* ── Sidebar→Summit handoff ───────────────────────────────── */
  const [handoffHint, setHandoffHint] = useState<string | null>(null);

  /* ── End-session sheet ────────────────────────────────────── */
  const [showEndSheet, setShowEndSheet] = useState(false);
  const [endProgress, setEndProgress] = useState<EndSessionProgress>({});

  useEffect(() => {
    pulseAI.setIsVoiceActive(true);
    return () => pulseAI.setIsVoiceActive(false);
  }, [pulseAI]);

  // Consume any pending handoff staged from the Pulse AI sidebar. Runs once
  // on mount; the consumer clears the staged handoff atomically. The ref guard
  // protects against React 18 StrictMode's double-invoke in dev — without it
  // the handoff is consumed twice before `setPendingHandoff(null)` flushes,
  // duplicating the context file with the same key.
  const handoffConsumedRef = useRef(false);
  useEffect(() => {
    if (handoffConsumedRef.current) return;
    handoffConsumedRef.current = true;
    const handoff = pulseAI.consumePendingHandoff();
    if (!handoff) return;

    const formattedThread = handoff.thread
      .map((m) => `${m.role === 'user' ? 'USER' : 'PULSE AI'}: ${m.content}`)
      .join('\n\n');
    const handoffContext: ContextFile = {
      id: `handoff-${handoff.createdAt}`,
      name: 'From Pulse AI sidebar',
      type: 'text',
      content:
        `The user just escalated this thread from the Pulse AI sidebar (section: ${handoff.originSection}). ` +
        `Pick up where they left off — don't restart the conversation. Build on what was already discussed.\n\n` +
        `--- prior thread ---\n\n${formattedThread}`,
    };
    setContextFiles((prev) => [handoffContext, ...prev]);
    setHandoffHint(handoff.openingHint ?? null);
    toast.success('Picking up from Pulse AI', { duration: 2200 });
    // intentionally one-shot on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Banner self-dismisses once the user actually connects — the prior thread
  // is already in context by then; nothing more for the banner to communicate.
  useEffect(() => {
    if (handoffHint && isConnected) setHandoffHint(null);
  }, [handoffHint, isConnected]);

  // Soft timeout if the user lingers without connecting.
  useEffect(() => {
    if (!handoffHint) return;
    const t = window.setTimeout(() => setHandoffHint(null), 30000);
    return () => window.clearTimeout(t);
  }, [handoffHint]);

  const effectiveContextFiles = useMemo<ContextFile[]>(() => {
    if (!pulseDataPrompt || pulseDataPrompt === 'No Pulse data context available.') {
      return contextFiles;
    }
    const pulseContextFile: ContextFile = {
      id: 'pulse-data-context',
      name: 'Pulse App Data',
      content: `You are Pulse AI voice assistant. You have access to the user's live Pulse data.\n\n${pulseDataPrompt}`,
      type: 'text',
    };
    return [pulseContextFile, ...contextFiles];
  }, [contextFiles, pulseDataPrompt]);

  /* ── Past sessions hydration ──────────────────────────────── */
  // Two-phase: paint instantly from the localStorage cache, then reconcile
  // with Supabase once we have a workspace + user. Cache stays warm via
  // write-through inside loadVoiceSessionsRemote.
  useEffect(() => {
    setRecentSessions(loadVoiceSessions());
  }, []);

  useEffect(() => {
    if (!workspaceId || !userId || userId === 'anonymous') return;
    let cancelled = false;
    loadVoiceSessionsRemote(userId, workspaceId)
      .then((remote) => {
        if (!cancelled) setRecentSessions(remote);
      })
      .catch(() => {
        /* offline / RLS — already fell back to cache inside the helper */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId]);

  /* ── Helpers ──────────────────────────────────────────────── */
  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const extractKeyPhrases = (text: string): string | null => {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    const importantPatterns =
      /\b(should|must|important|key|note|remember|action|todo|deadline|decision|agreed|confirmed|next steps?|follow[- ]?up)\b/i;
    const importantSentences = sentences.filter((s) => importantPatterns.test(s));
    return importantSentences[0]?.trim() ?? null;
  };

  const addNote = useCallback((note: VoiceNote) => {
    setNotes((prev) => [...prev, note]);
    setTimeout(() => {
      if (notesContainerRef.current) {
        notesContainerRef.current.scrollTop = notesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  /* ── Artifact handlers ────────────────────────────────────── */
  const addArtifactToBucket = useCallback(
    (kind: ArtifactKind, item: SessionArtifact) => {
      setArtifacts((prev) => {
        const bucketKey = (
          kind === 'decision'
            ? 'decisions'
            : kind === 'task'
            ? 'tasks'
            : kind === 'reference'
            ? 'references'
            : 'questions'
        ) as keyof SessionArtifacts;
        let bucket = prev[bucketKey];

        // Dedupe: when a tool-sourced artifact arrives, drop any recent
        // auto artifact in the same bucket with similar content. The model
        // often "thinks out loud" before calling create_decision/create_task,
        // and the heuristic extractor would otherwise card the same thought
        // twice (one AUTO, one TOOL).
        if (item.source === 'tool') {
          const cutoff = item.timestamp - TOOL_DEDUPE_WINDOW_MS;
          bucket = bucket.filter((existing) => {
            if (existing.source !== 'auto') return true;
            if (existing.timestamp < cutoff) return true;
            return artifactSimilarity(existing.content, item.content) < 0.5;
          });
        }
        return { ...prev, [bucketKey]: [...bucket, item] };
      });
    },
    []
  );

  const handleArtifactAdd = useCallback(
    (kind: ArtifactKind, content: string) => {
      addArtifactToBucket(kind, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        kind,
        content,
        timestamp: Date.now(),
        source: 'manual',
      });
    },
    [addArtifactToBucket]
  );

  const handleArtifactUpdate = useCallback(
    (kind: ArtifactKind, id: string, content: string) => {
      setArtifacts((prev) => {
        const bucketKey = (
          kind === 'decision'
            ? 'decisions'
            : kind === 'task'
            ? 'tasks'
            : kind === 'reference'
            ? 'references'
            : 'questions'
        ) as keyof SessionArtifacts;
        return {
          ...prev,
          [bucketKey]: prev[bucketKey].map((a) => (a.id === id ? { ...a, content } : a)),
        };
      });
    },
    []
  );

  const handleArtifactDelete = useCallback((kind: ArtifactKind, id: string) => {
    setArtifacts((prev) => {
      const bucketKey = (
        kind === 'decision'
          ? 'decisions'
          : kind === 'task'
          ? 'tasks'
          : kind === 'reference'
          ? 'references'
          : 'questions'
      ) as keyof SessionArtifacts;
      return {
        ...prev,
        [bucketKey]: prev[bucketKey].filter((a) => a.id !== id),
      };
    });
  }, []);

  const handleQuickCapture = useCallback(() => {
    addNote({
      id: generateId(),
      content: `Capture at ${new Date().toLocaleTimeString()}`,
      timestamp: new Date(),
      type: 'highlight',
    });
    toast.success('Pinned to session', { duration: 1400 });
  }, [addNote]);

  /* ── Voice agent callbacks ────────────────────────────────── */
  const handleConnectionChange = useCallback((connected: boolean, connecting: boolean) => {
    setIsConnected(connected);
    setIsConnecting(connecting);
    if (connected) {
      setVoiceState('listening');
      if (!sessionIdRef.current) sessionIdRef.current = generateId();
      toast.success('Connected', { duration: 1400 });
    } else if (!connecting) {
      setVoiceState('idle');
    } else {
      setVoiceState('connecting');
    }
  }, []);

  const handleTranscript = useCallback(
    (text: string, role: 'user' | 'assistant', isFinal: boolean) => {
      setCurrentTranscript(text);

      if (role === 'user') {
        setVoiceState(isFinal ? 'thinking' : 'listening');
      } else {
        setVoiceState(isFinal ? 'listening' : 'speaking');
      }

      if (isFinal && text.trim()) {
        const newMessage: ConversationMessage = {
          id: generateId(),
          role,
          content: text,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);

        if (role === 'assistant' && autoNotes) {
          const keyPhrase = extractKeyPhrases(text);
          if (keyPhrase) {
            addNote({
              id: generateId(),
              content: keyPhrase,
              timestamp: new Date(),
              type: 'auto',
              speaker: 'assistant',
            });
          }
        }

        // Auto-extract structured artifacts from either speaker. Conservative —
        // returns at most one artifact per turn and skips short/ambiguous lines.
        if (autoNotes) {
          const candidate = extractArtifact({ text, speaker: role });
          if (candidate) {
            addArtifactToBucket(candidate.kind, {
              id: generateId(),
              kind: candidate.kind,
              content: candidate.content,
              timestamp: Date.now(),
              source: 'auto',
              speaker: role,
              meta: candidate.meta,
            });
          }
        }
      }
    },
    [autoNotes, addNote, addArtifactToBucket]
  );

  const handleAudioLevel = useCallback(
    (level: number, isListening: boolean, isSpeaking: boolean) => {
      setAudioLevel(level);
      if (isConnected && !isPaused) {
        if (isSpeaking) setVoiceState('speaking');
        else if (isListening) setVoiceState('listening');
      }
    },
    [isConnected, isPaused]
  );

  const handleHistoryUpdate = useCallback((newHistory: RealtimeHistoryItem[]) => {
    setHistory(newHistory);
    const lastItem = newHistory[newHistory.length - 1];
    if (lastItem?.type === 'function_call') setVoiceState('thinking');

    // Route any newly-completed tool calls into artifact buckets. The router
    // mutates routedToolPairsRef in place, so subsequent updates skip pairs
    // we've already mirrored.
    const candidates = findNewToolArtifacts(newHistory, routedToolPairsRef.current);
    if (candidates.length > 0) {
      candidates.forEach((c) => {
        addArtifactToBucket(c.artifact.kind, {
          id: `tool-${c.pairId}`,
          kind: c.artifact.kind,
          content: c.artifact.content,
          source: 'tool',
          timestamp: Date.now(),
          meta: c.artifact.meta,
        });
        routedToolPairsRef.current.add(c.pairId);
      });
    }
  }, [addArtifactToBucket]);

  /* ── Notes export ─────────────────────────────────────────── */
  const formatNotesForExport = useCallback(
    (format: 'text' | 'markdown' | 'json'): string => {
      const header = `Summit Notes\nSession: ${new Date().toLocaleString()}\n`;
      switch (format) {
        case 'markdown':
          return `# ${header}\n\n${notes
            .map(
              (n) =>
                `- **[${n.type.toUpperCase()}]** ${n.content}\n  *${n.timestamp.toLocaleTimeString()}*`
            )
            .join('\n\n')}`;
        case 'json':
          return JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              sessionId: userId,
              notes: notes.map((n) => ({
                content: n.content,
                type: n.type,
                timestamp: n.timestamp.toISOString(),
                speaker: n.speaker,
              })),
            },
            null,
            2
          );
        default:
          return `${header}${'='.repeat(40)}\n\n${notes
            .map(
              (n) =>
                `[${n.type.toUpperCase()}] ${n.content}\n  - ${n.timestamp.toLocaleTimeString()}`
            )
            .join('\n\n')}`;
      }
    },
    [notes, userId]
  );

  const handleNativeShare = async () => {
    const content = formatNotesForExport('text');
    if (isNative) {
      try {
        await Share.share({
          title: 'Summit Notes',
          text: content,
          dialogTitle: 'Share your notes',
        });
        toast.success('Shared successfully');
      } catch {
        toast.error('Share failed');
      }
    } else {
      try {
        await navigator.clipboard.writeText(content);
        toast.success('Notes copied to clipboard');
      } catch {
        toast.error('Failed to copy notes');
      }
    }
    setShowExportMenu(false);
  };

  const handleDownloadNotes = (format: 'text' | 'markdown' | 'json') => {
    const content = formatNotesForExport(format);
    const extensions = { text: 'txt', markdown: 'md', json: 'json' };
    const mimeTypes = { text: 'text/plain', markdown: 'text/markdown', json: 'application/json' };
    const blob = new Blob([content], { type: mimeTypes[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summit-notes-${new Date().toISOString().slice(0, 10)}.${extensions[format]}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast.success(`Notes downloaded as ${format.toUpperCase()}`);
    setShowExportMenu(false);
  };

  const handleSendToArchiveLocal = () => {
    if (onSendToArchive) {
      onSendToArchive(notes);
      toast.success('Notes sent to Archives');
    } else {
      const existingArchives = JSON.parse(localStorage.getItem('pulse_voice_archives') || '[]');
      existingArchives.push({
        id: generateId(),
        notes,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('pulse_voice_archives', JSON.stringify(existingArchives));
      toast.success('Notes archived locally');
    }
    setShowExportMenu(false);
  };

  const handleSendToEmail = async () => {
    if (onSendToEmail) {
      onSendToEmail(notes);
    } else {
      const outcome = await openEmailDraft(formatNotesForExport('text'), 'Summit Notes');
      if (outcome === 'opened') toast.success('Email client opened');
      else if (outcome === 'copied')
        toast.success('Notes copied to clipboard (too long for email draft)');
      else toast.error('Email draft failed');
    }
    setShowExportMenu(false);
  };

  const handleCopyNotes = async () => {
    try {
      await navigator.clipboard.writeText(formatNotesForExport('text'));
      toast.success('Notes copied to clipboard');
    } catch {
      toast.error('Failed to copy notes');
    }
    setShowExportMenu(false);
  };

  const handleAddManualNote = () => {
    if (!newNoteText.trim()) return;
    addNote({
      id: generateId(),
      content: newNoteText.trim(),
      timestamp: new Date(),
      type: 'manual',
    });
    setNewNoteText('');
    toast.success('Note added');
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success('Note deleted');
  };

  const handleStartEditNote = (note: VoiceNote) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const handleSaveEditNote = () => {
    if (!editingNoteId || !editingNoteContent.trim()) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === editingNoteId ? { ...n, content: editingNoteContent.trim() } : n))
    );
    setEditingNoteId(null);
    setEditingNoteContent('');
    toast.success('Note updated');
  };

  /* ── Voice connection ─────────────────────────────────────── */
  const connectInFlightRef = useRef(false);

  const handleConnect = useCallback(async () => {
    // Guard against double-firing from rapid Space presses or click+kbd races.
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    setIsConnecting(true);

    // Wait for the lazy-loaded agent to mount. We poll the ref instead of using
    // a promise because the lazy boundary doesn't expose a ready signal — but
    // we cap to 3s and surface a clear retry path instead of hanging forever.
    let attempts = 0;
    const maxAttempts = 30;
    while (!agentRef.current && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    if (!agentRef.current) {
      toast.error('Voice agent did not load. Reload Pulse to retry.');
      setIsConnecting(false);
      connectInFlightRef.current = false;
      return;
    }
    try {
      await agentRef.current.connect();
    } catch (error) {
      let errorMessage = 'Failed to connect. Try again or check your sign-in.';
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('Microphone not found') || msg.includes('NotFoundError')) {
          errorMessage = 'Microphone not found. Connect a mic and try again.';
        } else if (msg.includes('not accessible') || msg.includes('NotReadableError')) {
          errorMessage = 'Microphone is in use by another app. Close it and retry.';
        } else if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
          errorMessage = 'Microphone access blocked. Allow it in browser settings, then retry.';
        } else if (/401|unauthorized|invalid.*token|expired/i.test(msg)) {
          errorMessage = 'Sign-in expired. Reload Pulse or sign in again to reconnect.';
          // Surface the warning banner so the user has a recovery path.
          setOpenaiApiKey('');
          setTokenError('Sign-in expired. Reload Pulse or sign in again to reconnect voice.');
        } else {
          errorMessage = msg || errorMessage;
        }
      }
      toast.error(errorMessage, { duration: 5000 });
      setVoiceState('idle');
      setIsConnecting(false);
    } finally {
      connectInFlightRef.current = false;
    }
  }, []);

  /* ── Persist session on disconnect / unmount ─────────────── */
  const persistSession = useCallback(() => {
    if (!sessionIdRef.current) return;
    const hasArtifacts =
      artifacts.decisions.length +
        artifacts.tasks.length +
        artifacts.references.length +
        artifacts.questions.length >
      0;
    if (notes.length === 0 && messages.length === 0 && !hasArtifacts) {
      sessionIdRef.current = null;
      return;
    }
    const startedAt = sessionStartTime ?? Date.now() - sessionElapsed * 1000;
    const endedAt = Date.now();
    const storedNotes: StoredVoiceNote[] = notes.map((n) => ({
      id: n.id,
      content: n.content,
      timestamp: n.timestamp.getTime(),
      type: n.type,
      speaker: n.speaker,
    }));
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const record: VoiceSessionRecord = {
      id: sessionIdRef.current,
      startedAt,
      endedAt,
      durationSec: Math.max(1, sessionElapsed),
      captureCount: notes.length,
      takeaway: summarizeForTakeaway(storedNotes),
      lastLine: lastAssistant
        ? lastAssistant.content.length > 200
          ? lastAssistant.content.slice(0, 197) + '…'
          : lastAssistant.content
        : undefined,
      notes: storedNotes,
      artifacts,
    };
    const next = saveVoiceSession(record);
    setRecentSessions(next);
    sessionIdRef.current = null;

    // Cloud write — fire-and-forget. localStorage already holds the record
    // so the recent-sessions list is correct even if this fails or the user
    // is offline.
    if (workspaceId && userId && userId !== 'anonymous') {
      void saveVoiceSessionRemote(record, userId, workspaceId);

      // Hosted-minutes meter — only increment if this session was on the
      // hosted path. BYO sessions don't count against any Pulse quota.
      if (!isByoSession && record.durationSec > 0) {
        // Stamp a pending marker BEFORE the call so a dropped/failed report
        // (network error, crash, tab close) is replayed on next load. The
        // server dedups on session_id, so the replay is a safe no-op if the
        // original call already landed — increment_usage is additive, so the
        // dedup is what prevents a double-count, NOT idempotency of the RPC.
        addPendingMeter({ sessionId: record.id, workspaceId, durationSec: record.durationSec });
        void (async () => {
          try {
            const { supabase } = await import('../../services/supabase');
            const { data, error } = await supabase.functions.invoke('summit-session-end', {
              body: { workspace_id: workspaceId, duration_sec: record.durationSec, session_id: record.id },
            });
            if (error) throw error;
            clearPendingMeter(record.id);
            if (data && typeof data.total_minutes === 'number') {
              // Optimistic local override — paints the meter immediately
              // while the entitlements hook re-fetches in the background.
              setUsedMinutesOverride(data.total_minutes);
              void summitEnt.refresh();
            }
          } catch (err) {
            // Non-fatal — the pending marker above replays on next load.
            console.warn('[Summit] summit-session-end failed (will retry on next load):', err);
          }
        })();
      }
    }

    // Reverse-direction awareness: surface a compact summary of what got
    // captured to the Pulse AI sidebar, so its next answers can reference
    // the session ("you decided to push the vendor MSA, …").
    const summaryParts: string[] = [];
    if (artifacts.decisions.length > 0) {
      summaryParts.push(
        `${artifacts.decisions.length} decision${artifacts.decisions.length === 1 ? '' : 's'}: ` +
          artifacts.decisions
            .slice(0, 3)
            .map((a) => a.content.slice(0, 80))
            .join(' | '),
      );
    }
    if (artifacts.tasks.length > 0) {
      summaryParts.push(
        `${artifacts.tasks.length} task${artifacts.tasks.length === 1 ? '' : 's'}: ` +
          artifacts.tasks
            .slice(0, 3)
            .map((a) => a.content.slice(0, 80))
            .join(' | '),
      );
    }
    if (artifacts.questions.length > 0) {
      summaryParts.push(
        `${artifacts.questions.length} open question${artifacts.questions.length === 1 ? '' : 's'}`,
      );
    }
    pulseAI.setSummitArtifactsSummary(summaryParts.join(' · '));
  }, [notes, messages, sessionElapsed, sessionStartTime, artifacts, pulseAI, workspaceId, userId, isByoSession]);

  const handleDisconnect = useCallback(async () => {
    if (agentRef.current) {
      await agentRef.current.disconnect();
    }
    persistSession();
    setVoiceState('idle');
    setAudioLevel(0);
    setIsPaused(false);
    setCurrentTranscript('');
  }, [persistSession]);

  /* ── End-session flow ─────────────────────────────────────── */
  // The Stop button now opens the destinations sheet instead of dropping
  // straight into disconnect. Empty sessions skip the sheet — there's
  // nothing to send anywhere, and a confirm modal would be friction.
  const handleStopRequest = useCallback(() => {
    const totalArtifacts =
      artifacts.decisions.length +
      artifacts.tasks.length +
      artifacts.references.length +
      artifacts.questions.length;
    if (totalArtifacts === 0 && notes.length === 0) {
      void handleDisconnect();
      return;
    }
    setShowEndSheet(true);
  }, [artifacts, notes, handleDisconnect]);

  const buildPayload = useCallback((): SummitSessionPayload => {
    const startedAt = sessionStartTime ?? Date.now() - sessionElapsed * 1000;
    const endedAt = Date.now();
    const storedNotes: StoredVoiceNote[] = notes.map((n) => ({
      id: n.id,
      content: n.content,
      timestamp: n.timestamp.getTime(),
      type: n.type,
      speaker: n.speaker,
    }));
    return {
      startedAt,
      endedAt,
      durationSec: Math.max(1, sessionElapsed),
      notes: storedNotes,
      artifacts,
      takeaway: summarizeForTakeaway(storedNotes),
    };
  }, [sessionStartTime, sessionElapsed, notes, artifacts]);

  const handleEndConfirm = useCallback(
    async (destinations: EndSessionDestinations) => {
      const payload = buildPayload();
      const results: string[] = [];
      const failures: string[] = [];

      // Seed progress in 'running' for each selected target so all the
      // checked rows get a Sending pill the instant Send & end is clicked.
      const initial: EndSessionProgress = {};
      const selected: EndSessionTargetKey[] = [];
      if (destinations.markdown) selected.push('markdown');
      if (destinations.warRoom) selected.push('warRoom');
      if (destinations.email) selected.push('email');
      if (destinations.pushDecisions) selected.push('pushDecisions');
      if (destinations.pushTasks) selected.push('pushTasks');
      selected.forEach((k) => (initial[k] = 'running'));
      setEndProgress(initial);
      const mark = (k: EndSessionTargetKey, status: EndSessionTargetStatus) =>
        setEndProgress((prev) => ({ ...prev, [k]: status }));

      if (destinations.markdown) {
        try {
          const md = renderMarkdown(payload);
          downloadMarkdown(md, `summit-${new Date().toISOString().slice(0, 10)}.md`);
          results.push('Markdown saved');
          mark('markdown', 'success');
        } catch {
          failures.push('Markdown save failed');
          mark('markdown', 'failed');
        }
      }

      if (destinations.warRoom) {
        const wr = await exportToWarRoom(payload, {
          title: destinations.warRoomTitle,
        });
        if (wr.ok) {
          results.push('Sent to War Room');
          mark('warRoom', 'success');
        } else {
          failures.push(`War Room: ${wr.error ?? 'failed'}`);
          mark('warRoom', 'failed');
        }
      }

      if (destinations.email) {
        const md = renderMarkdown(payload);
        const outcome = await openEmailDraft(md);
        if (outcome === 'opened') {
          results.push('Email draft opened');
          mark('email', 'success');
        } else if (outcome === 'copied') {
          results.push('Session copied to clipboard (too long for email draft)');
          mark('email', 'success');
        } else {
          failures.push('Email draft failed');
          mark('email', 'failed');
        }
      }

      // Filter out tool-sourced items — those were already persisted by the
      // realtime model during the session (see toolCallRouter.ts).
      const pushableDecisions = artifacts.decisions.filter((a) => a.source !== 'tool');
      const pushableTasks = artifacts.tasks.filter((a) => a.source !== 'tool');

      if (destinations.pushDecisions && workspaceId && userId !== 'anonymous') {
        const r = await pushDecisions(workspaceId, userId, pushableDecisions);
        if (r.ok > 0) results.push(`${r.ok} decision${r.ok === 1 ? '' : 's'} pushed`);
        if (r.fail > 0) failures.push(`${r.fail} decision${r.fail === 1 ? '' : 's'} failed`);
        mark('pushDecisions', r.fail === 0 ? 'success' : 'failed');
      } else if (destinations.pushDecisions && (!workspaceId || userId === 'anonymous')) {
        failures.push('Decisions: workspace or sign-in required');
        mark('pushDecisions', 'failed');
      }

      if (destinations.pushTasks && workspaceId && userId !== 'anonymous') {
        const r = await pushTasks(workspaceId, userId, pushableTasks);
        if (r.ok > 0) results.push(`${r.ok} task${r.ok === 1 ? '' : 's'} pushed`);
        if (r.fail > 0) failures.push(`${r.fail} task${r.fail === 1 ? '' : 's'} failed`);
        mark('pushTasks', r.fail === 0 ? 'success' : 'failed');
      } else if (destinations.pushTasks && (!workspaceId || userId === 'anonymous')) {
        failures.push('Tasks: workspace or sign-in required');
        mark('pushTasks', 'failed');
      }

      if (results.length > 0) {
        toast.success(results.join(' · '));
      }
      if (failures.length > 0) {
        toast.error(failures.join(' · '));
      }

      setShowEndSheet(false);
      setEndProgress({});
      await handleDisconnect();
    },
    [buildPayload, workspaceId, userId, artifacts, handleDisconnect],
  );

  const handleEndSkip = useCallback(() => {
    setShowEndSheet(false);
    void handleDisconnect();
  }, [handleDisconnect]);

  const handleEndCancel = useCallback(() => {
    setShowEndSheet(false);
    setEndProgress({});
  }, []);

  const handleTogglePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    if (agentRef.current) {
      if (newPaused) agentRef.current.pauseSession();
      else agentRef.current.resumeSession();
    }
    toast.success(newPaused ? 'Paused' : 'Resumed', { duration: 1200 });
  };

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (agentRef.current) {
        if (next) agentRef.current.muteAudio();
        else agentRef.current.unmuteAudio();
      }
      return next;
    });
  }, []);

  /* ── Context file management ─────────────────────────────── */
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const newFile: ContextFile = {
          id: generateId(),
          name: file.name,
          type: 'file',
          content,
          size: file.size,
        };
        setContextFiles((prev) => [...prev, newFile]);
        toast.success(`Added: ${file.name}`);
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleAddTextContext = useCallback(() => {
    if (!contextText.trim()) return;
    const newContext: ContextFile = {
      id: generateId(),
      name: `Note ${contextFiles.filter((f) => f.type === 'text').length + 1}`,
      type: 'text',
      content: contextText.trim(),
    };
    setContextFiles((prev) => [...prev, newContext]);
    setContextText('');
    toast.success('Context added');
  }, [contextText, contextFiles]);

  const removeContextFile = useCallback((id: string) => {
    setContextFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleExportTranscript = useCallback(() => {
    if (messages.length === 0) {
      toast.error('No conversation to export');
      return;
    }
    const header = `# Summit Transcript\n\n**Exported:** ${new Date().toLocaleString()}\n\n---\n\n`;
    const content = messages
      .map((msg) => {
        const speaker = msg.role === 'user' ? '**You**' : '**Pulse AI**';
        return `${speaker} *(${msg.timestamp.toLocaleTimeString()})*:\n> ${msg.content.replace(
          /\n/g,
          '\n> '
        )}\n`;
      })
      .join('\n');
    downloadMarkdown(header + content, `summit-${new Date().toISOString().slice(0, 10)}.md`);
    toast.success('Transcript exported');
  }, [messages]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /* ── Cleanup on unmount ──────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (agentRef.current) {
        agentRef.current.disconnect().catch(() => {});
      }
      persistSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Crash-resilient metering: replay + tab-close marker ──── */
  // Mirror live-session metering inputs into refs so a pagehide / tab-close
  // (where React cleanup may not run) can still stamp a pending meter.
  const sessionElapsedRef = useRef(0);
  useEffect(() => {
    sessionElapsedRef.current = sessionElapsed;
  }, [sessionElapsed]);

  const liveMeterRef = useRef<{ sessionId: string; workspaceId: string } | null>(null);
  useEffect(() => {
    liveMeterRef.current =
      isConnected && sessionIdRef.current && !isByoSession && workspaceId
        ? { sessionId: sessionIdRef.current, workspaceId }
        : null;
  }, [isConnected, isByoSession, workspaceId]);

  // Replay any metering reports that never confirmed (prior crash / offline).
  // Dedup on session_id makes each replay a safe no-op if it already landed.
  useEffect(() => {
    const pending = readPendingMeters();
    if (pending.length === 0) return;
    void (async () => {
      let landed = false;
      for (const m of pending) {
        if (await flushPendingMeter(m)) landed = true;
      }
      if (landed) void summitEnt.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab-close / background while a hosted session is live: stamp a pending
  // marker (synchronous localStorage write) so the minutes are reported on
  // next load even if the clean session-end path never runs. Dedup on
  // session_id prevents double-counting against the normal end report.
  useEffect(() => {
    const stampLiveMeter = () => {
      const live = liveMeterRef.current;
      if (!live) return;
      addPendingMeter({
        sessionId: live.sessionId,
        workspaceId: live.workspaceId,
        durationSec: Math.max(1, sessionElapsedRef.current),
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stampLiveMeter();
    };
    window.addEventListener('pagehide', stampLiveMeter);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', stampLiveMeter);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  /* ── Auto-scroll history (notes panel) ───────────────────── */
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages]);

  /* ── Session timer ───────────────────────────────────────── */
  useEffect(() => {
    if (isConnected && !sessionStartTime) {
      setSessionStartTime(Date.now());
      warnedNearEndRef.current = false;
    }
    if (!isConnected && sessionStartTime) {
      setSessionStartTime(null);
      setSessionElapsed(0);
      warnedNearEndRef.current = false;
    }
  }, [isConnected, sessionStartTime]);

  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      setSessionElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  /* ── Session length cap + warning (PR2) ───────────────────── */
  // Fires a one-time toast 60s before the cap, then a hard auto-disconnect
  // at the cap. Both client-side; PR3 layers tier-aware caps on top of the
  // same machinery by varying sessionMaxSec.
  useEffect(() => {
    if (!isConnected || !sessionStartTime) return;
    const warnAt = sessionMaxSec - 60;
    if (!warnedNearEndRef.current && sessionElapsed >= warnAt && sessionElapsed < sessionMaxSec) {
      warnedNearEndRef.current = true;
      toast('1 minute remaining in this Summit session.', { duration: 5000 });
    }
    if (sessionElapsed >= sessionMaxSec) {
      toast('Session ended — reached the time limit.', { duration: 4000 });
      agentRef.current?.disconnect();
    }
  }, [sessionElapsed, isConnected, sessionStartTime, sessionMaxSec]);

  /* ── Stuck-session safety: visibilitychange ───────────────── */
  // Pause audio capture once a session has been hidden for 2 min, and
  // disconnect entirely after 10 min hidden. This catches the "user closed
  // the laptop / switched tabs and forgot" case where the cap timer alone
  // would keep an open mic burning credits.
  useEffect(() => {
    if (!isConnected) return;
    let hiddenSince: number | null = null;
    let pausedByVisibility = false;

    const onVis = () => {
      if (document.hidden) {
        hiddenSince = Date.now();
      } else {
        hiddenSince = null;
        if (pausedByVisibility) {
          agentRef.current?.resumeSession();
          pausedByVisibility = false;
        }
      }
    };

    const tick = window.setInterval(() => {
      if (!hiddenSince) return;
      const hiddenFor = Date.now() - hiddenSince;
      if (hiddenFor > 600_000) {
        toast('Session ended — Summit was hidden for 10 minutes.', { duration: 4000 });
        agentRef.current?.disconnect();
        return;
      }
      if (hiddenFor > 120_000 && !pausedByVisibility) {
        agentRef.current?.pauseSession();
        pausedByVisibility = true;
      }
    }, 10_000);

    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isConnected]);

  /* ── Stuck-session safety: transcript inactivity ──────────── */
  // If the transcript history hasn't advanced for 5 minutes while connected,
  // the session is wedged (or the user walked away from a visible tab).
  // Watches history.length instead of mic audioLevel so a long AI monologue
  // doesn't false-positive as silence.
  const lastTranscriptActivityRef = useRef<number>(Date.now());
  const lastHistoryLenRef = useRef<number>(0);
  useEffect(() => {
    if (history.length !== lastHistoryLenRef.current) {
      lastHistoryLenRef.current = history.length;
      lastTranscriptActivityRef.current = Date.now();
    }
  }, [history]);
  useEffect(() => {
    if (!isConnected) return;
    lastTranscriptActivityRef.current = Date.now();
    lastHistoryLenRef.current = history.length;
    const interval = window.setInterval(() => {
      if (Date.now() - lastTranscriptActivityRef.current > 300_000) {
        toast('Session ended — no activity for 5 minutes.', { duration: 4000 });
        agentRef.current?.disconnect();
      }
    }, 30_000);
    return () => window.clearInterval(interval);
    // history intentionally omitted — we only reset on (re)connect; the other
    // effect tracks history changes and pushes the ref forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  /* ── Reset captures when session ends ─────────────────────── */
  useEffect(() => {
    if (!isConnected && !isConnecting) {
      // After persistSession runs and disconnect propagates, clear in-memory captures
      // so the next session starts fresh. Recent sessions list now holds the prior data.
      setNotes([]);
      setMessages([]);
      setArtifacts(emptyArtifacts());
      routedToolPairsRef.current = new Set();
    }
    // intentional: only reset when transitioning away from connected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isConnecting]);

  /* ── Keyboard shortcuts ──────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      // Ignore meta-modified shortcuts so we don't shadow browser ones
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!openaiApiKey || isResolvingToken) return;
        if (isConnecting) return;
        if (!isConnected) handleConnect();
        else handleTogglePause();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleQuickCapture();
      } else if (e.key === 'm' || e.key === 'M') {
        if (!isConnected) return;
        e.preventDefault();
        handleToggleMute();
      } else if (e.key === 'Escape') {
        // Modal-priority Escape stack: outer-most dismissal first.
        if (showIntro) dismissIntro();
        else if (showExportMenu) setShowExportMenu(false);
        else if (showSettings) setShowSettings(false);
        else if (showContextDrawer) setShowContextDrawer(false);
        else if (showNotes) setShowNotes(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    openaiApiKey,
    isResolvingToken,
    isConnecting,
    isConnected,
    handleConnect,
    handleQuickCapture,
    handleToggleMute,
    showExportMenu,
    showSettings,
    showContextDrawer,
    showNotes,
    showIntro,
    dismissIntro,
    onClose,
  ]);

  /* ── Derived view models ─────────────────────────────────── */
  const railLines: RailLine[] = useMemo(() => {
    return messages.slice(-5).map((m) => ({
      id: m.id,
      text: truncateForRail(m.content),
      role: m.role,
    }));
  }, [messages]);

  const modelLabel = useMemo(() => {
    const v = (voiceSettings.voice ?? 'alloy').toUpperCase();
    const lang = (voiceSettings.language ?? 'en').toUpperCase();
    return `GPT-4O · ${v} · ${lang}`;
  }, [voiceSettings.voice, voiceSettings.language]);

  const liveSession: LiveSessionView | undefined = useMemo(() => {
    if (!isConnected && !isConnecting) return undefined;
    return {
      startedAt: sessionStartTime ?? Date.now(),
      durationSec: sessionElapsed,
      captures: notes.map((n) => ({
        id: n.id,
        content: n.content,
        type: n.type,
        speaker: n.speaker,
      })),
      takeawayDraft:
        notes.find((n) => n.type === 'highlight')?.content ??
        notes.find((n) => n.type === 'auto')?.content,
      currentTranscript,
    };
  }, [isConnected, isConnecting, sessionStartTime, sessionElapsed, notes, currentTranscript]);

  const stateLabel =
    voiceState === 'connecting'
      ? 'Connecting'
      : voiceState === 'listening'
      ? isPaused
        ? 'Paused'
        : 'Listening'
      : voiceState === 'thinking'
      ? 'Thinking'
      : voiceState === 'speaking'
      ? 'Speaking'
      : isConnected
      ? 'Connected'
      : 'Disconnected';

  const sessionTimerText = sessionStartTime ? formatDuration(sessionElapsed) : undefined;

  // Meter view passed down to SessionsCanvas. Memoised so the canvas doesn't
  // re-render on every animation frame just from a stable object reference.
  const summitMeter: SummitMeterView = useMemo(() => ({
    isByoSession,
    usedMinutes,
    capMinutes,
  }), [isByoSession, usedMinutes, capMinutes]);

  /* ── Prompt selection: stash as text context, then connect ── */
  const handlePromptSelect = useCallback(
    (prompt: string) => {
      const promptContext: ContextFile = {
        id: generateId(),
        name: 'Opening prompt',
        type: 'text',
        content: `Opening prompt the user wants you to start with:\n\n"${prompt}"`,
      };
      setContextFiles((prev) => [promptContext, ...prev]);
      toast(`Try asking: "${prompt}"`, { duration: 3500 });
      handleConnect();
    },
    [handleConnect]
  );

  // Pending session deletes awaiting their undo window. Maps session id →
  // setTimeout handle for the deferred remote hard-delete. Deferring the
  // remote delete keeps Undo a pure local restore (no re-upsert needed).
  const pendingSessionDeletesRef = useRef<Map<string, number>>(new Map());

  // On unmount, honor any still-pending deletes (user navigated away without
  // undoing) by flushing them to the server immediately.
  useEffect(() => {
    const pending = pendingSessionDeletesRef.current;
    return () => {
      pending.forEach((timer, id) => {
        window.clearTimeout(timer);
        void deleteVoiceSessionRemote(id);
      });
      pending.clear();
    };
  }, []);

  const handleSessionDelete = useCallback((id: string) => {
    // Capture the full record from the cache so Undo can restore it locally.
    const record = loadVoiceSessions().find((s) => s.id === id);

    // Optimistic local removal — the grid updates instantly.
    setRecentSessions(deleteVoiceSession(id));

    // Defer the irreversible remote hard-delete behind the undo window.
    const UNDO_MS = 6000;
    const timer = window.setTimeout(() => {
      pendingSessionDeletesRef.current.delete(id);
      void deleteVoiceSessionRemote(id);
    }, UNDO_MS);
    pendingSessionDeletesRef.current.set(id, timer);

    if (!record) {
      // No cached record to restore — keep the prior behavior, still deferred.
      toast.success('Session removed');
      return;
    }

    toast(
      (t) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          Session removed
          <button
            type="button"
            onClick={() => {
              const timerHandle = pendingSessionDeletesRef.current.get(id);
              if (timerHandle !== undefined) {
                window.clearTimeout(timerHandle);
                pendingSessionDeletesRef.current.delete(id);
              }
              setRecentSessions(saveVoiceSession(record));
              toast.dismiss(t.id);
            }}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              color: 'var(--pulse-accent, #f43f5e)',
              font: 'inherit',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: UNDO_MS },
    );
  }, []);

  /* ── Past-session re-export ───────────────────────────────── */
  const handleSessionExport = useCallback(
    async (session: VoiceSessionRecord, target: SessionExportTarget) => {
      const payload: SummitSessionPayload = {
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSec: session.durationSec,
        notes: session.notes,
        artifacts: session.artifacts ?? emptyArtifacts(),
        takeaway: session.takeaway,
      };
      if (target === 'markdown') {
        try {
          const md = renderMarkdown(payload);
          downloadMarkdown(md, `summit-${new Date(session.endedAt).toISOString().slice(0, 10)}.md`);
          toast.success('Markdown saved');
        } catch {
          toast.error('Markdown save failed');
        }
        return;
      }
      if (target === 'warRoom') {
        const result = await exportToWarRoom(payload);
        if (result.ok) {
          toast.success('Sent to War Room');
        } else {
          toast.error(`War Room: ${result.error ?? 'failed'}`);
        }
        return;
      }
      if (target === 'email') {
        const md = renderMarkdown(payload);
        const outcome = await openEmailDraft(md);
        if (outcome === 'opened') toast.success('Email draft opened');
        else if (outcome === 'copied')
          toast.success('Session copied to clipboard (too long for email draft)');
        else toast.error('Email draft failed');
      }
    },
    [],
  );

  const handleSessionView = useCallback(
    (session: VoiceSessionRecord) => {
      setNotes(
        session.notes.map((n) => ({
          id: n.id,
          content: n.content,
          timestamp: new Date(n.timestamp),
          type: n.type,
          speaker: n.speaker,
        }))
      );
      setArtifacts(session.artifacts ?? emptyArtifacts());
      setShowNotes(true);
      toast.success('Loaded session');
    },
    []
  );

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="pulse-voice-chat">
      {/* HEADER */}
      <header className="pvc-header">
        <div className="pvc-header-left">
          <span className="pvc-brand" aria-hidden="true" />
          <div className="pvc-header-text">
            <h1>Summit</h1>
            <span className={`pvc-status pvc-status--${isPaused ? 'paused' : voiceState}`}>
              {stateLabel}
              {sessionTimerText && <span className="pvc-timer">{sessionTimerText}</span>}
            </span>
          </div>
        </div>

        <div className="pvc-header-right">
          <button
            type="button"
            className="pvc-icon-btn"
            onClick={handleExportTranscript}
            disabled={messages.length === 0}
            title="Export transcript"
          >
            <Download size={18} />
          </button>

          <button
            type="button"
            className={`pvc-icon-btn ${showNotes ? 'pvc-icon-btn--active' : ''}`}
            onClick={() => setShowNotes((s) => !s)}
            title="Toggle notes"
          >
            <FileText size={18} />
            {notes.length > 0 && <span className="pvc-badge">{notes.length}</span>}
          </button>

          <button
            type="button"
            className={`pvc-icon-btn ${showSettings ? 'pvc-icon-btn--active' : ''}`}
            onClick={() => setShowSettings((s) => !s)}
            title="Settings"
          >
            <Settings size={18} />
          </button>

          <button
            type="button"
            className="pvc-icon-btn pvc-icon-btn--close"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="pvc-main">
        <TranscriptBreathing
          voiceState={voiceState}
          audioLevel={audioLevel}
          isPaused={isPaused}
          recentLines={railLines}
          modelLabel={modelLabel}
          sessionTimer={sessionTimerText}
        />

        <div className="pvc-canvas">
          {/* Token resolution feedback */}
          {(isResolvingToken || (!isResolvingToken && !openaiApiKey)) && (
            <div style={{ padding: '0.75rem 2rem 0' }}>
              {isResolvingToken && (
                <div className="pvc-api-warning">
                  <Loader2 size={18} className="animate-spin" />
                  <div>
                    <strong>Preparing voice session</strong>
                    <p>Fetching a secure session token.</p>
                  </div>
                </div>
              )}
              {!isResolvingToken && !openaiApiKey && (
                <div className="pvc-api-warning" role="alert">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Voice chat unavailable</strong>
                    <p>
                      {tokenError ?? 'OpenAI Realtime is temporarily unavailable. Try again in a moment.'}
                    </p>
                    <button type="button" className="pvc-api-warning-retry" onClick={retryToken}>
                      <RefreshCw size={13} aria-hidden="true" />
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {handoffHint && (
            <div className="pvc-handoff" role="status" aria-label="Handoff from Pulse AI">
              <div className="pvc-handoff-body">
                <span className="pvc-handoff-tag">FROM PULSE AI</span>
                <p className="pvc-handoff-text">
                  Picking up where you left off
                  {handoffHint && <>: <em>"{handoffHint}"</em></>}
                </p>
              </div>
              <button
                type="button"
                className="pvc-handoff-dismiss"
                onClick={() => setHandoffHint(null)}
                aria-label="Dismiss handoff banner"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <SessionsCanvas
            isConnected={isConnected}
            isConnecting={isConnecting}
            liveSession={liveSession}
            recentSessions={recentSessions}
            examplePrompts={EXAMPLE_PROMPTS}
            onConnect={handleConnect}
            onPromptSelect={handlePromptSelect}
            onSessionView={handleSessionView}
            onSessionDelete={handleSessionDelete}
            onSessionExport={handleSessionExport}
            summitMeter={summitMeter}
          />

          {/* Controls row */}
          <div className="pvc-controls">
            <button
              type="button"
              className={`pvc-control-btn ${isMuted ? 'pvc-control-btn--muted' : ''}`}
              onClick={handleToggleMute}
              disabled={!isConnected}
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <button
              type="button"
              className={`pvc-main-btn pvc-main-btn--${voiceState} ${
                isPaused ? 'pvc-main-btn--paused' : ''
              }`}
              onClick={isConnected ? handleTogglePause : handleConnect}
              disabled={!openaiApiKey || isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Connecting</span>
                </>
              ) : !isConnected ? (
                <>
                  <Mic size={14} />
                  <span>Connect</span>
                  <span className="pvc-main-btn-key">SPACE</span>
                </>
              ) : isPaused ? (
                <>
                  <Play size={14} />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause size={14} />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="pvc-control-btn pvc-control-btn--stop"
              onClick={handleStopRequest}
              disabled={!isConnected}
              title="End session"
            >
              <MicOff size={16} />
            </button>

            <button
              type="button"
              className={`pvc-control-btn ${
                contextFiles.length > 0 ? 'pvc-control-btn--has-context' : ''
              }`}
              onClick={() => setShowContextDrawer(true)}
              title="Add context"
            >
              <Paperclip size={16} />
              {contextFiles.length > 0 && <span className="pvc-badge">{contextFiles.length}</span>}
            </button>
          </div>
        </div>

        {/* ARTIFACT PANEL — third column */}
        <ArtifactPanel
          artifacts={artifacts}
          collapsed={artifactsCollapsed}
          onToggleCollapsed={() => setArtifactsCollapsed((c) => !c)}
          onAdd={handleArtifactAdd}
          onUpdate={handleArtifactUpdate}
          onDelete={handleArtifactDelete}
          sessionId={sessionIdRef.current ?? undefined}
        />
      </div>

      {/* LEGEND */}
      <nav className="pvc-legend" aria-label="Summit keyboard shortcuts">
        <span className="pvc-legend-item">
          <kbd className="pvc-legend-key">SPACE</kbd>
          <span>Connect</span>
        </span>
        <span className="pvc-legend-item">
          <kbd className="pvc-legend-key">N</kbd>
          <span>Capture</span>
        </span>
        <span className="pvc-legend-item">
          <kbd className="pvc-legend-key">M</kbd>
          <span>Mute</span>
        </span>
        <span className="pvc-legend-item">
          <kbd className="pvc-legend-key">ESC</kbd>
          <span>Close</span>
        </span>
      </nav>

      {/* Hidden RealtimeVoiceAgent — handles actual connection */}
      {openaiApiKey && (
        <div className="hidden">
          <ErrorBoundary
            componentName="Voice Connection"
            onError={() => {
              setIsConnected(false);
              setIsConnecting(false);
              setVoiceState('idle');
              toast.error(
                isMobilePlatform
                  ? 'Voice features may be limited on mobile devices'
                  : 'Voice connection failed. Please try again.'
              );
            }}
          >
            <Suspense fallback={null}>
              <RealtimeVoiceAgent
                ref={agentRef}
                userId={userId}
                sessionId="pulse-voice-chat"
                openaiApiKey={openaiApiKey}
                workspaceId={workspaceId}
                voiceSettings={voiceSettings}
                contextFiles={effectiveContextFiles}
                aiMode={aiMode}
                onTranscript={handleTranscript}
                onHistoryUpdate={handleHistoryUpdate}
                onConnectionChange={handleConnectionChange}
                onAudioLevel={handleAudioLevel}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* NOTES PANEL */}
      <div className={`pvc-notes-panel ${showNotes ? 'pvc-notes-panel--open' : ''}`}>
        <div className="pvc-notes-header">
          <h2>
            <FileText size={16} />
            Session Notes
          </h2>
          <div className="pvc-notes-header-actions">
            <div className="pvc-export-menu-container">
              <button
                type="button"
                className={`pvc-icon-btn ${showExportMenu ? 'pvc-icon-btn--active' : ''}`}
                onClick={() => setShowExportMenu((s) => !s)}
                disabled={notes.length === 0}
                title="Export notes"
              >
                <Share2 size={16} />
              </button>
              {showExportMenu && (
                <div className="pvc-export-menu">
                  {/* Notes-only quick exports during a session. Full session
                      export (artifacts + War Room + push targets) lives in
                      the End-Session sheet — this menu is just for the
                      raw notes blob. */}
                  <button type="button" onClick={handleCopyNotes}>
                    <Copy size={14} /> Copy notes
                  </button>
                  <button type="button" onClick={() => handleDownloadNotes('markdown')}>
                    <Download size={14} /> Notes as MD
                  </button>
                  <button type="button" onClick={handleNativeShare}>
                    <ExternalLink size={14} /> Share
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="pvc-icon-btn"
              onClick={() => setShowNotes(false)}
              title="Close notes"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <div className="pvc-notes-settings">
          <label className="pvc-toggle">
            <input
              type="checkbox"
              checked={autoNotes}
              onChange={(e) => setAutoNotes(e.target.checked)}
            />
            <span className="pvc-toggle-slider" />
            <span className="pvc-toggle-label">
              <Brain size={13} />
              Auto-capture key points
            </span>
          </label>
        </div>

        <div className="pvc-notes-list" ref={notesContainerRef}>
          {notes.length === 0 ? (
            <div className="pvc-notes-empty">
              <FileText size={28} />
              <p>No notes yet</p>
              <span>Press N to capture</span>
            </div>
          ) : (
            notes.map((note) => (
              <div key={note.id} className={`pvc-note pvc-note--${note.type}`}>
                <div className="pvc-note-header">
                  <span className={`pvc-note-type pvc-note-type--${note.type}`}>
                    {note.type === 'auto' ? 'Auto' : note.type === 'highlight' ? 'Pin' : 'Manual'}
                  </span>
                  <span className="pvc-note-time">
                    <Clock size={11} />
                    {note.timestamp.toLocaleTimeString()}
                  </span>
                </div>

                {editingNoteId === note.id ? (
                  <div className="pvc-note-edit">
                    <textarea
                      value={editingNoteContent}
                      onChange={(e) => setEditingNoteContent(e.target.value)}
                      aria-label="Edit note"
                      autoFocus
                    />
                    <div className="pvc-note-edit-actions">
                      <button type="button" onClick={handleSaveEditNote}>
                        <Check size={13} /> Save
                      </button>
                      <button type="button" onClick={() => setEditingNoteId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="pvc-note-content">{note.content}</p>
                    <div className="pvc-note-actions">
                      <button
                        type="button"
                        onClick={() => handleStartEditNote(note)}
                        title="Edit"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pvc-notes-add">
          <input
            type="text"
            placeholder="Add a note…"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManualNote()}
          />
          <button
            type="button"
            onClick={handleAddManualNote}
            disabled={!newNoteText.trim()}
            title="Add note"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* FIRST-VISIT INTRO MODAL */}
      {showIntro && !isConnected && !isConnecting && (
        <>
          <div
            className="pvc-backdrop pvc-intro-backdrop"
            onClick={dismissIntro}
            aria-hidden="true"
          />
          <div
            className="pvc-intro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pvc-intro-title"
          >
            <header className="pvc-intro-head">
              <h2 id="pvc-intro-title">Welcome to Summit</h2>
              <button
                type="button"
                className="pvc-icon-btn"
                onClick={dismissIntro}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>

            <div className="pvc-intro-body">
              <p className="pvc-intro-lede">
                Summit is live voice with Pulse AI — real-time, two-way conversation powered by
                OpenAI Realtime. There are two ways to use it:
              </p>

              <div className="pvc-intro-options">
                <article className="pvc-intro-option">
                  <h3>Bring your own OpenAI key</h3>
                  <p>
                    Paste your personal API key in Settings → AI. OpenAI bills you directly
                    (~$0.25/min). No monthly cap, no overage charges from Pulse.
                  </p>
                  <button
                    type="button"
                    className="pvc-intro-cta pvc-intro-cta--primary"
                    autoFocus
                    onClick={() => {
                      dismissIntro();
                      // Cross-section navigation via the shell's existing
                      // pulse:navigate listener (App.tsx). Routes to the AI
                      // Intelligence section where AIProvidersCard lives.
                      window.dispatchEvent(new CustomEvent('pulse:navigate', {
                        detail: { view: 'SETTINGS', section: 'ai_intelligence' },
                      }));
                    }}
                  >
                    Add my OpenAI key
                  </button>
                </article>

                {/* Hosted-minutes option: when the user is on Free (no trial),
                    swap the dismiss CTA for an upgrade CTA so they don't end
                    up clicking through to a NO_SUBSCRIPTION error. */}
                {(pulseTier === 'free' && !isTrialing) ? (
                  <article className="pvc-intro-option">
                    <h3>Use Pulse-hosted minutes</h3>
                    <p>
                      Summit minutes are included with Pulse Team ($100/mo, 60 min/month)
                      and Growth ($300/mo, 240 min/month). Upgrade to unlock live voice
                      without bringing your own key.
                    </p>
                    <button
                      type="button"
                      className="pvc-intro-cta"
                      onClick={() => {
                        dismissIntro();
                        window.dispatchEvent(new CustomEvent('pulse:navigate', {
                          detail: { view: 'SETTINGS', section: 'billing' },
                        }));
                      }}
                    >
                      Upgrade to Team
                    </button>
                  </article>
                ) : (
                  <article className="pvc-intro-option">
                    <h3>
                      {isTrialing
                        ? 'Try 15 free trial minutes'
                        : pulseTier === 'team'
                          ? 'Use your 60 included minutes'
                          : pulseTier === 'growth'
                            ? 'Use your 240 included minutes'
                            : 'Use Pulse-hosted minutes'}
                    </h3>
                    <p>
                      {isTrialing
                        ? '5-minute sessions while you trial Pulse. Sessions over the limit auto-disconnect cleanly.'
                        : pulseTier === 'team'
                          ? '15-minute sessions, 60 min/month included with Pulse Team. Overage billed at $0.50/min.'
                          : pulseTier === 'growth'
                            ? '30-minute sessions, 240 min/month included with Pulse Growth. Overage billed at $0.40/min.'
                            : 'Summit minutes are included with Pulse Team ($100/mo) and Growth ($300/mo) plans.'}
                    </p>
                    <button
                      type="button"
                      className="pvc-intro-cta"
                      onClick={dismissIntro}
                    >
                      Got it — let&rsquo;s go
                    </button>
                  </article>
                )}
              </div>

              <p className="pvc-intro-footer">
                You can switch between modes any time. Adding a personal key in Settings
                takes Summit off the Pulse meter entirely.{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How to get an OpenAI key →
                </a>
              </p>
            </div>
          </div>
        </>
      )}

      {/* SETTINGS PANEL */}
      {showSettings && (
        <div className="pvc-settings-panel">
          <div className="pvc-settings-header">
            <h2>
              <Settings size={16} />
              Voice Settings
            </h2>
            <button
              type="button"
              className="pvc-icon-btn"
              onClick={() => setShowSettings(false)}
              title="Close settings"
            >
              <X size={16} />
            </button>
          </div>

          <div className="pvc-settings-content">
            <div className="pvc-setting-group">
              <label htmlFor="voice-select">Voice</label>
              <select
                id="voice-select"
                value={voiceSettings.voice}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({ ...prev, voice: e.target.value as any }))
                }
                title="Select AI voice"
              >
                <option value="alloy">Alloy (Neutral)</option>
                <option value="ash">Ash (Neutral)</option>
                <option value="ballad">Ballad (Female)</option>
                <option value="coral">Coral (Female)</option>
                <option value="echo">Echo (Male)</option>
                <option value="sage">Sage (Neutral)</option>
                <option value="shimmer">Shimmer (Female)</option>
                <option value="verse">Verse (Neutral)</option>
                <option value="marin">Marin (Female)</option>
                <option value="cedar">Cedar (Male)</option>
              </select>
            </div>

            <div className="pvc-setting-group">
              <label htmlFor="language-select">Language</label>
              <select
                id="language-select"
                value={voiceSettings.language || 'en'}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({ ...prev, language: e.target.value as any }))
                }
                title="Select conversation language"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="nl">Dutch</option>
                <option value="pl">Polish</option>
                <option value="ru">Russian</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
              </select>
            </div>

            <div className="pvc-setting-group">
              <label htmlFor="turn-detection">Turn Detection</label>
              <select
                id="turn-detection"
                value={voiceSettings.turnDetection}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({ ...prev, turnDetection: e.target.value as any }))
                }
                title="Select turn detection mode"
              >
                <option value="semantic_vad">Semantic VAD (Smart)</option>
                <option value="server_vad">Server VAD (Fast)</option>
              </select>
            </div>

            <div className="pvc-setting-group">
              <label htmlFor="noise-reduction">Noise Reduction</label>
              <select
                id="noise-reduction"
                value={voiceSettings.noiseReduction || 'near_field'}
                onChange={(e) =>
                  setVoiceSettings((prev) => ({ ...prev, noiseReduction: e.target.value as any }))
                }
                title="Select noise reduction mode"
              >
                <option value="near_field">Near Field (Close Mic)</option>
                <option value="far_field">Far Field (Room Mic)</option>
              </select>
            </div>

            <div className="pvc-setting-group">
              <label className="pvc-toggle">
                <input
                  type="checkbox"
                  checked={autoNotes}
                  onChange={(e) => setAutoNotes(e.target.checked)}
                />
                <span className="pvc-toggle-slider" />
                <span className="pvc-toggle-label">Auto-capture notes</span>
              </label>
            </div>

            <div className="pvc-setting-group">
              <label className="pvc-toggle">
                <input
                  type="checkbox"
                  checked={aiMode === 'active'}
                  onChange={(e) => setAiMode(e.target.checked ? 'active' : 'observer')}
                />
                <span className="pvc-toggle-slider" />
                <span className="pvc-toggle-label">Active AI Mode</span>
              </label>
              <p className="pvc-setting-hint">
                {aiMode === 'active'
                  ? 'AI actively participates'
                  : 'AI only responds when prompted'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT DRAWER */}
      {showContextDrawer && (
        <div className="pvc-backdrop" onClick={() => setShowContextDrawer(false)} />
      )}
      <div className={`pvc-context-drawer ${showContextDrawer ? 'pvc-context-drawer--open' : ''}`}>
        <div
          className="pvc-context-drawer-handle"
          onClick={() => setShowContextDrawer(false)}
        >
          <div className="pvc-context-drawer-handle-bar" />
        </div>
        <div className="pvc-context-drawer-content">
          <div className="pvc-context-drawer-header">
            <h2>
              <FolderOpen size={16} />
              Conversation Context
            </h2>
            <button
              type="button"
              className="pvc-icon-btn"
              onClick={() => setShowContextDrawer(false)}
              title="Close context drawer"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <p className="pvc-context-drawer-hint">
            Add documents or notes to ground the conversation.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv"
            onChange={handleFileUpload}
            className="hidden"
            aria-label="Upload context files"
          />
          <button
            type="button"
            className="pvc-context-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUpload size={16} />
            Upload Files
          </button>

          <div className="pvc-context-text-input">
            <textarea
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Or paste text, notes, or URLs here…"
              aria-label="Context text input"
            />
            <button type="button" onClick={handleAddTextContext} disabled={!contextText.trim()}>
              <Plus size={14} />
              Add Context
            </button>
          </div>

          {contextFiles.length > 0 ? (
            <div className="pvc-context-file-list">
              <h4>Added Context ({contextFiles.length})</h4>
              {contextFiles.map((file) => (
                <div key={file.id} className="pvc-context-file-item">
                  <div className="pvc-context-file-info">
                    <Paperclip size={13} />
                    <span className="pvc-context-file-name">{file.name}</span>
                    <span className="pvc-context-file-size">
                      {file.type === 'file'
                        ? formatFileSize(file.size)
                        : `${file.content.length} chars`}
                    </span>
                  </div>
                  <button type="button" onClick={() => removeContextFile(file.id)} title="Remove">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="pvc-context-empty">
              <Inbox size={24} />
              <p>No context files added yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for popovers */}
      {(showExportMenu || showSettings) && (
        <div
          className="pvc-backdrop"
          onClick={() => {
            setShowExportMenu(false);
            setShowSettings(false);
          }}
        />
      )}

      {/* END-SESSION SHEET */}
      <EndSessionSheet
        open={showEndSheet}
        durationSec={sessionElapsed}
        artifacts={artifacts}
        notes={notes.map((n) => ({
          id: n.id,
          content: n.content,
          timestamp: n.timestamp.getTime(),
          type: n.type,
          speaker: n.speaker,
        }))}
        onConfirm={handleEndConfirm}
        onSkipAndEnd={handleEndSkip}
        onCancel={handleEndCancel}
        progress={endProgress}
      />
    </div>
  );
};

export default Summit;

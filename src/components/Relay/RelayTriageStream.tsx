// RelayTriageStream — Pulse "what voice needs me now?" surface, Voice Studio
// edition (Path C, Phase 2a).
//
// Default landing for /relay, rendered as "Inbox" in the SourcesRail. Shows
// the unified TriageItem feed from useRelayTriage as full-width studio cards:
// avatar + sender + audience chip, a deterministic waveform that fills coral
// while playing, a karaoke transcript that reveals at the playback rate, and
// an inline Pulse AI summary callout. Playback flows through the shared
// RelayStudioContext so the persistent StudioFooter is a true transport for
// whatever's playing here — and keeps playing if you navigate to another
// source.
//
// Phase 2a changes vs the prior list view:
// - List rows → StudioCard primitives; active card gets the coral ring.
// - Local <audio> removed; studio.play()/togglePlay() own real playback +
//   URL resolution + the legacy-bucket fallback.
// - Filter chip row (ALL / NEEDS REPLY / MESSAGES / NOTES / LIVE) reorganized
//   into status × source: a "Needs reply" toggle + an "All sources ▾"
//   dropdown. Source navigation proper lives in the rail now, so the body
//   filter is cross-cutting only — no redundancy with the rail.
// - Bottom compose pill removed; the shell's FloatingMic + SPACE own compose.
// - Header gains the "RELAY · INBOX / Today's voice" masthead.
// Row actions (reply / snooze / dismiss / mark-read / delete) and all
// useRelayTriage wiring are preserved verbatim.

import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  Reply,
  Play,
  Pause,
  Check,
  CheckCheck,
  Clock,
  ChevronDown,
  Filter,
  X,
  MoreHorizontal,
  Trash2,
  Inbox,
  MessageSquare,
  Radio,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { VoxEmptyState } from './VoxEmptyState';
import { RelayColdStartGuide, RELAY_COLDSTART_DISMISS_KEY } from './RelayColdStartGuide';
import toast from 'react-hot-toast';
import type { Contact, User } from '../../types';
import { useRelayTriage, type TriageItem, type TriageItemKind } from '../../hooks/useRelayTriage';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import { voxModeService } from '../../services/relay/voxModeService';
import { useRelayStudio } from './studio';
import { Waveform } from './studio/Waveform';
import { StudioCard } from './studio/StudioCard';
import { StudioMasthead } from './studio/StudioMasthead';
import { avatarColorForId, initials } from './studio/avatarColor';

// Mirrors Relay.tsx's local RelayView (six peers).
type RelayTriageView =
  | 'triage'
  | 'direct'
  | 'channel'
  | 'broadcast'
  | 'notes'
  | 'live';

// Status filter is cross-cutting; source filter slices the unified feed.
type StatusFilter = 'all' | 'needs_reply';
type SourceFilter = 'all' | 'messages' | 'broadcast' | 'notes';

const SOURCE_OPTIONS: { id: SourceFilter; label: string }[] = [
  { id: 'all', label: 'All sources' },
  { id: 'messages', label: 'Direct' },
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'notes', label: 'Notes' },
];

interface EmptyStateConfig {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}

// 'all' is the front door — the default landing view. It orients first: what
// Inbox aggregates, then how to start. The source-filtered variants are
// no-results states, so they stay lighter (title + one line, no CTA).
const EMPTY_STATES: Record<SourceFilter, EmptyStateConfig> = {
  all: {
    icon: Inbox,
    eyebrow: 'Relay · Inbox',
    title: 'Your voice, in one place',
    description:
      'Inbox gathers every direct message, broadcast, and note across Relay, newest first. When voice needs you, it lands here.',
  },
  messages: {
    icon: MessageSquare,
    eyebrow: 'Direct',
    title: 'No direct messages yet',
    description: 'One-to-one voice lands here.',
  },
  broadcast: {
    icon: Radio,
    eyebrow: 'Broadcast',
    title: 'No broadcasts yet',
    description: 'One-to-many voice you send or receive shows up here.',
  },
  notes: {
    icon: FileText,
    eyebrow: 'Notes',
    title: 'No voice notes yet',
    description: 'Capture a thought for yourself.',
  },
};

interface RelayTriageStreamProps {
  user: User | null;
  contacts?: Contact[];
  onOpenView: (
    view: RelayTriageView,
    focusItem?: { kind: TriageItemKind; id: string; senderId?: string },
  ) => void;
  onCompose: () => void;
  onReply: (recipientId: string) => void;
  onReplyToThread: (threadId: string, threadLabel?: string) => void;
}

/** Map TriageItemKind → top-level Relay view (six-peer space). */
function viewForKind(kind: TriageItemKind): RelayTriageView {
  if (kind === 'broadcast') return 'broadcast';
  if (kind === 'note') return 'notes';
  return 'direct';
}

/** Stable studio key — namespaced so kinds with colliding ids stay distinct. */
function studioKey(item: TriageItem): string {
  return `${item.kind}-${item.id}`;
}

/** "2h ago" / "just now" — inline since we ship no date-fns dependency. */
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 30) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "0:42" / "1:05:30" — same inline-only constraint. */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Compute ms-from-now until 09:00 local tomorrow. */
function msUntilTomorrow9am(): number {
  const target = new Date();
  target.setDate(target.getDate() + 1);
  target.setHours(9, 0, 0, 0);
  return Math.max(60 * 1000, target.getTime() - Date.now());
}

/** Friendly future-time label for the snooze toast. */
function formatRelativeFuture(date: Date): string {
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `in ${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A single Inbox studio card. */
const InboxCard: React.FC<{
  item: TriageItem;
  active: boolean;
  isPlaying: boolean;
  progress: number;
  /** Keyboard-focused row (j/k navigation) — gets a neutral focus outline,
   *  distinct from the coral now-playing ring. */
  focused?: boolean;
  onOpen: () => void;
  onTogglePlay?: () => void;
  /** Seek the active track to a 0→1 fraction (waveform scrub). Only meaningful
   *  while this card is the active/playing one. */
  onSeek?: (fraction: number) => void;
  onReply?: () => void;
  onMarkRead?: () => void;
  onSnooze?: (untilMs: number) => void;
  onDismiss?: () => void;
  onDelete?: () => void;
}> = ({ item, active, isPlaying, progress, focused, onOpen, onTogglePlay, onSeek, onReply, onMarkRead, onSnooze, onDismiss, onDelete }) => {
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const snoozeRef = useRef<HTMLDivElement | null>(null);
  const overflowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!snoozeMenuOpen && !overflowMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (snoozeMenuOpen && snoozeRef.current && !snoozeRef.current.contains(t)) setSnoozeMenuOpen(false);
      if (overflowMenuOpen && overflowRef.current && !overflowRef.current.contains(t)) setOverflowMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [snoozeMenuOpen, overflowMenuOpen]);

  const hasThreadDestination = item.kind === 'thread' && !!(item.raw as any)?.thread_id;
  const has11Destination = (item.kind === 'classic' || item.kind === 'quick') && !!item.senderId;
  const canReply = !!onReply && (hasThreadDestination || has11Destination);
  const canPlay = !!onTogglePlay && !!item.audioUrl;

  // Avatar identity. `resolved` distinguishes a real person/note from the
  // "Unknown contact" fallback so the unresolved case gets a muted, glyph-less
  // treatment instead of a confident coloured monogram. Colour seeds off the
  // per-contact key (avatarSeed) so every voice from one person shares a hue.
  // Needs-reply is signalled by a small coral dot, never a filled coral disc
  // (coral budget: signal, not decoration).
  const resolvedIdentity = !!item.senderName && item.senderName !== 'Unknown contact';
  const avatarSeed = item.avatarSeed || item.senderId || item.id;
  const glyphSource = item.senderName.replace(/[^\p{L}\p{N}\s]+/gu, ' ').trim();

  // Karaoke split — only while this card is actively playing + has a summary.
  const transcript = item.summary || '';
  const hasKaraoke = active && isPlaying && transcript.length > 2;
  const splitIdx = hasKaraoke ? Math.floor(transcript.length * progress) : 0;

  return (
    <StudioCard
      active={active}
      // Click the card body to play (or open when there's no audio). Inner
      // controls (name, play, waveform, action cluster) stopPropagation so they
      // don't double-fire this.
      onClick={canPlay ? onTogglePlay : onOpen}
      className={`relative group p-4 ${
        focused ? 'outline outline-2 outline-offset-2 outline-zinc-300 dark:outline-zinc-600' : ''
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative shrink-0">
          {item.avatarUrl ? (
            <img
              src={item.avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
              aria-hidden="true"
            />
          ) : (
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                resolvedIdentity
                  ? `${avatarColorForId(avatarSeed)} text-white`
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
              }`}
              aria-hidden="true"
            >
              {resolvedIdentity ? initials(glyphSource || item.senderName) : '?'}
            </div>
          )}
          {item.needsReply && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#080808]"
              aria-label="Needs reply"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate hover:underline focus:outline-none"
            >
              {item.senderName}
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
              {item.audienceLabel}
            </span>
            {active && isPlaying && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-rose-600 dark:text-rose-400">
                <span className="w-1 h-1 rounded-full bg-rose-500 pulse-dot-anim" aria-hidden="true" />
                Now playing
              </span>
            )}
            <span className="ml-auto font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 transition-opacity group-hover:opacity-0 [@media(hover:none)]:opacity-0">
              {formatRelativeTime(item.createdAt)} · {formatDuration(item.durationSec)}
            </span>
          </div>
        </div>
      </div>

      {/* Transport + waveform */}
      <div className="flex items-center gap-3">
        {canPlay ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePlay?.(); }}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
              active
                ? 'bg-rose-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-rose-500 hover:text-white'
            }`}
            aria-label={active && isPlaying ? `Pause ${item.senderName}` : `Play ${item.senderName}`}
          >
            <span className="relative w-4 h-4 block">
              <Pause className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ease-pulse ${active && isPlaying ? 'opacity-100' : 'opacity-0'}`} />
              <Play className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ease-pulse ${active && isPlaying ? 'opacity-0' : 'opacity-100'}`} />
            </span>
          </button>
        ) : (
          <div className="shrink-0 w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center text-zinc-400" aria-hidden="true">
            <Play className="w-4 h-4 opacity-40" />
          </div>
        )}
        <div
          className={`relative flex-1 ${canPlay ? 'cursor-pointer' : ''}`}
          role={canPlay ? 'button' : undefined}
          aria-label={canPlay ? (active ? 'Seek' : `Play ${item.senderName}`) : undefined}
          onClick={
            canPlay
              ? (e) => {
                  e.stopPropagation();
                  if (active && onSeek) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (rect.width > 0) onSeek((e.clientX - rect.left) / rect.width);
                  } else {
                    onTogglePlay?.();
                  }
                }
              : undefined
          }
        >
          <span style={{ color: active ? 'var(--pulse-rose)' : 'var(--pulse-ink-2)', display: 'block' }}>
            <Waveform seed={studioKey(item)} height={32} count={72} tall progress={active ? progress : 0} />
          </span>
          {active && (
            <span
              className="absolute inset-y-0 pointer-events-none"
              style={{ left: `${Math.round(progress * 100)}%`, width: 2, background: 'var(--pulse-rose)' }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Transcript / summary */}
      {transcript ? (
        <div className="mt-3 pl-13" style={{ paddingLeft: 52 }}>
          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            {hasKaraoke ? (
              <>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">{transcript.slice(0, splitIdx)}</span>
                <span className="opacity-50">{transcript.slice(splitIdx)}</span>
              </>
            ) : (
              transcript
            )}
          </p>
          <div className="mt-2">
            {/* Label by source: classic/quick bodies are raw Whisper transcripts;
                thread/broadcast/note bodies are AI summaries. Don't over-claim. */}
            {item.kind === 'classic' || item.kind === 'quick' ? (
              <AIProvenanceChip vendor="WHISPER" type="TRANSCRIPT" />
            ) : (
              <AIProvenanceChip vendor="PULSE AI" type="SUMMARY" />
            )}
          </div>
        </div>
      ) : null}
      {/* No transcript → render nothing. A voice message is complete on its own
          (avatar + waveform + play); the old grey "No transcript" literal read
          as broken/unfinished on first run rather than simply empty. */}

      {/* Hover actions */}
      {(canReply || onDismiss || onSnooze || onMarkRead || onDelete) && (
        <div
          className={`absolute right-3 top-3 transition flex items-center gap-1.5 ${
            snoozeMenuOpen || overflowMenuOpen
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100'
          }`}
        >
          {onDismiss && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              aria-label={`Dismiss ${item.senderName} from triage`}
              title="Dismiss from triage"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {onSnooze && (
            <div ref={snoozeRef} className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOverflowMenuOpen(false); setSnoozeMenuOpen((o) => !o); }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-transparent text-zinc-600 dark:text-zinc-400 ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  snoozeMenuOpen ? 'ring-rose-400 text-rose-600 dark:text-rose-400' : 'ring-zinc-200 dark:ring-zinc-700 hover:ring-zinc-300 dark:hover:ring-zinc-600'
                }`}
                aria-haspopup="menu"
                aria-expanded={snoozeMenuOpen}
                aria-label={`Snooze ${item.senderName}`}
              >
                <Clock className="w-3 h-3" />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Snooze</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ease-pulse ${snoozeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {snoozeMenuOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1.5 w-44 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-[#0a0a0a] py-1 z-20 shadow-md">
                  {[
                    { label: '1 hour', ms: 60 * 60 * 1000 },
                    { label: 'Tomorrow 9am', ms: msUntilTomorrow9am() },
                    { label: 'Next week', ms: 7 * 24 * 60 * 60 * 1000 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      role="menuitem"
                      onClick={(e) => { e.stopPropagation(); setSnoozeMenuOpen(false); onSnooze(opt.ms); }}
                      className="w-full text-left px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-600 dark:text-zinc-300 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {canReply && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReply?.(); }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              aria-label={`Reply to ${item.senderName}`}
            >
              <Reply className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Reply</span>
            </button>
          )}
          {(onMarkRead || onDelete) && (
            <div ref={overflowRef} className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSnoozeMenuOpen(false); setOverflowMenuOpen((o) => !o); }}
                className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  overflowMenuOpen ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
                }`}
                aria-haspopup="menu"
                aria-expanded={overflowMenuOpen}
                aria-label={`More actions for ${item.senderName}`}
                title="More"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {overflowMenuOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1.5 w-48 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-[#0a0a0a] py-1 z-20 shadow-md">
                  {item.needsReply && onMarkRead && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => { e.stopPropagation(); setOverflowMenuOpen(false); onMarkRead(); }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                    >
                      <Check className="w-3 h-3" />
                      Mark as read
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={(e) => { e.stopPropagation(); setOverflowMenuOpen(false); onDelete(); }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete forever
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </StudioCard>
  );
};

const SkeletonList: React.FC = () => (
  <div className="space-y-3" aria-hidden="true">
    {Array.from({ length: 4 }).map((_, idx) => (
      <div key={idx} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-6 flex-1 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ source: SourceFilter; onCompose: () => void }> = ({ source, onCompose }) => {
  const cfg = EMPTY_STATES[source];
  const isFrontDoor = source === 'all';
  return (
    <VoxEmptyState
      mode={source}
      icon={cfg.icon}
      eyebrow={cfg.eyebrow}
      title={cfg.title}
      description={cfg.description}
      action={isFrontDoor ? { label: 'Record a message', onClick: onCompose } : undefined}
      hint={isFrontDoor ? 'Hold space to record · ? for shortcuts' : undefined}
    />
  );
};

export const RelayTriageStream: React.FC<RelayTriageStreamProps> = ({ user, onOpenView, onCompose, onReply, onReplyToThread }) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const sourceMenuRef = useRef<HTMLDivElement | null>(null);
  // First-run cold-start teaching guide (front-door empty Inbox only). Once
  // dismissed it stays gone (persisted); the plain empty state takes over.
  const [coldStartDismissed, setColdStartDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(RELAY_COLDSTART_DISMISS_KEY) === '1'; } catch { return false; }
  });
  const dismissColdStart = () => {
    try { localStorage.setItem(RELAY_COLDSTART_DISMISS_KEY, '1'); } catch { /* noop */ }
    setColdStartDismissed(true);
  };
  // Keyboard list-drive: which row j/k focuses. Clamped to the filtered length.
  const [focusedIdx, setFocusedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const {
    items,
    needsReplyCount,
    isLoading,
    error,
    markRead,
    markManyRead,
    dismiss,
    undismiss,
    remove,
  } = useRelayTriage(user?.id);

  const studio = useRelayStudio();

  useEffect(() => {
    if (!sourceMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(e.target as Node)) setSourceMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [sourceMenuOpen]);

  // Play / toggle through the shared studio transport. The footer reflects
  // and controls whatever this starts.
  const togglePlayItem = (item: TriageItem) => {
    if (!item.audioUrl) return;
    const key = studioKey(item);
    if (studio.nowPlaying?.id === key) {
      studio.togglePlay();
      return;
    }
    studio.play({
      id: key,
      sender: item.senderName,
      dur: formatDuration(item.durationSec),
      type: item.audienceLabel || item.kind,
      transcript: item.summary ?? null,
      source: item.kind,
      audioUrl: item.audioUrl,
    });
  };

  const snoozeItem = async (item: TriageItem, msFromNow: number) => {
    const remindAt = new Date(Date.now() + msFromNow);
    const reminderId = await voxModeService.snoozeTriageItem(item.kind, item.id, remindAt);
    if (!reminderId) {
      toast.error('Could not snooze — try again.');
      return;
    }
    const friendly = formatRelativeFuture(remindAt);
    toast.success(
      (t) => (
        <span className="flex items-center gap-3">
          <span>Snoozed until {friendly}</span>
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              const ok = await voxModeService.cancelVoiceReminder(reminderId);
              if (ok) toast.success('Snooze undone');
              else toast.error('Could not undo snooze');
            }}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-rose-600 hover:text-rose-700"
          >
            Undo
          </button>
        </span>
      ),
      { duration: 5000 },
    );
  };

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter === 'needs_reply') list = list.filter((i) => i.needsReply);
    switch (sourceFilter) {
      case 'messages':
        return list.filter((i) => i.kind === 'classic' || i.kind === 'thread' || i.kind === 'quick');
      case 'broadcast':
        return list.filter((i) => i.kind === 'broadcast');
      case 'notes':
        return list.filter((i) => i.kind === 'note');
      case 'all':
      default:
        return list;
    }
  }, [items, statusFilter, sourceFilter]);

  const handleRowOpen = (item: TriageItem) => {
    onOpenView(viewForKind(item.kind), { kind: item.kind, id: item.id, senderId: item.senderId });
  };

  const dismissItem = async (item: TriageItem) => {
    await dismiss(item);
    toast.success(
      (t) => (
        <span className="flex items-center gap-3">
          <span>Dismissed from triage</span>
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              await undismiss(item);
              toast.success('Restored');
            }}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-rose-600 hover:text-rose-700"
          >
            Undo
          </button>
        </span>
      ),
      { duration: 5000 },
    );
  };

  const removeItem = async (item: TriageItem) => {
    toast(
      (t) => (
        <span className="flex flex-col gap-2 min-w-[14rem]">
          <span className="text-sm">
            Delete this voice {item.kind === 'note' ? 'note' : 'message'} forever? This can't be undone.
          </span>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                const ok = await remove(item);
                if (ok) toast.success('Deleted');
                else toast.error("Couldn't delete — you may not own this row.");
              }}
              className="font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white"
            >
              Delete
            </button>
          </div>
        </span>
      ),
      { duration: 8000 },
    );
  };

  // Reply to the keyboard-focused row — mirrors the per-card onReply wiring.
  const replyToItem = (item: TriageItem) => {
    if (item.kind === 'thread') {
      const threadId = (item.raw as any)?.thread_id;
      if (threadId) onReplyToThread(threadId, item.senderName);
    } else if (item.senderId) {
      onReply(item.senderId);
    }
  };

  // Latest snapshot for the keyboard handler. Held in a ref so the single
  // window listener never re-subscribes on playback-progress ticks (which fire
  // many times a second and would otherwise churn the listener).
  const navRef = useRef({ filtered, focusedIdx, play: togglePlayItem, open: handleRowOpen, reply: replyToItem, dismiss: dismissItem });
  navRef.current = { filtered, focusedIdx, play: togglePlayItem, open: handleRowOpen, reply: replyToItem, dismiss: dismissItem };

  // List keyboard model (Superhuman-style). Space stays the Relay record key
  // (owned by useRelayKeyboardShortcuts), so play is on Enter here, not Space.
  //   j / ↓ · k / ↑ — move focus    Enter — play/pause    o — open conversation
  //   r — reply    e — dismiss (reversible)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      // Defer to a focused interactive control (a tabbed-to button, an open
      // menu) so Enter / r / e activate that control, not the list.
      if (t?.closest('button, a, [role="menuitem"], [role="menu"]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const nav = navRef.current;
      if (!nav.filtered.length) return;
      const idx = Math.min(Math.max(nav.focusedIdx, 0), nav.filtered.length - 1);
      const cur = nav.filtered[idx];
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIdx(Math.min(idx + 1, nav.filtered.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIdx(Math.max(idx - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          nav.play(cur);
          break;
        case 'o':
          e.preventDefault();
          nav.open(cur);
          break;
        case 'r':
          e.preventDefault();
          nav.reply(cur);
          break;
        case 'e':
          e.preventDefault();
          nav.dismiss(cur);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep the focused index inside the (possibly shrinking) filtered list.
  useEffect(() => {
    setFocusedIdx((i) => Math.min(Math.max(i, 0), Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Scroll the focused row into view as j/k moves through the list.
  useEffect(() => {
    const el = listRef.current?.children[focusedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx]);

  const activeSourceLabel = SOURCE_OPTIONS.find((o) => o.id === sourceFilter)?.label ?? 'All sources';

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#080808]">
      {/* Masthead — shared StudioMasthead; filters ride the `right` slot.
          px-4 on phones, px-7 from sm up (desktop-identical at ≥640). */}
      <div className="px-4 sm:px-7 pt-6">
        <StudioMasthead
          eyebrow="Relay · Inbox"
          title="Today's voice"
          right={
            <>
              {/* Status toggle */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900">
                {([
                  { id: 'all', label: 'All' },
                  { id: 'needs_reply', label: 'Needs reply' },
                ] as { id: StatusFilter; label: string }[]).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusFilter(s.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                      statusFilter === s.id
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {s.label}
                    {s.id === 'needs_reply' && needsReplyCount > 0 && (
                      <span className="ml-1.5 font-mono text-[10px] text-rose-500">{needsReplyCount}</span>
                    )}
                  </button>
                ))}
              </div>
              {/* Source dropdown */}
              <div ref={sourceMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSourceMenuOpen((o) => !o)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                  aria-haspopup="menu"
                  aria-expanded={sourceMenuOpen}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{activeSourceLabel}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sourceMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {sourceMenuOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-1.5 w-40 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-[#0a0a0a] py-1 z-20 shadow-md">
                    {SOURCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="menuitem"
                        onClick={() => { setSourceFilter(opt.id); setSourceMenuOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] transition ${
                          sourceFilter === opt.id
                            ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          }
        />
      </div>

      {/* Needs-reply banner */}
      {needsReplyCount > 0 && (
        <div className="mx-4 sm:mx-7 mb-3 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 pulse-dot-anim" aria-hidden="true" />
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300 flex-1">
            {needsReplyCount} voice {needsReplyCount === 1 ? 'message needs' : 'messages need'} a reply
          </p>
          <button
            type="button"
            onClick={() => markManyRead(items)}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400 hover:text-rose-700 dark:hover:text-rose-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded"
            aria-label="Mark all as read"
          >
            <CheckCheck className="w-3 h-3" />
            Mark all read
          </button>
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-7 pb-6">
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {isLoading && <SkeletonList />}

        {!isLoading && filtered.length === 0 && (
          sourceFilter === 'all' && !coldStartDismissed ? (
            <RelayColdStartGuide
              onSelectView={(v) => onOpenView(v)}
              onCompose={onCompose}
              onDismiss={dismissColdStart}
            />
          ) : (
            <EmptyState source={sourceFilter} onCompose={onCompose} />
          )
        )}

        {!isLoading && filtered.length > 0 && (
          <div ref={listRef} className="space-y-3">
            {filtered.map((item, idx) => {
              const key = studioKey(item);
              const active = studio.nowPlaying?.id === key;
              return (
                <InboxCard
                  key={key}
                  item={item}
                  active={active}
                  isPlaying={active && studio.isPlaying}
                  progress={active ? studio.progress : 0}
                  focused={idx === focusedIdx}
                  onOpen={() => { setFocusedIdx(idx); handleRowOpen(item); }}
                  onTogglePlay={() => { setFocusedIdx(idx); togglePlayItem(item); }}
                  onSeek={(f) => studio.seek(f)}
                  onMarkRead={() => markRead(item)}
                  onSnooze={(ms) => snoozeItem(item, ms)}
                  onDismiss={() => dismissItem(item)}
                  onDelete={() => removeItem(item)}
                  onReply={(() => {
                    if (item.kind === 'thread') {
                      const threadId = (item.raw as any)?.thread_id;
                      if (!threadId) return undefined;
                      return () => onReplyToThread(threadId, item.senderName);
                    }
                    return item.senderId ? () => onReply(item.senderId!) : undefined;
                  })()}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RelayTriageStream;

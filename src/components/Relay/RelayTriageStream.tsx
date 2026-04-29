// RelayTriageStream — Pulse "what voice needs me now?" surface.
//
// Default landing for /relay. Renders the unified TriageItem feed from
// useRelayTriage with filter chips (ALL / NEEDS REPLY / MESSAGES / NOTES /
// LIVE), a needs-reply banner, per-row sender + audience metadata, empty
// states, a 5-row loading skeleton, and a coral compose pill that opens the
// RelayComposer (the new-voice-message launcher).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Reply, Play, Pause, Check, CheckCheck, Clock, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Contact, User } from '../../types';
import { useRelayTriage, type TriageItem, type TriageItemKind } from '../../hooks/useRelayTriage';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import { voxModeService } from '../../services/relay/voxModeService';
import { resolveAudioUrl, legacyAudioUrl } from '../../services/relay/resolveAudioUrl';
import type { RelayMode } from '../../services/relay/voxModeTypes';

type RelayTriageView = 'triage' | RelayMode;
type FilterId = 'all' | 'needs_reply' | 'messages' | 'notes' | 'live';

const FILTER_ORDER: readonly FilterId[] = ['all', 'needs_reply', 'messages', 'notes', 'live'] as const;

const FILTER_LABELS: Record<FilterId, string> = {
  all: 'ALL',
  needs_reply: 'NEEDS REPLY',
  messages: 'MESSAGES',
  notes: 'NOTES',
  live: 'LIVE',
};

const EMPTY_COPY: Record<FilterId, string> = {
  all: 'No voice activity yet.',
  needs_reply: 'No messages need a reply.',
  messages: 'No messages yet. Hold space to record one.',
  notes: 'No voice notes yet. Capture an idea.',
  live: 'Nothing live right now.',
};

interface RelayTriageStreamProps {
  user: User | null;
  // Surfaced for parity with the rest of Relay's view tree; not consumed yet
  // (audience-picker integration lands in 2.1d.4).
  contacts?: Contact[];
  onOpenView: (view: RelayTriageView) => void;
  onCompose: () => void;
  /** Open the composer with a specific Pulse user prefilled as 1:1 recipient. */
  onReply: (recipientId: string) => void;
  /** Open the composer in voice-thread reply mode targeting a specific thread. */
  onReplyToThread: (threadId: string, threadLabel?: string) => void;
}

/** Map TriageItemKind → top-level Relay view. */
function viewForKind(kind: TriageItemKind): RelayTriageView {
  if (kind === 'broadcast') return 'live';
  if (kind === 'note') return 'notes';
  return 'messages';
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
  // Fall back to a short locale date for older items.
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "0:42" / "1:05:30" — same inline-only constraint as formatRelativeTime. */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** A single triage row. Memoised on the item identity to keep large feeds smooth. */
const TriageRow: React.FC<{
  item: TriageItem;
  isPlaying: boolean;
  onClick: () => void;
  onTogglePlay?: () => void;
  onReply?: () => void;
  onMarkRead?: () => void;
  onSnooze?: (untilMs: number) => void;
}> = ({ item, isPlaying, onClick, onTogglePlay, onReply, onMarkRead, onSnooze }) => {
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const snoozeRef = useRef<HTMLDivElement | null>(null);

  // Close the snooze menu on outside click so it doesn't linger between rows.
  useEffect(() => {
    if (!snoozeMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!snoozeRef.current) return;
      if (!snoozeRef.current.contains(e.target as Node)) setSnoozeMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [snoozeMenuOpen]);
  // Reply makes sense for 1:1 voice (classic/quick) and for voice threads where
  // we have a thread_id to target. The actual routing decision (1:1 quick vs
  // voice-thread message) is made by the caller via onReply — we just expose
  // the affordance.
  const hasThreadDestination = item.kind === 'thread' && !!(item.raw as any)?.thread_id;
  const has11Destination = (item.kind === 'classic' || item.kind === 'quick') && !!item.senderId;
  const canReply = !!onReply && (hasThreadDestination || has11Destination);
  const canPlay = !!onTogglePlay && !!item.audioUrl;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition flex items-start gap-3"
      >
        {canPlay ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay?.();
            }}
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
              isPlaying
                ? 'bg-rose-500 text-white'
                : item.needsReply
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
            }`}
            aria-label={isPlaying ? `Pause ${item.senderName}` : `Play ${item.senderName}`}
          >
            {/* Cross-fade between Play and Pause so the icon swap doesn't pop. */}
            <span className="relative w-4 h-4 block">
              <Pause
                className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${
                  isPlaying ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <Play
                className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${
                  isPlaying ? 'opacity-0' : 'opacity-100'
                }`}
              />
            </span>
          </button>
        ) : (
          <div
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
              item.needsReply
                ? 'bg-rose-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
            aria-hidden="true"
          >
            {(item.senderName || '?').charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {item.senderName}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400 shrink-0">
              {item.audienceLabel}
            </span>
            {/* Timestamp shares the right-side region with the action
                cluster (absolute-positioned above). Fade out on hover /
                while the snooze menu is open so they don't overlap. */}
            <span
              className={`ml-auto font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 transition-opacity duration-150 ${
                snoozeMenuOpen ? 'opacity-0' : 'opacity-100 group-hover:opacity-0 group-focus-within:opacity-0'
              }`}
              aria-hidden={snoozeMenuOpen}
            >
              {formatRelativeTime(item.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-mono shrink-0">{formatDuration(item.durationSec)}</span>
            <span aria-hidden="true">•</span>
            <span className="truncate">{item.summary || 'No transcript'}</span>
          </div>
          {item.summary && (
            <div className="mt-2">
              <AIProvenanceChip vendor="PULSE AI" type="SUMMARY" />
            </div>
          )}
        </div>
      </button>

      {(canReply || (item.needsReply && onMarkRead) || onSnooze) && (
        <div
          className={`absolute right-2 top-2 ${
            snoozeMenuOpen
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          } transition flex items-center gap-1.5`}
        >
          {/* Read — ghost icon-only. Terminal action; the lowest visual weight
              of the three so the eye lands on Reply first. */}
          {item.needsReply && onMarkRead && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead();
              }}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              aria-label={`Mark ${item.senderName} as read`}
              title="Mark as read"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Snooze — secondary outline. Visible enough to discover, quiet
              enough to defer to Reply. */}
          {onSnooze && (
            <div ref={snoozeRef} className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSnoozeMenuOpen((o) => !o);
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-transparent text-zinc-600 dark:text-zinc-400 ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  snoozeMenuOpen
                    ? 'ring-rose-400 text-rose-600 dark:text-rose-400'
                    : 'ring-zinc-200 dark:ring-zinc-700 hover:ring-zinc-300 dark:hover:ring-zinc-600'
                }`}
                aria-haspopup="menu"
                aria-expanded={snoozeMenuOpen}
                aria-label={`Snooze ${item.senderName}`}
              >
                <Clock className="w-3 h-3" />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Snooze</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-150 ${
                    snoozeMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {snoozeMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-md ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-zinc-950 py-1 z-10 shadow-md"
                >
                  {[
                    { label: '1 hour', ms: 60 * 60 * 1000 },
                    { label: 'Tomorrow 9am', ms: msUntilTomorrow9am() },
                    { label: 'Next week', ms: 7 * 24 * 60 * 60 * 1000 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSnoozeMenuOpen(false);
                        onSnooze(opt.ms);
                      }}
                      className="w-full text-left px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-600 dark:text-zinc-300 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Reply — primary coral. The action this surface exists to drive. */}
          {canReply && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReply?.();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              aria-label={`Reply to ${item.senderName}`}
            >
              <Reply className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Reply</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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

const SkeletonList: React.FC = () => (
  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, idx) => (
      <li key={idx} className="px-4 py-3 flex items-start gap-3 animate-pulse">
        <div className="shrink-0 w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </li>
    ))}
  </ul>
);

const EmptyState: React.FC<{ filter: FilterId }> = ({ filter }) => (
  <div className="h-full flex items-center justify-center px-6 py-12 text-center">
    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">{EMPTY_COPY[filter]}</p>
  </div>
);

export const RelayTriageStream: React.FC<RelayTriageStreamProps> = ({ user, onOpenView, onCompose, onReply, onReplyToThread }) => {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const { items, needsReplyCount, isLoading, error, markRead, markManyRead } = useRelayTriage(user?.id);

  // Single shared <audio> for inline row playback. Owning it here (rather
  // than per-row) gives us "only one row plays at a time" for free, lets
  // the play button on a different row act as a transport switch, and
  // avoids spawning N HTMLAudioElements for long feeds.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingItemKey, setPlayingItemKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;
    const handleEnded = () => setPlayingItemKey(null);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handleEnded);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  const togglePlay = (item: TriageItem) => {
    const audio = audioRef.current;
    if (!audio || !item.audioUrl) return;
    const key = `${item.kind}-${item.id}`;
    if (playingItemKey === key) {
      audio.pause();
      setPlayingItemKey(null);
      return;
    }
    audio.pause();
    audio.src = resolveAudioUrl(item.audioUrl);
    audio.currentTime = 0;
    // Dual-read fallback: if the canonical relay URL 404s (legacy asset
    // pre-cutover), retry against the voxer bucket once before giving up.
    const onError = () => {
      audio.removeEventListener('error', onError);
      const fallback = legacyAudioUrl(item.audioUrl);
      if (fallback && fallback !== audio.src) {
        audio.src = fallback;
        audio.play()
          .then(() => setPlayingItemKey(key))
          .catch((err) => {
            console.warn('[Triage] legacy play failed', err);
            setPlayingItemKey(null);
          });
      } else {
        setPlayingItemKey(null);
      }
    };
    audio.addEventListener('error', onError, { once: true });
    audio.play()
      .then(() => setPlayingItemKey(key))
      .catch((err) => {
        console.warn('[Triage] play failed', err);
        setPlayingItemKey(null);
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
    switch (activeFilter) {
      case 'needs_reply':
        return items.filter((i) => i.needsReply);
      case 'messages':
        return items.filter(
          (i) => i.kind === 'classic' || i.kind === 'thread' || i.kind === 'quick',
        );
      case 'notes':
        return items.filter((i) => i.kind === 'note');
      case 'live':
        return items.filter((i) => i.kind === 'broadcast');
      case 'all':
      default:
        return items;
    }
  }, [items, activeFilter]);

  const handleRowClick = (item: TriageItem) => {
    onOpenView(viewForKind(item.kind));
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950">
      {/* Filter chip row */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto"
        role="tablist"
        aria-label="Triage filter"
      >
        {FILTER_ORDER.map((filter) => (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter}
            onClick={() => setActiveFilter(filter)}
            className={`shrink-0 px-3 py-1 rounded font-mono text-[11px] uppercase tracking-[0.1em] transition ${
              activeFilter === filter
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            {FILTER_LABELS[filter]}
          </button>
        ))}
      </div>

      {/* Triage banner — surface needs-reply count or "Inbox clear."
          The banner is the primary coral signal on this view; the
          "Mark all read" affordance is intentionally a hairline ghost
          so it reads as one surface, not two competing chips. */}
      <div className="px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300 flex-1">
          {needsReplyCount > 0
            ? `${needsReplyCount} voice ${needsReplyCount === 1 ? 'message' : 'messages'} need a reply`
            : 'Inbox clear.'}
        </p>
        {needsReplyCount > 0 && (
          <button
            type="button"
            onClick={() => markManyRead(items)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-transparent ring-1 ring-rose-200 dark:ring-rose-500/30 hover:ring-rose-300 dark:hover:ring-rose-500/50 text-rose-700 dark:text-rose-300 font-mono text-[10px] uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            aria-label="Mark all as read"
          >
            <CheckCheck className="w-3 h-3" />
            Mark all read
          </button>
        )}
      </div>

      {/* Stream list */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400 border-b border-zinc-200 dark:border-zinc-800">
            {error}
          </div>
        )}

        {isLoading && <SkeletonList />}

        {!isLoading && filtered.length === 0 && <EmptyState filter={activeFilter} />}

        {!isLoading && filtered.length > 0 && (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filtered.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <TriageRow
                  item={item}
                  isPlaying={playingItemKey === `${item.kind}-${item.id}`}
                  onClick={() => handleRowClick(item)}
                  onTogglePlay={() => togglePlay(item)}
                  onMarkRead={() => markRead(item)}
                  onSnooze={(ms) => snoozeItem(item, ms)}
                  onReply={(() => {
                    // Thread rows reply into the thread; quick/classic rows
                    // open a 1:1 composer prefilled with the sender.
                    if (item.kind === 'thread') {
                      const threadId = (item.raw as any)?.thread_id;
                      if (!threadId) return undefined;
                      return () => onReplyToThread(threadId, item.senderName);
                    }
                    return item.senderId ? () => onReply(item.senderId!) : undefined;
                  })()}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Compose pill — opens the RelayComposer (recipient picker + record
          area + preview). Space anywhere on Relay opens the same composer. */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 flex justify-center">
        <button
          type="button"
          onClick={onCompose}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold shadow-lg shadow-rose-500/25 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
          aria-label="Compose voice message (or press space)"
        >
          <Mic className="w-4 h-4" aria-hidden="true" />
          New voice message
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-80 pl-1">
            SPACE
          </span>
        </button>
      </div>
    </div>
  );
};

export default RelayTriageStream;

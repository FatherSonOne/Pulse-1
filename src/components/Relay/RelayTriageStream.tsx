// RelayTriageStream — Pulse "what voice needs me now?" surface.
//
// Stage 2.1d.3 of the Voxer→Relay rework. Default landing for /relay; replaces
// the placeholder div added in 2.1d.2. Renders the unified TriageItem feed
// from useRelayTriage with filter chips (ALL / NEEDS REPLY / MESSAGES /
// NOTES / LIVE), a needs-reply banner, per-row sender + audience metadata,
// empty states, a 5-row loading skeleton, and a "Hold space to talk" record
// pill that's visual-only at this stage (recording wires up later).
//
// Out of scope (per stage brief):
//  - Realtime updates / row-level subscriptions.
//  - Reply composition / "mark read" actions.
//  - Audio playback from the row click (rows just navigate to the matching
//    mode; the mode component handles playback itself).
//  - Audience picker / per-row dismiss / batch ops.

import React, { useMemo, useState } from 'react';
import type { Contact, User } from '../../types';
import { useRelayTriage, type TriageItem, type TriageItemKind } from '../../hooks/useRelayTriage';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
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
const TriageRow: React.FC<{ item: TriageItem; onClick: () => void }> = ({ item, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition flex items-start gap-3"
    >
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

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {item.senderName}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400 shrink-0">
            {item.audienceLabel}
          </span>
          <span className="ml-auto font-mono text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
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
  );
};

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

export const RelayTriageStream: React.FC<RelayTriageStreamProps> = ({ user, onOpenView }) => {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const { items, needsReplyCount, isLoading, error } = useRelayTriage(user?.id);

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

      {/* Triage banner — surface needs-reply count or "Inbox clear." */}
      <div className="px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border-b border-zinc-200 dark:border-zinc-800">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
          {needsReplyCount > 0
            ? `${needsReplyCount} voice ${needsReplyCount === 1 ? 'message' : 'messages'} need a reply`
            : 'Inbox clear.'}
        </p>
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
                <TriageRow item={item} onClick={() => handleRowClick(item)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bottom record pill — visual only in this stage; recording wires up
          in a later 2.1d sub-stage. */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 flex justify-center">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium shadow-lg shadow-rose-500/25 transition"
          title="Recording is wired in a later stage"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
          Hold space to talk
        </button>
      </div>
    </div>
  );
};

export default RelayTriageStream;

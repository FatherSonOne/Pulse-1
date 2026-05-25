import React from 'react';
import { Inbox, Mail, Pin, ListChecks, Vote, Archive } from 'lucide-react';

/**
 * FilterBar — Messages Path D (Signal Composer) redesign, Tranche 1.
 *
 * Replaces the old horizontally-scrolling mono-chip filter row. Per the
 * MESSAGES_REDESIGN_HANDOFF_2026-05-24 "no horizontal scroll" fix:
 *
 *   - Icon-led segmented control. Every filter is an icon; ONLY the active
 *     chip reveals its text label (a max-width transition).
 *   - The container uses flex-wrap as a hard safety net — it can never scroll
 *     horizontally; worst case a chip wraps to a second line.
 *   - Reduced-motion: the label/colour transitions are disabled via the
 *     `motion-reduce:` variant.
 *
 * Filter keys map 1:1 to Messages.tsx `threadFilter`
 * (`all | unread | pinned | with-tasks | with-decisions`). The active-filter
 * pill uses the sanctioned rose accent (DESIGN.md §"active-filter pills"),
 * NOT coral — coral stays reserved for AI-output surfaces.
 *
 * Deferred to a verified follow-up (handoff "back with real threadFilter
 * result"): the per-chip count badge / presence dot. The visible list is
 * driven by `pulseConversations` while filtering runs over `threads`, so
 * counts are intentionally omitted until that data source is reconciled.
 */

interface FilterDef {
  key: string;
  label: string;
  /** search-syntax token (e.g. `is:unread`) this chip mirrors; '' for All. */
  token: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
}

const FILTERS: FilterDef[] = [
  { key: 'all', label: 'All', token: '', Icon: Inbox, title: 'All conversations (J/K to navigate)' },
  { key: 'unread', label: 'Unread', token: 'is:unread', Icon: Mail, title: 'Unread conversations only (J/K to navigate)' },
  { key: 'pinned', label: 'Pinned', token: 'is:pinned', Icon: Pin, title: 'Pinned conversations only' },
  { key: 'with-tasks', label: 'Tasks', token: 'is:tasks', Icon: ListChecks, title: 'Conversations with tasks' },
  { key: 'with-decisions', label: 'Votes', token: 'is:votes', Icon: Vote, title: 'Conversations with votes or decisions' },
];

// Shared chip shell. `active` swaps in the rose accent + reveals the label.
const chipBase =
  'flex-shrink-0 h-6 px-1.5 inline-flex items-center rounded font-mono uppercase tracking-[0.1em] text-[10px] font-medium transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40';
const chipInactive =
  'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/40 dark:hover:bg-white/[0.04]';
// Label reveal: collapses to 0 width (icon-only) when inactive; the
// overflow-hidden + max-width keeps the row from ever needing to scroll.
const labelBase =
  'overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

interface FilterBarProps {
  threadFilter: string;
  setThreadFilter: (v: string) => void;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  threadFilter,
  setThreadFilter,
  showArchived,
  setShowArchived,
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <div
      role="group"
      aria-label="Filter conversations"
      className="mt-2 flex flex-wrap items-center gap-1"
    >
      {FILTERS.map(({ key, label, token, Icon, title }) => {
        const active = threadFilter === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              setThreadFilter(key);
              // Selecting "All" clears a lingering `is:` search token so the
              // chip and the search box don't disagree.
              if (token === '' && searchQuery.startsWith('is:')) setSearchQuery('');
            }}
            title={title}
            aria-label={title}
            aria-pressed={active}
            className={`${chipBase} ${active ? 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400' : chipInactive}`}
          >
            <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span className={`${labelBase} ${active ? 'max-w-[72px] opacity-100 pl-1' : 'max-w-0 opacity-0'}`}>
              {label}
            </span>
          </button>
        );
      })}

      <div className="flex-shrink-0 w-px h-3 bg-zinc-200 dark:bg-white/[0.08] mx-1" aria-hidden="true" />

      <button
        type="button"
        onClick={() => setShowArchived(!showArchived)}
        title={showArchived ? 'Hide archived conversations' : 'Show archived conversations'}
        aria-label="Show archived conversations"
        aria-pressed={showArchived}
        className={`${chipBase} ${showArchived ? 'bg-rose-500/10 text-[var(--pulse-rose-text)]' : chipInactive}`}
      >
        <Archive className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        <span className={`${labelBase} ${showArchived ? 'max-w-[72px] opacity-100 pl-1' : 'max-w-0 opacity-0'}`}>
          Archived
        </span>
      </button>
    </div>
  );
};

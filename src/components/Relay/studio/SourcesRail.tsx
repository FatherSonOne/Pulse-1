// Vertical sources rail — replaces the horizontal tab strip at the top of
// the Relay pane. Two-state width: 200px expanded (icon + label + desc +
// smart playlists), 64px collapsed (icons only with native tooltips).
//
// IA decision: 'Triage' route id keeps existing deep-links + analytics, but
// the user-facing label becomes 'Inbox' to match the smart-playlist mental
// model (it is the meta-feed across all sources). Per Path C / Voice Studio.

import React from 'react';
import {
  Inbox,
  User,
  Hash,
  Radio,
  FileText,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';

import { useRelayStudio } from './RelayStudioContext';
import type { RelayShortcutView } from '../../../hooks/useRelayKeyboardShortcuts';

import './sources-rail.css';

export interface SourcesRailProps {
  /** Currently active view id. */
  view: RelayShortcutView;
  /** Switch to a different view. */
  onSelectView: (view: RelayShortcutView) => void;
  /** Views to omit from the rail entirely (e.g. flag-gated 'live'). */
  hiddenViews?: RelayShortcutView[];
  /** Unread count per source (optional — when present, shows badge). */
  unreadCounts?: Partial<Record<RelayShortcutView, number>>;
  /** Smart-playlist counts. Optional; the playlist row hides when count is
   *  undefined so we don't show stale zeros. */
  playlistCounts?: {
    unheard?: number;
    needsReply?: number;
    bookmarked?: number;
    today?: number;
  };
  /** Durable send-outbox counts. Badges the Direct entry so a voice queued or
   *  failed for a contact you're not viewing stays visible from any view. */
  outbox?: { pending: number; failed: number };
}

interface RailItem {
  id: RelayShortcutView;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** SPACE-bar shortcut hint, shown in expanded mode title attr. */
  shortcut: string;
}

const RAIL_ITEMS: RailItem[] = [
  // 'desc' is the disambiguator (also feeds the collapsed-state tooltip below).
  // Inbox is the cross-source triage feed, NOT a peer source — 'All sources'
  // says so, separating it from Direct (one person) / Channels (one team).
  { id: 'triage',    label: 'Inbox',     desc: 'All sources',    Icon: Inbox,      shortcut: 'T' },
  { id: 'direct',    label: 'Direct',    desc: 'One person',     Icon: User,       shortcut: 'D' },
  { id: 'channel',   label: 'Channels',  desc: 'A team',         Icon: Hash,       shortcut: 'C' },
  { id: 'broadcast', label: 'Broadcast', desc: 'One to many',    Icon: Radio,      shortcut: 'B' },
  { id: 'notes',     label: 'Notes',     desc: 'Personal',       Icon: FileText,   shortcut: 'N' },
  { id: 'live',      label: 'Live',      desc: 'Rooms',          Icon: Headphones, shortcut: 'L' },
];

interface PlaylistRow {
  key: 'unheard' | 'needsReply' | 'bookmarked' | 'today';
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const PLAYLIST_ROWS: PlaylistRow[] = [
  { key: 'unheard',     label: 'Unheard',     Icon: Bookmark    },
  { key: 'needsReply',  label: 'Needs reply', Icon: AlertCircle },
  { key: 'bookmarked',  label: 'Bookmarked',  Icon: Bookmark    },
  { key: 'today',       label: 'Today',       Icon: CalendarDays },
];

export const SourcesRail: React.FC<SourcesRailProps> = ({
  view,
  onSelectView,
  unreadCounts,
  playlistCounts,
  hiddenViews,
  outbox,
}) => {
  const railItems = hiddenViews?.length
    ? RAIL_ITEMS.filter(item => !hiddenViews.includes(item.id))
    : RAIL_ITEMS;
  // railCollapsed here is the EFFECTIVE state (manual pref OR auto). When the
  // pane forces the collapse (railAutoCollapsed), the manual toggle would be a
  // no-op, so we hide it — widening the pane restores the labelled rail.
  const { railCollapsed, railAutoCollapsed, toggleRail } = useRelayStudio();

  return (
    <aside
      className={`pulse-rail ${railCollapsed ? 'pulse-rail--collapsed' : 'pulse-rail--expanded'}`}
      role="navigation"
      aria-label="Relay sources"
    >
      <div className={`pulse-rail__head ${railCollapsed ? 'pulse-rail__head--collapsed' : ''}`}>
        {!railCollapsed && <span className="pulse-rail__eyebrow">SOURCES</span>}
        {!railAutoCollapsed && (
          <button
            type="button"
            onClick={toggleRail}
            className="pulse-rail__toggle"
            aria-label={railCollapsed ? 'Expand sources rail' : 'Collapse sources rail'}
            aria-expanded={!railCollapsed}
            title={railCollapsed ? 'Expand rail' : 'Collapse rail'}
          >
            {railCollapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft  className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <nav className="pulse-rail__items">
        {railItems.map(item => {
          const active = view === item.id;
          const count = unreadCounts?.[item.id] ?? 0;
          // Durable-outbox badge lives on Direct (where quick_vox queues). Failed
          // (parked) outranks pending; either keeps the entry visible from any view.
          const ob = item.id === 'direct' ? outbox : undefined;
          const obTotal = ob ? ob.pending + ob.failed : 0;
          const obFailed = ob?.failed ?? 0;
          const obTitle =
            obTotal > 0
              ? obFailed > 0
                ? `${obFailed} voice message${obFailed > 1 ? 's' : ''} failed to send — open Direct to retry`
                : `${ob!.pending} voice message${ob!.pending > 1 ? 's' : ''} sending…`
              : undefined;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-section={item.id}
              onClick={() => onSelectView(item.id)}
              title={
                railCollapsed
                  ? `${item.label} — ${item.desc}  (${item.shortcut})${obTitle ? ` · ${obTitle}` : ''}`
                  : undefined
              }
              className={`pulse-rail__item ${active ? 'pulse-rail__item--active' : ''}`}
            >
              <span className="pulse-rail__icon-wrap">
                <item.Icon className="w-4 h-4" />
                {/* Collapsed-state dot — outbox (red failed / amber sending)
                    outranks the unread dot; expanded shows a count pill instead. */}
                {railCollapsed && obTotal > 0 ? (
                  <span
                    className={`pulse-rail__icon-dot ${obFailed > 0 ? '' : 'pulse-dot-anim'}`}
                    style={{ background: obFailed > 0 ? '#ef4444' : '#f59e0b' }}
                    aria-hidden="true"
                  />
                ) : railCollapsed && count > 0 ? (
                  <span className="pulse-rail__icon-dot pulse-dot-anim" aria-hidden="true" />
                ) : null}
              </span>
              {!railCollapsed && (
                <>
                  <span className="pulse-rail__label-stack">
                    <span className="pulse-rail__label">{item.label}</span>
                    <span className="pulse-rail__desc">{item.desc}</span>
                  </span>
                  {obTotal > 0 ? (
                    <span
                      className={`ml-auto inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        obFailed > 0
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                      title={obTitle}
                      aria-label={obTitle}
                    >
                      {obFailed > 0 ? obFailed : ob!.pending}
                    </span>
                  ) : count > 0 ? (
                    <span className="pulse-rail__count" aria-label={`${count} unread`}>{count}</span>
                  ) : null}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {!railCollapsed && playlistCounts && (
        <div className="pulse-rail__playlists">
          <div className="pulse-rail__eyebrow pulse-rail__eyebrow--inset">SMART PLAYLISTS</div>
          {PLAYLIST_ROWS.map(row => {
            const count = playlistCounts[row.key];
            if (count === undefined) return null;
            return (
              <button
                key={row.key}
                type="button"
                className="pulse-rail__playlist"
              >
                <row.Icon className="w-3.5 h-3.5 opacity-70" />
                <span className="pulse-rail__playlist-label">{row.label}</span>
                <span className="pulse-rail__playlist-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
};

export default SourcesRail;

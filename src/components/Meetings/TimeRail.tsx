// TimeRail — the Coral Cockpit dashboard for Meetings.
//
// Replaces the prior "feature-card grid + sidebar" topology with a vertical
// timeline rooted in temporal data (Now / Next / Today / This Week / Recent).
// Every advanced feature survives — they are now contextual row actions or
// reachable via the header Tools overflow.

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Calendar, ChevronDown, FileText, Inbox, Megaphone, Mic, Monitor,
  Plus, Settings, Sliders, SplitSquareVertical, UserPlus, Video, Wand2, Zap,
  CheckCircle2, Copy, BarChart, PlayCircle, ListChecks, X,
} from 'lucide-react';
import { CalendarEvent, ArchiveItem, Contact } from '../../types';
import { Platform } from './MeetingsComponents';

// ============================================
// TIME BUCKETING
// ============================================

interface BucketedMeetings {
  now: CalendarEvent[];
  next: CalendarEvent[];
  today: CalendarEvent[];
  thisWeek: CalendarEvent[];
}

export function bucketMeetings(meetings: CalendarEvent[], reference = new Date()): BucketedMeetings {
  const now = reference;
  const nextThreshold = new Date(now.getTime() + 60 * 60 * 1000);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const buckets: BucketedMeetings = { now: [], next: [], today: [], thisWeek: [] };

  meetings.forEach(m => {
    if (m.start <= now && m.end >= now) buckets.now.push(m);
    else if (m.start > now && m.start <= nextThreshold) buckets.next.push(m);
    else if (m.start > nextThreshold && m.start <= endOfToday) buckets.today.push(m);
    else if (m.start > endOfToday && m.start <= endOfWeek) buckets.thisWeek.push(m);
  });

  return buckets;
}

// ============================================
// TIME FORMATTERS
// ============================================

function formatTime(d: Date, reference = new Date()): string {
  const sameDay = d.toDateString() === reference.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return time;
  const dayOfWeek = d.toLocaleDateString([], { weekday: 'short' });
  return `${dayOfWeek} ${time}`;
}

function formatRelative(d: Date, reference = new Date()): string {
  const diffMs = reference.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function minutesUntil(d: Date, reference = new Date()): number {
  return Math.round((d.getTime() - reference.getTime()) / 60000);
}

// ============================================
// TIME-RAIL ROW
// ============================================

interface TimeRailRowProps {
  rowId: string;
  time: string;
  title: string;
  meta?: string;
  imminent?: boolean;
  live?: boolean;
  hasRecap?: boolean;
  cursor?: boolean;
  primaryAction: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onHover?: (id: string) => void;
}

const TimeRailRow: React.FC<TimeRailRowProps> = ({
  rowId, time, title, meta, imminent, live, hasRecap, cursor, primaryAction, onPrimary, onSecondary, onHover,
}) => {
  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Allow clicks on interactive children (the secondary button) to bubble up
    // without firing the row's primary action — the button's own handler stops propagation.
    if ((e.target as HTMLElement).closest('button, a, input, [role="menuitem"]')) return;
    onPrimary();
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if ((e.target as HTMLElement) !== e.currentTarget) return;
      e.preventDefault();
      onPrimary();
    }
  };

  return (
    <div
      className={`mtg-rail-row ${live ? 'is-live' : ''} ${imminent ? 'is-imminent' : ''} ${cursor ? 'is-cursor' : ''}`}
      data-row-id={rowId}
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      onMouseEnter={onHover ? () => onHover(rowId) : undefined}
      aria-label={`${primaryAction}: ${title}`}
    >
      <div className="mtg-rail-time">
        {live && <span className="mtg-rail-live-dot" aria-label="Live" />}
        {hasRecap && !live && <span className="mtg-rail-recap-dot" aria-label="Recap ready" />}
        <span>{time}</span>
      </div>
      <div className="mtg-rail-body">
        <div className="mtg-rail-title">{title}</div>
        {meta && <div className="mtg-rail-meta">{meta}</div>}
      </div>
      <div className="mtg-rail-actions">
        {onSecondary && (
          <button
            className="mtg-rail-secondary"
            onClick={(e) => { e.stopPropagation(); onSecondary(); }}
            aria-label="More options"
          >
            <Sliders size={14} />
          </button>
        )}
        <button
          className={`mtg-rail-primary ${live || imminent ? 'is-coral' : ''}`}
          onClick={(e) => { e.stopPropagation(); onPrimary(); }}
        >
          {primaryAction}
        </button>
      </div>
    </div>
  );
};

// ============================================
// TIME-RAIL BUCKET
// ============================================

interface BucketProps {
  label: string;
  count?: number;
  children: React.ReactNode;
}

const Bucket: React.FC<BucketProps> = ({ label, count, children }) => (
  <section className="mtg-rail-bucket">
    <header className="mtg-rail-bucket-header">
      <span className="mtg-rail-bucket-label">{label}</span>
      {count !== undefined && count > 0 && <span className="mtg-rail-bucket-count">· {count}</span>}
    </header>
    <div className="mtg-rail-bucket-rows">{children}</div>
  </section>
);

// ============================================
// TIME RAIL (main left column)
// ============================================

export interface TimeRailProps {
  meetings: CalendarEvent[];
  recentNotes: ArchiveItem[];
  onJoinMeeting: (meeting: CalendarEvent) => void;
  onOpenMeeting: (meeting: CalendarEvent) => void;
  onOpenRecap: (note: ArchiveItem) => void;
  onMeetingMenu?: (meeting: CalendarEvent) => void;
  /** Id of the row currently under the keyboard cursor (for visual highlight). */
  cursorRowId?: string | null;
  /** Notify parent of mouse hover so cursor follows the mouse without fighting it. */
  onRowHover?: (id: string) => void;
}

export const TimeRail: React.FC<TimeRailProps> = ({
  meetings, recentNotes, onJoinMeeting, onOpenMeeting, onOpenRecap, onMeetingMenu, cursorRowId, onRowHover,
}) => {
  const buckets = useMemo(() => bucketMeetings(meetings), [meetings]);
  const recent = useMemo(() => recentNotes.slice(0, 8), [recentNotes]);
  const isEmpty =
    buckets.now.length === 0 && buckets.next.length === 0 &&
    buckets.today.length === 0 && buckets.thisWeek.length === 0 && recent.length === 0;

  if (isEmpty) {
    return (
      <div className="mtg-rail">
        <div className="mtg-rail-empty-stack" role="region" aria-label="Get started">
          <div className="mtg-rail-empty-headline">No meetings on deck.</div>
          <div className="mtg-rail-empty-row">
            <span className="mtg-rail-empty-key">START</span>
            <span className="mtg-rail-empty-copy">Try <kbd>N</kbd> for an instant Pulse room.</span>
          </div>
          <div className="mtg-rail-empty-row">
            <span className="mtg-rail-empty-key">JOIN</span>
            <span className="mtg-rail-empty-copy">Paste a Zoom, Meet, Teams or Pulse link above. <kbd>J</kbd> focuses the input.</span>
          </div>
          <div className="mtg-rail-empty-row">
            <span className="mtg-rail-empty-key">SCHEDULE</span>
            <span className="mtg-rail-empty-copy">Connect Google Calendar to see your day. <kbd>S</kbd> opens scheduling.</span>
          </div>
          <div className="mtg-rail-empty-footnote">
            Press <kbd>?</kbd> for the full keyboard map.
          </div>
        </div>
      </div>
    );
  }

  const renderMeetingRow = (m: CalendarEvent, opts: { live?: boolean; imminent?: boolean; future?: boolean } = {}) => {
    const attendees = m.attendees?.length ?? 0;
    const meta = attendees > 1 ? `${attendees} attendees` : undefined;
    const time = formatTime(m.start);
    const minsAway = minutesUntil(m.start);
    const imminent = opts.imminent ?? (minsAway > 0 && minsAway <= 5);
    const action = opts.live ? 'Rejoin' : opts.future ? 'Open' : 'Join';
    return (
      <TimeRailRow
        key={m.id}
        rowId={m.id}
        time={time}
        title={m.title}
        meta={meta}
        live={opts.live}
        imminent={imminent}
        cursor={cursorRowId === m.id}
        primaryAction={action}
        onPrimary={() => (opts.future ? onOpenMeeting(m) : onJoinMeeting(m))}
        onSecondary={onMeetingMenu ? () => onMeetingMenu(m) : undefined}
        onHover={onRowHover}
      />
    );
  };

  return (
    <div className="mtg-rail">
      {buckets.now.length > 0 && (
        <Bucket label="NOW" count={buckets.now.length}>
          {buckets.now.map(m => renderMeetingRow(m, { live: true }))}
        </Bucket>
      )}
      {buckets.next.length > 0 && (
        <Bucket label="NEXT" count={buckets.next.length}>
          {buckets.next.map(m => renderMeetingRow(m, { imminent: true }))}
        </Bucket>
      )}
      {buckets.today.length > 0 && (
        <Bucket label="TODAY" count={buckets.today.length}>
          {buckets.today.map(m => renderMeetingRow(m))}
        </Bucket>
      )}
      {buckets.thisWeek.length > 0 && (
        <Bucket label="THIS WEEK" count={buckets.thisWeek.length}>
          {buckets.thisWeek.map(m => renderMeetingRow(m, { future: true }))}
        </Bucket>
      )}
      {recent.length > 0 && (
        <Bucket label="RECENT" count={recent.length}>
          {recent.map(note => (
            <TimeRailRow
              key={note.id}
              rowId={note.id}
              time={formatRelative(note.date)}
              title={note.title}
              meta={note.tags.slice(0, 2).map(t => `#${t}`).join(' · ') || undefined}
              hasRecap
              cursor={cursorRowId === note.id}
              primaryAction="Recap"
              onPrimary={() => onOpenRecap(note)}
              onHover={onRowHover}
            />
          ))}
        </Bucket>
      )}
    </div>
  );
};

// ============================================
// HEADER STRIP
// ============================================

export interface MeetingsHeaderStripProps {
  meetingCount: number;
  pendingActionCount: number;
  onOpenTools: () => void;
  onOpenActions: () => void;
  onOpenSettings: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';

export const MeetingsHeaderStrip: React.FC<MeetingsHeaderStripProps> = ({
  meetingCount, pendingActionCount, onOpenTools, onOpenActions, onOpenSettings,
}) => (
  <div className="mtg-header-strip">
    <div className="mtg-header-label">
      MEETINGS · <span className="mtg-header-count">{meetingCount}</span>
    </div>
    <div className="mtg-header-actions">
      <button
        className="mtg-header-icon-btn"
        onClick={onOpenTools}
        title={`Tools (${modKey}+K)`}
        aria-label="Tools"
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      >
        <Sliders size={16} />
        <span>TOOLS</span>
        <kbd className="mtg-header-kbd">{modKey}K</kbd>
      </button>
      <button className="mtg-header-icon-btn" onClick={onOpenActions} title="Action items" aria-label="Action items">
        <CheckCircle2 size={16} />
        <span>ACTIONS</span>
        {pendingActionCount > 0 && <span className="mtg-header-badge">{pendingActionCount}</span>}
      </button>
      <button className="mtg-header-icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Settings">
        <Settings size={16} />
      </button>
    </div>
  </div>
);

// ============================================
// ACTION ROW — Join + Start + Schedule
// ============================================

export interface MeetingsActionRowProps {
  joinValue: string;
  onJoinChange: (v: string) => void;
  onJoinSubmit: (e: React.FormEvent) => void;
  onStartPulse: () => void;
  onStartExternal: (platform: Platform) => void;
  onSchedule: () => void;
  /** Inline mono-tracked error message rendered below the join input. */
  error?: string | null;
}

export const MeetingsActionRow: React.FC<MeetingsActionRowProps> = ({
  joinValue, onJoinChange, onJoinSubmit, onStartPulse, onStartExternal, onSchedule, error,
}) => {
  const [startOpen, setStartOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const startRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (startRef.current && !startRef.current.contains(e.target as Node)) setStartOpen(false);
      if (scheduleRef.current && !scheduleRef.current.contains(e.target as Node)) setScheduleOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="mtg-action-row">
      <form className="mtg-action-join" onSubmit={onJoinSubmit}>
        <div className="mtg-action-join-wrap">
          <input
            id="mtg-join-input"
            type="text"
            className={`mtg-action-join-input ${error ? 'has-error' : ''}`}
            placeholder="Paste meeting link or enter code…"
            value={joinValue}
            onChange={e => onJoinChange(e.target.value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'mtg-join-error' : undefined}
          />
          {error && (
            <div id="mtg-join-error" className="mtg-action-join-error" role="alert">{error}</div>
          )}
        </div>
      </form>
      <div className="mtg-action-split" ref={startRef}>
        <button className="mtg-action-start" onClick={onStartPulse}>
          Start Pulse
        </button>
        <button
          className="mtg-action-caret"
          onClick={() => setStartOpen(v => !v)}
          aria-label="Other platforms"
          aria-expanded={startOpen}
        >
          <ChevronDown size={14} />
        </button>
        {startOpen && (
          <div className="mtg-action-menu">
            <button onClick={() => { setStartOpen(false); onStartExternal('google_meet'); }}>Google Meet</button>
            <button onClick={() => { setStartOpen(false); onStartExternal('zoom'); }}>Zoom</button>
            <button onClick={() => { setStartOpen(false); onStartExternal('teams'); }}>Microsoft Teams</button>
            <button onClick={() => { setStartOpen(false); onStartExternal('skype'); }}>Skype</button>
          </div>
        )}
      </div>
      <button className="mtg-action-schedule" onClick={onSchedule}>
        Schedule
      </button>
    </div>
  );
};

// ============================================
// TOOLS MENU (popover triggered from header)
// ============================================

export interface MeetingsToolsMenuProps {
  open: boolean;
  onClose: () => void;
  onTemplates: () => void;
  onAgenda: () => void;
  onRecordings: () => void;
  onAnalytics: () => void;
  onBulkInvite: () => void;
  onBreakout: () => void;
  onDeviceTest: () => void;
}

export const MeetingsToolsMenu: React.FC<MeetingsToolsMenuProps> = ({
  open, onClose, onTemplates, onAgenda, onRecordings, onAnalytics, onBulkInvite, onBreakout, onDeviceTest,
}) => {
  if (!open) return null;
  const items: Array<{ icon: React.ReactNode; label: string; desc: string; onClick: () => void }> = [
    { icon: <Copy size={16} />, label: 'TEMPLATES', desc: 'Standups, 1:1s, planning', onClick: () => { onClose(); onTemplates(); } },
    { icon: <ListChecks size={16} />, label: 'AGENDA', desc: 'Build a structured agenda', onClick: () => { onClose(); onAgenda(); } },
    { icon: <PlayCircle size={16} />, label: 'RECORDINGS', desc: 'Past meeting recordings', onClick: () => { onClose(); onRecordings(); } },
    { icon: <BarChart size={16} />, label: 'ANALYTICS', desc: 'Frequency, duration, trends', onClick: () => { onClose(); onAnalytics(); } },
    { icon: <UserPlus size={16} />, label: 'BULK INVITE', desc: 'Invite from contacts', onClick: () => { onClose(); onBulkInvite(); } },
    { icon: <SplitSquareVertical size={16} />, label: 'BREAKOUT', desc: 'Pre-plan breakout rooms', onClick: () => { onClose(); onBreakout(); } },
    { icon: <Mic size={16} />, label: 'DEVICE TEST', desc: 'Mic + camera check', onClick: () => { onClose(); onDeviceTest(); } },
  ];
  return (
    <>
      <div className="mtg-tools-backdrop" onClick={onClose} />
      <div className="mtg-tools-menu" role="menu">
        {items.map(item => (
          <button key={item.label} className="mtg-tools-item" onClick={item.onClick} role="menuitem">
            <span className="mtg-tools-icon">{item.icon}</span>
            <span className="mtg-tools-text">
              <span className="mtg-tools-label">{item.label}</span>
              <span className="mtg-tools-desc">{item.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
};

// ============================================
// COMPACT SIDEBAR — Insight + Quick Actions (no Upcoming; rail handles it)
// ============================================

// ============================================
// RAIL KICKER — horizontal mono summary above the rail
// Replaces the prior right-sidebar insight + quick stack (Phase 10.6 distill)
// ============================================

export interface MeetingsRailKickerProps {
  totalMeetings: number;
  avgDurationMinutes: number;
  weeklyTrendDelta?: number;
}

export const MeetingsRailKicker: React.FC<MeetingsRailKickerProps> = ({
  totalMeetings, avgDurationMinutes, weeklyTrendDelta,
}) => {
  if (totalMeetings === 0) return null;
  const arrow = weeklyTrendDelta === undefined ? null : weeklyTrendDelta < 0 ? '↓' : weeklyTrendDelta > 0 ? '↑' : '→';
  return (
    <div className="mtg-rail-kicker">
      <span className="mtg-rail-kicker-segment">
        <span className="mtg-rail-kicker-value">{totalMeetings}</span>
        <span className="mtg-rail-kicker-unit">{totalMeetings === 1 ? 'meeting' : 'meetings'}</span>
      </span>
      <span className="mtg-rail-kicker-sep" aria-hidden="true">·</span>
      <span className="mtg-rail-kicker-segment">
        <span className="mtg-rail-kicker-label">AVG</span>
        <span className="mtg-rail-kicker-value">{avgDurationMinutes}</span>
        <span className="mtg-rail-kicker-unit">min</span>
      </span>
      {arrow && weeklyTrendDelta !== undefined && (
        <>
          <span className="mtg-rail-kicker-sep" aria-hidden="true">·</span>
          <span className="mtg-rail-kicker-segment mtg-rail-kicker-trend">
            {arrow} {Math.abs(weeklyTrendDelta)} min vs last
          </span>
        </>
      )}
    </div>
  );
};

// ============================================
// SHORTCUTS OVERLAY — `?` to toggle
// ============================================

export interface MeetingsShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const MeetingsShortcutsOverlay: React.FC<MeetingsShortcutsOverlayProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const groups: Array<{ label: string; rows: Array<[string, string]> }> = [
    {
      label: 'NAVIGATE',
      rows: [
        [`${modKey} K`, 'Open tools'],
        ['↑ ↓', 'Move cursor on rail'],
        ['Enter', 'Join cursor row'],
        ['M', 'Row menu'],
      ],
    },
    {
      label: 'ACTIONS',
      rows: [
        ['N', 'Start Pulse meeting'],
        ['J', 'Focus join input'],
        ['S', 'Schedule meeting'],
      ],
    },
    {
      label: 'HELP',
      rows: [
        ['?', 'Toggle this overlay'],
        ['Esc', 'Close overlay'],
      ],
    },
  ];

  return (
    <>
      <div className="mtg-shortcuts-backdrop" onClick={onClose} />
      <div className="mtg-shortcuts-card" role="dialog" aria-label="Keyboard shortcuts">
        <div className="mtg-shortcuts-header">
          <span className="mtg-shortcuts-title">KEYBOARD SHORTCUTS</span>
          <button className="mtg-shortcuts-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="mtg-shortcuts-body">
          {groups.map(g => (
            <section key={g.label} className="mtg-shortcuts-group">
              <header className="mtg-shortcuts-group-label">{g.label}</header>
              {g.rows.map(([keys, desc]) => (
                <div key={keys} className="mtg-shortcuts-row">
                  <kbd className="mtg-shortcuts-keys">{keys}</kbd>
                  <span className="mtg-shortcuts-desc">{desc}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  );
};

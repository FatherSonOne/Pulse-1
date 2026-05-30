import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X, Check, Plus, ChevronRight, Sliders,
  Calendar as CalendarLucide, Video, Phone, Brain, User, Flag, Plane, Users,
  HeartPulse, Bell,
} from 'lucide-react';
import { CalendarEvent, Contact } from '../../types';
import { RecurrencePicker } from './RecurrencePicker';
import { VideoLinkSelector } from './VideoLinkSelector';
import { EventStatusBadge, EventStatus } from './EventStatusBadge';
import { EVENT_COLORS, RecurrenceType, ReminderTime } from './calendarTypes';

interface EventTypeOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface EventCreationModalProps {
  isOpen: boolean;
  editingEvent: CalendarEvent | null;

  newEventTitle: string;
  onTitleChange: (v: string) => void;

  newEventDate: string;
  onDateChange: (v: string) => void;

  newEventTime: string;
  onTimeChange: (v: string) => void;

  newEventEndTime: string;
  onEndTimeChange: (v: string) => void;

  newEventAllDay: boolean;
  onAllDayChange: (v: boolean) => void;

  newEventDesc: string;
  onDescChange: (v: string) => void;

  newEventLocation: string;
  onLocationChange: (v: string) => void;

  newEventColor: string;
  onColorChange: (v: string) => void;

  newEventType: CalendarEvent['type'];
  onTypeChange: (v: CalendarEvent['type']) => void;

  newEventRecurrence: RecurrenceType;
  onRecurrenceChange: (v: RecurrenceType) => void;
  newEventRrule?: string | null;
  onRruleChange?: (v: string | null) => void;

  newEventReminder: ReminderTime;
  onReminderChange: (v: ReminderTime) => void;

  newEventStatus?: EventStatus;
  onStatusChange?: (v: EventStatus) => void;

  newEventAttendees: string[];
  onAddAttendee: (id: string) => void;
  onRemoveAttendee: (id: string) => void;

  allEventTypes: EventTypeOption[];
  contacts: Contact[];

  autoDetectEventType: (title: string, desc?: string, location?: string) => string;

  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onOpenCustomTypesManager: () => void;
}

// ─── Font Awesome → Lucide icon resolver ───────────────────────────────────
// EVENT_TYPES still carries FA class strings (consumed in several other
// surfaces). The modal renders Lucide so the icon vocabulary stays consistent
// with the rest of Calendar. Add new mappings here when EVENT_TYPES grows.
function TypeIcon({ faClass, size = 14 }: { faClass: string; size?: number }): React.ReactElement {
  const className = 'inline-block shrink-0';
  if (faClass.includes('fa-video'))       return <Video size={size} className={className} />;
  if (faClass.includes('fa-phone'))       return <Phone size={size} className={className} />;
  if (faClass.includes('fa-brain'))       return <Brain size={size} className={className} />;
  if (faClass.includes('fa-flag'))        return <Flag size={size} className={className} />;
  if (faClass.includes('fa-plane'))       return <Plane size={size} className={className} />;
  if (faClass.includes('fa-heart-pulse')) return <HeartPulse size={size} className={className} />;
  if (faClass.includes('fa-bell'))        return <Bell size={size} className={className} />;
  if (faClass.includes('fa-users'))       return <Users size={size} className={className} />;
  if (faClass.includes('fa-user'))        return <User size={size} className={className} />;
  return <CalendarLucide size={size} className={className} />;
}

// ─── Client-side natural-language parser ───────────────────────────────────
// Lightweight regex for "tomorrow 2pm" / "Friday 1–2pm" / "next Monday 9am"
// Returns null when nothing parseable was found. Confidence chips above the
// WHEN section reflect what was extracted; user can dismiss any chip.
interface ParsedHints {
  date?: { iso: string; label: string };
  start?: { hhmm: string; label: string };
  end?: { hhmm: string; label: string };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmt12(h: number, m: number): string {
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

function parseTimeToken(token: string): { hhmm: string; label: string } | null {
  // 2pm, 2:30pm, 14:00, 2:30
  const m = token.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return {
    hhmm: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    label: fmt12(h, min),
  };
}

function parseNL(input: string): ParsedHints {
  const out: ParsedHints = {};
  const lower = input.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── DATE ────────────────────────────────────────────────────────────────
  if (/\btoday\b/.test(lower) || /\btonight\b/.test(lower)) {
    out.date = { iso: toIso(today), label: 'Today' };
  } else if (/\btomorrow\b/.test(lower)) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    out.date = { iso: toIso(d), label: 'Tomorrow' };
  } else {
    const wkdMatch = lower.match(/\b(next\s+)?(sun|mon|tue|wed|thu|fri|sat)(?:day|nesday|sday|rday)?\b/);
    if (wkdMatch) {
      const isNext = !!wkdMatch[1];
      const dayPrefix = wkdMatch[2];
      const targetIdx = WEEKDAYS.findIndex(d => d.startsWith(dayPrefix));
      if (targetIdx >= 0) {
        const d = new Date(today);
        const todayIdx = d.getDay();
        let diff = targetIdx - todayIdx;
        if (diff <= 0) diff += 7;
        if (isNext && diff < 7) diff += 7;
        d.setDate(d.getDate() + diff);
        out.date = { iso: toIso(d), label: fmtDateLabel(d) };
      }
    }
  }

  // ── TIME RANGE ─────────────────────────────────────────────────────────
  // "1-2pm", "1pm-2pm", "1pm to 2pm", "1:30-2:30pm"
  const rangeMatch = lower.match(/\b(\d{1,2}(?::\d{2})?(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d{2})?(?:am|pm)?)\b/);
  if (rangeMatch) {
    let s = parseTimeToken(rangeMatch[1]);
    const e = parseTimeToken(rangeMatch[2]);
    // If "1-2pm" — the 1 has no am/pm but the 2 does. Apply 2's am/pm to 1.
    if (s && e && !/am|pm/i.test(rangeMatch[1]) && /pm/i.test(rangeMatch[2])) {
      s = parseTimeToken(rangeMatch[1] + 'pm');
    } else if (s && e && !/am|pm/i.test(rangeMatch[1]) && /am/i.test(rangeMatch[2])) {
      s = parseTimeToken(rangeMatch[1] + 'am');
    }
    if (s) out.start = s;
    if (e) out.end = e;
  } else {
    // Single time
    const singleMatch = lower.match(/\b(\d{1,2}(?::\d{2})?(?:am|pm))\b/);
    if (singleMatch) {
      const t = parseTimeToken(singleMatch[1]);
      if (t) out.start = t;
    }
  }

  return out;
}

// ─── Collapsible section ───────────────────────────────────────────────────
interface SectionProps {
  label: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ label, summary, expanded, onToggle, children }) => (
  <div className="border-t border-[var(--pulse-border)] first:border-t-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="w-full flex items-center justify-between gap-3 py-3 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] focus-visible:ring-offset-2 transition"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase font-semibold text-[var(--pulse-ink-3)] w-12 shrink-0">
          {label}
        </span>
        <span className={`text-sm truncate ${summary === '—' ? 'text-[var(--pulse-ink-3)]' : 'text-[var(--pulse-ink)]'}`}>
          {summary}
        </span>
      </div>
      <ChevronRight
        size={14}
        className="shrink-0 text-[var(--pulse-ink-3)] transition-transform duration-200"
        style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}
        aria-hidden="true"
      />
    </button>
    {expanded && (
      <div className="pb-4 pl-[68px] pr-1 space-y-3">
        {children}
      </div>
    )}
  </div>
);

// ─── Mono uppercase label ──────────────────────────────────────────────────
const MonoLabel: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <label
    htmlFor={htmlFor}
    className="block font-mono text-[10px] tracking-[0.1em] uppercase font-semibold text-[var(--pulse-ink-3)] mb-1.5"
  >
    {children}
  </label>
);

// ─── Standard input class (coral focus ring, token-driven) ─────────────────
const INPUT_BASE =
  'w-full bg-[var(--pulse-canvas-soft)] dark:bg-white/[0.03] ' +
  'border border-[var(--pulse-border)] rounded-lg px-3 py-2.5 text-sm ' +
  'text-[var(--pulse-ink)] placeholder:text-[var(--pulse-ink-3)] ' +
  'outline-none focus:border-[var(--pulse-rose)] ' +
  'focus:ring-2 focus:ring-[var(--pulse-rose-soft)] transition';

export const EventCreationModal = React.memo<EventCreationModalProps>((props) => {
  const isEdit = !!props.editingEvent;
  const formRef = useRef<HTMLFormElement>(null);

  // ── Collapsible state ──────────────────────────────────────────────────
  // Auto-expand sections with data when opening in edit mode; auto-expand
  // WHEN by default in create mode so the most common path is one click closer.
  const [openSections, setOpenSections] = useState<{ when: boolean; who: boolean; what: boolean }>(() => ({
    when: true,
    who: isEdit && props.newEventAttendees.length > 0,
    what: isEdit && (!!props.newEventDesc || !!props.newEventLocation),
  }));
  const toggle = useCallback((key: 'when' | 'who' | 'what') => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Dirty tracking + draft-guard ───────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const [draftGuard, setDraftGuard] = useState(false);
  useEffect(() => {
    if (!props.isOpen) {
      setIsDirty(false);
      setDraftGuard(false);
    }
  }, [props.isOpen]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleClose = useCallback(() => {
    if (isDirty && !draftGuard) {
      setDraftGuard(true);
      return;
    }
    props.onClose();
  }, [isDirty, draftGuard, props]);

  // ── Esc + ⌘↵ keyboard model ────────────────────────────────────────────
  useEffect(() => {
    if (!props.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.isOpen, handleClose]);

  // ── NL parsing on title ────────────────────────────────────────────────
  const [parsed, setParsed] = useState<ParsedHints>({});
  const [dismissed, setDismissed] = useState<Set<'date' | 'start' | 'end'>>(new Set());
  useEffect(() => {
    if (!props.isOpen) {
      setParsed({});
      setDismissed(new Set());
    }
  }, [props.isOpen]);

  const applyParsed = useCallback((hints: ParsedHints) => {
    if (hints.date && !dismissed.has('date')) props.onDateChange(hints.date.iso);
    if (hints.start && !dismissed.has('start')) props.onTimeChange(hints.start.hhmm);
    if (hints.end && !dismissed.has('end')) props.onEndTimeChange(hints.end.hhmm);
  }, [props, dismissed]);

  const dismissChip = (key: 'date' | 'start' | 'end') => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setParsed(prev => ({ ...prev, [key]: undefined }));
  };

  // ── Section summaries (rendered at rest) ───────────────────────────────
  const whenSummary = useMemo(() => {
    if (!props.newEventDate) return '—';
    const d = new Date(props.newEventDate + 'T00:00:00');
    const dateLabel = fmtDateLabel(d);
    if (props.newEventAllDay) return `${dateLabel} · All day`;
    const startT = parseTimeToken(props.newEventTime || '09:00');
    const endT = parseTimeToken(props.newEventEndTime || '10:00');
    return `${dateLabel} · ${startT?.label || ''}–${endT?.label || ''}`;
  }, [props.newEventDate, props.newEventAllDay, props.newEventTime, props.newEventEndTime]);

  const whoSummary = useMemo(() => {
    if (props.newEventAttendees.length === 0) return '—';
    const first = props.contacts.find(c => c.id === props.newEventAttendees[0]);
    const rest = props.newEventAttendees.length - 1;
    return rest > 0 ? `${first?.name ?? '1 person'} · ${rest} more` : (first?.name ?? '1 person');
  }, [props.newEventAttendees, props.contacts]);

  const whatSummary = useMemo(() => {
    const typeName = props.allEventTypes.find(t => t.id === props.newEventType)?.name ?? '—';
    const bits: string[] = [];
    if (typeName !== '—') bits.push(typeName);
    if (props.newEventLocation) bits.push(props.newEventLocation);
    return bits.length > 0 ? bits.join(' · ') : '—';
  }, [props.newEventType, props.newEventLocation, props.allEventTypes]);

  // ── Title change handler with NL parse + auto-detect type ──────────────
  const handleTitleChange = (val: string) => {
    props.onTitleChange(val);
    markDirty();
    if (val.length > 3) {
      const detected = props.autoDetectEventType(val, props.newEventDesc, props.newEventLocation);
      props.onTypeChange(detected as CalendarEvent['type']);
    }
    if (val.length > 0) {
      const hints = parseNL(val);
      setParsed(hints);
      applyParsed(hints);
    } else {
      setParsed({});
    }
  };

  if (!props.isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-50 bg-[var(--pulse-canvas)]/70 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
    >
      <form
        ref={formRef}
        onSubmit={(e) => { setIsDirty(false); props.onSubmit(e); }}
        className="bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in my-8 flex flex-col max-h-[calc(100vh-4rem)]"
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3
            id="event-modal-title"
            className="font-mono text-[11px] tracking-[0.15em] uppercase font-semibold text-[var(--pulse-ink-3)]"
          >
            {isEdit ? 'Edit event' : 'New event'}
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[var(--pulse-ink-3)] hover:text-[var(--pulse-ink)] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* ── Title capture ─────────────────────────────────────── */}
        <div className="px-5 pb-3">
          <input
            type="text"
            autoFocus
            required
            aria-label="Event title"
            placeholder={isEdit ? 'Event title' : 'Lunch with Tom Friday 1pm'}
            value={props.newEventTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full bg-transparent border-0 outline-none text-xl font-medium text-[var(--pulse-ink)] placeholder:text-[var(--pulse-ink-3)] placeholder:font-normal focus:outline-none p-0"
          />

          {/* Parsed confidence chips (Cron-style) */}
          {(parsed.date || parsed.start || parsed.end) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-[var(--pulse-ink-3)]">
                Parsed
              </span>
              {parsed.date && !dismissed.has('date') && (
                <ChipDismissible label={parsed.date.label} onDismiss={() => dismissChip('date')} />
              )}
              {parsed.start && !dismissed.has('start') && (
                <ChipDismissible
                  label={parsed.end ? `${parsed.start.label}–${parsed.end.label}` : parsed.start.label}
                  onDismiss={() => { dismissChip('start'); dismissChip('end'); }}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Scrollable body: 3 sections ──────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {/* WHEN */}
          <Section
            label="When"
            summary={whenSummary}
            expanded={openSections.when}
            onToggle={() => toggle('when')}
          >
            {/* All-day toggle */}
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-[var(--pulse-ink-2)]">
              <input
                type="checkbox"
                checked={props.newEventAllDay}
                onChange={(e) => { props.onAllDayChange(e.target.checked); markDirty(); }}
                className="sr-only peer"
              />
              <span
                className="w-8 h-4 rounded-full bg-[var(--pulse-border-strong)] peer-checked:bg-[var(--pulse-rose)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--pulse-rose-soft)] relative transition-colors duration-200
                  after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:w-3 after:h-3 after:rounded-full after:transition-transform peer-checked:after:translate-x-4"
                aria-hidden="true"
              />
              All day
            </label>

            {/* Date + Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MonoLabel htmlFor="event-date">Date</MonoLabel>
                <input
                  id="event-date"
                  type="date"
                  required
                  value={props.newEventDate}
                  onChange={(e) => { props.onDateChange(e.target.value); markDirty(); }}
                  className={INPUT_BASE}
                />
              </div>
              {!props.newEventAllDay && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <MonoLabel htmlFor="event-start">Start</MonoLabel>
                    <input
                      id="event-start"
                      type="time"
                      step={60}
                      value={props.newEventTime || '09:00'}
                      onChange={(e) => { props.onTimeChange(e.target.value); markDirty(); }}
                      className={INPUT_BASE}
                    />
                  </div>
                  <div>
                    <MonoLabel htmlFor="event-end">End</MonoLabel>
                    <input
                      id="event-end"
                      type="time"
                      step={60}
                      value={props.newEventEndTime || '10:00'}
                      onChange={(e) => { props.onEndTimeChange(e.target.value); markDirty(); }}
                      className={INPUT_BASE}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Recurrence */}
            <div>
              <MonoLabel htmlFor="event-repeat">Repeat</MonoLabel>
              {props.onRruleChange ? (
                <RecurrencePicker
                  value={props.newEventRrule ?? null}
                  onChange={(v) => { props.onRruleChange!(v); markDirty(); }}
                  eventDate={props.newEventDate || new Date().toISOString().split('T')[0]}
                />
              ) : (
                <select
                  id="event-repeat"
                  value={props.newEventRecurrence}
                  onChange={(e) => { props.onRecurrenceChange(e.target.value as RecurrenceType); markDirty(); }}
                  className={INPUT_BASE}
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>

            {/* Reminder */}
            <div>
              <MonoLabel htmlFor="event-reminder">Reminder</MonoLabel>
              <select
                id="event-reminder"
                value={props.newEventReminder}
                onChange={(e) => { props.onReminderChange(e.target.value as ReminderTime); markDirty(); }}
                className={INPUT_BASE}
              >
                <option value="none">No reminder</option>
                <option value="5min">5 minutes before</option>
                <option value="15min">15 minutes before</option>
                <option value="30min">30 minutes before</option>
                <option value="1hour">1 hour before</option>
                <option value="1day">1 day before</option>
              </select>
            </div>
          </Section>

          {/* WHO */}
          <Section
            label="Who"
            summary={whoSummary}
            expanded={openSections.who}
            onToggle={() => toggle('who')}
          >
            {/* Selected attendees */}
            {props.newEventAttendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {props.newEventAttendees.map(id => {
                  const contact = props.contacts.find(c => c.id === id);
                  return contact ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--pulse-surface-raised)] dark:bg-white/[0.04] rounded-full text-xs text-[var(--pulse-ink)]"
                    >
                      <span className={`w-4 h-4 rounded-full ${contact.avatarColor} flex items-center justify-center text-[8px] text-white font-bold`}>
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                      {contact.name}
                      <button
                        type="button"
                        aria-label={`Remove ${contact.name}`}
                        onClick={() => { props.onRemoveAttendee(id); markDirty(); }}
                        className="text-[var(--pulse-ink-3)] hover:text-[var(--pulse-tone-overdue)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] rounded-full"
                      >
                        <X size={10} aria-hidden="true" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* Suggestion chips */}
            {props.contacts.filter(c => !props.newEventAttendees.includes(c.id)).length > 0 && (
              <div>
                <MonoLabel>Add</MonoLabel>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {props.contacts.filter(c => !props.newEventAttendees.includes(c.id)).slice(0, 8).map(contact => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => { props.onAddAttendee(contact.id); markDirty(); }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--pulse-canvas-soft)] dark:bg-white/[0.03] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-white/[0.06] rounded-full text-xs text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition"
                    >
                      <span className={`w-4 h-4 rounded-full ${contact.avatarColor} flex items-center justify-center text-[8px] text-white font-bold`}>
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                      {contact.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Video conferencing */}
            <div>
              <MonoLabel>Video</MonoLabel>
              <VideoLinkSelector
                eventTitle={props.newEventTitle}
                eventDate={props.newEventDate}
              />
            </div>

            {/* Location */}
            <div>
              <MonoLabel htmlFor="event-location">Location</MonoLabel>
              <input
                id="event-location"
                type="text"
                value={props.newEventLocation}
                onChange={(e) => { props.onLocationChange(e.target.value); markDirty(); }}
                placeholder="Address or meeting link"
                className={INPUT_BASE}
              />
            </div>
          </Section>

          {/* WHAT */}
          <Section
            label="What"
            summary={whatSummary}
            expanded={openSections.what}
            onToggle={() => toggle('what')}
          >
            {/* Event type */}
            <div>
              <MonoLabel>Type</MonoLabel>
              <div className="flex flex-wrap gap-1.5">
                {props.allEventTypes.map(type => {
                  const active = props.newEventType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => { props.onTypeChange(type.id as CalendarEvent['type']); markDirty(); }}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] focus-visible:ring-offset-1 ${
                        active ? 'text-[var(--pulse-surface)]' : 'text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)]'
                      }`}
                      style={active
                        ? { backgroundColor: type.color, borderColor: type.color }
                        : { backgroundColor: 'transparent', borderColor: 'var(--pulse-border)' }
                      }
                    >
                      <TypeIcon faClass={type.icon} />
                      {type.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={props.onOpenCustomTypesManager}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dashed border-[var(--pulse-border-strong)] text-[var(--pulse-ink-3)] hover:text-[var(--pulse-ink-2)] hover:border-[var(--pulse-ink-3)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition"
                >
                  <Sliders size={12} aria-hidden="true" />
                  Manage
                </button>
              </div>
            </div>

            {/* Color */}
            <div>
              <MonoLabel>Color</MonoLabel>
              <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Event color">
                {EVENT_COLORS.map(color => {
                  const active = props.newEventColor === color.class;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={color.name}
                      aria-label={color.name}
                      onClick={() => { props.onColorChange(color.class); markDirty(); }}
                      className={`w-7 h-7 rounded-full ${color.class} transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pulse-rose)] ${
                        active
                          ? 'ring-2 ring-offset-2 ring-[var(--pulse-rose)]'
                          : 'ring-2 ring-offset-2 ring-transparent hover:ring-[var(--pulse-border-strong)]'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Status (edit mode only) */}
            {props.onStatusChange && (
              <div>
                <MonoLabel>Status</MonoLabel>
                <div className="flex gap-1.5">
                  {(['confirmed', 'tentative', 'cancelled'] as EventStatus[]).map(s => {
                    const active = (props.newEventStatus ?? 'confirmed') === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { props.onStatusChange!(s); markDirty(); }}
                        aria-pressed={active}
                        className={`rounded-full transition outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--pulse-rose)] ${
                          active ? 'ring-2 ring-offset-1 ring-[var(--pulse-rose)]' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <EventStatusBadge status={s} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <MonoLabel htmlFor="event-desc">Description</MonoLabel>
              <textarea
                id="event-desc"
                value={props.newEventDesc}
                onChange={(e) => { props.onDescChange(e.target.value); markDirty(); }}
                placeholder="Notes, agenda, links"
                className={`${INPUT_BASE} resize-none h-20`}
              />
            </div>
          </Section>
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="border-t border-[var(--pulse-border)] px-5 py-3">
          {draftGuard ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--pulse-ink-2)]">
                Discard draft?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraftGuard(false)}
                  className="font-mono text-[11px] tracking-[0.1em] uppercase font-semibold px-3 py-1.5 rounded-md text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] hover:bg-[var(--pulse-surface-raised)] dark:hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => { setIsDirty(false); setDraftGuard(false); props.onClose(); }}
                  className="font-mono text-[11px] tracking-[0.1em] uppercase font-semibold px-3 py-1.5 rounded-md text-[var(--pulse-tone-overdue)] hover:bg-[var(--pulse-tone-overdue-soft)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-tone-overdue)] transition"
                >
                  Discard
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--pulse-ink-3)] hidden sm:inline">
                <kbd className="font-mono">⌘↵</kbd> to save
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-[var(--pulse-ink-2)] hover:text-[var(--pulse-ink)] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-rose)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!props.newEventTitle.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--pulse-rose)] hover:bg-[var(--pulse-rose-deep)] text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pulse-rose)] transition"
                >
                  {isEdit ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                  {isEdit ? 'Save changes' : 'Create event'}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
});

EventCreationModal.displayName = 'EventCreationModal';

// ─── Dismissible parsed-confidence chip ────────────────────────────────────
const ChipDismissible: React.FC<{ label: string; onDismiss: () => void }> = ({ label, onDismiss }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--pulse-rose-softer)] text-[var(--pulse-rose-text)] font-mono text-[10px] tracking-[0.05em]">
    {label}
    <button
      type="button"
      onClick={onDismiss}
      aria-label={`Dismiss ${label}`}
      className="text-[var(--pulse-rose-text)]/70 hover:text-[var(--pulse-rose-text)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--pulse-rose)] rounded-full"
    >
      <X size={10} aria-hidden="true" />
    </button>
  </span>
);

export default EventCreationModal;

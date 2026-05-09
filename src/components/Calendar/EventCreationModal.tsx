import React from 'react';
import { X, Sliders } from 'lucide-react';
import { CalendarEvent, Contact } from '../../types';
import { RecurrencePicker } from './RecurrencePicker';
import { VideoLinkSelector } from './VideoLinkSelector';
import { EventStatusBadge, EventStatus } from './EventStatusBadge';
import { EVENT_COLORS, RecurrenceType, ReminderTime } from './calendarTypes';

// Shape that mirrors the allEventTypes entries in Calendar.tsx
interface EventTypeOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface EventCreationModalProps {
  // Visibility
  isOpen: boolean;
  editingEvent: CalendarEvent | null;

  // Form field state
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

  // Reference data
  allEventTypes: EventTypeOption[];
  contacts: Contact[];

  // Auto-detect helper (passed as a prop so the modal stays stateless)
  autoDetectEventType: (title: string, desc?: string, location?: string) => string;

  // Actions
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onOpenCustomTypesManager: () => void;
}

export const EventCreationModal = React.memo<EventCreationModalProps>((props) => {
  if (!props.isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4 overflow-y-auto">
      <form
        onSubmit={props.onSubmit}
        className="bg-[var(--pulse-surface)] dark:bg-[var(--pulse-surface)] border border-[var(--pulse-border)] rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in my-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold dark:text-white text-zinc-900">
            {props.editingEvent ? 'Edit Event' : 'New Event'}
          </h3>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={props.onClose}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Event Type Selector */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Event Type</label>
            <div className="flex gap-2 flex-wrap">
              {props.allEventTypes.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => props.onTypeChange(type.id as CalendarEvent['type'])}
                  className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition border"
                  style={
                    props.newEventType === type.id
                      ? { backgroundColor: type.color, color: '#fff', borderColor: type.color }
                      : { backgroundColor: 'transparent', color: type.color, borderColor: type.color + '40' }
                  }
                >
                  <i className={`fa-solid ${type.icon}`}></i> {type.name}
                </button>
              ))}
              {/* Manage custom types button */}
              <button
                type="button"
                onClick={props.onOpenCustomTypesManager}
                className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 hover:text-[var(--pulse-ink-2)] hover:border-zinc-400"
              >
                <Sliders /> Manage
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Title</label>
            <input
              type="text"
              tabIndex={0}
              autoFocus
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Event Title"
              value={props.newEventTitle}
              onChange={(e) => {
                props.onTitleChange(e.target.value);
                // Auto-detect event type from title
                if (e.target.value.length > 3) {
                  const detected = props.autoDetectEventType(e.target.value, props.newEventDesc, props.newEventLocation);
                  props.onTypeChange(detected as CalendarEvent['type']);
                }
              }}
              required
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <label
              className="relative inline-flex items-center cursor-pointer"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  props.onAllDayChange(!props.newEventAllDay);
                }
              }}
            >
              <input
                type="checkbox"
                tabIndex={-1}
                aria-label="All day event"
                checked={props.newEventAllDay}
                onChange={(e) => props.onAllDayChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm text-[var(--pulse-ink-2)]">All Day Event</span>
          </div>

          {/* Date / Time row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Date</label>
              <input
                type="date"
                tabIndex={0}
                aria-label="Event date"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                value={props.newEventDate}
                onChange={(e) => props.onDateChange(e.target.value)}
                required
              />
            </div>
            {!props.newEventAllDay && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Start</label>
                  <input
                    type="time"
                    step="60"
                    tabIndex={0}
                    aria-label="Start time"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={props.newEventTime || '09:00'}
                    onChange={(e) => props.onTimeChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">End</label>
                  <input
                    type="time"
                    step="60"
                    tabIndex={0}
                    aria-label="End time"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={props.newEventEndTime || '10:00'}
                    onChange={(e) => props.onEndTimeChange(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Location</label>
            <input
              type="text"
              tabIndex={0}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Add location or meeting link"
              value={props.newEventLocation}
              onChange={(e) => props.onLocationChange(e.target.value)}
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Event color">
              {EVENT_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  tabIndex={0}
                  onClick={() => props.onColorChange(color.class)}
                  className={`w-8 h-8 rounded-full ${color.class} transition ring-2 ring-offset-2 focus:ring-blue-500 focus:outline-none ${props.newEventColor === color.class ? 'ring-blue-500' : 'ring-transparent hover:ring-zinc-300'}`}
                  title={color.name}
                  aria-label={color.name}
                />
              ))}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Repeat</label>
            {props.onRruleChange ? (
              <RecurrencePicker
                value={props.newEventRrule ?? null}
                onChange={props.onRruleChange}
                eventDate={props.newEventDate || new Date().toISOString().split('T')[0]}
              />
            ) : (
              <select
                tabIndex={0}
                aria-label="Repeat frequency"
                value={props.newEventRecurrence}
                onChange={(e) => props.onRecurrenceChange(e.target.value as RecurrenceType)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-rose-500 outline-none transition"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>

          {/* Video conferencing */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Video conferencing</label>
            <VideoLinkSelector
              eventTitle={props.newEventTitle}
              eventDate={props.newEventDate}
            />
          </div>

          {/* Reminder */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Reminder</label>
            <select
              tabIndex={0}
              aria-label="Reminder time"
              value={props.newEventReminder}
              onChange={(e) => props.onReminderChange(e.target.value as ReminderTime)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
            >
              <option value="none">No reminder</option>
              <option value="5min">5 minutes before</option>
              <option value="15min">15 minutes before</option>
              <option value="30min">30 minutes before</option>
              <option value="1hour">1 hour before</option>
              <option value="1day">1 day before</option>
            </select>
          </div>

          {/* Event Status */}
          {props.onStatusChange && (
            <div>
              <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Status</label>
              <div className="flex gap-2">
                {(['confirmed', 'tentative', 'cancelled'] as EventStatus[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => props.onStatusChange!(s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      (props.newEventStatus ?? 'confirmed') === s
                        ? 'border-transparent ring-2 ring-rose-500'
                        : 'border-[var(--pulse-border-strong)] hover:border-rose-300 dark:hover:border-rose-700'
                    }`}
                  >
                    <EventStatusBadge status={s} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attendees */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Attendees</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {props.newEventAttendees.map(id => {
                const contact = props.contacts.find(c => c.id === id);
                return contact ? (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--pulse-surface-raised)] dark:bg-[var(--pulse-surface-raised)] rounded-full text-xs">
                    <span className={`w-4 h-4 rounded-full ${contact.avatarColor} flex items-center justify-center text-[8px] text-white font-bold`}>
                      {contact.name.charAt(0)}
                    </span>
                    {contact.name}
                    <button type="button" aria-label={`Remove ${contact.name}`} title={`Remove ${contact.name}`} onClick={() => props.onRemoveAttendee(id)} className="ml-1 text-zinc-400 hover:text-red-500">
                      <X className="text-[10px]" aria-hidden="true" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {props.contacts.filter(c => !props.newEventAttendees.includes(c.id)).slice(0, 6).map(contact => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => props.onAddAttendee(contact.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 transition whitespace-nowrap"
                >
                  <span className={`w-5 h-5 rounded-full ${contact.avatarColor} flex items-center justify-center text-[10px] text-white font-bold`}>
                    {contact.name.charAt(0)}
                  </span>
                  {contact.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Description</label>
            <textarea
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-[var(--pulse-border)] rounded-lg p-3 dark:text-white text-zinc-900 focus:border-zinc-400 outline-none resize-none h-20"
              placeholder="Add description or notes..."
              value={props.newEventDesc}
              onChange={(e) => props.onDescChange(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={props.onClose}
            className="px-5 py-2 text-zinc-500 hover:text-[var(--pulse-ink)] transition text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:opacity-90 transition flex items-center gap-2"
          >
            <i className={`fa-solid ${props.editingEvent ? 'fa-check' : 'fa-plus'}`}></i>
            {props.editingEvent ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
});

EventCreationModal.displayName = 'EventCreationModal';

export default EventCreationModal;

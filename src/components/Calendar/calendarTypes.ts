// Shared types and constants for Calendar components

export type ViewMode = 'today' | 'month' | 'week' | 'day' | 'year' | 'agenda' | 'timeline';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderTime = 'none' | '5min' | '15min' | '30min' | '1hour' | '1day';

export const EVENT_COLORS = [
  { id: 'zinc', name: 'Default', class: 'bg-zinc-800 dark:bg-zinc-700' },
  { id: 'blue', name: 'Blue', class: 'bg-blue-600' },
  { id: 'green', name: 'Green', class: 'bg-emerald-600' },
  { id: 'red', name: 'Red', class: 'bg-red-600' },
  { id: 'purple', name: 'Purple', class: 'bg-purple-600' },
  { id: 'amber', name: 'Amber', class: 'bg-amber-600' },
  { id: 'pink', name: 'Pink', class: 'bg-pink-600' },
  { id: 'indigo', name: 'Indigo', class: 'bg-indigo-600' },
];

export const EVENT_TYPES = [
  { id: 'event',    name: 'Event',      icon: 'fa-calendar',       color: '#6b7280' },
  { id: 'meet',     name: 'Meeting',    icon: 'fa-video',          color: '#3b82f6' },
  { id: 'call',     name: 'Call',       icon: 'fa-phone',          color: '#10b981' },
  { id: 'focus',    name: 'Focus Time', icon: 'fa-brain',          color: '#8b5cf6' },
  { id: 'personal', name: 'Personal',   icon: 'fa-user',           color: '#f59e0b' },
  { id: 'deadline', name: 'Deadline',   icon: 'fa-flag',           color: '#ef4444' },
  { id: 'travel',   name: 'Travel',     icon: 'fa-plane',          color: '#06b6d4' },
  { id: 'social',   name: 'Social',     icon: 'fa-users',          color: '#ec4899' },
  { id: 'health',   name: 'Health',     icon: 'fa-heart-pulse',    color: '#f97316' },
  { id: 'reminder', name: 'Reminder',   icon: 'fa-bell',           color: '#a3a3a3' },
];

export const TIME_ZONES = [
  { id: 'local', name: 'Local Time', offset: '' },
  { id: 'utc',   name: 'UTC',            offset: '+0:00' },
  { id: 'est',   name: 'Eastern',        offset: '-5:00' },
  { id: 'pst',   name: 'Pacific',        offset: '-8:00' },
  { id: 'gmt',   name: 'London',         offset: '+0:00' },
  { id: 'cet',   name: 'Central Europe', offset: '+1:00' },
  { id: 'ist',   name: 'India',          offset: '+5:30' },
  { id: 'jst',   name: 'Japan',          offset: '+9:00' },
];

export interface Team {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

export const autoDetectEventType = (title: string, description?: string, location?: string): string => {
  const text = `${title} ${description || ''} ${location || ''}`.toLowerCase();
  if (/zoom|google meet|teams|webex|whereby|facetime|skype|video call|video meeting/.test(text)) return 'meet';
  if (/standup|sync|1:1|one.on.one|check.in|review|retro|sprint|scrum|board meeting|all.hands/.test(text)) return 'meet';
  if (/call|phone|dial/.test(text) && !/recall|callback/.test(text)) return 'call';
  if (/focus|deep work|heads.down|no.interrupt|coding|writing|study|research|prep/.test(text)) return 'focus';
  if (/flight|airport|hotel|commute|drive to|travel|trip|vacation|conf(?:erence)?\s+trip/.test(text)) return 'travel';
  if (/deadline|due|submit|launch|release|ship|milestone/.test(text)) return 'deadline';
  if (/doctor|dentist|therapy|gym|workout|exercise|yoga|run|physio|appointment|checkup/.test(text)) return 'health';
  if (/lunch|dinner|breakfast|coffee|happy hour|party|birthday|wedding|social|outing/.test(text)) return 'social';
  if (/personal|family|kids?|school|errand|grocery|haircut|car/.test(text)) return 'personal';
  return 'event';
};

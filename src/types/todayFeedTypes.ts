// ============================================
// TODAY FEED TYPES
// Types for the Contacts "Today" daily briefing feed
// ============================================

export type TodayFeedItemType =
  | 'follow_up'
  | 'birthday'
  | 'cooling'
  | 'meeting_prep'
  | 'hot_lead'
  | 'awaiting_response'
  | 'vip_alert'
  | 'reconnect'
  | 'introduction'
  | 'geofence_arrival'
  | 'geofence_approach'
  | 'geofence_exit'
  | 'custom';

export type TodayFeedSuggestedAction =
  | 'message'
  | 'vox'
  | 'call'
  | 'meeting'
  | 'email'
  | 'review';

export type TodayFeedItemStatus =
  | 'active'
  | 'snoozed'
  | 'completed'
  | 'dismissed';

export interface TodayFeedItem {
  id: string;
  userId: string;
  contactId: string;
  contactName: string;
  contactAvatarColor?: string;
  relationshipScore?: number;
  itemType: TodayFeedItemType;
  priority: number; // 1 = highest
  title: string;
  subtitle: string;
  aiDraftMessage?: string;
  suggestedAction: TodayFeedSuggestedAction;
  suggestedChannel?: string;
  expiresAt?: string;
  status: TodayFeedItemStatus;
  snoozedUntil?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ==================== CONFIG MAPS ====================

export interface FeedItemTypeConfig {
  icon: string;       // emoji or FA class
  label: string;
  colorClass: string; // Tailwind border/bg accent color
}

export const FEED_ITEM_TYPE_CONFIG: Record<TodayFeedItemType, FeedItemTypeConfig> = {
  hot_lead:          { icon: '🔥', label: 'Hot Lead',         colorClass: 'border-orange-400 dark:border-orange-500' },
  follow_up:         { icon: '⏰', label: 'Follow-up Due',    colorClass: 'border-amber-400 dark:border-amber-500' },
  birthday:          { icon: '🎂', label: 'Birthday',         colorClass: 'border-pink-400 dark:border-pink-500' },
  cooling:           { icon: '❄️', label: 'Relationship Cooling', colorClass: 'border-blue-400 dark:border-blue-500' },
  meeting_prep:      { icon: '📅', label: 'Meeting Prep',     colorClass: 'border-indigo-400 dark:border-indigo-500' },
  awaiting_response: { icon: '📧', label: 'Awaiting Response', colorClass: 'border-zinc-400 dark:border-zinc-500' },
  vip_alert:         { icon: '⭐', label: 'VIP Alert',        colorClass: 'border-yellow-400 dark:border-yellow-500' },
  reconnect:         { icon: '🔄', label: 'Reconnect',        colorClass: 'border-purple-400 dark:border-purple-500' },
  introduction:      { icon: '🤝', label: 'Introduction',     colorClass: 'border-emerald-400 dark:border-emerald-500' },
  geofence_arrival:  { icon: '📍', label: 'Arrived',           colorClass: 'border-rose-400 dark:border-rose-500' },
  geofence_approach: { icon: '🧭', label: 'Approaching',       colorClass: 'border-rose-300 dark:border-rose-400' },
  geofence_exit:     { icon: '🚪', label: 'Left',              colorClass: 'border-zinc-400 dark:border-zinc-500' },
  custom:            { icon: '💡', label: 'Action',           colorClass: 'border-zinc-400 dark:border-zinc-500' },
};

export const SUGGESTED_ACTION_LABEL: Record<TodayFeedSuggestedAction, string> = {
  message: 'Send Message',
  vox:     'Send Vox',
  call:    'Call',
  meeting: 'Schedule',
  email:   'Email',
  review:  'Review',
};

export const SUGGESTED_ACTION_ICON: Record<TodayFeedSuggestedAction, string> = {
  message: 'fa-solid fa-message',
  vox:     'fa-solid fa-microphone',
  call:    'fa-solid fa-phone',
  meeting: 'fa-solid fa-calendar-plus',
  email:   'fa-solid fa-envelope',
  review:  'fa-solid fa-eye',
};

// Snooze duration options
export interface SnoozeDuration {
  label: string;
  minutes: number;
}

export const SNOOZE_DURATIONS: SnoozeDuration[] = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour',     minutes: 60 },
  { label: 'Tomorrow',   minutes: 60 * 24 },
  { label: 'Next week',  minutes: 60 * 24 * 7 },
];

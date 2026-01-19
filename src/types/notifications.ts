/**
 * Pulse Notification System Types
 * Comprehensive notification types for push notifications, in-app alerts, and sound management
 */

// Notification categories for routing and filtering
export type NotificationCategory =
  | 'message'      // Direct messages, channel messages, mentions
  | 'email'        // New emails, important emails, follow-ups
  | 'task'         // Task assignments, due dates, status changes
  | 'calendar'     // Event reminders, meeting invites, schedule changes
  | 'ai'           // War Room AI responses, processing complete
  | 'voice'        // Voice messages, transcription complete
  | 'decision'     // Decision votes, approvals, rejections
  | 'crm'          // Deal updates, contact changes
  | 'system';      // App updates, sync status, errors

// Priority levels affect notification behavior
export type NotificationPriority = 'urgent' | 'high' | 'medium' | 'low';

// Notification source platforms
export type NotificationSource =
  | 'pulse'
  | 'slack'
  | 'email'
  | 'sms'
  | 'calendar'
  | 'discord'
  | 'teams'
  | 'system';

// Core notification interface
export interface PulseNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  source: NotificationSource;

  // Content
  title: string;
  body: string;
  icon?: string;
  image?: string;

  // Metadata
  timestamp: Date;
  read: boolean;
  dismissed: boolean;

  // Actions
  actionUrl?: string;           // URL to navigate to on click
  actions?: NotificationAction[];

  // Grouping
  groupId?: string;             // For batching related notifications
  threadId?: string;            // For conversation threading

  // Sender info
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;

  // Additional data for specific notification types
  data?: Record<string, unknown>;
}

// Notification action buttons
export interface NotificationAction {
  id: string;
  label: string;
  icon?: string;
  action: 'reply' | 'archive' | 'snooze' | 'mark_read' | 'custom';
  customHandler?: string;       // Function name for custom handlers
}

// Notification preferences per category
export interface CategoryPreferences {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  mobile: boolean;
  email: boolean;
  priority: NotificationPriority; // Minimum priority to notify
}

// User notification preferences
export interface NotificationPreferences {
  // Master controls
  enabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  mobileEnabled: boolean;
  emailDigestEnabled: boolean;

  // Sound settings
  soundVolume: number;          // 0-1
  customSoundUrl?: string;      // Custom notification sound

  // Quiet hours / Do Not Disturb
  quietHoursEnabled: boolean;
  quietHoursStart: string;      // HH:MM format
  quietHoursEnd: string;        // HH:MM format
  quietHoursWeekends: boolean;  // Auto-enable on weekends

  // Batching
  batchLowPriority: boolean;
  batchInterval: number;        // Minutes between batch digests

  // VIP contacts (always notify regardless of settings)
  vipContacts: string[];

  // Per-category preferences
  categories: Record<NotificationCategory, CategoryPreferences>;
}

// Default category preferences
export const DEFAULT_CATEGORY_PREFERENCES: CategoryPreferences = {
  enabled: true,
  sound: true,
  desktop: true,
  mobile: true,
  email: false,
  priority: 'medium',
};

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  soundEnabled: true,
  desktopEnabled: true,
  mobileEnabled: true,
  emailDigestEnabled: false,

  soundVolume: 0.7,

  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursWeekends: true,

  batchLowPriority: true,
  batchInterval: 30,

  vipContacts: [],

  categories: {
    message: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'medium' },
    email: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'medium' },
    task: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'high' },
    calendar: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'high' },
    ai: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'low', desktop: false },
    voice: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'high' },
    decision: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'high' },
    crm: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'medium', desktop: false },
    system: { ...DEFAULT_CATEGORY_PREFERENCES, priority: 'low', sound: false },
  },
};

// Notification store state
export interface NotificationState {
  notifications: PulseNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  permissionStatus: NotificationPermission;
  isSupported: boolean;
  serviceWorkerReady: boolean;
  batchedNotifications: PulseNotification[];
}

// Batched notification group
export interface NotificationBatch {
  id: string;
  category: NotificationCategory;
  count: number;
  notifications: PulseNotification[];
  summary: string;
  timestamp: Date;
}

// Push subscription for backend
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Notification event for analytics
export interface NotificationEvent {
  notificationId: string;
  event: 'displayed' | 'clicked' | 'dismissed' | 'action_clicked';
  actionId?: string;
  timestamp: Date;
}

// Sound types for different notification categories
export const NOTIFICATION_SOUNDS: Record<NotificationCategory, string> = {
  message: '/sounds/pulse-message.mp3',
  email: '/sounds/pulse-email.mp3',
  task: '/sounds/pulse-task.mp3',
  calendar: '/sounds/pulse-calendar.mp3',
  ai: '/sounds/pulse-ai.mp3',
  voice: '/sounds/pulse-voice.mp3',
  decision: '/sounds/pulse-decision.mp3',
  crm: '/sounds/pulse-crm.mp3',
  system: '/sounds/pulse-system.mp3',
};

// Default Pulse notification sound (digital heartbeat)
export const DEFAULT_NOTIFICATION_SOUND = '/sounds/pulse-notification.mp3';

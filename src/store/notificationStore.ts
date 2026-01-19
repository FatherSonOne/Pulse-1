/**
 * Pulse Notification Store
 * Zustand store for managing notification state across the application
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  PulseNotification,
  NotificationPreferences,
  NotificationCategory,
  NotificationBatch,
  DEFAULT_NOTIFICATION_PREFERENCES,
  CategoryPreferences,
} from '../types/notifications';
import { notificationService } from '../services/notificationService';
import { settingsService } from '../services/settingsService';

const batchTimers = new Map<NotificationCategory, ReturnType<typeof setTimeout>>();

interface NotificationStore {
  // State
  notifications: PulseNotification[];
  preferences: NotificationPreferences;
  permissionStatus: NotificationPermission;
  isSupported: boolean;
  isInitialized: boolean;
  showNotificationCenter: boolean;
  batchedNotifications: Map<NotificationCategory, PulseNotification[]>;

  // Computed
  unreadCount: number;
  hasUnread: boolean;

  // Actions - Initialization
  initialize: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;

  // Actions - Notifications
  addNotification: (notification: Partial<PulseNotification> & { title: string; body: string }) => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;

  // Actions - UI
  toggleNotificationCenter: () => void;
  setShowNotificationCenter: (show: boolean) => void;

  // Actions - Preferences
  updatePreferences: (updates: Partial<NotificationPreferences>) => void;
  updateCategoryPreferences: (category: NotificationCategory, updates: Partial<CategoryPreferences>) => void;
  addVipContact: (contactId: string) => void;
  removeVipContact: (contactId: string) => void;
  setQuietHours: (enabled: boolean, start?: string, end?: string) => void;

  // Actions - Sound
  testSound: (category?: NotificationCategory) => Promise<void>;
  setSoundVolume: (volume: number) => void;

  // Actions - Batching
  processBatch: (category: NotificationCategory) => NotificationBatch | null;

  // Helpers for specific notification types
  notifyMessage: (options: {
    senderName: string;
    senderAvatar?: string;
    message: string;
    channelName?: string;
    threadId?: string;
    actionUrl?: string;
  }) => Promise<void>;

  notifyEmail: (options: {
    senderName: string;
    senderEmail: string;
    subject: string;
    preview: string;
    isImportant?: boolean;
    actionUrl?: string;
  }) => Promise<void>;

  notifyTask: (options: {
    type: 'assigned' | 'due_soon' | 'overdue' | 'completed' | 'updated';
    taskTitle: string;
    assigneeName?: string;
    dueDate?: Date;
    actionUrl?: string;
  }) => Promise<void>;

  notifyCalendar: (options: {
    type: 'reminder' | 'invite' | 'updated' | 'cancelled';
    eventTitle: string;
    startTime: Date;
    location?: string;
    organizerName?: string;
    actionUrl?: string;
  }) => Promise<void>;

  notifyAI: (options: {
    type: 'response_ready' | 'processing' | 'error';
    message: string;
    actionUrl?: string;
  }) => Promise<void>;

  notifyVoice: (options: {
    senderName: string;
    duration: number;
    transcription?: string;
    actionUrl?: string;
  }) => Promise<void>;

  notifyDecision: (options: {
    type: 'new_vote' | 'vote_complete' | 'approved' | 'rejected';
    decisionTitle: string;
    voterName?: string;
    actionUrl?: string;
  }) => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      notifications: [],
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      permissionStatus: 'default' as NotificationPermission,
      isSupported: false,
      isInitialized: false,
      showNotificationCenter: false,
      batchedNotifications: new Map(),

      // Computed getters
      get unreadCount() {
        return get().notifications.filter((n) => !n.read && !n.dismissed).length;
      },
      get hasUnread() {
        return get().unreadCount > 0;
      },

      // Initialize the notification system
      initialize: async () => {
        await notificationService.initialize();

        const isSupported = notificationService.isNotificationSupported();
        const permissionStatus = notificationService.getPermissionStatus();
        const storedNotifications = notificationService.getStoredNotifications();
        const preferences = notificationService.getPreferences();

        // Subscribe to new notifications
        notificationService.subscribe((notification) => {
          set((state) => ({
            notifications: [notification, ...state.notifications].slice(0, 100)
          }));
        });

        set({
          isSupported,
          permissionStatus,
          notifications: storedNotifications,
          preferences,
          isInitialized: true,
        });
      },

      // Request notification permission
      requestPermission: async () => {
        const permission = await notificationService.requestPermission();
        set({ permissionStatus: permission });
        return permission;
      },

      // Add a new notification
      addNotification: async (options) => {
        await notificationService.notify(options);
        // Notification will be added via subscription
      },

      // Mark notification as read
      markAsRead: (id) => {
        notificationService.markAsRead(id);
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
        }));
      },

      // Mark all as read
      markAllAsRead: () => {
        notificationService.markAllAsRead();
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true }))
        }));
      },

      // Dismiss notification
      dismissNotification: (id) => {
        notificationService.dismissNotification(id);
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, dismissed: true } : n
          )
        }));
      },

      // Clear all notifications
      clearAll: () => {
        notificationService.clearAllNotifications();
        set({ notifications: [] });
      },

      // Toggle notification center visibility
      toggleNotificationCenter: () => {
        set((state) => ({ showNotificationCenter: !state.showNotificationCenter }));
      },

      // Set notification center visibility
      setShowNotificationCenter: (show) => {
        set({ showNotificationCenter: show });
      },

      // Update preferences
      updatePreferences: (updates) => {
        const updated = notificationService.updatePreferences(updates);
        set({ preferences: updated });
      },

      // Update category preferences
      updateCategoryPreferences: (category, updates) => {
        set((state) => {
          const newPreferences = {
            ...state.preferences,
            categories: {
              ...state.preferences.categories,
              [category]: {
                ...state.preferences.categories[category],
                ...updates,
              },
            },
          };
          notificationService.updatePreferences(newPreferences);
          return { preferences: newPreferences };
        });
      },

      // Add VIP contact
      addVipContact: (contactId) => {
        set((state) => {
          if (state.preferences.vipContacts.includes(contactId)) {
            return state;
          }
          const newPreferences = {
            ...state.preferences,
            vipContacts: [...state.preferences.vipContacts, contactId],
          };
          notificationService.updatePreferences(newPreferences);
          return { preferences: newPreferences };
        });
      },

      // Remove VIP contact
      removeVipContact: (contactId) => {
        set((state) => {
          const newPreferences = {
            ...state.preferences,
            vipContacts: state.preferences.vipContacts.filter((id) => id !== contactId),
          };
          notificationService.updatePreferences(newPreferences);
          return { preferences: newPreferences };
        });
      },

      // Set quiet hours
      setQuietHours: (enabled, start, end) => {
        set((state) => {
          const newPreferences = {
            ...state.preferences,
            quietHoursEnabled: enabled,
            ...(start && { quietHoursStart: start }),
            ...(end && { quietHoursEnd: end }),
          };
          notificationService.updatePreferences(newPreferences);
          return { preferences: newPreferences };
        });
      },

      // Test notification sound
      testSound: async (category) => {
        const { preferences } = get();
        await notificationService.playSound(
          category || 'system',
          preferences.soundVolume
        );
      },

      // Set sound volume
      setSoundVolume: (volume) => {
        set((state) => {
          const newPreferences = {
            ...state.preferences,
            soundVolume: Math.max(0, Math.min(1, volume)),
          };
          notificationService.updatePreferences(newPreferences);
          return { preferences: newPreferences };
        });
      },

      // Process batched notifications
      processBatch: (category) => {
        const { batchedNotifications } = get();
        const batch = batchedNotifications.get(category);

        if (!batch || batch.length === 0) return null;

        const notificationBatch = notificationService.createBatch(batch);

        set((state) => {
          const newBatched = new Map(state.batchedNotifications);
          newBatched.delete(category);
          return { batchedNotifications: newBatched };
        });

        return notificationBatch;
      },

      // Helper: Notify for message
      notifyMessage: async (options) => {
        await notificationService.notifyNewMessage(options);
      },

      // Helper: Notify for email
      notifyEmail: async (options) => {
        const bundlingEnabled = await settingsService.get('emailNotificationBundling');
        const isImportant = options.isImportant === true;

        if (bundlingEnabled && !isImportant) {
          set((state) => {
            const updated = new Map(state.batchedNotifications);
            const existing = updated.get('email') || [];
            updated.set('email', [
              ...existing,
              {
                id: crypto.randomUUID(),
                category: 'email',
                priority: 'low',
                source: 'email',
                title: `Email from ${options.senderName}`,
                body: `${options.subject} - ${options.preview}`,
                timestamp: new Date(),
                read: false,
                dismissed: false,
              },
            ]);
            return { batchedNotifications: updated };
          });

          const { preferences } = get();
          if (!batchTimers.has('email')) {
            const timer = setTimeout(async () => {
              const batch = get().processBatch('email');
              if (batch) {
                await notificationService.notify({
                  title: 'Email Digest',
                  body: batch.summary,
                  category: 'email',
                  priority: 'low',
                  source: 'email',
                });
              }
              batchTimers.delete('email');
            }, Math.max(preferences.batchInterval, 1) * 60 * 1000);
            batchTimers.set('email', timer);
          }
          return;
        }

        await notificationService.notifyNewEmail(options);
      },

      // Helper: Notify for task
      notifyTask: async (options) => {
        await notificationService.notifyTaskEvent(options);
      },

      // Helper: Notify for calendar
      notifyCalendar: async (options) => {
        await notificationService.notifyCalendarEvent(options);
      },

      // Helper: Notify for AI
      notifyAI: async (options) => {
        await notificationService.notifyAIEvent(options);
      },

      // Helper: Notify for voice
      notifyVoice: async (options) => {
        await notificationService.notifyVoiceMessage(options);
      },

      // Helper: Notify for decision
      notifyDecision: async (options) => {
        await notificationService.notifyDecisionEvent(options);
      },
    }),
    {
      name: 'pulse-notifications',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        // Don't persist notifications - they're in notificationService
      }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useUnreadCount = () => useNotificationStore((state) =>
  state.notifications.filter((n) => !n.read && !n.dismissed).length
);

export const useNotifications = () => useNotificationStore((state) => state.notifications);

export const useNotificationPreferences = () => useNotificationStore((state) => state.preferences);

export const useNotificationPermission = () => useNotificationStore((state) => state.permissionStatus);

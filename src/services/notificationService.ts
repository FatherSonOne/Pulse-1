/**
 * Pulse Notification Service
 * Handles Web Push API, desktop notifications, sound playback, and notification management
 */

import {
  PulseNotification,
  NotificationPreferences,
  NotificationCategory,
  NotificationPriority,
  NotificationSource,
  NotificationBatch,
  NotificationEvent,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_NOTIFICATION_SOUND,
  NOTIFICATION_SOUNDS,
} from '../types/notifications';
import { playNotificationSound, playPulseHeartbeat } from '../utils/soundGenerator';

// Storage keys
const STORAGE_KEYS = {
  PREFERENCES: 'pulse_notification_preferences',
  NOTIFICATIONS: 'pulse_notifications',
  SUBSCRIPTION: 'pulse_push_subscription',
};

class NotificationService {
  private audioContext: AudioContext | null = null;
  private audioCache: Map<string, AudioBuffer> = new Map();
  private notificationSound: HTMLAudioElement | null = null;
  private isSupported: boolean = false;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private subscribers: Set<(notification: PulseNotification) => void> = new Set();

  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.initAudio();
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    if (!this.isSupported) {
      console.warn('Notifications are not supported in this browser');
      return;
    }

    // Initialize audio
    this.initAudio();

    // Register service worker for push notifications
    await this.registerServiceWorker();

    // Preload notification sounds
    await this.preloadSounds();

    console.log('Notification service initialized');
  }

  /**
   * Initialize Web Audio API for notification sounds
   */
  private initAudio(): void {
    try {
      // Create audio element for notification sound
      this.notificationSound = new Audio();
      this.notificationSound.volume = 0.7;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  /**
   * Preload notification sounds for instant playback
   */
  private async preloadSounds(): Promise<void> {
    try {
      // Preload the default notification sound with timeout
      const defaultSound = new Audio(DEFAULT_NOTIFICATION_SOUND);
      defaultSound.preload = 'auto';
      await Promise.race([
        new Promise((resolve) => {
          defaultSound.oncanplaythrough = resolve;
          defaultSound.onerror = resolve; // Continue even if sound fails to load
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)) // 3s timeout
      ]);
    } catch (error) {
      console.warn('Failed to preload notification sounds:', error);
    }
  }

  /**
   * Register service worker for push notifications
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      // First, try to register the service worker if not already registered
      let registration: ServiceWorkerRegistration | undefined;

      // Check if already registered
      const existingRegistration = await navigator.serviceWorker.getRegistration('/');

      if (existingRegistration) {
        registration = existingRegistration;
      } else {
        // Only register in production (service worker may not exist in dev)
        if (import.meta.env.PROD) {
          try {
            registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          } catch (regError) {
            console.warn('Service worker registration failed:', regError);
          }
        }
      }

      if (registration) {
        this.serviceWorkerRegistration = registration;
        console.log('Service worker ready for notifications');
      } else {
        console.log('Service worker not available (dev mode or registration failed)');
      }
    } catch (error) {
      console.warn('Service worker registration skipped:', error);
      // Continue without service worker - notifications will still work locally
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported) return 'denied';
    return Notification.permission;
  }

  /**
   * Check if notifications are supported
   */
  isNotificationSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.serviceWorkerRegistration) {
      console.error('Service worker not registered');
      return null;
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      // Store subscription
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTION, JSON.stringify(subscription));

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Create and display a notification
   */
  async notify(
    options: Partial<PulseNotification> & { title: string; body: string }
  ): Promise<PulseNotification> {
    const preferences = this.getPreferences();

    const notification: PulseNotification = {
      id: crypto.randomUUID(),
      category: options.category || 'system',
      priority: options.priority || 'medium',
      source: options.source || 'pulse',
      title: options.title,
      body: options.body,
      icon: options.icon,
      image: options.image,
      timestamp: new Date(),
      read: false,
      dismissed: false,
      actionUrl: options.actionUrl,
      actions: options.actions,
      groupId: options.groupId,
      threadId: options.threadId,
      senderId: options.senderId,
      senderName: options.senderName,
      senderAvatar: options.senderAvatar,
      data: options.data,
    };

    // Check if notifications are enabled
    if (!this.shouldNotify(notification, preferences)) {
      // Store notification but don't display
      this.storeNotification(notification);
      return notification;
    }

    // Play notification sound
    if (preferences.soundEnabled && preferences.categories[notification.category]?.sound) {
      await this.playSound(notification.category, preferences.soundVolume);
    }

    // Show desktop notification
    if (preferences.desktopEnabled && preferences.categories[notification.category]?.desktop) {
      await this.showDesktopNotification(notification);
    }

    // Store notification
    this.storeNotification(notification);

    // Notify subscribers
    this.notifySubscribers(notification);

    return notification;
  }

  /**
   * Check if notification should be displayed based on preferences
   */
  private shouldNotify(
    notification: PulseNotification,
    preferences: NotificationPreferences
  ): boolean {
    // Master enable check
    if (!preferences.enabled) return false;

    // Category check
    const categoryPrefs = preferences.categories[notification.category];
    if (!categoryPrefs?.enabled) return false;

    // Priority check
    const priorityOrder: NotificationPriority[] = ['low', 'medium', 'high', 'urgent'];
    const minPriority = priorityOrder.indexOf(categoryPrefs.priority);
    const notifPriority = priorityOrder.indexOf(notification.priority);
    if (notifPriority < minPriority) return false;

    // VIP check (always notify for VIP contacts)
    if (notification.senderId && preferences.vipContacts.includes(notification.senderId)) {
      return true;
    }

    // Quiet hours check
    if (preferences.quietHoursEnabled && this.isQuietHours(preferences)) {
      // Only allow urgent notifications during quiet hours
      return notification.priority === 'urgent';
    }

    return true;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(preferences: NotificationPreferences): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Check weekend override
    if (preferences.quietHoursWeekends) {
      const day = now.getDay();
      if (day === 0 || day === 6) return true;
    }

    // Handle overnight quiet hours
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }

    return currentTime >= startTime && currentTime < endTime;
  }

  /**
   * Play notification sound using Web Audio API
   */
  async playSound(category: NotificationCategory, volume: number = 0.7): Promise<void> {
    try {
      // Use the Web Audio API sound generator for instant, reliable sounds
      playNotificationSound(category, volume);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
      // Fallback to audio file if Web Audio fails
      try {
        const soundUrl = NOTIFICATION_SOUNDS[category] || DEFAULT_NOTIFICATION_SOUND;
        const audio = new Audio(soundUrl);
        audio.volume = Math.max(0, Math.min(1, volume));
        await audio.play();
      } catch (fallbackError) {
        console.warn('Fallback sound also failed:', fallbackError);
      }
    }
  }

  /**
   * Play the default Pulse notification sound (digital heartbeat)
   */
  async playDefaultSound(volume: number = 0.7): Promise<void> {
    try {
      playPulseHeartbeat(volume);
    } catch (error) {
      console.warn('Failed to play default sound:', error);
    }
  }

  /**
   * Show desktop notification using Web Notification API
   */
  private async showDesktopNotification(notification: PulseNotification): Promise<void> {
    if (Notification.permission !== 'granted') return;

    try {
      // Extended options for service worker notifications
      // Using Record type to allow extended notification properties
      const options: Record<string, unknown> = {
        body: notification.body,
        icon: notification.icon || '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        tag: notification.groupId || notification.id,
        renotify: true,
        silent: true, // We handle sound ourselves
        data: {
          id: notification.id,
          actionUrl: notification.actionUrl,
        },
      };

      // Add image if present
      if (notification.image) {
        options.image = notification.image;
      }

      // Add actions if supported (for service worker notifications)
      if (notification.actions) {
        options.actions = notification.actions.map((action) => ({
          action: action.id,
          title: action.label,
          icon: action.icon,
        }));
      }

      // Use service worker for persistent notifications if available
      if (this.serviceWorkerRegistration) {
        await this.serviceWorkerRegistration.showNotification(
          notification.title,
          options as NotificationOptions
        );
      } else {
        // Fallback to regular notification (without extended properties)
        const basicOptions: NotificationOptions = {
          body: notification.body,
          icon: notification.icon || '/icons/icon-192.svg',
          tag: notification.groupId || notification.id,
          silent: true,
          data: {
            id: notification.id,
            actionUrl: notification.actionUrl,
          },
        };

        const desktopNotif = new Notification(notification.title, basicOptions);

        desktopNotif.onclick = () => {
          window.focus();
          if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
          }
          desktopNotif.close();
        };
      }
    } catch (error) {
      console.error('Failed to show desktop notification:', error);
    }
  }

  /**
   * Store notification in local storage
   */
  private storeNotification(notification: PulseNotification): void {
    const notifications = this.getStoredNotifications();
    notifications.unshift(notification);

    // Keep only last 100 notifications
    const trimmed = notifications.slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(trimmed));
  }

  /**
   * Get stored notifications
   */
  getStoredNotifications(): PulseNotification[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (!stored) return [];

      const notifications = JSON.parse(stored) as PulseNotification[];
      // Convert date strings back to Date objects
      return notifications.map((n) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      }));
    } catch (error) {
      console.error('Failed to get stored notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notifications = this.getStoredNotifications();
    const index = notifications.findIndex((n) => n.id === notificationId);

    if (index !== -1) {
      notifications[index].read = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    const notifications = this.getStoredNotifications();
    const updated = notifications.map((n) => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
  }

  /**
   * Dismiss notification
   */
  dismissNotification(notificationId: string): void {
    const notifications = this.getStoredNotifications();
    const index = notifications.findIndex((n) => n.id === notificationId);

    if (index !== -1) {
      notifications[index].dismissed = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    }
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(): number {
    const notifications = this.getStoredNotifications();
    return notifications.filter((n) => !n.read && !n.dismissed).length;
  }

  /**
   * Get notification preferences
   */
  getPreferences(): NotificationPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (!stored) return DEFAULT_NOTIFICATION_PREFERENCES;

      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) };
    } catch (error) {
      console.error('Failed to get notification preferences:', error);
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  }

  /**
   * Update notification preferences
   */
  updatePreferences(updates: Partial<NotificationPreferences>): NotificationPreferences {
    const current = this.getPreferences();
    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
    return updated;
  }

  /**
   * Subscribe to notification events
   */
  subscribe(callback: (notification: PulseNotification) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(notification: PulseNotification): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Notification subscriber error:', error);
      }
    });
  }

  /**
   * Create batched notification summary
   */
  createBatch(notifications: PulseNotification[]): NotificationBatch {
    if (notifications.length === 0) {
      throw new Error('Cannot create batch from empty array');
    }

    const category = notifications[0].category;
    const count = notifications.length;

    let summary: string;
    switch (category) {
      case 'message':
        summary = `${count} new message${count > 1 ? 's' : ''}`;
        break;
      case 'email':
        summary = `${count} new email${count > 1 ? 's' : ''}`;
        break;
      case 'task':
        summary = `${count} task update${count > 1 ? 's' : ''}`;
        break;
      default:
        summary = `${count} notification${count > 1 ? 's' : ''}`;
    }

    return {
      id: crypto.randomUUID(),
      category,
      count,
      notifications,
      summary,
      timestamp: new Date(),
    };
  }

  /**
   * Track notification event for analytics
   */
  trackEvent(event: NotificationEvent): void {
    // Could send to analytics service
    console.log('Notification event:', event);
  }

  // =====================================
  // Helper methods for specific notification types
  // =====================================

  /**
   * Notify for new message
   */
  async notifyNewMessage(options: {
    senderName: string;
    senderAvatar?: string;
    message: string;
    channelName?: string;
    threadId?: string;
    actionUrl?: string;
    source?: NotificationSource;
  }): Promise<PulseNotification> {
    return this.notify({
      category: 'message',
      priority: 'medium',
      source: options.source || 'pulse',
      title: options.channelName
        ? `${options.senderName} in #${options.channelName}`
        : options.senderName,
      body: options.message,
      senderName: options.senderName,
      senderAvatar: options.senderAvatar,
      threadId: options.threadId,
      actionUrl: options.actionUrl,
    });
  }

  /**
   * Notify for new email
   */
  async notifyNewEmail(options: {
    senderName: string;
    senderEmail: string;
    subject: string;
    preview: string;
    isImportant?: boolean;
    actionUrl?: string;
  }): Promise<PulseNotification> {
    return this.notify({
      category: 'email',
      priority: options.isImportant ? 'high' : 'medium',
      source: 'email',
      title: `Email from ${options.senderName}`,
      body: `${options.subject}\n${options.preview}`,
      senderName: options.senderName,
      actionUrl: options.actionUrl,
      data: { email: options.senderEmail },
    });
  }

  /**
   * Notify for task event
   */
  async notifyTaskEvent(options: {
    type: 'assigned' | 'due_soon' | 'overdue' | 'completed' | 'updated';
    taskTitle: string;
    assigneeName?: string;
    dueDate?: Date;
    actionUrl?: string;
  }): Promise<PulseNotification> {
    let title: string;
    let priority: NotificationPriority = 'medium';

    switch (options.type) {
      case 'assigned':
        title = 'New task assigned';
        break;
      case 'due_soon':
        title = 'Task due soon';
        priority = 'high';
        break;
      case 'overdue':
        title = 'Task overdue';
        priority = 'urgent';
        break;
      case 'completed':
        title = 'Task completed';
        priority = 'low';
        break;
      case 'updated':
        title = 'Task updated';
        break;
      default:
        title = 'Task notification';
    }

    return this.notify({
      category: 'task',
      priority,
      source: 'pulse',
      title,
      body: options.taskTitle,
      actionUrl: options.actionUrl,
      data: { dueDate: options.dueDate?.toISOString() },
    });
  }

  /**
   * Notify for calendar event
   */
  async notifyCalendarEvent(options: {
    type: 'reminder' | 'invite' | 'updated' | 'cancelled';
    eventTitle: string;
    startTime: Date;
    location?: string;
    organizerName?: string;
    actionUrl?: string;
  }): Promise<PulseNotification> {
    let title: string;
    let priority: NotificationPriority = 'high';

    switch (options.type) {
      case 'reminder':
        title = 'Upcoming event';
        break;
      case 'invite':
        title = 'New meeting invitation';
        break;
      case 'updated':
        title = 'Event updated';
        priority = 'medium';
        break;
      case 'cancelled':
        title = 'Event cancelled';
        break;
      default:
        title = 'Calendar notification';
    }

    const time = options.startTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    return this.notify({
      category: 'calendar',
      priority,
      source: 'calendar',
      title,
      body: `${options.eventTitle} at ${time}${options.location ? ` - ${options.location}` : ''}`,
      senderName: options.organizerName,
      actionUrl: options.actionUrl,
    });
  }

  /**
   * Notify for AI/War Room event
   */
  async notifyAIEvent(options: {
    type: 'response_ready' | 'processing' | 'error';
    message: string;
    actionUrl?: string;
  }): Promise<PulseNotification> {
    return this.notify({
      category: 'ai',
      priority: options.type === 'error' ? 'high' : 'low',
      source: 'pulse',
      title: options.type === 'response_ready'
        ? 'AI Response Ready'
        : options.type === 'error'
          ? 'AI Error'
          : 'AI Processing',
      body: options.message,
      icon: '/icons/ai-icon.svg',
      actionUrl: options.actionUrl,
    });
  }

  /**
   * Notify for voice message
   */
  async notifyVoiceMessage(options: {
    senderName: string;
    duration: number;
    transcription?: string;
    actionUrl?: string;
  }): Promise<PulseNotification> {
    const durationStr = `${Math.floor(options.duration / 60)}:${(options.duration % 60).toString().padStart(2, '0')}`;

    return this.notify({
      category: 'voice',
      priority: 'high',
      source: 'pulse',
      title: `Voice message from ${options.senderName}`,
      body: options.transcription || `${durationStr} voice message`,
      senderName: options.senderName,
      actionUrl: options.actionUrl,
    });
  }

  /**
   * Notify for decision/vote event
   */
  async notifyDecisionEvent(options: {
    type: 'new_vote' | 'vote_complete' | 'approved' | 'rejected';
    decisionTitle: string;
    voterName?: string;
    actionUrl?: string;
  }): Promise<PulseNotification> {
    let title: string;
    let body: string = options.decisionTitle;

    switch (options.type) {
      case 'new_vote':
        title = 'New decision to vote on';
        break;
      case 'vote_complete':
        title = 'Voting complete';
        break;
      case 'approved':
        title = 'Decision approved';
        break;
      case 'rejected':
        title = 'Decision rejected';
        break;
      default:
        title = 'Decision update';
    }

    return this.notify({
      category: 'decision',
      priority: 'high',
      source: 'pulse',
      title,
      body,
      senderName: options.voterName,
      actionUrl: options.actionUrl,
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export class for testing
export { NotificationService };

/**
 * Gemini Quota Notification System
 *
 * Sends browser notifications when Gemini quota recovers or when
 * Gemini encounters errors.
 */

import {
  onHealthStatusChange,
  type APIHealthStatus,
} from './geminiHealthMonitor';

let previousStatus: APIHealthStatus | null = null;
let notificationsEnabled = false;

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[QuotaNotifications] Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Show a browser notification
 */
function showNotification(title: string, options?: NotificationOptions): void {
  if (!notificationsEnabled || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
  } catch (err) {
    console.error('[QuotaNotifications] Failed to show notification:', err);
  }
}

/**
 * Handle health status changes and send appropriate notifications
 */
function handleStatusChange(newStatus: APIHealthStatus): void {
  if (!previousStatus) {
    previousStatus = newStatus;
    return;
  }

  const wasGeminiDown = !previousStatus.gemini.available;
  const isGeminiUp = newStatus.gemini.available;

  // Gemini recovered from quota/error
  if (wasGeminiDown && isGeminiUp) {
    showNotification('✅ Gemini API Recovered', {
      body: 'Your Gemini API is now working! All AI features are back online.',
      tag: 'gemini-recovered',
      requireInteraction: false,
    });

    // Play a subtle success sound if available
    playNotificationSound('success');
  }

  // Gemini went down
  if (!wasGeminiDown && !isGeminiUp) {
    if (newStatus.gemini.status === 'quota_exceeded') {
      showNotification('⚠️ Gemini Quota Exceeded', {
        body: 'AI features unavailable until the quota resets.',
        tag: 'gemini-quota',
        requireInteraction: true,
      });
    } else {
      showNotification('⚠️ Gemini API Error', {
        body: `${newStatus.gemini.errorMessage || 'Connection failed'}.`,
        tag: 'gemini-error',
        requireInteraction: true,
      });
    }

    playNotificationSound('warning');
  }

  previousStatus = newStatus;
}

/**
 * Play notification sound
 */
function playNotificationSound(type: 'success' | 'warning'): void {
  try {
    const audio = new Audio();
    // Use system sounds or web audio API for subtle beeps
    if (type === 'success') {
      // A gentle, positive tone
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBQA=';
    } else {
      // A subtle warning beep
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBQA=';
    }
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore autoplay restrictions
    });
  } catch {
    // Ignore audio errors
  }
}

/**
 * Enable quota notifications
 */
export async function enableQuotaNotifications(): Promise<boolean> {
  const permitted = await requestNotificationPermission();
  if (permitted) {
    notificationsEnabled = true;

    // Subscribe to status changes
    onHealthStatusChange(handleStatusChange);

    console.info('[QuotaNotifications] Notifications enabled');
    return true;
  }

  console.warn('[QuotaNotifications] Notification permission denied');
  return false;
}

/**
 * Disable quota notifications
 */
export function disableQuotaNotifications(): void {
  notificationsEnabled = false;
  console.info('[QuotaNotifications] Notifications disabled');
}

/**
 * Check if notifications are enabled
 */
export function areNotificationsEnabled(): boolean {
  return notificationsEnabled && Notification.permission === 'granted';
}

/**
 * Send a test notification
 */
export async function sendTestNotification(): Promise<boolean> {
  const permitted = await requestNotificationPermission();
  if (!permitted) return false;

  showNotification('🧪 Test Notification', {
    body: 'Gemini quota notifications are working correctly!',
    tag: 'test',
    requireInteraction: false,
  });

  return true;
}

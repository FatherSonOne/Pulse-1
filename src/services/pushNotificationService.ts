/**
 * Push Notification Service
 * Handles Web Push API for PWA notifications
 */

import { supabase } from './supabaseClient';

interface PushSubscription {
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent: string;
  created_at?: string;
}

class PushNotificationService {
  private vapidPublicKey: string | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Load VAPID public key from environment or backend
    this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || null;
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      console.log('[Push] Push notifications not supported');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission:', permission);

      if (permission === 'granted') {
        // Subscribe to push notifications
        await this.subscribe();
      }

      return permission;
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      return 'denied';
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported()) {
      console.log('[Push] Push notifications not supported');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    try {
      // Get service worker registration. navigator.serviceWorker.ready ONLY
      // resolves once a SW is active and controlling the page. SW registration
      // is PROD-gated (main.tsx) and no live component mounts useServiceWorker,
      // so in dev — and during the pre-activation window in prod — `.ready`
      // never resolves. Awaiting it bare froze the onboarding "Requesting…"
      // spinner forever and, because Notifications is a required step, blocked
      // the whole permission wizard from ever reaching Contacts/Location. Bound
      // it with a timeout so a missing/inactive SW degrades to "no subscription"
      // instead of an indefinite hang.
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (!registration) {
        console.warn('[Push] No active service worker (ready timed out); skipping subscribe');
        return null;
      }

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Subscribe to push service
        const vapidPublicKey = await this.getVapidPublicKey();
        if (!vapidPublicKey) {
          console.error('[Push] VAPID public key not available');
          return null;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        });

        console.log('[Push] New subscription created');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[Push] User not authenticated');
        return null;
      }

      // Extract subscription keys
      const p256dh = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');

      if (!p256dh || !auth) {
        console.error('[Push] Subscription keys not available');
        return null;
      }

      // Prepare subscription data
      const pushSubscription: PushSubscription = {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh_key: this.arrayBufferToBase64(p256dh),
        auth_key: this.arrayBufferToBase64(auth),
        user_agent: navigator.userAgent
      };

      // Save subscription to backend
      await this.saveSubscription(pushSubscription);

      console.log('[Push] Subscription saved');
      return pushSubscription;
    } catch (error) {
      console.error('[Push] Error subscribing:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove subscription from backend
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await this.removeSubscription(user.id, subscription.endpoint);
        }

        console.log('[Push] Unsubscribed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      return false;
    }
  }

  /**
   * Check if user is subscribed
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription !== null;
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      return false;
    }
  }

  /**
   * Get VAPID public key from backend
   */
  private async getVapidPublicKey(): Promise<string | null> {
    if (this.vapidPublicKey) {
      return this.vapidPublicKey;
    }

    try {
      // Fallback: fetch VAPID public key from the pwa_settings table.
      // (Primary source is VITE_VAPID_PUBLIC_KEY, loaded in init().)
      // NOTE: table is `pwa_settings`, not `settings` — see migration
      // 20260210000002_pwa_push_subscriptions.sql.
      const { data, error } = await supabase
        .from('pwa_settings')
        .select('value')
        .eq('key', 'vapid_public_key')
        .single();

      if (error || !data) {
        console.error('[Push] Error fetching VAPID key:', error);
        return null;
      }

      this.vapidPublicKey = data.value;
      return this.vapidPublicKey;
    } catch (error) {
      console.error('[Push] Error getting VAPID key:', error);
      return null;
    }
  }

  /**
   * Save subscription to backend
   */
  private async saveSubscription(subscription: PushSubscription): Promise<void> {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(subscription, {
          onConflict: 'user_id,endpoint'
        });

      if (error) {
        console.error('[Push] Error saving subscription:', error);
        throw error;
      }
    } catch (error) {
      console.error('[Push] Error saving subscription:', error);
      throw error;
    }
  }

  /**
   * Remove subscription from backend
   */
  private async removeSubscription(userId: string, endpoint: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);

      if (error) {
        console.error('[Push] Error removing subscription:', error);
      }
    } catch (error) {
      console.error('[Push] Error removing subscription:', error);
    }
  }

  /**
   * Send a test notification
   */
  async sendTestNotification(): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Pulse Notification Test', {
        body: 'Push notifications are working correctly!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'test-notification',
        requireInteraction: false,
        actions: [
          {
            action: 'close',
            title: 'Close'
          }
        ]
      });

      return true;
    } catch (error) {
      console.error('[Push] Error sending test notification:', error);
      return false;
    }
  }

  /**
   * Utility: Convert VAPID key to Uint8Array
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
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

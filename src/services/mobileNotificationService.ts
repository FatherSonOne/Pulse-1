/**
 * Mobile Notification Service
 *
 * Phase 6 — abstracts Web Notification API + Capacitor LocalNotifications
 * so callers don't have to branch on platform. Same lazy-import pattern
 * as `hapticService.ts` so the code works whether or not
 * `@capacitor/local-notifications` is actually installed:
 *
 *   - On native (Capacitor): tries to dynamically import the plugin
 *     and use it. If the import fails (plugin not installed), falls
 *     back to Web API.
 *   - On web: uses the standard Notification API.
 *   - On unsupported platforms: silently no-ops.
 *
 * To unlock the full native path:
 *
 *     npm install @capacitor/local-notifications
 *     npx cap sync
 *
 * No code changes required after installing — the lazy import will
 * resolve and the native path activates automatically.
 *
 * Distinct from `notificationService.ts` (the broader Pulse Notification
 * Service for in-app notifications, sounds, batching, etc.) — this file
 * is specifically for OS-level notifications fired from the device.
 *
 * Use cases supported:
 *   - Immediate notification (focus session complete, message received).
 *   - Scheduled notification (focus break reminder, snooze callback).
 *   - Permission request flow.
 */

import { Capacitor } from '@capacitor/core';

interface NotifyOptions {
  /** Notification headline. */
  title: string;
  /** Body text shown below title. */
  body?: string;
  /** Optional icon URL (web) — Capacitor uses smallIcon from native config. */
  icon?: string;
  /** Tag/id used to deduplicate or replace an existing notification. */
  id?: string;
  /** When to fire. If omitted: immediate. */
  scheduledAt?: Date;
  /** Click action URL (deep link). */
  actionUrl?: string;
}

class MobileNotificationService {
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /** True if the platform supports any notification API. */
  isSupported(): boolean {
    if (this.isNative) return true;
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /** Current permission state. Web only — native handles permission
   *  on first call automatically (LocalNotifications.requestPermissions). */
  getPermission(): NotificationPermission | 'unknown' {
    if (this.isNative) return 'unknown';
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  /** Request permission. Idempotent. Returns true if granted. */
  async requestPermission(): Promise<boolean> {
    if (this.isNative) {
      try {
        const mod = await import('@capacitor/local-notifications').catch(() => null);
        if (mod) {
          const result = await mod.LocalNotifications.requestPermissions();
          return result.display === 'granted';
        }
      } catch (err) {
        console.error('[mobileNotificationService] native permission request failed:', err);
      }
      // Fall through to web API even on native if the plugin isn't
      // installed — Capacitor surfaces some web APIs in the embedded
      // webview.
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }

  /** Fire a notification (immediate or scheduled). Returns true if it
   *  was successfully dispatched. Silently fails if permission denied. */
  async notify(options: NotifyOptions): Promise<boolean> {
    if (!this.isSupported()) return false;

    // Try native path first when on a Capacitor platform.
    if (this.isNative) {
      try {
        const mod = await import('@capacitor/local-notifications').catch(() => null);
        if (mod) {
          const id = stableNumericId(options.id);
          await mod.LocalNotifications.schedule({
            notifications: [
              {
                id,
                title: options.title,
                body: options.body ?? '',
                schedule: options.scheduledAt ? { at: options.scheduledAt } : undefined,
                extra: options.actionUrl ? { actionUrl: options.actionUrl } : undefined,
              },
            ],
          });
          return true;
        }
      } catch (err) {
        console.error('[mobileNotificationService] native schedule failed:', err);
      }
      // Fall through to web API
    }

    // Web Notification API path
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    try {
      // Web Notification API doesn't support scheduling natively; for
      // scheduled notifications we use setTimeout. Acceptable for short
      // delays (focus-break reminders); long delays are unreliable
      // because the page may unload — those callers should use the
      // native path.
      const fire = () => {
        const n = new Notification(options.title, {
          body: options.body,
          icon: options.icon ?? '/pulse-logo.png',
          tag: options.id,
        });
        if (options.actionUrl) {
          n.onclick = () => {
            window.focus();
            window.location.href = options.actionUrl!;
            n.close();
          };
        }
      };

      if (options.scheduledAt) {
        const delay = options.scheduledAt.getTime() - Date.now();
        if (delay <= 0) {
          fire();
        } else {
          window.setTimeout(fire, delay);
        }
      } else {
        fire();
      }
      return true;
    } catch (err) {
      console.error('[mobileNotificationService] web notify failed:', err);
      return false;
    }
  }

  /** Cancel a previously-scheduled notification by id. No-op on web
   *  for setTimeout-based scheduling (would need extra bookkeeping). */
  async cancel(id: string): Promise<void> {
    if (!this.isNative) return;
    try {
      const mod = await import('@capacitor/local-notifications').catch(() => null);
      if (mod) {
        await mod.LocalNotifications.cancel({
          notifications: [{ id: stableNumericId(id) }],
        });
      }
    } catch (err) {
      console.error('[mobileNotificationService] cancel failed:', err);
    }
  }
}

/** Capacitor LocalNotifications requires numeric ids; we hash a
 *  string id to a stable 32-bit signed integer. Collisions are rare
 *  and tolerable (a collision just replaces the previous notification). */
function stableNumericId(id: string | undefined): number {
  if (!id) return Math.floor(Math.random() * 2_147_483_647);
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0; // 32-bit
  }
  return Math.abs(hash);
}

export const mobileNotificationService = new MobileNotificationService();
export default mobileNotificationService;

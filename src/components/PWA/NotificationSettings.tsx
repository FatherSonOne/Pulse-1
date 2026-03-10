import { useState, useEffect } from 'react';
import { pushNotificationService } from '../../services/pushNotificationService';

import { AlertTriangle, AtSign, Ban, Bell, BellRing, CheckCircle, Loader2, MessageSquare, Moon, Reply, ShieldHalf } from 'lucide-react';

/**
 * NotificationSettings Component
 * Manages push notification preferences and settings
 */
export function NotificationSettings() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    const supported = pushNotificationService.isSupported();
    setIsSupported(supported);

    if (supported) {
      const perm = pushNotificationService.getPermissionStatus();
      setPermission(perm);

      const subscribed = await pushNotificationService.isSubscribed();
      setIsSubscribed(subscribed);
    }
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const perm = await pushNotificationService.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const subscribed = await pushNotificationService.isSubscribed();
        setIsSubscribed(subscribed);
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setLoading(true);
    try {
      await pushNotificationService.unsubscribe();
      setIsSubscribed(false);
    } catch (error) {
      console.error('Error disabling notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    await pushNotificationService.sendTestNotification();
  };

  if (!isSupported) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
              Push Notifications Not Supported
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Your browser doesn't support push notifications. Try using Chrome, Firefox, Edge, or Safari on a supported device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isSubscribed
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
            }`}>
              <Bell className="text-xl" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Push Notifications
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {isSubscribed ? 'Active' : 'Not enabled'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSubscribed && (
              <button
                onClick={handleTestNotification}
                className="px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              >
                Test
              </button>
            )}
            <button
              onClick={isSubscribed ? handleDisableNotifications : handleEnableNotifications}
              disabled={loading || permission === 'denied'}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                isSubscribed
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : isSubscribed ? (
                'Disable'
              ) : (
                'Enable'
              )}
            </button>
          </div>
        </div>

        {permission === 'denied' && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Ban className="text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900 dark:text-red-100 mb-1">
                  Notifications Blocked
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  You've blocked notifications for this site. To enable them, click the lock icon in your browser's address bar and allow notifications.
                </p>
              </div>
            </div>
          </div>
        )}

        {isSubscribed && (
          <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-emerald-900 dark:text-emerald-100 mb-1">
                  Notifications Enabled
                </h4>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  You'll receive push notifications for new messages, mentions, and important updates.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
          Notification Features
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              New message alerts
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AtSign className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Mention notifications
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Reply className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Direct message replies
            </span>
          </div>
          <div className="flex items-center gap-3">
            <BellRing className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Important updates
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Moon className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Do Not Disturb mode (coming soon)
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldHalf className="text-zinc-500 dark:text-zinc-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1 text-sm">
              Your Privacy
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Notifications are sent securely via the Web Push protocol. Your subscription data is encrypted and stored securely. You can disable notifications at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

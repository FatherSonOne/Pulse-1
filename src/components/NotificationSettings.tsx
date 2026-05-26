/**
 * Pulse Notification Settings Component
 * Comprehensive notification preferences UI
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { pushNotificationService } from '../services/pushNotificationService';
import { NotificationCategory, CategoryPreferences, NotificationPriority } from '../types/notifications';
import { playNotificationSound, testAllSounds } from '../utils/soundGenerator';

import { Bell, Lightbulb, Moon, Play, Sliders, Star, Volume2, X } from 'lucide-react';

// Category configuration
const CATEGORIES: {
  id: NotificationCategory;
  label: string;
  icon: string;
  description: string;
}[] = [
  { id: 'message', label: 'Messages', icon: 'fa-comment', description: 'Direct messages and channel mentions' },
  { id: 'email', label: 'Email', icon: 'fa-envelope', description: 'New emails and important threads' },
  { id: 'task', label: 'Tasks', icon: 'fa-check-circle', description: 'Task assignments and due dates' },
  { id: 'calendar', label: 'Calendar', icon: 'fa-calendar', description: 'Event reminders and invitations' },
  { id: 'ai', label: 'AI / War Room', icon: 'fa-robot', description: 'AI responses and processing' },
  { id: 'voice', label: 'Voice', icon: 'fa-microphone', description: 'Voice messages and transcriptions' },
  { id: 'decision', label: 'Decisions', icon: 'fa-gavel', description: 'Votes and approvals' },
  { id: 'crm', label: 'CRM', icon: 'fa-handshake', description: 'Deal updates and contacts' },
  { id: 'system', label: 'System', icon: 'fa-cog', description: 'App updates and sync status' },
];

interface ToggleItemProps {
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}

interface NotificationSettingsProps {
  notifSound: boolean;
  setNotifSound: (value: boolean) => void;
  notifDesktop: boolean;
  setNotifDesktop: (value: boolean) => void;
  notifEmail: boolean;
  setNotifEmail: (value: boolean) => void;
  ToggleItem: React.FC<ToggleItemProps>;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  notifSound,
  setNotifSound,
  notifDesktop,
  setNotifDesktop,
  notifEmail,
  setNotifEmail,
  ToggleItem,
}) => {
  const {
    preferences,
    updatePreferences,
    updateCategoryPreferences,
    permissionStatus,
    requestPermission,
    isSupported,
    testSound,
    setSoundVolume,
    setQuietHours,
    addVipContact,
    removeVipContact,
  } = useNotificationStore();

  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [testingSound, setTestingSound] = useState<NotificationCategory | null>(null);
  const [vipInput, setVipInput] = useState('');

  // Background Web Push state (#101). Tracked separately from the in-app
  // preference toggles above, which are just delivery preferences and don't
  // reflect whether the browser has actually granted permission + subscribed.
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const refreshPushStatus = useCallback(async () => {
    const supported = pushNotificationService.isSupported();
    setPushSupported(supported);
    if (!supported) return;
    setPushPermission(pushNotificationService.getPermissionStatus());
    setPushSubscribed(await pushNotificationService.isSubscribed());
  }, []);

  useEffect(() => {
    void refreshPushStatus();
  }, [refreshPushStatus]);

  // Reliable enable path: prompts for permission when needed, and always
  // (re)subscribes so a row lands in push_subscriptions for the send-push
  // dispatcher. Replaces the conditional permission banner that only appeared
  // when status was exactly 'default'.
  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      if (pushNotificationService.getPermissionStatus() === 'granted') {
        await pushNotificationService.subscribe();
      } else {
        await pushNotificationService.requestPermission();
      }
    } catch (err) {
      console.error('[NotificationSettings] enable push failed:', err);
    } finally {
      await refreshPushStatus();
      setPushBusy(false);
    }
  };

  // Unsubscribe this device: tears down the pushManager subscription and removes
  // the push_subscriptions row so the dispatcher stops targeting it. (Does not
  // revoke the browser permission itself — only the browser's site settings can,
  // so a re-enable won't need another permission prompt.)
  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      await pushNotificationService.unsubscribe();
    } catch (err) {
      console.error('[NotificationSettings] disable push failed:', err);
    } finally {
      await refreshPushStatus();
      setPushBusy(false);
    }
  };

  // Sync local state with store
  useEffect(() => {
    updatePreferences({
      soundEnabled: notifSound,
      desktopEnabled: notifDesktop,
      emailDigestEnabled: notifEmail,
    });
  }, [notifSound, notifDesktop, notifEmail]);

  const handleTestSound = async (category: NotificationCategory) => {
    setTestingSound(category);
    playNotificationSound(category, preferences.soundVolume);
    setTimeout(() => setTestingSound(null), 1000);
  };

  const handleTestAllSounds = async () => {
    setTestingSound('system');
    await testAllSounds(preferences.soundVolume);
    setTestingSound(null);
  };

  const handleAddVip = () => {
    if (vipInput.trim()) {
      addVipContact(vipInput.trim());
      setVipInput('');
    }
  };

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="section-header">
        <h3 className="text-lg font-bold dark:text-white text-zinc-900 flex items-center gap-2">
          <Bell className="text-rose-500" />
          Notification Preferences
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Control how and when Pulse notifies you about important updates.
        </p>
      </div>

      {/* Permission Status */}
      {isSupported && permissionStatus !== 'granted' && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          permissionStatus === 'denied'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <i className={`fa-solid ${
            permissionStatus === 'denied' ? 'fa-ban text-red-500' : 'fa-bell-slash text-amber-500'
          } text-lg mt-0.5`}></i>
          <div className="flex-1">
            <p className={`font-medium text-sm ${
              permissionStatus === 'denied' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
            }`}>
              {permissionStatus === 'denied'
                ? 'Desktop notifications are blocked'
                : 'Desktop notifications are not enabled'}
            </p>
            <p className={`text-xs mt-1 ${
              permissionStatus === 'denied' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {permissionStatus === 'denied'
                ? 'Please enable notifications in your browser settings to receive desktop alerts.'
                : 'Enable notifications to receive important updates even when Pulse is in the background.'}
            </p>
            {permissionStatus === 'default' && (
              <button
                onClick={requestPermission}
                className="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition"
              >
                <Bell className="mr-2" />
                Enable Notifications
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Toggles */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 shadow-sm">
        <ToggleItem
          label="Desktop Notifications"
          desc="Show pop-up notifications on your desktop"
          active={notifDesktop}
          onToggle={() => setNotifDesktop(!notifDesktop)}
        />
        <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full" />
        <ToggleItem
          label="Sound Effects"
          desc="Play the Pulse digital heartbeat when you receive notifications"
          active={notifSound}
          onToggle={() => setNotifSound(!notifSound)}
        />
        <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full" />
        <ToggleItem
          label="Email Digests"
          desc="Receive a daily summary of missed activity"
          active={notifEmail}
          onToggle={() => setNotifEmail(!notifEmail)}
        />
      </div>

      {/* Background Push Notifications — explicit, always-visible enablement
          (#101). The old permission banner only rendered when status was
          'default', so a granted/denied/unknown state left no way to (re)trigger
          a subscription. This card always shows status + a reliable Enable
          button that prompts and subscribes. */}
      {pushSupported && (
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <Bell className="text-rose-500" size={16} />
                Background Push Notifications
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Get alerts even when Pulse is closed. Requires granting browser permission on this device.
              </p>
              <p className="text-xs mt-2 font-medium">
                <span className="text-zinc-500 dark:text-zinc-400">Status: </span>
                {pushPermission === 'denied' ? (
                  <span className="text-red-500">Blocked in browser settings</span>
                ) : pushSubscribed ? (
                  <span className="text-emerald-500">Enabled on this device</span>
                ) : (
                  <span className="text-amber-500">Not enabled</span>
                )}
              </p>
            </div>
            {pushSubscribed ? (
              <button
                onClick={handleDisablePush}
                disabled={pushBusy}
                className="shrink-0 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold rounded-lg transition"
              >
                {pushBusy ? 'Disabling…' : 'Disable'}
              </button>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={pushBusy || pushPermission === 'denied'}
                className="shrink-0 px-4 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition"
              >
                {pushBusy ? 'Enabling…' : 'Enable Push'}
              </button>
            )}
          </div>
          {pushPermission === 'denied' && (
            <p className="text-xs text-red-500 mt-3">
              Notifications are blocked for this site. Re-enable them in your browser's site settings, then reload.
            </p>
          )}
        </div>
      )}

      {/* Sound Settings */}
      {notifSound && (
        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
            <Volume2 className="text-rose-500" />
            Sound Settings
          </h4>

          {/* Volume Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Volume</label>
              <span className="text-xs text-rose-500 font-bold">
                {Math.round(preferences.soundVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.soundVolume}
              onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Mute</span>
              <span>Max</span>
            </div>
          </div>

          {/* Test Sounds */}
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              Test notification sounds for different categories:
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.slice(0, 5).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleTestSound(cat.id)}
                  disabled={testingSound !== null}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
                    testingSound === cat.id
                      ? 'bg-rose-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <i className={`fa-solid ${cat.icon}`}></i>
                  {cat.label}
                  {testingSound === cat.id && (
                    <Volume2 className="animate-pulse" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={handleTestAllSounds}
              disabled={testingSound !== null}
              className="mt-3 text-xs text-rose-500 hover:text-rose-600 font-medium"
            >
              <Play className="mr-1" />
              Play all sounds demo
            </button>
          </div>
        </div>
      )}

      {/* Quiet Hours */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
              <Moon className="text-purple-500" />
              Quiet Hours
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Only urgent notifications will come through during quiet hours.
            </p>
          </div>
          <button
            onClick={() => setQuietHours(!preferences.quietHoursEnabled)}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${
              preferences.quietHoursEnabled ? 'bg-purple-500' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
              preferences.quietHoursEnabled ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {preferences.quietHoursEnabled && (
          <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Start</label>
                <input
                  type="time"
                  value={preferences.quietHoursStart}
                  onChange={(e) => setQuietHours(true, e.target.value, preferences.quietHoursEnd)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">End</label>
                <input
                  type="time"
                  value={preferences.quietHoursEnd}
                  onChange={(e) => setQuietHours(true, preferences.quietHoursStart, e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm dark:text-white"
                />
              </div>
            </div>
            <ToggleItem
              label="Auto-enable on weekends"
              desc="Automatically activate quiet hours all day on Saturday and Sunday"
              active={preferences.quietHoursWeekends}
              onToggle={() => updatePreferences({ quietHoursWeekends: !preferences.quietHoursWeekends })}
            />
          </div>
        )}
      </div>

      {/* VIP Contacts */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
        <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
          <Star className="text-amber-500" />
          VIP Contacts
        </h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          VIP contacts will always trigger notifications, even during quiet hours or when batching is enabled.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={vipInput}
            onChange={(e) => setVipInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddVip()}
            placeholder="Add contact name or email"
            className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm dark:text-white placeholder-zinc-400"
          />
          <button
            onClick={handleAddVip}
            disabled={!vipInput.trim()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-bold rounded-lg text-sm transition"
          >
            Add
          </button>
        </div>

        {preferences.vipContacts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {preferences.vipContacts.map((contact, i) => (
              <span
                key={i}
                className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2"
              >
                <Star className="text-[10px]" />
                {contact}
                <button
                  onClick={() => removeVipContact(contact)}
                  className="hover:text-amber-900 dark:hover:text-amber-200"
                >
                  <X />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 italic">No VIP contacts added yet</p>
        )}
      </div>

      {/* Batching */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
        <ToggleItem
          label="Batch Low-Priority Notifications"
          desc="Group routine notifications and deliver them in periodic digests instead of immediately"
          active={preferences.batchLowPriority}
          onToggle={() => updatePreferences({ batchLowPriority: !preferences.batchLowPriority })}
        />
        {preferences.batchLowPriority && (
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-2">
              Batch interval: <span className="text-rose-500 font-bold">{preferences.batchInterval} minutes</span>
            </label>
            <input
              type="range"
              min="15"
              max="120"
              step="15"
              value={preferences.batchInterval}
              onChange={(e) => updatePreferences({ batchInterval: parseInt(e.target.value) })}
              className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
              <span>15 min</span>
              <span>1 hour</span>
              <span>2 hours</span>
            </div>
          </div>
        )}
      </div>

      {/* Per-Category Settings */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <button
          onClick={() => setShowCategorySettings(!showCategorySettings)}
          className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
        >
          <div className="flex items-center gap-3">
            <Sliders className="text-blue-500" />
            <div className="text-left">
              <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                Per-Category Settings
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Fine-tune notifications for each type of event
              </p>
            </div>
          </div>
          <i className={`fa-solid fa-chevron-${showCategorySettings ? 'up' : 'down'} text-zinc-400`}></i>
        </button>

        {showCategorySettings && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {CATEGORIES.map((cat) => (
              <CategorySettingsRow
                key={cat.id}
                category={cat}
                settings={preferences.categories[cat.id]}
                onUpdate={(updates) => updateCategoryPreferences(cat.id, updates)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
        <div className="flex items-start gap-3">
          <Lightbulb className="text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-semibold mb-1">About Pulse Notifications</p>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>Notifications use the custom Pulse "digital heartbeat" sound</li>
              <li>Push notifications work even when the browser is closed (requires permission)</li>
              <li>VIP contacts override all quiet hours and batching settings</li>
              <li>Urgent notifications always come through immediately</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Per-category settings row
const CategorySettingsRow: React.FC<{
  category: { id: NotificationCategory; label: string; icon: string; description: string };
  settings: CategoryPreferences;
  onUpdate: (updates: Partial<CategoryPreferences>) => void;
}> = ({ category, settings, onUpdate }) => {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <i className={`fa-solid ${category.icon} text-sm text-zinc-600 dark:text-zinc-400`}></i>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium dark:text-white text-zinc-900">{category.label}</span>
            <button
              onClick={() => onUpdate({ enabled: !settings.enabled })}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                settings.enabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${
                settings.enabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
          <span className="text-[10px] text-zinc-500">{category.description}</span>
        </div>
      </div>

      {settings.enabled && (
        <div className="pl-11 flex flex-wrap gap-2">
          <MiniToggle
            label="Desktop"
            icon="fa-desktop"
            active={settings.desktop}
            onToggle={() => onUpdate({ desktop: !settings.desktop })}
          />
          <MiniToggle
            label="Sound"
            icon="fa-volume-high"
            active={settings.sound}
            onToggle={() => onUpdate({ sound: !settings.sound })}
          />
          <MiniToggle
            label="Mobile"
            icon="fa-mobile"
            active={settings.mobile}
            onToggle={() => onUpdate({ mobile: !settings.mobile })}
          />
          <select
            value={settings.priority}
            onChange={(e) => onUpdate({ priority: e.target.value as NotificationPriority })}
            className="px-2 py-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-zinc-600 dark:text-zinc-400"
          >
            <option value="low">Min: Low</option>
            <option value="medium">Min: Medium</option>
            <option value="high">Min: High</option>
            <option value="urgent">Min: Urgent</option>
          </select>
        </div>
      )}
    </div>
  );
};

// Mini toggle for category options
const MiniToggle: React.FC<{
  label: string;
  icon: string;
  active: boolean;
  onToggle: () => void;
}> = ({ label, icon, active, onToggle }) => (
  <button
    onClick={onToggle}
    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition ${
      active
        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
    }`}
  >
    <i className={`fa-solid ${icon}`}></i>
    {label}
  </button>
);

export default NotificationSettings;

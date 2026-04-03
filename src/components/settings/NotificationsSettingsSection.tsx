import React, { useState, useEffect } from 'react';
import { NotificationSettings } from '../NotificationSettings';
import { settingsService } from '../../services/settingsService';
import { ToggleItem } from './shared/ToggleItem';

export const NotificationsSettingsSection: React.FC = () => {
  const [enableAllNotifications, setEnableAllNotifications] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);

  // Load persisted notification settings on mount
  useEffect(() => {
    const load = async () => {
      const [allNotifs, sound, desktop, email] = await Promise.all([
        settingsService.get('enableAllNotifications'),
        settingsService.get('notifSound'),
        settingsService.get('notifDesktop'),
        settingsService.get('notifEmail'),
      ]);

      if (allNotifs !== undefined) setEnableAllNotifications(allNotifs as boolean);
      if (sound !== undefined) setNotifSound(sound as boolean);
      if (desktop !== undefined) setNotifDesktop(desktop as boolean);
      if (email !== undefined) setNotifEmail(email as boolean);
    };
    load();
  }, []);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold dark:text-white text-zinc-900">
            Enable All Notifications
          </h4>
          <p className="text-xs text-zinc-500">Master switch to pause all alerts</p>
        </div>
        <ToggleItem
          label=""
          desc=""
          active={enableAllNotifications}
          onToggle={() => {
            const v = !enableAllNotifications;
            setEnableAllNotifications(v);
            settingsService.set('enableAllNotifications', v);
          }}
        />
      </div>

      {enableAllNotifications && (
        <NotificationSettings
          notifSound={notifSound}
          setNotifSound={(v: boolean) => { setNotifSound(v); settingsService.set('notifSound', v); }}
          notifDesktop={notifDesktop}
          setNotifDesktop={(v: boolean) => { setNotifDesktop(v); settingsService.set('notifDesktop', v); }}
          notifEmail={notifEmail}
          setNotifEmail={(v: boolean) => { setNotifEmail(v); settingsService.set('notifEmail', v); }}
          ToggleItem={ToggleItem}
        />
      )}
    </div>
  );
};

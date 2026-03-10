import React, { useState, useEffect } from 'react';
import { NotificationSettings } from '../NotificationSettings';
import { settingsService } from '../../services/settingsService';

interface ToggleItemProps {
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ label, desc, active, onToggle }) => (
  <div className="flex justify-between items-center group cursor-pointer" onClick={onToggle}>
    <div>
      <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
      <div className="text-zinc-500 text-xs">{desc}</div>
    </div>
    <button
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${
        active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
          active ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

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
          onToggle={() => setEnableAllNotifications(!enableAllNotifications)}
        />
      </div>

      {enableAllNotifications && (
        <NotificationSettings
          notifSound={notifSound}
          setNotifSound={setNotifSound}
          notifDesktop={notifDesktop}
          setNotifDesktop={setNotifDesktop}
          notifEmail={notifEmail}
          setNotifEmail={setNotifEmail}
          ToggleItem={ToggleItem}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { ToggleItem } from './shared/ToggleItem';

export const DesktopAppSettings: React.FC = () => {
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const [desktopRememberPosition, setDesktopRememberPosition] = useState(true);
  const [desktopMinimizeToTray, setDesktopMinimizeToTray] = useState(false);
  const [desktopAutoLaunch, setDesktopAutoLaunch] = useState(false);
  const [desktopNotificationStyle, setDesktopNotificationStyle] = useState<'native' | 'in-app'>('native');

  useEffect(() => {
    const load = async () => {
      const [deskPos, deskTray, deskLaunch, deskNotif] = await Promise.all([
        settingsService.get('desktopRememberWindowPosition'),
        settingsService.get('desktopMinimizeToTray'),
        settingsService.get('desktopAutoLaunch'),
        settingsService.get('desktopNotificationStyle'),
      ]);
      if (deskPos !== undefined) setDesktopRememberPosition(deskPos);
      if (deskTray !== undefined) setDesktopMinimizeToTray(deskTray);
      if (deskLaunch !== undefined) setDesktopAutoLaunch(deskLaunch);
      if (deskNotif) setDesktopNotificationStyle(deskNotif);
    };
    load();
  }, []);

  if (!isElectron) return null;

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3><Monitor /> Desktop App</h3>
        <p>Customize Pulse desktop app behavior on your system.</p>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
        <ToggleItem
          label="Remember Window Position"
          desc="Restore the window to its last position and size on launch"
          active={desktopRememberPosition}
          onToggle={() => {
            const v = !desktopRememberPosition;
            setDesktopRememberPosition(v);
            settingsService.set('desktopRememberWindowPosition', v);
          }}
        />
        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
        <ToggleItem
          label="Minimize to System Tray"
          desc="Keep Pulse running in the system tray when the window is closed"
          active={desktopMinimizeToTray}
          onToggle={() => {
            const v = !desktopMinimizeToTray;
            setDesktopMinimizeToTray(v);
            settingsService.set('desktopMinimizeToTray', v);
          }}
        />
        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
        <ToggleItem
          label="Launch at System Startup"
          desc="Start Pulse automatically when your computer starts"
          active={desktopAutoLaunch}
          onToggle={() => {
            const v = !desktopAutoLaunch;
            setDesktopAutoLaunch(v);
            settingsService.set('desktopAutoLaunch', v);
            if ((window as any).electronAPI?.setAutoLaunch) {
              (window as any).electronAPI.setAutoLaunch(v);
            }
          }}
        />
        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>
        <div>
          <label className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Notification Style</label>
          <div className="flex gap-3">
            {(['native', 'in-app'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => {
                  setDesktopNotificationStyle(style);
                  settingsService.set('desktopNotificationStyle', style);
                }}
                className={`flex-1 py-2 border rounded-lg text-sm font-medium transition ${
                  desktopNotificationStyle === style
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                }`}
              >
                {style === 'native' ? 'Native OS' : 'In-App'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

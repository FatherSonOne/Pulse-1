/**
 * AccountSettingsModal — quick-access launcher.
 *
 * Demoted from the previous full-settings duplicate (4 tabs, 8 toggles, accent
 * picker, font-size, etc.) to a thin launcher that surfaces the three most-
 * used quick toggles and routes the rest to the canonical settings surface
 * at src/components/settings/. The previous implementation duplicated state
 * and UI from canonical primitives (SettingsCard, ToggleItem) and silently
 * failed to apply theme changes (it wrote to settingsService but never called
 * toggleTheme). This shell now does neither.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { settingsService } from '../../services/settingsService';
import { ToggleItem } from '../settings/shared/ToggleItem';
import { SettingsCard } from '../settings/shared/SettingsCard';
import { ArrowRight, Bell, Monitor, Moon, Sun, Volume2, X } from 'lucide-react';
import './AccountSettingsModal.css';

type ThemeMode = 'light' | 'dark' | 'system';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onOpenFullSettings?: (section?: string) => void;
  /** Element to refocus when the launcher closes (the trigger that opened it). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  userName,
  userEmail,
  avatarUrl,
  isDarkMode,
  onToggleTheme,
  onOpenFullSettings,
  returnFocusRef,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  );

  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Load only the three settings this launcher exposes. Optimistic defaults
  // are already in state, so the controls render immediately; values get
  // replaced in place once the read returns. No loading branch -> no flash
  // for sub-200ms reads.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    (async () => {
      try {
        const [storedTheme, desktopValue, soundValue] = await Promise.all([
          settingsService.get('theme'),
          settingsService.get('desktopNotifications'),
          settingsService.get('soundEnabled'),
        ]);
        if (cancelled) return;
        if (storedTheme) setThemeMode(storedTheme as ThemeMode);
        if (desktopValue !== undefined) setDesktopNotifications(desktopValue);
        if (soundValue !== undefined) setSoundEffects(soundValue);
      } catch (error) {
        console.error('Error loading quick settings:', error);
        if (!cancelled) toast.error("Couldn't load settings. Try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const persist = useCallback(async (key: string, value: unknown) => {
    try {
      await settingsService.set(key as Parameters<typeof settingsService.set>[0], value as never);
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      toast.error(`Couldn't save ${key}. Try again.`);
    }
  }, []);

  const handleThemeChange = useCallback((next: ThemeMode) => {
    setThemeMode(next);
    void persist('theme', next);

    // Actually apply the theme. Without this, the previous modal silently
    // failed: it wrote to settingsService but never toggled the document
    // class, so picking "Dark" did nothing.
    if (!onToggleTheme) return;

    if (next === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark !== !!isDarkMode) onToggleTheme();
      return;
    }

    const wantDark = next === 'dark';
    if (wantDark !== !!isDarkMode) onToggleTheme();
  }, [isDarkMode, onToggleTheme, persist]);

  const handleDesktopToggle = useCallback(async () => {
    const next = !desktopNotifications;

    // When turning ON, we may need OS-level permission first. Skip the
    // permission dance entirely when turning OFF.
    if (next && typeof Notification !== 'undefined') {
      if (Notification.permission === 'denied') {
        // Toggle stays OFF — flipping the preference is meaningless if the
        // OS will block delivery. Tell the user how to fix it.
        toast.error('Notifications are blocked. Enable them in your browser settings, then try again.');
        return;
      }
      if (Notification.permission === 'default') {
        try {
          const result = await Notification.requestPermission();
          setNotifPermission(result);
          if (result !== 'granted') {
            // User dismissed or denied. Don't flip the toggle ON — keep
            // preference and OS state in sync.
            return;
          }
        } catch (error) {
          console.error('Error requesting notification permission:', error);
          return;
        }
      }
    }

    setDesktopNotifications(next);
    void persist('desktopNotifications', next);
  }, [desktopNotifications, persist]);

  const handleSoundToggle = useCallback(() => {
    const next = !soundEffects;
    setSoundEffects(next);
    void persist('soundEnabled', next);
  }, [soundEffects, persist]);

  // Close handlers + focus management.
  const handleClose = useCallback(() => {
    onClose();
    // Return focus to the trigger that opened the launcher.
    requestAnimationFrame(() => {
      returnFocusRef?.current?.focus();
    });
  }, [onClose, returnFocusRef]);

  // Esc to close, focus the close button on open, trap focus inside.
  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="pulse-account-launcher__scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pulse-account-launcher"
      >
        {/* Header */}
        <div className="pulse-account-launcher__header">
          <div className="pulse-account-launcher__avatar">
            {avatarUrl && !imageError ? (
              <img
                src={avatarUrl}
                alt=""
                onError={() => setImageError(true)}
              />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>
          <div className="pulse-account-launcher__identity">
            <h2 id={titleId} className="pulse-account-launcher__name">{userName}</h2>
            <p className="pulse-account-launcher__email">{userEmail}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="pulse-account-launcher__close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="pulse-account-launcher__body">
          <SettingsCard padded={false} className="pulse-account-launcher__card">
              {/* Theme — segmented control (the signature interaction) */}
              <div className="pulse-account-launcher__row pulse-account-launcher__row--theme">
                <div className="pulse-account-launcher__row-text">
                  <div className="pulse-account-launcher__row-label">Theme</div>
                  <div className="pulse-account-launcher__row-desc">Light, Dark, or follow system</div>
                </div>
                <div
                  className="pulse-account-launcher__segment"
                  role="radiogroup"
                  aria-label="Theme"
                >
                  {[
                    { value: 'light' as const, Icon: Sun, label: 'Light' },
                    { value: 'dark' as const, Icon: Moon, label: 'Dark' },
                    { value: 'system' as const, Icon: Monitor, label: 'System' },
                  ].map(({ value, Icon, label }) => {
                    const active = themeMode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={label}
                        onClick={() => handleThemeChange(value)}
                        className={`pulse-account-launcher__segment-button ${active ? 'is-active' : ''}`}
                        title={label}
                      >
                        <Icon size={14} aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pulse-account-launcher__divider" role="presentation" />

              {/* Desktop notifications — canonical ToggleItem */}
              <div className="pulse-account-launcher__row pulse-account-launcher__row--toggle">
                <Bell size={16} aria-hidden="true" className="pulse-account-launcher__row-icon" />
                <ToggleItem
                  label="Desktop notifications"
                  desc={notifPermission === 'denied'
                    ? 'Blocked by your browser. Enable in site settings.'
                    : 'Show notifications outside the app'}
                  active={desktopNotifications && notifPermission === 'granted'}
                  onToggle={handleDesktopToggle}
                />
              </div>

              <div className="pulse-account-launcher__divider" role="presentation" />

              {/* Sound effects — canonical ToggleItem */}
              <div className="pulse-account-launcher__row pulse-account-launcher__row--toggle">
                <Volume2 size={16} aria-hidden="true" className="pulse-account-launcher__row-icon" />
                <ToggleItem
                  label="Sound effects"
                  desc="Play sounds for clicks and actions"
                  active={soundEffects}
                  onToggle={handleSoundToggle}
                />
              </div>
          </SettingsCard>
        </div>

        {/* Footer — primary CTA into canonical Settings */}
        <div className="pulse-account-launcher__footer">
          <button
            type="button"
            onClick={() => {
              handleClose();
              onOpenFullSettings?.('account');
            }}
            className="pulse-account-launcher__cta"
          >
            <span>All settings</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsModal;

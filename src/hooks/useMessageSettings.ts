/**
 * useMessageSettings — message-scoped user preferences for the Pulse-DM surface.
 *
 * Added 2026-06-01 for the Message Settings panel
 * (docs/MESSAGE_SETTINGS_HANDOFF_2026-06-01.md §5).
 *
 * These are NOT FeatureContext flags — they are lightweight, message-scoped
 * preferences persisted to localStorage (`pulse_message_settings_v1`), mirroring
 * the simple-localStorage pattern used for composer drafts. Keeping them out of
 * FeatureFlags avoids churning the total `Record` types in FeatureContext and
 * the shared Features Labs surface.
 *
 * Only genuinely-wired settings live here. Toggles that don't yet gate real
 * behavior (read receipts, notification sound/preview) are rendered as
 * "Coming soon" in the panel and are deliberately absent from this store — we
 * don't persist settings that do nothing.
 */

import { useCallback, useEffect, useState } from 'react';

export interface MessageSettings {
  /**
   * When true, plain Enter sends and Shift+Enter inserts a newline. When false
   * (default, preserving prior behavior) Cmd/Ctrl+Enter sends and Enter inserts
   * a newline. Honored by PulseComposer.
   */
  enterToSend: boolean;
  /**
   * When true (default), the composer broadcasts typing indicators to the other
   * participant. Honored by PulseComposer's onTyping path.
   */
  sendTypingIndicators: boolean;
}

export const DEFAULT_MESSAGE_SETTINGS: MessageSettings = {
  enterToSend: false,
  sendTypingIndicators: true,
};

export const MESSAGE_SETTINGS_KEY = 'pulse_message_settings_v1';
const CHANGE_EVENT = 'pulse-message-settings-change';

export function loadMessageSettings(): MessageSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_MESSAGE_SETTINGS };
  try {
    const raw = window.localStorage.getItem(MESSAGE_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_MESSAGE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_MESSAGE_SETTINGS };
}

function persist(next: MessageSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MESSAGE_SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  } catch {
    /* ignore */
  }
}

export interface UseMessageSettingsReturn {
  settings: MessageSettings;
  setSetting: <K extends keyof MessageSettings>(key: K, value: MessageSettings[K]) => void;
  resetSettings: () => void;
}

export function useMessageSettings(): UseMessageSettingsReturn {
  const [settings, setSettings] = useState<MessageSettings>(() => loadMessageSettings());

  const setSetting = useCallback(
    <K extends keyof MessageSettings>(key: K, value: MessageSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        persist(next);
        return next;
      });
    },
    [],
  );

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_MESSAGE_SETTINGS };
    setSettings(next);
    persist(next);
  }, []);

  // Sync across hook instances (panel + composer) and browser tabs.
  useEffect(() => {
    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent<MessageSettings>).detail;
      if (detail) setSettings(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === MESSAGE_SETTINGS_KEY) setSettings(loadMessageSettings());
    };
    window.addEventListener(CHANGE_EVENT, onExternal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onExternal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { settings, setSetting, resetSettings };
}

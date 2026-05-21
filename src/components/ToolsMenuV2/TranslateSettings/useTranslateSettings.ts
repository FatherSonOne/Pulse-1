// src/components/ToolsMenuV2/TranslateSettings/useTranslateSettings.ts
// PR 3a — Surface 3 · Translate Settings · per-thread persistence hook.
//
// Owns the {enabled, targetLanguage, showOriginalDefault} record for a
// single thread. localStorage key is `pulse_translate_settings_{threadId}`
// per spec — one record per thread, never global, so toggling on one
// conversation doesn't surprise the user in another. The hook is
// resilient to absent/corrupted JSON and silently falls back to the
// default record.

import { useCallback, useEffect, useState } from 'react';
import type { TranslateSettings } from '../types';
import { DEFAULT_TRANSLATE_LANGUAGE } from './languages';

const DEFAULT_SETTINGS: TranslateSettings = {
  enabled: false,
  targetLanguage: DEFAULT_TRANSLATE_LANGUAGE,
  showOriginalDefault: false,
};

function storageKey(threadId: string): string {
  return `pulse_translate_settings_${threadId}`;
}

function loadSettings(threadId: string): TranslateSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(storageKey(threadId));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TranslateSettings>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SETTINGS.enabled,
      targetLanguage:
        typeof parsed.targetLanguage === 'string'
          ? parsed.targetLanguage
          : DEFAULT_SETTINGS.targetLanguage,
      showOriginalDefault:
        typeof parsed.showOriginalDefault === 'boolean'
          ? parsed.showOriginalDefault
          : DEFAULT_SETTINGS.showOriginalDefault,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(threadId: string, settings: TranslateSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(threadId), JSON.stringify(settings));
  } catch {
    /* localStorage may be unavailable — swallow per spec error policy */
  }
}

export interface UseTranslateSettingsReturn {
  settings: TranslateSettings;
  setEnabled: (enabled: boolean) => void;
  setTargetLanguage: (lang: string) => void;
  setShowOriginalDefault: (show: boolean) => void;
}

export function useTranslateSettings(threadId: string): UseTranslateSettingsReturn {
  const [settings, setSettings] = useState<TranslateSettings>(() => loadSettings(threadId));

  // Reload when the thread changes — each thread is its own record.
  useEffect(() => {
    setSettings(loadSettings(threadId));
  }, [threadId]);

  // Persist on every change.
  useEffect(() => {
    saveSettings(threadId, settings);
  }, [threadId, settings]);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
  }, []);

  const setTargetLanguage = useCallback((lang: string) => {
    setSettings((prev) => ({ ...prev, targetLanguage: lang }));
  }, []);

  const setShowOriginalDefault = useCallback((show: boolean) => {
    setSettings((prev) => ({ ...prev, showOriginalDefault: show }));
  }, []);

  return {
    settings,
    setEnabled,
    setTargetLanguage,
    setShowOriginalDefault,
  };
}

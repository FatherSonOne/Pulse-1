// src/components/ToolsMenuV2/TranslateSettings/TranslateSettings.tsx
// PR 3a — Surface 3 · slim Tools menu · Translate Settings tile body.
//
// Per-thread auto-translate configuration. ZERO coral — translation is
// deterministic, not AI-authored prose, so it uses neutral surface
// tokens (per spec line 814 "the 🌐 chip uses neutral info-token, NOT
// coral"). Persistence is owned by useTranslateSettings.

import React, { useId } from 'react';
import { Languages } from 'lucide-react';
import { TRANSLATE_LANGUAGES } from './languages';
import { useTranslateSettings } from './useTranslateSettings';
import type { ToolsMenuTileBodyProps } from '../types';

export const TranslateSettings: React.FC<ToolsMenuTileBodyProps> = ({
  threadId,
  isDarkMode,
}) => {
  const {
    settings,
    setEnabled,
    setTargetLanguage,
    setShowOriginalDefault,
  } = useTranslateSettings(threadId);

  const autoTranslateId = useId();
  const languageId = useId();
  const showOriginalId = useId();

  return (
    <div className="space-y-4">
      <p
        className={[
          'text-xs leading-relaxed',
          isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
        ].join(' ')}
      >
        Translate Casey&rsquo;s incoming messages into your target language.
        Translations are deterministic — provenance shown as a neutral
        chip, never as AI signal.
      </p>

      <ToggleRow
        id={autoTranslateId}
        label="Auto-translate received messages"
        description="Apply silently as messages arrive."
        checked={settings.enabled}
        onChange={setEnabled}
        isDarkMode={isDarkMode}
      />

      <div className="space-y-1.5">
        <label
          htmlFor={languageId}
          className={[
            'block text-xs font-mono uppercase tracking-[0.1em]',
            isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
          ].join(' ')}
        >
          Target language
        </label>
        <div className="relative">
          <Languages
            size={16}
            aria-hidden="true"
            className={[
              'absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none',
              isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
            ].join(' ')}
          />
          <select
            id={languageId}
            value={settings.targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            disabled={!settings.enabled}
            className={[
              'w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm appearance-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isDarkMode
                ? 'bg-zinc-900 border-white/10 text-zinc-100'
                : 'bg-white border-black/10 text-zinc-900',
            ].join(' ')}
          >
            {TRANSLATE_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
                {lang.native && lang.native !== lang.label
                  ? ` — ${lang.native}`
                  : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ToggleRow
        id={showOriginalId}
        label="Show original by default"
        description="Display source text beneath the translation."
        checked={settings.showOriginalDefault}
        onChange={setShowOriginalDefault}
        disabled={!settings.enabled}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  isDarkMode: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  isDarkMode,
}) => {
  return (
    <div
      className={[
        'flex items-start gap-3 rounded-xl border px-3 py-3',
        disabled ? 'opacity-50' : '',
        isDarkMode
          ? 'border-white/10 bg-white/[0.02]'
          : 'border-black/10 bg-black/[0.02]',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className={[
            'block text-sm font-medium',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
            isDarkMode ? 'text-zinc-100' : 'text-zinc-900',
          ].join(' ')}
        >
          {label}
        </label>
        {description ? (
          <p
            className={[
              'mt-0.5 text-xs',
              isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
            ].join(' ')}
          >
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          'shrink-0 inline-flex items-center w-11 h-6 rounded-full transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
          disabled ? 'cursor-not-allowed' : '',
          checked
            ? isDarkMode
              ? 'bg-zinc-100'
              : 'bg-zinc-900'
            : isDarkMode
              ? 'bg-white/15'
              : 'bg-black/15',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'inline-block w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-150',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
            !checked && !isDarkMode ? 'bg-white' : '',
            checked && isDarkMode ? 'bg-zinc-900' : '',
          ].join(' ')}
        />
      </button>
    </div>
  );
};

export default TranslateSettings;

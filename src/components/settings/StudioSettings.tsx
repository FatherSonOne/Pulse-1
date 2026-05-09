import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';

/**
 * War Room settings.
 *
 * Only renders controls that drive real behavior. The previous version had
 * 13 toggles (AI Reasoning Depth, Token Streaming, Thinking Panel, Annotations,
 * Default Agent, Voice Mode, Voice Gender, Content Safety, Profanity Filter,
 * Hallucination Detection, Advanced Language) that all persisted to settings
 * but had zero consumers — flipping them did nothing in production.
 *
 * Voice gender + voice mode now live in the War Room itself (per-session
 * via warRoomStore). Guardrails are configured at the realtimeAgentService
 * level. Reasoning depth is selected automatically by aiPreferencesService
 * based on the user's quality dial in AI & Intelligence settings.
 *
 * Only `warRoomDefaultMode` survives — read by LiveDashboard on mount.
 */
const MODE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: 'command-center', label: 'Command Center', desc: 'Full surface: chat, agents, intel desk, board' },
  { value: 'focus',          label: 'Focus',          desc: 'Single-agent chat without the rails' },
  { value: 'live',           label: 'Live',           desc: 'Voice-first session with the realtime agent' },
];

export const StudioSettings: React.FC = () => {
  const [defaultMode, setDefaultMode] = useState('command-center');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await settingsService.get('warRoomDefaultMode');
      if (cancelled) return;
      if (typeof stored === 'string') setDefaultMode(stored);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (value: string) => {
    setDefaultMode(value);
    void settingsService.set('warRoomDefaultMode', value);
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3><Shield /> War Room</h3>
        <p>
          Choose the default surface War Room opens in. Per-session controls
          (voice mode, voice, guardrails) live inside War Room itself.
        </p>
      </div>

      <SettingsCard className="space-y-4">
        <MonoLabel as="label" className="block">Default Mode</MonoLabel>
        <div className="space-y-2">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleChange(opt.value)}
              disabled={isLoading}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border transition text-left disabled:opacity-50 ${
                defaultMode === opt.value
                  ? 'border-rose-500 bg-rose-500/5 dark:bg-rose-500/10'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  defaultMode === opt.value
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-zinc-900 dark:text-white'
                }`}>
                  {opt.label}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {opt.desc}
                </div>
              </div>
              {defaultMode === opt.value && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 flex-shrink-0"
                />
              )}
            </button>
          ))}
        </div>
      </SettingsCard>

      <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-prose">
        Looking for reasoning depth, voice settings, or guardrails? Reasoning depth
        follows your AI &amp; Intelligence model preferences. Voice and guardrails
        are configured per-session inside War Room.
      </p>
    </div>
  );
};

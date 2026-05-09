import React from 'react';
import AIHealthMonitor from '../AIHealthMonitor';
import { Brain, Sliders } from 'lucide-react';
import { SettingsCard } from './shared/SettingsCard';
import { AIProvidersCard } from './ai/AIProvidersCard';
import { AIDataPolicyCard } from './ai/AIDataPolicyCard';
import { AIModelPreferencesCard } from './ai/AIModelPreferencesCard';

/**
 * AI & Intelligence settings.
 *
 * Only renders controls that drive real behavior:
 *   - AI Health Monitor — live status from geminiHealthMonitor
 *   - AI Providers       — server-enforced opt-out via workspaceService
 *   - Model Preferences  — drives useAI.resolve() model selection
 *   - AI Data Policy     — PII masking applied in invokeAI() before send
 *
 * Voice Agent / Knowledge Base / Hardware controls used to live here but were
 * never wired to consumers. Audio + voice settings now live in Relay (deep
 * link below). RAG search scope is service-driven, not user-toggleable yet.
 */
export const AIIntelligenceSettings: React.FC = () => {
  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          <Brain /> AI &amp; Intelligence
        </h3>
        <p>
          Manage AI providers, model selection, and data policy. Pulse picks the
          right model for each task automatically; everything below is a guardrail.
        </p>
      </div>

      {/* Live status from the health monitor */}
      <AIHealthMonitor />

      {/* Org policy + per-user provider opt-out */}
      <AIProvidersCard />

      {/* Quality dial (Auto / Fast / Balanced / Quality) + per-tier override */}
      <AIModelPreferencesCard />

      {/* PII masking + AI output retention */}
      <AIDataPolicyCard />

      {/* Audio + voice live in Relay — direct users there instead of duplicating */}
      <SettingsCard>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              Relay Audio &amp; Voice
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              Microphone, speaker, voice agent settings, and voice recording live in Relay
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '?settings=voxer_audio');
              window.dispatchEvent(new CustomEvent('navigate-settings', { detail: 'voxer_audio' }));
            }}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <Sliders />
            Open Relay Settings
          </button>
        </div>
      </SettingsCard>
    </div>
  );
};

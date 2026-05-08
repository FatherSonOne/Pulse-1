import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import i18n from '../../i18n';
import { SettingsCard } from './shared/SettingsCard';
import { MonoLabel } from './shared/MonoLabel';

const ToggleItem = ({ label, desc, active, onToggle }: { label: string; desc: string; active: boolean; onToggle: () => void }) => (
  <div className="flex justify-between items-center group cursor-pointer" onClick={onToggle}>
    <div>
      <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
      <div className="text-zinc-500 text-xs">{desc}</div>
    </div>
    <button
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${active ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  </div>
);

export const StudioSettings: React.FC = () => {
  const [warRoomDefaultMode, setWarRoomDefaultMode] = useState('command-center');
  const [warRoomAIDepth, setWarRoomAIDepth] = useState<'fast' | 'balanced' | 'deep'>('balanced');
  const [warRoomTokenStreaming, setWarRoomTokenStreaming] = useState(true);
  const [warRoomThinkingPanel, setWarRoomThinkingPanel] = useState(true);
  const [warRoomAnnotations, setWarRoomAnnotations] = useState(true);
  const [warRoomDefaultAgent, setWarRoomDefaultAgent] = useState('general');
  const [warRoomVoiceMode, setWarRoomVoiceMode] = useState('push-to-talk');
  const [warRoomVoiceGender, setWarRoomVoiceGender] = useState<'male' | 'female' | 'neutral'>('neutral');
  const [warRoomGuardrailContentSafety, setWarRoomGuardrailContentSafety] = useState(true);
  const [warRoomGuardrailProfanity, setWarRoomGuardrailProfanity] = useState(true);
  const [warRoomGuardrailHallucination, setWarRoomGuardrailHallucination] = useState(true);
  const [warRoomLanguage, setWarRoomLanguage] = useState('en');

  useEffect(() => {
    const load = async () => {
      const [wrMode, wrDepth, wrStream, wrThink, wrAnnot, wrAgent, wrVoiceMode, wrVoiceGender, wrGCSafety, wrGCProfanity, wrGCHallucination, wrLang] = await Promise.all([
        settingsService.get('warRoomDefaultMode'),
        settingsService.get('warRoomAIDepth'),
        settingsService.get('warRoomTokenStreaming'),
        settingsService.get('warRoomThinkingPanel'),
        settingsService.get('warRoomAnnotations'),
        settingsService.get('warRoomDefaultAgent'),
        settingsService.get('warRoomVoiceMode'),
        settingsService.get('warRoomVoiceGender'),
        settingsService.get('warRoomGuardrailContentSafety'),
        settingsService.get('warRoomGuardrailProfanity'),
        settingsService.get('warRoomGuardrailHallucination'),
        settingsService.get('warRoomLanguage'),
      ]);
      if (wrMode) setWarRoomDefaultMode(wrMode);
      if (wrDepth) setWarRoomAIDepth(wrDepth);
      if (wrStream !== undefined) setWarRoomTokenStreaming(wrStream);
      if (wrThink !== undefined) setWarRoomThinkingPanel(wrThink);
      if (wrAnnot !== undefined) setWarRoomAnnotations(wrAnnot);
      if (wrAgent) setWarRoomDefaultAgent(wrAgent);
      if (wrVoiceMode) setWarRoomVoiceMode(wrVoiceMode);
      if (wrVoiceGender) setWarRoomVoiceGender(wrVoiceGender);
      if (wrGCSafety !== undefined) setWarRoomGuardrailContentSafety(wrGCSafety);
      if (wrGCProfanity !== undefined) setWarRoomGuardrailProfanity(wrGCProfanity);
      if (wrGCHallucination !== undefined) setWarRoomGuardrailHallucination(wrGCHallucination);
      if (wrLang) setWarRoomLanguage(wrLang);
    };
    load();
  }, []);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3><Shield /> War Room</h3>
        <p>Configure default behavior for the War Room.</p>
      </div>

      <SettingsCard className="space-y-6">
        {/* AI Depth */}
        <div>
          <MonoLabel as="label" className="mb-3 block">AI Reasoning Depth</MonoLabel>
          <div className="flex gap-3">
            {(['fast', 'balanced', 'deep'] as const).map((depth) => (
              <button
                key={depth}
                type="button"
                onClick={() => {
                  setWarRoomAIDepth(depth);
                  settingsService.set('warRoomAIDepth', depth);
                }}
                className={`flex-1 py-2 border rounded-lg text-sm font-medium capitalize transition ${
                  warRoomAIDepth === depth
                    ? 'border-rose-500 bg-rose-500/5 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                {depth}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        {/* Visualization Toggles */}
        <ToggleItem
          label="Token Streaming"
          desc="Show tokens appearing in real-time as AI responds"
          active={warRoomTokenStreaming}
          onToggle={() => {
            const v = !warRoomTokenStreaming;
            setWarRoomTokenStreaming(v);
            settingsService.set('warRoomTokenStreaming', v);
          }}
        />
        <ToggleItem
          label="Thinking Panel"
          desc="Display AI reasoning steps in a side panel"
          active={warRoomThinkingPanel}
          onToggle={() => {
            const v = !warRoomThinkingPanel;
            setWarRoomThinkingPanel(v);
            settingsService.set('warRoomThinkingPanel', v);
          }}
        />
        <ToggleItem
          label="Annotations"
          desc="Show inline annotations and source citations"
          active={warRoomAnnotations}
          onToggle={() => {
            const v = !warRoomAnnotations;
            setWarRoomAnnotations(v);
            settingsService.set('warRoomAnnotations', v);
          }}
        />

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        {/* Default Agent */}
        <div>
          <MonoLabel as="label" className="mb-3 block">Default Agent</MonoLabel>
          <select
            value={warRoomDefaultAgent}
            onChange={(e) => {
              setWarRoomDefaultAgent(e.target.value);
              settingsService.set('warRoomDefaultAgent', e.target.value);
            }}
            title="Default War Room agent"
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="general">General</option>
            <option value="skeptic">Skeptic</option>
            <option value="scribe">Scribe</option>
            <option value="deep-diver">Deep Diver</option>
          </select>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        {/* Voice Settings */}
        <div>
          <MonoLabel as="label" className="mb-3 block">Voice Mode</MonoLabel>
          <select
            value={warRoomVoiceMode}
            onChange={(e) => {
              setWarRoomVoiceMode(e.target.value);
              settingsService.set('warRoomVoiceMode', e.target.value);
            }}
            title="Voice interaction mode"
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="push-to-talk">Push-to-Talk</option>
            <option value="always-on">Always On</option>
            <option value="wake-word">Wake Word</option>
          </select>
        </div>

        <div>
          <MonoLabel as="label" className="mb-3 block">Voice Gender</MonoLabel>
          <div className="flex gap-3">
            {(['male', 'female', 'neutral'] as const).map((gender) => (
              <button
                key={gender}
                type="button"
                onClick={() => {
                  setWarRoomVoiceGender(gender);
                  settingsService.set('warRoomVoiceGender', gender);
                }}
                className={`flex-1 py-2 border rounded-lg text-sm font-medium capitalize transition ${
                  warRoomVoiceGender === gender
                    ? 'border-rose-500 bg-rose-500/5 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                {gender}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        {/* Guardrails */}
        <div>
          <MonoLabel as="label" className="mb-3 block">Guardrails</MonoLabel>
        </div>
        <ToggleItem
          label="Content Safety"
          desc="Flag potentially harmful or unsafe content in AI responses"
          active={warRoomGuardrailContentSafety}
          onToggle={() => {
            const v = !warRoomGuardrailContentSafety;
            setWarRoomGuardrailContentSafety(v);
            settingsService.set('warRoomGuardrailContentSafety', v);
          }}
        />
        <ToggleItem
          label="Profanity Filter"
          desc="Filter profane language from AI-generated content"
          active={warRoomGuardrailProfanity}
          onToggle={() => {
            const v = !warRoomGuardrailProfanity;
            setWarRoomGuardrailProfanity(v);
            settingsService.set('warRoomGuardrailProfanity', v);
          }}
        />
        <ToggleItem
          label="Hallucination Detection"
          desc="Highlight responses that may contain unsupported claims"
          active={warRoomGuardrailHallucination}
          onToggle={() => {
            const v = !warRoomGuardrailHallucination;
            setWarRoomGuardrailHallucination(v);
            settingsService.set('warRoomGuardrailHallucination', v);
          }}
        />

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        {/* Advanced */}
        <div>
          <MonoLabel as="label" className="mb-3 block">Advanced</MonoLabel>
          <select
            value={warRoomLanguage}
            onChange={(e) => {
              setWarRoomLanguage(e.target.value);
              settingsService.set('warRoomLanguage', e.target.value);
              i18n.changeLanguage(e.target.value);
            }}
            title="Language preference"
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
            <option value="pt">Portuguese</option>
            <option value="ar">Arabic</option>
            <option value="hi">Hindi</option>
            <option value="ko">Korean</option>
          </select>
        </div>
      </SettingsCard>
    </div>
  );
};

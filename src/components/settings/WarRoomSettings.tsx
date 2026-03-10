import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { settingsService } from '../../services/settingsService';

const ToggleItem = ({ label, desc, active, onToggle }: { label: string; desc: string; active: boolean; onToggle: () => void }) => (
  <div className="flex justify-between items-center group cursor-pointer" onClick={onToggle}>
    <div>
      <div className="dark:text-white text-zinc-900 font-medium text-sm">{label}</div>
      <div className="text-zinc-500 text-xs">{desc}</div>
    </div>
    <button
      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${active ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  </div>
);

export const WarRoomSettings: React.FC = () => {
  const [warRoomDefaultMode, setWarRoomDefaultMode] = useState('command-center');
  const [warRoomAIDepth, setWarRoomAIDepth] = useState<'fast' | 'balanced' | 'deep'>('balanced');
  const [warRoomTokenStreaming, setWarRoomTokenStreaming] = useState(true);
  const [warRoomThinkingPanel, setWarRoomThinkingPanel] = useState(true);
  const [warRoomAnnotations, setWarRoomAnnotations] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [wrMode, wrDepth, wrStream, wrThink, wrAnnot] = await Promise.all([
        settingsService.get('warRoomDefaultMode'),
        settingsService.get('warRoomAIDepth'),
        settingsService.get('warRoomTokenStreaming'),
        settingsService.get('warRoomThinkingPanel'),
        settingsService.get('warRoomAnnotations'),
      ]);
      if (wrMode) setWarRoomDefaultMode(wrMode);
      if (wrDepth) setWarRoomAIDepth(wrDepth);
      if (wrStream !== undefined) setWarRoomTokenStreaming(wrStream);
      if (wrThink !== undefined) setWarRoomThinkingPanel(wrThink);
      if (wrAnnot !== undefined) setWarRoomAnnotations(wrAnnot);
    };
    load();
  }, []);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3><Shield /> War Room</h3>
        <p>Configure default behavior for the War Room workspace.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-6">
        {/* Default Mode */}
        <div>
          <label className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 block">Default Mode</label>
          <select
            value={warRoomDefaultMode}
            onChange={(e) => {
              setWarRoomDefaultMode(e.target.value);
              settingsService.set('warRoomDefaultMode', e.target.value);
            }}
            title="Default War Room mode"
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="command-center">Command Center</option>
            <option value="intel">Intel</option>
            <option value="focus">Focus</option>
            <option value="analyst">Analyst</option>
            <option value="strategist">Strategist</option>
            <option value="brainstorm">Brainstorm</option>
            <option value="debrief">Debrief</option>
          </select>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800"></div>

        {/* AI Depth */}
        <div>
          <label className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 block">AI Reasoning Depth</label>
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
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
      </div>
    </div>
  );
};

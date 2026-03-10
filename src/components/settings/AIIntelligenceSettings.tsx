import React, { useState, useEffect } from 'react';
import { areNotificationsEnabled, enableQuotaNotifications, sendTestNotification } from '../../services/geminiQuotaNotifications';
import { settingsService } from '../../services/settingsService';
import AIHealthMonitor from '../AIHealthMonitor';
import { Bell, Book, Brain, Cpu, Headset, Mic, Play, Sliders, Volume2 } from 'lucide-react';

const ToggleItem = ({
  label,
  desc,
  active,
  onToggle,
}: {
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}) => (
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

export const AIIntelligenceSettings: React.FC = () => {
  // AI model state
  const [primaryAIModel, setPrimaryAIModel] = useState('gemini-2.5-flash');
  const [enableAdvancedReasoning, setEnableAdvancedReasoning] = useState(false);

  // Voice Agent state
  const [agentVoice, setAgentVoice] = useState('nova');
  const [turnDetectionMode, setTurnDetectionMode] = useState<'semantic' | 'server'>('semantic');
  const [voiceActivityEagerness, setVoiceActivityEagerness] = useState('medium');
  const [interactionMode, setInteractionMode] = useState<'vad' | 'ptt'>('vad');

  // Knowledge Base state
  const [defaultSearchScope, setDefaultSearchScope] = useState('current_project');
  const [autoAnalyzeDocs, setAutoAnalyzeDocs] = useState(true);

  // Device state
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  const [deviceError, setDeviceError] = useState(false);
  const [isTestingDevices, setIsTestingDevices] = useState(false);
  const [testStream, setTestStream] = useState<MediaStream | null>(null);

  // Device enumeration on mount
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permission briefly to ensure labels are available
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        // Stop immediately after getting permission
        stream.getTracks().forEach((t) => t.stop());
        setDeviceError(false);

        const devices = await navigator.mediaDevices.enumerateDevices();

        const aIn = devices.filter((d) => d.kind === 'audioinput');
        const aOut = devices.filter((d) => d.kind === 'audiooutput');
        const vIn = devices.filter((d) => d.kind === 'videoinput');

        setAudioInputs(aIn);
        setAudioOutputs(aOut);
        setVideoInputs(vIn);

        // Set defaults if not set
        if (!selectedAudioInput && aIn.length > 0) setSelectedAudioInput(aIn[0].deviceId);
        if (!selectedAudioOutput && aOut.length > 0) setSelectedAudioOutput(aOut[0].deviceId);
        if (!selectedVideoInput && vIn.length > 0) setSelectedVideoInput(vIn[0].deviceId);
      } catch (e) {
        console.error('Error enumerating devices', e);
        setDeviceError(true);
      }
    };

    getDevices();
  }, []);

  // Load AI settings from settingsService on mount
  useEffect(() => {
    const load = async () => {
      const [model, advReasoning, voice, turnMode, eagerness, iMode, searchScope, autoAnalyze] =
        await Promise.all([
          settingsService.get('primaryAIModel'),
          settingsService.get('enableAdvancedReasoning'),
          settingsService.get('agentVoice'),
          settingsService.get('turnDetectionMode'),
          settingsService.get('voiceActivityEagerness'),
          settingsService.get('interactionMode'),
          settingsService.get('defaultSearchScope'),
          settingsService.get('autoAnalyzeDocs'),
        ]);

      if (model) setPrimaryAIModel(model as string);
      if (advReasoning !== undefined) setEnableAdvancedReasoning(advReasoning as boolean);
      if (voice) setAgentVoice(voice as string);
      if (turnMode) setTurnDetectionMode(turnMode as 'semantic' | 'server');
      if (eagerness) setVoiceActivityEagerness(eagerness as string);
      if (iMode) setInteractionMode(iMode as 'vad' | 'ptt');
      if (searchScope) setDefaultSearchScope(searchScope as string);
      if (autoAnalyze !== undefined) setAutoAnalyzeDocs(autoAnalyze as boolean);
    };
    load();
  }, []);

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="section-header">
        <h3>
          <Brain /> AI & Intelligence
        </h3>
        <p>
          Configure the brain of your Pulse workspace. Choose models, voices, and reasoning
          capabilities.
        </p>
      </div>

      {/* AI Health Monitor */}
      <AIHealthMonitor />

      {/* Quota Notifications */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
          <Bell /> Quota Notifications
        </h4>
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Get notified when your Gemini API quota recovers or when fallback mode activates.
          </p>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                const success = await enableQuotaNotifications();
                if (success) {
                  alert("Quota notifications enabled! You'll be notified when Gemini recovers.");
                } else {
                  alert(
                    'Please allow notifications in your browser to enable this feature.'
                  );
                }
              }}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition"
            >
              Enable Notifications
            </button>
            <button
              onClick={async () => {
                const success = await sendTestNotification();
                if (!success) {
                  alert('Please enable notifications first.');
                }
              }}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition"
            >
              Test Notification
            </button>
          </div>
        </div>
      </div>

      {/* General AI */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
          <Cpu /> General AI
        </h4>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-white text-zinc-900">
              Primary AI Model
            </label>
            <select
              value={primaryAIModel}
              onChange={(e) => setPrimaryAIModel(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fastest)</option>
              <option value="gemini-2.0-pro">Gemini 2.0 Pro (Balanced)</option>
              <option value="gpt-4o">GPT-4o (OpenAI)</option>
              <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="perplexity-sonar-small">Perplexity Sonar Small</option>
            </select>
            <p className="text-xs text-zinc-500">
              The default model used for general queries, summaries, and chat.
            </p>
          </div>

          <ToggleItem
            label="Enable Advanced Reasoning"
            desc="Use slower but more powerful models (e.g. Gemini 1.5 Pro) for complex queries in War Room"
            active={enableAdvancedReasoning}
            onToggle={() => setEnableAdvancedReasoning(!enableAdvancedReasoning)}
          />
        </div>
      </div>

      {/* Voice Agent */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
          <Headset /> Voice Agent
        </h4>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-white text-zinc-900">
              Agent Voice
            </label>
            <div className="flex gap-2">
              <select
                value={agentVoice}
                onChange={(e) => {
                  setAgentVoice(e.target.value);
                  localStorage.setItem('pulse_ai_voice_model', e.target.value);
                }}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
              >
                <option value="alloy">Alloy (Neutral)</option>
                <option value="echo">Echo (Male)</option>
                <option value="fable">Fable (Expressive)</option>
                <option value="onyx">Onyx (Deep)</option>
                <option value="nova">Nova (Friendly)</option>
                <option value="shimmer">Shimmer (Soothing)</option>
              </select>
              <button
                onClick={() => {
                  const utterance = new SpeechSynthesisUtterance(
                    'Hello, I am your Pulse AI assistant.'
                  );
                  speechSynthesis.speak(utterance);
                }}
                className="px-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
              >
                <Play />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-white text-zinc-900">
              Turn Detection Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTurnDetectionMode('semantic')}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  turnDetectionMode === 'semantic'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Semantic VAD
                <span className="block text-[10px] font-normal opacity-70 mt-1">
                  Natural conversation flow
                </span>
              </button>
              <button
                onClick={() => setTurnDetectionMode('server')}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  turnDetectionMode === 'server'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Server VAD
                <span className="block text-[10px] font-normal opacity-70 mt-1">
                  Silence-based detection
                </span>
              </button>
            </div>
          </div>

          {turnDetectionMode === 'semantic' && (
            <div className="space-y-2 pl-4 border-l-2 border-blue-100 dark:border-blue-900">
              <label className="text-sm font-medium dark:text-white text-zinc-900">
                Voice Activity Eagerness
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="1"
                value={
                  voiceActivityEagerness === 'low' ? 0 : voiceActivityEagerness === 'medium' ? 1 : 2
                }
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setVoiceActivityEagerness(val === 0 ? 'low' : val === 1 ? 'medium' : 'high');
                }}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Low (Patient)</span>
                <span>Medium (Balanced)</span>
                <span>High (Interrupts)</span>
              </div>
            </div>
          )}

          <ToggleItem
            label="Push-to-Talk Mode"
            desc="Disable voice activity detection and only listen when button is held"
            active={interactionMode === 'ptt'}
            onToggle={() => setInteractionMode(interactionMode === 'ptt' ? 'vad' : 'ptt')}
          />
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
          <Book /> Knowledge Base (RAG)
        </h4>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-white text-zinc-900">
              Default Search Scope
            </label>
            <select
              value={defaultSearchScope}
              onChange={(e) => setDefaultSearchScope(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="current_project">Current Project Context</option>
              <option value="all_projects">All Projects & Knowledge</option>
              <option value="global">Global (Web + Local)</option>
            </select>
          </div>

          <ToggleItem
            label="Auto-Analyze New Documents"
            desc="Automatically generate summaries and extract keywords when uploading files (Uses API credits)"
            active={autoAnalyzeDocs}
            onToggle={() => setAutoAnalyzeDocs(!autoAnalyzeDocs)}
          />
        </div>
      </div>

      {/* Device Selection (Hardware) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
          <Sliders /> Hardware Settings
        </h4>

        <div className="space-y-4">
          {deviceError && (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-2">
              Could not access media devices. Please allow microphone/camera permissions.
            </div>
          )}

          {/* Audio Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Mic /> Microphone
            </label>
            <div className="relative">
              <select
                value={selectedAudioInput}
                onChange={(e) => setSelectedAudioInput(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 pr-10 appearance-none text-sm dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
              >
                {audioInputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.substr(0, 5)}...`}
                  </option>
                ))}
                {audioInputs.length === 0 && <option>No microphones found</option>}
              </select>
            </div>
          </div>

          {/* Audio Output */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Volume2 /> Speaker
            </label>
            <div className="relative">
              <select
                value={selectedAudioOutput}
                onChange={(e) => setSelectedAudioOutput(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2.5 pr-10 appearance-none text-sm dark:text-white text-zinc-900 focus:border-blue-500 focus:outline-none"
              >
                {audioOutputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Speaker ${device.deviceId.substr(0, 5)}...`}
                  </option>
                ))}
                {audioOutputs.length === 0 && <option>Default Speaker</option>}
              </select>
            </div>
          </div>

          {/* Diagnostics Button */}
          <div className="pt-2">
            <button
              onClick={async () => {
                setIsTestingDevices(true);
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({
                    audio: selectedAudioInput ? { deviceId: selectedAudioInput } : true,
                    video: selectedVideoInput ? { deviceId: selectedVideoInput } : true,
                  });
                  setTestStream(stream);
                  alert('Audio/Video Test Successful!');
                  setTimeout(() => {
                    stream.getTracks().forEach((track) => track.stop());
                    setTestStream(null);
                    setIsTestingDevices(false);
                  }, 3000);
                } catch (error) {
                  alert('Device Access Failed');
                  setIsTestingDevices(false);
                }
              }}
              disabled={isTestingDevices}
              className="text-xs font-bold uppercase tracking-wider text-blue-500 hover:text-blue-600 transition"
            >
              {isTestingDevices ? 'Testing...' : 'Test Devices'}
            </button>
          </div>
        </div>
      </div>

      {/* Voxer Settings Deep-Link */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              Voxer Audio & Voice
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              Manage microphone, speaker, and voice recording settings
            </p>
          </div>
          <button
            type="button"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <Sliders />
            Open Voxer Settings
          </button>
        </div>
      </div>
    </div>
  );
};

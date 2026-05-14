// GeneralVoxSettings Component - General Relay preferences

import React, { useState, useEffect } from 'react';
import { Bell, Bot, Brain, ChevronDown, Mic, Play, Radio, Settings2, Vibrate, Wand2 } from 'lucide-react';
import { settingsService, PulseSettings } from '../../../services/settingsService';

interface GeneralVoxSettingsProps {
  isDarkMode?: boolean;
  accentColor?: string;
}

// The six peers the Relay shell renders. Mirrors `RelayView` in Relay.tsx;
// kept local so this file doesn't reach into the shell for a type. If a peer
// is ever added/removed, both lists update.
type RelayView = 'triage' | 'direct' | 'channel' | 'broadcast' | 'notes' | 'live';

const RELAY_VIEW_OPTIONS: { id: RelayView; name: string; hint: string }[] = [
  { id: 'triage', name: 'Triage', hint: 'What needs me now' },
  { id: 'direct', name: 'Direct', hint: '1:1 voice with a Pulse contact' },
  { id: 'channel', name: 'Channel', hint: 'Team voice in a workspace channel' },
  { id: 'broadcast', name: 'Broadcast', hint: 'Public channels and discussions' },
  { id: 'notes', name: 'Notes', hint: 'Personal voice notes' },
  { id: 'live', name: 'Live', hint: 'Persistent voice rooms' },
];

export const GeneralVoxSettings: React.FC<GeneralVoxSettingsProps> = ({
  isDarkMode = false,
  accentColor = '#f43f5e',
}) => {
  const [defaultView, setDefaultView] = useState<RelayView>('triage');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [realtimeTranscription, setRealtimeTranscription] = useState(true);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [autoFeedback, setAutoFeedback] = useState(true);
  const [autoPlayIncoming, setAutoPlayIncoming] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [autoEnhance, setAutoEnhance] = useState(true);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await settingsService.getAll();
      setDefaultView(settings.relayDefaultView ?? 'triage');
      setNotificationsEnabled(settings.voxNotificationsEnabled ?? true);
      setAutoTranscribe(settings.autoTranscribe ?? true);
      setRealtimeTranscription(settings.voxRealtimeTranscription ?? true);
      setAutoAnalyze(settings.voxAutoAnalyze ?? true);
      setAutoFeedback(settings.voxAutoFeedback ?? true);
      setAutoPlayIncoming(settings.voxAutoPlayIncoming ?? false);
      setHapticsEnabled(settings.voxHapticsEnabled ?? true);
      setAutoEnhance(settings.voxAutoEnhance ?? true);
    };
    loadSettings();
  }, []);

  const saveSetting = async <K extends keyof PulseSettings>(key: K, value: PulseSettings[K]) => {
    await settingsService.set(key, value);
  };

  const tc = {
    bg: isDarkMode ? 'bg-white/[0.03]' : 'bg-white/80',
    cardBg: isDarkMode ? 'bg-white/[0.03]' : 'bg-gray-50/80',
    border: isDarkMode ? 'border-[rgba(255,255,255,0.06)]' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    inputBg: isDarkMode ? 'bg-white/[0.055]' : 'bg-white',
    hoverBg: isDarkMode ? 'hover:bg-white/[0.055]' : 'hover:bg-gray-100/80',
  };

  // Helper text for the currently-selected view shows beneath the dropdown,
  // so the picker reads as "view + what that view is for" without inflating
  // each <option> with descriptions browsers truncate.
  const selectedHint =
    RELAY_VIEW_OPTIONS.find((opt) => opt.id === defaultView)?.hint ??
    'What needs me now';

  return (
    <div className="space-y-6">
      {/* Default landing view */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <Radio className="w-4 h-4" style={{ color: accentColor }} />
          Default landing view
        </label>
        <div className="relative">
          <select
            value={defaultView}
            onChange={(e) => {
              const value = e.target.value as RelayView;
              setDefaultView(value);
              saveSetting('relayDefaultView', value);
            }}
            className={`w-full px-4 py-3 pr-10 rounded-xl border ${tc.border} ${tc.inputBg} ${tc.text} appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2`}
          >
            {RELAY_VIEW_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${tc.textMuted} pointer-events-none`} />
        </div>
        <p className={`text-xs ${tc.textMuted}`}>
          {selectedHint} — Relay opens here on launch.
        </p>
      </div>

      {/* Toggle Options */}
      <div className="space-y-3">
        <label className={`text-sm font-medium ${tc.text}`}>Preferences</label>
        <div className={`rounded-xl border ${tc.border} ${tc.cardBg} divide-y ${isDarkMode ? 'divide-[rgba(255,255,255,0.06)]' : 'divide-gray-200/60'}`}>

          {/* Notifications */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.cardBg} border ${tc.border}`}
              >
                <Bell className={`w-5 h-5 ${tc.textSecondary}`} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Voice notifications</span>
                <p className={`text-xs ${tc.textMuted}`}>Get notified for new voice messages</p>
              </div>
            </div>
            <button
              onClick={() => {
                setNotificationsEnabled(!notificationsEnabled);
                saveSetting('voxNotificationsEnabled', !notificationsEnabled);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                notificationsEnabled ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={notificationsEnabled ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Auto Transcribe */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.cardBg} border ${tc.border}`}
              >
                <Mic className={`w-5 h-5 ${tc.textSecondary}`} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Auto-Transcribe</span>
                <p className={`text-xs ${tc.textMuted}`}>Automatically transcribe voice messages</p>
              </div>
            </div>
            <button
              onClick={() => {
                setAutoTranscribe(!autoTranscribe);
                saveSetting('autoTranscribe', !autoTranscribe);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                autoTranscribe ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={autoTranscribe ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  autoTranscribe ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Real-time Transcription */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.cardBg} border ${tc.border}`}
              >
                <Mic className={`w-5 h-5 ${tc.textSecondary}`} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Live Transcription</span>
                <p className={`text-xs ${tc.textMuted}`}>See words as you speak (browser-based)</p>
              </div>
            </div>
            <button
              onClick={() => {
                setRealtimeTranscription(!realtimeTranscription);
                saveSetting('voxRealtimeTranscription', !realtimeTranscription);
                // Also update localStorage for immediate effect
                localStorage.setItem('voxer_realtime_transcription', JSON.stringify(!realtimeTranscription));
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                realtimeTranscription ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={realtimeTranscription ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  realtimeTranscription ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Auto AI Analysis */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.cardBg} border ${tc.border}`}
              >
                <Brain className={`w-5 h-5 ${tc.textSecondary}`} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Auto-Analyze</span>
                <p className={`text-xs ${tc.textMuted}`}>AI analysis with summaries & action items</p>
              </div>
            </div>
            <button
              onClick={() => {
                setAutoAnalyze(!autoAnalyze);
                saveSetting('voxAutoAnalyze', !autoAnalyze);
                // Also update localStorage for immediate effect
                localStorage.setItem('voxer_auto_analyze', JSON.stringify(!autoAnalyze));
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                autoAnalyze ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={autoAnalyze ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  autoAnalyze ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Auto AI Feedback */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.cardBg} border ${tc.border}`}
              >
                <Bot className={`w-5 h-5 ${tc.textSecondary}`} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Pre-Send AI Review</span>
                <p className={`text-xs ${tc.textMuted}`}>Get feedback before sending messages</p>
              </div>
            </div>
            <button
              onClick={() => {
                setAutoFeedback(!autoFeedback);
                saveSetting('voxAutoFeedback', !autoFeedback);
                // Also update localStorage for immediate effect
                localStorage.setItem('voxer_auto_feedback', JSON.stringify(!autoFeedback));
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                autoFeedback ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={autoFeedback ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  autoFeedback ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Auto Play */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.cardBg} border ${tc.border}`}
              >
                <Play className={`w-5 h-5 ${tc.textSecondary}`} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Auto-Play Incoming</span>
                <p className={`text-xs ${tc.textMuted}`}>Automatically play new voice messages</p>
              </div>
            </div>
            <button
              onClick={() => {
                setAutoPlayIncoming(!autoPlayIncoming);
                saveSetting('voxAutoPlayIncoming', !autoPlayIncoming);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                autoPlayIncoming ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={autoPlayIncoming ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  autoPlayIncoming ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Audio Enhancement */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.cardBg} border ${tc.border}`}
              >
                <Wand2 className={`w-5 h-5 ${tc.textSecondary}`} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Auto-Enhance Audio</span>
                <p className={`text-xs ${tc.textMuted}`}>AI noise reduction & clarity boost</p>
              </div>
            </div>
            <button
              onClick={() => {
                setAutoEnhance(!autoEnhance);
                saveSetting('voxAutoEnhance', !autoEnhance);
                // Also update localStorage for immediate effect
                localStorage.setItem('voxer_auto_enhance', JSON.stringify(!autoEnhance));
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                autoEnhance ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={autoEnhance ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  autoEnhance ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Haptics */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.cardBg} border ${tc.border}`}
              >
                <Vibrate className={`w-5 h-5 ${tc.textSecondary}`} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Haptic Feedback</span>
                <p className={`text-xs ${tc.textMuted}`}>Vibrate on record start/stop</p>
              </div>
            </div>
            <button
              onClick={() => {
                setHapticsEnabled(!hapticsEnabled);
                saveSetting('voxHapticsEnabled', !hapticsEnabled);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                hapticsEnabled ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={hapticsEnabled ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Info Card — neutral surface (was a decorative coral gradient). The
          message is informational, not a CTA. */}
      <div className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg}`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tc.cardBg} border ${tc.border}`}>
            <Settings2 className={`w-4 h-4 ${tc.textSecondary}`} />
          </div>
          <div>
            <h4 className={`font-medium ${tc.text} text-sm`}>More Settings</h4>
            <p className={`text-xs ${tc.textMuted} mt-0.5`}>
              Additional voice and audio settings can be found in the main Settings page under "Audio & Video".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralVoxSettings;

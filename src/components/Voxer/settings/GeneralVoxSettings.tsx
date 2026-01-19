// GeneralVoxSettings Component - General Voxer preferences
// "Control Room" aesthetic

import React, { useState, useEffect } from 'react';
import {
  Settings2,
  Bell,
  Sparkles,
  Vibrate,
  Play,
  Radio,
  ChevronDown,
} from 'lucide-react';
import { settingsService, PulseSettings } from '../../../services/settingsService';
import { VOX_MODES } from '../../../services/voxer/voxModeTypes';

interface GeneralVoxSettingsProps {
  isDarkMode?: boolean;
  accentColor?: string;
}

export const GeneralVoxSettings: React.FC<GeneralVoxSettingsProps> = ({
  isDarkMode = false,
  accentColor = '#8B5CF6',
}) => {
  const [defaultMode, setDefaultMode] = useState<string | null>(null);
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
      setDefaultMode(settings.voxDefaultMode ?? null);
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
    bg: isDarkMode ? 'bg-gray-900/60' : 'bg-white/80',
    cardBg: isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50/80',
    border: isDarkMode ? 'border-gray-700/50' : 'border-gray-200/60',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    textMuted: isDarkMode ? 'text-gray-500' : 'text-gray-400',
    inputBg: isDarkMode ? 'bg-gray-800/80' : 'bg-white',
    hoverBg: isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/80',
  };

  // Mode options for dropdown
  const modeOptions = [
    { id: null, name: 'Classic Voxer', icon: '📱' },
    ...Object.values(VOX_MODES).map(mode => ({
      id: mode.id,
      name: mode.name,
      icon: mode.icon,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Default Mode Selection */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <Radio className="w-4 h-4" style={{ color: accentColor }} />
          Default Vox Mode
        </label>
        <div className="relative">
          <select
            value={defaultMode || ''}
            onChange={(e) => {
              const value = e.target.value || null;
              setDefaultMode(value);
              saveSetting('voxDefaultMode', value);
            }}
            className={`w-full px-4 py-3 pr-10 rounded-xl border ${tc.border} ${tc.inputBg} ${tc.text} appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2`}
          >
            {modeOptions.map((mode) => (
              <option key={mode.id ?? 'classic'} value={mode.id ?? ''}>
                {mode.icon} {mode.name}
              </option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${tc.textMuted} pointer-events-none`} />
        </div>
        <p className={`text-xs ${tc.textMuted}`}>
          The mode that opens when you launch Voxer
        </p>
      </div>

      {/* Toggle Options */}
      <div className="space-y-3">
        <label className={`text-sm font-medium ${tc.text}`}>Preferences</label>
        <div className={`rounded-xl border ${tc.border} ${tc.cardBg} divide-y ${isDarkMode ? 'divide-gray-700/50' : 'divide-gray-200/60'}`}>

          {/* Notifications */}
          <label className="flex items-center justify-between p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor}20` }}
              >
                <Bell className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <div>
                <span className={`font-medium ${tc.text}`}>Vox Notifications</span>
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
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor}20` }}
              >
                <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
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
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor}20` }}
              >
                <i className="fa-solid fa-microphone-lines text-lg" style={{ color: accentColor }}></i>
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
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor}20` }}
              >
                <i className="fa-solid fa-brain text-lg" style={{ color: accentColor }}></i>
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
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor}20` }}
              >
                <i className="fa-solid fa-robot text-lg" style={{ color: accentColor }}></i>
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
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor}20` }}
              >
                <Play className="w-5 h-5" style={{ color: accentColor }} />
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
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor}20` }}
              >
                <i className="fa-solid fa-wand-magic-sparkles text-lg" style={{ color: accentColor }}></i>
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
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accentColor}20` }}
              >
                <Vibrate className="w-5 h-5" style={{ color: accentColor }} />
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

      {/* Info Card */}
      <div
        className={`p-4 rounded-xl border ${tc.border}`}
        style={{
          background: isDarkMode
            ? `linear-gradient(135deg, ${accentColor}08 0%, transparent 50%)`
            : `linear-gradient(135deg, ${accentColor}05 0%, transparent 50%)`
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}20` }}
          >
            <Settings2 className="w-4 h-4" style={{ color: accentColor }} />
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

// AudioIOSettings Component - Audio input/output device configuration
// "Control Room" aesthetic - professional broadcast studio feel

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Volume2,
  Sliders,
  Waves,
  Radio,
  CheckCircle2,
  ChevronDown,
  Gauge,
} from 'lucide-react';
import { useMediaDevices } from '../../../hooks/useMediaDevices';
import { settingsService, PulseSettings } from '../../../services/settingsService';
import { AUDIO_QUALITY_PRESETS } from '../../../hooks/useVoxRecording';
import MicrophoneTest from './MicrophoneTest';

interface AudioIOSettingsProps {
  isDarkMode?: boolean;
  accentColor?: string;
}

const QUALITY_PRESETS = [
  {
    id: 'voice_hd',
    name: 'HD Quality',
    description: 'Crystal clear audio, minimal processing',
    specs: '48kHz • 128kbps',
    icon: Waves,
  },
  {
    id: 'voice_balanced',
    name: 'Balanced',
    description: 'Great quality with noise reduction',
    specs: '44.1kHz • 96kbps',
    icon: Radio,
  },
  {
    id: 'voice_low',
    name: 'Low Bandwidth',
    description: 'Optimized for slow connections',
    specs: '22kHz • 32kbps',
    icon: Gauge,
  },
];

export const AudioIOSettings: React.FC<AudioIOSettingsProps> = ({
  isDarkMode = false,
  accentColor = '#8B5CF6',
}) => {
  const { audioInputs, audioOutputs, isLoading, hasPermission, requestPermission } = useMediaDevices();

  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [audioQuality, setAudioQuality] = useState<'voice_hd' | 'voice_balanced' | 'voice_low'>('voice_hd');
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [autoGain, setAutoGain] = useState(false);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [micGain, setMicGain] = useState(100);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await settingsService.getAll();
      setSelectedMic(settings.voxMicrophoneDeviceId || '');
      setSelectedSpeaker(settings.voxSpeakerDeviceId || '');
      setAudioQuality(settings.voxAudioQuality || 'voice_hd');
      setNoiseReduction(settings.voxNoiseReduction ?? false);
      setAutoGain(settings.voxAutoGainControl ?? false);
      setEchoCancellation(settings.voxEchoCancellation ?? true);
      setMicGain(settings.microphoneGain ?? 100);
    };
    loadSettings();
  }, []);

  // Save settings on change
  const saveSetting = async <K extends keyof PulseSettings>(key: K, value: PulseSettings[K]) => {
    await settingsService.set(key, value);
  };

  const handleMicChange = (deviceId: string) => {
    setSelectedMic(deviceId);
    saveSetting('voxMicrophoneDeviceId', deviceId);
  };

  const handleSpeakerChange = (deviceId: string) => {
    setSelectedSpeaker(deviceId);
    saveSetting('voxSpeakerDeviceId', deviceId);
  };

  const handleQualityChange = (quality: 'voice_hd' | 'voice_balanced' | 'voice_low') => {
    setAudioQuality(quality);
    saveSetting('voxAudioQuality', quality);

    // Apply preset defaults
    const preset = AUDIO_QUALITY_PRESETS[quality];
    if (preset) {
      setNoiseReduction(preset.noiseSuppression);
      setAutoGain(preset.autoGainControl);
      setEchoCancellation(preset.echoCancellation);
      saveSetting('voxNoiseReduction', preset.noiseSuppression);
      saveSetting('voxAutoGainControl', preset.autoGainControl);
      saveSetting('voxEchoCancellation', preset.echoCancellation);
    }
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

  return (
    <div className="space-y-6">
      {/* Permission Request */}
      {!hasPermission && (
        <div
          className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg}`}
          style={{
            background: isDarkMode
              ? `linear-gradient(135deg, ${accentColor}10 0%, transparent 50%)`
              : `linear-gradient(135deg, ${accentColor}08 0%, transparent 50%)`
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${accentColor}20` }}
            >
              <Mic className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h4 className={`font-semibold ${tc.text}`}>Microphone Access Required</h4>
              <p className={`text-sm ${tc.textSecondary}`}>
                Allow access to see your audio devices
              </p>
            </div>
          </div>
          <button
            onClick={() => requestPermission('audio')}
            className="w-full px-4 py-2.5 rounded-lg font-medium text-white transition-all"
            style={{
              background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
              boxShadow: `0 4px 14px ${accentColor}30`,
            }}
          >
            Grant Permission
          </button>
        </div>
      )}

      {/* Microphone Selection */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <Mic className="w-4 h-4" style={{ color: accentColor }} />
          Microphone Input
        </label>
        <div className="relative">
          <select
            value={selectedMic}
            onChange={(e) => handleMicChange(e.target.value)}
            disabled={isLoading || !hasPermission}
            className={`w-full px-4 py-3 pr-10 rounded-xl border ${tc.border} ${tc.inputBg} ${tc.text} appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2`}
            style={{ focusRingColor: accentColor }}
          >
            <option value="">Default Microphone</option>
            {audioInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${tc.textMuted} pointer-events-none`} />
        </div>
      </div>

      {/* Speaker Selection */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <Volume2 className="w-4 h-4" style={{ color: accentColor }} />
          Speaker Output
        </label>
        <div className="relative">
          <select
            value={selectedSpeaker}
            onChange={(e) => handleSpeakerChange(e.target.value)}
            disabled={isLoading || !hasPermission}
            className={`w-full px-4 py-3 pr-10 rounded-xl border ${tc.border} ${tc.inputBg} ${tc.text} appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2`}
          >
            <option value="">Default Speaker</option>
            {audioOutputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 ${tc.textMuted} pointer-events-none`} />
        </div>
      </div>

      {/* Audio Quality Presets */}
      <div className="space-y-3">
        <label className={`flex items-center gap-2 text-sm font-medium ${tc.text}`}>
          <Sliders className="w-4 h-4" style={{ color: accentColor }} />
          Audio Quality
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUALITY_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = audioQuality === preset.id;

            return (
              <button
                key={preset.id}
                onClick={() => handleQualityChange(preset.id as typeof audioQuality)}
                className={`relative p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? ''
                    : `${tc.border} ${tc.cardBg} ${tc.hoverBg}`
                }`}
                style={isSelected ? {
                  background: `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}05 100%)`,
                  borderColor: `${accentColor}50`,
                  boxShadow: `0 0 20px ${accentColor}15`,
                } : undefined}
              >
                {isSelected && (
                  <CheckCircle2
                    className="absolute top-3 right-3 w-4 h-4"
                    style={{ color: accentColor }}
                  />
                )}
                <Icon
                  className="w-5 h-5 mb-2"
                  style={{ color: isSelected ? accentColor : tc.textMuted.replace('text-', '') }}
                />
                <h4 className={`font-semibold text-sm ${tc.text}`}>{preset.name}</h4>
                <p className={`text-xs ${tc.textMuted} mt-0.5`}>{preset.description}</p>
                <p
                  className="text-[10px] font-mono mt-2 uppercase tracking-wider"
                  style={{ color: isSelected ? accentColor : tc.textMuted.replace('text-', '') }}
                >
                  {preset.specs}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Processing Options */}
      <div className="space-y-3">
        <label className={`text-sm font-medium ${tc.text}`}>Audio Processing</label>
        <div className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg} space-y-4`}>
          {/* Echo Cancellation */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className={`font-medium ${tc.text}`}>Echo Cancellation</span>
              <p className={`text-xs ${tc.textMuted}`}>Reduces echo from speakers</p>
            </div>
            <button
              onClick={() => {
                setEchoCancellation(!echoCancellation);
                saveSetting('voxEchoCancellation', !echoCancellation);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                echoCancellation ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={echoCancellation ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  echoCancellation ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Noise Reduction */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className={`font-medium ${tc.text}`}>Noise Reduction</span>
              <p className={`text-xs ${tc.textMuted}`}>Filters background noise</p>
            </div>
            <button
              onClick={() => {
                setNoiseReduction(!noiseReduction);
                saveSetting('voxNoiseReduction', !noiseReduction);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                noiseReduction ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={noiseReduction ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  noiseReduction ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          {/* Auto Gain */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className={`font-medium ${tc.text}`}>Auto Gain Control</span>
              <p className={`text-xs ${tc.textMuted}`}>Automatically adjusts volume</p>
            </div>
            <button
              onClick={() => {
                setAutoGain(!autoGain);
                saveSetting('voxAutoGainControl', !autoGain);
              }}
              className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 ${
                autoGain ? '' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={autoGain ? { background: accentColor } : undefined}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  autoGain ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Microphone Gain Slider */}
      <div className="space-y-3">
        <label className={`flex items-center justify-between text-sm font-medium ${tc.text}`}>
          <span className="flex items-center gap-2">
            <Gauge className="w-4 h-4" style={{ color: accentColor }} />
            Microphone Gain
          </span>
          <span className="font-mono text-xs" style={{ color: accentColor }}>{micGain}%</span>
        </label>
        <div className={`p-4 rounded-xl border ${tc.border} ${tc.cardBg}`}>
          <input
            type="range"
            min="0"
            max="200"
            value={micGain}
            onChange={(e) => {
              const value = Number(e.target.value);
              setMicGain(value);
              saveSetting('microphoneGain', value);
            }}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${micGain / 2}%, ${isDarkMode ? '#374151' : '#e5e7eb'} ${micGain / 2}%, ${isDarkMode ? '#374151' : '#e5e7eb'} 100%)`,
            }}
          />
          <div className="flex justify-between mt-2">
            <span className={`text-xs ${tc.textMuted}`}>Quiet</span>
            <span className={`text-xs ${tc.textMuted}`}>Normal</span>
            <span className={`text-xs ${tc.textMuted}`}>Loud</span>
          </div>
        </div>
      </div>

      {/* Microphone Test */}
      <MicrophoneTest
        deviceId={selectedMic || undefined}
        isDarkMode={isDarkMode}
        accentColor={accentColor}
      />
    </div>
  );
};

export default AudioIOSettings;

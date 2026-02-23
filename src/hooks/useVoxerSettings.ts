// useVoxerSettings - User preferences and settings state management
// Manages audio/video settings, AI preferences, and recording modes

import { useState, useEffect } from 'react';

type VideoQuality = '480p' | '720p' | '1080p';

export interface VoxerSettingsState {
  // Recording Mode
  mode: 'audio' | 'video';
  setMode: React.Dispatch<React.SetStateAction<'audio' | 'video'>>;
  recordingMode: 'hold' | 'tap';
  setRecordingMode: React.Dispatch<React.SetStateAction<'hold' | 'tap'>>;
  videoQuality: VideoQuality;
  setVideoQuality: React.Dispatch<React.SetStateAction<VideoQuality>>;

  // Audio Processing Settings
  noiseSuppression: boolean;
  setNoiseSuppression: React.Dispatch<React.SetStateAction<boolean>>;
  echoCancellation: boolean;
  setEchoCancellation: React.Dispatch<React.SetStateAction<boolean>>;
  autoGainControl: boolean;
  setAutoGainControl: React.Dispatch<React.SetStateAction<boolean>>;

  // Device Selection
  selectedAudioInput: string;
  setSelectedAudioInput: React.Dispatch<React.SetStateAction<string>>;
  selectedVideoInput: string;
  setSelectedVideoInput: React.Dispatch<React.SetStateAction<string>>;

  // Playback Settings
  playbackSpeed: number;
  setPlaybackSpeed: React.Dispatch<React.SetStateAction<number>>;

  // AI Settings (with localStorage persistence)
  autoAnalyzeEnabled: boolean;
  setAutoAnalyzeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  autoFeedbackEnabled: boolean;
  setAutoFeedbackEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  autoEnhanceEnabled: boolean;
  setAutoEnhanceEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  // Realtime Transcription (with localStorage persistence)
  isRealtimeActive: boolean;
  setIsRealtimeActive: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Custom hook for managing Voxer user settings and preferences
 * Includes localStorage persistence for AI settings and realtime transcription
 */
export function useVoxerSettings(): VoxerSettingsState {
  // Recording Mode
  const [mode, setMode] = useState<'audio' | 'video'>('audio');
  const [recordingMode, setRecordingMode] = useState<'hold' | 'tap'>('hold');
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('720p');

  // Audio Processing Settings
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);

  // Device Selection
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');

  // Playback Settings
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // AI Settings (with localStorage persistence)
  const [autoAnalyzeEnabled, setAutoAnalyzeEnabled] = useState(() => {
    const saved = localStorage.getItem('voxer_auto_analyze');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });

  const [autoFeedbackEnabled, setAutoFeedbackEnabled] = useState(() => {
    const saved = localStorage.getItem('voxer_auto_feedback');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });

  const [autoEnhanceEnabled, setAutoEnhanceEnabled] = useState(() => {
    const saved = localStorage.getItem('voxer_auto_enhance');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });

  // Realtime Transcription (with localStorage persistence)
  const [isRealtimeActive, setIsRealtimeActive] = useState(() => {
    const saved = localStorage.getItem('voxer_realtime_transcription');
    return saved ? JSON.parse(saved) : true; // Enabled by default
  });

  // Persist AI settings to localStorage
  useEffect(() => {
    localStorage.setItem('voxer_auto_analyze', JSON.stringify(autoAnalyzeEnabled));
  }, [autoAnalyzeEnabled]);

  useEffect(() => {
    localStorage.setItem('voxer_auto_feedback', JSON.stringify(autoFeedbackEnabled));
  }, [autoFeedbackEnabled]);

  useEffect(() => {
    localStorage.setItem('voxer_auto_enhance', JSON.stringify(autoEnhanceEnabled));
  }, [autoEnhanceEnabled]);

  useEffect(() => {
    localStorage.setItem('voxer_realtime_transcription', JSON.stringify(isRealtimeActive));
  }, [isRealtimeActive]);

  return {
    // Recording Mode
    mode,
    setMode,
    recordingMode,
    setRecordingMode,
    videoQuality,
    setVideoQuality,

    // Audio Processing Settings
    noiseSuppression,
    setNoiseSuppression,
    echoCancellation,
    setEchoCancellation,
    autoGainControl,
    setAutoGainControl,

    // Device Selection
    selectedAudioInput,
    setSelectedAudioInput,
    selectedVideoInput,
    setSelectedVideoInput,

    // Playback Settings
    playbackSpeed,
    setPlaybackSpeed,

    // AI Settings
    autoAnalyzeEnabled,
    setAutoAnalyzeEnabled,
    autoFeedbackEnabled,
    setAutoFeedbackEnabled,
    autoEnhanceEnabled,
    setAutoEnhanceEnabled,

    // Realtime Transcription
    isRealtimeActive,
    setIsRealtimeActive,
  };
}

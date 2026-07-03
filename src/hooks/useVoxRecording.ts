import { useState, useRef, useCallback, useEffect } from 'react';
import { voxModeService } from '../services/relay/voxModeService';

export type RecordingState = 'idle' | 'recording' | 'preview' | 'analyzing';

export interface RecordingData {
  blob: Blob;
  url: string;
  duration: number;
  audioBuffer?: AudioBuffer;
}

export interface AudioQualityPreset {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  bitrate?: number;
}

// Audio quality presets for different use cases
export const AUDIO_QUALITY_PRESETS: Record<string, AudioQualityPreset> = {
  // High quality for voice - clear speech with minimal processing
  voice_hd: {
    sampleRate: 48000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: false, // Disabled - can cause muffled sound
    autoGainControl: false,  // Disabled - can cause pumping artifacts
    bitrate: 128000,
  },
  // Balanced quality - good clarity with some noise reduction
  voice_balanced: {
    sampleRate: 44100,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    bitrate: 96000,
  },
  // Low bandwidth - for poor connections
  voice_low: {
    sampleRate: 22050,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    bitrate: 32000,
  },
};

export interface UseVoxRecordingOptions {
  onRecordingComplete?: (data: RecordingData) => void;
  onAnalysisComplete?: (transcript: string, analysis: any) => void;
  maxDuration?: number; // Max recording duration in seconds
  autoAnalyze?: boolean; // Automatically analyze after recording
  qualityPreset?: keyof typeof AUDIO_QUALITY_PRESETS;
  customAudioConstraints?: Partial<AudioQualityPreset>;
  defaultRecordingMode?: 'hold' | 'tap'; // Default recording mode
  onModeChange?: (mode: 'hold' | 'tap') => void; // Callback when mode changes
  deviceId?: string; // Specific audio input device ID from settings
  // When true (default), the dashboard-wide `quick_vox_status.is_recording`
  // flag is flipped on/off so the Relay glance tile + presence subscribers
  // can render a truthful LIVE state across every recording surface.
  publishStatus?: boolean;
}

export interface UseVoxRecordingReturn {
  state: RecordingState;
  duration: number;
  analyser: AnalyserNode | null;
  recordingData: RecordingData | null;
  recordingMode: 'hold' | 'tap';
  setRecordingMode: (mode: 'hold' | 'tap') => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  sendRecording: () => void;
  analyzeRecording: () => Promise<void>;
  handlePointerDown: () => void; // For hold mode - start on pointer down
  handlePointerUp: () => void; // For hold mode - stop on pointer up
  handleToggleRecording: () => void; // For tap mode - toggle recording on/off
}

export function useVoxRecording(options: UseVoxRecordingOptions = {}): UseVoxRecordingReturn {
  const {
    onRecordingComplete,
    onAnalysisComplete,
    maxDuration = 300, // 5 minutes default
    autoAnalyze = false,
    qualityPreset = 'voice_hd', // Default to high quality
    customAudioConstraints,
    defaultRecordingMode,
    onModeChange,
    deviceId,
    publishStatus = true,
  } = options;

  // Load recording mode from localStorage or use default
  const getInitialRecordingMode = (): 'hold' | 'tap' => {
    if (defaultRecordingMode) return defaultRecordingMode;
    const saved = localStorage.getItem('voxer_recording_mode');
    return (saved === 'tap' || saved === 'hold') ? saved : 'hold';
  };

  // Get audio settings from preset, with custom overrides
  const audioSettings: AudioQualityPreset = {
    ...AUDIO_QUALITY_PRESETS[qualityPreset],
    ...customAudioConstraints,
  };

  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [recordingData, setRecordingData] = useState<RecordingData | null>(null);
  const [recordingMode, setRecordingModeState] = useState<'hold' | 'tap'>(getInitialRecordingMode);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    // Stop and cleanup media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Clear interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Clear refs
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setAnalyser(null);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      cleanup(); // Ensure clean state

      // Request microphone access with high-quality audio constraints.
      // channelCount is `ideal`, NOT `exact`: mono is a preference, but a device
      // that can't honor an EXACT channel count throws OverconstrainedError and
      // kills the recording outright. `ideal` degrades (stereo capture) instead
      // of dying — hardening for mobile / odd input devices.
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: { ideal: audioSettings.sampleRate },
        channelCount: { ideal: audioSettings.channelCount },
        echoCancellation: { ideal: audioSettings.echoCancellation },
        noiseSuppression: { ideal: audioSettings.noiseSuppression },
        autoGainControl: { ideal: audioSettings.autoGainControl },
      };
      // Use specific device if provided via settings
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      streamRef.current = stream;

      // Setup AudioContext with matching sample rate for visualization.
      // Forcing a sampleRate that the hardware/browser can't provide throws on
      // some devices (notably older Safari / certain Android WebViews) — which
      // would kill capture. Try the matched rate, then fall back to a default
      // context so the analyser (visualisation only) never blocks recording.
      let audioContext: AudioContext;
      try {
        audioContext = new AudioContext({ sampleRate: audioSettings.sampleRate });
      } catch {
        audioContext = new AudioContext();
      }
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.8;
      source.connect(analyserNode);
      setAnalyser(analyserNode);

      // Determine best codec - Opus provides best voice quality
      // Priority: Opus > WebM > MP4
      let mimeType: string;
      let codecBitrate = audioSettings.bitrate || 128000;

      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = 'audio/webm'; // Fallback
      }

      // Setup MediaRecorder with bitrate for better quality
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: codecBitrate,
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (chunksRef.current.length === 0) {
          cleanup();
          setState('idle');
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const finalDuration = (Date.now() - startTimeRef.current) / 1000;

        // Decode audio for waveform display
        let audioBuffer: AudioBuffer | undefined;
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const tempContext = new AudioContext();
          audioBuffer = await tempContext.decodeAudioData(arrayBuffer);
          tempContext.close();
        } catch (e) {
          // Waveform generation is non-critical; continue without it
        }

        const data: RecordingData = {
          blob,
          url,
          duration: finalDuration,
          audioBuffer,
        };

        setRecordingData(data);
        cleanup();

        if (autoAnalyze) {
          setState('analyzing');
          // Trigger analysis here if needed
        } else {
          setState('preview');
        }

        onRecordingComplete?.(data);
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();
      setState('recording');
      setDuration(0);

      // Duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        // Auto-stop if max duration reached
        if (elapsed >= maxDuration && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 100);

    } catch (error) {
      console.error('Error starting recording:', error);
      cleanup();
      setState('idle');
      throw error;
    }
  }, [cleanup, maxDuration, autoAnalyze, onRecordingComplete, audioSettings]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    // Stop and discard
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      chunksRef.current = []; // Clear chunks before stop
      mediaRecorderRef.current.stop();
    }

    // Revoke URL if exists
    if (recordingData?.url) {
      URL.revokeObjectURL(recordingData.url);
    }

    cleanup();
    setRecordingData(null);
    setDuration(0);
    setState('idle');
  }, [cleanup, recordingData]);

  const sendRecording = useCallback(() => {
    // Reset state but keep data for caller to use
    setState('idle');
    setDuration(0);
    // Don't clear recordingData - let caller use it
  }, []);

  const analyzeRecording = useCallback(async () => {
    if (!recordingData) return;

    setState('analyzing');

    try {
      // Here you would call your transcription/analysis service
      // For now, just simulate with a delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock analysis result
      const transcript = 'Transcript would appear here...';
      const analysis = { sentiment: 'neutral', topics: [] };

      onAnalysisComplete?.(transcript, analysis);
      setState('preview');
    } catch (error) {
      console.error('Error analyzing recording:', error);
      setState('preview');
    }
  }, [recordingData, onAnalysisComplete]);

  // Mirror recording state to the dashboard-wide `quick_vox_status` flag so the
  // Relay glance tile and any other presence subscribers reflect the truth
  // across every mode (Quick / Team / Drop / Notes / Threads / Radio / Classic
  // composer). Best-effort writes; presence-table failures must not block
  // recording. We also flip false on unmount and pagehide so a closed tab
  // doesn't leave the flag stuck.
  const wasLiveRef = useRef(false);
  useEffect(() => {
    if (!publishStatus) return;
    const isLive = state === 'recording';
    if (isLive === wasLiveRef.current) return;
    wasLiveRef.current = isLive;
    voxModeService.updateQuickVoxStatus(isLive).catch(() => {});
  }, [state, publishStatus]);

  useEffect(() => {
    if (!publishStatus) return;
    const handler = () => {
      if (wasLiveRef.current) {
        wasLiveRef.current = false;
        voxModeService.updateQuickVoxStatus(false).catch(() => {});
      }
    };
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('pagehide', handler);
      window.removeEventListener('beforeunload', handler);
      handler(); // also fires on unmount
    };
  }, [publishStatus]);

  // Set recording mode and persist to localStorage
  const setRecordingMode = useCallback((mode: 'hold' | 'tap') => {
    setRecordingModeState(mode);
    localStorage.setItem('voxer_recording_mode', mode);
    onModeChange?.(mode);
  }, [onModeChange]);

  // Handle pointer down for hold mode
  const handlePointerDown = useCallback(() => {
    if (recordingMode === 'hold' && state === 'idle') {
      startRecording();
    }
  }, [recordingMode, state, startRecording]);

  // Handle pointer up for hold mode
  const handlePointerUp = useCallback(() => {
    if (recordingMode === 'hold' && state === 'recording') {
      stopRecording();
    }
  }, [recordingMode, state, stopRecording]);

  // Handle toggle recording for tap mode
  const handleToggleRecording = useCallback(() => {
    if (recordingMode === 'tap') {
      if (state === 'idle') {
        startRecording();
      } else if (state === 'recording') {
        stopRecording();
      }
    }
  }, [recordingMode, state, startRecording, stopRecording]);

  return {
    state,
    duration,
    analyser,
    recordingData,
    recordingMode,
    setRecordingMode,
    startRecording,
    stopRecording,
    cancelRecording,
    sendRecording,
    analyzeRecording,
    handlePointerDown,
    handlePointerUp,
    handleToggleRecording,
  };
}

export default useVoxRecording;

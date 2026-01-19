import { useState, useRef, useCallback } from 'react';

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
}

export interface UseVoxRecordingReturn {
  state: RecordingState;
  duration: number;
  analyser: AnalyserNode | null;
  recordingData: RecordingData | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  sendRecording: () => void;
  analyzeRecording: () => Promise<void>;
}

export function useVoxRecording(options: UseVoxRecordingOptions = {}): UseVoxRecordingReturn {
  const {
    onRecordingComplete,
    onAnalysisComplete,
    maxDuration = 300, // 5 minutes default
    autoAnalyze = false,
    qualityPreset = 'voice_hd', // Default to high quality
    customAudioConstraints,
  } = options;

  // Get audio settings from preset, with custom overrides
  const audioSettings: AudioQualityPreset = {
    ...AUDIO_QUALITY_PRESETS[qualityPreset],
    ...customAudioConstraints,
  };

  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [recordingData, setRecordingData] = useState<RecordingData | null>(null);

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

      // Request microphone access with high-quality audio constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Sample rate - higher = better quality
          sampleRate: { ideal: audioSettings.sampleRate },
          // Mono is fine for voice, reduces file size
          channelCount: { exact: audioSettings.channelCount },
          // Echo cancellation - keeps enabled for calls
          echoCancellation: { ideal: audioSettings.echoCancellation },
          // Noise suppression - can cause muffled sound when too aggressive
          noiseSuppression: { ideal: audioSettings.noiseSuppression },
          // Auto gain control - can cause pumping/breathing artifacts
          autoGainControl: { ideal: audioSettings.autoGainControl },
        }
      });
      streamRef.current = stream;

      // Log actual audio track settings for debugging
      const audioTrack = stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      console.log('Audio recording settings:', {
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl,
      });

      // Setup AudioContext with matching sample rate for visualization
      const audioContext = new AudioContext({ sampleRate: audioSettings.sampleRate });
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

      console.log('Using audio codec:', mimeType, 'at bitrate:', codecBitrate);

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
        console.log('MediaRecorder stopped, chunks:', chunksRef.current.length);

        if (chunksRef.current.length === 0) {
          console.warn('No audio chunks recorded - aborting');
          cleanup();
          setState('idle');
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('Created blob, size:', blob.size, 'type:', blob.type);
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
          console.warn('Could not decode audio for waveform:', e);
        }

        const data: RecordingData = {
          blob,
          url,
          duration: finalDuration,
          audioBuffer,
        };

        console.log('Setting recordingData:', { url, duration: finalDuration, hasAudioBuffer: !!audioBuffer });
        setRecordingData(data);
        cleanup();

        if (autoAnalyze) {
          console.log('Transitioning to analyzing state');
          setState('analyzing');
          // Trigger analysis here if needed
        } else {
          console.log('Transitioning to preview state');
          setState('preview');
        }

        onRecordingComplete?.(data);
        console.log('Recording complete callback fired');
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
    console.log('sendRecording called - resetting state to idle');
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

  return {
    state,
    duration,
    analyser,
    recordingData,
    startRecording,
    stopRecording,
    cancelRecording,
    sendRecording,
    analyzeRecording,
  };
}

export default useVoxRecording;

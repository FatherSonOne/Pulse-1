/**
 * Native Voice Recording Service
 * High-quality audio recording with waveform visualization
 */

import { Capacitor } from '@capacitor/core';

interface RecordingOptions {
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
  format?: 'aac' | 'mp3' | 'wav' | 'opus';
  maxDuration?: number;
}

interface Recording {
  dataUrl?: string;
  base64?: string;
  path?: string;
  duration: number;
  size: number;
  mimeType: string;
}

interface WaveformData {
  samples: number[];
  duration: number;
  sampleRate: number;
}

class NativeVoiceRecordingService {
  private isNative: boolean;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private animationFrame: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Check if recording is supported
   */
  isRecordingSupported(): boolean {
    if (this.isNative) {
      return true; // Native always supports recording
    }

    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('[Voice] Permission denied:', error);
      return false;
    }
  }

  /**
   * Start recording
   */
  async startRecording(options: RecordingOptions = {}): Promise<boolean> {
    try {
      if (this.mediaRecorder) {
        console.warn('[Voice] Already recording');
        return false;
      }

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      // Get audio stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: options.sampleRate || 44100,
          channelCount: options.channels || 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Setup audio context for waveform
      this.setupAudioContext(this.stream);

      // Create media recorder
      const mimeType = this.getMimeType(options.format);
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: options.bitRate || 128000
      });

      this.audioChunks = [];
      this.startTime = Date.now();

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms

      console.log('[Voice] Recording started');
      return true;
    } catch (error) {
      console.error('[Voice] Error starting recording:', error);
      return false;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<Recording | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const duration = Date.now() - this.startTime;
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder!.mimeType });

        const recording: Recording = {
          duration,
          size: blob.size,
          mimeType: this.mediaRecorder!.mimeType
        };

        // Convert to data URL
        recording.dataUrl = await this.blobToDataUrl(blob);

        // Convert to base64
        recording.base64 = await this.blobToBase64(blob);

        // Cleanup
        this.cleanup();

        console.log('[Voice] Recording stopped:', recording);
        resolve(recording);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Pause recording
   */
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  /**
   * Resume recording
   */
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  /**
   * Cancel recording
   */
  cancelRecording() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.cleanup();
    }
  }

  /**
   * Get current recording duration
   */
  getRecordingDuration(): number {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return Date.now() - this.startTime;
    }
    return 0;
  }

  /**
   * Setup audio context for waveform visualization
   */
  private setupAudioContext(stream: MediaStream) {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
    } catch (error) {
      console.error('[Voice] Error setting up audio context:', error);
    }
  }

  /**
   * Get real-time waveform data
   */
  getWaveformData(): Float32Array | null {
    if (!this.analyser) {
      return null;
    }

    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) {
      return null;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get recording state
   */
  getState(): 'inactive' | 'recording' | 'paused' {
    return this.mediaRecorder?.state || 'inactive';
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format?: string): string {
    const formats: Record<string, string> = {
      aac: 'audio/aac',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      opus: 'audio/opus',
      webm: 'audio/webm;codecs=opus'
    };

    // Check what's supported
    const preferredFormat = format || 'webm';
    if (MediaRecorder.isTypeSupported(formats[preferredFormat])) {
      return formats[preferredFormat];
    }

    // Fallback to webm
    if (MediaRecorder.isTypeSupported(formats.webm)) {
      return formats.webm;
    }

    // Default
    return '';
  }

  /**
   * Convert blob to data URL
   */
  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert blob to base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    const dataUrl = await this.blobToDataUrl(blob);
    return dataUrl.split(',')[1];
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// Export singleton instance
export const nativeVoiceRecordingService = new NativeVoiceRecordingService();

/**
 * React hook for voice recording
 */
export function useVoiceRecording() {
  const startRecording = async (options?: RecordingOptions) => {
    return await nativeVoiceRecordingService.startRecording(options);
  };

  const stopRecording = async () => {
    return await nativeVoiceRecordingService.stopRecording();
  };

  return {
    startRecording,
    stopRecording,
    pauseRecording: () => nativeVoiceRecordingService.pauseRecording(),
    resumeRecording: () => nativeVoiceRecordingService.resumeRecording(),
    cancelRecording: () => nativeVoiceRecordingService.cancelRecording(),
    getRecordingDuration: () => nativeVoiceRecordingService.getRecordingDuration(),
    getWaveformData: () => nativeVoiceRecordingService.getWaveformData(),
    getFrequencyData: () => nativeVoiceRecordingService.getFrequencyData(),
    getState: () => nativeVoiceRecordingService.getState(),
    isSupported: nativeVoiceRecordingService.isRecordingSupported(),
    requestPermissions: () => nativeVoiceRecordingService.requestPermissions()
  };
}

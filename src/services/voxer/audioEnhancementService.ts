// Audio Enhancement Service
// Provides AI-powered audio enhancement, noise reduction, and quality improvements

// ============================================
// TYPES
// ============================================

export interface EnhancementOptions {
  noiseReduction: boolean;
  normalize: boolean;
  enhanceClarity: boolean;
  removeBackground: boolean;
  enhanceVoice: boolean;
}

export interface EnhancedAudioResult {
  blob: Blob;
  originalSize: number;
  enhancedSize: number;
  processingTime: number;
  appliedEnhancements: string[];
}

export interface AudioAnalysis {
  averageVolume: number;
  peakVolume: number;
  silencePercentage: number;
  estimatedNoiseLevel: number;
  speechConfidence: number;
  duration: number;
}

// ============================================
// WEB AUDIO API ENHANCEMENT SERVICE
// ============================================

class AudioEnhancementService {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * Analyze audio blob for quality metrics
   */
  async analyzeAudio(audioBlob: Blob): Promise<AudioAnalysis> {
    const audioContext = this.getAudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Calculate volume metrics
    let sum = 0;
    let peak = 0;
    let silentSamples = 0;
    const silenceThreshold = 0.01;

    for (let i = 0; i < channelData.length; i++) {
      const absValue = Math.abs(channelData[i]);
      sum += absValue;
      peak = Math.max(peak, absValue);
      if (absValue < silenceThreshold) {
        silentSamples++;
      }
    }

    const averageVolume = sum / channelData.length;
    const silencePercentage = (silentSamples / channelData.length) * 100;

    // Estimate noise level (based on silence portions)
    let noiseSum = 0;
    let noiseCount = 0;
    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) < silenceThreshold * 2) {
        noiseSum += Math.abs(channelData[i]);
        noiseCount++;
      }
    }
    const estimatedNoiseLevel = noiseCount > 0 ? noiseSum / noiseCount : 0;

    // Speech confidence based on volume variation
    const speechConfidence = Math.min(1, averageVolume * 10) * (1 - silencePercentage / 100);

    return {
      averageVolume,
      peakVolume: peak,
      silencePercentage,
      estimatedNoiseLevel,
      speechConfidence,
      duration,
    };
  }

  /**
   * Apply noise reduction using Web Audio API filters
   */
  async applyNoiseReduction(audioBlob: Blob, threshold: number = 0.02): Promise<Blob> {
    const audioContext = this.getAudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // High-pass filter to remove low-frequency noise
    const highPassFilter = offlineContext.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.value = 80; // Remove frequencies below 80Hz

    // Low-pass filter to remove high-frequency noise
    const lowPassFilter = offlineContext.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = 8000; // Remove frequencies above 8kHz

    // Compressor for dynamic range
    const compressor = offlineContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // Connect the chain
    source.connect(highPassFilter);
    highPassFilter.connect(lowPassFilter);
    lowPassFilter.connect(compressor);
    compressor.connect(offlineContext.destination);

    source.start();

    const renderedBuffer = await offlineContext.startRendering();

    // Apply soft noise gate
    const processedData = new Float32Array(renderedBuffer.getChannelData(0));
    for (let i = 0; i < processedData.length; i++) {
      if (Math.abs(processedData[i]) < threshold) {
        processedData[i] *= 0.1; // Reduce quiet sounds (likely noise)
      }
    }

    // Create new buffer with processed data
    const newBuffer = audioContext.createBuffer(
      renderedBuffer.numberOfChannels,
      renderedBuffer.length,
      renderedBuffer.sampleRate
    );
    newBuffer.copyToChannel(processedData, 0);

    return this.audioBufferToBlob(newBuffer);
  }

  /**
   * Normalize audio levels
   */
  async normalizeAudio(audioBlob: Blob, targetPeak: number = 0.9): Promise<Blob> {
    const audioContext = this.getAudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);

    // Find current peak
    let currentPeak = 0;
    for (let i = 0; i < channelData.length; i++) {
      currentPeak = Math.max(currentPeak, Math.abs(channelData[i]));
    }

    if (currentPeak === 0) {
      return audioBlob; // Silent audio, return as-is
    }

    // Calculate gain needed
    const gain = targetPeak / currentPeak;

    // Apply gain
    const normalizedData = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      normalizedData[i] = Math.max(-1, Math.min(1, channelData[i] * gain));
    }

    // Create new buffer
    const newBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    newBuffer.copyToChannel(normalizedData, 0);

    return this.audioBufferToBlob(newBuffer);
  }

  /**
   * Enhance voice clarity using EQ
   */
  async enhanceVoiceClarity(audioBlob: Blob): Promise<Blob> {
    const audioContext = this.getAudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Voice clarity EQ chain
    // Boost presence (2-4kHz)
    const presenceBoost = offlineContext.createBiquadFilter();
    presenceBoost.type = 'peaking';
    presenceBoost.frequency.value = 3000;
    presenceBoost.Q.value = 1;
    presenceBoost.gain.value = 3;

    // Boost air (6-8kHz) for clarity
    const airBoost = offlineContext.createBiquadFilter();
    airBoost.type = 'highshelf';
    airBoost.frequency.value = 6000;
    airBoost.gain.value = 2;

    // Reduce muddiness (200-400Hz)
    const mudCut = offlineContext.createBiquadFilter();
    mudCut.type = 'peaking';
    mudCut.frequency.value = 300;
    mudCut.Q.value = 1;
    mudCut.gain.value = -2;

    // Connect chain
    source.connect(mudCut);
    mudCut.connect(presenceBoost);
    presenceBoost.connect(airBoost);
    airBoost.connect(offlineContext.destination);

    source.start();

    const renderedBuffer = await offlineContext.startRendering();
    return this.audioBufferToBlob(renderedBuffer);
  }

  /**
   * Apply full enhancement pipeline
   */
  async enhanceAudio(
    audioBlob: Blob,
    options: Partial<EnhancementOptions> = {}
  ): Promise<EnhancedAudioResult> {
    const startTime = performance.now();
    const appliedEnhancements: string[] = [];
    let processedBlob = audioBlob;

    const {
      noiseReduction = true,
      normalize = true,
      enhanceClarity = true,
      removeBackground = false,
      enhanceVoice = true,
    } = options;

    try {
      // Step 1: Noise reduction
      if (noiseReduction) {
        processedBlob = await this.applyNoiseReduction(processedBlob);
        appliedEnhancements.push('Noise Reduction');
      }

      // Step 2: Voice clarity enhancement
      if (enhanceClarity || enhanceVoice) {
        processedBlob = await this.enhanceVoiceClarity(processedBlob);
        appliedEnhancements.push('Voice Clarity');
      }

      // Step 3: Normalize audio levels
      if (normalize) {
        processedBlob = await this.normalizeAudio(processedBlob);
        appliedEnhancements.push('Normalization');
      }

      const processingTime = performance.now() - startTime;

      return {
        blob: processedBlob,
        originalSize: audioBlob.size,
        enhancedSize: processedBlob.size,
        processingTime,
        appliedEnhancements,
      };
    } catch (error: any) {
      console.error('Audio enhancement failed:', error);
      throw new Error(`Enhancement failed: ${error.message}`);
    }
  }

  /**
   * Convert AudioBuffer to Blob (WAV format)
   */
  private async audioBufferToBlob(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const channelData = audioBuffer.getChannelData(0);
    let offset = headerSize;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += bytesPerSample;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Create a real-time audio processor for live enhancement
   */
  createLiveProcessor(
    stream: MediaStream,
    options: Partial<EnhancementOptions> = {}
  ): { destination: MediaStreamAudioDestinationNode; cleanup: () => void } {
    const audioContext = this.getAudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    // Create filter chain
    const highPass = audioContext.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 80;

    const lowPass = audioContext.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 8000;

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.2;

    const destination = audioContext.createMediaStreamDestination();

    // Connect chain
    source.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(compressor);
    compressor.connect(gainNode);
    gainNode.connect(destination);

    const cleanup = () => {
      source.disconnect();
      highPass.disconnect();
      lowPass.disconnect();
      compressor.disconnect();
      gainNode.disconnect();
    };

    return { destination, cleanup };
  }
}

// Export singleton
export const audioEnhancementService = new AudioEnhancementService();

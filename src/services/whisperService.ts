import OpenAI from 'openai';

/**
 * Whisper API Service
 * Uses OpenAI's Whisper model for accurate speech-to-text transcription
 */

export interface WhisperTranscriptionOptions {
  language?: string; // ISO-639-1 format (e.g., 'en', 'es', 'fr')
  prompt?: string; // Optional context to guide the model
  temperature?: number; // 0-1, lower is more deterministic
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

export interface WhisperTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
}

export class WhisperService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Transcribe audio using Whisper API
   * @param audioBlob - Audio file as Blob (supports mp3, mp4, mpeg, mpga, m4a, wav, webm)
   * @param options - Optional transcription parameters
   * @returns Transcription result with text and metadata
   */
  async transcribe(
    audioBlob: Blob,
    options: WhisperTranscriptionOptions = {}
  ): Promise<WhisperTranscriptionResult> {
    try {
      // Convert Blob to File (Whisper API requires File object)
      const audioFile = new File(
        [audioBlob],
        `audio-${Date.now()}.webm`,
        { type: audioBlob.type || 'audio/webm' }
      );

      // Call Whisper API
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: options.language,
        prompt: options.prompt,
        temperature: options.temperature ?? 0.2, // Lower temperature for more accuracy
        response_format: options.response_format || 'verbose_json',
      });

      // Handle different response formats
      if (typeof transcription === 'string') {
        return { text: transcription };
      }

      // Verbose JSON response
      return {
        text: transcription.text,
        language: (transcription as any).language,
        duration: (transcription as any).duration,
        segments: (transcription as any).segments,
      };
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw new Error(
        `Whisper transcription failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Translate audio to English using Whisper
   * @param audioBlob - Audio file in any supported language
   * @param options - Optional parameters
   * @returns English translation
   */
  async translate(
    audioBlob: Blob,
    options: Omit<WhisperTranscriptionOptions, 'language'> = {}
  ): Promise<WhisperTranscriptionResult> {
    try {
      const audioFile = new File(
        [audioBlob],
        `audio-${Date.now()}.webm`,
        { type: audioBlob.type || 'audio/webm' }
      );

      const translation = await this.openai.audio.translations.create({
        file: audioFile,
        model: 'whisper-1',
        prompt: options.prompt,
        temperature: options.temperature ?? 0.2,
        response_format: options.response_format || 'verbose_json',
      });

      if (typeof translation === 'string') {
        return { text: translation };
      }

      return {
        text: translation.text,
        language: 'en',
        duration: (translation as any).duration,
        segments: (translation as any).segments,
      };
    } catch (error) {
      console.error('Whisper translation error:', error);
      throw new Error(
        `Whisper translation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Transcribe with automatic language detection
   * Uses verbose_json to get detected language
   */
  async transcribeWithLanguageDetection(
    audioBlob: Blob,
    options: Omit<WhisperTranscriptionOptions, 'language'> = {}
  ): Promise<WhisperTranscriptionResult> {
    return this.transcribe(audioBlob, {
      ...options,
      response_format: 'verbose_json',
    });
  }

  /**
   * Batch transcribe multiple audio files
   * @param audioBlobs - Array of audio blobs
   * @param options - Transcription options
   * @returns Array of transcription results
   */
  async batchTranscribe(
    audioBlobs: Blob[],
    options: WhisperTranscriptionOptions = {}
  ): Promise<WhisperTranscriptionResult[]> {
    const results = await Promise.allSettled(
      audioBlobs.map((blob) => this.transcribe(blob, options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Transcription ${index} failed:`, result.reason);
        return {
          text: `[Transcription failed: ${result.reason.message}]`,
        };
      }
    });
  }

  /**
   * Convert audio format for better Whisper compatibility
   * Whisper works best with: mp3, mp4, mpeg, mpga, m4a, wav, webm
   */
  async convertAudioFormat(
    audioBlob: Blob,
    targetFormat: 'mp3' | 'wav' | 'webm' = 'mp3'
  ): Promise<Blob> {
    // This is a placeholder - actual conversion would require a library like ffmpeg.wasm
    // For now, we'll just return the original blob
    // In production, consider using ffmpeg.wasm for format conversion
    console.warn('Audio format conversion not implemented - using original format');
    return audioBlob;
  }

  /**
   * Get estimated cost for transcription
   * Whisper pricing: $0.006 per minute
   * @param durationSeconds - Audio duration in seconds
   * @returns Estimated cost in USD
   */
  getEstimatedCost(durationSeconds: number): number {
    const minutes = durationSeconds / 60;
    return minutes * 0.006;
  }

  /**
   * Check if audio duration is within Whisper limits
   * Max file size: 25 MB
   * @param audioBlob - Audio blob to check
   * @returns true if within limits
   */
  isWithinLimits(audioBlob: Blob): boolean {
    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
    return audioBlob.size <= maxSizeBytes;
  }
}

/**
 * Create a singleton instance with API key
 */
let whisperServiceInstance: WhisperService | null = null;

export const getWhisperService = (apiKey: string): WhisperService => {
  if (!whisperServiceInstance || whisperServiceInstance['openai'].apiKey !== apiKey) {
    whisperServiceInstance = new WhisperService(apiKey);
  }
  return whisperServiceInstance;
};

/**
 * Convenience function for quick transcription
 */
export const transcribeAudio = async (
  apiKey: string,
  audioBlob: Blob,
  options?: WhisperTranscriptionOptions
): Promise<string> => {
  const service = getWhisperService(apiKey);
  const result = await service.transcribe(audioBlob, options);
  return result.text;
};

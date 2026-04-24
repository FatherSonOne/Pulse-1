import { supabase } from './supabase';

/**
 * Whisper API Service
 * Transcribes audio via the `whisper-proxy` Supabase edge function, which
 * forwards to OpenAI's Whisper API server-side. Keeps the OpenAI key out of
 * the browser bundle — the client only needs a valid Supabase session.
 */

export interface WhisperTranscriptionOptions {
  language?: string; // ISO-639-1 format (e.g., 'en', 'es', 'fr')
  prompt?: string; // Optional context to guide the model
  temperature?: number; // 0-1, lower is more deterministic
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  timestamp_granularities?: ('word' | 'segment')[]; // for verbose_json
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

// Extract a useful error message out of a Supabase functions.invoke() failure.
// The SDK wraps the underlying Response in `error.context.response` — we try
// to parse the OpenAI error body for something actionable.
async function extractInvokeError(error: unknown, fallback: string): Promise<string> {
  const message = error instanceof Error ? error.message : fallback;
  const ctx = (error as { context?: { response?: Response } })?.context;
  const resp = ctx?.response;
  if (resp) {
    try {
      const body = await resp.clone().json();
      if (body?.error?.message) return body.error.message;
      if (body?.error && typeof body.error === 'string') return body.error;
      if (body?.detail) return body.detail;
    } catch {
      try {
        const text = await resp.clone().text();
        if (text) return text;
      } catch {
        /* ignore */
      }
    }
  }
  return message;
}

export class WhisperService {
  /**
   * @param _apiKey deprecated — ignored. The edge function holds the OpenAI
   *   key server-side. Kept as an optional constructor arg so existing callers
   *   (e.g. `new WhisperService(openAiKey)` in audioVoiceServiceGemini.ts)
   *   continue to compile without modification.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_apiKey?: string) {
    // no-op
  }

  /**
   * Transcribe audio using Whisper API (via whisper-proxy edge function)
   * @param audioBlob - Audio file as Blob (supports mp3, mp4, mpeg, mpga, m4a, wav, webm)
   * @param options - Optional transcription parameters
   * @returns Transcription result with text and metadata
   */
  async transcribe(
    audioBlob: Blob,
    options: WhisperTranscriptionOptions = {}
  ): Promise<WhisperTranscriptionResult> {
    try {
      // Normalize mime type - strip codec info (e.g., 'audio/webm;codecs=opus' -> 'audio/webm')
      const baseMimeType = audioBlob.type ? audioBlob.type.split(';')[0] : 'audio/webm';

      // Convert Blob to File so the edge function sees a proper `file` field
      const audioFile = new File(
        [audioBlob],
        `audio-${Date.now()}.webm`,
        { type: baseMimeType }
      );

      const form = new FormData();
      form.append('file', audioFile);
      form.append('model', 'whisper-1');
      form.append('response_format', options.response_format || 'verbose_json');
      form.append('temperature', String(options.temperature ?? 0.2));
      if (options.language) form.append('language', options.language);
      if (options.prompt) form.append('prompt', options.prompt);
      if (options.timestamp_granularities?.length) {
        for (const g of options.timestamp_granularities) {
          form.append('timestamp_granularities[]', g);
        }
      }
      // endpoint defaults to 'transcriptions' server-side

      const { data, error } = await supabase.functions.invoke('whisper-proxy', {
        body: form,
      });

      if (error) {
        const detail = await extractInvokeError(error, 'invoke failed');
        throw new Error(`Whisper transcription failed: ${detail}`);
      }

      // Handle text-mode responses (plain string)
      if (typeof data === 'string') {
        return { text: data };
      }

      // Verbose JSON / JSON response
      return {
        text: data?.text ?? '',
        language: data?.language,
        duration: data?.duration,
        segments: data?.segments,
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
   * Translate audio to English using Whisper (via whisper-proxy edge function)
   * @param audioBlob - Audio file in any supported language
   * @param options - Optional parameters
   * @returns English translation
   */
  async translate(
    audioBlob: Blob,
    options: Omit<WhisperTranscriptionOptions, 'language'> = {}
  ): Promise<WhisperTranscriptionResult> {
    try {
      const baseMimeType = audioBlob.type ? audioBlob.type.split(';')[0] : 'audio/webm';

      const audioFile = new File(
        [audioBlob],
        `audio-${Date.now()}.webm`,
        { type: baseMimeType }
      );

      const form = new FormData();
      form.append('file', audioFile);
      form.append('model', 'whisper-1');
      form.append('response_format', options.response_format || 'verbose_json');
      form.append('temperature', String(options.temperature ?? 0.2));
      form.append('endpoint', 'translations'); // switch proxy to /audio/translations
      if (options.prompt) form.append('prompt', options.prompt);

      const { data, error } = await supabase.functions.invoke('whisper-proxy', {
        body: form,
      });

      if (error) {
        const detail = await extractInvokeError(error, 'invoke failed');
        throw new Error(`Whisper translation failed: ${detail}`);
      }

      if (typeof data === 'string') {
        return { text: data };
      }

      return {
        text: data?.text ?? '',
        language: 'en',
        duration: data?.duration,
        segments: data?.segments,
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
          text: `[Transcription failed: ${result.reason?.message ?? String(result.reason)}]`,
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
    _targetFormat: 'mp3' | 'wav' | 'webm' = 'mp3'
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

  /**
   * Whether the service is available. Always true now — the proxy is
   * reachable whenever the user has a valid Supabase session.
   */
  isAvailable(): boolean {
    return true;
  }
}

/**
 * Singleton instance. The apiKey arg is accepted for backwards compatibility
 * but ignored — the edge function holds the OpenAI key server-side.
 */
let whisperServiceInstance: WhisperService | null = null;

export const getWhisperService = (_apiKey?: string): WhisperService => {
  if (!whisperServiceInstance) {
    whisperServiceInstance = new WhisperService();
  }
  return whisperServiceInstance;
};

/**
 * Convenience function for quick transcription.
 * The apiKey arg is accepted for backwards compatibility but ignored.
 */
export const transcribeAudio = async (
  _apiKey: string | undefined,
  audioBlob: Blob,
  options?: WhisperTranscriptionOptions
): Promise<string> => {
  const service = getWhisperService();
  const result = await service.transcribe(audioBlob, options);
  return result.text;
};

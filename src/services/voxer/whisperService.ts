// Whisper Service - speech recognition and transcription.
// Calls the `whisper-proxy` Supabase edge function, which forwards the audio
// to OpenAI's Whisper API server-side. The OpenAI key lives on the server;
// the browser only needs a valid Supabase session.

import { supabase } from '../supabase';

// ============================================
// TYPES
// ============================================

/**
 * WhisperTranscriptionResult - Whisper-specific transcription output.
 * (Renamed from TranscriptionResult to avoid collision with the canonical
 * TranscriptionResult in voxerTypes.ts which has richer fields like
 * id, confidence, provider, speakers, etc.)
 */
export interface WhisperTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  words?: TranscriptionWord[];
  segments?: TranscriptionSegment[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionSegment {
  id: number;
  text: string;
  start: number;
  end: number;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface TranscriptionOptions {
  language?: string; // ISO-639-1 language code (e.g., 'en', 'es', 'fr')
  prompt?: string; // Optional prompt to guide transcription style
  temperature?: number; // 0-1, lower is more deterministic
  timestampGranularities?: ('word' | 'segment')[];
}

export interface TranslationResult {
  text: string;
  originalLanguage?: string;
}

// ============================================
// WHISPER SERVICE
// ============================================

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

class WhisperService {
  /**
   * Transcribe audio to text using OpenAI Whisper (via whisper-proxy edge function)
   */
  async transcribe(
    audioBlob: Blob,
    options: TranscriptionOptions = {}
  ): Promise<WhisperTranscriptionResult> {
    // Prepare form data
    const formData = new FormData();

    // Convert blob to file with appropriate extension
    // Normalize mime type by stripping codec info
    const baseMimeType = audioBlob.type ? audioBlob.type.split(';')[0] : 'audio/webm';
    const extension = this.getFileExtension(audioBlob.type);
    const file = new File([audioBlob], `audio.${extension}`, { type: baseMimeType });
    formData.append('file', file);
    formData.append('model', 'whisper-1');

    // Add optional parameters
    if (options.language) {
      formData.append('language', options.language);
    }
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    if (options.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }

    // Request verbose JSON for word/segment timestamps
    formData.append('response_format', 'verbose_json');

    if (options.timestampGranularities?.length) {
      options.timestampGranularities.forEach(g => {
        formData.append('timestamp_granularities[]', g);
      });
    }

    try {
      const { data, error } = await supabase.functions.invoke('whisper-proxy', {
        body: formData,
      });

      if (error) {
        const detail = await extractInvokeError(error, 'invoke failed');
        throw new Error(`Transcription failed: ${detail}`);
      }

      // Proxy returns OpenAI's raw response shape
      if (typeof data === 'string') {
        return { text: data };
      }

      return {
        text: data?.text ?? '',
        language: data?.language,
        duration: data?.duration,
        words: data?.words,
        segments: data?.segments,
      };
    } catch (error: any) {
      console.error('Whisper transcription error:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Translate audio to English using OpenAI Whisper (via whisper-proxy edge function)
   */
  async translate(
    audioBlob: Blob,
    options: Omit<TranscriptionOptions, 'language'> = {}
  ): Promise<TranslationResult> {
    const formData = new FormData();

    // Normalize mime type by stripping codec info
    const baseMimeType = audioBlob.type ? audioBlob.type.split(';')[0] : 'audio/webm';
    const extension = this.getFileExtension(audioBlob.type);
    const file = new File([audioBlob], `audio.${extension}`, { type: baseMimeType });
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('endpoint', 'translations'); // switch proxy to /audio/translations

    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    if (options.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }

    formData.append('response_format', 'verbose_json');

    try {
      const { data, error } = await supabase.functions.invoke('whisper-proxy', {
        body: formData,
      });

      if (error) {
        const detail = await extractInvokeError(error, 'invoke failed');
        throw new Error(`Translation failed: ${detail}`);
      }

      if (typeof data === 'string') {
        return { text: data };
      }

      return {
        text: data?.text ?? '',
        originalLanguage: data?.language,
      };
    } catch (error: any) {
      console.error('Whisper translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Transcribe with automatic language detection
   */
  async transcribeWithDetection(
    audioBlob: Blob,
    options: Omit<TranscriptionOptions, 'language'> = {}
  ): Promise<WhisperTranscriptionResult & { detectedLanguage: string }> {
    const result = await this.transcribe(audioBlob, options);
    return {
      ...result,
      detectedLanguage: result.language || 'unknown',
    };
  }

  /**
   * Get word-level timestamps for synchronized display
   */
  async transcribeWithWordTimestamps(
    audioBlob: Blob,
    language?: string
  ): Promise<WhisperTranscriptionResult> {
    return this.transcribe(audioBlob, {
      language,
      timestampGranularities: ['word', 'segment'],
    });
  }

  /**
   * Get file extension from MIME type
   * Strips codec info (e.g., 'audio/webm;codecs=opus' -> 'audio/webm')
   */
  private getFileExtension(mimeType: string): string {
    // Normalize mime type by stripping codec info
    const baseMimeType = mimeType.split(';')[0];

    const mimeToExt: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'mp4',
      'audio/m4a': 'm4a',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/ogg': 'ogg',
      'audio/flac': 'flac',
      'video/webm': 'webm',
      'video/mp4': 'mp4',
    };
    return mimeToExt[baseMimeType] || 'webm';
  }

  /**
   * Whether the service is configured. Always true now — the proxy is
   * reachable whenever the user has a valid Supabase session. Kept for
   * backwards compatibility with callers like ClassicVoxerMode.tsx.
   */
  async isConfigured(): Promise<boolean> {
    return true;
  }

  /**
   * @deprecated No-op. The OpenAI key now lives on the edge function; the
   * browser never sees it. Kept so existing callers compile unchanged.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setApiKey(_key: string): void {
    // no-op
  }
}

// Export singleton instance
export const whisperService = new WhisperService();

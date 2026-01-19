// Whisper Service - OpenAI Whisper API for speech recognition and transcription
// Provides transcription, translation, and audio processing capabilities

import { settingsService } from '../settingsService';

// ============================================
// TYPES
// ============================================

export interface TranscriptionResult {
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

class WhisperService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.openai.com/v1/audio';

  constructor() {
    this.loadApiKey();
  }

  private async loadApiKey(): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      this.apiKey = settings.openaiApiKey || null;
    } catch (error) {
      console.error('Failed to load OpenAI API key:', error);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      await this.loadApiKey();
    }
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Please add your API key in Settings.');
    }
    return this.apiKey;
  }

  /**
   * Transcribe audio to text using OpenAI Whisper
   */
  async transcribe(
    audioBlob: Blob,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const apiKey = await this.ensureApiKey();

    // Prepare form data
    const formData = new FormData();

    // Convert blob to file with appropriate extension
    const extension = this.getFileExtension(audioBlob.type);
    const file = new File([audioBlob], `audio.${extension}`, { type: audioBlob.type });
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
      const response = await fetch(`${this.baseUrl}/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Transcription failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        text: data.text,
        language: data.language,
        duration: data.duration,
        words: data.words,
        segments: data.segments,
      };
    } catch (error: any) {
      console.error('Whisper transcription error:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Translate audio to English using OpenAI Whisper
   */
  async translate(
    audioBlob: Blob,
    options: Omit<TranscriptionOptions, 'language'> = {}
  ): Promise<TranslationResult> {
    const apiKey = await this.ensureApiKey();

    const formData = new FormData();

    const extension = this.getFileExtension(audioBlob.type);
    const file = new File([audioBlob], `audio.${extension}`, { type: audioBlob.type });
    formData.append('file', file);
    formData.append('model', 'whisper-1');

    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    if (options.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }

    formData.append('response_format', 'verbose_json');

    try {
      const response = await fetch(`${this.baseUrl}/translations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Translation failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        text: data.text,
        originalLanguage: data.language,
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
  ): Promise<TranscriptionResult & { detectedLanguage: string }> {
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
  ): Promise<TranscriptionResult> {
    return this.transcribe(audioBlob, {
      language,
      timestampGranularities: ['word', 'segment'],
    });
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
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
    return mimeToExt[mimeType] || 'webm';
  }

  /**
   * Check if API key is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      await this.ensureApiKey();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update API key (called when settings change)
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }
}

// Export singleton instance
export const whisperService = new WhisperService();

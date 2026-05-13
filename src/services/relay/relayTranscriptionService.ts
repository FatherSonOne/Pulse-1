// Relay Transcription Service
// Supports multiple transcription providers: Gemini (server-side via gemini-audio
// edge function), OpenAI Whisper, AssemblyAI.

import { supabase } from '../supabase';
import { getCurrentWorkspaceId } from '../ai/getWorkspaceId';
import {
  TranscriptionConfig,
  TranscriptionResult,
  TranscriptionProvider,
  TranscriptionWord,
  SpeakerSegment,
} from './relayTypes';

// ============================================
// TRANSCRIPTION SERVICE CLASS
// ============================================

export class RelayTranscriptionService {
  // Gemini path no longer needs a client-side key — routes through the
  // gemini-audio edge function. Whisper/AssemblyAI still BYO.
  private openaiApiKey: string;
  private assemblyaiApiKey: string;

  constructor(config: {
    openaiApiKey?: string;
    assemblyaiApiKey?: string;
  } = {}) {
    this.openaiApiKey = config.openaiApiKey || localStorage.getItem('openai_api_key') || '';
    this.assemblyaiApiKey = config.assemblyaiApiKey || '';
  }

  // ============================================
  // MAIN TRANSCRIPTION METHOD
  // ============================================

  async transcribe(
    audioData: Blob | string, // Blob or base64
    config: Partial<TranscriptionConfig> = {}
  ): Promise<TranscriptionResult> {
    const finalConfig: TranscriptionConfig = {
      provider: config.provider || this.getBestProvider(),
      language: config.language || 'en',
      enablePunctuation: config.enablePunctuation ?? true,
      enableSpeakerDiarization: config.enableSpeakerDiarization ?? false,
      maxSpeakers: config.maxSpeakers || 2,
    };

    const startTime = Date.now();

    let base64: string;
    if (audioData instanceof Blob) {
      base64 = await this.blobToBase64(audioData);
    } else {
      base64 = audioData;
    }

    let result: TranscriptionResult;

    switch (finalConfig.provider) {
      case 'whisper':
        result = await this.transcribeWithWhisper(base64, finalConfig);
        break;
      case 'assemblyai':
        result = await this.transcribeWithAssemblyAI(base64, finalConfig);
        break;
      case 'gemini':
      default:
        result = await this.transcribeWithGemini(base64, finalConfig);
        break;
    }

    result.processedAt = new Date();
    return result;
  }

  // ============================================
  // GEMINI TRANSCRIPTION
  // ============================================

  private async transcribeWithGemini(
    base64: string,
    config: TranscriptionConfig
  ): Promise<TranscriptionResult> {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      throw new Error('No active workspace — cannot invoke gemini-audio');
    }

    const { data, error } = await supabase.functions.invoke('gemini-audio', {
      body: {
        action: 'transcribe',
        audio_base64: base64,
        mime_type: 'audio/webm',
        workspace_id: workspaceId,
        punctuation: config.enablePunctuation ?? true,
        diarization: config.enableSpeakerDiarization ?? false,
      },
    });

    if (error) {
      console.error('Gemini transcription error:', error);
      throw error;
    }

    const text = (data as { text?: string } | null)?.text ?? '';

    return {
      id: `trans-${Date.now()}`,
      text,
      confidence: 0.9,
      language: config.language || 'en',
      duration: this.estimateDuration(text),
      provider: 'gemini',
      processedAt: new Date(),
    };
  }

  // ============================================
  // OPENAI WHISPER TRANSCRIPTION
  // ============================================

  private async transcribeWithWhisper(
    base64: string,
    config: TranscriptionConfig
  ): Promise<TranscriptionResult> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured. Add it in Settings → Developer Tools');
    }

    try {
      // Convert base64 to blob
      const blob = this.base64ToBlob(base64, 'audio/webm');
      
      // Create form data
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      
      if (config.language && config.language !== 'auto') {
        formData.append('language', config.language);
      }
      
      formData.append('response_format', 'verbose_json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Whisper transcription failed');
      }

      const data = await response.json();

      // Parse word-level timestamps if available
      const words: TranscriptionWord[] = data.words?.map((w: any) => ({
        text: w.word,
        start: w.start,
        end: w.end,
        confidence: 0.95,
      })) || [];

      return {
        id: `trans-${Date.now()}`,
        text: data.text,
        confidence: 0.95,
        language: data.language || config.language || 'en',
        duration: data.duration || this.estimateDuration(data.text),
        words: words.length > 0 ? words : undefined,
        provider: 'whisper',
        processedAt: new Date(),
      };
    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
    }
  }

  // ============================================
  // ASSEMBLYAI TRANSCRIPTION
  // ============================================

  private async transcribeWithAssemblyAI(
    base64: string,
    config: TranscriptionConfig
  ): Promise<TranscriptionResult> {
    if (!this.assemblyaiApiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    try {
      // Convert base64 to blob and upload
      const blob = this.base64ToBlob(base64, 'audio/webm');
      
      // Upload to AssemblyAI
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': this.assemblyaiApiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      });

      const uploadData = await uploadResponse.json();
      const audioUrl = uploadData.upload_url;

      // Start transcription
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': this.assemblyaiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          language_code: config.language || 'en',
          punctuate: config.enablePunctuation,
          speaker_labels: config.enableSpeakerDiarization,
          speakers_expected: config.maxSpeakers,
        }),
      });

      const transcriptData = await transcriptResponse.json();
      const transcriptId = transcriptData.id;

      // Poll for completion
      let result: any;
      while (true) {
        const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: { 'Authorization': this.assemblyaiApiKey },
        });
        result = await pollResponse.json();

        if (result.status === 'completed') break;
        if (result.status === 'error') throw new Error(result.error);

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Parse words
      const words: TranscriptionWord[] = result.words?.map((w: any) => ({
        text: w.text,
        start: w.start / 1000,
        end: w.end / 1000,
        confidence: w.confidence,
        speaker: w.speaker,
      })) || [];

      // Parse speaker segments
      const speakers: SpeakerSegment[] = [];
      if (result.utterances) {
        result.utterances.forEach((u: any) => {
          speakers.push({
            speaker: `Speaker ${u.speaker}`,
            start: u.start / 1000,
            end: u.end / 1000,
            text: u.text,
          });
        });
      }

      return {
        id: `trans-${Date.now()}`,
        text: result.text,
        confidence: result.confidence || 0.9,
        language: config.language || 'en',
        duration: result.audio_duration || this.estimateDuration(result.text),
        words: words.length > 0 ? words : undefined,
        speakers: speakers.length > 0 ? speakers : undefined,
        provider: 'assemblyai',
        processedAt: new Date(),
      };
    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      throw error;
    }
  }

  // ============================================
  // REAL-TIME TRANSCRIPTION (Streaming)
  // ============================================

  async startRealtimeTranscription(
    stream: MediaStream,
    onTranscript: (text: string, isFinal: boolean) => void,
    config: Partial<TranscriptionConfig> = {}
  ): Promise<() => void> {
    // For now, return a simple recorder that transcribes on stop
    // Future: Implement WebSocket streaming with AssemblyAI or Deepgram
    
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    const chunks: Blob[] = [];
    let stopCallback: (() => void) | null = null;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      try {
        const result = await this.transcribe(blob, config);
        onTranscript(result.text, true);
      } catch (error) {
        console.error('Realtime transcription error:', error);
        onTranscript('', true);
      }
    };

    mediaRecorder.start(1000); // Collect data every second

    // Return stop function
    return () => {
      mediaRecorder.stop();
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private getBestProvider(): TranscriptionProvider {
    if (this.openaiApiKey) return 'whisper';
    if (this.assemblyaiApiKey) return 'assemblyai';
    // Gemini is always available — routed through the gemini-audio edge function
    // which holds the server-side key.
    return 'gemini';
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  private estimateDuration(text: string): number {
    // Average speaking rate: ~150 words per minute
    const words = text.split(/\s+/).length;
    return (words / 150) * 60;
  }

  // ============================================
  // API KEY MANAGEMENT
  // ============================================

  setOpenAIApiKey(key: string): void {
    this.openaiApiKey = key;
  }

  setAssemblyAIApiKey(key: string): void {
    this.assemblyaiApiKey = key;
  }

  getAvailableProviders(): TranscriptionProvider[] {
    // Gemini is always available — server-side via gemini-audio edge function.
    const providers: TranscriptionProvider[] = ['gemini'];
    if (this.openaiApiKey) providers.push('whisper');
    if (this.assemblyaiApiKey) providers.push('assemblyai');
    return providers;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let transcriptionServiceInstance: RelayTranscriptionService | null = null;

export const getRelayTranscriptionService = (config?: {
  openaiApiKey?: string;
  assemblyaiApiKey?: string;
}): RelayTranscriptionService => {
  if (!transcriptionServiceInstance) {
    transcriptionServiceInstance = new RelayTranscriptionService(config || {});
  }
  return transcriptionServiceInstance;
};

export default RelayTranscriptionService;

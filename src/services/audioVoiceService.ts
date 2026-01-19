import {
  VoiceMessage,
  TranscriptionResult,
  TaskFromVoice,
  DecisionFromVoice,
  VoiceSummary,
} from '../types';

/**
 * Audio/Voice Service
 * Handles transcription, summarization, and task/decision extraction from voice
 */

export class AudioVoiceService {
  private voiceMessages: Map<string, VoiceMessage> = new Map();
  private transcriptions: Map<string, TranscriptionResult> = new Map();

  /**
   * Record voice message (browser Web Audio API)
   */
  async recordVoiceMessage(
    durationMs: number
  ): Promise<VoiceMessage> {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      return new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const voiceMessage: VoiceMessage = {
            id: `voice-${Date.now()}`,
            audioUrl: URL.createObjectURL(audioBlob),
            audioBlob,
            duration: durationMs,
            recordedAt: new Date(),
            status: 'recording',
          };

          this.voiceMessages.set(voiceMessage.id, voiceMessage);
          resolve(voiceMessage);
        };

        mediaRecorder.onerror = (e) => {
          reject(new Error(`Recording error: ${e}`));
        };

        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), durationMs);
      });
    } catch (error) {
      throw new Error(
        `Voice recording failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Transcribe audio using external API (Gemini, Whisper, etc.)
   * This is a placeholder - integrate with your actual transcription API
   */
  async transcribeAudio(
    voiceMessageId: string,
    apiProvider: 'gemini' | 'whisper' | 'aws'
  ): Promise<TranscriptionResult> {
    const voiceMessage = this.voiceMessages.get(voiceMessageId);
    if (!voiceMessage) {
      throw new Error(`Voice message not found: ${voiceMessageId}`);
    }

    voiceMessage.status = 'processing';

    try {
      let transcript = '';
      let confidence = 0.95;

      if (apiProvider === 'gemini') {
        // Integrate with Gemini Audio API
        // Convert blob to base64
        const base64 = await this.blobToBase64(voiceMessage.audioBlob!);
        // Call Gemini API with audio
        // transcript = response.text;
        transcript = 'Placeholder transcription - integrate with Gemini API';
      } else if (apiProvider === 'whisper') {
        // Integrate with OpenAI Whisper
        // Use FormData to upload audio
        // transcript = response.text;
        transcript = 'Placeholder transcription - integrate with Whisper API';
      } else if (apiProvider === 'aws') {
        transcript = 'Placeholder transcription - integrate with AWS Transcribe';
      }

      const result: TranscriptionResult = {
        id: `transcription-${Date.now()}`,
        voiceMessageId,
        transcript,
        confidence,
        language: 'en',
        processedAt: new Date(),
      };

      this.transcriptions.set(result.id, result);
      voiceMessage.status = 'completed';

      return result;
    } catch (error) {
      voiceMessage.status = 'failed';
      throw error;
    }
  }

  /**
   * Extract tasks from transcribed voice
   * Uses LLM (Gemini) to intelligently extract actionable tasks
   */
  async extractTasksFromVoice(
    transcriptionId: string,
    llmProvider: 'gemini'
  ): Promise<TaskFromVoice[]> {
    const transcription = this.transcriptions.get(transcriptionId);
    if (!transcription) {
      throw new Error(`Transcription not found: ${transcriptionId}`);
    }

    const prompt = `
    Extract all actionable tasks from this voice transcription.
    For each task, provide:
    - Title (short, action-oriented)
    - Description (detailed)
    - Priority (low/medium/high based on language intensity)
    - Due date if mentioned
    - Assignee if mentioned

    Transcription:
    "${transcription.transcript}"

    Return as JSON array of tasks.
    `;

    try {
      // Call your LLM API here
      const tasks: TaskFromVoice[] = [];

      // TODO: Integrate with Gemini API
      // const response = await geminiClient.generateContent(prompt);
      // Parse response and create tasks

      return tasks;
    } catch (error) {
      throw new Error(
        `Task extraction failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Extract decisions from transcribed voice
   */
  async extractDecisionsFromVoice(
    transcriptionId: string
  ): Promise<DecisionFromVoice[]> {
    const transcription = this.transcriptions.get(transcriptionId);
    if (!transcription) {
      throw new Error(`Transcription not found: ${transcriptionId}`);
    }

    const prompt = `
    Extract all decisions made in this voice transcription.
    For each decision, provide:
    - The decision itself
    - Context/reasoning
    - Who made it (if mentioned)
    - Affected teams

    Transcription:
    "${transcription.transcript}"

    Return as JSON array of decisions.
    `;

    try {
      const decisions: DecisionFromVoice[] = [];

      // TODO: Integrate with Gemini API

      return decisions;
    } catch (error) {
      throw new Error(
        `Decision extraction failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Generate summary from voice transcription
   */
  async summarizeVoice(transcriptionId: string): Promise<VoiceSummary> {
    const transcription = this.transcriptions.get(transcriptionId);
    if (!transcription) {
      throw new Error(`Transcription not found: ${transcriptionId}`);
    }

    const prompt = `
    Summarize this voice message and extract key information:

    Transcription:
    "${transcription.transcript}"

    Provide:
    1. Executive summary (2-3 sentences)
    2. Key points (bullet list)
    3. Sentiment (positive/neutral/negative)
    4. Topics discussed

    Return as JSON.
    `;

    try {
      // TODO: Integrate with Gemini API
      const summary: VoiceSummary = {
        id: `summary-${Date.now()}`,
        voiceMessageId: transcription.voiceMessageId,
        transcriptionId,
        summary: '',
        keyPoints: [],
        sentiment: 'neutral',
        topics: [],
      };

      return summary;
    } catch (error) {
      throw new Error(
        `Summarization failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Make voice searchable - index transcription content
   */
  indexVoiceTranscription(transcriptionId: string): void {
    const transcription = this.transcriptions.get(transcriptionId);
    if (!transcription) {
      throw new Error(`Transcription not found: ${transcriptionId}`);
    }

    // Index for full-text search
    const words = transcription.transcript
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Store index (in production, use Elasticsearch, MeiliSearch, etc.)
    console.log(`Indexed ${words.length} words from transcription`);
  }

  // ============= PRIVATE HELPERS =============

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  getVoiceMessage(id: string): VoiceMessage | undefined {
    return this.voiceMessages.get(id);
  }

  getTranscription(id: string): TranscriptionResult | undefined {
    return this.transcriptions.get(id);
  }
}

export const audioVoiceService = new AudioVoiceService();

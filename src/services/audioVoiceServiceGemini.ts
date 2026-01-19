import {
  VoiceMessage,
  TranscriptionResult,
  TaskFromVoice,
  DecisionFromVoice,
  VoiceSummary,
} from '../types';
import { transcribeMedia, analyzeVoiceMemo } from './geminiService';
import { WhisperService } from './whisperService';

/**
 * Audio/Voice Service with Gemini Integration + Whisper API
 * Handles transcription, summarization, and task/decision extraction from voice
 */

export class AudioVoiceServiceGemini {
  private voiceMessages: Map<string, VoiceMessage> = new Map();
  private transcriptions: Map<string, TranscriptionResult> = new Map();
  private apiKey: string;
  private openAiKey?: string;
  private whisperService?: WhisperService;

  constructor(apiKey: string, openAiKey?: string) {
    this.apiKey = apiKey;
    this.openAiKey = openAiKey;
    if (openAiKey) {
      this.whisperService = new WhisperService(openAiKey);
    }
  }

  /**
   * Record voice message (browser Web Audio API)
   */
  async recordVoiceMessage(
    durationMs: number
  ): Promise<VoiceMessage> {
    try {
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

          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());

          resolve(voiceMessage);
        };

        mediaRecorder.onerror = (e) => {
          stream.getTracks().forEach(track => track.stop());
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
   * Transcribe audio using Whisper API (preferred) or Gemini API (fallback)
   */
  async transcribeAudio(
    voiceMessageId: string,
    useWhisper: boolean = true
  ): Promise<TranscriptionResult> {
    const voiceMessage = this.voiceMessages.get(voiceMessageId);
    if (!voiceMessage) {
      throw new Error(`Voice message not found: ${voiceMessageId}`);
    }

    voiceMessage.status = 'processing';

    try {
      let transcript: string;
      let confidence: number;
      let language: string = 'en';

      // Try Whisper first if available and requested
      if (useWhisper && this.whisperService && voiceMessage.audioBlob) {
        try {
          console.log('🎤 Using Whisper API for transcription...');
          const whisperResult = await this.whisperService.transcribeWithLanguageDetection(
            voiceMessage.audioBlob,
            {
              temperature: 0.2, // Lower temperature for better accuracy
              prompt: 'Transcribe this voice message accurately, including punctuation.',
            }
          );
          
          transcript = whisperResult.text;
          confidence = 0.98; // Whisper is highly accurate
          language = whisperResult.language || 'en';
          console.log('✅ Whisper transcription successful');
        } catch (whisperError) {
          console.warn('⚠️ Whisper failed, falling back to Gemini:', whisperError);
          // Fall back to Gemini
          const base64 = await this.blobToBase64(voiceMessage.audioBlob);
          transcript = await transcribeMedia(this.apiKey, base64, 'audio/webm');
          confidence = transcript ? 0.85 : 0;
        }
      } else {
        // Use Gemini transcription
        console.log('🎤 Using Gemini API for transcription...');
        const base64 = await this.blobToBase64(voiceMessage.audioBlob!);
        transcript = await transcribeMedia(this.apiKey, base64, 'audio/webm');
        confidence = transcript ? 0.85 : 0;
      }

      const result: TranscriptionResult = {
        id: `transcription-${Date.now()}`,
        voiceMessageId,
        transcript: transcript || 'Transcription failed',
        confidence,
        language,
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
   * Deep analysis using Whisper + Gemini
   * Uses Whisper for accurate transcription, then Gemini for analysis
   */
  async deepAnalyzeVoice(
    voiceMessageId: string,
    useWhisper: boolean = true
  ): Promise<{
    transcription: TranscriptionResult;
    summary: VoiceSummary;
    tasks: TaskFromVoice[];
    decisions: DecisionFromVoice[];
  }> {
    const voiceMessage = this.voiceMessages.get(voiceMessageId);
    if (!voiceMessage) {
      throw new Error(`Voice message not found: ${voiceMessageId}`);
    }

    voiceMessage.status = 'processing';

    try {
      let transcriptionText: string;
      let language: string = 'en';

      // Step 1: Get accurate transcription using Whisper (preferred)
      if (useWhisper && this.whisperService && voiceMessage.audioBlob) {
        try {
          console.log('🎤 Using Whisper for accurate transcription...');
          const whisperResult = await this.whisperService.transcribeWithLanguageDetection(
            voiceMessage.audioBlob,
            {
              temperature: 0.2,
              prompt: 'Transcribe this voice message accurately with proper punctuation and formatting.',
            }
          );
          transcriptionText = whisperResult.text;
          language = whisperResult.language || 'en';
          console.log('✅ Whisper transcription complete');
        } catch (whisperError) {
          console.warn('⚠️ Whisper failed, using Gemini for transcription:', whisperError);
          // Fallback to Gemini for everything
          const base64 = await this.blobToBase64(voiceMessage.audioBlob);
          const analysis = await analyzeVoiceMemo(this.apiKey, base64);
          
          if (!analysis) {
            throw new Error('Analysis failed - no response from Gemini');
          }
          
          return this.buildAnalysisResult(voiceMessageId, analysis, voiceMessage);
        }
      } else {
        // Use Gemini for everything (original behavior)
        const base64 = await this.blobToBase64(voiceMessage.audioBlob!);
        const analysis = await analyzeVoiceMemo(this.apiKey, base64);
        
        if (!analysis) {
          throw new Error('Analysis failed - no response from Gemini');
        }
        
        return this.buildAnalysisResult(voiceMessageId, analysis, voiceMessage);
      }

      // Step 2: Use Gemini to analyze the Whisper transcription
      console.log('🤖 Using Gemini to analyze transcription...');
      const analysisPrompt = `Analyze this voice message transcription and extract:
1. A concise summary
2. Action items (list each on a new line)
3. Decisions made (list each on a new line)

Transcription:
${transcriptionText}

Respond in JSON format:
{
  "summary": "brief summary",
  "actionItems": ["item1", "item2"],
  "decisions": ["decision1", "decision2"]
}`;

      // Use Gemini for analysis (you may need to import generateText from geminiService)
      const { generateText } = await import('./geminiService');
      const analysisResponse = await generateText(this.apiKey, analysisPrompt);
      
      let analysis: { summary: string; actionItems: string[]; decisions: string[] };
      try {
        // Try to parse JSON response
        const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback parsing
          analysis = {
            summary: transcriptionText.substring(0, 200),
            actionItems: [],
            decisions: [],
          };
        }
      } catch {
        analysis = {
          summary: transcriptionText.substring(0, 200),
          actionItems: [],
          decisions: [],
        };
      }

      // Create transcription result
      const transcription: TranscriptionResult = {
        id: `transcription-${Date.now()}`,
        voiceMessageId,
        transcript: transcriptionText,
        confidence: 0.98,
        language,
        processedAt: new Date(),
      };

      this.transcriptions.set(transcription.id, transcription);

      // Create summary
      const summary: VoiceSummary = {
        id: `summary-${Date.now()}`,
        voiceMessageId,
        transcriptionId: transcription.id,
        summary: analysis.summary,
        keyPoints: analysis.actionItems,
        sentiment: 'neutral',
        topics: [],
      };

      // Create tasks from action items
      const tasks: TaskFromVoice[] = analysis.actionItems.map((item, index) => ({
        id: `task-${Date.now()}-${index}`,
        voiceMessageId,
        transcriptionId: transcription.id,
        title: item,
        description: item,
        priority: 'medium',
        tags: [],
      }));

      // Create decisions
      const decisions: DecisionFromVoice[] = analysis.decisions.map((decision, index) => ({
        id: `decision-${Date.now()}-${index}`,
        voiceMessageId,
        transcriptionId: transcription.id,
        decision,
        context: analysis.summary,
        decisionDate: new Date(),
        decidedBy: 'User',
        affectedTeams: [],
      }));

      voiceMessage.status = 'completed';
      console.log('✅ Deep analysis complete');

      return { transcription, summary, tasks, decisions };
    } catch (error) {
      voiceMessage.status = 'failed';
      throw error;
    }
  }

  /**
   * Helper to build analysis result from Gemini response
   */
  private buildAnalysisResult(
    voiceMessageId: string,
    analysis: any,
    voiceMessage: VoiceMessage
  ) {
    const transcription: TranscriptionResult = {
      id: `transcription-${Date.now()}`,
      voiceMessageId,
      transcript: analysis.transcription,
      confidence: 0.85,
      language: 'en',
      processedAt: new Date(),
    };

    this.transcriptions.set(transcription.id, transcription);

    const summary: VoiceSummary = {
      id: `summary-${Date.now()}`,
      voiceMessageId,
      transcriptionId: transcription.id,
      summary: analysis.summary,
      keyPoints: analysis.actionItems,
      sentiment: 'neutral',
      topics: [],
    };

    const tasks: TaskFromVoice[] = analysis.actionItems.map((item: string, index: number) => ({
      id: `task-${Date.now()}-${index}`,
      voiceMessageId,
      transcriptionId: transcription.id,
      title: item,
      description: item,
      priority: 'medium',
      tags: [],
    }));

    const decisions: DecisionFromVoice[] = analysis.decisions.map((decision: string, index: number) => ({
      id: `decision-${Date.now()}-${index}`,
      voiceMessageId,
      transcriptionId: transcription.id,
      decision,
      context: analysis.summary,
      decisionDate: new Date(),
      decidedBy: 'User',
      affectedTeams: [],
    }));

    voiceMessage.status = 'completed';

    return { transcription, summary, tasks, decisions };
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

  getAllVoiceMessages(): VoiceMessage[] {
    return Array.from(this.voiceMessages.values());
  }

  getAllTranscriptions(): TranscriptionResult[] {
    return Array.from(this.transcriptions.values());
  }
}

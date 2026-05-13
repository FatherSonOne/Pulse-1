// Relay Services - Main Export
// Comprehensive voice intelligence and communication services

// Types
export * from './relayTypes';
export * from './advancedRelayTypes';

// Services
export { RelayTranscriptionService, getRelayTranscriptionService } from './relayTranscriptionService';
export { RelayAnalysisService, getRelayAnalysisService } from './relayAnalysisService';
export { RelayFeedbackService, getRelayFeedbackService } from './relayFeedbackService';

// ============================================
// UNIFIED RELAY SERVICE
// ============================================

import { RelayTranscriptionService, getRelayTranscriptionService } from './relayTranscriptionService';
import { RelayAnalysisService, getRelayAnalysisService } from './relayAnalysisService';
import { RelayFeedbackService, getRelayFeedbackService } from './relayFeedbackService';
import {
  TranscriptionResult,
  VoxAnalysis,
  VoxFeedback,
  TranscriptionConfig,
  RelaySettings,
  DEFAULT_RELAY_SETTINGS,
  ActionItem,
  SuggestedResponse,
} from './relayTypes';

export interface RelayServiceConfig {
  /** OpenAI Whisper key — still client-side (BYO). */
  openaiApiKey?: string;
  /** AssemblyAI key — still client-side (BYO). */
  assemblyaiApiKey?: string;
  settings?: Partial<RelaySettings>;
}

export class RelayService {
  private transcriptionService: RelayTranscriptionService;
  private analysisService: RelayAnalysisService;
  private feedbackService: RelayFeedbackService;
  private settings: RelaySettings;

  constructor(config: RelayServiceConfig = {}) {
    const openaiKey = config.openaiApiKey || localStorage.getItem('openai_api_key') || '';

    this.transcriptionService = new RelayTranscriptionService({
      openaiApiKey: openaiKey,
      assemblyaiApiKey: config.assemblyaiApiKey,
    });

    // Gemini-backed services no longer need a client-side key — they route
    // through server-side edge functions (ai-router / gemini-audio / etc.).
    this.analysisService = new RelayAnalysisService();
    this.feedbackService = new RelayFeedbackService();
    this.settings = { ...DEFAULT_RELAY_SETTINGS, ...config.settings };
  }

  // ============================================
  // TRANSCRIPTION
  // ============================================

  async transcribe(
    audioData: Blob | string,
    config?: Partial<TranscriptionConfig>
  ): Promise<TranscriptionResult> {
    return this.transcriptionService.transcribe(audioData, {
      provider: this.settings.transcriptionProvider,
      language: this.settings.transcriptionLanguage,
      ...config,
    });
  }

  // ============================================
  // ANALYSIS
  // ============================================

  async analyze(
    transcription: string,
    context?: {
      senderName?: string;
      previousMessages?: string[];
      channelType?: 'direct' | 'group';
    }
  ): Promise<VoxAnalysis> {
    return this.analysisService.analyzeVox(transcription, context);
  }

  async quickAnalyze(transcription: string) {
    return this.analysisService.quickAnalyze(transcription);
  }

  async extractActionItems(transcription: string): Promise<ActionItem[]> {
    return this.analysisService.extractActionItems(transcription);
  }

  async generateResponses(
    transcription: string,
    context?: { relationship?: string; previousExchange?: string }
  ): Promise<SuggestedResponse[]> {
    return this.analysisService.generateResponses(transcription, context);
  }

  async summarizeConversation(
    messages: Array<{ sender: string; text: string; timestamp: Date }>
  ) {
    return this.analysisService.summarizeConversation(messages);
  }

  // ============================================
  // FEEDBACK (Before Sending)
  // ============================================

  async getFeedback(
    transcription: string,
    context?: {
      recipientName?: string;
      relationship?: 'professional' | 'casual' | 'formal';
      purpose?: 'update' | 'request' | 'response' | 'general';
      previousMessages?: string[];
    }
  ): Promise<VoxFeedback> {
    return this.feedbackService.analyzeFeedback(transcription, context);
  }

  async quickFeedback(transcription: string) {
    return this.feedbackService.quickFeedback(transcription);
  }

  async analyzeTone(transcription: string) {
    return this.feedbackService.analyzeTone(transcription);
  }

  async improveMessage(
    transcription: string,
    improvements: Array<'clarity' | 'tone' | 'brevity' | 'professionalism' | 'completeness'>
  ) {
    return this.feedbackService.improveMessage(transcription, improvements);
  }

  async rephrase(
    text: string,
    style: 'professional' | 'casual' | 'formal' | 'friendly' | 'concise'
  ): Promise<string[]> {
    return this.feedbackService.rephrase(text, style);
  }

  // ============================================
  // FULL PIPELINE
  // ============================================

  async processVox(
    audioData: Blob | string,
    options?: {
      transcriptionConfig?: Partial<TranscriptionConfig>;
      analysisContext?: {
        senderName?: string;
        previousMessages?: string[];
        channelType?: 'direct' | 'group';
      };
      includeFeedback?: boolean;
      feedbackContext?: {
        recipientName?: string;
        relationship?: 'professional' | 'casual' | 'formal';
      };
    }
  ): Promise<{
    transcription: TranscriptionResult;
    analysis?: VoxAnalysis;
    feedback?: VoxFeedback;
  }> {
    // Step 1: Transcribe
    const transcription = await this.transcribe(audioData, options?.transcriptionConfig);

    // Step 2: Analyze (if enabled)
    let analysis: VoxAnalysis | undefined;
    if (this.settings.autoAnalyze) {
      analysis = await this.analyze(transcription.text, options?.analysisContext);
    }

    // Step 3: Get feedback (if requested)
    let feedback: VoxFeedback | undefined;
    if (options?.includeFeedback && this.settings.enableFeedback) {
      feedback = await this.getFeedback(transcription.text, options.feedbackContext);
    }

    return { transcription, analysis, feedback };
  }

  // ============================================
  // SETTINGS
  // ============================================

  getSettings(): RelaySettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<RelaySettings>): void {
    this.settings = { ...this.settings, ...updates };
    // Persist to localStorage
    localStorage.setItem('voxer_settings', JSON.stringify(this.settings));
  }

  loadSettings(): void {
    const saved = localStorage.getItem('voxer_settings');
    if (saved) {
      try {
        this.settings = { ...DEFAULT_RELAY_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to load Relay settings:', e);
      }
    }
  }

  // ============================================
  // API KEYS
  // ============================================

  setOpenAIApiKey(key: string): void {
    this.transcriptionService.setOpenAIApiKey(key);
  }

  getAvailableTranscriptionProviders() {
    return this.transcriptionService.getAvailableProviders();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let relayServiceInstance: RelayService | null = null;

export const getRelayService = (config?: RelayServiceConfig): RelayService => {
  if (!relayServiceInstance) {
    relayServiceInstance = new RelayService(config || {});
    relayServiceInstance.loadSettings();
  }
  return relayServiceInstance;
};

export default RelayService;

// Real-time transcription
export {
  RealtimeTranscriptionService,
  getRealtimeTranscriptionService
} from './realtimeTranscriptionService';
export type {
  RealtimeTranscriptSegment,
  RealtimeTranscriptionCallbacks,
  RealtimeTranscriptionState,
  RealtimeTranscriptionConfig
} from './realtimeTranscriptionService';

// ============================================
// VOX MODE SYSTEM
// ============================================

// Vox Mode Types - All 6 communication paradigms
export * from './voxModeTypes';

// Vox Mode Service - Backend operations for all modes
export { voxModeService } from './voxModeService';

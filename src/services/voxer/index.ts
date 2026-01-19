// Voxer Services - Main Export
// Comprehensive voice intelligence and communication services

// Types
export * from './voxerTypes';
export * from './advancedVoxerTypes';

// Services
export { VoxerTranscriptionService, getVoxerTranscriptionService } from './voxerTranscriptionService';
export { VoxerAnalysisService, getVoxerAnalysisService } from './voxerAnalysisService';
export { VoxerFeedbackService, getVoxerFeedbackService } from './voxerFeedbackService';

// ============================================
// UNIFIED VOXER SERVICE
// ============================================

import { VoxerTranscriptionService, getVoxerTranscriptionService } from './voxerTranscriptionService';
import { VoxerAnalysisService, getVoxerAnalysisService } from './voxerAnalysisService';
import { VoxerFeedbackService, getVoxerFeedbackService } from './voxerFeedbackService';
import {
  TranscriptionResult,
  VoxAnalysis,
  VoxFeedback,
  TranscriptionConfig,
  VoxerSettings,
  DEFAULT_VOXER_SETTINGS,
  ActionItem,
  SuggestedResponse,
} from './voxerTypes';

export interface VoxerServiceConfig {
  geminiApiKey?: string;
  openaiApiKey?: string;
  assemblyaiApiKey?: string;
  settings?: Partial<VoxerSettings>;
}

export class VoxerService {
  private transcriptionService: VoxerTranscriptionService;
  private analysisService: VoxerAnalysisService;
  private feedbackService: VoxerFeedbackService;
  private settings: VoxerSettings;

  constructor(config: VoxerServiceConfig) {
    const geminiKey = config.geminiApiKey || import.meta.env.VITE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
    const openaiKey = config.openaiApiKey || localStorage.getItem('openai_api_key') || '';

    this.transcriptionService = new VoxerTranscriptionService({
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      assemblyaiApiKey: config.assemblyaiApiKey,
    });

    this.analysisService = new VoxerAnalysisService(geminiKey);
    this.feedbackService = new VoxerFeedbackService(geminiKey);
    this.settings = { ...DEFAULT_VOXER_SETTINGS, ...config.settings };
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

  getSettings(): VoxerSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<VoxerSettings>): void {
    this.settings = { ...this.settings, ...updates };
    // Persist to localStorage
    localStorage.setItem('voxer_settings', JSON.stringify(this.settings));
  }

  loadSettings(): void {
    const saved = localStorage.getItem('voxer_settings');
    if (saved) {
      try {
        this.settings = { ...DEFAULT_VOXER_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to load Voxer settings:', e);
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

let voxerServiceInstance: VoxerService | null = null;

export const getVoxerService = (config?: VoxerServiceConfig): VoxerService => {
  if (!voxerServiceInstance) {
    voxerServiceInstance = new VoxerService(config || {});
    voxerServiceInstance.loadSettings();
  }
  return voxerServiceInstance;
};

export default VoxerService;

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

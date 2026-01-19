// Core Types for Multi-Modal Intelligence
// Re-export from main types for consistency
export type {
  MessageSource,
  UnifiedMessage,
  ConversationNode,
  ConversationGraph,
  VoiceMessage,
  TranscriptionResult,
  TaskFromVoice,
  DecisionFromVoice,
  VoiceSummary,
  ChannelSpec,
  ChannelArtifact,
  DecisionSection,
  TaskSection,
  MilestoneSection,
  ParticipantSection,
  TimelineEntry,
  ResourceLink,
} from '../types';

// ============= ADDITIONAL TYPES =============

export type MessageType = 'text' | 'image' | 'voice' | 'file' | 'video';

// ============= INTEGRATION STATE TYPES =============

import type { MessageSource } from '../types';

export interface IntegrationConfig {
  platform: MessageSource;
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  userId?: string;
  webhookUrl?: string;
}

export interface SyncStatus {
  platform: MessageSource;
  lastSyncAt: Date;
  messageCount: number;
  status: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
}

// ============= USER PREFERENCE TYPES =============

export interface UserPreferences {
  userId: string;
  voiceLanguage: string;
  autoTranscribe: boolean;
  autoExtract: boolean;
  extractionPreferences: {
    extractTasks: boolean;
    extractDecisions: boolean;
    extractMilestones: boolean;
    minTaskConfidence: number; // 0-1
  };
  integrations: IntegrationConfig[];
}

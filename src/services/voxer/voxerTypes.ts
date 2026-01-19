// Voxer Types - Enhanced Voice Intelligence System

// ============================================
// TRANSCRIPTION TYPES
// ============================================

export type TranscriptionProvider = 'gemini' | 'whisper' | 'assemblyai';

export interface TranscriptionConfig {
  provider: TranscriptionProvider;
  language?: string;
  enablePunctuation?: boolean;
  enableSpeakerDiarization?: boolean;
  maxSpeakers?: number;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  confidence: number;
  language: string;
  duration: number;
  words?: TranscriptionWord[];
  speakers?: SpeakerSegment[];
  provider: TranscriptionProvider;
  processedAt: Date;
}

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

export interface SpeakerSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

// ============================================
// AI ANALYSIS TYPES
// ============================================

export type SentimentType = 'positive' | 'neutral' | 'negative' | 'mixed';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'urgent';
export type EmotionType = 'excited' | 'calm' | 'concerned' | 'frustrated' | 'happy' | 'neutral';

export interface VoxAnalysis {
  id: string;
  voxId: string;
  
  // Summary & Key Points
  summary: string;
  keyPoints: string[];
  
  // Action Items
  actionItems: ActionItem[];
  
  // Questions & Decisions
  questions: string[];
  decisions: string[];
  
  // Follow-up Suggestions
  suggestedFollowUps: string[];
  suggestedResponses: SuggestedResponse[];
  
  // Sentiment & Tone
  sentiment: SentimentType;
  urgency: UrgencyLevel;
  emotion?: EmotionType;
  toneDescription?: string;
  
  // Topics & Mentions
  topics: string[];
  mentions: VoxMentions;
  
  // Metadata
  analyzedAt: Date;
  processingTime: number;
}

export interface ActionItem {
  id: string;
  text: string;
  assignedTo?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  completed?: boolean;
  extractedFrom?: string;
}

export interface SuggestedResponse {
  id: string;
  text: string;
  tone: 'professional' | 'casual' | 'friendly' | 'formal';
  intent: 'acknowledge' | 'answer' | 'clarify' | 'confirm' | 'decline';
}

export interface VoxMentions {
  people: string[];
  dates: ParsedDate[];
  locations: string[];
  numbers: ParsedNumber[];
  organizations: string[];
  events: string[];
}

export interface ParsedDate {
  text: string;
  date?: Date;
  isRelative: boolean;
}

export interface ParsedNumber {
  text: string;
  value: number;
  type: 'currency' | 'percentage' | 'quantity' | 'time' | 'other';
}

// ============================================
// AI FEEDBACK TYPES (Before Sending)
// ============================================

export interface VoxFeedback {
  id: string;
  voxId: string;
  
  // Overall Assessment
  overallScore: number; // 0-100
  isReadyToSend: boolean;
  
  // Content Issues
  contentIssues: FeedbackIssue[];
  
  // Tone Issues
  toneIssues: FeedbackIssue[];
  
  // Clarity Issues
  clarityIssues: FeedbackIssue[];
  
  // Smart Suggestions
  suggestions: FeedbackSuggestion[];
  
  // Improved Version
  improvedTranscription?: string;
  
  // Quick Stats
  wordCount: number;
  estimatedDuration: number;
  hasActionItems: boolean;
  hasQuestions: boolean;
  
  analyzedAt: Date;
}

export type FeedbackSeverity = 'info' | 'warning' | 'critical';
export type FeedbackCategory = 'content' | 'tone' | 'clarity' | 'completeness' | 'professionalism';

export interface FeedbackIssue {
  id: string;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  message: string;
  suggestion?: string;
  highlightText?: string;
  position?: { start: number; end: number };
}

export interface FeedbackSuggestion {
  id: string;
  type: 'rephrase' | 'add_context' | 'clarify' | 'soften' | 'strengthen' | 'structure';
  originalText?: string;
  suggestedText: string;
  reason: string;
}

// ============================================
// VOX MESSAGE TYPES
// ============================================

export interface Vox {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  
  // Media
  audioUrl: string;
  audioBlob?: Blob;
  duration: number;
  type: 'audio' | 'video';
  quality?: '480p' | '720p' | '1080p';
  
  // Transcription
  transcription?: TranscriptionResult;
  isTranscribing?: boolean;
  
  // AI Analysis
  analysis?: VoxAnalysis;
  isAnalyzing?: boolean;
  
  // AI Feedback (for sent messages)
  feedback?: VoxFeedback;
  
  // Status
  status: 'recording' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed';
  
  // Organization
  starred?: boolean;
  tags?: string[];
  notes?: VoxNote[];
  
  // Timestamps
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface VoxNote {
  id: string;
  voxId: string;
  content: string;
  createdAt: Date;
  createdBy: string;
}

// ============================================
// CHANNEL TYPES
// ============================================

export interface VoxChannel {
  id: string;
  name: string;
  type: 'direct' | 'group';
  participants: VoxParticipant[];
  
  // Status
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  
  // Last Activity
  lastVox?: Vox;
  lastActivityAt?: Date;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  avatarColor?: string;
  avatarUrl?: string;
}

export interface VoxParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarColor?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen?: Date;
  isRecording?: boolean;
}

// ============================================
// REAL-TIME TYPES
// ============================================

export interface VoxerRealtimeState {
  isConnected: boolean;
  activeChannelId?: string;
  isRecording: boolean;
  recordingDuration: number;
  
  // Live Transcription
  liveTranscription?: string;
  isLiveTranscribing?: boolean;
  
  // Other Users
  usersRecording: string[];
  usersTyping: string[];
  usersOnline: string[];
}

export interface VoxerSettings {
  // Recording
  defaultMode: 'audio' | 'video';
  recordingMode: 'hold' | 'tap';
  videoQuality: '480p' | '720p' | '1080p';
  
  // Audio Processing
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  
  // Transcription
  autoTranscribe: boolean;
  transcriptionProvider: TranscriptionProvider;
  transcriptionLanguage: string;
  
  // AI Features
  autoAnalyze: boolean;
  enableFeedback: boolean;
  showSuggestions: boolean;
  
  // Playback
  defaultPlaybackSpeed: number;
  skipSilence: boolean;
  
  // Notifications
  notifyOnNewVox: boolean;
  notifyOnTranscription: boolean;
  notifyOnMention: boolean;
}

// Default settings
export const DEFAULT_VOXER_SETTINGS: VoxerSettings = {
  defaultMode: 'audio',
  recordingMode: 'hold',
  videoQuality: '720p',
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  autoTranscribe: true,
  transcriptionProvider: 'gemini',
  transcriptionLanguage: 'en',
  autoAnalyze: false,
  enableFeedback: true,
  showSuggestions: true,
  defaultPlaybackSpeed: 1,
  skipSilence: false,
  notifyOnNewVox: true,
  notifyOnTranscription: false,
  notifyOnMention: true,
};

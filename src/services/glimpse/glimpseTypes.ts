// Glimpse Types - Video messaging type definitions
// Extracted from src/services/relay/voxModeTypes.ts during the Relay rework
// (sub-stage 1.5c, 2026-04-27). Database tables remain video_vox_* for now.

export interface GlimpseMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderHandle?: string;
  senderAvatarUrl?: string;

  // Video content
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
  fileSize?: number;

  // Text content
  caption?: string;

  // AI-generated content
  transcript?: string;
  summary?: string;
  topics?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  actionItems?: string[];

  // Reply threading
  replyToId?: string;
  replyToTimestamp?: number;
  quotedText?: string;
  threadCount: number;

  // Mentions
  mentions: string[];

  // Delivery status
  status: 'uploading' | 'processing' | 'sent' | 'delivered' | 'viewed' | 'failed';
  processingStatus?: 'pending' | 'transcribing' | 'summarizing' | 'complete' | 'failed';

  // Timestamps
  createdAt: Date;
  deliveredAt?: Date;
  expiresAt?: Date;

  // Reactions (aggregated)
  reactions: Record<string, string[]>;  // emoji -> user IDs

  // Metadata
  metadata?: Record<string, any>;
}

export interface GlimpseConversation {
  id: string;
  participantIds: string[];
  participants: Array<{
    id: string;
    name: string;
    handle?: string;
    avatarUrl?: string;
    avatarColor: string;
  }>;
  title?: string;
  lastMessageId?: string;
  lastMessageAt?: Date;
  lastMessageCaption?: string;
  lastMessageSender?: string;
  lastMessageDuration?: number;
  lastMessageThumbnail?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GlimpseConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  unreadCount: number;
  isMuted: boolean;
  lastReadAt?: Date;
  joinedAt: Date;
}

export interface GlimpseReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  timestamp?: number;  // Reaction to specific moment in video
  createdAt: Date;
}

export interface GlimpseReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  viewedAt: Date;
  watchDuration?: number;
  completed: boolean;
}

export interface GlimpseBookmark {
  id: string;
  userId: string;
  messageId: string;
  note?: string;
  timestamp?: number;  // Bookmark at specific moment
  createdAt: Date;
}

export interface GlimpseAIAnalysis {
  transcript: string;
  summary: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  actionItems: string[];
  keyMoments?: Array<{
    timestamp: number;
    description: string;
    importance: 'high' | 'medium' | 'low';
  }>;
}

export interface GlimpseRecordingState {
  status: 'idle' | 'previewing' | 'recording' | 'paused' | 'processing' | 'ready';
  duration: number;
  maxDuration: number;
  videoBlob: Blob | null;
  thumbnailBlob: Blob | null;
  previewUrl: string | null;
  error: string | null;
}

export interface GlimpseSearchResult {
  message: GlimpseMessage;
  matchType: 'transcript' | 'caption' | 'topic' | 'summary';
  matchText: string;
  relevanceScore: number;
}

// Re-export PulseUser from relay for now (until 1.5d when shared types relocate)
export type { PulseUser } from '../relay/voxModeTypes';

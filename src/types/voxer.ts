// src/types/voxer.ts

export interface VoxMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content?: string;
  audioUrl?: string;
  videoUrl?: string;
  duration: number;
  timestamp: string;
  isListened: boolean;
  isTranscribed: boolean;
  transcription?: string;
  reactions?: { [userId: string]: string };
  status: 'sending' | 'sent' | 'delivered' | 'read';
  type: 'audio' | 'video';
}

export interface VoxChannel {
  id: string;
  name: string;
  description?: string;
  type: 'direct' | 'group';
  participants: VoxParticipant[];
  createdAt: string;
  lastMessageAt: string;
  lastMessage?: string;
  unreadCount: number;
  isMuted: boolean;
  isPinned: boolean;
  avatar?: string;
}

export interface VoxParticipant {
  id: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'member';
  isOnline: boolean;
  lastSeen?: string;
}

export interface VoxRecording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  transcription?: string;
  isTranscribing: boolean;
  type: 'audio' | 'video';
  quality?: '480p' | '720p' | '1080p';
}

export interface VoxNotification {
  id: string;
  type: 'new_message' | 'mention' | 'reaction' | 'channel_invite';
  channelId: string;
  channelName: string;
  senderName: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

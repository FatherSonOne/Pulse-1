// Vox Mode Types - Comprehensive Voice Communication Styles
// Each mode represents a different paradigm for voice messaging

// ============================================
// VOX MODE ENUMERATION
// ============================================

export type VoxMode =
  | 'pulse_radio'      // Broadcast to followers
  | 'voice_threads'    // Async threaded conversations
  | 'team_vox'         // Workspace/team focused
  | 'vox_notes'        // Personal voice memos
  | 'quick_vox'        // One-tap instant communication
  | 'vox_drop';        // Time-capsule scheduled messages
// 'video_vox' was split off into the Glimpse section in 2026-04-27 (sub-stage 1.5c).

// ============================================
// RELAY MODE TAXONOMY (Stage 2.1d.2)
// ============================================
// New top-level mode taxonomy. The legacy VoxMode union is kept for DB
// persistence + existing mode-component internals; RelayMode is the new
// 3-mode taxonomy the user sees and Relay.tsx routes against.

export type RelayMode = 'messages' | 'notes' | 'live';

/**
 * Maps a legacy VoxMode (or 'classic') to its new RelayMode bucket.
 * - quick_vox, voice_threads, team_vox, vox_drop, classic → 'messages'
 * - vox_notes → 'notes'
 * - pulse_radio → 'live'
 */
export const mapVoxToRelay = (vox: VoxMode | 'classic'): RelayMode => {
  switch (vox) {
    case 'vox_notes':
      return 'notes';
    case 'pulse_radio':
      return 'live';
    case 'quick_vox':
    case 'voice_threads':
    case 'team_vox':
    case 'vox_drop':
    case 'classic':
    default:
      return 'messages';
  }
};

// ============================================
// VOX MODE METADATA
// ============================================

export interface VoxModeInfo {
  id: VoxMode;
  name: string;
  tagline: string;
  description: string;
  workflow: string[];
  icon: string;
  features: string[];
  bestFor: string[];
}

export const VOX_MODES: Record<VoxMode, VoxModeInfo> = {
  pulse_radio: {
    id: 'pulse_radio',
    name: 'Pulse Radio',
    tagline: 'Broadcast Your Voice',
    description: 'Create audio broadcasts that reach your followers. Think podcast meets walkie-talkie - share updates, announcements, or thoughts with your entire network.',
    workflow: [
      'Select or create a channel',
      'Record your broadcast message',
      'Add tags and categories',
      'Choose visibility (public/private)',
      'Publish to your followers',
      'Track listens and engagement'
    ],
    icon: '📻',
    features: [
      'Multi-channel broadcasting',
      'Follower subscriptions',
      'Listen analytics',
      'Scheduled broadcasts',
      'Episode series support'
    ],
    bestFor: [
      'Team announcements',
      'Thought leadership',
      'Company updates',
      'Educational content'
    ]
  },
  voice_threads: {
    id: 'voice_threads',
    name: 'Voice Threads',
    tagline: 'Conversations That Flow',
    description: 'Async voice conversations with threaded replies. Like iMessage but audio-first - reply to specific messages, create branching discussions, and keep context intact.',
    workflow: [
      'Start or join a conversation',
      'Record your message',
      'Reply to specific voice notes',
      'View full transcripts',
      'Jump to any timestamp',
      'Branch into sub-threads'
    ],
    icon: '💬',
    features: [
      'Threaded replies',
      'Timestamp jumping',
      'Full transcriptions',
      'Reply-to-specific quotes',
      'Thread summarization'
    ],
    bestFor: [
      'Deep discussions',
      'Async standups',
      'Feedback sessions',
      'Complex topics'
    ]
  },
  team_vox: {
    id: 'team_vox',
    name: 'Team Vox',
    tagline: 'Your Team\'s Voice Hub',
    description: 'Voice-native team communication tied to workspaces. Create channels like Slack but designed for audio - daily standups, async huddles, and voice-first collaboration.',
    workflow: [
      'Select your workspace',
      'Choose or create a channel',
      'Record to the channel',
      'Members get notified',
      'Team reacts and responds',
      'AI summarizes discussions'
    ],
    icon: '👥',
    features: [
      'Workspace channels',
      'Team notifications',
      'Daily standup templates',
      'Meeting recordings',
      'AI action item extraction'
    ],
    bestFor: [
      'Remote teams',
      'Daily standups',
      'Project updates',
      'Team announcements'
    ]
  },
  vox_notes: {
    id: 'vox_notes',
    name: 'Vox Notes',
    tagline: 'Your Voice, Organized',
    description: 'Personal voice memos with AI-powered organization. Capture ideas, thoughts, and reminders. AI automatically tags, categorizes, and links your notes together.',
    workflow: [
      'Hit record to capture',
      'AI transcribes instantly',
      'Auto-tagged by topic',
      'Link to emails/meetings/tasks',
      'Search by content or topic',
      'AI generates summaries'
    ],
    icon: '📝',
    features: [
      'Auto-transcription',
      'Smart tagging',
      'Content linking',
      'Full-text search',
      'AI summarization',
      'Export to text'
    ],
    bestFor: [
      'Meeting notes',
      'Quick ideas',
      'Personal reminders',
      'Brain dumps'
    ]
  },
  quick_vox: {
    id: 'quick_vox',
    name: 'Quick Vox',
    tagline: 'One Tap. Instant Voice.',
    description: 'Lightning-fast voice messaging to your favorites. No menus, no previews - just tap and talk. See when others are recording and get instant delivery.',
    workflow: [
      'Tap favorite contact',
      'Hold to record',
      'Release to send instantly',
      'See delivery status',
      'Get real-time "typing" indicator',
      'Instant push notification'
    ],
    icon: '⚡',
    features: [
      'Favorites bar',
      'Instant send',
      'Live recording indicator',
      'Push notifications',
      'Delivery receipts'
    ],
    bestFor: [
      'Urgent messages',
      'Quick check-ins',
      'Frequent contacts',
      'Real-time coordination'
    ]
  },
  vox_drop: {
    id: 'vox_drop',
    name: 'Vox Drop',
    tagline: 'Messages From the Future',
    description: 'Schedule voice messages for future delivery. Create time capsules for birthdays, reminders, or "open when..." style reveals. Your voice, delivered when it matters.',
    workflow: [
      'Record your message',
      'Choose delivery date/time',
      'Add reveal conditions (optional)',
      'Set recipient(s)',
      'Schedule the drop',
      'Track pending deliveries'
    ],
    icon: '⏰',
    features: [
      'Future scheduling',
      'Recurring deliveries',
      'Conditional reveals',
      'Anniversary reminders',
      'Delivery confirmations'
    ],
    bestFor: [
      'Birthday messages',
      'Scheduled reminders',
      'Future self notes',
      'Surprise reveals'
    ]
  },
};

// ============================================
// PULSE USER & HANDLES
// ============================================

export interface PulseUser {
  id: string;
  handle: string;  // @username
  displayName: string;
  avatarUrl?: string;
  avatarColor: string;
  bio?: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  lastActiveAt: Date;
  settings: PulseUserSettings;
}

export interface PulseUserSettings {
  notificationsEnabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  defaultVoxMode: VoxMode;
  autoPlayIncoming: boolean;
  transcriptionEnabled: boolean;
  privacyLevel: 'public' | 'followers' | 'private';
}

// ============================================
// PULSE RADIO TYPES
// ============================================

export interface PulseChannel {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  avatarUrl?: string;
  coverUrl?: string;
  isPublic: boolean;
  subscriberCount: number;
  totalListens: number;
  category: string;
  tags: string[];
  createdAt: Date;
  lastBroadcastAt?: Date;
}

export interface Broadcast {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  title: string;
  description?: string;
  audioUrl: string;
  duration: number;
  transcript?: string;
  listenCount: number;
  reactionCounts: Record<string, number>;
  isLive: boolean;
  publishedAt: Date;
  scheduledFor?: Date;
  tags: string[];
  episodeNumber?: number;
}

// ============================================
// VOICE THREADS TYPES
// ============================================

export interface VoiceThread {
  id: string;
  participants: string[];  // User IDs
  subject?: string;
  rootMessageId: string;
  messageCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  isArchived: boolean;
}

export interface VoiceThreadMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  audioUrl: string;
  duration: number;
  transcript?: string;
  replyToId?: string;  // ID of message being replied to
  replyToTimestamp?: number;  // Specific timestamp in parent message
  quotedText?: string;  // Quoted transcript text
  createdAt: Date;
  readBy: string[];  // User IDs who have read/listened
}

// ============================================
// TEAM VOX TYPES
// ============================================

export interface VoxWorkspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberIds: string[];
  channels: VoxTeamChannel[];
  avatarUrl?: string;
  createdAt: Date;
}

export interface VoxTeamChannel {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: 'general' | 'standup' | 'announcement' | 'project';
  memberIds: string[];  // Subset of workspace members
  lastMessageAt?: Date;
  unreadCount: number;
  isPinned: boolean;
}

export interface TeamVoxMessage {
  id: string;
  channelId: string;
  workspaceId: string;
  senderId: string;
  senderName: string;
  audioUrl: string;
  duration: number;
  transcript?: string;
  messageType: 'normal' | 'standup' | 'announcement';
  actionItems?: string[];
  mentions: string[];  // User IDs mentioned
  reactions: Record<string, string[]>;  // emoji -> user IDs
  createdAt: Date;
}

// ============================================
// VOX NOTES TYPES
// ============================================

export interface VoxNote {
  id: string;
  userId: string;
  audioUrl: string;
  duration: number;
  transcript: string;
  title?: string;  // Auto-generated or manual
  summary?: string;  // AI-generated summary
  tags: string[];  // Auto-generated and manual
  linkedItems: LinkedItem[];
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LinkedItem {
  type: 'email' | 'meeting' | 'task' | 'contact' | 'note';
  id: string;
  title: string;
  linkedAt: Date;
}

// ============================================
// QUICK VOX TYPES
// ============================================

export interface QuickVoxFavorite {
  userId: string;
  contactId: string;  // Pulse user ID
  contactHandle: string;
  contactName: string;
  avatarColor: string;
  position: number;  // Order in favorites bar
  lastVoxAt?: Date;
}

export interface QuickVoxMessage {
  id: string;
  senderId: string;
  recipientId: string;
  audioUrl: string;
  duration: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'played';
  createdAt: Date;
  deliveredAt?: Date;
  playedAt?: Date;
}

export interface QuickVoxStatus {
  recipientId: string;
  isRecording: boolean;
  isOnline: boolean;
  lastSeen?: Date;
}

// ============================================
// VOX DROP TYPES
// ============================================

export interface VoxDrop {
  id: string;
  senderId: string;
  recipientIds: string[];
  audioUrl: string;
  duration: number;
  transcript?: string;
  title?: string;
  message?: string;  // Text message accompanying the vox
  scheduledFor: Date;
  deliveredAt?: Date;
  status: 'scheduled' | 'delivered' | 'opened' | 'expired';
  revealCondition?: RevealCondition;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  createdAt: Date;
}

export interface RevealCondition {
  type: 'date' | 'location' | 'event' | 'custom';
  value: string;
  description: string;
}

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  occurrences?: number;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export interface VoxNotification {
  id: string;
  userId: string;
  type: 'new_vox' | 'reaction' | 'reply' | 'mention' | 'broadcast' | 'vox_drop';
  title: string;
  body: string;
  relatedVoxId?: string;
  senderId?: string;
  senderName?: string;
  isRead: boolean;
  createdAt: Date;
}

// ============================================
// DELIVERY & RECEIPT TYPES
// ============================================

export interface VoxDeliveryStatus {
  voxId: string;
  recipientId: string;
  status: 'pending' | 'delivered' | 'failed';
  deliveredAt?: Date;
  playedAt?: Date;
  error?: string;
}

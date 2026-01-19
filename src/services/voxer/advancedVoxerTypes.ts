// Advanced Voxer Types
// Comprehensive type definitions for all advanced features

// ============================================
// VOX REACTIONS
// ============================================

export type ReactionType = 
  | 'laugh' 
  | 'wow' 
  | 'agree' 
  | 'disagree' 
  | 'love' 
  | 'think' 
  | 'question' 
  | 'celebrate'
  | 'custom';

export interface VoxReaction {
  id: string;
  voxId: string;
  userId: string;
  userName: string;
  type: ReactionType;
  audioUrl?: string;  // For custom voice reactions
  audioDuration?: number;
  timestamp: Date;
  emoji: string;
}

export const REACTION_EMOJIS: Record<ReactionType, string> = {
  laugh: '😂',
  wow: '😮',
  agree: '👍',
  disagree: '👎',
  love: '❤️',
  think: '🤔',
  question: '❓',
  celebrate: '🎉',
  custom: '🎤',
};

export const REACTION_SOUNDS: Record<ReactionType, string> = {
  laugh: 'Haha!',
  wow: 'Wow!',
  agree: 'Yes!',
  disagree: 'Hmm...',
  love: 'Love it!',
  think: 'Interesting...',
  question: 'What?',
  celebrate: 'Woohoo!',
  custom: '',
};

// ============================================
// AI VOICE COACH
// ============================================

export interface VoiceCoachAnalysis {
  id: string;
  recordingId: string;
  overallScore: number;  // 0-100
  
  // Speaking metrics
  speakingPace: {
    wordsPerMinute: number;
    rating: 'too_slow' | 'slow' | 'good' | 'fast' | 'too_fast';
    suggestion?: string;
  };
  
  // Filler words
  fillerWords: {
    count: number;
    words: Array<{ word: string; count: number; timestamps: number[] }>;
    percentageOfSpeech: number;
    suggestion?: string;
  };
  
  // Clarity
  clarity: {
    score: number;  // 0-100
    issues: string[];
    suggestion?: string;
  };
  
  // Confidence
  confidence: {
    score: number;  // 0-100
    indicators: string[];
    suggestion?: string;
  };
  
  // Tone
  tone: {
    primary: 'professional' | 'casual' | 'urgent' | 'friendly' | 'formal' | 'uncertain';
    appropriateness: 'good' | 'adjust' | 'reconsider';
    suggestion?: string;
  };
  
  // Energy
  energy: {
    level: 'low' | 'moderate' | 'high';
    consistency: boolean;
    suggestion?: string;
  };
  
  // Improvements
  improvements: VoiceImprovement[];
  
  // Example rephrasing
  rephrasedVersion?: string;
  
  timestamp: Date;
}

export interface VoiceImprovement {
  type: 'pace' | 'filler' | 'clarity' | 'confidence' | 'tone' | 'energy' | 'structure';
  priority: 'low' | 'medium' | 'high';
  issue: string;
  suggestion: string;
  example?: string;
}

// ============================================
// PRIORITY VOX / EMERGENCY BROADCAST
// ============================================

export type PriorityLevel = 'normal' | 'important' | 'urgent' | 'emergency';

export interface PriorityVox {
  id: string;
  voxId: string;
  priorityLevel: PriorityLevel;
  requiresAcknowledgment: boolean;
  acknowledgedBy: Array<{
    userId: string;
    userName: string;
    timestamp: Date;
  }>;
  bypassSilentMode: boolean;
  expiresAt?: Date;
  flashAlert: boolean;
  repeatCount: number;  // How many times to play
  createdAt: Date;
}

export const PRIORITY_CONFIG: Record<PriorityLevel, {
  color: string;
  icon: string;
  soundEffect: boolean;
  bypassSilent: boolean;
  requiresAck: boolean;
}> = {
  normal: {
    color: 'zinc',
    icon: 'fa-circle',
    soundEffect: false,
    bypassSilent: false,
    requiresAck: false,
  },
  important: {
    color: 'blue',
    icon: 'fa-exclamation-circle',
    soundEffect: true,
    bypassSilent: false,
    requiresAck: false,
  },
  urgent: {
    color: 'orange',
    icon: 'fa-exclamation-triangle',
    soundEffect: true,
    bypassSilent: true,
    requiresAck: true,
  },
  emergency: {
    color: 'red',
    icon: 'fa-circle-radiation',
    soundEffect: true,
    bypassSilent: true,
    requiresAck: true,
  },
};

// ============================================
// VOX THREADS
// ============================================

export interface VoxThread {
  id: string;
  parentVoxId: string;
  parentTimestamp?: number;  // Specific moment being replied to (in seconds)
  replies: VoxThreadReply[];
  createdAt: Date;
  lastActivityAt: Date;
  participantIds: string[];
}

export interface VoxThreadReply {
  id: string;
  threadId: string;
  parentReplyId?: string;  // For nested replies
  voxId: string;
  userId: string;
  userName: string;
  userAvatarColor: string;
  audioUrl: string;
  duration: number;
  transcription?: string;
  timestamp: Date;
  reactions: VoxReaction[];
  depth: number;  // Nesting level
}

// ============================================
// TIME CAPSULE VOXES
// ============================================

export type TimeCapsuleRecurrence = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface TimeCapsuleVox {
  id: string;
  voxId: string;
  senderId: string;
  recipientIds: string[];
  scheduledFor: Date;
  recurrence: TimeCapsuleRecurrence;
  title?: string;
  message?: string;  // Optional text message with the vox
  occasion?: string;  // 'birthday', 'anniversary', 'reminder', 'check-in', 'custom'
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  createdAt: Date;
  sentAt?: Date;
  notifyBeforeSend?: number;  // Minutes before to notify sender
}

// ============================================
// VOICE BOOKMARKS
// ============================================

export interface VoiceBookmark {
  id: string;
  voxId: string;
  userId: string;
  timestamp: number;  // Position in seconds
  label: string;
  color: string;
  note?: string;
  tags?: string[];
  createdAt: Date;
}

export interface BookmarkCollection {
  id: string;
  name: string;
  description?: string;
  bookmarks: VoiceBookmark[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SILENT MODE / TRANSCRIPTION MODE
// ============================================

export interface SilentModeSettings {
  enabled: boolean;
  autoTranscribe: boolean;
  showNotifications: boolean;
  vibrate: boolean;
  textToSpeechReply: boolean;  // Convert typed replies to voice
  quickReplies: string[];
  schedule?: {
    enabled: boolean;
    startTime: string;  // HH:mm
    endTime: string;
    days: number[];  // 0-6 for Sunday-Saturday
  };
}

export interface TranscriptionModeMessage {
  id: string;
  voxId: string;
  transcription: string;
  confidence: number;
  sender: string;
  timestamp: Date;
  isRead: boolean;
  replied: boolean;
  replyText?: string;
}

// ============================================
// VOX PLAYLISTS
// ============================================

export interface VoxPlaylist {
  id: string;
  name: string;
  description?: string;
  coverColor: string;
  icon: string;
  items: VoxPlaylistItem[];
  createdBy: string;
  isPublic: boolean;
  isSmartPlaylist: boolean;
  smartCriteria?: SmartPlaylistCriteria;
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoxPlaylistItem {
  id: string;
  playlistId: string;
  voxId: string;
  addedAt: Date;
  addedBy: string;
  note?: string;
  order: number;
}

export interface SmartPlaylistCriteria {
  includeStarred?: boolean;
  includeWithActions?: boolean;
  fromContacts?: string[];
  dateRange?: { start: Date; end: Date };
  minDuration?: number;
  maxDuration?: number;
  sentiment?: string[];
  tags?: string[];
  searchQuery?: string;
}

// Default playlists
export const DEFAULT_PLAYLISTS: Partial<VoxPlaylist>[] = [
  { name: 'Starred', icon: 'fa-star', coverColor: 'bg-yellow-500', isSmartPlaylist: true, smartCriteria: { includeStarred: true } },
  { name: 'Action Items', icon: 'fa-check-circle', coverColor: 'bg-emerald-500', isSmartPlaylist: true, smartCriteria: { includeWithActions: true } },
  { name: 'This Week', icon: 'fa-calendar-week', coverColor: 'bg-blue-500', isSmartPlaylist: true },
  { name: 'Long Messages', icon: 'fa-clock', coverColor: 'bg-purple-500', isSmartPlaylist: true, smartCriteria: { minDuration: 60 } },
];

// ============================================
// COLLABORATIVE VOX
// ============================================

export interface CollaborativeVox {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'recording' | 'review' | 'complete' | 'sent';
  segments: CollabVoxSegment[];
  participants: CollabParticipant[];
  recipientIds: string[];
  totalDuration: number;
  finalAudioUrl?: string;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface CollabVoxSegment {
  id: string;
  collabVoxId: string;
  userId: string;
  userName: string;
  userAvatarColor: string;
  audioUrl: string;
  duration: number;
  order: number;
  status: 'pending' | 'recorded' | 'approved';
  transcription?: string;
  recordedAt?: Date;
}

export interface CollabParticipant {
  userId: string;
  userName: string;
  userAvatarColor: string;
  role: 'creator' | 'contributor';
  hasRecorded: boolean;
  segmentCount: number;
  joinedAt: Date;
}

export interface CollabInvite {
  id: string;
  collabVoxId: string;
  inviterId: string;
  inviteeId: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  respondedAt?: Date;
}

// ============================================
// VOICE COMMANDS HUB
// ============================================

export type VoiceCommandCategory = 
  | 'navigation'
  | 'playback'
  | 'recording'
  | 'messaging'
  | 'search'
  | 'settings'
  | 'ai';

export interface VoiceCommand {
  id: string;
  phrases: string[];  // Different ways to say the command
  category: VoiceCommandCategory;
  action: string;
  description: string;
  parameters?: VoiceCommandParam[];
  requiresConfirmation?: boolean;
  examples: string[];
}

export interface VoiceCommandParam {
  name: string;
  type: 'contact' | 'text' | 'number' | 'duration' | 'date';
  required: boolean;
  extractionPattern?: string;
}

export interface VoiceCommandResult {
  success: boolean;
  command?: VoiceCommand;
  parameters?: Record<string, any>;
  response: string;
  action?: () => void;
}

export interface VoiceCommandHistory {
  id: string;
  transcript: string;
  command?: VoiceCommand;
  result: VoiceCommandResult;
  timestamp: Date;
}

// Default voice commands
export const VOICE_COMMANDS: VoiceCommand[] = [
  // Navigation
  {
    id: 'nav-voxer',
    phrases: ['go to voxer', 'open voxer', 'show voxer'],
    category: 'navigation',
    action: 'NAVIGATE_VOXER',
    description: 'Navigate to the Voxer section',
    examples: ['Hey Pulse, go to Voxer'],
  },
  {
    id: 'nav-contacts',
    phrases: ['show contacts', 'open contacts', 'go to contacts'],
    category: 'navigation',
    action: 'NAVIGATE_CONTACTS',
    description: 'Navigate to contacts',
    examples: ['Show my contacts'],
  },
  // Playback
  {
    id: 'play-unread',
    phrases: ['play unread', 'play my messages', 'play new voxes'],
    category: 'playback',
    action: 'PLAY_UNREAD',
    description: 'Play all unread voice messages',
    examples: ['Play my unread voxes', 'Play new messages'],
  },
  {
    id: 'play-from',
    phrases: ['play from', 'play messages from'],
    category: 'playback',
    action: 'PLAY_FROM_CONTACT',
    description: 'Play messages from a specific contact',
    parameters: [{ name: 'contact', type: 'contact', required: true }],
    examples: ['Play voxes from Sarah', 'Play messages from John'],
  },
  {
    id: 'pause',
    phrases: ['pause', 'stop', 'hold on'],
    category: 'playback',
    action: 'PAUSE_PLAYBACK',
    description: 'Pause current playback',
    examples: ['Pause', 'Stop playing'],
  },
  {
    id: 'resume',
    phrases: ['resume', 'continue', 'play'],
    category: 'playback',
    action: 'RESUME_PLAYBACK',
    description: 'Resume playback',
    examples: ['Resume', 'Continue playing'],
  },
  {
    id: 'skip',
    phrases: ['skip', 'next', 'skip this'],
    category: 'playback',
    action: 'SKIP_VOX',
    description: 'Skip to next message',
    examples: ['Skip this', 'Next message'],
  },
  {
    id: 'replay',
    phrases: ['replay', 'play again', 'repeat'],
    category: 'playback',
    action: 'REPLAY_VOX',
    description: 'Replay current message',
    examples: ['Replay that', 'Play it again'],
  },
  // Recording
  {
    id: 'send-vox',
    phrases: ['send vox to', 'record for', 'send message to'],
    category: 'recording',
    action: 'START_RECORDING_TO',
    description: 'Start recording a vox for someone',
    parameters: [{ name: 'contact', type: 'contact', required: true }],
    examples: ['Send a vox to Sarah', 'Record for John'],
  },
  {
    id: 'start-recording',
    phrases: ['start recording', 'record', 'begin recording'],
    category: 'recording',
    action: 'START_RECORDING',
    description: 'Start recording',
    examples: ['Start recording'],
  },
  {
    id: 'stop-recording',
    phrases: ['stop recording', 'done', 'send it', 'finish'],
    category: 'recording',
    action: 'STOP_RECORDING',
    description: 'Stop recording and send',
    examples: ['Stop recording', 'Send it'],
  },
  // AI Commands
  {
    id: 'summarize',
    phrases: ['summarize', 'give me a summary', 'whats the summary'],
    category: 'ai',
    action: 'SUMMARIZE_MESSAGES',
    description: 'Summarize recent messages',
    examples: ['Summarize today\'s messages', 'Give me a summary'],
  },
  {
    id: 'summarize-from',
    phrases: ['summarize from', 'what did say'],
    category: 'ai',
    action: 'SUMMARIZE_FROM_CONTACT',
    description: 'Summarize messages from a contact',
    parameters: [{ name: 'contact', type: 'contact', required: true }],
    examples: ['Summarize messages from Sarah', 'What did John say?'],
  },
  // Search
  {
    id: 'search',
    phrases: ['search for', 'find', 'look for'],
    category: 'search',
    action: 'SEARCH_VOXES',
    description: 'Search voice messages',
    parameters: [{ name: 'query', type: 'text', required: true }],
    examples: ['Search for budget discussion', 'Find messages about the project'],
  },
  // Settings
  {
    id: 'silent-mode',
    phrases: ['silent mode', 'go silent', 'mute'],
    category: 'settings',
    action: 'TOGGLE_SILENT_MODE',
    description: 'Toggle silent mode',
    examples: ['Enable silent mode', 'Go silent'],
  },
];

// ============================================
// WAKE WORD DETECTION
// ============================================

export interface WakeWordConfig {
  enabled: boolean;
  wakeWord: string;  // Default: "Hey Pulse"
  sensitivity: 'low' | 'medium' | 'high';
  confirmationSound: boolean;
  listenTimeout: number;  // Seconds to listen after wake word
}

export const DEFAULT_WAKE_WORD_CONFIG: WakeWordConfig = {
  enabled: true,
  wakeWord: 'Hey Pulse',
  sensitivity: 'medium',
  confirmationSound: true,
  listenTimeout: 10,
};

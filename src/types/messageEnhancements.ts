// Message Enhancements Types
// Centralized type definitions for all message enhancement features

export interface MessageThread {
  id: string;
  parentMessageId: string;
  title: string;
  messageCount: number;
  participants: string[];
  lastActivity: Date;
  isCollapsed: boolean;
  color?: string;
}

export interface MessageMood {
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent' | 'question';
  confidence: number;
  emoji: string;
  color: string;
  label: string;
}

export interface RichMessageCard {
  type: 'link' | 'code' | 'calendar' | 'task' | 'poll' | 'file';
  title?: string;
  description?: string;
  image?: string;
  metadata: Record<string, any>;
}

export interface SmartComposeSuggestion {
  text: string;
  confidence: number;
  context: string;
  type: 'complete' | 'rephrase' | 'time' | 'action';
}

export interface AICoachSuggestion {
  type: 'tone' | 'clarity' | 'timing' | 'follow-up' | 'conflict';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestion?: string;
  alternativeText?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: 'task' | 'meeting' | 'decision' | 'link' | 'note';
  shortcut?: string;
}

export interface LiveCollaborator {
  userId: string;
  userName: string;
  avatarColor: string;
  activity: 'reading' | 'typing' | 'mentioned';
  timestamp: Date;
}

export interface MessageVote {
  messageId: string;
  question: string;
  options: VoteOption[];
  voters: string[];
  status: 'open' | 'closed';
  threshold?: number;
  consensus?: string;
}

export interface VoteOption {
  id: string;
  label: string;
  emoji: string;
  votes: string[];
}

export interface CollaborativeEdit {
  messageId: string;
  originalText: string;
  currentText: string;
  edits: EditHistory[];
  contributors: string[];
}

export interface EditHistory {
  userId: string;
  userName: string;
  change: string;
  timestamp: Date;
  type: 'edit' | 'addition' | 'context';
}

export interface MessageChain {
  id: string;
  title: string;
  participants: ChainParticipant[];
  currentIndex: number;
  status: 'active' | 'completed' | 'blocked';
  deadline?: Date;
}

export interface ChainParticipant {
  userId: string;
  userName: string;
  order: number;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: Date;
  contribution?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'communication' | 'collaboration' | 'productivity' | 'social';
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface ConversationHealth {
  score: number; // 0-100
  responseTime: {
    average: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  engagement: {
    level: 'low' | 'medium' | 'high';
    participationRate: number;
  };
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    trend: 'improving' | 'stable' | 'declining';
  };
  productivity: {
    tasksCreated: number;
    decisionsCount: number;
    actionItemsCreated: number;
  };
  communicationStyle: 'collaborative' | 'directive' | 'informational';
  issues: string[];
  recommendations: string[];
}

export interface MessageImpact {
  messageId: string;
  score: number; // 0-10
  immediateReaders: number;
  totalReaders: number;
  decisionsGenerated: number;
  actionsGenerated: number;
  referencedCount: number;
  crossChannelMentions: number;
  engagementRate: number;
}

export interface NetworkNode {
  userId: string;
  userName: string;
  messageCount: number;
  connections: string[];
  role: 'hub' | 'bridge' | 'peripheral' | 'isolated';
}

export interface ConversationMemory {
  conversationId: string;
  patterns: {
    commonTopics: string[];
    usualParticipants: string[];
    typicalDeadlines: string[];
    frequentLinks: string[];
  };
  milestones: Milestone[];
  dna: string; // Unique identifier for conversation type
}

export interface Milestone {
  date: Date;
  event: string;
  description: string;
  participants: string[];
}

export interface CustomTemplate {
  id: string;
  name: string;
  content: string;
  variables: TemplateVariable[];
  category: string;
  isShared: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'date' | 'time' | 'user' | 'number';
  defaultValue?: string;
  required: boolean;
}

export interface MessageTranslation {
  originalLanguage: string;
  targetLanguage: string;
  originalText: string;
  translatedText: string;
  confidence: number;
  preservedTone: boolean;
}

export interface ProactiveInsight {
  type: 'prediction' | 'preparation' | 'connection' | 'blocker';
  title: string;
  description: string;
  suggestedActions: string[];
  relevantDocs: string[];
  relatedPeople: string[];
  confidence: number;
}

export interface MessageTheme {
  id: string;
  name: string;
  bubbleColor: string;
  bubbleGradient?: string;
  textColor: string;
  backgroundColor: string;
  accentColor: string;
  borderRadius: string;
  isDefault?: boolean;
}

export interface GifMemeData {
  type: 'gif' | 'meme';
  url: string;
  query: string;
  template?: string;
  topText?: string;
  bottomText?: string;
}

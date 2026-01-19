
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  MESSAGES = 'MESSAGES',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  VOXER = 'VOXER',
  CALENDAR = 'CALENDAR',
  MEETINGS = 'MEETINGS',
  CONTACTS = 'CONTACTS',
  LIVE = 'LIVE',
  LIVE_AI = 'LIVE_AI',
  TOOLS = 'TOOLS',
  ARCHIVES = 'ARCHIVES',
  SETTINGS = 'SETTINGS',
  MESSAGE_ADMIN = 'MESSAGE_ADMIN',
  MESSAGE_ANALYTICS = 'MESSAGE_ANALYTICS',
  MULTI_MODAL = 'MULTI_MODAL',
  TEST_MATRIX = 'TEST_MATRIX',
  ANALYTICS = 'ANALYTICS'
}

export interface MessageLog {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
}

export interface ConnectedProviders {
  google: boolean;
  microsoft: boolean;
  icloud: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  googleConnected: boolean;
  connectedProviders: ConnectedProviders;
  role?: 'admin' | 'moderator' | 'user';
  isAdmin?: boolean;
}

export type ContactType = 'team' | 'client' | 'volunteer' | 'vendor' | 'other';

export interface Contact {
  id: string;
  name: string;
  role: string;
  company?: string;
  avatarColor: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  caseNotes?: string;
  website?: string;
  birthday?: string;
  groups?: string[];
  source: 'local' | 'google' | 'vision';
  lastSynced?: Date;
  contactType?: ContactType; // team, client, volunteer, vendor, other
  isTeamMember?: boolean; // Quick flag for team members
  pulseUserId?: string; // If linked to a Pulse user account
}

export interface CalendarEventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  organizer?: boolean;
  self?: boolean;
}

export interface CalendarEventReminders {
  useDefault: boolean;
  overrides?: Array<{ method: string; minutes: number }>;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  description?: string;
  location?: string;
  attendees?: string[];
  calendarId: string;
  allDay: boolean;
  type: 'event' | 'meet' | 'reminder' | 'call' | 'deadline';
  // Google Calendar specific fields
  googleEventId?: string;
  meetLink?: string;
  source?: 'local' | 'google';
  htmlLink?: string;
  recurrence?: string[];
  reminders?: CalendarEventReminders;
  creator?: { email: string; displayName?: string };
  organizer?: { email: string; displayName?: string };
  attendeesDetailed?: CalendarEventAttendee[];
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: Date;
  listId: string;
  assigneeId?: string; // New: Who owns this task
  originMessageId?: string; // New: Link back to chat
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface Email {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  body: string;
  date: Date;
  read: boolean;
  provider: 'google' | 'microsoft' | 'icloud';
  folder: 'inbox' | 'sent' | 'spam';
  labels?: string[];
}

export type ArchiveType = 'transcript' | 'meeting_note' | 'journal' | 'summary' | 'vox_transcript' | 'decision_log' | 'artifact' | 'research' | 'image' | 'video' | 'document' | 'war_room_session';

export interface ArchiveItem {
  id: string;
  type: ArchiveType;
  title: string;
  content: string;
  date: Date;
  tags: string[];
  relatedContactId?: string;
  decisionStatus?: 'approved' | 'rejected'; // For decision logs
  // Extended fields for enhanced archives
  collectionId?: string;
  smartFolderIds?: string[];
  driveFileId?: string; // Google Drive file ID if exported
  driveFolderId?: string; // Google Drive folder ID
  fileUrl?: string; // URL for images/videos/documents
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  aiTags?: string[]; // Auto-generated tags
  relatedItemIds?: string[]; // AI-detected related items
  sentiment?: 'positive' | 'neutral' | 'negative';
  aiSummary?: string;
  exportedAt?: Date;
  pinnedAt?: Date;
  starred?: boolean;
  viewCount?: number;
  lastViewedAt?: Date;
  // Team/sharing fields
  visibility?: 'private' | 'team' | 'enterprise';
  sharedWith?: string[]; // User IDs
  createdBy?: string;
  updatedAt?: Date;
}

// Archive Collections
export interface ArchiveCollection {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  visibility?: 'private' | 'team' | 'enterprise';
  pinnedAt?: Date;
}

// Smart Folders with auto-rules
export interface SmartFolderRule {
  field: 'type' | 'tags' | 'date' | 'contact' | 'content' | 'sentiment';
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'before' | 'after' | 'between' | 'in';
  value: string | string[] | Date | { start: Date; end: Date };
}

export interface SmartFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  rules: SmartFolderRule[];
  ruleOperator: 'and' | 'or'; // How to combine rules
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

// Google Drive Export Types
export interface DriveFolder {
  id: string;
  name: string;
  parentId?: string;
  webViewLink?: string;
}

export interface DriveExportSettings {
  enabled: boolean;
  autoSync: boolean;
  rootFolderId?: string;
  folderStructure: {
    transcripts: string;
    voxTranscripts: string;
    voxSummaries: string;
    meetingNotes: string;
    decisionLogs: string;
    journals: string;
    aiSummaries: string;
    images: string;
    videos: string;
    documents: string;
    artifacts: string;
  };
  lastSyncAt?: Date;
  syncFrequency?: 'realtime' | 'hourly' | 'daily' | 'manual';
}

// Timeline Event for Timeline View
export interface ArchiveTimelineEvent {
  id: string;
  date: Date;
  type: ArchiveType;
  title: string;
  preview: string;
  archiveId: string;
  contactName?: string;
  tags?: string[];
}

// Message Types
export interface Attachment {
  type: 'image' | 'file' | 'audio';
  name: string;
  url?: string;
  size?: string;
  duration?: number; // For audio
}

export interface Reaction {
  emoji: string;
  count: number;
  me: boolean; 
}

// --- Decision Workflow Types ---
export interface DecisionVote {
  userId: string;
  choice: 'approve' | 'reject';
  timestamp: Date;
}

export interface DecisionData {
  type: 'proposal' | 'final';
  status: 'open' | 'approved' | 'rejected';
  votes: DecisionVote[];
  threshold: number; // Number of approvals needed
}

export interface VoiceAnalysis {
  transcription: string;
  summary: string;
  actionItems: string[];
  decisions: string[];
}

export interface Message {
  id: string;
  sender: 'me' | 'other';
  text: string;
  timestamp: Date;
  source?: 'pulse' | 'slack' | 'email' | 'sms'; // Unified Inbox Source
  attachment?: Attachment;
  replyToId?: string;
  reactions?: Reaction[];
  status?: 'sent' | 'delivered' | 'read';
  decisionData?: DecisionData; // New: Decision Object
  relatedTaskId?: string; // New: Inline Task
  voiceAnalysis?: VoiceAnalysis; // Deep Audio Mode
}

// --- Outcome Thread Types ---
export interface ThreadOutcome {
  goal: string;
  status: 'on_track' | 'at_risk' | 'completed' | 'blocked';
  progress: number; // 0-100
  blockers: string[];
}

export interface Thread {
  id: string;
  contactId: string;
  contactName: string;
  avatarColor: string;
  messages: Message[];
  unread: boolean;
  pinned: boolean;
  outcome?: ThreadOutcome; // New: Outcome definition
}

// --- New Context Aware Types ---

export interface DraftAnalysis {
  intent: 'decision' | 'fyi' | 'request' | 'brainstorm' | 'social';
  suggestion: string;
  improvedText: string;
  confidence: number;
}

export interface ThreadContext {
  decisions: string[];
  relatedDocs: { name: string; type: string; url?: string }[];
  keyTopics: string[];
}

export interface CatchUpSummary {
  summary: string;
  decisionsMade: string[];
  blockers: string[];
  actionItems: string[];
}

// --- Attention Intelligence Types ---

export interface AsyncSuggestion {
  detected: boolean;
  type: 'poll' | 'video' | 'doc';
  reason: string;
  template: string;
}

export interface BatchedNotification {
  id: string;
  source: string;
  message: string;
  time: Date;
  priority: 'low' | 'medium';
}

export interface AttentionBudget {
  currentLoad: number; // 0-100
  maxLoad: number;
  status: 'healthy' | 'strained' | 'overloaded';
  batchedCount: number;
}

// --- Social Health & Relationships ---

export interface TeamHealth {
  score: number; // 0-100
  status: 'healthy' | 'at_risk' | 'critical';
  issues: string[]; // e.g., "Unresolved asks", "High load on Sarah"
  reliability: 'high' | 'medium' | 'low';
}

export interface Nudge {
  type: 'follow_up' | 'clarify' | 'de_escalate' | 'praise';
  message: string;
  contextMessageId?: string;
}

export interface HandoffSummary {
  context: string;
  keyDecisions: string[];
  pendingActions: string[];
}

export interface ChannelArtifact {
  id: string;
  title: string;
  overview: string;
  spec: string; // Markdown content
  decisions: string[];
  milestones: string[];
  channelId?: string;
  channelName?: string;
  exportFormat?: 'markdown' | 'pdf' | 'google_doc' | 'google_docs' | 'notion' | 'html';
  status?: 'draft' | 'exported' | 'synced' | 'error' | 'published' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
  externalLink?: string;
  googleDocId?: string;
  notionPageId?: string;
}

// --- Unified Inbox Types ---

export type MessageSource = 'slack' | 'email' | 'sms' | 'pulse' | 'discord' | 'teams' | 'figma' | 'jira';

export interface UnifiedMessage {
  id: string;
  source: MessageSource;
  senderName: string;
  senderId?: string;
  senderEmail?: string;
  text?: string; // Main text content - use text or content
  content?: string; // Alias for text, used by some services
  timestamp: Date;
  channelId?: string;
  channelName?: string;
  threadId?: string;
  isRead?: boolean;
  starred?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  type?: 'text' | 'image' | 'file' | 'voice';
  conversationGraphId?: string;
  tags?: string[];
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationNode {
  id: string;
  type?: 'message' | 'decision' | 'task' | 'artifact';
  data?: UnifiedMessage | Decision | Task | ChannelArtifact;
  parentId?: string;
  childIds?: string[];
  timestamp?: Date;
  // Extended properties used by unifiedInboxService
  messages?: UnifiedMessage[];
  participantIds?: string[];
  participantNames?: string[];
  title?: string;
  lastMessage?: UnifiedMessage;
  updatedAt?: Date;
  source?: MessageSource;
  externalId?: string;
}

export interface ConversationGraph {
  id?: string;
  nodes: Map<string, ConversationNode> | ConversationNode[];
  edges?: { from: string; to: string; relationshipType: string }[];
  rootIds?: string[];
  threadMap?: Map<string, string[]>; // threadId -> messageIds
  deduplicationMap?: Map<string, string[]>;
  createdAt?: Date;
  updatedAt?: Date;
}

// --- Decision Types (Extended) ---

export interface Decision {
  id: string;
  workspace_id: string;
  message_id?: string;
  title: string;
  description?: string;
  decision_type: 'general' | 'technical' | 'product' | 'process';
  status: 'proposed' | 'voting' | 'decided' | 'cancelled';
  proposed_by: string;
  decided_at?: Date;
  created_at: Date;
  updated_at: Date;
  threshold?: number;
  proposal_text?: string;
  final_decision?: string;
  votes?: Vote[];
}

export interface Vote {
  id: string;
  decision_id: string;
  user_id: string;
  vote: 'approve' | 'reject' | 'abstain';
  comment?: string;
  created_at: Date;
}

// --- Outcome Types ---

export interface Outcome {
  id: string;
  workspace_id: string;
  thread_id?: string;
  title: string;
  description?: string;
  status: 'active' | 'achieved' | 'blocked' | 'cancelled';
  progress: number; // 0-100
  target_date?: Date;
  created_at: Date;
  updated_at: Date;
  blockers?: string[];
  key_results?: KeyResult[];
}

export interface KeyResult {
  id: string;
  outcome_id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit?: string;
}

// --- CRM Types ---

export interface CRMConnection {
  id: string;
  provider: 'hubspot' | 'salesforce' | 'pipedrive';
  status: 'connected' | 'disconnected' | 'error';
  lastSynced?: Date;
  apiKey?: string;
}

export interface CRMContact {
  id: string;
  crmId: string;
  provider: 'hubspot' | 'salesforce' | 'pipedrive';
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  dealValue?: number;
  stage?: string;
  lastActivity?: Date;
}

export interface CRMDeal {
  id: string;
  crmId: string;
  provider: 'hubspot' | 'salesforce' | 'pipedrive';
  title: string;
  value: number;
  stage: string;
  contactId?: string;
  closedDate?: Date;
  probability?: number;
}

// --- Extended Contact with images ---

export interface ContactWithImages extends Contact {
  profileImage?: string;
  backgroundImage?: string;
}

// --- Voice/Audio Types ---

export interface VoiceMessage {
  id: string;
  audioUrl: string;
  audioBlob?: Blob;
  duration: number;
  recordedAt: Date;
  status: 'recording' | 'processing' | 'completed' | 'failed';
}

export interface TranscriptionResult {
  id: string;
  voiceMessageId: string;
  transcript: string;
  confidence: number;
  language: string;
  processedAt: Date;
}

export interface TaskFromVoice {
  id: string;
  voiceMessageId: string;
  transcriptionId: string;
  title: string;
  description: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  tags: string[];
}

export interface DecisionFromVoice {
  id: string;
  voiceMessageId: string;
  transcriptionId: string;
  decision: string;
  context: string;
  decisionDate: Date;
  decidedBy: string;
  affectedTeams: string[];
}

export interface VoiceSummary {
  id: string;
  voiceMessageId: string;
  transcriptionId: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  topics: string[];
}

// --- Channel Spec Types ---

export interface ChannelSpec {
  title: string;
  overview: string;
  decisions: DecisionSection[];
  tasks: TaskSection[];
  milestones: MilestoneSection[];
  participants: ParticipantSection[];
  timeline: TimelineEntry[];
  resources: ResourceLink[];
}

export interface DecisionSection {
  id: string;
  title: string;
  description: string;
  decidedBy: string;
  decidedAt: Date;
  relatedMessages: string[];
  impactArea: string;
}

export interface TaskSection {
  id: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: Date;
  status: 'open' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  sourceMessages: string[];
}

export interface MilestoneSection {
  id: string;
  title: string;
  targetDate: Date;
  description: string;
  completionStatus: number;
  dependencies: string[];
}

export interface ParticipantSection {
  id: string;
  name: string;
  role: string;
  email: string;
  contributionCount: number;
}

export interface TimelineEntry {
  date: Date;
  event: string;
  type: 'decision' | 'milestone' | 'task_completed' | 'comment';
}

export interface ResourceLink {
  title: string;
  url: string;
  type: 'document' | 'code' | 'design' | 'reference';
  description: string;
}

// ============================================
// RELATIONSHIP INTELLIGENCE TYPES
// Comprehensive type definitions for relationship management
// ============================================

// ==================== CORE TYPES ====================

export type RelationshipTrend = 'rising' | 'falling' | 'stable';
export type RelationshipType = 'colleague' | 'client' | 'prospect' | 'personal' | 'vendor' | 'unknown';
export type CommunicationFrequency = 'daily' | 'weekly' | 'monthly' | 'sporadic' | 'dormant' | 'unknown';
export type CommunicationStyle = 'formal' | 'casual' | 'brief' | 'detailed';
export type PreferredChannel = 'email' | 'calendar' | 'slack' | 'sms' | 'mixed';
export type ProfileSource = 'email' | 'google_contacts' | 'calendar' | 'manual' | 'import';

export type LeadGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type LeadStatus = 'cold' | 'warming' | 'warm' | 'hot' | 'customer' | 'churned' | 'unknown';

export type AlertType =
  | 'relationship_decay'
  | 'cold_contact'
  | 'warm_lead'
  | 'birthday_reminder'
  | 'anniversary_reminder'
  | 'follow_up_due'
  | 'no_response'
  | 'awaiting_response'
  | 'milestone'
  | 'meeting_prep'
  | 're_engagement'
  | 'vip_activity';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'snoozed' | 'dismissed' | 'actioned' | 'expired';
export type AlertActionType = 'send_email' | 'schedule_meeting' | 'make_call' | 'send_message' | 'review' | 'dismiss';

export type SmartListType =
  | 'needs_follow_up'
  | 'warm_leads'
  | 'inactive_30_days'
  | 'vip'
  | 'hot_leads'
  | 'at_risk'
  | 'cold_leads'
  | 'recent_contacts'
  | 'company'
  | 'tag'
  | 'custom';

export type SmartGroupType = 'system' | 'ai_suggested' | 'manual' | 'smart_rule' | 'company' | 'tag';

export type InteractionType =
  | 'email_sent'
  | 'email_received'
  | 'meeting_scheduled'
  | 'meeting_attended'
  | 'meeting_declined'
  | 'file_shared'
  | 'file_received'
  | 'call_made'
  | 'call_received'
  | 'slack_sent'
  | 'slack_received'
  | 'sms_sent'
  | 'sms_received';

export type SourceType = 'gmail' | 'calendar' | 'drive' | 'slack' | 'sms' | 'manual';
export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'urgent';
export type MeetingType = 'one_on_one' | 'small_group' | 'large_meeting' | 'recurring' | 'external';

export type MilestoneType =
  | 'first_contact'
  | 'first_meeting'
  | 'email_milestone'
  | 'meeting_milestone'
  | 'anniversary'
  | 'score_milestone'
  | 'converted'
  | 'custom';

// ==================== RELATIONSHIP PROFILE ====================

export interface ExtractedSignature {
  rawText?: string;
  name?: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  extractedAt?: string;
}

export interface RelationshipProfile {
  id: string;
  userId: string;
  contactEmail: string;
  contactName?: string;

  // Relationship Scoring
  relationshipScore: number;
  relationshipTrend: RelationshipTrend;
  relationshipType: RelationshipType;

  // Communication Patterns
  communicationFrequency: CommunicationFrequency;
  preferredChannel: PreferredChannel;
  avgResponseTimeHours?: number;
  responseRate?: number;

  // Interaction Counts
  totalEmailsSent: number;
  totalEmailsReceived: number;
  totalMeetings: number;
  totalSharedFiles: number;
  totalCalls: number;

  // Timestamps
  lastEmailSentAt?: Date;
  lastEmailReceivedAt?: Date;
  lastMeetingAt?: Date;
  lastCallAt?: Date;
  lastInteractionAt?: Date;
  firstInteractionAt?: Date;

  // AI Insights
  aiCommunicationStyle?: CommunicationStyle;
  aiTopics?: string[];
  aiSentimentAverage?: number;
  aiRelationshipSummary?: string;
  aiTalkingPoints?: string[];
  aiNextActionSuggestion?: string;
  aiBuyingSignals?: BuyingSignal[];

  // Enrichment Data
  company?: string;
  title?: string;
  department?: string;
  linkedinUrl?: string;
  twitterHandle?: string;
  phone?: string;
  timezone?: string;
  location?: string;
  extractedSignature?: ExtractedSignature;

  // Deduplication
  canonicalEmail?: string;
  mergedFrom?: string[];
  isMerged: boolean;

  // User Customizations
  customTags?: string[];
  customNotes?: string;
  isFavorite: boolean;
  isVip: boolean;
  isBlocked: boolean;
  birthday?: Date;
  anniversary?: Date;

  // Metadata
  source: ProfileSource;
  createdAt: Date;
  updatedAt: Date;
  lastAnalyzedAt?: Date;
}

// Database row type (snake_case)
export interface RelationshipProfileRow {
  id: string;
  user_id: string;
  contact_email: string;
  contact_name?: string;
  relationship_score: number;
  relationship_trend: string;
  relationship_type: string;
  communication_frequency: string;
  preferred_channel: string;
  avg_response_time_hours?: number;
  response_rate?: number;
  total_emails_sent: number;
  total_emails_received: number;
  total_meetings: number;
  total_shared_files: number;
  total_calls: number;
  last_email_sent_at?: string;
  last_email_received_at?: string;
  last_meeting_at?: string;
  last_call_at?: string;
  last_interaction_at?: string;
  first_interaction_at?: string;
  ai_communication_style?: string;
  ai_topics?: string[];
  ai_sentiment_average?: number;
  ai_relationship_summary?: string;
  ai_talking_points?: string[];
  ai_next_action_suggestion?: string;
  ai_buying_signals?: any[];
  company?: string;
  title?: string;
  department?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  phone?: string;
  timezone?: string;
  location?: string;
  extracted_signature?: any;
  canonical_email?: string;
  merged_from?: string[];
  is_merged: boolean;
  custom_tags?: string[];
  custom_notes?: string;
  is_favorite: boolean;
  is_vip: boolean;
  is_blocked: boolean;
  birthday?: string;
  anniversary?: string;
  source: string;
  created_at: string;
  updated_at: string;
  last_analyzed_at?: string;
}

// ==================== CONTACT INTERACTION ====================

export interface ContactInteraction {
  id: string;
  userId: string;
  profileId: string;
  interactionType: InteractionType;
  interactionDate: Date;

  // Source
  sourceType?: SourceType;
  sourceId?: string;
  threadId?: string;

  // Content
  subject?: string;
  snippet?: string;
  bodyPreview?: string;
  sentiment?: number;
  sentimentLabel?: SentimentLabel;

  // Participants
  participants?: string[];
  participantCount: number;

  // Attachments
  hasAttachment: boolean;
  attachmentCount: number;
  attachmentTypes?: string[];

  // Meeting Specific
  meetingDurationMinutes?: number;
  meetingType?: MeetingType;
  meetingOutcome?: string;

  // Response Tracking
  responseTimeHours?: number;
  isResponse: boolean;
  respondedToId?: string;

  // AI Analysis
  aiTopics?: string[];
  aiActionItems?: string[];
  aiKeyPoints?: string[];

  createdAt: Date;
}

export interface ContactInteractionRow {
  id: string;
  user_id: string;
  profile_id: string;
  interaction_type: string;
  interaction_date: string;
  source_type?: string;
  source_id?: string;
  thread_id?: string;
  subject?: string;
  snippet?: string;
  body_preview?: string;
  sentiment?: number;
  sentiment_label?: string;
  participants?: string[];
  participant_count: number;
  has_attachment: boolean;
  attachment_count: number;
  attachment_types?: string[];
  meeting_duration_minutes?: number;
  meeting_type?: string;
  meeting_outcome?: string;
  response_time_hours?: number;
  is_response: boolean;
  responded_to_id?: string;
  ai_topics?: string[];
  ai_action_items?: string[];
  ai_key_points?: string[];
  created_at: string;
}

// ==================== RELATIONSHIP ALERTS ====================

export interface RelationshipAlert {
  id: string;
  userId: string;
  profileId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  priority: number;

  // Content
  title: string;
  description?: string;
  contextData?: Record<string, any>;

  // Actions
  suggestedAction?: string;
  actionType?: AlertActionType;
  actionTemplate?: string;
  actionData?: Record<string, any>;

  // Status
  status: AlertStatus;
  snoozedUntil?: Date;
  actionedAt?: Date;
  actionedType?: string;
  dismissedReason?: string;

  // Scheduling
  triggerDate?: Date;
  expiresAt?: Date;
  recurring: boolean;
  recurrenceRule?: string;

  createdAt: Date;
  updatedAt: Date;

  // Joined data
  profile?: RelationshipProfile;
}

export interface RelationshipAlertRow {
  id: string;
  user_id: string;
  profile_id?: string;
  alert_type: string;
  severity: string;
  priority: number;
  title: string;
  description?: string;
  context_data?: any;
  suggested_action?: string;
  action_type?: string;
  action_template?: string;
  action_data?: any;
  status: string;
  snoozed_until?: string;
  actioned_at?: string;
  actioned_type?: string;
  dismissed_reason?: string;
  trigger_date?: string;
  expires_at?: string;
  recurring: boolean;
  recurrence_rule?: string;
  created_at: string;
  updated_at: string;
}

// ==================== SMART CONTACT GROUPS ====================

export interface SmartListCriteria {
  type: SmartListType;
  // Needs Follow-up
  daysSinceResponse?: number;
  hasPendingThread?: boolean;
  // Warm/Hot Leads
  minScore?: number;
  maxScore?: number;
  trends?: RelationshipTrend[];
  recentActivity?: boolean;
  hasBuyingSignals?: boolean;
  minLeadScore?: number;
  // Inactive
  daysSinceContact?: number;
  // VIP
  isVip?: boolean;
  // At Risk
  scoreDrop?: number;
  // Company/Tag based
  companyName?: string;
  tags?: string[];
  // Custom rules
  rules?: SmartListRule[];
}

export interface SmartListRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'not_in';
  value: any;
}

export interface SmartContactGroup {
  id: string;
  userId: string;
  name: string;
  description?: string;
  groupType: SmartGroupType;
  criteria: SmartListCriteria;

  // Visual
  icon: string;
  color: string;
  emoji?: string;

  // Membership
  memberProfileIds: string[];
  memberCount: number;

  // AI Metadata
  aiConfidence?: number;
  aiReasoning?: string;
  aiSuggestedAt?: Date;

  // Flags
  isPinned: boolean;
  isSystem: boolean;
  isHidden: boolean;
  autoRefresh: boolean;

  // Timestamps
  lastRefreshedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SmartContactGroupRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  group_type: string;
  criteria: any;
  icon: string;
  color: string;
  emoji?: string;
  member_profile_ids: string[];
  member_count: number;
  ai_confidence?: number;
  ai_reasoning?: string;
  ai_suggested_at?: string;
  is_pinned: boolean;
  is_system: boolean;
  is_hidden: boolean;
  auto_refresh: boolean;
  last_refreshed_at?: string;
  created_at: string;
  updated_at: string;
}

// ==================== LEAD SCORING ====================

export interface BuyingSignal {
  signal: string;
  date: string;
  confidence: number;
  source: string;
  details?: string;
}

export interface ScoreBreakdown {
  engagement: {
    emailsOpened?: number;
    responses?: number;
    clickThrough?: number;
  };
  recency: {
    daysSinceContact: number;
    score: number;
  };
  frequency: {
    interactionsPerWeek: number;
    score: number;
  };
  behavior: {
    buyingSignals: number;
    score: number;
  };
  sentiment: {
    average: number;
    trend: string;
    score: number;
  };
}

export interface ScoreHistoryEntry {
  date: string;
  score: number;
  grade: LeadGrade;
  trigger?: string;
}

export interface LeadScore {
  id: string;
  userId: string;
  profileId: string;

  // Scores
  leadScore: number;
  leadGrade: LeadGrade;
  leadStatus: LeadStatus;

  // Components
  engagementScore: number;
  recencyScore: number;
  frequencyScore: number;
  behaviorScore: number;
  sentimentScore: number;
  scoreBreakdown?: ScoreBreakdown;

  // Buying Signals
  buyingSignals: BuyingSignal[];
  buyingSignalCount: number;
  lastBuyingSignalAt?: Date;

  // Pipeline
  pipelineStage?: string;
  pipelineStageChangedAt?: Date;
  estimatedValue?: number;
  probability?: number;
  expectedCloseDate?: Date;

  // AI Predictions
  aiConversionProbability?: number;
  aiChurnRisk?: number;
  aiNextActionPrediction?: string;
  aiBestContactTime?: string;
  aiPredictedValue?: number;

  // History
  scoreHistory: ScoreHistoryEntry[];

  createdAt: Date;
  updatedAt: Date;
  lastScoredAt?: Date;

  // Joined data
  profile?: RelationshipProfile;
}

export interface LeadScoreRow {
  id: string;
  user_id: string;
  profile_id: string;
  lead_score: number;
  lead_grade: string;
  lead_status: string;
  engagement_score: number;
  recency_score: number;
  frequency_score: number;
  behavior_score: number;
  sentiment_score: number;
  score_breakdown?: any;
  buying_signals: any[];
  buying_signal_count: number;
  last_buying_signal_at?: string;
  pipeline_stage?: string;
  pipeline_stage_changed_at?: string;
  estimated_value?: number;
  probability?: number;
  expected_close_date?: string;
  ai_conversion_probability?: number;
  ai_churn_risk?: number;
  ai_next_action_prediction?: string;
  ai_best_contact_time?: string;
  ai_predicted_value?: number;
  score_history: any[];
  created_at: string;
  updated_at: string;
  last_scored_at?: string;
}

// ==================== MEETING PREP CARDS ====================

export interface AttendeeProfile {
  profileId?: string;
  email: string;
  name?: string;
  relationshipScore?: number;
  relationshipType?: RelationshipType;
  lastInteraction?: Date;
  company?: string;
  title?: string;
}

export interface RecentEmailSummary {
  id: string;
  subject: string;
  date: Date;
  snippet: string;
  sentiment?: SentimentLabel;
}

export interface RecentMeetingSummary {
  id: string;
  title: string;
  date: Date;
  notes?: string;
  outcome?: string;
}

export interface SharedFileSummary {
  id: string;
  name: string;
  date: Date;
  type: string;
}

export interface MeetingPrepCard {
  id: string;
  userId: string;
  calendarEventId: string;

  // Event Info
  eventTitle: string;
  eventDescription?: string;
  eventStart: Date;
  eventEnd?: Date;
  eventLocation?: string;
  eventType?: MeetingType;

  // Attendees
  attendeeProfiles: AttendeeProfile[];
  attendeeCount: number;
  knownAttendees: number;

  // AI Content
  aiSummary?: string;
  aiMeetingPurpose?: string;
  aiTalkingPoints: string[];
  aiQuestionsToAsk: string[];
  aiTopicsToAvoid: string[];
  aiRelationshipNotes: Record<string, { notes: string; lastTopic?: string; sentimentTrend?: string }>;
  aiRecentContext?: string;
  aiFollowUpItems: string[];

  // Historical Context
  recentEmails: RecentEmailSummary[];
  recentMeetings: RecentMeetingSummary[];
  sharedFiles: SharedFileSummary[];
  openActionItems: string[];

  // User Notes
  userNotes?: string;
  userObjectives: string[];

  // Status
  status: 'pending' | 'generated' | 'viewed' | 'used' | 'archived';
  viewedAt?: Date;

  generatedAt: Date;
  updatedAt: Date;
}

export interface MeetingPrepCardRow {
  id: string;
  user_id: string;
  calendar_event_id: string;
  event_title: string;
  event_description?: string;
  event_start: string;
  event_end?: string;
  event_location?: string;
  event_type?: string;
  attendee_profiles: any[];
  attendee_count: number;
  known_attendees: number;
  ai_summary?: string;
  ai_meeting_purpose?: string;
  ai_talking_points: string[];
  ai_questions_to_ask: string[];
  ai_topics_to_avoid: string[];
  ai_relationship_notes: any;
  ai_recent_context?: string;
  ai_follow_up_items: string[];
  recent_emails: any[];
  recent_meetings: any[];
  shared_files: any[];
  open_action_items: string[];
  user_notes?: string;
  user_objectives: string[];
  status: string;
  viewed_at?: string;
  generated_at: string;
  updated_at: string;
}

// ==================== DUPLICATE CONTACTS ====================

export interface DuplicateContact {
  id: string;
  userId: string;
  groupId: string;
  profileId: string;
  matchConfidence: number;
  matchReasons: string[];
  status: 'pending' | 'confirmed' | 'rejected' | 'merged';
  reviewedAt?: Date;
  mergedIntoId?: string;
  createdAt: Date;

  // Joined
  profile?: RelationshipProfile;
}

export interface DuplicateGroup {
  groupId: string;
  profiles: DuplicateContact[];
  suggestedPrimary?: string;
  avgConfidence: number;
}

// ==================== RELATIONSHIP MILESTONES ====================

export interface RelationshipMilestone {
  id: string;
  userId: string;
  profileId: string;
  milestoneType: MilestoneType;
  milestoneValue?: string;
  milestoneDate: Date;
  title: string;
  description?: string;
  celebrationSent: boolean;
  createdAt: Date;

  // Joined
  profile?: RelationshipProfile;
}

// ==================== SERVICE TYPES ====================

export interface ProfileQueryOptions {
  userId: string;
  search?: string;
  relationshipTypes?: RelationshipType[];
  minScore?: number;
  maxScore?: number;
  trends?: RelationshipTrend[];
  frequencies?: CommunicationFrequency[];
  companies?: string[];
  tags?: string[];
  isVip?: boolean;
  isFavorite?: boolean;
  hasRecentActivity?: boolean;
  daysSinceContact?: number;
  sortBy?: 'score' | 'lastInteraction' | 'name' | 'company';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface RelationshipInsights {
  profile: RelationshipProfile;
  healthScore: number;
  healthTrend: RelationshipTrend;
  healthFactors: HealthFactor[];
  suggestions: RelationshipSuggestion[];
  talkingPoints: string[];
  recentTopics: string[];
  sentimentTrend: SentimentLabel;
  nextBestAction: string;
}

export interface HealthFactor {
  factor: string;
  score: number;
  impact: 'positive' | 'neutral' | 'negative';
  description: string;
}

export interface RelationshipSuggestion {
  type: 'action' | 'insight' | 'warning';
  title: string;
  description: string;
  actionType?: AlertActionType;
  priority: number;
}

export interface EmailAggregation {
  totalSent: number;
  totalReceived: number;
  avgResponseTimeHours: number;
  responseRate: number;
  lastEmailSentAt?: Date;
  lastEmailReceivedAt?: Date;
  threads: number;
  sentimentAverage: number;
  topTopics: string[];
}

export interface CalendarAggregation {
  totalMeetings: number;
  totalDuration: number;
  avgMeetingLength: number;
  lastMeetingAt?: Date;
  nextMeetingAt?: Date;
  meetingTypes: Record<string, number>;
}

export interface CreateAlertInput {
  userId: string;
  profileId?: string;
  alertType: AlertType;
  severity?: AlertSeverity;
  priority?: number;
  title: string;
  description?: string;
  suggestedAction?: string;
  actionType?: AlertActionType;
  actionTemplate?: string;
  triggerDate?: Date;
  expiresAt?: Date;
}

// ==================== UI COMPONENT TYPES ====================

export interface SmartListConfig {
  id: SmartListType;
  name: string;
  description: string;
  icon: string;
  color: string;
  criteria: SmartListCriteria;
}

// Smart list counts type for UI display
export type SmartListCounts = Partial<Record<SmartListType, number>>;

export const SYSTEM_SMART_LISTS: SmartListConfig[] = [
  {
    id: 'needs_follow_up',
    name: 'Needs Follow-up',
    description: 'Contacts awaiting your response',
    icon: 'fa-solid fa-clock',
    color: '#8b5cf6',
    criteria: { type: 'needs_follow_up', daysSinceResponse: 7, hasPendingThread: true }
  },
  {
    id: 'warm_leads',
    name: 'Warm Leads',
    description: 'High engagement contacts',
    icon: 'fa-solid fa-fire',
    color: '#f97316',
    criteria: { type: 'warm_leads', minScore: 70, trends: ['rising', 'stable'], recentActivity: true }
  },
  {
    id: 'inactive_30_days',
    name: 'Inactive > 30 Days',
    description: 'No recent interaction',
    icon: 'fa-solid fa-moon',
    color: '#eab308',
    criteria: { type: 'inactive_30_days', daysSinceContact: 30 }
  },
  {
    id: 'vip',
    name: 'VIP Contacts',
    description: 'Your most important contacts',
    icon: 'fa-solid fa-star',
    color: '#eab308',
    criteria: { type: 'vip', isVip: true }
  },
  {
    id: 'hot_leads',
    name: 'Hot Leads',
    description: 'Strong buying signals',
    icon: 'fa-solid fa-arrow-trend-up',
    color: '#ef4444',
    criteria: { type: 'hot_leads', minLeadScore: 80, hasBuyingSignals: true }
  },
  {
    id: 'at_risk',
    name: 'At Risk',
    description: 'Relationships declining',
    icon: 'fa-solid fa-triangle-exclamation',
    color: '#ef4444',
    criteria: { type: 'at_risk', trends: ['falling'], scoreDrop: 15 }
  }
];

// ==================== UTILITY FUNCTIONS ====================

export function getLeadGradeColor(grade: LeadGrade): string {
  switch (grade) {
    case 'A': return '#22c55e'; // green
    case 'B': return '#3b82f6'; // blue
    case 'C': return '#eab308'; // yellow
    case 'D': return '#f97316'; // orange
    case 'F': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
}

export function getRelationshipHealthColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#3b82f6'; // blue
  if (score >= 40) return '#eab308'; // yellow
  if (score >= 20) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'warning': return '#f97316';
    case 'info': return '#3b82f6';
    default: return '#6b7280';
  }
}

export function formatLastInteraction(date?: Date): string {
  if (!date) return 'Never';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export function getTrendIcon(trend: RelationshipTrend): string {
  switch (trend) {
    case 'rising': return 'fa-solid fa-arrow-trend-up';
    case 'falling': return 'fa-solid fa-arrow-trend-down';
    case 'stable': return 'fa-solid fa-minus';
    default: return 'fa-solid fa-minus';
  }
}

export function getTrendColor(trend: RelationshipTrend): string {
  switch (trend) {
    case 'rising': return '#22c55e';
    case 'falling': return '#ef4444';
    case 'stable': return '#6b7280';
    default: return '#6b7280';
  }
}

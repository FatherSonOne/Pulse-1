// =====================================================
// IN-APP MESSAGING SYSTEM - TYPE DEFINITIONS
// OneSignal-style event-based messaging for Pulse
// =====================================================

/**
 * Available trigger events that can show in-app messages
 */
export type TriggerEvent =
  | 'user_signup'           // When user first registers
  | 'first_message_sent'    // User sends their first message
  | 'first_group_joined'    // User joins their first group/workspace
  | 'workspace_created'     // User creates a new workspace
  | 'team_invited'          // User invites team members
  | 'no_activity_24h'       // User hasn't been active in 24 hours
  | 'no_activity_7d'        // User hasn't been active in 7 days
  | 'profile_incomplete'    // User profile is missing key information
  | 'message_sent'          // Any message sent (generic)
  | 'group_created'         // Any group created
  | 'page_view'             // Custom page view event
  | string;                 // Allow custom events

/**
 * User segment targeting options
 */
export type TargetSegment =
  | 'all'                   // Show to all users
  | 'new_users'             // Users who signed up in last 7 days
  | 'active_teams'          // Users in teams with 3+ active members
  | 'dormant_users'         // Users inactive for 7+ days
  | 'custom';               // Custom segment with filter criteria

/**
 * Interaction types for tracking user engagement
 */
export type InteractionType =
  | 'shown'                 // Message was displayed
  | 'clicked'               // User clicked anywhere on message
  | 'cta_clicked'           // User clicked the CTA button
  | 'dismissed';            // User dismissed the message

/**
 * Custom segment filter criteria
 * Allows flexible targeting based on user attributes
 */
export interface SegmentFilter {
  days_since_signup?: string;      // e.g., "< 7", "> 30"
  messages_sent_count?: string;    // e.g., "== 0", "> 10"
  workspaces_joined?: string;      // e.g., ">= 1"
  last_active?: string;            // e.g., "< 24h", "> 7d"
  user_role?: string;              // e.g., "admin", "member"
  [key: string]: any;              // Allow additional custom filters
}

/**
 * In-App Message (Campaign/Template)
 * Represents a message configuration created by admins
 */
export interface InAppMessage {
  id: string;
  title: string;
  body: string;
  cta_text?: string;               // Call-to-action button text
  cta_url?: string;                // Where CTA navigates to

  // Triggering & Targeting
  trigger_event: TriggerEvent;
  target_segment: TargetSegment;
  segment_filter?: SegmentFilter | null;

  // Scheduling
  start_date?: string | null;      // ISO timestamp
  end_date?: string | null;        // ISO timestamp
  active: boolean;

  // Display Settings
  priority: number;                // 0-100, higher shown first
  max_displays_per_user: number;   // Frequency cap
  auto_dismiss_seconds: number;    // Auto-close timer

  // Metadata
  created_by: string;
  created_at: string;              // ISO timestamp
  updated_at: string;              // ISO timestamp
}

/**
 * Message Interaction Record
 * Tracks user engagement with messages
 */
export interface MessageInteraction {
  id: string;
  message_id: string;
  user_id: string;

  // Interaction details
  interaction_type: InteractionType;
  trigger_event: TriggerEvent;
  viewed_duration_seconds?: number | null;

  // Metadata
  created_at: string;              // ISO timestamp
  metadata?: Record<string, any> | null;  // Additional context
}

/**
 * User Retention Cohort
 * Tracks user retention for correlation analysis
 */
export interface UserRetentionCohort {
  id: string;
  user_id: string;
  cohort_date: string;             // ISO date (YYYY-MM-DD)

  // Retention flags
  returned_day_1: boolean;
  returned_day_7: boolean;
  returned_day_30: boolean;

  // Message engagement
  total_messages_seen: number;
  total_messages_clicked: number;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Message Metrics (Analytics)
 * Calculated engagement metrics for a message
 */
export interface MessageMetrics {
  total_shown: number;
  total_clicked: number;
  total_cta_clicked: number;
  total_dismissed: number;

  open_rate: number;               // % (0-100)
  click_rate: number;              // % (0-100)
  cta_conversion_rate: number;     // % (0-100)
  avg_view_duration: number;       // seconds
}

/**
 * Retention By Engagement
 * Cohort analysis of retention based on message engagement
 */
export interface RetentionByEngagement {
  engagement_level: 'High Engagement' | 'Medium Engagement' | 'No Engagement';
  total_users: number;
  day_1_retention_rate: number;    // % (0-100)
  day_7_retention_rate: number;    // % (0-100)
  day_30_retention_rate: number;   // % (0-100)
}

/**
 * Create In-App Message DTO
 * Data transfer object for creating new messages
 */
export interface CreateInAppMessageDTO {
  title: string;
  body: string;
  cta_text?: string;
  cta_url?: string;

  trigger_event: TriggerEvent;
  target_segment: TargetSegment;
  segment_filter?: SegmentFilter;

  start_date?: string;
  end_date?: string;
  active?: boolean;

  priority?: number;
  max_displays_per_user?: number;
  auto_dismiss_seconds?: number;
}

/**
 * Update In-App Message DTO
 * Data transfer object for updating existing messages
 */
export interface UpdateInAppMessageDTO extends Partial<CreateInAppMessageDTO> {
  id: string;
}

/**
 * Track Interaction DTO
 * Data transfer object for recording user interactions
 */
export interface TrackInteractionDTO {
  message_id: string;
  user_id: string;
  interaction_type: InteractionType;
  trigger_event: TriggerEvent;
  viewed_duration_seconds?: number;
  metadata?: Record<string, any>;
}

/**
 * Message Display Context
 * Runtime context for displaying a message
 */
export interface MessageDisplayContext {
  message: InAppMessage;
  user_id: string;
  trigger_event: TriggerEvent;
  metadata?: Record<string, any>;
}

/**
 * Message Queue Item
 * Represents a message waiting to be shown
 */
export interface MessageQueueItem {
  message: InAppMessage;
  context: MessageDisplayContext;
  queued_at: Date;
}

/**
 * Segment Matching Result
 * Result of checking if a user matches a segment
 */
export interface SegmentMatchResult {
  matches: boolean;
  reason?: string;                 // Why it matched/didn't match
}

/**
 * Message Service Configuration
 * Configuration options for the message service
 */
export interface MessageServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableAnalytics?: boolean;
  defaultAutoDismiss?: number;     // Default auto-dismiss seconds
  maxQueueSize?: number;           // Max messages to queue
}

/**
 * Predefined trigger events with descriptions
 * For admin UI display
 */
export const TRIGGER_EVENT_LABELS: Record<string, string> = {
  user_signup: 'New User Signup',
  first_message_sent: 'First Message Sent',
  first_group_joined: 'First Group Joined',
  workspace_created: 'Workspace Created',
  team_invited: 'Team Invited',
  no_activity_24h: 'No Activity (24 hours)',
  no_activity_7d: 'No Activity (7 days)',
  profile_incomplete: 'Profile Incomplete',
  message_sent: 'Message Sent',
  group_created: 'Group Created',
  page_view: 'Page View',
};

/**
 * Predefined segment labels
 * For admin UI display
 */
export const SEGMENT_LABELS: Record<TargetSegment, string> = {
  all: 'All Users',
  new_users: 'New Users (< 7 days)',
  active_teams: 'Active Teams (3+ members)',
  dormant_users: 'Dormant Users (7+ days inactive)',
  custom: 'Custom Segment',
};

/**
 * Priority levels for UI
 */
export const PRIORITY_LEVELS = {
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
  URGENT: 100,
} as const;

/**
 * Default auto-dismiss durations
 */
export const AUTO_DISMISS_PRESETS = [3, 5, 8, 10, 15, 30, 60] as const;

/**
 * Type guard: Check if event is a valid trigger event
 */
export function isTriggerEvent(event: string): event is TriggerEvent {
  return Object.keys(TRIGGER_EVENT_LABELS).includes(event) || typeof event === 'string';
}

/**
 * Type guard: Check if segment is valid
 */
export function isValidSegment(segment: string): segment is TargetSegment {
  return ['all', 'new_users', 'active_teams', 'dormant_users', 'custom'].includes(segment);
}

/**
 * Type guard: Check if interaction type is valid
 */
export function isValidInteractionType(type: string): type is InteractionType {
  return ['shown', 'clicked', 'cta_clicked', 'dismissed'].includes(type);
}

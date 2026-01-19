// ============================================
// TYPE DEFINITIONS FOR IN-APP MESSAGING
// ============================================

/**
 * Event triggers that can show in-app messages
 */
export type MessageEventTrigger =
  | 'user_signup'           // New user registration
  | 'first_message_sent'    // User sent their first message
  | 'first_group_joined'    // User joined their first group
  | 'workspace_created'     // New workspace created
  | 'team_invited'          // User invited team members
  | 'no_activity_24h'       // User hasn't been active for 24 hours
  | 'no_activity_7d'        // User hasn't been active for 7 days
  | 'profile_incomplete'    // User profile is missing info
  | 'message_sent'          // Any message sent (generic)
  | 'group_created'         // New group created
  | 'page_view';            // Custom page view event

/**
 * User segments for targeting
 */
export type UserSegment =
  | 'all'           // All users
  | 'new_users'     // Users who signed up in last 7 days
  | 'active_teams'  // Users in teams with 3+ members who sent messages in last 48h
  | 'dormant_users' // Users who haven't been active in 7+ days
  | 'custom';       // Custom segment with query rules

/**
 * Message display position
 */
export type MessagePosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'center';

/**
 * Message visual style
 */
export type MessageStyleType = 'info' | 'success' | 'warning' | 'tip' | 'error';

/**
 * Main in-app message structure
 */
export interface InAppMessage {
  id: string;

  // Content
  title: string;
  body: string;
  ctaText?: string;        // Call-to-action button text
  ctaUrl?: string;         // Where CTA links to

  // Triggering
  eventTrigger: MessageEventTrigger;

  // Targeting
  segment: UserSegment;
  customSegmentQuery?: CustomSegmentQuery;

  // Scheduling
  startsAt?: Date;
  endsAt?: Date;
  isActive: boolean;

  // Display
  priority: number;
  displayDurationSeconds: number;
  position: MessagePosition;
  styleType: MessageStyleType;

  // Metadata
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Custom segment targeting rules
 */
export interface CustomSegmentQuery {
  conditions: SegmentCondition[];
  operator: 'AND' | 'OR';
}

export interface SegmentCondition {
  field: string;           // e.g., 'days_since_signup', 'message_count', 'team_size'
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
  value: string | number | boolean | (string | number)[];
}

/**
 * User interaction with a message
 */
export interface MessageInteraction {
  id: string;
  messageId: string;
  userId: string;

  // Timestamps
  shownAt: Date;
  openedAt?: Date;
  clickedAt?: Date;
  dismissedAt?: Date;

  // Context
  triggeredBy: string;
  userSegment: string;
  sessionId?: string;
  pageUrl?: string;
  deviceType?: string;

  createdAt: Date;
}

/**
 * Analytics metrics for a message
 */
export interface MessageMetrics {
  messageId: string;
  totalShown: number;
  totalOpened: number;
  totalClicked: number;
  totalDismissed: number;
  openRate: number;          // Percentage
  clickRate: number;         // Percentage
  avgTimeToAction: number;   // Seconds
}

/**
 * Retention tracking for users
 */
export interface UserRetentionCohort {
  id: string;
  userId: string;
  cohortDate: Date;

  // Retention flags
  returnedDay1: boolean;
  returnedDay7: boolean;
  returnedDay30: boolean;

  // Message exposure
  messagesSeenCount: number;
  messagesClickedCount: number;

  lastSeenAt: Date;
  createdAt: Date;
}

/**
 * Retention comparison by message exposure
 */
export interface RetentionByExposure {
  exposedToMessages: boolean;
  day1Retention: number;     // Percentage
  day7Retention: number;     // Percentage
  day30Retention: number;    // Percentage
  userCount: number;
}

/**
 * Message creation/update payload
 */
export interface CreateMessagePayload {
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  eventTrigger: MessageEventTrigger;
  segment: UserSegment;
  customSegmentQuery?: CustomSegmentQuery;
  startsAt?: string;         // ISO string
  endsAt?: string;           // ISO string
  priority?: number;
  displayDurationSeconds?: number;
  position?: MessagePosition;
  styleType?: MessageStyleType;
}

/**
 * Event that triggers message display
 */
export interface TriggerEvent {
  type: MessageEventTrigger;
  userId: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// ============================================
// CONTACT GOAL TYPES
// Keep-in-touch goals + relationship autopilot.
// Part of: Contacts Reimagined — Phase 4
// ============================================

// ==================== GOAL FREQUENCY ====================

export type GoalFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annually';

export interface GoalFrequencyConfig {
  id: GoalFrequency;
  label: string;
  shortLabel: string;
  icon: string;
  daysInterval: number;
}

export const GOAL_FREQUENCY_CONFIG: Record<GoalFrequency, GoalFrequencyConfig> = {
  weekly: {
    id: 'weekly',
    label: 'Every week',
    shortLabel: 'Weekly',
    icon: '📅',
    daysInterval: 7,
  },
  biweekly: {
    id: 'biweekly',
    label: 'Every 2 weeks',
    shortLabel: 'Bi-weekly',
    icon: '🗓️',
    daysInterval: 14,
  },
  monthly: {
    id: 'monthly',
    label: 'Every month',
    shortLabel: 'Monthly',
    icon: '📆',
    daysInterval: 30,
  },
  quarterly: {
    id: 'quarterly',
    label: 'Every 3 months',
    shortLabel: 'Quarterly',
    icon: '🔄',
    daysInterval: 90,
  },
  annually: {
    id: 'annually',
    label: 'Once a year',
    shortLabel: 'Annually',
    icon: '🎂',
    daysInterval: 365,
  },
};

// ==================== CONTACT GOAL ====================

export interface ContactGoal {
  id: string;
  userId: string;
  contactId: string;      // app contact id
  contactEmail: string;   // for profile matching
  frequency: GoalFrequency;
  channel: 'message' | 'call' | 'meeting' | 'email' | 'any';
  notes?: string;         // reminder note shown in Today feed
  autopilotEnabled: boolean;
  nextActionAt: string;   // ISO timestamp for next due date
  lastCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Minimal DB row (snake_case)
export interface ContactGoalRow {
  id: string;
  user_id: string;
  contact_id: string;
  contact_email: string;
  frequency: string;
  channel: string;
  notes?: string | null;
  autopilot_enabled: boolean;
  next_action_at: string;
  last_completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== AUTOPILOT ACTION ====================

export type AutopilotActionType =
  | 'keep_in_touch'
  | 'birthday_reminder'
  | 'follow_up'
  | 'check_in';

export interface AutopilotAction {
  id: string;
  userId: string;
  contactId: string;
  contactName: string;
  contactAvatarColor?: string;
  goalId: string;
  actionType: AutopilotActionType;
  draftMessage?: string;
  channel: ContactGoal['channel'];
  dueAt: string;
  status: 'pending' | 'sent' | 'dismissed';
  createdAt: string;
}

// ==================== GOAL STATUS HELPERS ====================

export function getGoalStatus(goal: ContactGoal): 'on_track' | 'due_soon' | 'overdue' {
  const dueDate = new Date(goal.nextActionAt);
  const now = new Date();
  const msUntilDue = dueDate.getTime() - now.getTime();
  const dayUntilDue = msUntilDue / (1000 * 60 * 60 * 24);

  if (dayUntilDue < 0) return 'overdue';
  if (dayUntilDue <= 3) return 'due_soon';
  return 'on_track';
}

export function formatNextActionDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `In ${days} days`;
  if (days <= 30) return `In ${Math.round(days / 7)} weeks`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function calculateNextActionDate(
  frequency: GoalFrequency,
  fromDate: Date = new Date()
): Date {
  const days = GOAL_FREQUENCY_CONFIG[frequency].daysInterval;
  return new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
}

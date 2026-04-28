// Activity event verb formatter. Produces a human-readable sentence for
// each ActivityEvent. Used by ActivityEventRow.

import type { ActivityEvent } from '../../../services/decisionActivityService';
import type { User } from '../../../types';

function memberName(userId: string | null, members: User[]): string {
  if (!userId) return 'Someone';
  const m = members.find((x) => x.id === userId);
  if (!m) return 'A teammate';
  return (m as User & { full_name?: string }).full_name || m.email || 'Someone';
}

function memberById(userId: string | null | undefined, members: User[]): string {
  if (!userId) return 'someone';
  const m = members.find((x) => x.id === userId);
  if (!m) return 'a teammate';
  return (m as User & { full_name?: string }).full_name || m.email || 'someone';
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
  pending: 'Pending',
  proposed: 'Proposed',
  voting: 'Voting',
  decided: 'Decided',
  archived: 'Archived',
};

function statusLabel(s: string | null): string {
  if (!s) return 'unset';
  return STATUS_LABEL[s] ?? s;
}

export function describeEvent(event: ActivityEvent, members: User[]): string {
  const actor = memberName(event.userId, members);
  const itemNoun = event.source === 'decision' ? 'decision' : 'task';

  switch (event.action) {
    case 'created':
      return `${actor} created the ${itemNoun}`;
    case 'status_changed':
      return `${actor} moved ${itemNoun} from ${statusLabel(event.oldValue)} to ${statusLabel(event.newValue)}`;
    case 'assignee_changed': {
      const newAssignee = memberById(event.newValue, members);
      if (!event.newValue) return `${actor} unassigned the ${itemNoun}`;
      return `${actor} assigned the ${itemNoun} to ${newAssignee}`;
    }
    case 'deadline_changed':
      if (!event.newValue) return `${actor} cleared the deadline`;
      return `${actor} set the deadline to ${formatDate(event.newValue)}`;
    case 'priority_changed':
      return `${actor} set priority to ${(event.newValue ?? '').toLowerCase()}`;
    case 'title_changed':
      return `${actor} renamed the ${itemNoun}`;
    case 'description_changed':
      return `${actor} updated the description`;
    case 'deleted':
      return `${actor} deleted the ${itemNoun}`;
    case 'reopened':
      return `${actor} reopened the ${itemNoun}`;
    case 'archived':
      return `${actor} archived the ${itemNoun}`;
    case 'comment_added':
      return `${actor} commented`;
    case 'vote_cast':
      return `${actor} voted ${event.newValue ? `(${event.newValue})` : ''}`.trim();
    case 'decided':
      return `${actor} marked the decision as Decided`;
    case 'outcome_recorded':
      return `${actor} recorded the outcome`;
    default:
      return `${actor} ${event.action.replace(/_/g, ' ')}`;
  }
}

export function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(iso);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Bucket an event into a date group for the workspace panel. */
export function dateBucket(iso: string): 'today' | 'yesterday' | 'this_week' | 'earlier' {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const then = new Date(iso);
  const startOfThen = new Date(then);
  startOfThen.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((now.getTime() - startOfThen.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'this_week';
  return 'earlier';
}

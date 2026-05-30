/**
 * queueModel — turns the workspace's tasks + decisions into the Triage
 * Cockpit's three queue groups (Needs you / Today / Upcoming).
 *
 * The per-bucket predicates are ported VERBATIM from ActiveView's bucketing so
 * the cockpit queue mirrors today's Active view exactly (handoff §4.3). The
 * 7 strict Active buckets collapse to 3 groups:
 *   Needs you = decisions-needing-your-vote + overdue + blocked
 *   Today     = in_review + in_progress
 *   Upcoming  = todo / pending
 * Strict no-double-render is preserved: overdue excludes blocked/done/cancelled,
 * and the status buckets exclude anything already promoted to overdue.
 */
import { Task } from '../../../../services/taskService';
import { DecisionWithVotes } from '../../../../services/decisionService';
import type { RetrospectivePrompt } from '../../../../services/decisionContextService';

export interface QueueTaskItem { id: string; kind: 'task'; task: Task; }
export interface QueueDecisionItem { id: string; kind: 'decision'; decision: DecisionWithVotes; }
export interface QueueRetroItem { id: string; kind: 'retro'; prompt: RetrospectivePrompt; decisionTitle: string; }
export type QueueEntry = QueueTaskItem | QueueDecisionItem | QueueRetroItem;

export interface QueueGroupModel {
  key: 'needs-you' | 'today' | 'upcoming';
  label: string;
  /** Status-token color for the group dot (NOT coral — status palette). */
  tone: string;
  items: QueueEntry[];
}

const wrapTask = (t: Task): QueueTaskItem => ({ id: `task-${t.id}`, kind: 'task', task: t });
const wrapDecision = (d: DecisionWithVotes): QueueDecisionItem => ({ id: `dec-${d.id}`, kind: 'decision', decision: d });

export function buildQueue(
  tasks: Task[],
  decisions: DecisionWithVotes[],
  currentUserId?: string,
  retros: QueueRetroItem[] = []
): QueueGroupModel[] {
  const now = new Date();

  // Decisions in voting state that the current user hasn't voted on yet.
  const needsVote = decisions.filter((d) => {
    if (d.status !== 'voting') return false;
    return !d.votes?.some((v) => v.user_id === currentUserId);
  });

  // Strict, disjoint task buckets (ActiveView order: blocked, then overdue
  // excluding blocked/done/cancelled, then the rest excluding overdue).
  const blocked = tasks.filter((t) => t.status === 'blocked');
  const overdue = tasks.filter(
    (t) => t.deadline && new Date(t.deadline) < now && !['done', 'cancelled', 'blocked'].includes(t.status)
  );
  const overdueIds = new Set(overdue.map((t) => t.id));
  const inReview = tasks.filter((t) => t.status === 'in_review' && !overdueIds.has(t.id));
  const inProgress = tasks.filter((t) => t.status === 'in_progress' && !overdueIds.has(t.id));
  const todo = tasks.filter(
    (t) => (t.status === 'todo' || t.status === 'pending') && !overdueIds.has(t.id)
  );

  return [
    {
      key: 'needs-you',
      label: 'Needs you',
      tone: 'var(--dt-status-overdue)',
      // Due retrospectives surface first — a look-back is the lightest "needs you".
      items: [...retros, ...needsVote.map(wrapDecision), ...overdue.map(wrapTask), ...blocked.map(wrapTask)],
    },
    {
      key: 'today',
      label: 'Today',
      tone: 'var(--dt-status-in-progress)',
      items: [...inReview.map(wrapTask), ...inProgress.map(wrapTask)],
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      tone: 'var(--dt-status-todo)',
      items: [...todo.map(wrapTask)],
    },
  ];
}

/** Relative deadline label + overdue flag for a task row. */
export function dueInfo(deadline?: string): { label: string; overdue: boolean } | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  const overdue = ms < 0;
  if (overdue) {
    const ad = Math.abs(days);
    return { label: ad === 0 ? 'Overdue' : `${ad}d overdue`, overdue };
  }
  if (days === 0) return { label: 'Due today', overdue };
  if (days === 1) return { label: 'Tomorrow', overdue };
  return { label: `${days}d`, overdue };
}

/** True when a task carries AI provenance (extraction / scoring / generation). */
export function isAIExtracted(task: Task): boolean {
  const m = task.metadata || {};
  return !!(m.ai_priority_score || m.aiScore || m.generated_from_decision || m.generated_from_template || m.ai_extracted);
}

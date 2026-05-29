// createTaskFromEmail — shared bridge from a hybrid EmailRow into the
// extracted_tasks table that DecisionTaskHub reads from. Replaces the
// toast stubs that lived in TriageView (`case '→ Task'`) and
// InlineReader (handleTaskClick + handleCreateTasks) since Phase 12;
// see memory `project_pulse_decisions_tasks_revisit.md` for why this
// waited until Phase 11b.
//
// Two entry points:
//   • createTaskFromEmail(row)         — one task per email. Deduped
//                                        by email id so the T-key
//                                        race during queue advance
//                                        can't double-fire.
//   • createTasksFromEmailItems(...)   — N tasks per email, one per
//                                        ActionItemExtractor item.
//                                        No dedup (user already
//                                        clicked Create explicitly).
//
// The task is linked to its source email via metadata only —
// extracted_tasks.origin_message_id is a FK into pulse_messages, so
// stuffing a Gmail/cache id there would break the constraint.
// `metadata.source` + `metadata.email_*` are the canonical pointer.
import toast from 'react-hot-toast';
import { taskService, type Task } from '../../../../services/taskService';
import { getCurrentWorkspaceId } from '../../../../services/ai/getWorkspaceId';
import { supabase } from '../../../../services/supabaseClient';
import type { EmailRow } from './emailRow';

const inFlight = new Set<string>();

function priorityFromScore(score: number | null | undefined): Task['priority'] {
  if (typeof score !== 'number') return 'medium';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function compactDescription(row: EmailRow): string | undefined {
  const summary = row.aiSummary?.trim();
  if (summary) return summary;
  const raw = row._raw;
  const snippet = raw?.snippet?.trim();
  if (snippet) return snippet;
  const body = (raw?.body_text || row.body || '').trim();
  if (!body) return undefined;
  return body.length > 240 ? body.slice(0, 240).trimEnd() + '…' : body;
}

function emailMetadata(row: EmailRow) {
  const raw = row._raw;
  return {
    source: 'email-cockpit' as const,
    email_id: raw?.id ?? row.id,
    email_thread_id: raw?.thread_id,
    email_gmail_id: raw?.gmail_id,
    email_from: raw?.from_email ?? row.fromEmail,
    email_from_name: raw?.from_name ?? row.from,
    email_subject: raw?.subject ?? row.subject,
    email_received_at: raw?.received_at,
    ai_priority_score: raw?.ai_priority_score,
  };
}

async function resolveContext(): Promise<{ workspaceId: string; userId: string } | null> {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) {
    toast.error('No active workspace — switch into one before creating a task.');
    return null;
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    toast.error('Not signed in — sign in before creating a task.');
    return null;
  }
  return { workspaceId, userId: data.user.id };
}

/**
 * Create one task for an email — wired to the → Task action in Triage
 * + InlineReader. Returns the created Task, or null when blocked by
 * dedup / context / DB failure (caller does not need to re-toast on
 * null; the helper has already surfaced the reason).
 */
export async function createTaskFromEmail(row: EmailRow): Promise<Task | null> {
  const raw = row._raw;
  if (!raw) {
    toast('Mock row — task creation is a no-op here.');
    return null;
  }
  if (inFlight.has(raw.id)) {
    // The 2026-05-28 double-toast bug: T pressed during a queue
    // advance fires twice. Quietly ignore the second instead of
    // raising another toast.
    return null;
  }
  inFlight.add(raw.id);
  try {
    const ctx = await resolveContext();
    if (!ctx) return null;
    const title = row.subject?.trim() || `Follow up with ${row.from}`;
    const task = await taskService.createTask({
      workspace_id: ctx.workspaceId,
      title,
      description: compactDescription(row),
      priority: priorityFromScore(raw.ai_priority_score),
      created_by: ctx.userId,
      metadata: emailMetadata(row),
    });
    if (!task) {
      toast.error('Could not create task — try again.');
      return null;
    }
    toast.success(`Task created: ${title.length > 60 ? title.slice(0, 60) + '…' : title}`);
    return task;
  } finally {
    inFlight.delete(raw.id);
  }
}

export interface ExtractedTaskItem {
  title: string;
  description?: string;
  priority?: Task['priority'];
  assignee_id?: string;
  deadline?: string;
}

/**
 * Batch variant — one task per ActionItemExtractor item, all linked
 * to the same email. No dedup (the extractor's "Create N tasks"
 * button is an explicit one-click; if the user re-clicks, that's
 * intentional). Returns the count actually created so the caller can
 * close the extractor UI on success.
 */
export async function createTasksFromEmailItems(
  row: EmailRow,
  items: ExtractedTaskItem[],
): Promise<number> {
  if (!row._raw) {
    toast('Mock row — task creation is a no-op here.');
    return 0;
  }
  const clean = items.filter((i) => i?.title?.trim());
  if (clean.length === 0) {
    toast('No actionable items to turn into tasks.');
    return 0;
  }
  const ctx = await resolveContext();
  if (!ctx) return 0;
  const meta = emailMetadata(row);
  let created = 0;
  for (const item of clean) {
    const task = await taskService.createTask({
      workspace_id: ctx.workspaceId,
      title: item.title.trim(),
      description: item.description?.trim() || compactDescription(row),
      priority: item.priority ?? priorityFromScore(row._raw.ai_priority_score),
      assignee_id: item.assignee_id,
      deadline: item.deadline,
      created_by: ctx.userId,
      metadata: meta,
    });
    if (task) created += 1;
  }
  if (created === 0) {
    toast.error('No tasks could be created — try again.');
  } else if (created === clean.length) {
    toast.success(`Created ${created} task${created === 1 ? '' : 's'}.`);
  } else {
    toast(`Created ${created} of ${clean.length} tasks — others failed.`);
  }
  return created;
}

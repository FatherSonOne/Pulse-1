// Decision/Task activity service: reads task_activity + decision_activity
// and unions them for the per-item activity drawer and workspace-wide panel.
//
// Phase 2 of Decisions and Tasks overhaul. The backend tables already capture
// most events; this service wires them to the UI. Distinct from the broader
// activityService.ts (which handles security/audit logging across the app).

import { supabase } from './supabase';

export type ActivitySource = 'task' | 'decision';

export type ActivityAction =
  | 'created'
  | 'status_changed'
  | 'assignee_changed'
  | 'deadline_changed'
  | 'priority_changed'
  | 'title_changed'
  | 'description_changed'
  | 'deleted'
  | 'reopened'
  | 'archived'
  | 'comment_added'        // Phase 3
  | 'vote_cast'            // decisions
  | 'decided'              // decisions
  | 'outcome_recorded'     // Phase 4
  | string;

/** Unified activity event combining task_activity + decision_activity. */
export interface ActivityEvent {
  id: string;
  source: ActivitySource;
  /** task_id or decision_id depending on source. */
  itemId: string;
  workspaceId: string;
  userId: string | null;
  action: ActivityAction;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface RawTaskActivity {
  id: string;
  task_id: string;
  workspace_id: string;
  user_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface RawDecisionActivity {
  id: string;
  decision_id: string;
  workspace_id: string;
  user_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function fromTaskRow(row: RawTaskActivity): ActivityEvent {
  return {
    id: row.id,
    source: 'task',
    itemId: row.task_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function fromDecisionRow(row: RawDecisionActivity): ActivityEvent {
  return {
    id: row.id,
    source: 'decision',
    itemId: row.decision_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export const decisionActivityService = {
  /**
   * Fetch the activity for a single decision.
   */
  async getDecisionActivity(decisionId: string, limit = 100): Promise<ActivityEvent[]> {
    const { data, error } = await supabase
      .from('decision_activity')
      .select('*')
      .eq('decision_id', decisionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error loading decision activity:', error);
      return [];
    }
    return (data ?? []).map(fromDecisionRow);
  },

  /**
   * Fetch the activity for a single task.
   */
  async getTaskActivity(taskId: string, limit = 100): Promise<ActivityEvent[]> {
    const { data, error } = await supabase
      .from('task_activity')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error loading task activity:', error);
      return [];
    }
    return (data ?? []).map(fromTaskRow);
  },

  /**
   * Fetch the unified workspace activity feed: tasks + decisions, merged
   * and sorted by created_at desc.
   */
  async getWorkspaceActivity(workspaceId: string, limit = 100): Promise<ActivityEvent[]> {
    const [tasksResult, decisionsResult] = await Promise.all([
      supabase
        .from('task_activity')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('decision_activity')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    const taskRows = (tasksResult.data ?? []).map(fromTaskRow);
    const decisionRows = (decisionsResult.data ?? []).map(fromDecisionRow);

    return [...taskRows, ...decisionRows]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  /**
   * Subscribe to live workspace activity. Calls onEvent for each new row
   * inserted into either table for this workspace. Returns an unsubscribe.
   */
  subscribeToWorkspace(
    workspaceId: string,
    onEvent: (event: ActivityEvent) => void
  ): () => void {
    const tasksChannel = supabase
      .channel(`workspace-task-activity-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_activity',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          onEvent(fromTaskRow(payload.new as RawTaskActivity));
        }
      )
      .subscribe();

    const decisionsChannel = supabase
      .channel(`workspace-decision-activity-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'decision_activity',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          onEvent(fromDecisionRow(payload.new as RawDecisionActivity));
        }
      )
      .subscribe();

    return () => {
      tasksChannel.unsubscribe();
      decisionsChannel.unsubscribe();
    };
  },

  /**
   * Write a decision-activity row. Used by handlers that change decision
   * state (status, vote, decided). Task activity is already written by
   * existing trigger paths in the task service.
   */
  async logDecisionEvent(opts: {
    decisionId: string;
    workspaceId: string;
    userId: string | null;
    action: ActivityAction;
    oldValue?: string | null;
    newValue?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await supabase.from('decision_activity').insert({
      decision_id: opts.decisionId,
      workspace_id: opts.workspaceId,
      user_id: opts.userId,
      action: opts.action,
      old_value: opts.oldValue ?? null,
      new_value: opts.newValue ?? null,
      metadata: opts.metadata ?? {},
    });
    if (error) {
      console.error('Error logging decision event:', error);
    }
  },

  /**
   * Compute the "this week" rollup for the Active view summary strip.
   */
  async getThisWeekRollup(workspaceId: string): Promise<{
    tasksCompleted: number;
    decisionsMade: number;
    overdueCount: number;
  }> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const since = oneWeekAgo.toISOString();

    const [tasksDoneResult, decisionsMadeResult, overdueResult] = await Promise.all([
      supabase
        .from('task_activity')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('action', 'status_changed')
        .eq('new_value', 'done')
        .gte('created_at', since),
      supabase
        .from('decision_activity')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('action', 'decided')
        .gte('created_at', since),
      supabase
        .from('extracted_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .lt('deadline', new Date().toISOString())
        .not('status', 'in', '(done,cancelled)'),
    ]);

    return {
      tasksCompleted: tasksDoneResult.count ?? 0,
      decisionsMade: decisionsMadeResult.count ?? 0,
      overdueCount: overdueResult.count ?? 0,
    };
  },
};

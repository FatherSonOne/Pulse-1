// Dependencies service. Reads from public.task_dependencies (existing table)
// to surface blocks / blocked-by relationships in the UI.
//
// Phase 5 of the Decisions and Tasks overhaul. The table schema is simple:
//   task_id              uuid NOT NULL  -- the dependent
//   depends_on_task_id   uuid NOT NULL  -- the blocker
// So if (X, Y) exists, X is blocked by Y, and Y blocks X.

import { supabase } from './supabase';
import type { Task } from './taskService';

export interface DependencyEdge {
  /** The dependent task. */
  taskId: string;
  /** The blocker. */
  dependsOnTaskId: string;
  createdAt: string | null;
}

export interface DependencySummary {
  /** Tasks this task is blocked by (upstream). */
  blockedBy: Task[];
  /** Tasks this task is blocking (downstream). */
  blocking: Task[];
}

export const dependenciesService = {
  /**
   * Load all task_dependencies edges for a given task in either direction.
   * Then resolve the related task rows from extracted_tasks.
   */
  async getDependencies(taskId: string): Promise<DependencySummary> {
    // Fetch both directions in parallel.
    const [upstreamResult, downstreamResult] = await Promise.all([
      // What blocks this task?
      supabase
        .from('task_dependencies')
        .select('depends_on_task_id')
        .eq('task_id', taskId),
      // What does this task block?
      supabase
        .from('task_dependencies')
        .select('task_id')
        .eq('depends_on_task_id', taskId),
    ]);

    const blockerIds = (upstreamResult.data ?? []).map(
      (r: { depends_on_task_id: string }) => r.depends_on_task_id
    );
    const dependentIds = (downstreamResult.data ?? []).map(
      (r: { task_id: string }) => r.task_id
    );

    const allRelated = Array.from(new Set([...blockerIds, ...dependentIds]));
    if (allRelated.length === 0) {
      return { blockedBy: [], blocking: [] };
    }

    const { data: tasks, error } = await supabase
      .from('extracted_tasks')
      .select('*')
      .in('id', allRelated);

    if (error) {
      console.error('Error loading related tasks:', error);
      return { blockedBy: [], blocking: [] };
    }

    const taskMap = new Map<string, Task>();
    for (const t of (tasks as Task[]) ?? []) {
      taskMap.set(t.id, t);
    }

    return {
      blockedBy: blockerIds.map((id) => taskMap.get(id)).filter((t): t is Task => Boolean(t)),
      blocking: dependentIds.map((id) => taskMap.get(id)).filter((t): t is Task => Boolean(t)),
    };
  },

  async addDependency(taskId: string, dependsOnTaskId: string): Promise<boolean> {
    if (taskId === dependsOnTaskId) return false; // can't depend on yourself
    const { error } = await supabase
      .from('task_dependencies')
      .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId });
    if (error) {
      console.error('Error adding dependency:', error);
      return false;
    }
    return true;
  },

  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<boolean> {
    const { error } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('task_id', taskId)
      .eq('depends_on_task_id', dependsOnTaskId);
    if (error) {
      console.error('Error removing dependency:', error);
      return false;
    }
    return true;
  },

  /**
   * When a task moves to done, find downstream tasks where THIS was the only
   * remaining blocker. Used to surface "Just unblocked" toasts and the auto-
   * promotion section in Active view.
   */
  async getNewlyUnblockedTasks(completedTaskId: string): Promise<Task[]> {
    // Find all tasks that depend on the completed task.
    const { data: dependents } = await supabase
      .from('task_dependencies')
      .select('task_id')
      .eq('depends_on_task_id', completedTaskId);

    const dependentIds = (dependents ?? []).map((r: { task_id: string }) => r.task_id);
    if (dependentIds.length === 0) return [];

    // For each dependent, check if it has any OTHER remaining blockers (not done/cancelled).
    const newlyUnblocked: Task[] = [];
    for (const dependentId of dependentIds) {
      const { data: otherBlockers } = await supabase
        .from('task_dependencies')
        .select('depends_on_task_id')
        .eq('task_id', dependentId)
        .neq('depends_on_task_id', completedTaskId);

      const otherBlockerIds = (otherBlockers ?? []).map(
        (r: { depends_on_task_id: string }) => r.depends_on_task_id
      );

      let stillBlocked = false;
      if (otherBlockerIds.length > 0) {
        const { data: stillOpen } = await supabase
          .from('extracted_tasks')
          .select('id, status')
          .in('id', otherBlockerIds)
          .not('status', 'in', '(done,cancelled)');
        stillBlocked = (stillOpen ?? []).length > 0;
      }

      if (!stillBlocked) {
        const { data: dependent } = await supabase
          .from('extracted_tasks')
          .select('*')
          .eq('id', dependentId)
          .single();
        if (dependent) newlyUnblocked.push(dependent as Task);
      }
    }
    return newlyUnblocked;
  },
};

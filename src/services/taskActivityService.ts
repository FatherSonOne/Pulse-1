/**
 * Task Activity Service
 * Manages activity logging and history for tasks
 */

import { supabase } from './supabase';

export interface TaskActivity {
  id: string;
  task_id: string;
  workspace_id: string;
  user_id: string | null;
  action: TaskActivityAction;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export type TaskActivityAction =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'comment'
  | 'subtask_added'
  | 'subtask_completed'
  | 'subtask_uncompleted'
  | 'subtask_deleted'
  | 'edited'
  | 'blocked'
  | 'unblocked'
  | 'deadline_changed'
  | 'priority_changed'
  | 'deleted'
  | 'title_changed'
  | 'description_changed';

export interface CreateActivityData {
  task_id: string;
  workspace_id: string;
  action: TaskActivityAction;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: Record<string, any>;
}

export const taskActivityService = {
  /**
   * Get activity log for a specific task
   */
  async getActivity(taskId: string, limit: number = 50): Promise<TaskActivity[]> {
    const { data, error } = await supabase
      .from('task_activity')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching task activity:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get recent activity across all tasks in a workspace
   */
  async getWorkspaceActivity(workspaceId: string, limit: number = 20): Promise<TaskActivity[]> {
    const { data, error } = await supabase
      .from('task_activity')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching workspace activity:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Log a new activity entry
   */
  async logActivity(data: CreateActivityData): Promise<TaskActivity | null> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: activity, error } = await supabase
      .from('task_activity')
      .insert({
        task_id: data.task_id,
        workspace_id: data.workspace_id,
        user_id: user?.id,
        action: data.action,
        old_value: data.old_value || null,
        new_value: data.new_value || null,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging activity:', error);
      throw error;
    }

    return activity;
  },

  /**
   * Log task creation
   */
  async logTaskCreated(taskId: string, workspaceId: string, taskTitle: string): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'created',
      new_value: taskTitle,
      metadata: { title: taskTitle },
    });
  },

  /**
   * Log status change (Note: Auto-logged by database trigger, this is backup)
   */
  async logStatusChange(
    taskId: string,
    workspaceId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'status_changed',
      old_value: oldStatus,
      new_value: newStatus,
      metadata: {
        old_status: oldStatus,
        new_status: newStatus,
      },
    });
  },

  /**
   * Log task assignment
   */
  async logAssignment(
    taskId: string,
    workspaceId: string,
    oldAssignee: string | null,
    newAssignee: string
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'assigned',
      old_value: oldAssignee,
      new_value: newAssignee,
      metadata: {
        old_assignee: oldAssignee,
        new_assignee: newAssignee,
      },
    });
  },

  /**
   * Log task unassignment
   */
  async logUnassignment(
    taskId: string,
    workspaceId: string,
    oldAssignee: string
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'unassigned',
      old_value: oldAssignee,
      new_value: null,
      metadata: {
        old_assignee: oldAssignee,
      },
    });
  },

  /**
   * Log deadline change
   */
  async logDeadlineChange(
    taskId: string,
    workspaceId: string,
    oldDeadline: string | null,
    newDeadline: string
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'deadline_changed',
      old_value: oldDeadline,
      new_value: newDeadline,
      metadata: {
        old_deadline: oldDeadline,
        new_deadline: newDeadline,
      },
    });
  },

  /**
   * Log priority change
   */
  async logPriorityChange(
    taskId: string,
    workspaceId: string,
    oldPriority: string,
    newPriority: string
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'priority_changed',
      old_value: oldPriority,
      new_value: newPriority,
      metadata: {
        old_priority: oldPriority,
        new_priority: newPriority,
      },
    });
  },

  /**
   * Log title change
   */
  async logTitleChange(
    taskId: string,
    workspaceId: string,
    oldTitle: string,
    newTitle: string
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'title_changed',
      old_value: oldTitle,
      new_value: newTitle,
      metadata: {
        old_title: oldTitle,
        new_title: newTitle,
      },
    });
  },

  /**
   * Log description change
   */
  async logDescriptionChange(
    taskId: string,
    workspaceId: string,
    oldDescription: string | null,
    newDescription: string
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'description_changed',
      old_value: oldDescription,
      new_value: newDescription,
    });
  },

  /**
   * Log task edit (generic)
   */
  async logTaskEdited(
    taskId: string,
    workspaceId: string,
    changes: Record<string, { old: any; new: any }>
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'edited',
      metadata: { changes },
    });
  },

  /**
   * Log comment added
   */
  async logComment(
    taskId: string,
    workspaceId: string,
    comment: string
  ): Promise<void> {
    await this.logActivity({
      task_id: taskId,
      workspace_id: workspaceId,
      action: 'comment',
      new_value: comment,
      metadata: { comment },
    });
  },

  /**
   * Get activity grouped by date
   */
  groupActivitiesByDate(activities: TaskActivity[]): Record<string, TaskActivity[]> {
    const grouped: Record<string, TaskActivity[]> = {};

    activities.forEach(activity => {
      const date = new Date(activity.created_at).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(activity);
    });

    return grouped;
  },

  /**
   * Format activity for display
   */
  formatActivity(activity: TaskActivity): string {
    const actionLabels: Record<TaskActivityAction, string> = {
      created: 'created this task',
      status_changed: `changed status from "${activity.old_value}" to "${activity.new_value}"`,
      assigned: `assigned to ${activity.new_value}`,
      unassigned: `unassigned from ${activity.old_value}`,
      comment: 'added a comment',
      subtask_added: `added subtask "${activity.new_value}"`,
      subtask_completed: `completed subtask "${activity.new_value}"`,
      subtask_uncompleted: `uncompleted subtask "${activity.new_value}"`,
      subtask_deleted: `deleted subtask "${activity.new_value}"`,
      edited: 'edited this task',
      blocked: `blocked: ${activity.new_value}`,
      unblocked: 'unblocked this task',
      deadline_changed: `changed deadline from ${activity.old_value || 'none'} to ${activity.new_value}`,
      priority_changed: `changed priority from ${activity.old_value} to ${activity.new_value}`,
      deleted: 'deleted this task',
      title_changed: `changed title to "${activity.new_value}"`,
      description_changed: 'updated description',
    };

    return actionLabels[activity.action] || activity.action;
  },
};

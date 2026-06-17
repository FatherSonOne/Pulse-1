import { supabase } from './supabaseClient';
import { ecosystemNotifyService } from './ecosystemNotifyService';

export interface Task {
  id: string;
  workspace_id: string;
  origin_message_id?: string; // Renamed from message_id to match extracted_tasks schema
  title: string;
  description?: string;
  status: 'pending' | 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id?: string; // Renamed from assigned_to to match extracted_tasks schema
  deadline?: string; // Renamed from due_date to match extracted_tasks schema
  completed_at?: string;
  blocked_reason?: string; // NEW: Reason why task is blocked
  blocked_at?: string; // NEW: When task was blocked
  archived_at?: string; // NEW: When task was archived
  metadata: Record<string, any>;
  tags?: string[]; // Free-text labels (text[] column, default '{}')
  extracted_at: string; // PRIMARY: extracted_tasks uses this instead of created_at
  updated_at: string;
  created_at?: string; // Optional: for compatibility
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

export interface TaskWithDependencies extends Task {
  dependencies: Task[];
  dependents: Task[];
}

// Alias for extracted task data
export interface ExtractedTask {
  title: string;
  description?: string;
  assignee_id?: string;
  deadline?: string;
  priority?: Task['priority'];
}

// Helper type for creating tasks with flexible field names (backward compatibility)
export interface CreateTaskData {
  workspace_id: string;
  origin_message_id?: string;
  title: string;
  description?: string;
  priority?: Task['priority'];
  assignee_id?: string;
  created_by?: string; // Not in extracted_tasks, stored in metadata
  deadline?: string;
  status?: Task['status'];
  metadata?: Record<string, any>;
  tags?: string[];
}

export const taskService = {
  // Create a new task
  async createTask(data: CreateTaskData): Promise<Task | null> {
    const metadata: Record<string, any> = data.created_by
      ? { created_by: data.created_by, ...data.metadata }
      : data.metadata || {};

    const { data: task, error } = await supabase
      .from('extracted_tasks')
      .insert({
        workspace_id: data.workspace_id,
        origin_message_id: data.origin_message_id,
        title: data.title,
        description: data.description,
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        assignee_id: data.assignee_id,
        deadline: data.deadline,
        metadata,
        ...(data.tags ? { tags: data.tags } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return null;
    }

    // Cross-app: cache task in Entomate for MIP context. Fire-and-forget.
    if (task?.id) {
      void ecosystemNotifyService.notifyTaskCreated({
        taskId: task.id,
        workspaceId: data.workspace_id,
        title: data.title,
        description: data.description ?? null,
        assigneeId: data.assignee_id ?? null,
        deadline: data.deadline ?? null,
        priority: data.priority ?? 'medium',
        originMessageId: data.origin_message_id ?? null,
      });
    }

    return task;
  },

  // Extract tasks from message using AI
  async extractTasksFromMessage(
    workspaceId: string,
    messageId: string,
    messageContent: string,
    userId: string
  ): Promise<Task[]> {
    // Simple pattern matching for action items
    // You can enhance this with your Gemini AI service
    const actionPatterns = [
      /(?:TODO|To do|Action item):\s*(.+?)(?:\n|$)/gi,
      /(?:\[ \]|\[\s\])\s*(.+?)(?:\n|$)/gi,
      /@(\w+)\s+(?:should|needs to|must)\s+(.+?)(?:\n|$)/gi
    ];

    const extractedTasks: Array<{title: string, assignee_id?: string}> = [];

    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(messageContent)) !== null) {
        if (match[1]) {
          extractedTasks.push({ title: match[1].trim() });
        } else if (match[2]) {
          extractedTasks.push({
            title: match[2].trim(),
            assignee_id: match[1]
          });
        }
      }
    });

    // Create tasks in database
    const createdTasks: Task[] = [];
    for (const taskData of extractedTasks) {
      const task = await this.createTask({
        workspace_id: workspaceId,
        origin_message_id: messageId,
        title: taskData.title,
        assignee_id: taskData.assignee_id,
        created_by: userId
      });

      if (task) {
        createdTasks.push(task);
      }
    }

    return createdTasks;
  },

  // Get all tasks for a workspace (excludes archived by default)
  async getWorkspaceTasks(
    workspaceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ tasks: Task[]; hasMore: boolean }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const { data: tasks, error } = await supabase
      .from('extracted_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('extracted_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      console.error('Error fetching tasks:', error);
      return { tasks: [], hasMore: false };
    }

    return {
      tasks: tasks || [],
      hasMore: (tasks?.length ?? 0) > limit,
    };
  },

  // Get tasks assigned to a user (excludes archived)
  async getUserTasks(workspaceId: string, userId: string): Promise<Task[]> {
    const { data: tasks, error} = await supabase
      .from('extracted_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('assignee_id', userId)
      .neq('status', 'cancelled')
      .is('archived_at', null) // Exclude archived tasks
      .order('extracted_at', { ascending: false });

    if (error) {
      console.error('Error fetching user tasks:', error);
      return [];
    }

    return tasks || [];
  },

  // Open (active, unarchived) tasks linked to any of the given origin message
  // ids — powers the Messages relationship rail's per-conversation open items.
  // Workspace-scoped (RLS is workspace-based). Returns [] for an empty id list.
  async getOpenTasksByMessageIds(workspaceId: string, messageIds: string[]): Promise<Task[]> {
    if (messageIds.length === 0) return [];

    const { data: tasks, error } = await supabase
      .from('extracted_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('origin_message_id', messageIds)
      .in('status', ['pending', 'todo', 'in_progress', 'in_review', 'blocked'])
      .is('archived_at', null)
      .order('extracted_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks by message ids:', error);
      return [];
    }

    return tasks || [];
  },

  // Update task status
  async updateTaskStatus(taskId: string, status: Task['status'], blockedReason?: string): Promise<boolean> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'done') {
      updates.completed_at = new Date().toISOString();
    }

    if (status === 'blocked') {
      updates.blocked_at = new Date().toISOString();
      if (blockedReason) {
        updates.blocked_reason = blockedReason;
      }
    } else {
      // Clear blocked fields when status changes from blocked
      updates.blocked_at = null;
      updates.blocked_reason = null;
    }

    const { error } = await supabase
      .from('extracted_tasks')
      .update(updates)
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task status:', error);
      return false;
    }

    return true;
  },

  // Update task
  async updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
    const { error } = await supabase
      .from('extracted_tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      return false;
    }

    return true;
  },

  // Add task dependency
  async addDependency(taskId: string, dependsOnTaskId: string): Promise<boolean> {
    const { error } = await supabase
      .from('task_dependencies')
      .insert({
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId
      });

    if (error) {
      console.error('Error adding dependency:', error);
      return false;
    }

    return true;
  },

  // Get task with dependencies
  async getTaskWithDependencies(taskId: string): Promise<TaskWithDependencies | null> {
    const { data: task, error } = await supabase
      .from('extracted_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !task) {
      console.error('Error fetching task:', error);
      return null;
    }

    // Get dependencies
    const { data: deps } = await supabase
      .from('task_dependencies')
      .select('depends_on_task_id')
      .eq('task_id', taskId);

    const { data: dependents } = await supabase
      .from('task_dependencies')
      .select('task_id')
      .eq('depends_on_task_id', taskId);

    const depIds = deps?.map(d => d.depends_on_task_id) || [];
    const depTasks = depIds.length > 0 ? await this.getTasksByIds(depIds, task.workspace_id) : [];

    const dependentIds = dependents?.map(d => d.task_id) || [];
    const dependentTasks = dependentIds.length > 0 ? await this.getTasksByIds(dependentIds, task.workspace_id) : [];

    return {
      ...task,
      dependencies: depTasks,
      dependents: dependentTasks
    };
  },

  // Helper to get multiple tasks by IDs, scoped to a workspace.
  // workspaceId is required as defense-in-depth (#33 PR-12) — without it
  // a bulk-by-IDs call could surface tasks from other workspaces if RLS
  // regresses.
  async getTasksByIds(ids: string[], workspaceId: string): Promise<Task[]> {
    const { data: tasks, error } = await supabase
      .from('extracted_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('id', ids);

    if (error) {
      console.error('Error fetching tasks by IDs:', error);
      return [];
    }

    return tasks || [];
  },

  // Subscribe to task changes
  subscribeToTasks(workspaceId: string, callback: (task: Task) => void) {
    return supabase
      .channel(`extracted_tasks:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'extracted_tasks',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          callback(payload.new as Task);
        }
      )
      .subscribe();
  },

  // Alias for subscribeToTasks
  subscribeToTaskUpdates(workspaceId: string, callback: (task: Task) => void) {
    return this.subscribeToTasks(workspaceId, callback);
  },

  /**
   * Phase 4: Archive completed tasks automatically
   * Archives tasks that have been done/cancelled for more than 48 hours
   */
  async archiveCompletedTasks(workspaceId: string): Promise<number> {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const { data, error } = await supabase
      .from('extracted_tasks')
      .update({ archived_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .in('status', ['done', 'cancelled'])
      .is('archived_at', null)
      .lt('completed_at', fortyEightHoursAgo.toISOString())
      .select();

    if (error) {
      console.error('Error auto-archiving tasks:', error);
      return 0;
    }

    return data?.length || 0;
  },

  /**
   * Delete a task permanently
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const { error } = await supabase
      .from('extracted_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      return false;
    }

    return true;
  },

  /**
   * Phase 4: Manually archive a task
   */
  async archiveTask(taskId: string): Promise<boolean> {
    const { error } = await supabase
      .from('extracted_tasks')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error('Error archiving task:', error);
      return false;
    }

    return true;
  },

  /**
   * Phase 4: Reopen an archived task
   */
  async reopenTask(taskId: string): Promise<boolean> {
    const { error } = await supabase
      .from('extracted_tasks')
      .update({
        archived_at: null,
        status: 'todo', // Reset to todo when reopened
        completed_at: null
      })
      .eq('id', taskId);

    if (error) {
      console.error('Error reopening task:', error);
      return false;
    }

    return true;
  },

  /**
   * Phase 4: Get archived tasks for a workspace
   */
  async getArchivedTasks(workspaceId: string): Promise<Task[]> {
    const { data: tasks, error } = await supabase
      .from('extracted_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });

    if (error) {
      console.error('Error fetching archived tasks:', error);
      return [];
    }

    return tasks || [];
  }
};

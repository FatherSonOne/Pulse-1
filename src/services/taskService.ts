import { supabase } from './supabaseClient';

export interface Task {
  id: string;
  workspace_id: string;
  message_id?: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  created_by: string;
  due_date?: string;
  completed_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
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
  assigned_to?: string;
  due_date?: string;
  priority?: Task['priority'];
}

export const taskService = {
  // Create a new task
  async createTask(data: {
    workspace_id: string;
    message_id?: string;
    title: string;
    description?: string;
    priority?: Task['priority'];
    assigned_to?: string;
    created_by: string;
    due_date?: string;
  }): Promise<Task | null> {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        ...data,
        status: 'todo',
        priority: data.priority || 'medium'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      return null;
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

    const extractedTasks: Array<{title: string, assigned_to?: string}> = [];

    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(messageContent)) !== null) {
        if (match[1]) {
          extractedTasks.push({ title: match[1].trim() });
        } else if (match[2]) {
          extractedTasks.push({ 
            title: match[2].trim(),
            assigned_to: match[1]
          });
        }
      }
    });

    // Create tasks in database
    const createdTasks: Task[] = [];
    for (const taskData of extractedTasks) {
      const task = await this.createTask({
        workspace_id: workspaceId,
        message_id: messageId,
        title: taskData.title,
        assigned_to: taskData.assigned_to,
        created_by: userId
      });
      
      if (task) {
        createdTasks.push(task);
      }
    }

    return createdTasks;
  },

  // Get all tasks for a workspace
  async getWorkspaceTasks(workspaceId: string): Promise<Task[]> {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }

    return tasks;
  },

  // Get tasks assigned to a user
  async getUserTasks(workspaceId: string, userId: string): Promise<Task[]> {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('assigned_to', userId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user tasks:', error);
      return [];
    }

    return tasks;
  },

  // Update task status
  async updateTaskStatus(taskId: string, status: Task['status']): Promise<boolean> {
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'done') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('tasks')
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
      .from('tasks')
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
      .from('tasks')
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
    const depTasks = depIds.length > 0 ? await this.getTasksByIds(depIds) : [];

    const dependentIds = dependents?.map(d => d.task_id) || [];
    const dependentTasks = dependentIds.length > 0 ? await this.getTasksByIds(dependentIds) : [];

    return {
      ...task,
      dependencies: depTasks,
      dependents: dependentTasks
    };
  },

  // Helper to get multiple tasks by IDs
  async getTasksByIds(ids: string[]): Promise<Task[]> {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .in('id', ids);

    if (error) {
      console.error('Error fetching tasks by IDs:', error);
      return [];
    }

    return tasks;
  },

  // Subscribe to task changes
  subscribeToTasks(workspaceId: string, callback: (task: Task) => void) {
    return supabase
      .channel(`tasks:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
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
  }
};

/**
 * Subtask Service
 * Manages subtasks for breaking down larger tasks into manageable steps
 */

import { supabase } from './supabase';

export interface Subtask {
  id: string;
  task_id: string;
  workspace_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface CreateSubtaskData {
  task_id: string;
  workspace_id: string;
  title: string;
  position?: number;
  created_by?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSubtaskData {
  title?: string;
  is_completed?: boolean;
  position?: number;
}

export const subtaskService = {
  /**
   * Get all subtasks for a specific task
   */
  async getSubtasks(taskId: string): Promise<Subtask[]> {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching subtasks:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Create a new subtask
   */
  async createSubtask(data: CreateSubtaskData): Promise<Subtask | null> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // If no position specified, get the next available position
    let position = data.position;
    if (position === undefined) {
      const { data: existing } = await supabase
        .from('subtasks')
        .select('position')
        .eq('task_id', data.task_id)
        .order('position', { ascending: false })
        .limit(1);

      position = existing && existing.length > 0 ? existing[0].position + 1 : 0;
    }

    const insertData: any = {
      task_id: data.task_id,
      workspace_id: data.workspace_id,
      title: data.title,
      position,
      created_by: data.created_by || user?.id,
    };

    // Add metadata if provided
    if (data.metadata) {
      insertData.metadata = data.metadata;
    }

    const { data: subtask, error } = await supabase
      .from('subtasks')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating subtask:', error);
      throw error;
    }

    // Log activity
    await this.logSubtaskActivity(data.task_id, data.workspace_id, 'subtask_added', subtask?.title);

    return subtask;
  },

  /**
   * Update a subtask
   */
  async updateSubtask(id: string, updates: UpdateSubtaskData): Promise<Subtask | null> {
    // Get current user and subtask info
    const { data: { user } } = await supabase.auth.getUser();
    const { data: current } = await supabase
      .from('subtasks')
      .select('*')
      .eq('id', id)
      .single();

    // If marking as completed, record who and when
    const updateData: any = { ...updates };
    if (updates.is_completed !== undefined) {
      if (updates.is_completed) {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }
    }

    const { data: subtask, error } = await supabase
      .from('subtasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating subtask:', error);
      throw error;
    }

    // Log activity if completed status changed
    if (current && updates.is_completed !== undefined && updates.is_completed !== current.is_completed) {
      const action = updates.is_completed ? 'subtask_completed' : 'subtask_uncompleted';
      await this.logSubtaskActivity(
        current.task_id,
        current.workspace_id,
        action,
        current.title
      );
    }

    return subtask;
  },

  /**
   * Toggle subtask completion status
   */
  async toggleSubtask(id: string): Promise<Subtask | null> {
    const { data: current } = await supabase
      .from('subtasks')
      .select('is_completed')
      .eq('id', id)
      .single();

    if (!current) {
      throw new Error('Subtask not found');
    }

    return this.updateSubtask(id, { is_completed: !current.is_completed });
  },

  /**
   * Delete a subtask
   */
  async deleteSubtask(id: string): Promise<void> {
    // Get subtask info for logging
    const { data: subtask } = await supabase
      .from('subtasks')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting subtask:', error);
      throw error;
    }

    // Log activity
    if (subtask) {
      await this.logSubtaskActivity(
        subtask.task_id,
        subtask.workspace_id,
        'subtask_deleted',
        subtask.title
      );
    }
  },

  /**
   * Reorder subtasks
   */
  async reorderSubtasks(taskId: string, orderedIds: string[]): Promise<void> {
    // Update positions based on array order
    const updates = orderedIds.map((id, index) => ({
      id,
      position: index,
    }));

    for (const update of updates) {
      await supabase
        .from('subtasks')
        .update({ position: update.position })
        .eq('id', update.id);
    }
  },

  /**
   * Get subtask progress for a task
   */
  async getProgress(taskId: string): Promise<{ total: number; completed: number; percentage: number }> {
    const { data: subtasks } = await supabase
      .from('subtasks')
      .select('is_completed')
      .eq('task_id', taskId);

    if (!subtasks || subtasks.length === 0) {
      return { total: 0, completed: 0, percentage: 0 };
    }

    const total = subtasks.length;
    const completed = subtasks.filter(s => s.is_completed).length;
    const percentage = Math.round((completed / total) * 100);

    return { total, completed, percentage };
  },

  /**
   * Helper: Log subtask activity to task_activity table
   */
  async logSubtaskActivity(
    taskId: string,
    workspaceId: string,
    action: string,
    subtaskTitle?: string
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from('task_activity')
      .insert({
        task_id: taskId,
        workspace_id: workspaceId,
        user_id: user?.id,
        action,
        new_value: subtaskTitle,
        metadata: {
          subtask_title: subtaskTitle,
          timestamp: new Date().toISOString(),
        },
      });
  },

  /**
   * Generate subtasks using AI and save to database
   * Phase 5: AI Enhancements
   */
  async generateAISubtasks(
    taskId: string,
    taskTitle: string,
    taskDescription: string | undefined,
    taskPriority: string | undefined,
    workspaceId: string,
    userId: string,
    maxSubtasks: number = 8
  ): Promise<Subtask[]> {
    try {
      // Lazy import geminiService to avoid circular dependencies
      const { generateSubtasksFromTaskWithFallback } = await import('./geminiService');

      // Call AI to generate subtasks (server-side routing).
      const aiSubtasks = await generateSubtasksFromTaskWithFallback(
        taskTitle,
        taskDescription,
        taskPriority,
        maxSubtasks
      );

      if (!aiSubtasks || aiSubtasks.length === 0) {
        console.warn('AI failed to generate subtasks');
        return [];
      }

      // Create subtasks in database
      const createdSubtasks: Subtask[] = [];

      for (const aiSubtask of aiSubtasks) {
        const subtask = await this.createSubtask({
          task_id: taskId,
          workspace_id: workspaceId,
          title: aiSubtask.title,
          position: aiSubtask.order,
          created_by: userId,
          metadata: {
            estimated_hours: aiSubtask.estimatedHours,
            generated_by: 'ai',
            generated_at: new Date().toISOString()
          }
        });

        if (subtask) {
          createdSubtasks.push(subtask);
        }
      }

      return createdSubtasks;
    } catch (error) {
      console.error('Error generating AI subtasks:', error);
      return [];
    }
  },
};

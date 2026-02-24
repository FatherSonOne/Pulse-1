import { GoogleGenAI } from "@google/genai";
import { DecisionWithVotes } from "./decisionService";
import { Task } from "./taskService";
import { User } from "../types";

export interface Nudge {
  id: string;
  type: 'decision_stale' | 'task_deadline' | 'blocker' | 'suggestion' | 'workload';
  priority: 'urgent' | 'important' | 'suggestion';
  message: string;
  action?: string;
  actionType?: 'send_reminder' | 'reassign' | 'extend_deadline' | 'link_items' | 'review';
  relatedId?: string;
  relatedTitle?: string;
}

export const proactiveSuggestionsService = {
  /**
   * Generate all current nudges based on decisions and tasks
   */
  async generateNudges(
    decisions: DecisionWithVotes[],
    tasks: Task[],
    user: User,
    apiKey?: string
  ): Promise<Nudge[]> {
    const nudges: Nudge[] = [];

    // 1. Stale decisions (no votes in 24h+)
    const staleDecisions = decisions.filter(d => {
      if (d.status !== 'voting') return false;
      const lastActivity = d.votes?.length > 0
        ? Math.max(...d.votes.map(v => new Date(v.voted_at).getTime()))
        : new Date(d.created_at).getTime();
      const hoursSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60);
      return hoursSinceActivity >= 24;
    });

    if (staleDecisions.length > 0) {
      for (const decision of staleDecisions.slice(0, 3)) {
        const hoursSinceCreated = (Date.now() - new Date(decision.created_at).getTime()) / (1000 * 60 * 60);
        nudges.push({
          id: `stale-decision-${decision.id}`,
          type: 'decision_stale',
          priority: 'important',
          message: `"${decision.title}" has no votes for ${Math.floor(hoursSinceCreated)}h`,
          action: 'Send reminder to voters',
          actionType: 'send_reminder',
          relatedId: decision.id,
          relatedTitle: decision.title,
        });
      }
    }

    // 2. Overdue tasks
    const overdueTasks = tasks.filter(t =>
      t.deadline &&
      new Date(t.deadline) < new Date() &&
      t.status !== 'done' &&
      t.status !== 'cancelled'
    );

    if (overdueTasks.length > 0) {
      const assigneeGroups = new Map<string, Task[]>();
      overdueTasks.forEach(t => {
        const assignee = t.assignee_id || 'Unassigned';
        if (!assigneeGroups.has(assignee)) {
          assigneeGroups.set(assignee, []);
        }
        assigneeGroups.get(assignee)!.push(t);
      });

      for (const [assignee, tasks] of assigneeGroups) {
        nudges.push({
          id: `overdue-tasks-${assignee}`,
          type: 'task_deadline',
          priority: 'urgent',
          message: `${tasks.length} task${tasks.length > 1 ? 's' : ''} overdue${assignee !== 'Unassigned' ? ` (${assignee})` : ''}`,
          action: 'Review and update',
          actionType: 'review',
        });
      }
    }

    // 3. Tasks due soon (next 48h)
    const upcomingTasks = tasks.filter(t => {
      if (!t.deadline || t.status === 'done' || t.status === 'cancelled') return false;
      const hoursUntilDue = (new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilDue > 0 && hoursUntilDue <= 48;
    });

    if (upcomingTasks.length >= 3) {
      nudges.push({
        id: 'upcoming-tasks',
        type: 'task_deadline',
        priority: 'important',
        message: `${upcomingTasks.length} tasks due in next 48h`,
        action: 'Review priorities',
        actionType: 'review',
      });
    }

    // 4. Pending votes for user
    const pendingVotes = decisions.filter(d =>
      d.status === 'voting' &&
      !d.votes?.some(v => v.user_id === user.id)
    );

    if (pendingVotes.length > 0) {
      nudges.push({
        id: 'pending-votes',
        type: 'decision_stale',
        priority: 'important',
        message: `You have ${pendingVotes.length} decision${pendingVotes.length > 1 ? 's' : ''} waiting for your vote`,
        action: 'Review and vote',
        actionType: 'review',
      });
    }

    // 5. Stale tasks (in_progress for >3 days with no updates) - Phase 6.3
    const staleTasks = tasks.filter(t => {
      if (t.status !== 'in_progress') return false;
      const lastUpdate = new Date(t.updated_at);
      const daysSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 3;
    });

    for (const task of staleTasks.slice(0, 3)) {
      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(task.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      nudges.push({
        id: `stale-task-${task.id}`,
        type: 'suggestion',
        priority: 'important',
        message: `"${task.title}" has been in progress for ${daysSinceUpdate} days with no updates`,
        action: 'Update status',
        actionType: 'review',
        relatedId: task.id,
        relatedTitle: task.title,
      });
    }

    // 6. Workload imbalance
    const assignedTasks = new Map<string, number>();
    tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').forEach(t => {
      if (t.assignee_id) {
        assignedTasks.set(t.assignee_id, (assignedTasks.get(t.assignee_id) || 0) + 1);
      }
    });

    const overloadedUsers = Array.from(assignedTasks.entries())
      .filter(([_, count]) => count >= 10)
      .sort((a, b) => b[1] - a[1]);

    if (overloadedUsers.length > 0) {
      const [userId, taskCount] = overloadedUsers[0];
      nudges.push({
        id: `workload-${userId}`,
        type: 'workload',
        priority: 'suggestion',
        message: `${userId === user.id ? 'You have' : 'Team member has'} ${taskCount} active tasks`,
        action: 'Consider redistributing work',
        actionType: 'reassign',
      });
    }

    // 7. Use AI for advanced suggestions (if API key provided)
    if (apiKey && apiKey !== '' && nudges.length < 5) {
      try {
        console.log('🤖 Attempting AI nudge generation...');
        const aiNudges = await this.generateAINudges(decisions, tasks, apiKey);
        console.log('✅ AI nudges generated:', aiNudges.length);
        nudges.push(...aiNudges);
      } catch (error: any) {
        // Gracefully handle API errors without polluting console
        if (error?.message?.includes('API Key')) {
          console.warn('⚠️ Gemini API key invalid or missing. AI nudges disabled. Set VITE_GEMINI_API_KEY to enable.');
        } else {
          console.warn('⚠️ AI nudge generation failed:', error?.message || 'Unknown error');
        }
      }
    } else if (!apiKey || apiKey === '') {
      console.info('ℹ️ AI nudges disabled: No Gemini API key provided');
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, important: 1, suggestion: 2 };
    nudges.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return nudges;
  },

  /**
   * Generate AI-powered suggestions
   */
  async generateAINudges(
    decisions: DecisionWithVotes[],
    tasks: Task[],
    apiKey: string
  ): Promise<Nudge[]> {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const decisionSummary = {
        total: decisions.length,
        voting: decisions.filter(d => d.status === 'voting').length,
        decided: decisions.filter(d => d.status === 'decided').length,
      };

      const taskSummary = {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        done: tasks.filter(t => t.status === 'done').length,
      };

      const prompt = `Analyze the current state and suggest 2-3 proactive actions:

Decisions: ${JSON.stringify(decisionSummary)}
Tasks: ${JSON.stringify(taskSummary)}

Recent Decisions: ${decisions.slice(0, 5).map(d => d.title).join(', ')}
Recent Tasks: ${tasks.slice(0, 5).map(t => t.title).join(', ')}

Identify potential issues, opportunities for improvement, or helpful suggestions.

Return JSON array of nudges:
[{
  "type": "suggestion",
  "priority": "suggestion" | "important",
  "message": "brief, actionable message",
  "action": "suggested action"
}]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.5,
          responseMimeType: 'application/json',
        },
      });

      const result = JSON.parse(response.text);

      if (!Array.isArray(result)) return [];

      return result.map((item, idx) => ({
        id: `ai-nudge-${idx}`,
        type: item.type || 'suggestion',
        priority: item.priority || 'suggestion',
        message: item.message,
        action: item.action,
      }));
    } catch (error) {
      // Error already handled by caller
      throw error;
    }
  },

  /**
   * Check if a nudge should be shown (not recently dismissed)
   */
  shouldShowNudge(nudgeId: string, dismissedNudges: Set<string>): boolean {
    return !dismissedNudges.has(nudgeId);
  },

  /**
   * Get priority color for nudge
   */
  getPriorityColor(priority: Nudge['priority']): string {
    switch (priority) {
      case 'urgent':
        return '#ef4444'; // Red
      case 'important':
        return '#f59e0b'; // Amber
      case 'suggestion':
        return '#10b981'; // Green
      default:
        return '#6b7280'; // Gray
    }
  },

  /**
   * Get priority icon for nudge
   */
  getPriorityIcon(priority: Nudge['priority']): string {
    switch (priority) {
      case 'urgent':
        return '🔴';
      case 'important':
        return '🟡';
      case 'suggestion':
        return '🟢';
      default:
        return '⚪';
    }
  },
};

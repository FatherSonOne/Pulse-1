import { Task } from "./taskService";
import { DecisionWithVotes } from "./decisionService";
import { Contact } from "../types";
import { invokeAIJson } from "./ai/aiService";
import { getCurrentWorkspaceId } from "./ai/getWorkspaceId";

export interface AITaskPriority {
  taskId: string;
  aiScore: number; // 0-100
  reasoning: string;
  blocksOthers: boolean;
  suggestedAssignee?: string;
  predictedDuration?: string;
}

export interface TaskDependency {
  taskId: string;
  blocks: string[]; // Task IDs this task blocks
  blockedBy: string[]; // Task IDs that block this task
}

export const taskIntelligenceService = {
  /**
   * Generate AI priority scores for tasks.
   *
   * Routes through `ai-router` using the `task_prioritization` task.
   * Falls back to a deterministic scoring heuristic on any router failure.
   *
   * @param tasks Tasks to prioritise.
   * @param apiKey DEPRECATED — unused. Router handles keys server-side.
   *   Retained for backward compatibility during migration.
   * @param workspaceId Optional workspace override. Falls back to
   *   `getCurrentWorkspaceId()`.
   */
  async intelligentPrioritization(
    tasks: Task[],
    apiKey: string | undefined,
    workspaceId?: string,
  ): Promise<AITaskPriority[]> {
    void apiKey; // deprecated — router handles keys server-side

    try {
      // Detect dependencies first (local, no LLM call)
      const dependencies = await this.detectDependencies(tasks);
      const dependencyMap = new Map(
        dependencies.map(d => [d.taskId, d])
      );

      // Prepare task data for AI
      const taskData = tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        priority: t.priority,
        status: t.status,
        due_date: t.due_date,
        assigned_to: t.assigned_to,
        blocks: dependencyMap.get(t.id)?.blocks.length || 0,
      }));

      const prompt = `Prioritize these tasks intelligently, considering:
1. Due date urgency (tasks due soon = higher priority)
2. Blocking factor (tasks that block others = higher priority)
3. Manual priority level (urgent > high > medium > low)
4. Status (in_progress tasks may need attention)
5. Task complexity inferred from description

Tasks: ${JSON.stringify(taskData, null, 2)}

For each task, return:
{
  "taskId": "string",
  "aiScore": 0-100,
  "reasoning": "brief explanation of score",
  "blocksOthers": boolean,
  "predictedDuration": "e.g. '2-4 hours', '1 day', '1 week'"
}

Return JSON array of prioritized tasks, sorted by aiScore descending.`;

      const wsId = workspaceId ?? getCurrentWorkspaceId();
      if (!wsId) {
        // No workspace — skip the LLM and fall through to the fallback.
        throw new Error('No active workspace — AI prioritisation unavailable');
      }

      const result = await invokeAIJson<AITaskPriority[]>(
        'task_prioritization',
        prompt,
        { workspaceId: wsId, temperature: 0.3 },
      );
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Task prioritization failed:', error);

      // Fallback: simple prioritization based on manual priority and due date
      return tasks.map(t => {
        let score = 50; // Base score

        // Manual priority boost
        if (t.priority === 'urgent') score += 30;
        else if (t.priority === 'high') score += 20;
        else if (t.priority === 'medium') score += 10;

        // Due date boost
        if (t.due_date) {
          const daysUntilDue = (new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysUntilDue < 0) score += 20; // Overdue
          else if (daysUntilDue < 1) score += 15; // Due today
          else if (daysUntilDue < 3) score += 10; // Due soon
        }

        return {
          taskId: t.id,
          aiScore: Math.min(100, Math.max(0, score)),
          reasoning: 'Fallback prioritization based on manual priority and due date',
          blocksOthers: false,
        };
      }).sort((a, b) => b.aiScore - a.aiScore);
    }
  },

  /**
   * Detect task dependencies based on content analysis.
   * Pure keyword-based heuristic — no LLM call, no migration needed.
   */
  async detectDependencies(tasks: Task[]): Promise<TaskDependency[]> {
    // Simple keyword-based dependency detection
    // Look for phrases like "after", "depends on", "blocked by", "waiting for"

    const dependencies: TaskDependency[] = [];

    for (const task of tasks) {
      const blocks: string[] = [];
      const blockedBy: string[] = [];

      const text = `${task.title} ${task.description || ''}`.toLowerCase();

      // Check if this task mentions other tasks
      for (const otherTask of tasks) {
        if (task.id === otherTask.id) continue;

        const otherTaskTitle = otherTask.title.toLowerCase();

        // Check if current task depends on other task
        if (
          text.includes(`after ${otherTaskTitle}`) ||
          text.includes(`depends on ${otherTaskTitle}`) ||
          text.includes(`blocked by ${otherTaskTitle}`) ||
          text.includes(`waiting for ${otherTaskTitle}`)
        ) {
          blockedBy.push(otherTask.id);
        }

        // Check if other task depends on current task
        const otherText = `${otherTask.title} ${otherTask.description || ''}`.toLowerCase();
        const currentTaskTitle = task.title.toLowerCase();
        if (
          otherText.includes(`after ${currentTaskTitle}`) ||
          otherText.includes(`depends on ${currentTaskTitle}`) ||
          otherText.includes(`blocked by ${currentTaskTitle}`)
        ) {
          blocks.push(otherTask.id);
        }
      }

      dependencies.push({
        taskId: task.id,
        blocks,
        blockedBy,
      });
    }

    return dependencies;
  },

  /**
   * Extract tasks from a finalized decision.
   *
   * Routes through `ai-router` using `task_prioritization` — generating an
   * implementation plan from a decision is a task-reasoning problem and
   * shares the same model tier as priority scoring.
   *
   * @param decision The finalised decision to break down into tasks.
   * @param apiKey DEPRECATED — unused. Router handles keys server-side.
   * @param workspaceId Optional workspace override.
   */
  async extractTasksFromDecision(
    decision: DecisionWithVotes,
    apiKey: string | undefined,
    workspaceId?: string,
  ): Promise<Partial<Task>[]> {
    void apiKey; // deprecated — router handles keys server-side

    try {
      const prompt = `Based on this decision, generate actionable tasks to implement it:

Decision Title: ${decision.proposal_text}
Decision Type: ${decision.decision_type}
Final Decision: ${decision.final_decision || 'Decision approved'}

Generate 3-7 concrete, actionable tasks needed to implement this decision.

For each task, provide:
{
  "title": "clear, actionable task title",
  "description": "brief description of what needs to be done",
  "priority": "high" | "medium" | "low",
  "estimated_duration": "e.g. '2 hours', '1 day', '1 week'"
}

Return JSON array of tasks.`;

      const wsId = workspaceId ?? getCurrentWorkspaceId();
      if (!wsId) return [];

      const result = await invokeAIJson<Array<{
        title: string;
        description: string;
        priority: 'low' | 'medium' | 'high';
        estimated_duration: string;
      }>>(
        'task_prioritization',
        prompt,
        { workspaceId: wsId, temperature: 0.4 },
      );

      if (!Array.isArray(result)) return [];

      // Convert to Task format
      return result.map(item => ({
        title: item.title,
        description: item.description,
        priority: item.priority as 'low' | 'medium' | 'high',
        status: 'todo' as const,
        metadata: {
          decision_id: decision.id,
          estimated_duration: item.estimated_duration,
        },
      }));
    } catch (error) {
      console.error('Task extraction failed:', error);
      return [];
    }
  },

  /**
   * Suggest assignee for a task based on content and contact history.
   *
   * Routes through `ai-router` using `task_prioritization`.
   *
   * @param task The task needing an assignee.
   * @param contacts Available contacts to pick from.
   * @param apiKey DEPRECATED — unused. Router handles keys server-side.
   * @param workspaceId Optional workspace override.
   */
  async suggestAssignee(
    task: Task,
    contacts: Contact[],
    apiKey: string | undefined,
    workspaceId?: string,
  ): Promise<string | null> {
    void apiKey; // deprecated — router handles keys server-side

    try {
      const contactInfo = contacts.map(c => ({
        name: c.name,
        email: c.email,
        // Could include skills, past task assignments, etc.
      }));

      const prompt = `Suggest the best person to assign this task to:

Task: ${task.title}
Description: ${task.description || 'No description'}
Priority: ${task.priority}

Available contacts: ${JSON.stringify(contactInfo, null, 2)}

Based on the task content, suggest the most appropriate contact name.
If no good match, return null.

Return JSON: { "suggestedAssignee": "name" | null, "reasoning": "brief explanation" }`;

      const wsId = workspaceId ?? getCurrentWorkspaceId();
      if (!wsId) return null;

      const result = await invokeAIJson<{
        suggestedAssignee: string | null;
        reasoning?: string;
      }>(
        'task_prioritization',
        prompt,
        { workspaceId: wsId, temperature: 0.3 },
      );
      return result?.suggestedAssignee ?? null;
    } catch (error) {
      console.error('Assignee suggestion failed:', error);
      return null;
    }
  },

  /**
   * Analyze workload distribution across assignees.
   * Pure local computation — no LLM call.
   */
  analyzeWorkload(tasks: Task[]): Map<string, {
    total: number;
    todo: number;
    inProgress: number;
    highPriority: number;
    overdue: number;
  }> {
    const workload = new Map<string, any>();

    for (const task of tasks) {
      if (!task.assigned_to) continue;

      if (!workload.has(task.assigned_to)) {
        workload.set(task.assigned_to, {
          total: 0,
          todo: 0,
          inProgress: 0,
          highPriority: 0,
          overdue: 0,
        });
      }

      const stats = workload.get(task.assigned_to)!;
      stats.total++;

      if (task.status === 'todo') stats.todo++;
      if (task.status === 'in_progress') stats.inProgress++;
      if (task.priority === 'high' || task.priority === 'urgent') stats.highPriority++;

      if (task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done') {
        stats.overdue++;
      }
    }

    return workload;
  },

  /**
   * Identify bottlenecks in task workflow.
   * Pure local computation — no LLM call.
   */
  identifyBottlenecks(tasks: Task[], dependencies: TaskDependency[]): {
    blockedTasks: Task[];
    blockingTasks: Task[];
    overdueBlockers: Task[];
  } {
    const dependencyMap = new Map(dependencies.map(d => [d.taskId, d]));

    // Find tasks that are blocked
    const blockedTasks = tasks.filter(t => {
      const deps = dependencyMap.get(t.id);
      return deps && deps.blockedBy.length > 0 && t.status !== 'done';
    });

    // Find tasks that are blocking others
    const blockingTasks = tasks.filter(t => {
      const deps = dependencyMap.get(t.id);
      return deps && deps.blocks.length > 0 && t.status !== 'done';
    });

    // Find overdue tasks that are blocking others
    const now = new Date();
    const overdueBlockers = blockingTasks.filter(t =>
      t.due_date && new Date(t.due_date) < now
    );

    return {
      blockedTasks,
      blockingTasks,
      overdueBlockers,
    };
  },

  /**
   * Phase 5: Suggest optimal deadline for a task based on AI analysis.
   *
   * Routes through `ai-router` using `task_prioritization`. Falls back to a
   * priority-based heuristic (urgent = 1 day, high = 3, medium = 7, low = 14)
   * on any router failure.
   *
   * @param apiKey DEPRECATED — unused. Router handles keys server-side.
   *   Kept as first arg for backward compatibility with existing callers.
   * @param taskTitle Title of the task.
   * @param taskDescription Optional description.
   * @param taskPriority Priority string (urgent / high / medium / low).
   * @param currentWorkload Existing tasks used to avoid scheduling conflicts.
   * @param workspaceId Optional workspace override.
   */
  async suggestOptimalDeadline(
    apiKey: string | undefined,
    taskTitle: string,
    taskDescription: string | undefined,
    taskPriority: string,
    currentWorkload: Task[],
    workspaceId?: string,
  ): Promise<{ suggestedDate: string; reasoning: string } | null> {
    void apiKey; // deprecated — router handles keys server-side

    try {
      // Analyze current workload
      const upcomingTasks = currentWorkload
        .filter(t => !t.is_completed && t.due_date)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 10);

      const workloadSummary = upcomingTasks.map(t => ({
        title: t.title,
        due_date: t.due_date,
        priority: t.priority,
        status: t.status
      }));

      const prompt = `You are an expert project manager. Suggest an optimal deadline for this task:

Task Title: ${taskTitle}
Task Description: ${taskDescription || 'No description provided'}
Task Priority: ${taskPriority}

Current Workload (upcoming tasks):
${JSON.stringify(workloadSummary, null, 2)}

Consider:
1. Task complexity based on title/description
2. Current workload and existing deadlines
3. Priority level (urgent tasks need sooner deadlines)
4. Avoid scheduling conflicts with other high-priority tasks
5. Realistic time estimates for task completion

Suggest a deadline that:
- Allows sufficient time for quality work
- Accounts for current workload
- Aligns with priority level
- Avoids overloading any single day

Return JSON with:
{
  "suggestedDate": "YYYY-MM-DD",
  "reasoning": "Brief explanation of why this deadline makes sense (2-3 sentences)"
}`;

      const wsId = workspaceId ?? getCurrentWorkspaceId();
      if (!wsId) {
        throw new Error('No active workspace — smart scheduling unavailable');
      }

      const result = await invokeAIJson<{
        suggestedDate?: string;
        reasoning?: string;
      }>(
        'task_prioritization',
        prompt,
        { workspaceId: wsId, temperature: 0.4 },
      );

      if (!result?.suggestedDate) {
        return null;
      }

      return {
        suggestedDate: result.suggestedDate,
        reasoning: result.reasoning ?? ''
      };
    } catch (error) {
      console.error('Smart scheduling failed:', error);

      // Fallback: Simple deadline suggestion based on priority
      const now = new Date();
      let daysToAdd = 7; // Default: 1 week

      if (taskPriority === 'urgent') daysToAdd = 1;
      else if (taskPriority === 'high') daysToAdd = 3;
      else if (taskPriority === 'medium') daysToAdd = 7;
      else if (taskPriority === 'low') daysToAdd = 14;

      const suggestedDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

      return {
        suggestedDate: suggestedDate.toISOString().split('T')[0],
        reasoning: `Based on ${taskPriority} priority, suggested deadline is ${daysToAdd} days from now.`
      };
    }
  },

  /**
   * Phase 5: Predict potential blockers for a task.
   *
   * Routes through `ai-router` using `task_prioritization`. Falls back to a
   * keyword-based blocker detector (API / design / database heuristics) on
   * any router failure.
   *
   * NOTE: The old Gemini path used a `responseSchema` enum constraint for
   * `confidence`. The router's JSON mode does not forward schema constraints,
   * so we rely on the prompt instruction and defensively validate the shape
   * at the call site if strict typing is ever required.
   *
   * @param apiKey DEPRECATED — unused. Router handles keys server-side.
   * @param taskTitle Title of the task.
   * @param taskDescription Optional description.
   * @param relatedTasks Sibling tasks in the workspace for context.
   * @param workspaceId Optional workspace override.
   */
  async predictBlockers(
    apiKey: string | undefined,
    taskTitle: string,
    taskDescription: string | undefined,
    relatedTasks: Task[],
    workspaceId?: string,
  ): Promise<Array<{
    blocker: string;
    confidence: 'high' | 'medium' | 'low';
    mitigation: string;
  }> | null> {
    void apiKey; // deprecated — router handles keys server-side

    try {
      const relatedTasksSummary = relatedTasks.map(t => ({
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority
      }));

      const prompt = `You are an expert project risk analyst. Predict potential blockers for this task:

Task Title: ${taskTitle}
Task Description: ${taskDescription || 'No description provided'}

Related Tasks in Workspace:
${JSON.stringify(relatedTasksSummary.slice(0, 15), null, 2)}

Identify 0-5 potential blockers that could prevent this task from being completed on time. Consider:
1. Technical dependencies (e.g., "needs API integration" blocking "build UI")
2. Resource dependencies (e.g., waiting for design assets, data, approvals)
3. Skill/knowledge gaps
4. External dependencies (third-party services, vendors)
5. Common project risks (scope creep, unclear requirements, etc.)

For each blocker, provide:
{
  "blocker": "Clear description of the potential blocker",
  "confidence": "high" | "medium" | "low",
  "mitigation": "Actionable suggestion to avoid or mitigate this blocker"
}

If no significant blockers are predicted, return an empty array.

Return JSON array of blockers.`;

      const wsId = workspaceId ?? getCurrentWorkspaceId();
      if (!wsId) {
        throw new Error('No active workspace — blocker prediction unavailable');
      }

      const result = await invokeAIJson<Array<{
        blocker: string;
        confidence: 'high' | 'medium' | 'low';
        mitigation: string;
      }>>(
        'task_prioritization',
        prompt,
        { workspaceId: wsId, temperature: 0.5 },
      );

      if (!Array.isArray(result)) {
        return [];
      }

      return result;
    } catch (error) {
      console.error('Blocker prediction failed:', error);

      // Fallback: Basic keyword-based blocker detection
      const text = `${taskTitle} ${taskDescription || ''}`.toLowerCase();
      const blockers: Array<{ blocker: string; confidence: 'high' | 'medium' | 'low'; mitigation: string }> = [];

      // Check for common blocker keywords
      if (text.includes('integrate') || text.includes('api') || text.includes('third-party')) {
        blockers.push({
          blocker: 'External API or integration dependency detected',
          confidence: 'medium',
          mitigation: 'Verify API documentation and access tokens early. Consider mock data for testing.'
        });
      }

      if (text.includes('design') && !text.includes('implement')) {
        blockers.push({
          blocker: 'May require design assets or approval',
          confidence: 'medium',
          mitigation: 'Coordinate with design team early to ensure assets are ready.'
        });
      }

      if (text.includes('database') || text.includes('migration') || text.includes('schema')) {
        blockers.push({
          blocker: 'Database changes may require review and testing',
          confidence: 'medium',
          mitigation: 'Test migration in staging environment. Plan rollback strategy.'
        });
      }

      return blockers.length > 0 ? blockers : [];
    }
  },
};

import { DecisionWithVotes } from "./decisionService";
import { Task } from "./taskService";
import { User } from "../types";
import { invokeAIPrompt, invokeAIJson } from "./ai/aiService";
import { getCurrentWorkspaceId } from "./ai/getWorkspaceId";
import {
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from "./ai/errors";

// Simple in-memory cache with 5-minute TTL
const AI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
interface CacheEntry { response: string; timestamp: number; }
const responseCache = new Map<string, CacheEntry>();

function getCacheKey(query: string, context: QueryContext): string {
  // Key based on query + counts + latest timestamps (avoids huge strings)
  const decisionsSignature = context.decisions.map(d => d.id + d.updated_at).join(',');
  const tasksSignature = context.tasks.map(t => t.id + t.updated_at).join(',');
  return `${query}|${decisionsSignature}|${tasksSignature}`;
}

function getCached(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AI_CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.response;
}

function setCache(key: string, response: string): void {
  // Evict if cache grows too large (max 20 entries)
  if (responseCache.size >= 20) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { response, timestamp: Date.now() });
}

/**
 * Re-throw router-level errors so callers (and UI) can handle billing/provider states.
 * All other errors are swallowed into user-friendly fallbacks.
 */
function rethrowRouterErrors(error: unknown): void {
  if (
    error instanceof AICapExceededError ||
    error instanceof AITrialExpiredError ||
    error instanceof AIProviderUnavailableError
  ) {
    throw error;
  }
}

export interface QueryContext {
  decisions: DecisionWithVotes[];
  tasks: Task[];
  user: User;
}

export interface PendingSummary {
  summary: string;
  highlights: string[];
  recommendations: string[];
}

export interface Blocker {
  type: 'task' | 'decision';
  itemId: string;
  title: string;
  blocking: string[];
  recommendation: string;
}

export const conversationalAIService = {
  /**
   * Answer natural language queries about decisions and tasks
   *
   * @param query     The user's question
   * @param context   Decisions/tasks/user context
   * @param _apiKey   @deprecated — ignored. AI routing is handled server-side.
   * @param workspaceId Optional workspace ID; falls back to the active workspace.
   */
  async answerQuery(
    query: string,
    context: QueryContext,
    _apiKey?: string,
    workspaceId?: string
  ): Promise<string> {
    const cacheKey = getCacheKey(query, context);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const wsId = workspaceId ?? getCurrentWorkspaceId();
    if (!wsId) {
      return 'I apologize, but no active workspace is selected. Please select a workspace first.';
    }

    try {
      // Prepare context data
      const decisionsData = context.decisions.map(d => ({
        id: d.id,
        title: d.proposal_text,
        type: d.decision_type,
        status: d.status,
        votes: d.votes?.length || 0,
      }));

      const tasksData = context.tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigned_to: t.assigned_to,
        due_date: t.due_date,
      }));

      const myTasks = context.tasks.filter(t => t.assigned_to === context.user.id);
      const myDecisions = context.decisions.filter(d =>
        d.created_by === context.user.id ||
        d.votes?.some(v => v.user_id === context.user.id)
      );

      const prompt = `You are an AI assistant helping with team decisions and tasks.

User Query: "${query}"

Context:
- Total Decisions: ${decisionsData.length}
- Voting Decisions: ${context.decisions.filter(d => d.status === 'voting').length}
- My Decisions: ${myDecisions.length}

- Total Tasks: ${tasksData.length}
- My Tasks: ${myTasks.length}
- Overdue Tasks: ${context.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length}

Decisions: ${JSON.stringify(decisionsData.slice(0, 10), null, 2)}
Tasks: ${JSON.stringify(tasksData.slice(0, 10), null, 2)}

Respond using clear markdown formatting:
- Use **bold** for decision/task titles and key terms
- Use bullet lists (- item) for enumerations, risks, recommendations
- Use numbered lists (1. step) for sequential actions or priorities
- Use ## headings to separate major sections when the response covers multiple topics
- Keep paragraphs short (2-3 sentences max)
- Start with a one-sentence direct answer, then expand with details

If the user wants to create something, respond with:
[CREATE_DECISION] or [CREATE_TASK] followed by JSON data.

Answer:`;

      const text = await invokeAIPrompt('rag_query', prompt, {
        workspaceId: wsId,
        temperature: 0.4,
      });

      setCache(cacheKey, text);
      return text;
    } catch (error) {
      rethrowRouterErrors(error);
      console.error('Query answering failed:', error);
      return 'I apologize, but I encountered an error processing your question. Please try again.';
    }
  },

  /**
   * Generate summary of pending decisions and tasks
   *
   * @param _apiKey   @deprecated — ignored. AI routing is handled server-side.
   * @param workspaceId Optional workspace ID; falls back to the active workspace.
   */
  async summarizePending(
    decisions: DecisionWithVotes[],
    tasks: Task[],
    _apiKey?: string,
    workspaceId?: string
  ): Promise<PendingSummary> {
    const wsId = workspaceId ?? getCurrentWorkspaceId();
    const votingDecisions = decisions.filter(d => d.status === 'voting');
    const proposedDecisions = decisions.filter(d => d.status === 'proposed');
    const todoTasks = tasks.filter(t => t.status === 'todo');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const overdueTasks = tasks.filter(t =>
      t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
    );

    const fallback: PendingSummary = {
      summary: `You have ${votingDecisions.length} decisions pending votes and ${tasks.filter(t => t.status !== 'done').length} active tasks.`,
      highlights: [],
      recommendations: [],
    };

    if (!wsId) return fallback;

    try {
      const prompt = `Summarize the current state of decisions and tasks:

Decisions:
- ${votingDecisions.length} decisions in voting
- ${proposedDecisions.length} decisions proposed

Tasks:
- ${todoTasks.length} tasks to do
- ${inProgressTasks.length} tasks in progress
- ${overdueTasks.length} tasks overdue

Key Items:
Voting Decisions: ${votingDecisions.map(d => d.proposal_text).join(', ')}
Overdue Tasks: ${overdueTasks.map(t => t.title).join(', ')}

Provide:
1. A brief summary (2-3 sentences)
2. 3-5 highlights of what needs attention
3. 3-5 actionable recommendations

Return JSON:
{
  "summary": "string",
  "highlights": ["item1", "item2"],
  "recommendations": ["rec1", "rec2"]
}`;

      const result = await invokeAIJson<PendingSummary>('rag_query', prompt, {
        workspaceId: wsId,
        temperature: 0.4,
      });
      return result;
    } catch (error) {
      rethrowRouterErrors(error);
      console.error('Summary generation failed:', error);
      return fallback;
    }
  },

  /**
   * Identify blockers in the workflow
   *
   * Pure heuristic — no LLM call, so no workspace/task mapping needed.
   * Kept backward-compatible with the old (tasks, decisions, apiKey) signature.
   *
   * @param _apiKey @deprecated — ignored (this function doesn't invoke AI).
   */
  async identifyBlockers(
    tasks: Task[],
    decisions: DecisionWithVotes[],
    _apiKey?: string
  ): Promise<Blocker[]> {
    const blockers: Blocker[] = [];

    // Simple blocking detection
    // Tasks blocked by incomplete dependencies
    const incompleteTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

    for (const task of incompleteTasks) {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();

      // Check if task mentions being blocked
      if (
        text.includes('blocked') ||
        text.includes('waiting for') ||
        text.includes('depends on')
      ) {
        blockers.push({
          type: 'task',
          itemId: task.id,
          title: task.title,
          blocking: [], // Would need dependency data
          recommendation: 'Identify and resolve blocking dependencies',
        });
      }
    }

    // Decisions stuck in voting
    const staleDecisions = decisions.filter(d => {
      if (d.status !== 'voting') return false;
      const hoursSinceCreated = (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60);
      return hoursSinceCreated > 48; // More than 48 hours
    });

    for (const decision of staleDecisions) {
      blockers.push({
        type: 'decision',
        itemId: decision.id,
        title: decision.proposal_text,
        blocking: [], // Could track related tasks
        recommendation: 'Send reminder to voters or escalate decision',
      });
    }

    return blockers;
  },

  /**
   * Generate personalized recommendations for next actions
   *
   * @param _apiKey   @deprecated — ignored. AI routing is handled server-side.
   * @param workspaceId Optional workspace ID; falls back to the active workspace.
   */
  async suggestNextActions(
    context: QueryContext,
    _apiKey?: string,
    workspaceId?: string
  ): Promise<string[]> {
    const wsId = workspaceId ?? getCurrentWorkspaceId();
    const fallback = ['Review your assigned tasks', 'Vote on pending decisions'];
    if (!wsId) return fallback;

    try {
      const myTasks = context.tasks.filter(t =>
        t.assigned_to === context.user.id && t.status !== 'done'
      );

      const myVotingDecisions = context.decisions.filter(d =>
        d.status === 'voting' &&
        !d.votes?.some(v => v.user_id === context.user.id)
      );

      const urgentTasks = myTasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
      const overdueTasks = myTasks.filter(t =>
        t.due_date && new Date(t.due_date) < new Date()
      );

      const prompt = `Suggest 3-5 prioritized next actions for this user:

My Tasks: ${myTasks.length} (${urgentTasks.length} urgent, ${overdueTasks.length} overdue)
Pending Votes: ${myVotingDecisions.length}

Urgent Tasks: ${urgentTasks.map(t => t.title).join(', ')}
Overdue Tasks: ${overdueTasks.map(t => t.title).join(', ')}
Pending Decisions: ${myVotingDecisions.map(d => d.proposal_text).join(', ')}

Return JSON array of 3-5 specific, actionable recommendations, prioritized by urgency.`;

      const result = await invokeAIJson<string[] | { recommendations?: string[] }>(
        'rag_query',
        prompt,
        { workspaceId: wsId, temperature: 0.4 }
      );

      if (Array.isArray(result)) return result;
      if (result && typeof result === 'object' && Array.isArray(result.recommendations)) {
        return result.recommendations;
      }
      return fallback;
    } catch (error) {
      rethrowRouterErrors(error);
      console.error('Next actions suggestion failed:', error);
      return fallback;
    }
  },

  /**
   * Get quick action suggestions
   */
  getQuickActions(context: QueryContext): Array<{
    label: string;
    query: string;
  }> {
    const myTasks = context.tasks.filter(t =>
      t.assigned_to === context.user.id && t.status !== 'done'
    );

    const votingDecisions = context.decisions.filter(d => d.status === 'voting');

    return [
      { label: 'What should I work on next?', query: 'What should I work on next?' },
      { label: 'Summarize pending decisions', query: 'Summarize all pending decisions' },
      { label: `Show my ${myTasks.length} tasks`, query: 'Show all my tasks' },
      { label: 'What needs attention?', query: 'What needs my attention right now?' },
      { label: `${votingDecisions.length} decisions need votes`, query: 'Which decisions need votes?' },
      { label: 'What is blocking progress?', query: 'Identify blockers' },
    ];
  },
};

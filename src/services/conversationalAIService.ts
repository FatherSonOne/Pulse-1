import { GoogleGenAI } from "@google/genai";
import { DecisionWithVotes } from "./decisionService";
import { Task } from "./taskService";
import { User } from "../types";

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
   */
  async answerQuery(
    query: string,
    context: QueryContext,
    apiKey: string
  ): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey });

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

Provide a helpful, concise answer. If the user asks "what should I work on", recommend specific tasks based on priority, due dates, and blocking factors.

If the user wants to create something, respond with:
[CREATE_DECISION] or [CREATE_TASK] followed by JSON data.

Answer:`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.4,
        },
      });

      return response.text;
    } catch (error) {
      console.error('Query answering failed:', error);
      return 'I apologize, but I encountered an error processing your question. Please try again.';
    }
  },

  /**
   * Generate summary of pending decisions and tasks
   */
  async summarizePending(
    decisions: DecisionWithVotes[],
    tasks: Task[],
    apiKey: string
  ): Promise<PendingSummary> {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const votingDecisions = decisions.filter(d => d.status === 'voting');
      const proposedDecisions = decisions.filter(d => d.status === 'proposed');
      const todoTasks = tasks.filter(t => t.status === 'todo');
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
      const overdueTasks = tasks.filter(t =>
        t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
      );

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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      });

      const result = JSON.parse(response.text);
      return result;
    } catch (error) {
      console.error('Summary generation failed:', error);
      return {
        summary: `You have ${decisions.filter(d => d.status === 'voting').length} decisions pending votes and ${tasks.filter(t => t.status !== 'done').length} active tasks.`,
        highlights: [],
        recommendations: [],
      };
    }
  },

  /**
   * Identify blockers in the workflow
   */
  async identifyBlockers(
    tasks: Task[],
    decisions: DecisionWithVotes[],
    apiKey: string
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
   */
  async suggestNextActions(
    context: QueryContext,
    apiKey: string
  ): Promise<string[]> {
    try {
      const ai = new GoogleGenAI({ apiKey });

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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      });

      const result = JSON.parse(response.text);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Next actions suggestion failed:', error);
      return ['Review your assigned tasks', 'Vote on pending decisions'];
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

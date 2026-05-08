import { useEffect, useCallback } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { decisionService } from '../../services/decisionService';
import { taskService } from '../../services/taskService';
import { User } from '../../types';

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

interface PulseAIProactiveCheckerProps {
  user: User | null;
  isPanelOpen: boolean;
  onProactiveChange: (hasProactive: boolean, findings?: string) => void;
}

/**
 * Headless component (renders null) that lives inside WorkspaceProvider.
 * Periodically checks for overdue tasks, pending votes, and stale decisions.
 * Calls onProactiveChange(true) to light up the pulsing dot on PulseAssistantButton.
 * Clears the badge automatically when the panel is opened.
 */
export function PulseAIProactiveChecker({
  user,
  isPanelOpen,
  onProactiveChange,
}: PulseAIProactiveCheckerProps) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? '';

  const runCheck = useCallback(async (cancelled: { value: boolean }) => {
    if (!workspaceId || !user) return;
    try {
      const [decResult, taskResult] = await Promise.all([
        decisionService.getWorkspaceDecisions(workspaceId),
        taskService.getWorkspaceTasks(workspaceId),
      ]);
      const decisions = decResult.decisions;
      const tasks = taskResult.tasks;

      if (cancelled.value) return;

      // Overdue tasks
      const overdueTasks = tasks.filter(
        t =>
          t.deadline &&
          new Date(t.deadline) < new Date() &&
          t.status !== 'done' &&
          t.status !== 'cancelled',
      );

      // Decisions awaiting the current user's vote
      const pendingVoteDecisions = decisions.filter(
        d =>
          d.status === 'voting' &&
          !d.votes?.some(v => v.user_id === user.id),
      );

      // Stale decisions (no activity in ≥24h)
      const staleDecisions = decisions.filter(d => {
        if (d.status !== 'voting') return false;
        const lastActivity =
          d.votes && d.votes.length > 0
            ? Math.max(...d.votes.map(v => new Date(v.voted_at).getTime()))
            : new Date(d.created_at).getTime();
        return (Date.now() - lastActivity) / (1000 * 60 * 60) >= 24;
      });

      const hasIssues = overdueTasks.length > 0 || pendingVoteDecisions.length > 0 || staleDecisions.length > 0;

      if (hasIssues) {
        // Pulse voice: terse, specific, never hedging. Lead with the count,
        // name the items, point at the action. No "would you like me to…".
        const parts: string[] = [];
        const totals: number[] = [overdueTasks.length, pendingVoteDecisions.length, staleDecisions.length];
        const total = totals.reduce((a, b) => a + b, 0);
        const categoryCount = totals.filter(n => n > 0).length;

        parts.push(`**${total} ${total === 1 ? 'item needs' : 'items need'} attention.**`);

        if (overdueTasks.length > 0) {
          const taskList = overdueTasks.slice(0, 5).map(t => {
            const deadline = t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            return `- **${t.title}**${deadline ? ` (due ${deadline})` : ''}`;
          }).join('\n');
          const heading = categoryCount > 1
            ? `**Overdue (${overdueTasks.length}):**`
            : `**${overdueTasks.length} ${overdueTasks.length === 1 ? 'task is overdue' : 'tasks are overdue'}.**`;
          parts.push(`${heading}\n${taskList}`);
        }

        if (pendingVoteDecisions.length > 0) {
          const decList = pendingVoteDecisions.slice(0, 5).map(d => `- **${d.title}**`).join('\n');
          const heading = categoryCount > 1
            ? `**Awaiting your vote (${pendingVoteDecisions.length}):**`
            : `**${pendingVoteDecisions.length} ${pendingVoteDecisions.length === 1 ? 'decision is waiting' : 'decisions are waiting'} for your vote.**`;
          parts.push(`${heading}\n${decList}`);
        }

        if (staleDecisions.length > 0) {
          const staleList = staleDecisions.slice(0, 3).map(d => `- **${d.title}**`).join('\n');
          const heading = categoryCount > 1
            ? `**Stalled, 24h+ (${staleDecisions.length}):**`
            : `**${staleDecisions.length} ${staleDecisions.length === 1 ? 'decision has stalled' : 'decisions have stalled'} (24h+ no activity).**`;
          parts.push(`${heading}\n${staleList}`);
        }

        // Closing: action affordance, not a question. Suggested-action chips
        // (Open Tasks / View Decisions) render right after this message.
        const closer = total === 1
          ? 'Open it now, or snooze.'
          : 'Pick one to start, or ask me to triage.';
        parts.push(closer);

        onProactiveChange(true, parts.join('\n\n'));
      } else {
        onProactiveChange(false);
      }
    } catch (e) {
      console.error('[PulseAI] Proactive check failed:', e);
    }
  }, [workspaceId, user, onProactiveChange]);

  // Run on mount and every 10 minutes
  useEffect(() => {
    const cancelled = { value: false };
    runCheck(cancelled);
    const interval = setInterval(() => runCheck(cancelled), CHECK_INTERVAL_MS);
    return () => {
      cancelled.value = true;
      clearInterval(interval);
    };
  }, [runCheck]);

  // Clear badge when panel opens (findings already captured by parent)
  useEffect(() => {
    if (isPanelOpen) onProactiveChange(false, undefined);
  }, [isPanelOpen, onProactiveChange]);

  return null;
}

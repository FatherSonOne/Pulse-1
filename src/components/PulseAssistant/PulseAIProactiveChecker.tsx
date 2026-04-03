import { useEffect, useCallback } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { decisionService } from '../../services/decisionService';
import { taskService } from '../../services/taskService';
import { User } from '../../types';

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

interface PulseAIProactiveCheckerProps {
  user: User | null;
  isPanelOpen: boolean;
  onProactiveChange: (hasProactive: boolean) => void;
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
      const hasOverdue = tasks.some(
        t =>
          t.deadline &&
          new Date(t.deadline) < new Date() &&
          t.status !== 'done' &&
          t.status !== 'cancelled',
      );

      // Decisions awaiting the current user's vote
      const hasPendingVotes = decisions.some(
        d =>
          d.status === 'voting' &&
          !d.votes?.some(v => v.user_id === user.id),
      );

      // Stale decisions (no activity in ≥24h)
      const hasStale = decisions.some(d => {
        if (d.status !== 'voting') return false;
        const lastActivity =
          d.votes && d.votes.length > 0
            ? Math.max(...d.votes.map(v => new Date(v.voted_at).getTime()))
            : new Date(d.created_at).getTime();
        return (Date.now() - lastActivity) / (1000 * 60 * 60) >= 24;
      });

      onProactiveChange(hasOverdue || hasPendingVotes || hasStale);
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

  // Clear badge when panel opens
  useEffect(() => {
    if (isPanelOpen) onProactiveChange(false);
  }, [isPanelOpen, onProactiveChange]);

  return null;
}

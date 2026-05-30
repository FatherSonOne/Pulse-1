/**
 * FocalPane — routes the selected queue/timeline entry to its detail view:
 * TaskDetail (Phase 4) or DecisionDetail (Phase 5).
 */
import type { QueueEntry } from '../triage/queueModel';
import { TaskDetail, type TaskActions } from './TaskDetail';
import { DecisionDetail, type DecisionActions } from './DecisionDetail';

interface FocalPaneProps {
  entry: QueueEntry | undefined;
  taskActions: TaskActions;
  decisionActions: DecisionActions;
}

export function FocalPane({ entry, taskActions, decisionActions }: FocalPaneProps) {
  if (!entry) return null;

  if (entry.kind === 'task') {
    return <TaskDetail key={entry.task.id} task={entry.task} {...taskActions} />;
  }

  return <DecisionDetail key={entry.decision.id} decision={entry.decision} {...decisionActions} />;
}

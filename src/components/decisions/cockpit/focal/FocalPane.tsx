/**
 * FocalPane — routes the selected queue/timeline entry to its detail view:
 * TaskDetail (Phase 4), DecisionDetail (Phase 5), or RetrospectivePane (Phase 8).
 */
import type { QueueEntry } from '../triage/queueModel';
import { TaskDetail, type TaskActions } from './TaskDetail';
import { DecisionDetail, type DecisionActions } from './DecisionDetail';
import { RetrospectivePane, type RetroActions } from './RetrospectivePane';

interface FocalPaneProps {
  entry: QueueEntry | undefined;
  taskActions: TaskActions;
  decisionActions: DecisionActions;
  retroActions: RetroActions;
}

export function FocalPane({ entry, taskActions, decisionActions, retroActions }: FocalPaneProps) {
  if (!entry) return null;

  if (entry.kind === 'task') {
    return <TaskDetail key={entry.task.id} task={entry.task} {...taskActions} />;
  }
  if (entry.kind === 'retro') {
    return <RetrospectivePane key={entry.prompt.id} prompt={entry.prompt} decisionTitle={entry.decisionTitle} {...retroActions} />;
  }
  return <DecisionDetail key={entry.decision.id} decision={entry.decision} {...decisionActions} />;
}

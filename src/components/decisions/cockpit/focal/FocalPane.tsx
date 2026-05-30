/**
 * FocalPane — routes the selected queue/timeline entry to its detail view:
 * TaskDetail (Phase 4) or DecisionDetail (Phase 5, placeholder for now).
 */
import type { QueueEntry } from '../triage/queueModel';
import { TaskDetail, type TaskActions } from './TaskDetail';

interface FocalPaneProps {
  entry: QueueEntry | undefined;
  taskActions: TaskActions;
}

export function FocalPane({ entry, taskActions }: FocalPaneProps) {
  if (!entry) return null;

  if (entry.kind === 'task') {
    return <TaskDetail key={entry.task.id} task={entry.task} {...taskActions} />;
  }

  // Decision focal — Phase 5 (tally + vote + AI risk/consensus).
  return (
    <div className="ck-focal-placeholder">
      <span className="ck-focal-kicker">Decision</span>
      <h2 className="ck-focal-title">{entry.decision.title}</h2>
      <span className="ck-focal-note">DecisionDetail — tally · vote · AI risk/consensus (Phase 5)</span>
    </div>
  );
}

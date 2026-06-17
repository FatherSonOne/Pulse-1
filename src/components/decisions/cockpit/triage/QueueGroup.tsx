/**
 * QueueGroup — a collapsible section in the queue rail (Needs you / Today /
 * Upcoming). Header shows a status-tone dot, label, and count; clicking it
 * collapses the group. Rows render via QueueItem.
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import { QueueItem } from './QueueItem';
import type { QueueEntry, QueueGroupModel } from './queueModel';

interface QueueGroupProps {
  group: QueueGroupModel;
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  onQuickAction: (entry: QueueEntry, action: 'done' | 'snooze') => void;
  /** Bulk-select state keyed by task.id (task rows only). */
  checkedIds?: Set<string>;
  onToggleCheck?: (taskId: string) => void;
}

export function QueueGroup({
  group, collapsed, onToggleCollapse, selectedId, onSelect, onQuickAction,
  checkedIds, onToggleCheck,
}: QueueGroupProps) {
  return (
    <div>
      <button
        type="button"
        className="ck-qhead"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        <span className="ck-qhead-dot" style={{ background: group.tone }} aria-hidden />
        <span className="ck-qhead-label">{group.label}</span>
        <span className="ck-qhead-count">{group.items.length}</span>
      </button>

      {!collapsed &&
        group.items.map((entry) => {
          const taskId = entry.kind === 'task' ? entry.task.id : null;
          return (
            <QueueItem
              key={entry.id}
              entry={entry}
              active={entry.id === selectedId}
              onSelect={() => onSelect(entry.id)}
              onQuickAction={onQuickAction}
              selected={taskId ? checkedIds?.has(taskId) : undefined}
              onToggleSelect={taskId && onToggleCheck ? () => onToggleCheck(taskId) : undefined}
            />
          );
        })}
    </div>
  );
}

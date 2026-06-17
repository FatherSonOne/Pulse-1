/**
 * QueueItem — one compact row in the triage queue rail. Full detail lives in
 * the focal pane (Phase 4/5); this row is the scannable summary.
 *
 * Coral budget (CLAUDE.md §4): the only coral here is the AI provenance chip
 * (.ck-ai-chip) — an AI-output surface, which is exactly where coral belongs.
 * Status icon uses the status palette; everything else is neutral/rose.
 */
import { useState } from 'react';
import {
  AlertCircle, Ban, Eye, Hammer, ListTodo, CheckCircle2, Scale, Circle,
  Mail, MessageSquare, Video, Mic, Pencil, Check, History,
  type LucideIcon,
} from 'lucide-react';
import type { Task } from '../../../../services/taskService';
import { type QueueEntry, dueInfo, isAIExtracted } from './queueModel';

type QuickAction = 'done' | 'snooze';

interface QueueItemProps {
  entry: QueueEntry;
  active: boolean;
  onSelect: () => void;
  onQuickAction: (entry: QueueEntry, action: QuickAction) => void;
  /** Bulk-select (task rows only). When provided, a checkbox renders. */
  selected?: boolean;
  onToggleSelect?: () => void;
}

const STATUS_ICON: Record<string, LucideIcon> = {
  overdue: AlertCircle, blocked: Ban, in_review: Eye, in_progress: Hammer,
  todo: ListTodo, pending: ListTodo, done: CheckCircle2, cancelled: Ban,
};
const STATUS_COLOR: Record<string, string> = {
  overdue: 'var(--dt-status-overdue)', blocked: 'var(--dt-status-blocked)',
  in_review: 'var(--dt-status-in-review)', in_progress: 'var(--dt-status-in-progress)',
  todo: 'var(--dt-status-todo)', pending: 'var(--dt-status-todo)',
  done: 'var(--dt-status-done)', cancelled: 'var(--dt-status-cancelled)',
};
const SOURCE: Record<string, { label: string; Icon: LucideIcon }> = {
  email: { label: 'Email', Icon: Mail },
  messages: { label: 'Messages', Icon: MessageSquare },
  meeting: { label: 'Meeting', Icon: Video },
  relay: { label: 'Relay', Icon: Mic },
  manual: { label: 'Manual', Icon: Pencil },
};

function taskDisplayStatus(task: Task, overdue: boolean): string {
  return overdue && task.status !== 'blocked' ? 'overdue' : task.status;
}

export function QueueItem({ entry, active, onSelect, onQuickAction, selected, onToggleSelect }: QueueItemProps) {
  const [hover, setHover] = useState(false);

  // Retro look-back rows are their own shape (no task/decision payload).
  if (entry.kind === 'retro') {
    return (
      <div
        role="option"
        aria-selected={active}
        tabIndex={-1}
        onClick={onSelect}
        className="ck-qitem"
        data-active={active}
      >
        {active && <span className="ck-qitem-stripe" aria-hidden />}
        <span className="ck-qitem-status" style={{ color: 'var(--dt-status-voting)' }}>
          <History size={15} strokeWidth={2.2} />
        </span>
        <div className="ck-qitem-main">
          <div className="ck-qitem-title">Look back: {entry.decisionTitle}</div>
          <div className="ck-qitem-meta">
            <span className="ck-ai-chip">AI</span>
            <span className="ck-qitem-due" style={{ color: 'var(--dt-status-voting)' }}>retrospective due</span>
          </div>
        </div>
      </div>
    );
  }

  const isTask = entry.kind === 'task';

  const due = isTask ? dueInfo(entry.task.deadline) : null;
  const displayStatus = isTask ? taskDisplayStatus(entry.task, !!due?.overdue) : 'voting';
  const StatusIcon = isTask ? (STATUS_ICON[displayStatus] ?? Circle) : Scale;
  const statusColor = isTask ? (STATUS_COLOR[displayStatus] ?? 'var(--dt-status-todo)') : 'var(--dt-status-voting)';

  const title = isTask ? entry.task.title : entry.decision.title;
  const sourceKey = isTask ? (entry.task.metadata?.source as string | undefined) : undefined;
  const source = sourceKey ? SOURCE[sourceKey] : undefined;
  const ai = isTask ? isAIExtracted(entry.task) : false;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="ck-qitem"
      data-active={active}
      data-selected={selected || undefined}
    >
      {active && <span className="ck-qitem-stripe" aria-hidden />}
      {onToggleSelect && (
        <input
          type="checkbox"
          className="ck-qitem-check"
          checked={!!selected}
          onClick={stop}
          onChange={onToggleSelect}
          aria-label="Select task for bulk action"
        />
      )}
      <span className="ck-qitem-status" style={{ color: statusColor }}>
        <StatusIcon size={15} strokeWidth={2.2} />
      </span>

      <div className="ck-qitem-main">
        <div className="ck-qitem-title">{title}</div>
        <div className="ck-qitem-meta">
          {source && (
            <span className="ck-source-tag" title={source.label}>
              <source.Icon size={11} />
            </span>
          )}
          {ai && <span className="ck-ai-chip">AI</span>}
          {isTask && due && (
            <span className="ck-qitem-due" style={{ color: due.overdue ? 'var(--dt-status-overdue)' : 'var(--pulse-ink-3)' }}>
              {due.label}
            </span>
          )}
          {!isTask && <span className="ck-qitem-due" style={{ color: 'var(--dt-status-voting)' }}>needs vote</span>}
        </div>
      </div>

      {hover && (
        <div className="ck-qitem-actions" onClick={stop}>
          <button
            className="ck-qa-btn"
            title={isTask ? 'Mark done' : 'Approve'}
            aria-label={isTask ? 'Mark done' : 'Approve'}
            onClick={() => onQuickAction(entry, 'done')}
          >
            <Check size={14} />
          </button>
          {/* Snooze quick-action hidden until persistence is wired (launch-readiness 0.5). */}
        </div>
      )}
    </div>
  );
}

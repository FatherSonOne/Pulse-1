/**
 * TaskDetail — the focal pane for a task. Subsumes EnhancedTaskCard +
 * TaskEditModal's Details tab: a PostHog property table with inline-editable
 * status / priority / assignee / due, SourceContext provenance, the AI
 * intelligence block (score / est / blocks + suggestion), real subtasks
 * (SubtaskList), and a footer of actions. Activity + comments land inline in
 * Phase 6.
 *
 * Coral budget (CLAUDE.md §4): coral appears ONLY in the AI intelligence block
 * and the "Extracted from" chip — both AI-output surfaces. Status uses the
 * status palette; priority is neutral; everything else is rose/neutral.
 */
import { useState } from 'react';
import { Check, RotateCcw, UserCog, CalendarClock, Trash2, Ban, X, ExternalLink } from 'lucide-react';
import type { Task } from '../../../../services/taskService';
import type { User } from '../../../../types';
import { taskSourceView, taskSourceLabel } from '../taskSource';
import { SubtaskList } from '../../SubtaskList';
import { Prop, PropertyTable } from './PropertyTable';
import { SourceContext } from './SourceContext';
import { RecurrencePicker } from '../../../Calendar/RecurrencePicker';
import { FocalScaffold, ActBtn } from './FocalActions';
import { ActivityLog } from './ActivityLog';
import { CommentsSection } from './CommentsSection';
import { resolveSource } from '../sources';

export interface TaskActions {
  members: User[];
  allTasks: Task[];
  currentUserId?: string;
  onStatusChange: (taskId: string, status: Task['status']) => void | Promise<void>;
  onPatch: (taskId: string, updates: Partial<Task>) => void | Promise<void>;
  onMarkDone: (task: Task) => void | Promise<void>;
  onReassign: (task: Task) => void;
  onExtend: (task: Task) => void;
  onDelete: (taskId: string) => void | Promise<void>;
  onOpenSource: (task: Task) => void;
}

interface TaskDetailProps extends TaskActions {
  task: Task;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  todo: { label: 'To Do', color: 'var(--dt-status-todo)' },
  pending: { label: 'Pending', color: 'var(--dt-status-pending)' },
  in_progress: { label: 'In Progress', color: 'var(--dt-status-in-progress)' },
  in_review: { label: 'In Review', color: 'var(--dt-status-in-review)' },
  blocked: { label: 'Blocked', color: 'var(--dt-status-blocked)' },
  done: { label: 'Done', color: 'var(--dt-status-done)' },
  cancelled: { label: 'Cancelled', color: 'var(--dt-status-cancelled)' },
  overdue: { label: 'Overdue', color: 'var(--dt-status-overdue)' },
};
const STATUS_OPTIONS: Task['status'][] = ['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'];
const PRIORITY_OPTIONS: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];

const toDateInput = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const isOverdue = (t: Task) => !!t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date();

export function TaskDetail({
  task, members, allTasks, currentUserId,
  onStatusChange, onPatch, onMarkDone, onReassign, onExtend, onDelete, onOpenSource,
}: TaskDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const overdue = isOverdue(task);
  const displayStatus = overdue && task.status !== 'blocked' ? 'overdue' : task.status;
  const statusMeta = STATUS_META[displayStatus] ?? STATUS_META.todo;

  const m = task.metadata || {};
  const aiScore: number | null = m.ai_priority_score ?? m.aiScore ?? null;
  const aiAssignee: string | null = m.ai_suggested_assignee ?? null;
  const aiDuration: string | null = m.ai_predicted_duration ?? null;
  const blocksIds: string[] = m.blocks_task_ids ?? [];
  const blocksTasks = blocksIds.length ? allTasks.filter((t) => blocksIds.includes(t.id)) : [];
  const hasAI = aiScore !== null || aiDuration || blocksTasks.length > 0 || aiAssignee;

  const source = m.source as string | undefined;
  const sourceMeta = (m.source_meta ?? m.sender ?? m.channel) as string | undefined;
  const quote = (m.source_excerpt ?? m.source_quote ?? m.quote ?? m.context_snippet) as string | undefined;
  const resolvedSource = resolveSource(source);
  // Cross-surface deep-link (item C): only show "Open source" when the task carries
  // provenance we can route to (email / message / meeting / relay).
  const sourceView = taskSourceView(task);

  const assigneeName = (id?: string) => members.find((mem) => mem.id === id)?.name;

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      window.setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setConfirmDelete(false);
    onDelete(task.id);
  };

  const footer = (
    <>
      {task.status === 'done' ? (
        <ActBtn icon={RotateCcw} label="Reopen" onClick={() => onStatusChange(task.id, 'todo')} />
      ) : (
        <ActBtn icon={Check} label="Mark done" primary onClick={() => onMarkDone(task)} />
      )}
      <ActBtn icon={UserCog} label="Reassign" onClick={() => onReassign(task)} />
      <ActBtn icon={CalendarClock} label="Extend" onClick={() => onExtend(task)} />
      <div style={{ flex: 1 }} />
      <ActBtn
        icon={Trash2}
        label={confirmDelete ? 'Confirm' : 'Delete'}
        danger
        onClick={handleDelete}
        title={confirmDelete ? 'Click again to confirm' : 'Delete task'}
      />
      {sourceView && (
        <ActBtn
          icon={ExternalLink}
          label={`Open ${taskSourceLabel(sourceView)}`}
          onClick={() => onOpenSource(task)}
          title="Jump to where this task came from"
        />
      )}
    </>
  );

  return (
    <FocalScaffold footer={footer}>
      <div className="ck-focal-pad">
        {/* Header strip */}
        <div className="ck-focal-strip">
          <span className="ck-status-pill" style={{ color: statusMeta.color, background: 'color-mix(in oklab, ' + statusMeta.color + ' 12%, transparent)' }}>
            {statusMeta.label}
          </span>
          {task.priority && task.priority !== 'low' && (
            <span className="ck-prio-tag" data-prio={task.priority}>{task.priority}</span>
          )}
          {resolvedSource && (m.ai_extracted || aiScore !== null) && (
            <span className="ck-ai-chip">Extracted from {resolvedSource.label}</span>
          )}
          <span className="ck-focal-id">{task.id.slice(0, 8).toUpperCase()}</span>
        </div>

        <h2 className="ck-focal-h2">{task.title}</h2>
        {task.description && <p className="ck-focal-desc">{task.description}</p>}

        <SourceContext source={source} meta={sourceMeta} quote={quote} />

        {task.status === 'blocked' && task.blocked_reason && (
          <div className="ck-blocked-banner">
            <Ban size={15} />
            <span><strong>Blocked:</strong> {task.blocked_reason}</span>
          </div>
        )}

        {/* Property table — inline-editable */}
        <PropertyTable>
          <Prop label="Assignee">
            <select
              className="ck-prop-edit"
              value={task.assignee_id ?? ''}
              onChange={(e) => onPatch(task.id, { assignee_id: e.target.value || undefined })}
              aria-label="Assignee"
            >
              <option value="">Unassigned</option>
              {members.map((mem) => (
                <option key={mem.id} value={mem.id}>{mem.name || mem.email}</option>
              ))}
              {/* Keep a stale assignee visible even if not in members list */}
              {task.assignee_id && !assigneeName(task.assignee_id) && (
                <option value={task.assignee_id}>{task.assignee_id.slice(0, 8)}</option>
              )}
            </select>
          </Prop>
          <Prop label="Due">
            <input
              type="date"
              className="ck-prop-edit"
              value={toDateInput(task.deadline)}
              onChange={(e) =>
                onPatch(task.id, { deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })
              }
              style={{ color: overdue ? 'var(--dt-status-overdue)' : undefined }}
              aria-label="Due date"
            />
          </Prop>
          <Prop label="Status">
            <select
              className="ck-prop-edit"
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value as Task['status'])}
              aria-label="Status"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </Prop>
          <Prop label="Priority">
            <select
              className="ck-prop-edit"
              value={task.priority}
              onChange={(e) => onPatch(task.id, { priority: e.target.value as Task['priority'] })}
              aria-label="Priority"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </Prop>
          <Prop label="Repeats">
            <RecurrencePicker
              value={task.recurrence_rule ?? null}
              onChange={(rule) => onPatch(task.id, { recurrence_rule: rule ?? null } as Partial<Task>)}
              eventDate={task.deadline ? task.deadline.slice(0, 10) : new Date().toISOString().slice(0, 10)}
            />
          </Prop>
          {resolvedSource && (
            <Prop label="Source">
              <span className="ck-source-tag"><resolvedSource.Icon size={13} /> <span className="ck-source-tag-label">{resolvedSource.label}</span></span>
            </Prop>
          )}
        </PropertyTable>

        {/* Labels (free-text tags) */}
        <div className="ck-focal-section-label">Labels</div>
        <TagEditor tags={task.tags ?? []} onChange={(next) => onPatch(task.id, { tags: next })} />

        {/* AI intelligence block (coral — AI-output surface) */}
        {hasAI && (
          <div className="ck-ai-block">
            <div className="ck-ai-block-head">
              <span className="ck-ai-chip">Pulse AI</span>
              <span className="ck-ai-block-title">Task intelligence</span>
            </div>
            <div className="ck-ai-metrics">
              {aiScore !== null && (
                <div className="ck-ai-metric"><div className="ck-ai-metric-num">{aiScore}</div><div className="ck-ai-metric-lbl">Priority score</div></div>
              )}
              {aiDuration && (
                <div className="ck-ai-metric"><div className="ck-ai-metric-num">{aiDuration}</div><div className="ck-ai-metric-lbl">Est. effort</div></div>
              )}
              {blocksTasks.length > 0 && (
                <div className="ck-ai-metric"><div className="ck-ai-metric-num">{blocksTasks.length}</div><div className="ck-ai-metric-lbl">Blocks tasks</div></div>
              )}
            </div>
            {aiAssignee && !task.assignee_id && (
              <p className="ck-ai-note">AI suggests assigning to <strong>{aiAssignee}</strong>.</p>
            )}
            {blocksTasks.length > 0 && (
              <p className="ck-ai-note">Completing this unblocks: {blocksTasks.map((t) => t.title).join(', ')}.</p>
            )}
          </div>
        )}

        {/* Subtasks (real SubtaskList) */}
        <div className="ck-focal-section-label">Subtasks</div>
        <SubtaskList
          taskId={task.id}
          workspaceId={task.workspace_id}
          taskTitle={task.title}
          taskDescription={task.description}
          taskPriority={task.priority}
          currentUserId={currentUserId}
        />

        <ActivityLog source="task" itemId={task.id} members={members} />
        <CommentsSection
          source="task"
          itemId={task.id}
          workspaceId={task.workspace_id}
          currentUserId={currentUserId || ''}
          members={members}
        />
      </div>
    </FocalScaffold>
  );
}

/**
 * TagEditor — free-text label chips with an inline add-input. Enter (or blur)
 * commits; the trailing Backspace removes the last chip; duplicates (case-
 * insensitive) are ignored. Persists via the parent's onChange (→ onPatch tags).
 */
function TagEditor({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t]);
    setDraft('');
  };
  const remove = (t: string) => onChange(tags.filter((x) => x !== t));
  return (
    <div className="ck-tags">
      {tags.map((t) => (
        <span key={t} className="ck-tag-chip">
          {t}
          <button type="button" className="ck-tag-x" onClick={() => remove(t)} aria-label={`Remove label ${t}`}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        className="ck-tag-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(); }
          else if (e.key === 'Backspace' && !draft && tags.length) remove(tags[tags.length - 1]);
        }}
        onBlur={add}
        placeholder={tags.length ? 'Add label…' : 'Add a label…'}
        aria-label="Add label"
      />
    </div>
  );
}

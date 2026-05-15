import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { ChevronDown, Save, X } from 'lucide-react';
import { Task } from '../../services/taskService';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { SubtaskList } from '../decisions/SubtaskList';
import TaskActivityFeed from '../decisions/TaskActivityFeed';
import { taskIntelligenceService } from '../../services/taskIntelligenceService';
import { fetchTasks } from '../../services/authService';
import PlacePicker from '../map/PlacePicker';
import MapPreview from '../map/MapPreview';
import { Place } from '../../types/placeTypes';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import './TaskEditModal.css';

interface TaskEditModalProps {
  task: Task;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => Promise<void>;
  workspaceMembers?: User[];
}

// Priority is a ramp, not a status — pills carry the weight, no decorative
// hue per item. Active pill paints rose; inactive pills stay neutral.
const PRIORITY_OPTIONS: Array<{ value: Task['priority']; label: string }> = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

// Status pills follow DESIGN.md §2 Status-Stays-Status: each row carries a
// leading 6px dot in its status color so color is a co-signal next to the
// label, never a replacement for it. Emoji prefixes (📋 🔨 👀 …) were the
// Slack/Asana template — removed.
const STATUS_OPTIONS: Array<{ value: Task['status']; label: string }> = [
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review',   label: 'In Review' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'done',        label: 'Done' },
  { value: 'cancelled',   label: 'Cancelled' },
];

interface BlockerPrediction {
  blocker: string;
  confidence: 'high' | 'medium' | 'low';
  mitigation: string;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  task,
  onClose,
  onSave,
  workspaceMembers = [],
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'activity'>('details');
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<Task['priority']>(task.priority);
  const [status, setStatus] = useState<Task['status']>(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [deadline, setDeadline] = useState(task.deadline ? task.deadline.split('T')[0] : '');
  const [blockedReason, setBlockedReason] = useState(task.blocked_reason || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Snapshot the initial state so dirty-tracking is a pure derived check. No
  // useEffect needed; React re-renders on every field change anyway.
  const initial = useRef({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    status: task.status,
    assigneeId: task.assignee_id || '',
    deadline: task.deadline ? task.deadline.split('T')[0] : '',
    blockedReason: task.blocked_reason || '',
  });

  const isDirty = useMemo(() => (
    title !== initial.current.title ||
    description !== initial.current.description ||
    priority !== initial.current.priority ||
    status !== initial.current.status ||
    assigneeId !== initial.current.assigneeId ||
    deadline !== initial.current.deadline ||
    blockedReason !== initial.current.blockedReason
  ), [title, description, priority, status, assigneeId, deadline, blockedReason]);

  // Centralised close path so ESC and the X button share dirty-state logic.
  const requestClose = useCallback(() => {
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [isDirty, confirmDiscard, onClose]);

  // Risk Read disclosure — lazy-fire pattern. The AI predict call only runs
  // on first expand (or explicit re-analyze), not on every modal open. The
  // old behavior burned tokens for users who only wanted to change a due
  // date. Tracked with a `hasFetched` flag rather than relying on the
  // length of `blockers`, so a zero-result analysis still counts as "done".
  const [riskOpen, setRiskOpen] = useState(false);
  const [blockers, setBlockers] = useState<BlockerPrediction[]>([]);
  const [isLoadingBlockers, setIsLoadingBlockers] = useState(false);
  const [hasFetchedBlockers, setHasFetchedBlockers] = useState(false);

  // B1: place attached to this task (entity_places, role='primary').
  const [attachedPlace, setAttachedPlace] = useState<Place | null>(null);

  const loadBlockerPredictions = useCallback(async () => {
    if (task.status === 'done' || task.status === 'cancelled') {
      setHasFetchedBlockers(true);
      return;
    }
    setIsLoadingBlockers(true);
    try {
      const allTasks = await fetchTasks();
      const workspaceTasks = allTasks.filter(
        t => t.workspace_id === task.workspace_id && t.id !== task.id,
      );
      const result = await taskIntelligenceService.predictBlockers(
        '',
        task.title,
        task.description,
        workspaceTasks,
      );
      setBlockers(result ?? []);
    } catch (err) {
      console.error('[TaskEditModal] predictBlockers failed:', err);
      setBlockers([]);
    } finally {
      setIsLoadingBlockers(false);
      setHasFetchedBlockers(true);
    }
  }, [task.id, task.workspace_id, task.title, task.description, task.status]);

  const handleToggleRisk = useCallback(() => {
    setRiskOpen(prev => {
      const next = !prev;
      if (next && !hasFetchedBlockers && !isLoadingBlockers) {
        void loadBlockerPredictions();
      }
      return next;
    });
  }, [hasFetchedBlockers, isLoadingBlockers, loadBlockerPredictions]);

  const handleReanalyze = useCallback(() => {
    if (isLoadingBlockers) return;
    setHasFetchedBlockers(false);
    void loadBlockerPredictions();
  }, [isLoadingBlockers, loadBlockerPredictions]);

  // Full keyboard contract — see TaskEditModal shape doc.
  // ESC      : close (with dirty-discard guard via requestClose).
  // Cmd/Ctrl-Enter : submit the Details form.
  // Cmd/Ctrl-1/2/3 : switch tabs.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'Enter') {
        // Only fire on the Details tab; other tabs don't own a Save button.
        if (activeTab === 'details') {
          e.preventDefault();
          // Submit by dispatching a submit event on the form so the existing
          // handler validates and saves identically to a button click.
          const form = document.getElementById('details-panel') as HTMLFormElement | null;
          form?.requestSubmit();
        }
      } else if (e.key === '1') {
        e.preventDefault();
        setActiveTab('details');
      } else if (e.key === '2') {
        e.preventDefault();
        setActiveTab('subtasks');
      } else if (e.key === '3') {
        e.preventDefault();
        setActiveTab('activity');
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeTab, requestClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (status === 'blocked' && !blockedReason.trim()) {
      setError('Blocked reason is required when status is Blocked');
      return;
    }

    setIsSaving(true);
    try {
      const updates: Partial<Task> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        assignee_id: assigneeId || undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        blocked_reason: status === 'blocked' ? blockedReason.trim() : undefined,
      };
      await onSave(task.id, updates);
      // Reset the dirty snapshot so a subsequent Cancel doesn't trigger the
      // discard prompt for changes that are already persisted.
      initial.current = { title: title.trim(), description: description.trim(), priority, status, assigneeId, deadline, blockedReason: status === 'blocked' ? blockedReason.trim() : '' };
      setConfirmDiscard(false);
      toast.success('Task saved', { duration: 1800 });
      onClose();
    } catch (err) {
      console.error('[TaskEditModal] save failed:', err);
      setError('Failed to save task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Disclosure summary — the one-line readout shown when collapsed. Empty
  // before first fetch, count after.
  const riskSummary: string = (() => {
    if (!hasFetchedBlockers) return 'Predict potential blockers';
    if (blockers.length === 0) return 'No blockers detected';
    const high = blockers.filter(b => b.confidence === 'high').length;
    if (high > 0) return `${high} high-confidence blocker${high === 1 ? '' : 's'}`;
    return `${blockers.length} potential blocker${blockers.length === 1 ? '' : 's'}`;
  })();

  const modalContent = (
    <div className="task-edit-modal-overlay" onClick={requestClose}>
      <div className="task-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="task-edit-modal-header">
          <h2 className="task-edit-modal-title">
            Edit Task
            {isDirty && (
              <span className="task-edit-dirty-dot" aria-label="Unsaved changes" title="Unsaved changes" />
            )}
          </h2>
          <button
            className="task-edit-modal-close"
            onClick={requestClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="task-edit-tabs" role="tablist" aria-label="Task details navigation">
          <button
            role="tab"
            aria-selected={activeTab === 'details'}
            aria-controls="details-panel"
            id="details-tab"
            className={activeTab === 'details' ? 'active' : ''}
            onClick={() => setActiveTab('details')}
            type="button"
            title="Details (⌘1)"
          >
            Details
            <span className="task-edit-tab-hint" aria-hidden>1</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'subtasks'}
            aria-controls="subtasks-panel"
            id="subtasks-tab"
            className={activeTab === 'subtasks' ? 'active' : ''}
            onClick={() => setActiveTab('subtasks')}
            type="button"
            title="Subtasks (⌘2)"
          >
            Subtasks
            <span className="task-edit-tab-hint" aria-hidden>2</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'activity'}
            aria-controls="activity-panel"
            id="activity-tab"
            className={activeTab === 'activity' ? 'active' : ''}
            onClick={() => setActiveTab('activity')}
            type="button"
            title="Activity (⌘3)"
          >
            Activity
            <span className="task-edit-tab-hint" aria-hidden>3</span>
          </button>
        </div>

        <div className="task-edit-content">
          {activeTab === 'details' && (
            <form
              onSubmit={handleSubmit}
              className="task-edit-modal-form"
              role="tabpanel"
              id="details-panel"
              aria-labelledby="details-tab"
            >
              {error && (
                <div className="task-edit-error" role="alert">
                  <span>{error}</span>
                </div>
              )}

              <div className="task-edit-field">
                <label htmlFor="task-title" className="task-edit-label">
                  Title <span className="required">*</span>
                </label>
                <input
                  id="task-title"
                  type="text"
                  className="task-edit-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter task title"
                  autoFocus
                  required
                />
              </div>

              <div className="task-edit-field">
                <label htmlFor="task-description" className="task-edit-label">
                  Description
                </label>
                <textarea
                  id="task-description"
                  className="task-edit-textarea"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add task description..."
                  rows={4}
                />
              </div>

              <div className="task-edit-field">
                <label id="task-priority-label" className="task-edit-label">
                  Priority
                </label>
                <div
                  className="task-edit-segmented"
                  role="radiogroup"
                  aria-labelledby="task-priority-label"
                >
                  {PRIORITY_OPTIONS.map(option => {
                    const active = priority === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`task-edit-segmented-pill${active ? ' is-active' : ''}`}
                        onClick={() => setPriority(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="task-edit-field">
                <label id="task-status-label" className="task-edit-label">
                  Status
                </label>
                <div
                  className="task-edit-segmented task-edit-segmented-wrap"
                  role="radiogroup"
                  aria-labelledby="task-status-label"
                >
                  {STATUS_OPTIONS.map(option => {
                    const active = status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-status={option.value}
                        className={`task-edit-status-pill${active ? ' is-active' : ''}`}
                        onClick={() => setStatus(option.value)}
                      >
                        <span className="task-edit-status-dot" aria-hidden />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {status === 'blocked' && (
                <div className="task-edit-field">
                  <label htmlFor="blocked-reason" className="task-edit-label">
                    Blocked Reason <span className="required">*</span>
                  </label>
                  <input
                    id="blocked-reason"
                    type="text"
                    className="task-edit-input"
                    value={blockedReason}
                    onChange={e => setBlockedReason(e.target.value)}
                    placeholder="Why is this task blocked?"
                    required={status === 'blocked'}
                  />
                </div>
              )}

              <div className="task-edit-row">
                <div className="task-edit-field">
                  <label htmlFor="task-assignee" className="task-edit-label">
                    Assignee
                  </label>
                  <select
                    id="task-assignee"
                    className="task-edit-select"
                    value={assigneeId}
                    onChange={e => setAssigneeId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {workspaceMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.full_name || member.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="task-edit-field">
                  <label htmlFor="task-deadline" className="task-edit-label">
                    Due Date
                  </label>
                  <input
                    id="task-deadline"
                    type="date"
                    className="task-edit-input"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="task-edit-field">
                <label className="task-edit-label">Location</label>
                <PlacePicker
                  entityType="task"
                  entityId={task.id}
                  role="primary"
                  onChange={setAttachedPlace}
                />
                {attachedPlace && (
                  <div className="task-edit-map-preview">
                    <MapPreview
                      placeId={attachedPlace.id}
                      height={140}
                      addressOverride={attachedPlace.address ?? undefined}
                    />
                  </div>
                )}
              </div>

              {/* Risk Read — quiet disclosure under the form. Lazy-fires the
                  blocker AI only on first expand, not on modal open. */}
              {task.status !== 'done' && task.status !== 'cancelled' && (
                <div className="risk-read" data-open={riskOpen ? 'true' : 'false'}>
                  <button
                    type="button"
                    className="risk-read-trigger"
                    onClick={handleToggleRisk}
                    aria-expanded={riskOpen}
                    aria-controls="risk-read-body"
                  >
                    <span className="risk-read-label-group">
                      <span className="risk-read-label">Risk Read</span>
                      {hasFetchedBlockers && blockers.length > 0 && (
                        <span className="risk-read-count">{blockers.length}</span>
                      )}
                    </span>
                    <span className="risk-read-summary">{riskSummary}</span>
                    <ChevronDown size={14} className="risk-read-chevron" />
                  </button>

                  {riskOpen && (
                    <div id="risk-read-body" className="risk-read-body">
                      {isLoadingBlockers && (
                        <div className="risk-read-loading">
                          <span className="risk-read-loading-dot" />
                          Analyzing…
                        </div>
                      )}

                      {!isLoadingBlockers && hasFetchedBlockers && blockers.length === 0 && (
                        <p className="risk-read-empty">No blockers detected in this workspace.</p>
                      )}

                      {!isLoadingBlockers && blockers.map((b, idx) => (
                        <div key={idx} className="risk-read-item">
                          <span
                            className="risk-read-item-confidence"
                            data-level={b.confidence}
                          >
                            {b.confidence}
                          </span>
                          <p className="risk-read-item-blocker">{b.blocker}</p>
                          <p className="risk-read-item-mitigation">{b.mitigation}</p>
                        </div>
                      ))}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {hasFetchedBlockers && (
                          <AIProvenanceChip vendor="PULSE AI" type="RISK READ" />
                        )}
                        <button
                          type="button"
                          className="risk-read-reanalyze"
                          onClick={handleReanalyze}
                          disabled={isLoadingBlockers}
                        >
                          {hasFetchedBlockers ? 'Re-analyze' : 'Analyze'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {confirmDiscard && (
                <div className="task-edit-discard" role="alert">
                  <span className="task-edit-discard-label">Unsaved changes</span>
                  <span className="task-edit-discard-help">
                    Press <kbd>ESC</kbd> again to discard, or <kbd>⌘</kbd>+<kbd>↵</kbd> to save.
                  </span>
                  <button
                    type="button"
                    className="task-edit-discard-action"
                    onClick={onClose}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="task-edit-discard-action task-edit-discard-action-keep"
                    onClick={() => setConfirmDiscard(false)}
                  >
                    Keep editing
                  </button>
                </div>
              )}

              <div className="task-edit-modal-footer">
                <button
                  type="button"
                  className="task-edit-button task-edit-button-secondary"
                  onClick={requestClose}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="task-edit-button task-edit-button-primary"
                  disabled={isSaving}
                  title="Save changes (⌘↵)"
                >
                  {isSaving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                      <span className="task-edit-button-hint" aria-hidden>⌘↵</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'subtasks' && (
            <div
              role="tabpanel"
              id="subtasks-panel"
              aria-labelledby="subtasks-tab"
            >
              <SubtaskList
                taskId={task.id}
                workspaceId={task.workspace_id}
                taskTitle={title}
                taskDescription={description}
                taskPriority={priority}
                currentUserId={user?.id}
              />
            </div>
          )}

          {activeTab === 'activity' && (
            <div
              role="tabpanel"
              id="activity-panel"
              aria-labelledby="activity-tab"
            >
              <TaskActivityFeed taskId={task.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

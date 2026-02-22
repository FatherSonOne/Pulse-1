import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle } from 'lucide-react';
import { Task } from '../../services/taskService';
import { User } from '../../types';
import './TaskEditModal.css';

interface TaskEditModalProps {
  task: Task;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => Promise<void>;
  workspaceMembers?: User[];
}

const PRIORITY_OPTIONS: Array<{ value: Task['priority']; label: string; color: string }> = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'urgent', label: 'Urgent', color: '#dc2626' }
];

const STATUS_OPTIONS: Array<{ value: Task['status']; label: string; icon: string }> = [
  { value: 'todo', label: 'To Do', icon: '📋' },
  { value: 'in_progress', label: 'In Progress', icon: '🔨' },
  { value: 'in_review', label: 'In Review', icon: '👀' },
  { value: 'blocked', label: 'Blocked', icon: '🚫' },
  { value: 'done', label: 'Done', icon: '✅' },
  { value: 'cancelled', label: 'Cancelled', icon: '❌' }
];

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  task,
  onClose,
  onSave,
  workspaceMembers = []
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<Task['priority']>(task.priority);
  const [status, setStatus] = useState<Task['status']>(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [deadline, setDeadline] = useState(task.deadline ? task.deadline.split('T')[0] : '');
  const [blockedReason, setBlockedReason] = useState(task.blocked_reason || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus trap
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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
        blocked_reason: status === 'blocked' ? blockedReason.trim() : undefined
      };

      await onSave(task.id, updates);
      onClose();
    } catch (err) {
      console.error('Error saving task:', err);
      setError('Failed to save task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <div className="task-edit-modal-overlay" onClick={onClose}>
      <div className="task-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-edit-modal-header">
          <h2 className="task-edit-modal-title">Edit Task</h2>
          <button
            className="task-edit-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-edit-modal-form">
          {error && (
            <div className="task-edit-error" role="alert">
              <AlertCircle size={16} />
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
              onChange={(e) => setTitle(e.target.value)}
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add task description..."
              rows={4}
            />
          </div>

          <div className="task-edit-row">
            <div className="task-edit-field">
              <label htmlFor="task-priority" className="task-edit-label">
                Priority
              </label>
              <select
                id="task-priority"
                className="task-edit-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task['priority'])}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="task-edit-field">
              <label htmlFor="task-status" className="task-edit-label">
                Status
              </label>
              <select
                id="task-status"
                className="task-edit-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as Task['status'])}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
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
                onChange={(e) => setBlockedReason(e.target.value)}
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
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {workspaceMembers.map((member) => (
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
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="task-edit-modal-footer">
            <button
              type="button"
              className="task-edit-button task-edit-button-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="task-edit-button task-edit-button-primary"
              disabled={isSaving}
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

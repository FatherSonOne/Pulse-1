import React, { useState, memo } from 'react';
import { Task } from '../../services/taskService';
import {
  CheckSquare,
  Square,
  Clock,
  AlertCircle,
  User,
  Target,
  Zap,
  Link2,
  ChevronRight,
  Edit2,
  Trash2
} from 'lucide-react';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import './EnhancedTaskCard.css';

export interface EnhancedTaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: Task['status']) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onEdit?: (task: Task) => void;
  allTasks?: Task[]; // For showing dependency details
}

// Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (
  prevProps: EnhancedTaskCardProps,
  nextProps: EnhancedTaskCardProps
): boolean => {
  // Check if task ID or updated_at changed
  if (prevProps.task.id !== nextProps.task.id) return false;
  if (prevProps.task.updated_at !== nextProps.task.updated_at) return false;

  // Check if status changed
  if (prevProps.task.status !== nextProps.task.status) return false;

  // Check if priority changed
  if (prevProps.task.priority !== nextProps.task.priority) return false;

  // Check if allTasks length changed (dependency updates)
  if ((prevProps.allTasks?.length || 0) !== (nextProps.allTasks?.length || 0)) return false;

  // Props are equal, skip re-render
  return true;
};

const EnhancedTaskCardComponent: React.FC<EnhancedTaskCardProps> = ({
  task,
  onStatusChange,
  onDelete,
  onEdit,
  allTasks = []
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showActions, setShowActions] = useState(false);
  // Two-step inline confirmation for delete. First click arms, second click
  // within 4 seconds executes. Auto-disarms via timeout.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Get AI columns from task metadata
  const aiScore = task.metadata?.ai_priority_score || task.metadata?.aiScore || null;
  const aiAssignee = task.metadata?.ai_suggested_assignee || null;
  const aiDuration = task.metadata?.ai_predicted_duration || null;
  const blocksTaskIds = task.metadata?.blocks_task_ids || [];
  const blockedByTaskIds = task.metadata?.blocked_by_task_ids || [];

  const handleStatusToggle = async () => {
    setIsUpdating(true);
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      await onStatusChange(task.id, newStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: Task['status']) => {
    setIsUpdating(true);
    try {
      await onStatusChange(task.id, newStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Phase 7.5: Keyboard navigation handlers
  const handleCheckboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleStatusToggle();
    }
  };

  const handleActionKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      window.setTimeout(() => setConfirmingDelete(false), 4000);
      return;
    }
    setConfirmingDelete(false);
    await onDelete(task.id);
  };

  const isOverdue = (): boolean => {
    if (!task.deadline || task.status === 'done') return false;
    return new Date(task.deadline) < new Date();
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check if today
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }
      // Check if tomorrow
      if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    } catch (error) {
      return dateString;
    }
  };

  // Returns the canonical Pulse status token for an AI priority score.
  // The pair is (bg-soft, fg) so the chip carries a tinted background +
  // matching text color — same shape as every status pill in the system.
  const getAIScoreToneVars = (score: number): { bg: string; fg: string } => {
    if (score >= 80) return { bg: 'var(--pulse-tone-overdue-soft)', fg: 'var(--pulse-tone-overdue)' };
    if (score >= 60) return { bg: 'var(--pulse-tone-warning-soft)', fg: 'var(--pulse-tone-warning)' };
    if (score >= 40) return { bg: 'var(--pulse-tone-positive-soft)', fg: 'var(--pulse-tone-positive)' };
    return { bg: 'var(--pulse-tone-neutral-soft)', fg: 'var(--pulse-tone-neutral)' };
  };

  const getBlockedTasks = () => {
    if (blocksTaskIds.length === 0) return [];
    return allTasks.filter(t => blocksTaskIds.includes(t.id));
  };

  const getBlockingTasks = () => {
    if (blockedByTaskIds.length === 0) return [];
    return allTasks.filter(t => blockedByTaskIds.includes(t.id));
  };

  const blockedTasks = getBlockedTasks();
  const blockingTasks = getBlockingTasks();

  return (
    <div
      className={`enhanced-task-card status-${task.status} ${isOverdue() ? 'overdue' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      role="article"
      aria-label={`Task: ${task.title}`}
    >
      {/* Left side: Checkbox */}
      <button
        type="button"
        className="task-checkbox"
        onClick={handleStatusToggle}
        onKeyDown={handleCheckboxKeyDown}
        disabled={isUpdating}
        aria-label={task.status === 'done' ? 'Mark task as todo' : 'Mark task as done'}
      >
        {task.status === 'done' ? (
          <CheckSquare size={20} aria-hidden="true" />
        ) : (
          <Square size={20} aria-hidden="true" />
        )}
      </button>

      {/* Main content */}
      <div className="task-main-content">
        {/* Header row with title and priority */}
        <div className="task-header">
          <h4 className="task-title">{task.title}</h4>
          <div className="task-badges">
            {/* Manual Priority Badge — driven by class, not inline color, so
                priority intensity is decoupled from status colors and dark
                mode is a clean override (DESIGN.md: Status-Stays-Status Rule).
                Low priority hides the pill entirely; "low" is the default,
                showing it for every untriaged card adds visual chatter. */}
            {task.priority && task.priority !== 'low' && (
              <div className={`task-priority-badge priority-${task.priority}`}>
                {task.priority}
              </div>
            )}

            {/* AI Priority Score Badge — uses canonical status tone tokens
                (Status-Stays-Status rule); soft bg + matching fg. */}
            {aiScore !== null && (() => {
              const tone = getAIScoreToneVars(aiScore);
              return (
                <div
                  className="ai-score-badge"
                  style={{ backgroundColor: tone.bg, color: tone.fg }}
                  title={`AI Priority Score: ${aiScore}/100`}
                >
                  <Zap size={12} />
                  <span>{aiScore}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* AI Provenance — task originated from a template or decision decomposition */}
        {(task.metadata?.generated_from_template || task.metadata?.generated_from_decision) && (
          <div className="task-provenance">
            <AIProvenanceChip
              vendor="PULSE AI"
              type={task.metadata?.generated_from_template ? 'TEMPLATE' : 'DECISION'}
            />
          </div>
        )}

        {/* Description */}
        {task.description && (
          <p className="task-description">{task.description}</p>
        )}

        {/* AI Features Row */}
        {(aiAssignee || aiDuration || blockedTasks.length > 0 || blockingTasks.length > 0) && (
          <div className="task-ai-features">
            {/* AI Suggested Assignee */}
            {aiAssignee && !task.assignee_id && (
              <div className="ai-feature-item ai-assignee">
                <User size={14} />
                <span className="ai-label">AI suggests:</span>
                <span className="ai-value">{aiAssignee}</span>
              </div>
            )}

            {/* Predicted Duration */}
            {aiDuration && (
              <div className="ai-feature-item ai-duration">
                <Clock size={14} />
                <span className="ai-label">Est:</span>
                <span className="ai-value">{aiDuration}</span>
              </div>
            )}

            {/* Blocks Tasks */}
            {blockedTasks.length > 0 && (
              <div
                className="ai-feature-item dependency-indicator blocks"
                title={`Blocks: ${blockedTasks.map(t => t.title).join(', ')}`}
              >
                <Link2 size={14} />
                <span className="dependency-text">Blocks {blockedTasks.length} task{blockedTasks.length > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Blocked By Tasks */}
            {blockingTasks.length > 0 && (
              <div
                className="ai-feature-item dependency-indicator blocked-by"
                title={`Blocked by: ${blockingTasks.map(t => t.title).join(', ')}`}
              >
                <AlertCircle size={14} />
                <span className="dependency-text">Blocked by {blockingTasks.length} task{blockingTasks.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom meta row */}
        <div className="task-meta">
          {/* Assignee */}
          {task.assignee_id && (
            <div className="task-assignee">
              <User size={14} />
              <span>{task.assignee_id}</span>
            </div>
          )}

          {/* Due Date */}
          {task.deadline && (
            <div className={`task-due ${isOverdue() ? 'overdue' : ''}`}>
              {isOverdue() ? (
                <AlertCircle size={14} />
              ) : (
                <Clock size={14} />
              )}
              <span>
                {isOverdue() ? 'Overdue: ' : ''}
                {formatDate(task.deadline)}
              </span>
            </div>
          )}

          {/* Status selector for in-progress tasks */}
          {task.status !== 'done' && task.status !== 'todo' && (
            <select
              className="task-status-select"
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as Task['status'])}
              disabled={isUpdating}
              aria-label="Change task status"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="cancelled">Cancelled</option>
              <option value="done">Done</option>
            </select>
          )}
        </div>
      </div>

      {/* Right side: Action buttons (show on hover) */}
      {showActions && (
        <div className="task-actions" role="group" aria-label="Task actions">
          {onEdit && (
            <button
              type="button"
              className="task-action-button"
              onClick={() => onEdit(task)}
              onKeyDown={(e) => handleActionKeyDown(e, () => onEdit(task))}
              aria-label={`Edit task: ${task.title}`}
            >
              <Edit2 size={16} aria-hidden="true" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={`task-action-button delete${confirmingDelete ? ' is-confirming' : ''}`}
              onClick={handleDelete}
              onKeyDown={(e) => handleActionKeyDown(e, handleDelete)}
              aria-label={confirmingDelete ? `Confirm delete: ${task.title}` : `Delete task: ${task.title}`}
              aria-pressed={confirmingDelete}
              title={confirmingDelete ? 'Click again to confirm' : 'Delete'}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Export memoized component with custom comparison
export const EnhancedTaskCard = memo(EnhancedTaskCardComponent, arePropsEqual);

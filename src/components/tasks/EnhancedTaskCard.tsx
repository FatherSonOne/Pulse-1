import React, { useState } from 'react';
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
import './EnhancedTaskCard.css';

export interface EnhancedTaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, newStatus: Task['status']) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
  onEdit?: (task: Task) => void;
  allTasks?: Task[]; // For showing dependency details
}

export const EnhancedTaskCard: React.FC<EnhancedTaskCardProps> = ({
  task,
  onStatusChange,
  onDelete,
  onEdit,
  allTasks = []
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showActions, setShowActions] = useState(false);

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

  const handleDelete = async () => {
    if (onDelete && window.confirm('Are you sure you want to delete this task?')) {
      await onDelete(task.id);
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#10b981';
      case 'low':
      default: return '#6b7280';
    }
  };

  const isOverdue = (): boolean => {
    if (!task.due_date || task.status === 'done') return false;
    return new Date(task.due_date) < new Date();
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

  const getAIScoreColor = (score: number): string => {
    if (score >= 80) return '#ef4444'; // Red for high priority
    if (score >= 60) return '#f59e0b'; // Amber for medium-high
    if (score >= 40) return '#10b981'; // Green for medium
    return '#6b7280'; // Gray for low
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
    >
      {/* Left side: Checkbox */}
      <button
        className="task-checkbox"
        onClick={handleStatusToggle}
        disabled={isUpdating}
        aria-label={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
      >
        {task.status === 'done' ? (
          <CheckSquare size={20} />
        ) : (
          <Square size={20} />
        )}
      </button>

      {/* Main content */}
      <div className="task-main-content">
        {/* Header row with title and priority */}
        <div className="task-header">
          <h4 className="task-title">{task.title}</h4>
          <div className="task-badges">
            {/* Manual Priority Badge */}
            <div
              className="task-priority-badge"
              style={{
                backgroundColor: `${getPriorityColor(task.priority)}15`,
                color: getPriorityColor(task.priority)
              }}
            >
              {task.priority}
            </div>

            {/* AI Priority Score Badge */}
            {aiScore !== null && (
              <div
                className="ai-score-badge"
                style={{
                  backgroundColor: `${getAIScoreColor(aiScore)}15`,
                  color: getAIScoreColor(aiScore)
                }}
                title={`AI Priority Score: ${aiScore}/100`}
              >
                <Zap size={12} />
                <span>{aiScore}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="task-description">{task.description}</p>
        )}

        {/* AI Features Row */}
        {(aiAssignee || aiDuration || blockedTasks.length > 0 || blockingTasks.length > 0) && (
          <div className="task-ai-features">
            {/* AI Suggested Assignee */}
            {aiAssignee && !task.assigned_to && (
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
          {task.assigned_to && (
            <div className="task-assignee">
              <User size={14} />
              <span>{task.assigned_to}</span>
            </div>
          )}

          {/* Due Date */}
          {task.due_date && (
            <div className={`task-due ${isOverdue() ? 'overdue' : ''}`}>
              {isOverdue() ? (
                <AlertCircle size={14} />
              ) : (
                <Clock size={14} />
              )}
              <span>
                {isOverdue() ? 'Overdue: ' : ''}
                {formatDate(task.due_date)}
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
        <div className="task-actions">
          {onEdit && (
            <button
              className="task-action-button"
              onClick={() => onEdit(task)}
              title="Edit task"
              aria-label="Edit task"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onDelete && (
            <button
              className="task-action-button delete"
              onClick={handleDelete}
              title="Delete task"
              aria-label="Delete task"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

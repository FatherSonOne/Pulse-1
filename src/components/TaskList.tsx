import React, { useEffect, useState } from 'react';
import { taskService, Task } from '../services/taskService';
import { CheckSquare, Square, Clock, AlertCircle, User } from 'lucide-react';
import './TaskList.css';

export type TaskStatus = Task['status'];

interface TaskListProps {
  workspaceId: string;
  userId?: string;
  statusFilter?: TaskStatus;
  showOverdueOnly?: boolean;
}

interface TaskWithAssignee extends Task {
  assignee?: {
    id: string;
    full_name: string;
  };
}

export const TaskList: React.FC<TaskListProps> = ({
  workspaceId,
  userId,
  statusFilter,
  showOverdueOnly = false
}) => {
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [workspaceId, userId, statusFilter, showOverdueOnly]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      let taskData: Task[];

      if (userId) {
        // Get tasks for specific user
        taskData = await taskService.getUserTasks(workspaceId, userId);
      } else {
        // Get all workspace tasks
        taskData = await taskService.getWorkspaceTasks(workspaceId);
      }

      // Filter by status if provided
      if (statusFilter) {
        taskData = taskData.filter(task => task.status === statusFilter);
      }

      // Filter overdue tasks if requested
      if (showOverdueOnly) {
        taskData = taskData.filter(task =>
          task.due_date && new Date(task.due_date) < new Date()
        );
      }

      setTasks(taskData as TaskWithAssignee[]);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const success = await taskService.updateTaskStatus(taskId, newStatus);
      if (success) {
        await loadTasks();
      }
    } catch (error) {
      console.error('Failed to update task:', error);
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

  const isOverdue = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="task-list loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="task-list empty">
        <CheckSquare size={48} color="#ccc" />
        <p>No tasks found</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map(task => (
        <div
          key={task.id}
          className={`task-item status-${task.status} ${
            isOverdue(task.due_date) ? 'overdue' : ''
          }`}
        >
          <button
            className="task-checkbox"
            onClick={() =>
              handleStatusChange(
                task.id,
                task.status === 'done' ? 'todo' : 'done'
              )
            }
            aria-label={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
          >
            {task.status === 'done' ? (
              <CheckSquare size={20} />
            ) : (
              <Square size={20} />
            )}
          </button>

          <div className="task-content">
            <div className="task-header">
              <h4>{task.title}</h4>
              <div
                className="task-priority"
                style={{
                  backgroundColor: `${getPriorityColor(task.priority)}15`,
                  color: getPriorityColor(task.priority)
                }}
              >
                {task.priority}
              </div>
            </div>

            {task.description && (
              <p className="task-description">{task.description}</p>
            )}

            <div className="task-meta">
              {task.assignee && (
                <div className="task-assignee">
                  <User size={14} />
                  <span>{task.assignee.full_name}</span>
                </div>
              )}

              {task.due_date && (
                <div className={`task-due ${isOverdue(task.due_date) ? 'overdue' : ''}`}>
                  {isOverdue(task.due_date) ? (
                    <AlertCircle size={14} />
                  ) : (
                    <Clock size={14} />
                  )}
                  <span>
                    {isOverdue(task.due_date) ? 'Overdue: ' : 'Due: '}
                    {formatDate(task.due_date)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {task.status !== 'done' && task.status !== 'todo' && (
            <select
              className="task-status-select"
              value={task.status}
              onChange={(e) =>
                handleStatusChange(task.id, e.target.value as TaskStatus)
              }
              aria-label="Change task status"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="cancelled">Cancelled</option>
              <option value="done">Done</option>
            </select>
          )}
        </div>
      ))}
    </div>
  );
};

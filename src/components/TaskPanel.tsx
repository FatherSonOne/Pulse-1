import React, { useState, useEffect } from 'react';
import { taskService, Task } from '../services/taskService';
import { CheckSquare, Square, Clock, User, Calendar, Plus, X } from 'lucide-react';
import './TaskPanel.css';

interface TaskPanelProps {
  workspaceId: string;
  currentUserId: string;
  onTaskClick?: (taskId: string, messageId: string) => void;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
  workspaceId,
  currentUserId,
  onTaskClick
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'mine' | 'pending'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
    
    // Subscribe to task updates
    const unsubscribe = taskService.subscribeToTaskUpdates(
      workspaceId,
      (updatedTask) => {
        setTasks(prev => {
          const index = prev.findIndex(t => t.id === updatedTask.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = updatedTask;
            return updated;
          }
          return [updatedTask, ...prev];
        });
      }
    );

    return unsubscribe;
  }, [workspaceId]);

  const loadTasks = async () => {
    setLoading(true);
    const data = await taskService.getWorkspaceTasks(workspaceId);
    setTasks(data);
    setLoading(false);
  };

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    const newStatus: Task['status'] = currentStatus === 'done' ? 'todo' : 'done';
    await taskService.updateTaskStatus(taskId, newStatus);
    await loadTasks();
  };

  const getFilteredTasks = () => {
    switch (filter) {
      case 'mine':
        return tasks.filter(t => t.assigned_to === currentUserId);
      case 'pending':
        return tasks.filter(t => t.status === 'todo' || t.status === 'in_progress');
      default:
        return tasks;
    }
  };

  const filteredTasks = getFilteredTasks();
  const pendingCount = tasks.filter(t =>
    t.status === 'todo' || t.status === 'in_progress'
  ).length;
  const myTasksCount = tasks.filter(t => t.assigned_to === currentUserId).length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#64748b';
    }
  };

  const formatDeadline = (deadline?: string) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Overdue', className: 'overdue' };
    if (diffDays === 0) return { text: 'Today', className: 'today' };
    if (diffDays === 1) return { text: 'Tomorrow', className: 'soon' };
    if (diffDays <= 7) return { text: `${diffDays}d`, className: 'soon' };
    return { text: date.toLocaleDateString(), className: '' };
  };

  if (loading) {
    return (
      <div className="task-panel">
        <div className="panel-header">
          <h3>Tasks</h3>
        </div>
        <div className="panel-loading">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="task-panel">
      <div className="panel-header">
        <h3>
          <CheckSquare size={20} />
          Tasks
        </h3>
        <span className="task-count">{filteredTasks.length}</span>
      </div>

      <div className="task-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({tasks.length})
        </button>
        <button
          className={`filter-btn ${filter === 'mine' ? 'active' : ''}`}
          onClick={() => setFilter('mine')}
        >
          Mine ({myTasksCount})
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Active ({pendingCount})
        </button>
      </div>

      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <CheckSquare size={48} opacity={0.3} />
            <p>No tasks found</p>
            <span>Tasks will appear here when extracted from messages</span>
          </div>
        ) : (
          filteredTasks.map(task => {
            const deadline = formatDeadline(task.due_date);
            const isCompleted = task.status === 'done';

            return (
              <div
                key={task.id}
                className={`task-item ${isCompleted ? 'completed' : ''}`}
                onClick={() => onTaskClick?.(task.id, task.message_id || '')}
              >
                <button
                  className="task-checkbox"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleComplete(task.id, task.status);
                  }}
                >
                  {isCompleted ? (
                    <CheckSquare size={20} className="checked" />
                  ) : (
                    <Square size={20} />
                  )}
                </button>

                <div className="task-content">
                  <div className="task-header">
                    <span
                      className="priority-indicator"
                      style={{ backgroundColor: getPriorityColor(task.priority) }}
                      title={task.priority}
                    />
                    <span className="task-title">{task.title}</span>
                  </div>

                  {task.description && (
                    <p className="task-description">{task.description}</p>
                  )}

                  <div className="task-meta">
                    {task.assigned_to && (
                      <span className="meta-item">
                        <User size={12} />
                        {task.assigned_to === currentUserId ? 'You' : 'Assigned'}
                      </span>
                    )}
                    {deadline && (
                      <span className={`meta-item deadline ${deadline.className}`}>
                        <Calendar size={12} />
                        {deadline.text}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

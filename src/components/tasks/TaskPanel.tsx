import { useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Clock,
  User,
  AlertTriangle,
  Plus,
  Calendar
} from 'lucide-react';
import { taskService, Task } from '../../services/taskService';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import './TaskPanel.css';

interface TaskPanelProps {
  workspaceId: string;
  currentUserId: string;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({ 
  workspaceId, 
  currentUserId 
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | Task['status']>('all');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    assigned_to: '',
    due_date: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTasks();
    
    // Subscribe to real-time updates
    const subscription = taskService.subscribeToTasks(
      workspaceId,
      () => loadTasks()
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [workspaceId]);

  const loadTasks = async () => {
    const data = await taskService.getWorkspaceTasks(workspaceId);
    setTasks(data);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    setLoading(true);
    await taskService.createTask({
      workspace_id: workspaceId,
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      assigned_to: newTask.assigned_to || undefined,
      due_date: newTask.due_date || undefined,
      created_by: currentUserId
    });

    setNewTask({ 
      title: '', 
      description: '', 
      priority: 'medium',
      assigned_to: '',
      due_date: ''
    });
    setShowCreateForm(false);
    setLoading(false);
    loadTasks();
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await taskService.updateTaskStatus(task.id, newStatus);
    loadTasks();
  };

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    await taskService.updateTaskStatus(taskId, newStatus);
    loadTasks();
  };

  const getPriorityColor = (priority: Task['priority']) => {
    const colors = {
      low: '#94a3b8',
      medium: '#60a5fa',
      high: '#f59e0b',
      urgent: '#ef4444'
    };
    return colors[priority];
  };

  const getPriorityIcon = (priority: Task['priority']) => {
    if (priority === 'urgent' || priority === 'high') {
      return <AlertTriangle size={16} />;
    }
    return <Clock size={16} />;
  };

  const filteredTasks = tasks.filter(task => 
    filterStatus === 'all' || task.status === filterStatus
  );

  const taskStats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length
  };

  return (
    <div className="task-panel">
      <div className="task-header">
        <h2>✅ Tasks</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      <div className="task-stats">
        <div className="stat">
          <span className="stat-label">Total</span>
          <span className="stat-value">{taskStats.total}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Todo</span>
          <span className="stat-value">{taskStats.todo}</span>
        </div>
        <div className="stat">
          <span className="stat-label">In Progress</span>
          <span className="stat-value">{taskStats.in_progress}</span>
        </div>
        <div className="stat done">
          <span className="stat-label">Done</span>
          <span className="stat-value">{taskStats.done}</span>
        </div>
      </div>

      {showCreateForm && (
        <form className="task-form" onSubmit={handleCreateTask}>
          <div className="input-with-voice">
            <input
              type="text"
              placeholder="Task title..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              required
            />
            <VoiceTextButton
              onTranscript={(text) => setNewTask(prev => ({ ...prev, title: prev.title + (prev.title && !prev.title.endsWith(' ') ? ' ' : '') + text }))}
              size="sm"
            />
          </div>
          <div className="input-with-voice">
            <textarea
              placeholder="Description (optional)"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              rows={3}
            />
            <VoiceTextButton
              onTranscript={(text) => setNewTask(prev => ({ ...prev, description: (prev.description || '') + ((prev.description && !prev.description.endsWith(' ')) ? ' ' : '') + text }))}
              size="sm"
            />
          </div>
          <div className="form-row">
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ 
                ...newTask, 
                priority: e.target.value as Task['priority']
              })}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              placeholder="Due date"
            />
          </div>
          <input
            type="text"
            placeholder="Assign to (user ID, optional)"
            value={newTask.assigned_to}
            onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
          />
          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="task-filters">
        <button 
          className={filterStatus === 'all' ? 'active' : ''}
          onClick={() => setFilterStatus('all')}
        >
          All
        </button>
        <button 
          className={filterStatus === 'todo' ? 'active' : ''}
          onClick={() => setFilterStatus('todo')}
        >
          Todo
        </button>
        <button 
          className={filterStatus === 'in_progress' ? 'active' : ''}
          onClick={() => setFilterStatus('in_progress')}
        >
          In Progress
        </button>
        <button 
          className={filterStatus === 'done' ? 'active' : ''}
          onClick={() => setFilterStatus('done')}
        >
          Done
        </button>
      </div>

      <div className="tasks-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <CheckSquare size={48} />
            <p>No tasks yet</p>
            <small>Create your first task to get started</small>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div 
              key={task.id} 
              className={`task-card status-${task.status} priority-${task.priority}`}
            >
              <div className="task-checkbox" onClick={() => handleToggleStatus(task)}>
                {task.status === 'done' ? (
                  <CheckSquare className="checked" />
                ) : (
                  <Square />
                )}
              </div>

              <div className="task-content">
                <div className="task-header-row">
                  <h3 className={task.status === 'done' ? 'completed' : ''}>
                    {task.title}
                  </h3>
                  <div 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  >
                    {getPriorityIcon(task.priority)}
                    {task.priority}
                  </div>
                </div>

                {task.description && (
                  <p className="task-description">{task.description}</p>
                )}

                <div className="task-meta">
                  {task.assigned_to && (
                    <span className="task-meta-item">
                      <User size={14} />
                      Assigned to: {task.assigned_to}
                    </span>
                  )}
                  {task.due_date && (
                    <span className="task-meta-item">
                      <Calendar size={14} />
                      Due: {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <span className="task-meta-item">
                    Created {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>

                {task.status !== 'done' && task.status !== 'cancelled' && (
                  <div className="task-actions">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="todo">Todo</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

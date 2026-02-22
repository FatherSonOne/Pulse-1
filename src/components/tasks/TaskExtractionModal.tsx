import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Plus, CheckCircle2, Sparkles } from 'lucide-react';
import { Task } from '../../services/taskService';
import './TaskExtractionModal.css';

export interface ExtractedTask {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_duration?: string;
}

interface TaskExtractionModalProps {
  tasks: ExtractedTask[];
  decisionTitle: string;
  onClose: () => void;
  onSave: (tasks: ExtractedTask[]) => Promise<void>;
}

export const TaskExtractionModal: React.FC<TaskExtractionModalProps> = ({
  tasks: initialTasks,
  decisionTitle,
  onClose,
  onSave
}) => {
  const [tasks, setTasks] = useState<ExtractedTask[]>(initialTasks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTaskChange = (index: number, field: keyof ExtractedTask, value: string) => {
    setTasks(prev => prev.map((task, i) =>
      i === index ? { ...task, [field]: value } : task
    ));
  };

  const handleRemoveTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTask = () => {
    setTasks(prev => [...prev, {
      title: '',
      description: '',
      priority: 'medium'
    }]);
  };

  const handleSave = async () => {
    // Validate tasks
    const validTasks = tasks.filter(t => t.title.trim() !== '');

    if (validTasks.length === 0) {
      setError('At least one task with a title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(validTasks);
      onClose();
    } catch (err) {
      console.error('Failed to save tasks:', err);
      setError('Failed to save tasks. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="task-extraction-overlay" onClick={onClose}>
      <div className="task-extraction-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="task-extraction-header">
          <div className="task-extraction-header-content">
            <div className="task-extraction-icon">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="task-extraction-title">Review Extracted Tasks</h2>
              <p className="task-extraction-subtitle">
                From: {decisionTitle}
              </p>
            </div>
          </div>
          <button
            className="task-extraction-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="task-extraction-body">
          {error && (
            <div className="task-extraction-error">
              {error}
            </div>
          )}

          <div className="task-extraction-help">
            <span className="help-icon">ℹ️</span>
            Review and edit the AI-generated tasks below. You can modify titles, descriptions, priorities, or remove tasks you don't need.
          </div>

          <div className="task-extraction-list">
            {tasks.map((task, index) => (
              <div key={index} className="extracted-task-card">
                <div className="extracted-task-header">
                  <span className="extracted-task-number">{index + 1}</span>
                  <button
                    className="extracted-task-remove"
                    onClick={() => handleRemoveTask(index)}
                    title="Remove task"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="extracted-task-fields">
                  <div className="extracted-task-field">
                    <label className="extracted-task-label">
                      Title <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="extracted-task-input"
                      value={task.title}
                      onChange={e => handleTaskChange(index, 'title', e.target.value)}
                      placeholder="Enter task title"
                    />
                  </div>

                  <div className="extracted-task-field">
                    <label className="extracted-task-label">Description</label>
                    <textarea
                      className="extracted-task-textarea"
                      value={task.description || ''}
                      onChange={e => handleTaskChange(index, 'description', e.target.value)}
                      placeholder="Add task description..."
                      rows={2}
                    />
                  </div>

                  <div className="extracted-task-row">
                    <div className="extracted-task-field">
                      <label className="extracted-task-label">Priority</label>
                      <select
                        className="extracted-task-select"
                        value={task.priority}
                        onChange={e => handleTaskChange(index, 'priority', e.target.value as any)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    {task.estimated_duration && (
                      <div className="extracted-task-field">
                        <label className="extracted-task-label">Estimated Duration</label>
                        <input
                          type="text"
                          className="extracted-task-input"
                          value={task.estimated_duration}
                          onChange={e => handleTaskChange(index, 'estimated_duration', e.target.value)}
                          placeholder="e.g. 2 hours, 1 day"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {tasks.length === 0 && (
              <div className="task-extraction-empty">
                <p>No tasks extracted. Click "Add Task" to create one manually.</p>
              </div>
            )}
          </div>

          <button
            className="task-extraction-add-button"
            onClick={handleAddTask}
          >
            <Plus size={16} />
            Add Task
          </button>
        </div>

        {/* Footer */}
        <div className="task-extraction-footer">
          <button
            className="task-extraction-button task-extraction-button-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="task-extraction-button task-extraction-button-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Create {tasks.filter(t => t.title.trim()).length} {tasks.filter(t => t.title.trim()).length === 1 ? 'Task' : 'Tasks'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

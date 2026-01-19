import { useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  User,
  Calendar,
  AlertTriangle,
  Zap,
  RefreshCw,
  Check,
  X,
  Edit2,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { extractTaskFromMessage } from '../../services/geminiService';
import { taskService, Task, ExtractedTask } from '../../services/taskService';
import { Message, Contact } from '../../types';
import './TaskExtractor.css';

interface TaskExtractorProps {
  workspaceId: string;
  userId: string;
  messages: Message[];
  contacts: Contact[];
  apiKey: string;
  onTaskCreated?: (task: Task) => void;
}

interface ExtractedTaskWithMeta extends ExtractedTask {
  id: string;
  sourceMessageId?: string;
  sourceText: string;
  selected: boolean;
  editing: boolean;
}

export const TaskExtractor: React.FC<TaskExtractorProps> = ({
  workspaceId,
  userId,
  messages,
  contacts,
  apiKey,
  onTaskCreated
}) => {
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTaskWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const extractTasksFromMessages = async () => {
    if (!apiKey || messages.length === 0) return;

    setExtracting(true);
    const contactNames = contacts.map((c) => c.name);
    const extracted: ExtractedTaskWithMeta[] = [];

    // Process recent messages (last 20)
    const recentMessages = messages.slice(-20);

    for (const message of recentMessages) {
      if (message.text && message.text.length > 10) {
        try {
          const task = await extractTaskFromMessage(apiKey, message.text, contactNames);
          if (task && task.title) {
            extracted.push({
              id: `extracted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: task.title,
              description: '',
              assigned_to: task.assigneeName,
              due_date: task.dueDate ? task.dueDate.toISOString().split('T')[0] : undefined,
              priority: 'medium',
              sourceMessageId: message.id,
              sourceText: message.text,
              selected: true,
              editing: false
            });
          }
        } catch (error) {
          console.error('Error extracting task from message:', error);
        }
      }
    }

    setExtractedTasks(extracted);
    setExtracting(false);

    if (extracted.length > 0) {
      setShowConfirm(true);
    }
  };

  const handleToggleSelect = (taskId: string) => {
    setExtractedTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, selected: !t.selected } : t
      )
    );
  };

  const handleSelectAll = () => {
    const allSelected = extractedTasks.every((t) => t.selected);
    setExtractedTasks((prev) =>
      prev.map((t) => ({ ...t, selected: !allSelected }))
    );
  };

  const handleEditTask = (taskId: string) => {
    setExtractedTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, editing: true } : t
      )
    );
    setExpandedTask(taskId);
  };

  const handleUpdateTask = (taskId: string, updates: Partial<ExtractedTaskWithMeta>) => {
    setExtractedTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      )
    );
  };

  const handleSaveEdit = (taskId: string) => {
    setExtractedTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, editing: false } : t
      )
    );
  };

  const handleRemoveTask = (taskId: string) => {
    setExtractedTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleCreateTasks = async () => {
    const selectedTasks = extractedTasks.filter((t) => t.selected);
    if (selectedTasks.length === 0) return;

    setCreatingTasks(true);

    for (const task of selectedTasks) {
      // Find contact ID by name if assigned
      let assignedTo: string | undefined;
      if (task.assigned_to) {
        const contact = contacts.find(
          (c) => c.name.toLowerCase() === task.assigned_to?.toLowerCase()
        );
        assignedTo = contact?.id;
      }

      const createdTask = await taskService.createTask({
        workspace_id: workspaceId,
        message_id: task.sourceMessageId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        assigned_to: assignedTo,
        due_date: task.due_date,
        created_by: userId
      });

      if (createdTask) {
        onTaskCreated?.(createdTask);
      }
    }

    setCreatingTasks(false);
    setShowConfirm(false);
    setExtractedTasks([]);
  };

  const getPriorityColor = (priority: Task['priority']) => {
    const colors = {
      low: '#94a3b8',
      medium: '#60a5fa',
      high: '#f59e0b',
      urgent: '#ef4444'
    };
    return colors[priority || 'medium'];
  };

  const selectedCount = extractedTasks.filter((t) => t.selected).length;

  return (
    <div className="task-extractor">
      <div className="extractor-header">
        <h3>
          <Sparkles size={20} /> AI Task Extractor
        </h3>
        <button
          className="btn-extract"
          onClick={extractTasksFromMessages}
          disabled={extracting || messages.length === 0}
        >
          {extracting ? (
            <>
              <RefreshCw size={16} className="spinning" />
              Extracting...
            </>
          ) : (
            <>
              <Zap size={16} />
              Extract Tasks
            </>
          )}
        </button>
      </div>

      {extractedTasks.length === 0 && !extracting && (
        <div className="empty-state">
          <CheckSquare size={48} />
          <h4>No Tasks Extracted Yet</h4>
          <p>Click "Extract Tasks" to scan recent messages for action items</p>
          <ul className="extraction-tips">
            <li>The AI will look for action items, to-dos, and assignments</li>
            <li>Patterns like "can you...", "please...", "TODO:" are detected</li>
            <li>You can edit and select which tasks to create</li>
          </ul>
        </div>
      )}

      {extractedTasks.length > 0 && (
        <div className="extracted-tasks-list">
          <div className="list-header">
            <button className="btn-select-all" onClick={handleSelectAll}>
              {extractedTasks.every((t) => t.selected) ? (
                <CheckSquare size={16} />
              ) : (
                <Square size={16} />
              )}
              Select All ({selectedCount}/{extractedTasks.length})
            </button>
          </div>

          {extractedTasks.map((task) => (
            <div
              key={task.id}
              className={`extracted-task-card ${task.selected ? 'selected' : ''}`}
            >
              <div className="task-main">
                <button
                  className="task-checkbox"
                  onClick={() => handleToggleSelect(task.id)}
                >
                  {task.selected ? (
                    <CheckSquare size={20} className="checked" />
                  ) : (
                    <Square size={20} />
                  )}
                </button>

                <div className="task-content">
                  {task.editing ? (
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => handleUpdateTask(task.id, { title: e.target.value })}
                      className="edit-input"
                      autoFocus
                    />
                  ) : (
                    <h4>{task.title}</h4>
                  )}

                  <div className="task-meta">
                    {task.assigned_to && (
                      <span className="meta-item">
                        <User size={12} />
                        {task.assigned_to}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="meta-item">
                        <Calendar size={12} />
                        {task.due_date}
                      </span>
                    )}
                    <span
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(task.priority) }}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>

                <div className="task-actions">
                  {task.editing ? (
                    <button onClick={() => handleSaveEdit(task.id)}>
                      <Check size={16} />
                    </button>
                  ) : (
                    <button onClick={() => handleEditTask(task.id)}>
                      <Edit2 size={16} />
                    </button>
                  )}
                  <button onClick={() => handleRemoveTask(task.id)}>
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() =>
                      setExpandedTask(expandedTask === task.id ? null : task.id)
                    }
                  >
                    {expandedTask === task.id ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </button>
                </div>
              </div>

              {expandedTask === task.id && (
                <div className="task-expanded">
                  <div className="source-text">
                    <label>Source Message:</label>
                    <p>"{task.sourceText}"</p>
                  </div>

                  <div className="edit-fields">
                    <div className="field">
                      <label>Description</label>
                      <textarea
                        value={task.description || ''}
                        onChange={(e) =>
                          handleUpdateTask(task.id, { description: e.target.value })
                        }
                        placeholder="Add description..."
                        rows={2}
                      />
                    </div>

                    <div className="field-row">
                      <div className="field">
                        <label>Assign To</label>
                        <select
                          value={task.assigned_to || ''}
                          onChange={(e) =>
                            handleUpdateTask(task.id, { assigned_to: e.target.value })
                          }
                        >
                          <option value="">Unassigned</option>
                          {contacts.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Due Date</label>
                        <input
                          type="date"
                          value={task.due_date || ''}
                          onChange={(e) =>
                            handleUpdateTask(task.id, { due_date: e.target.value })
                          }
                        />
                      </div>

                      <div className="field">
                        <label>Priority</label>
                        <select
                          value={task.priority || 'medium'}
                          onChange={(e) =>
                            handleUpdateTask(task.id, {
                              priority: e.target.value as Task['priority']
                            })
                          }
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Create Tasks Footer */}
          <div className="create-tasks-footer">
            <div className="footer-info">
              <CheckSquare size={16} />
              <span>{selectedCount} task(s) selected</span>
            </div>
            <div className="footer-actions">
              <button
                className="btn-cancel"
                onClick={() => setExtractedTasks([])}
              >
                Cancel
              </button>
              <button
                className="btn-create"
                onClick={handleCreateTasks}
                disabled={selectedCount === 0 || creatingTasks}
              >
                {creatingTasks ? (
                  <>
                    <RefreshCw size={16} className="spinning" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create {selectedCount} Task(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline task extraction button for message bubbles
export const InlineTaskExtractor: React.FC<{
  messageText: string;
  onExtract: () => void;
  detected?: boolean;
}> = ({ messageText, onExtract, detected }) => {
  if (!detected) return null;

  return (
    <button className="inline-task-extractor" onClick={onExtract}>
      <CheckSquare size={14} />
      <span>Extract Task</span>
    </button>
  );
};

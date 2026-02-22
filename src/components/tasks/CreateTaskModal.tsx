import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Sparkles, Calendar } from 'lucide-react';
import { Task } from '../../services/taskService';
import { User } from '../../types';
import './CreateTaskModal.css';

interface CreateTaskModalProps {
  workspaceId: string;
  currentUserId: string;
  onClose: () => void;
  onCreate: (task: Partial<Task>) => void;
  workspaceMembers?: User[];
}

const PRIORITY_OPTIONS: Array<{ value: Task['priority']; label: string; color: string }> = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'urgent', label: 'Urgent', color: '#dc2626' }
];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  workspaceId,
  currentUserId,
  onClose,
  onCreate,
  workspaceMembers = []
}) => {
  const [inputMode, setInputMode] = useState<'form' | 'natural'>('form');
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
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

  const parseNaturalLanguage = async () => {
    if (!naturalLanguageInput.trim()) {
      setError('Please enter a task description');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Simple pattern matching as fallback
      // TODO: Replace with actual Gemini AI parsing in taskIntelligenceService
      const input = naturalLanguageInput.trim();

      // Extract priority keywords
      let detectedPriority: Task['priority'] = 'medium';
      if (/\b(urgent|critical|asap)\b/i.test(input)) {
        detectedPriority = 'urgent';
      } else if (/\b(high|important)\b/i.test(input)) {
        detectedPriority = 'high';
      } else if (/\b(low|minor)\b/i.test(input)) {
        detectedPriority = 'low';
      }

      // Extract assignee mentions (@name)
      const assigneeMention = input.match(/@(\w+)/);
      let detectedAssignee = '';
      if (assigneeMention) {
        const mentionedName = assigneeMention[1].toLowerCase();
        const matchedMember = workspaceMembers.find(m =>
          m.full_name?.toLowerCase().includes(mentionedName) ||
          m.email?.toLowerCase().includes(mentionedName)
        );
        if (matchedMember) {
          detectedAssignee = matchedMember.id;
        }
      }

      // Extract deadline keywords
      let detectedDeadline = '';
      const today = new Date();

      if (/\b(today)\b/i.test(input)) {
        detectedDeadline = today.toISOString().split('T')[0];
      } else if (/\b(tomorrow)\b/i.test(input)) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        detectedDeadline = tomorrow.toISOString().split('T')[0];
      } else if (/\b(friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/i.test(input)) {
        const dayMatch = input.match(/\b(friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/i);
        if (dayMatch) {
          const targetDay = dayMatch[1].toLowerCase();
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDayIndex = days.indexOf(targetDay);
          const currentDayIndex = today.getDay();
          let daysUntilTarget = targetDayIndex - currentDayIndex;
          if (daysUntilTarget <= 0) daysUntilTarget += 7;

          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + daysUntilTarget);
          detectedDeadline = targetDate.toISOString().split('T')[0];
        }
      }

      // Clean up the title by removing keywords
      let cleanTitle = input
        .replace(/@\w+/g, '')
        .replace(/\b(urgent|critical|asap|high|important|low|minor)\b/gi, '')
        .replace(/\b(by|due|deadline)\s+(today|tomorrow|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/gi, '')
        .replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .trim();

      // Remove leading/trailing commas
      cleanTitle = cleanTitle.replace(/^,\s*|,\s*$/g, '').trim();

      // Populate form fields
      setTitle(cleanTitle);
      setPriority(detectedPriority);
      setAssigneeId(detectedAssignee);
      setDeadline(detectedDeadline);

      // Switch to form mode so user can review/edit
      setInputMode('form');

    } catch (err) {
      console.error('Error parsing natural language:', err);
      setError('Failed to parse input. Please use the form instead.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const newTask: Partial<Task> = {
      workspace_id: workspaceId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status: 'todo',
      assignee_id: assigneeId || undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      metadata: {
        created_by: currentUserId,
        created_via: inputMode === 'natural' ? 'natural_language' : 'form'
      }
    };

    onCreate(newTask);
    onClose();
  };

  const modalContent = (
    <div className="create-task-modal-overlay" onClick={onClose}>
      <div className="create-task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-task-modal-header">
          <h2 className="create-task-modal-title">Create New Task</h2>
          <button
            className="create-task-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="create-task-mode-toggle">
          <button
            className={`mode-toggle-button ${inputMode === 'form' ? 'active' : ''}`}
            onClick={() => setInputMode('form')}
          >
            Form
          </button>
          <button
            className={`mode-toggle-button ${inputMode === 'natural' ? 'active' : ''}`}
            onClick={() => setInputMode('natural')}
          >
            <Sparkles size={16} />
            Just type it
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-task-modal-form">
          {error && (
            <div className="create-task-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          {inputMode === 'natural' ? (
            <div className="natural-language-input">
              <label htmlFor="nl-input" className="create-task-label">
                Describe your task in plain English
              </label>
              <textarea
                id="nl-input"
                className="create-task-nl-textarea"
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                placeholder="e.g., Review Q1 budget by Friday, high priority, assign to Sarah"
                rows={3}
                autoFocus
              />
              <p className="nl-hint">
                Try mentioning: priority (urgent/high/low), assignee (@name), deadline (today/tomorrow/Friday)
              </p>
              <button
                type="button"
                className="nl-parse-button"
                onClick={parseNaturalLanguage}
                disabled={isProcessing || !naturalLanguageInput.trim()}
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Parse Task
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="create-task-field">
                <label htmlFor="task-title" className="create-task-label">
                  Title <span className="required">*</span>
                </label>
                <input
                  id="task-title"
                  type="text"
                  className="create-task-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title"
                  autoFocus={inputMode === 'form'}
                  required
                />
              </div>

              <div className="create-task-field">
                <label htmlFor="task-description" className="create-task-label">
                  Description
                </label>
                <textarea
                  id="task-description"
                  className="create-task-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add task description..."
                  rows={3}
                />
              </div>

              <div className="create-task-row">
                <div className="create-task-field">
                  <label htmlFor="task-priority" className="create-task-label">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    className="create-task-select"
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

                <div className="create-task-field">
                  <label htmlFor="task-assignee" className="create-task-label">
                    Assignee
                  </label>
                  <select
                    id="task-assignee"
                    className="create-task-select"
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
              </div>

              <div className="create-task-field">
                <label htmlFor="task-deadline" className="create-task-label">
                  Due Date
                </label>
                <input
                  id="task-deadline"
                  type="date"
                  className="create-task-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="create-task-modal-footer">
                <button
                  type="button"
                  className="create-task-button create-task-button-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="create-task-button create-task-button-primary"
                >
                  <Save size={16} />
                  Create Task
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

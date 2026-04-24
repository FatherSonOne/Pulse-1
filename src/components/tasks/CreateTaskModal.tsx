import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Sparkles, Calendar, Lightbulb } from 'lucide-react';
import { Task } from '../../services/taskService';
import { User } from '../../types';
import { parseNaturalLanguageTaskWithFallback } from '../../services/geminiService';
import { taskIntelligenceService } from '../../services/taskIntelligenceService';
import { fetchTasks } from '../../services/authService';
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
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 5: Smart Scheduling
  const [isSuggestingDeadline, setIsSuggestingDeadline] = useState(false);
  const [deadlineSuggestion, setDeadlineSuggestion] = useState<{
    date: string;
    reasoning: string;
  } | null>(null);

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
      // Prepare workspace members for AI
      const membersList = workspaceMembers?.map(m => ({
        name: m.full_name || m.email,
        id: m.id
      })) || [];

      // Call AI parser (router handles key server-side)
      const parsed = await parseNaturalLanguageTaskWithFallback(
        '',
        naturalLanguageInput,
        membersList
      );

      if (!parsed) {
        console.warn('AI parsing failed. Using basic parsing.');
        parseNaturalLanguageBasic(naturalLanguageInput);
        setInputMode('form');
        return;
      }

      // Update form with AI-parsed data
      setTitle(parsed.title || '');
      setDescription(parsed.description || '');
      setPriority(parsed.priority || 'medium');

      // Handle deadline
      if (parsed.deadline) {
        setDeadline(parsed.deadline);
      }

      // Handle assignee
      if (parsed.assigneeName && workspaceMembers) {
        const assignee = workspaceMembers.find(
          m => m.full_name?.toLowerCase() === parsed.assigneeName?.toLowerCase() ||
               m.email?.toLowerCase() === parsed.assigneeName?.toLowerCase()
        );
        if (assignee) {
          setAssigneeId(assignee.id);
        }
      }

      // Handle tags (store in metadata)
      if (parsed.tags && parsed.tags.length > 0) {
        setMetadata({ ...metadata, tags: parsed.tags });
      }

      // Handle estimated hours (store in metadata)
      if (parsed.estimatedHours) {
        setMetadata({ ...metadata, estimatedHours: parsed.estimatedHours });
      }

      // Handle dependencies (store in metadata for now)
      if (parsed.dependencies && parsed.dependencies.length > 0) {
        setMetadata({ ...metadata, dependencies: parsed.dependencies });
      }

      // Switch to form mode so user can review/edit
      setInputMode('form');

    } catch (err) {
      console.error('Error parsing natural language:', err);
      // Fall back to basic parsing
      parseNaturalLanguageBasic(naturalLanguageInput);
      setInputMode('form');
    } finally {
      setIsProcessing(false);
    }
  };

  // Phase 5: Smart Scheduling - Suggest optimal deadline
  const handleSuggestDeadline = async () => {
    if (!title.trim()) {
      setError('Please enter a task title first');
      return;
    }

    setIsSuggestingDeadline(true);
    setError(null);

    try {
      // Fetch current workspace tasks
      const currentTasks = await fetchTasks();
      const workspaceTasks = currentTasks.filter(t => t.workspace_id === workspaceId);

      // Call AI to suggest deadline (router handles key server-side)
      const suggestion = await taskIntelligenceService.suggestOptimalDeadline(
        '',
        title,
        description,
        priority,
        workspaceTasks
      );

      if (suggestion) {
        setDeadlineSuggestion({
          date: suggestion.suggestedDate,
          reasoning: suggestion.reasoning
        });
        setDeadline(suggestion.suggestedDate);
      } else {
        throw new Error('No suggestion returned');
      }
    } catch (error) {
      console.error('Error suggesting deadline:', error);
      setError('Unable to suggest deadline. Please select one manually.');
    } finally {
      setIsSuggestingDeadline(false);
    }
  };

  // Fallback: Basic regex-based parsing (original implementation)
  const parseNaturalLanguageBasic = (input: string) => {
    const text = input.toLowerCase();

    // Extract priority
    if (text.includes('urgent') || text.includes('asap') || text.includes('critical')) {
      setPriority('urgent');
    } else if (text.includes('high priority') || text.includes('important')) {
      setPriority('high');
    } else if (text.includes('low priority')) {
      setPriority('low');
    }

    // Extract deadline
    const today = new Date();
    if (text.includes('today')) {
      setDeadline(today.toISOString().split('T')[0]);
    } else if (text.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDeadline(tomorrow.toISOString().split('T')[0]);
    }

    // Extract assignee mentions (@name)
    const assigneeMention = input.match(/@(\w+)/);
    if (assigneeMention) {
      const mentionedName = assigneeMention[1].toLowerCase();
      const matchedMember = workspaceMembers.find(m =>
        m.full_name?.toLowerCase().includes(mentionedName) ||
        m.email?.toLowerCase().includes(mentionedName)
      );
      if (matchedMember) {
        setAssigneeId(matchedMember.id);
      }
    }

    // Use input as title (clean it up a bit)
    let cleanTitle = input
      .replace(/@\w+/g, '')
      .replace(/\b(urgent|critical|asap|high|important|low|minor)\b/gi, '')
      .replace(/\b(by|due|deadline)\s+(today|tomorrow)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    setTitle(cleanTitle);
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
        created_via: inputMode === 'natural' ? 'natural_language' : 'form',
        ...metadata
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
              {isProcessing && (
                <div className="nl-parsing-indicator">
                  <Sparkles size={16} className="spinner" />
                  Analyzing with AI...
                </div>
              )}
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
                <div className="deadline-field-header">
                  <label htmlFor="task-deadline" className="create-task-label">
                    Due Date
                  </label>
                  <button
                    type="button"
                    className="suggest-deadline-button"
                    onClick={handleSuggestDeadline}
                    disabled={isSuggestingDeadline || !title.trim()}
                    title="Let AI suggest an optimal deadline"
                  >
                    <Lightbulb size={14} />
                    {isSuggestingDeadline ? 'Analyzing...' : 'Suggest'}
                  </button>
                </div>
                <input
                  id="task-deadline"
                  type="date"
                  className="create-task-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                {deadlineSuggestion && (
                  <div className="deadline-suggestion">
                    <Lightbulb size={14} className="suggestion-icon" />
                    <div className="suggestion-content">
                      <div className="suggestion-reasoning">
                        {deadlineSuggestion.reasoning}
                      </div>
                    </div>
                  </div>
                )}
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

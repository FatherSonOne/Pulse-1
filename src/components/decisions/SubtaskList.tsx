/**
 * SubtaskList Component
 * Inline subtask checklist with progress bar for task breakdown
 */

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { CheckSquare, Square, X, Plus, Sparkles } from 'lucide-react';
import { subtaskService, Subtask } from '../../services/subtaskService';
import { AIProvenanceChip } from '../ui/AIProvenanceChip';
import './SubtaskList.css';

// Empty-state scaffold — three placeholder subtasks the user can click to
// promote. Teaches the pattern by example (Jordan persona), and removes the
// "Generate with AI is the only path forward" framing from the cold-open.
const STARTER_SCAFFOLD: string[] = [
  'Draft the requirements',
  'Get stakeholder review',
  'Schedule the kickoff',
];

interface SubtaskListProps {
  taskId: string;
  workspaceId: string;
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: string;
  currentUserId?: string;
  readonly?: boolean;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  taskId,
  workspaceId,
  taskTitle,
  taskDescription,
  taskPriority,
  currentUserId,
  readonly = false,
}) => {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGeneratedCount, setAiGeneratedCount] = useState(0);

  // Calculate progress
  const progress = React.useMemo(() => {
    if (subtasks.length === 0) return { total: 0, completed: 0, percentage: 0 };
    const total = subtasks.length;
    const completed = subtasks.filter(s => s.is_completed).length;
    const percentage = Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }, [subtasks]);

  // Load subtasks on mount
  useEffect(() => {
    loadSubtasks();
  }, [taskId]);

  const loadSubtasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await subtaskService.getSubtasks(taskId);
      setSubtasks(data);
    } catch (err) {
      console.error('Failed to load subtasks:', err);
      setError('Failed to load subtasks');
    } finally {
      setLoading(false);
    }
  };

  // Toggle completion
  const handleToggle = async (id: string) => {
    if (readonly) return;

    try {
      await subtaskService.toggleSubtask(id);
      // Optimistic update
      setSubtasks(prev => prev.map(st =>
        st.id === id ? { ...st, is_completed: !st.is_completed } : st
      ));
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
      // Reload to sync state
      loadSubtasks();
    }
  };

  // Add subtask
  const handleAdd = async () => {
    if (!newSubtaskTitle.trim() || readonly) return;

    try {
      const newSubtask = await subtaskService.createSubtask({
        task_id: taskId,
        workspace_id: workspaceId,
        title: newSubtaskTitle.trim(),
      });

      if (newSubtask) {
        setSubtasks(prev => [...prev, newSubtask]);
        setNewSubtaskTitle('');
      }
    } catch (err) {
      console.error('Failed to add subtask:', err);
      setError('Failed to add subtask');
    }
  };

  // Delete subtask
  const handleDelete = async (id: string) => {
    if (readonly) return;

    try {
      await subtaskService.deleteSubtask(id);
      setSubtasks(prev => prev.filter(st => st.id !== id));
    } catch (err) {
      console.error('Failed to delete subtask:', err);
      setError('Failed to delete subtask');
    }
  };

  // Generate AI subtasks
  const handleGenerateWithAI = async () => {
    if (!taskTitle || isGeneratingAI) return;

    setIsGeneratingAI(true);
    try {
      const generatedSubtasks = await subtaskService.generateAISubtasks(
        taskId,
        taskTitle,
        taskDescription,
        taskPriority,
        workspaceId,
        currentUserId || '',
        6  // Generate 6 subtasks
      );

      if (generatedSubtasks.length > 0) {
        setAiGeneratedCount(generatedSubtasks.length);
        // Reload subtasks to show the newly created ones
        loadSubtasks();

      } else {
        console.warn('AI subtask generation returned no results');
        toast.error('Couldn’t generate subtasks right now. Please try again.', { duration: 4500 });
      }
    } catch (error) {
      console.error('Error generating AI subtasks:', error);
      toast.error('Could not generate subtasks. Try again.', { duration: 4000 });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Handle Enter key for adding subtask
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // Click-to-promote scaffold suggestion — creates the subtask with the
  // suggested title pre-filled. No AI involved; the operator's choice.
  const handlePromoteSuggestion = async (suggestion: string) => {
    if (readonly) return;
    try {
      const newSubtask = await subtaskService.createSubtask({
        task_id: taskId,
        workspace_id: workspaceId,
        title: suggestion,
      });
      if (newSubtask) setSubtasks(prev => [...prev, newSubtask]);
    } catch (err) {
      console.error('Failed to promote scaffold subtask:', err);
      setError('Failed to add subtask');
    }
  };

  const hasAnyAIGenerated = subtasks.some(s => s.metadata?.generated_by === 'ai');

  return (
    <div className="subtask-list" role="region" aria-label="Subtask list">
      {/* Header with progress */}
      <div className="subtask-list-header">
        <h3 className="subtask-list-title">Subtasks</h3>
        <div className="subtask-list-header-right">
          {hasAnyAIGenerated && (
            <AIProvenanceChip vendor="PULSE AI" type="SUBTASKS" />
          )}
          {subtasks.length > 0 && (
            <span
              className="subtask-progress-text"
              aria-live="polite"
              aria-atomic="true"
            >
              {progress.completed}/{progress.total} ({progress.percentage}%)
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div
          className="subtask-progress-bar"
          role="progressbar"
          aria-valuenow={progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progress.completed} of ${progress.total} subtasks completed`}
        >
          <div
            className="subtask-progress-fill"
            style={{ transform: `scaleX(${(progress.percentage || 0) / 100})` }}
            role="progressbar"
            aria-valuenow={progress.percentage || 0}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="subtask-error" role="alert">
          {error}
        </div>
      )}

      {/* Subtask items */}
      {loading && subtasks.length === 0 ? (
        <div className="subtask-loading">Loading subtasks...</div>
      ) : subtasks.length > 0 ? (
        <div className="subtask-items" role="list">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className={`subtask-item ${subtask.metadata?.generated_by === 'ai' ? 'ai-generated' : ''}`}
              role="listitem"
            >
              <button
                className={`subtask-checkbox ${subtask.is_completed ? 'completed' : ''}`}
                onClick={() => handleToggle(subtask.id)}
                disabled={readonly}
                aria-label={`${subtask.is_completed ? 'Uncheck' : 'Check'} subtask: ${subtask.title}`}
                aria-pressed={subtask.is_completed}
                type="button"
              >
                {subtask.is_completed ? (
                  <CheckSquare size={18} />
                ) : (
                  <Square size={18} />
                )}
              </button>

              <span
                className={`subtask-title ${subtask.is_completed ? 'completed' : ''}`}
              >
                {subtask.title}
              </span>

              {/* AI indicator badge */}
              {subtask.metadata?.generated_by === 'ai' && (
                <span className="ai-badge" title="AI-generated subtask">
                  <Sparkles size={12} />
                </span>
              )}

              {!readonly && (
                <button
                  className="subtask-delete"
                  onClick={() => handleDelete(subtask.id)}
                  aria-label={`Delete subtask: ${subtask.title}`}
                  type="button"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : readonly ? (
        // Read-only views (e.g. the decision-side preview) don't get the
        // click-to-promote scaffold — there's nothing to click. Keep a
        // quiet line so the section doesn't disappear silently.
        <div className="subtask-empty">No subtasks.</div>
      ) : (
        // Empty-state scaffold — three muted placeholder rows. Click any row
        // to promote it into a real subtask. The pattern teaches by example
        // and removes the "Generate with AI is the only door" framing.
        <div className="subtask-empty-scaffold" role="list" aria-label="Subtask suggestions">
          <p className="subtask-empty-hint">
            A subtask is one step of this task. Click a suggestion to add it, or type your own below.
          </p>
          {STARTER_SCAFFOLD.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              role="listitem"
              className="subtask-scaffold-item"
              onClick={() => handlePromoteSuggestion(suggestion)}
              aria-label={`Add subtask: ${suggestion}`}
            >
              <Square size={18} aria-hidden />
              <span className="subtask-scaffold-title">{suggestion}</span>
              <span className="subtask-scaffold-cta">Add</span>
            </button>
          ))}
        </div>
      )}

      {/* Add new subtask input — primary path. Manual entry first; AI assist
          lives below as a secondary affordance per the critique. */}
      {!readonly && (
        <div className="subtask-add-input">
          <Plus size={18} className="subtask-add-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Add subtask..."
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="New subtask title"
          />
          <button
            onClick={handleAdd}
            disabled={!newSubtaskTitle.trim()}
            className="subtask-add-button"
            aria-label="Add subtask"
            type="button"
          >
            Add
          </button>
        </div>
      )}

      {/* AI assist — demoted from gradient pill to mono-uppercase secondary.
          No Sparkles animation, no gradient background. The provenance chip
          in the header carries the AI identity when subtasks have been
          generated. */}
      {!readonly && (
        <div className="subtask-ai-row">
          <button
            type="button"
            className="subtask-ai-chip"
            onClick={handleGenerateWithAI}
            disabled={isGeneratingAI || !taskTitle}
            title="Suggest a breakdown using Pulse AI"
          >
            {isGeneratingAI ? 'Generating…' : '+ AI Breakdown'}
          </button>
          {aiGeneratedCount > 0 && (
            <span className="subtask-ai-count">
              {aiGeneratedCount} added by AI
            </span>
          )}
        </div>
      )}
    </div>
  );
};

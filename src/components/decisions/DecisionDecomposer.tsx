import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, CheckSquare, AlertCircle, Zap, Calendar, User } from 'lucide-react';
import { DecisionWithVotes } from '../../services/decisionService';
import { Task } from '../../services/taskService';
import { User as PulseUser } from '../../types';
import './DecisionDecomposer.css';

interface DecisionDecomposerProps {
  decision: DecisionWithVotes;
  workspaceId: string;
  workspaceMembers?: PulseUser[];
  onClose: () => void;
  onTasksGenerated: (tasks: Partial<Task>[], brief: string) => Promise<void>;
  apiKey: string;
}

interface GeneratedTask {
  title: string;
  description?: string;
  priority: Task['priority'];
  deadline_offset_days?: number; // Days from now
  assignee_suggestion?: string; // Name or role, not ID
  rationale?: string; // Why this task is needed
}

interface DecompositionResult {
  brief: string; // 2-3 sentence decision summary
  tasks: GeneratedTask[];
  confidence: number; // 0.0 to 1.0
  reasoning: string; // Why these tasks were recommended
}

export const DecisionDecomposer: React.FC<DecisionDecomposerProps> = ({
  decision,
  workspaceId,
  workspaceMembers = [],
  onClose,
  onTasksGenerated,
  apiKey
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DecompositionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  // Generate tasks using Gemini AI
  const handleGenerate = useCallback(async () => {
    if (!apiKey) {
      setError('Gemini API key not configured. Please add it in Settings.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Build context about the decision
      const context = {
        title: decision.title,
        description: decision.description,
        type: decision.decision_type,
        status: decision.status,
        votes: decision.votes?.length || 0,
        options: decision.options || [],
        workspace_members: workspaceMembers.map(m => ({
          name: m.full_name,
          role: m.role,
          email: m.email
        }))
      };

      // Call Gemini API for task decomposition
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an expert project manager analyzing a business decision and breaking it down into actionable tasks.

DECISION CONTEXT:
Title: ${context.title}
Description: ${context.description || 'No description provided'}
Type: ${context.type}
Status: ${context.status}
Current Votes: ${context.votes}
Options: ${JSON.stringify(context.options)}

WORKSPACE TEAM:
${context.workspace_members.map(m => `- ${m.name} (${m.role}): ${m.email}`).join('\n')}

TASK:
1. Generate a brief 2-3 sentence summary of this decision
2. Break this decision into 3-7 actionable, concrete tasks
3. For each task:
   - Write a clear, specific title (action verb + object)
   - Add a description explaining what needs to be done and why
   - Assign a priority (low, medium, high, urgent)
   - Suggest a realistic deadline (as days from today)
   - Optionally suggest who should do it (name or role)
   - Explain the rationale for this task

4. Provide your overall confidence (0.0-1.0) in this decomposition
5. Explain your reasoning for these specific tasks

REQUIREMENTS:
- Tasks should be actionable, not vague
- Tasks should have clear completion criteria
- Prioritize based on urgency and dependencies
- Consider the decision type and status
- Tasks should move the decision toward resolution
- If status is 'approved', focus on implementation tasks
- If status is 'voting', focus on research/analysis tasks
- If status is 'draft', focus on preparation/refinement tasks

Respond ONLY with valid JSON in this exact format:
{
  "brief": "2-3 sentence summary",
  "tasks": [
    {
      "title": "Action verb + specific object",
      "description": "What and why",
      "priority": "low|medium|high|urgent",
      "deadline_offset_days": 7,
      "assignee_suggestion": "Name or role",
      "rationale": "Why this task matters"
    }
  ],
  "confidence": 0.85,
  "reasoning": "Why these tasks were chosen"
}`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate tasks');
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        throw new Error('No content in Gemini response');
      }

      // Parse the JSON response
      const decomposition: DecompositionResult = JSON.parse(textContent);

      // Validate the result
      if (!decomposition.brief || !decomposition.tasks || decomposition.tasks.length === 0) {
        throw new Error('Invalid decomposition result from AI');
      }

      setResult(decomposition);

      // Select all tasks by default
      setSelectedTasks(new Set(decomposition.tasks.map((_, i) => i)));

    } catch (err) {
      console.error('Error generating tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate tasks');
    } finally {
      setIsGenerating(false);
    }
  }, [apiKey, decision, workspaceMembers]);

  // Toggle task selection
  const toggleTask = useCallback((index: number) => {
    setSelectedTasks(prev => {
      const updated = new Set(prev);
      if (updated.has(index)) {
        updated.delete(index);
      } else {
        updated.add(index);
      }
      return updated;
    });
  }, []);

  // Create the selected tasks
  const handleCreateTasks = useCallback(async () => {
    if (!result) return;

    const tasksToCreate: Partial<Task>[] = result.tasks
      .filter((_, index) => selectedTasks.has(index))
      .map(task => {
        // Calculate deadline from offset
        let deadline: string | undefined;
        if (task.deadline_offset_days) {
          const deadlineDate = new Date();
          deadlineDate.setDate(deadlineDate.getDate() + task.deadline_offset_days);
          deadline = deadlineDate.toISOString();
        }

        // Try to match assignee suggestion to actual workspace member
        let assignee_id: string | undefined;
        if (task.assignee_suggestion) {
          const matchedMember = workspaceMembers.find(m =>
            m.full_name?.toLowerCase().includes(task.assignee_suggestion!.toLowerCase()) ||
            m.role?.toLowerCase().includes(task.assignee_suggestion!.toLowerCase())
          );
          assignee_id = matchedMember?.id;
        }

        return {
          workspace_id: workspaceId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: 'todo' as const,
          deadline,
          assignee_id,
          metadata: {
            generated_from_decision: decision.id,
            ai_rationale: task.rationale,
            ai_confidence: result.confidence
          }
        };
      });

    await onTasksGenerated(tasksToCreate, result.brief);
    onClose();
  }, [result, selectedTasks, workspaceMembers, workspaceId, decision.id, onTasksGenerated, onClose]);

  const modalContent = (
    <div className="decision-decomposer-overlay" onClick={onClose}>
      <div className="decision-decomposer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="decision-decomposer-header">
          <div className="header-left">
            <Sparkles size={24} className="header-icon" />
            <div>
              <h2 className="decision-decomposer-title">Break Down Decision into Tasks</h2>
              <p className="decision-decomposer-subtitle">{decision.title}</p>
            </div>
          </div>
          <button
            className="decision-decomposer-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="decision-decomposer-content">
          {error && (
            <div className="decomposer-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <div className="decomposer-generate-state">
              <div className="generate-icon">
                <Zap size={48} />
              </div>
              <h3>AI-Powered Task Generation</h3>
              <p>
                Gemini AI will analyze this decision and generate actionable tasks with:
              </p>
              <ul className="generate-features">
                <li><CheckSquare size={16} /> Clear, specific task titles and descriptions</li>
                <li><AlertCircle size={16} /> Smart priority assignment</li>
                <li><Calendar size={16} /> Realistic deadline suggestions</li>
                <li><User size={16} /> Team member recommendations</li>
              </ul>
              <button
                className="generate-button"
                onClick={handleGenerate}
                disabled={isGenerating || !apiKey}
              >
                {isGenerating ? (
                  <>
                    <Sparkles size={18} className="spinning" />
                    Generating Tasks...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate Tasks with AI
                  </>
                )}
              </button>
              {!apiKey && (
                <p className="api-key-warning">
                  <AlertCircle size={14} />
                  Gemini API key required. Add it in Settings.
                </p>
              )}
            </div>
          ) : (
            <div className="decomposer-results">
              {/* Decision Brief */}
              <div className="result-section brief-section">
                <h3 className="section-title">Decision Summary</h3>
                <p className="decision-brief">{result.brief}</p>
                <div className="brief-meta">
                  <span className="confidence-badge">
                    Confidence: {(result.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* AI Reasoning */}
              <div className="result-section reasoning-section">
                <h3 className="section-title">AI Reasoning</h3>
                <p className="ai-reasoning">{result.reasoning}</p>
              </div>

              {/* Generated Tasks */}
              <div className="result-section tasks-section">
                <h3 className="section-title">
                  Suggested Tasks ({selectedTasks.size} of {result.tasks.length} selected)
                </h3>
                <div className="tasks-list">
                  {result.tasks.map((task, index) => (
                    <div
                      key={index}
                      className={`generated-task-card ${selectedTasks.has(index) ? 'selected' : ''}`}
                      onClick={() => toggleTask(index)}
                    >
                      <div className="task-card-header">
                        <input
                          type="checkbox"
                          checked={selectedTasks.has(index)}
                          onChange={() => toggleTask(index)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select task: ${task.title}`}
                        />
                        <h4 className="task-title">{task.title}</h4>
                        <span className={`priority-badge priority-${task.priority}`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="task-description">{task.description}</p>
                      <div className="task-metadata">
                        {task.deadline_offset_days && (
                          <span className="task-meta-item">
                            <Calendar size={14} />
                            Due in {task.deadline_offset_days} days
                          </span>
                        )}
                        {task.assignee_suggestion && (
                          <span className="task-meta-item">
                            <User size={14} />
                            Suggested: {task.assignee_suggestion}
                          </span>
                        )}
                      </div>
                      {task.rationale && (
                        <p className="task-rationale">
                          <em>Why: {task.rationale}</em>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="decomposer-actions">
                <button
                  className="action-button secondary"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <Sparkles size={16} />
                  Regenerate
                </button>
                <button
                  className="action-button primary"
                  onClick={handleCreateTasks}
                  disabled={selectedTasks.size === 0}
                >
                  <CheckSquare size={16} />
                  Create {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// Step 3: Task shaping.
//
// AI-suggested tasks (or fallback) come in as initial state. Operator can
// edit each task inline (title, priority, deadline offset, assignee), drag
// to reorder, delete, or add a new task.
//
// The deadline cascade is computed elsewhere (Step 4 sets the decide-by
// date; Step 3 only stores deadline offsets). The actual ISO deadlines are
// resolved on submit.

import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, Sparkles, Check } from 'lucide-react';
import { TextField } from './primitives/TextField';
import { TextareaField } from './primitives/TextareaField';
import { SelectField } from './primitives/SelectField';
import { MemberPicker } from './primitives/MemberPicker';
import type { SuggestedTask } from './types';
import type { User } from '../../../types';

interface Step3TaskShapingProps {
  tasks: SuggestedTask[];
  onChange: (next: SuggestedTask[]) => void;
  workspaceMembers: User[];
  /** Triggered when the operator clicks "Regenerate with AI". */
  onRegenerate: () => Promise<void>;
  isRegenerating: boolean;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

function generateLocalId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const Step3TaskShaping: React.FC<Step3TaskShapingProps> = ({
  tasks,
  onChange,
  workspaceMembers,
  onRegenerate,
  isRegenerating,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateTask = (id: string, patch: Partial<SuggestedTask>) => {
    onChange(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTask = (id: string) => {
    onChange(tasks.filter((t) => t.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const addTask = () => {
    const newTask: SuggestedTask = {
      id: generateLocalId(),
      title: '',
      priority: 'medium',
      deadlineOffsetDays: tasks.length > 0
        ? Math.max(...tasks.map((t) => t.deadlineOffsetDays)) + 2
        : 7,
    };
    onChange([...tasks, newTask]);
    setExpandedId(newTask.id);
  };

  const setDecisionMoment = (id: string) => {
    onChange(
      tasks.map((t) => ({
        ...t,
        isDecisionMoment: t.id === id ? true : false,
      }))
    );
  };

  return (
    <div className="dw-step3">
      <header className="dw-step3-header">
        <div>
          <h3 className="dw-step3-title">Shape the work</h3>
          <p className="dw-step3-sub">
            Edit, reorder, or remove. Mark which task produces the decision.
          </p>
        </div>
        <button
          type="button"
          className="dw-step3-regenerate"
          onClick={onRegenerate}
          disabled={isRegenerating}
          title="Pulse AI generates a fresh task plan"
        >
          <Sparkles size={12} aria-hidden="true" />
          {isRegenerating ? 'Thinking' : 'Pulse AI · Regenerate'}
        </button>
      </header>

      {tasks.length === 0 && (
        <div className="dw-step3-empty">
          <p>No tasks yet. Add one to get started.</p>
        </div>
      )}

      <ul className="dw-step3-list">
        {tasks.map((task, idx) => {
          const isExpanded = expandedId === task.id;
          return (
            <li
              key={task.id}
              className={`dw-step3-task${isExpanded ? ' is-expanded' : ''}${task.isDecisionMoment ? ' is-decision' : ''}`}
            >
              <div className="dw-step3-task-row">
                <button
                  type="button"
                  className="dw-step3-task-grip"
                  aria-label={`Reorder ${task.title || 'task ' + (idx + 1)}`}
                  title="Reorder (drag and drop)"
                  // Drag handle wired in a future iteration; visual only for now.
                >
                  <GripVertical size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="dw-step3-task-toggle"
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="dw-step3-task-title">
                    {task.title || <span className="dw-step3-task-placeholder">Untitled task</span>}
                  </span>
                  <span className="dw-step3-task-meta">
                    <span className="dt-label">{task.priority}</span>
                    <span className="dw-step3-task-due dt-label">
                      D+{task.deadlineOffsetDays}
                    </span>
                    {task.isDecisionMoment && (
                      <span className="dw-step3-task-decision-pill dt-label">
                        Decision
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="dw-step3-task-decision"
                  onClick={() => setDecisionMoment(task.id)}
                  aria-pressed={task.isDecisionMoment}
                  title="Mark as the decision moment"
                >
                  <Check size={12} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="dw-step3-task-delete"
                  onClick={() => removeTask(task.id)}
                  aria-label={`Delete ${task.title || 'task'}`}
                  title="Delete"
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
              {isExpanded && (
                <div className="dw-step3-task-detail">
                  <TextField
                    label="Title"
                    value={task.title}
                    onChange={(v) => updateTask(task.id, { title: v })}
                    placeholder="What needs to happen"
                    required
                  />
                  <TextareaField
                    label="Description"
                    value={task.description ?? ''}
                    onChange={(v) => updateTask(task.id, { description: v })}
                    placeholder="Optional context"
                    rows={2}
                  />
                  <div className="dw-step3-task-row-2col">
                    <SelectField
                      label="Priority"
                      value={task.priority}
                      onChange={(v) => updateTask(task.id, { priority: v as SuggestedTask['priority'] })}
                      options={[...PRIORITY_OPTIONS]}
                    />
                    <TextField
                      label="Deadline (days from start)"
                      value={String(task.deadlineOffsetDays)}
                      onChange={(v) => {
                        const n = parseInt(v, 10);
                        if (!Number.isNaN(n) && n >= 0) {
                          updateTask(task.id, { deadlineOffsetDays: n });
                        }
                      }}
                      hint="Resolved against the start date in Step 4."
                    />
                  </div>
                  <MemberPicker
                    label="Assignee"
                    value={task.assigneeId ? [task.assigneeId] : []}
                    onChange={(v) => updateTask(task.id, { assigneeId: v[0] })}
                    members={workspaceMembers}
                    multiSelect={false}
                    placeholder="Unassigned"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" className="dw-step3-add" onClick={addTask}>
        <Plus size={14} aria-hidden="true" strokeWidth={2.5} />
        Add task
      </button>
    </div>
  );
};

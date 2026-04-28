// DependencySection: lists upstream (blocked-by) and downstream (blocking)
// tasks for a given task. Renders inside the per-item ActivityDrawer.
//
// Phase 5 of the Decisions and Tasks overhaul.

import React, { useEffect, useState } from 'react';
import { Loader2, Lock, ArrowDownToLine, CircleSlash } from 'lucide-react';
import { dependenciesService, type DependencySummary } from '../../../services/dependenciesService';
import type { Task } from '../../../services/taskService';
import './Dependencies.css';

interface DependencySectionProps {
  taskId: string;
  /** When the operator clicks a related task, open it in the same drawer. */
  onOpenTask?: (taskId: string, taskTitle: string) => void;
}

export const DependencySection: React.FC<DependencySectionProps> = ({ taskId, onOpenTask }) => {
  const [summary, setSummary] = useState<DependencySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dependenciesService.getDependencies(taskId).then((data) => {
      if (!cancelled) {
        setSummary(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (loading) {
    return (
      <div className="dp-section">
        <div className="dp-loading">
          <Loader2 size={14} className="dp-spinner" aria-hidden="true" />
          <span>Loading dependencies</span>
        </div>
      </div>
    );
  }

  if (!summary || (summary.blockedBy.length === 0 && summary.blocking.length === 0)) {
    return null;
  }

  return (
    <section className="dp-section" aria-label="Dependencies">
      {summary.blockedBy.length > 0 && (
        <div className="dp-group">
          <h4 className="dp-group-title">
            <Lock size={12} aria-hidden="true" />
            <span className="dt-label">Blocked by</span>
          </h4>
          <ul className="dp-list">
            {summary.blockedBy.map((t) => (
              <DependencyRow key={t.id} task={t} onClick={onOpenTask} />
            ))}
          </ul>
        </div>
      )}
      {summary.blocking.length > 0 && (
        <div className="dp-group">
          <h4 className="dp-group-title">
            <ArrowDownToLine size={12} aria-hidden="true" />
            <span className="dt-label">Blocking</span>
          </h4>
          <ul className="dp-list">
            {summary.blocking.map((t) => (
              <DependencyRow key={t.id} task={t} onClick={onOpenTask} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

interface DependencyRowProps {
  task: Task;
  onClick?: (taskId: string, taskTitle: string) => void;
}

function statusColor(status: string): string {
  switch (status) {
    case 'done': return 'var(--dt-status-done)';
    case 'in_progress': return 'var(--dt-status-in-progress)';
    case 'in_review': return 'var(--dt-status-in-review)';
    case 'blocked': return 'var(--dt-status-blocked)';
    case 'cancelled': return 'var(--dt-status-cancelled)';
    default: return 'var(--dt-status-todo)';
  }
}

const DependencyRow: React.FC<DependencyRowProps> = ({ task, onClick }) => {
  const isCancelled = task.status === 'cancelled';
  return (
    <li className="dp-row">
      {onClick ? (
        <button
          type="button"
          className="dp-row-button"
          onClick={() => onClick(task.id, task.title)}
        >
          <span
            className="dp-row-dot"
            style={{ background: statusColor(task.status) }}
            aria-hidden="true"
          />
          <span className={`dp-row-title${isCancelled ? ' is-cancelled' : ''}`}>{task.title}</span>
          {isCancelled && <CircleSlash size={12} className="dp-row-cancelled-icon" aria-hidden="true" />}
          <span className="dp-row-status dt-label">{task.status.replace('_', ' ')}</span>
        </button>
      ) : (
        <div className="dp-row-button">
          <span
            className="dp-row-dot"
            style={{ background: statusColor(task.status) }}
            aria-hidden="true"
          />
          <span className={`dp-row-title${isCancelled ? ' is-cancelled' : ''}`}>{task.title}</span>
          <span className="dp-row-status dt-label">{task.status.replace('_', ' ')}</span>
        </div>
      )}
    </li>
  );
};

import React, { useState, useEffect } from 'react';
import { DecisionCard } from './DecisionCard';
import { TaskList, TaskStatus } from './TaskList';
import { decisionService, DecisionWithVotes } from '../services/decisionService';
import { taskService, Task } from '../services/taskService';
import { User } from '../types';
import { CheckSquare, Vote, Plus, Filter, RefreshCw } from 'lucide-react';
import './DecisionTaskPanel.css';

interface DecisionTaskPanelProps {
  user: User | null;
  workspaceId?: string;
}

export const DecisionTaskPanel: React.FC<DecisionTaskPanelProps> = ({
  user,
  workspaceId
}) => {
  const [activeTab, setActiveTab] = useState<'decisions' | 'tasks'>('decisions');
  const [decisions, setDecisions] = useState<DecisionWithVotes[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(undefined);
  const [decisionStatusFilter, setDecisionStatusFilter] = useState<string | undefined>(undefined);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  // Use user.id as workspace_id if not provided
  const effectiveWorkspaceId = workspaceId || user?.id || '';

  useEffect(() => {
    if (effectiveWorkspaceId) {
      loadDecisions();
    }
  }, [effectiveWorkspaceId, decisionStatusFilter]);

  const loadDecisions = async () => {
    setDecisionsLoading(true);
    try {
      const allDecisions = await decisionService.getWorkspaceDecisions(effectiveWorkspaceId);

      // Filter by status if set
      const filtered = decisionStatusFilter
        ? allDecisions.filter(d => d.status === decisionStatusFilter)
        : allDecisions;

      setDecisions(filtered);
    } catch (error) {
      console.error('Failed to load decisions:', error);
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  };

  const handleVote = () => {
    // Reload decisions to show updated vote counts
    loadDecisions();
  };

  const handleRefresh = () => {
    if (activeTab === 'decisions') {
      loadDecisions();
    } else {
      // Force TaskList reload by updating key
      setTasksLoading(true);
      setTimeout(() => setTasksLoading(false), 100);
    }
  };

  return (
    <div className="decision-task-panel">
      <div className="panel-header">
        <h1 className="panel-title">Decisions & Tasks</h1>
        <p className="panel-subtitle">
          Manage team decisions and track action items
        </p>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-button ${activeTab === 'decisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('decisions')}
        >
          <Vote size={18} />
          <span>Decisions</span>
          {decisions.filter(d => d.status === 'voting').length > 0 && (
            <span className="tab-badge">
              {decisions.filter(d => d.status === 'voting').length}
            </span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <CheckSquare size={18} />
          <span>Tasks</span>
        </button>
      </div>

      <div className="panel-toolbar">
        <div className="toolbar-filters">
          {activeTab === 'decisions' ? (
            <>
              <select
                className="filter-select"
                value={decisionStatusFilter || ''}
                onChange={(e) => setDecisionStatusFilter(e.target.value || undefined)}
              >
                <option value="">All Decisions</option>
                <option value="proposed">Proposed</option>
                <option value="voting">Voting</option>
                <option value="decided">Decided</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </>
          ) : (
            <>
              <select
                className="filter-select"
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus || undefined)}
              >
                <option value="">All Tasks</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={showOverdueOnly}
                  onChange={(e) => setShowOverdueOnly(e.target.checked)}
                />
                <span>Overdue only</span>
              </label>
            </>
          )}
        </div>

        <div className="toolbar-actions">
          <button
            className="action-button refresh-button"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="panel-content">
        {activeTab === 'decisions' && (
          <div className="decisions-container">
            {decisionsLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading decisions...</p>
              </div>
            ) : decisions.length === 0 ? (
              <div className="empty-state">
                <Vote size={64} color="#ccc" />
                <h3>No decisions found</h3>
                <p>
                  {decisionStatusFilter
                    ? `No ${decisionStatusFilter} decisions in this workspace`
                    : 'Start by creating a decision to get team input'}
                </p>
              </div>
            ) : (
              <div className="decisions-grid">
                {decisions.map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                    currentUserId={user?.id || ''}
                    onVote={handleVote}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tasks-container">
            {!tasksLoading && effectiveWorkspaceId ? (
              <TaskList
                workspaceId={effectiveWorkspaceId}
                userId={user?.id}
                statusFilter={statusFilter}
                showOverdueOnly={showOverdueOnly}
              />
            ) : (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading tasks...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

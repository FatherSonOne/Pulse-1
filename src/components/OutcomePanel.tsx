import React, { useState, useEffect } from 'react';
import {
  outcomeService,
  WorkspaceOutcome,
  OutcomeBlocker,
  OutcomeMilestone
} from '../services/outcomeService';
import { 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Plus,
  X
} from 'lucide-react';
import './OutcomePanel.css';

interface OutcomePanelProps {
  workspaceId: string;
  currentUserId: string;
}

export const OutcomePanel: React.FC<OutcomePanelProps> = ({
  workspaceId,
  currentUserId
}) => {
  const [outcome, setOutcome] = useState<WorkspaceOutcome | null>(null);
  const [blockers, setBlockers] = useState<OutcomeBlocker[]>([]);
  const [milestones, setMilestones] = useState<OutcomeMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [newBlocker, setNewBlocker] = useState('');
  const [newMilestone, setNewMilestone] = useState('');

  useEffect(() => {
    loadOutcome();
  }, [workspaceId]);

  useEffect(() => {
    if (outcome) {
      loadBlockers();
      loadMilestones();

      // Subscribe to updates
      const unsubscribe = outcomeService.subscribeToOutcomeUpdates(
        workspaceId,
        setOutcome
      );
      return unsubscribe;
    }
  }, [outcome?.id]);

  const loadOutcome = async () => {
    setLoading(true);
    const data = await outcomeService.getWorkspaceOutcome(workspaceId);
    setOutcome(data);
    setLoading(false);
  };

  const loadBlockers = async () => {
    if (!outcome) return;
    const data = await outcomeService.getBlockers(outcome.id);
    setBlockers(data.filter(b => b.status === 'active'));
  };

  const loadMilestones = async () => {
    if (!outcome) return;
    const data = await outcomeService.getMilestones(outcome.id);
    setMilestones(data);
  };

  const handleCreateOutcome = async () => {
    if (!newGoal.trim()) return;
    
    const created = await outcomeService.setWorkspaceOutcome(
      workspaceId,
      newGoal.trim()
    );
    
    if (created) {
      setOutcome(created);
      setNewGoal('');
      setShowCreateForm(false);
    }
  };

  const handleAddBlocker = async () => {
    if (!outcome || !newBlocker.trim()) return;
    
    await outcomeService.addBlocker(
      outcome.id,
      newBlocker.trim(),
      'medium',
      currentUserId
    );
    
    setNewBlocker('');
    loadBlockers();
  };

  const handleResolveBlocker = async (blockerId: string) => {
    await outcomeService.resolveBlocker(blockerId);
    loadBlockers();
  };

  const handleAddMilestone = async () => {
    if (!outcome || !newMilestone.trim()) return;
    
    await outcomeService.addMilestone(outcome.id, newMilestone.trim());
    setNewMilestone('');
    loadMilestones();
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    await outcomeService.toggleMilestone(milestoneId);
    loadMilestones();
    loadOutcome(); // Refresh to update progress
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track': return '#4ade80';
      case 'at_risk': return '#fbbf24';
      case 'blocked': return '#f87171';
      case 'completed': return '#10b981';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'on_track': return 'On Track';
      case 'at_risk': return 'At Risk';
      case 'blocked': return 'Blocked';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="outcome-panel">
        <div className="panel-loading">Loading outcome...</div>
      </div>
    );
  }

  if (!outcome) {
    return (
      <div className="outcome-panel">
        <div className="empty-outcome">
          {showCreateForm ? (
            <div className="create-outcome-form">
              <h3>Define Workspace Outcome</h3>
              <p>What are you trying to achieve in this workspace?</p>
              <input
                type="text"
                placeholder="e.g., Ship v1 of product"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateOutcome()}
                autoFocus
              />
              <div className="form-actions">
                <button onClick={handleCreateOutcome} disabled={!newGoal.trim()}>
                  Create Outcome
                </button>
                <button 
                  className="cancel"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewGoal('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <Target size={48} opacity={0.3} />
              <h3>No Outcome Set</h3>
              <p>Define what you're trying to achieve in this workspace</p>
              <button onClick={() => setShowCreateForm(true)}>
                <Plus size={16} />
                Set Outcome
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const completedMilestones = milestones.filter(m => m.completed).length;

  return (
    <div className="outcome-panel">
      <div className="outcome-header">
        <div className="outcome-goal">
          <Target size={20} />
          <h3>{outcome.goal}</h3>
        </div>
        <span 
          className="outcome-status"
          style={{ backgroundColor: getStatusColor(outcome.status) }}
        >
          {getStatusLabel(outcome.status)}
        </span>
      </div>

      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-label">
            <TrendingUp size={16} />
            Progress
          </span>
          <span className="progress-value">{outcome.progress}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ 
              width: `${outcome.progress}%`,
              backgroundColor: getStatusColor(outcome.status)
            }}
          />
        </div>
        <div className="milestone-summary">
          {completedMilestones} / {milestones.length} milestones completed
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="blockers-section">
          <h4>
            <AlertTriangle size={16} />
            Active Blockers ({blockers.length})
          </h4>
          {blockers.map(blocker => (
            <div key={blocker.id} className="blocker-item">
              <span className="blocker-text">{blocker.description}</span>
              <button
                className="resolve-btn"
                onClick={() => handleResolveBlocker(blocker.id)}
                title="Resolve"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="add-blocker">
        <input
          type="text"
          placeholder="Add a blocker..."
          value={newBlocker}
          onChange={(e) => setNewBlocker(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddBlocker()}
        />
        <button onClick={handleAddBlocker} disabled={!newBlocker.trim()}>
          <Plus size={16} />
        </button>
      </div>

      <div className="milestones-section">
        <h4>
          <CheckCircle2 size={16} />
          Milestones
        </h4>
        {milestones.map(milestone => (
          <div 
            key={milestone.id} 
            className={`milestone-item ${milestone.completed ? 'completed' : ''}`}
            onClick={() => handleToggleMilestone(milestone.id)}
          >
            <input
              type="checkbox"
              checked={milestone.completed}
              onChange={() => {}}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="milestone-text">{milestone.title}</span>
          </div>
        ))}
      </div>

      <div className="add-milestone">
        <input
          type="text"
          placeholder="Add a milestone..."
          value={newMilestone}
          onChange={(e) => setNewMilestone(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddMilestone()}
        />
        <button onClick={handleAddMilestone} disabled={!newMilestone.trim()}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

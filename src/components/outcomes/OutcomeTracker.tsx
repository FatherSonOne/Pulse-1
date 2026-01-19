import { useState, useEffect } from 'react';
import { 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Calendar,
  Plus,
  Activity
} from 'lucide-react';
import { outcomeService, OutcomeBlocker, WorkspaceOutcome } from '../../services/outcomeService';
import './OutcomeTracker.css';

interface OutcomeTrackerProps {
  workspaceId: string;
  currentUserId: string;
}

export const OutcomeTracker: React.FC<OutcomeTrackerProps> = ({
  workspaceId,
  currentUserId
}) => {
  const [outcome, setOutcome] = useState<WorkspaceOutcome | null>(null);
  const [blockers, setBlockers] = useState<OutcomeBlocker[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [newOutcome, setNewOutcome] = useState({
    title: '',
    description: '',
    target_date: ''
  });
  const [newBlocker, setNewBlocker] = useState({
    title: '',
    description: '',
    severity: 'medium' as OutcomeBlocker['severity']
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOutcome();
    loadBlockers();
    loadHealth();
  }, [workspaceId]);

  const loadOutcome = async () => {
    const data = await outcomeService.getWorkspaceOutcome(workspaceId);
    setOutcome(data);
    if (!data?.goal) {
      setShowSetupForm(true);
    }
  };

  const loadBlockers = async () => {
    const data = await outcomeService.getWorkspaceBlockers(workspaceId);
    setBlockers(data);
  };

  const loadHealth = async () => {
    const data = await outcomeService.getOutcomeHealth(workspaceId);
    setHealth(data);
  };

  const handleSetupOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutcome.title.trim()) return;

    setLoading(true);
    await outcomeService.setWorkspaceOutcome({
      workspace_id: workspaceId,
      outcome_title: newOutcome.title,
      outcome_description: newOutcome.description,
      outcome_target_date: newOutcome.target_date || undefined
    });

    setNewOutcome({ title: '', description: '', target_date: '' });
    setShowSetupForm(false);
    setLoading(false);
    loadOutcome();
    loadHealth();
  };

  const handleCreateBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlocker.title.trim()) return;

    setLoading(true);
    await outcomeService.createBlocker({
      workspace_id: workspaceId,
      title: newBlocker.title,
      description: newBlocker.description,
      severity: newBlocker.severity,
      reported_by: currentUserId
    });

    setNewBlocker({ title: '', description: '', severity: 'medium' });
    setShowBlockerForm(false);
    setLoading(false);
    loadBlockers();
    loadHealth();
  };

  const handleResolveBlocker = async (blockerId: string) => {
    const notes = prompt('Resolution notes (optional):');
    await outcomeService.resolveBlocker(blockerId, notes || undefined);
    loadBlockers();
    loadHealth();
  };

  const handleProgressUpdate = async (newProgress: number) => {
    await outcomeService.updateOutcomeProgress(workspaceId, newProgress);
    loadOutcome();
    loadHealth();
  };

  const getSeverityColor = (severity: OutcomeBlocker['severity']) => {
    const colors = {
      low: '#94a3b8',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#dc2626'
    };
    return colors[severity];
  };

  const getStatusIcon = (status: WorkspaceOutcome['status']) => {
    switch (status) {
      case 'on_track':
        return <Activity className="status-icon in-progress" />;
      case 'at_risk':
        return <AlertTriangle className="status-icon at-risk" />;
      case 'blocked':
        return <AlertTriangle className="status-icon blocked" />;
      case 'completed':
        return <CheckCircle className="status-icon achieved" />;
      default:
        return <Target className="status-icon not-started" />;
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  if (!outcome) {
    return <div className="outcome-tracker">Loading...</div>;
  }

  return (
    <div className="outcome-tracker">
      <div className="outcome-header">
        <h2>🎯 Outcome Tracker</h2>
      </div>

      {!outcome.goal || showSetupForm ? (
        <form className="outcome-setup-form" onSubmit={handleSetupOutcome}>
          <h3>Set Workspace Outcome</h3>
          <input
            type="text"
            placeholder="What do we want to achieve?"
            value={newOutcome.title}
            onChange={(e) => setNewOutcome({ ...newOutcome, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Describe the desired outcome..."
            value={newOutcome.description}
            onChange={(e) => setNewOutcome({ ...newOutcome, description: e.target.value })}
            rows={3}
          />
          <input
            type="date"
            value={newOutcome.target_date}
            onChange={(e) => setNewOutcome({ ...newOutcome, target_date: e.target.value })}
            placeholder="Target date"
          />
          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Setting...' : 'Set Outcome'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="outcome-overview">
            <div className="outcome-title-section">
              {getStatusIcon(outcome.status)}
              <div>
                <h3>{outcome.goal}</h3>
                {outcome.description && (
                  <p>{outcome.description}</p>
                )}
              </div>
            </div>

            {health && (
              <div className="health-card" style={{ borderColor: getHealthColor(health.healthScore) }}>
                <div className="health-score" style={{ color: getHealthColor(health.healthScore) }}>
                  {health.healthScore}
                  <span className="health-label">Health</span>
                </div>
                <div className="health-status">
                  {health.isOnTrack ? '✓ On Track' : '⚠️ Needs Attention'}
                </div>
              </div>
            )}
          </div>

          <div className="progress-section">
            <div className="progress-header">
              <span>Progress: {outcome.progress}%</span>
              <div className="progress-controls">
                <button
                  onClick={() => handleProgressUpdate(Math.max(0, outcome.progress - 10))}
                  disabled={outcome.progress === 0}
                >
                  -10%
                </button>
                <button
                  onClick={() => handleProgressUpdate(Math.min(100, outcome.progress + 10))}
                  disabled={outcome.progress === 100}
                >
                  +10%
                </button>
              </div>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${outcome.progress}%`,
                  backgroundColor: getHealthColor(outcome.progress)
                }}
              />
            </div>
          </div>

          {outcome.target_date && health && (
            <div className="timeline-info">
              <Calendar size={16} />
              Target: {new Date(outcome.target_date).toLocaleDateString()}
              {health.daysRemaining !== null && (
                <span className={health.daysRemaining < 7 ? 'urgent' : ''}>
                  ({health.daysRemaining} days remaining)
                </span>
              )}
            </div>
          )}

          <div className="blockers-section">
            <div className="section-header">
              <h3>🚧 Blockers</h3>
              <button 
                className="btn-small"
                onClick={() => setShowBlockerForm(!showBlockerForm)}
              >
                <Plus size={16} /> Report Blocker
              </button>
            </div>

            {showBlockerForm && (
              <form className="blocker-form" onSubmit={handleCreateBlocker}>
                <input
                  type="text"
                  placeholder="What's blocking progress?"
                  value={newBlocker.title}
                  onChange={(e) => setNewBlocker({ ...newBlocker, title: e.target.value })}
                  required
                />
                <textarea
                  placeholder="Details..."
                  value={newBlocker.description}
                  onChange={(e) => setNewBlocker({ ...newBlocker, description: e.target.value })}
                  rows={2}
                />
                <select
                  value={newBlocker.severity}
                  onChange={(e) => setNewBlocker({ 
                    ...newBlocker, 
                    severity: e.target.value as OutcomeBlocker['severity']
                  })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <div className="form-actions">
                  <button type="submit" disabled={loading}>
                    {loading ? 'Reporting...' : 'Report'}
                  </button>
                  <button type="button" onClick={() => setShowBlockerForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="blockers-list">
              {blockers.length === 0 ? (
                <div className="empty-state-small">
                  <CheckCircle size={32} />
                  <p>No active blockers! 🎉</p>
                </div>
              ) : (
                blockers.map((blocker) => (
                  <div 
                    key={blocker.id} 
                    className="blocker-card"
                    style={{ borderLeftColor: getSeverityColor(blocker.severity) }}
                  >
                    <div className="blocker-header">
                      <h4>{blocker.title}</h4>
                      <span 
                        className="severity-badge"
                        style={{ backgroundColor: getSeverityColor(blocker.severity) }}
                      >
                        {blocker.severity}
                      </span>
                    </div>
                    {blocker.description && (
                      <p className="blocker-description">{blocker.description}</p>
                    )}
                    <div className="blocker-footer">
                      <small>
                        Reported {new Date(blocker.created_at).toLocaleDateString()}
                      </small>
                      <button 
                        className="btn-resolve"
                        onClick={() => handleResolveBlocker(blocker.id)}
                      >
                        <CheckCircle size={14} /> Resolve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

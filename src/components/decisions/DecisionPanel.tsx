import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ThumbsUp, 
  ThumbsDown,
  MessageSquare,
  Plus
} from 'lucide-react';
import { decisionService, Decision, DecisionWithVotes } from '../../services/decisionService';
import { VoiceTextButton } from '../shared/VoiceTextButton';
import './DecisionPanel.css';

interface DecisionPanelProps {
  workspaceId: string;
  currentUserId: string;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ 
  workspaceId, 
  currentUserId 
}) => {
  const [decisions, setDecisions] = useState<DecisionWithVotes[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDecision, setNewDecision] = useState({
    title: '',
    description: '',
    decision_type: 'general' as Decision['decision_type']
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDecisions();
    
    // Subscribe to real-time updates
    const subscription = decisionService.subscribeToDecisions(
      workspaceId,
      () => loadDecisions()
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [workspaceId]);

  const loadDecisions = async () => {
    const data = await decisionService.getWorkspaceDecisions(workspaceId);
    setDecisions(data);
  };

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecision.title.trim()) return;

    setLoading(true);
    await decisionService.createDecision({
      workspace_id: workspaceId,
      title: newDecision.title,
      description: newDecision.description,
      decision_type: newDecision.decision_type,
      proposed_by: currentUserId
    });

    setNewDecision({ title: '', description: '', decision_type: 'general' });
    setShowCreateForm(false);
    setLoading(false);
    loadDecisions();
  };

  const handleVote = async (
    decisionId: string, 
    vote: 'approve' | 'reject' | 'abstain' | 'concern'
  ) => {
    await decisionService.castVote({
      decision_id: decisionId,
      user_id: currentUserId,
      vote
    });
    loadDecisions();
  };

  const handleFinalize = async (decisionId: string) => {
    const finalDecision = prompt('Enter final decision summary:');
    if (!finalDecision) return;

    await decisionService.finalizeDecision(decisionId, finalDecision);
    loadDecisions();
  };

  const getStatusIcon = (status: Decision['status']) => {
    switch (status) {
      case 'proposed':
        return <AlertCircle className="status-icon proposed" />;
      case 'voting':
        return <MessageSquare className="status-icon voting" />;
      case 'decided':
        return <CheckCircle className="status-icon decided" />;
      case 'cancelled':
        return <XCircle className="status-icon cancelled" />;
    }
  };

  const getTypeColor = (type: Decision['decision_type']) => {
    const colors = {
      general: '#667eea',
      technical: '#0ea5e9',
      product: '#8b5cf6',
      process: '#ec4899'
    };
    return colors[type];
  };

  return (
    <div className="decision-panel">
      <div className="decision-header">
        <h2>📋 Decisions</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus size={16} /> New Decision
        </button>
      </div>

      {showCreateForm && (
        <form className="decision-form" onSubmit={handleCreateDecision}>
          <div className="input-with-voice">
            <input
              type="text"
              placeholder="Decision title..."
              value={newDecision.title}
              onChange={(e) => setNewDecision({ ...newDecision, title: e.target.value })}
              required
            />
            <VoiceTextButton
              onTranscript={(text) => setNewDecision(prev => ({ ...prev, title: prev.title + (prev.title && !prev.title.endsWith(' ') ? ' ' : '') + text }))}
              size="sm"
            />
          </div>
          <div className="input-with-voice">
            <textarea
              placeholder="Description (optional)"
              value={newDecision.description}
              onChange={(e) => setNewDecision({ ...newDecision, description: e.target.value })}
              rows={3}
            />
            <VoiceTextButton
              onTranscript={(text) => setNewDecision(prev => ({ ...prev, description: (prev.description || '') + ((prev.description && !prev.description.endsWith(' ')) ? ' ' : '') + text }))}
              size="sm"
            />
          </div>
          <select
            value={newDecision.decision_type}
            onChange={(e) => setNewDecision({ 
              ...newDecision, 
              decision_type: e.target.value as Decision['decision_type']
            })}
          >
            <option value="general">General</option>
            <option value="technical">Technical</option>
            <option value="product">Product</option>
            <option value="process">Process</option>
          </select>
          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Decision'}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="decisions-list">
        {decisions.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={48} />
            <p>No decisions yet</p>
            <small>Create your first decision to get started</small>
          </div>
        ) : (
          decisions.map((decision) => {
            const hasVoted = decision.votes.some(v => v.user_id === currentUserId);
            const userVote = decision.votes.find(v => v.user_id === currentUserId);
            
            return (
              <div 
                key={decision.id} 
                className={`decision-card status-${decision.status}`}
              >
                <div className="decision-card-header">
                  <div className="decision-title-section">
                    {getStatusIcon(decision.status)}
                    <div>
                      <h3>{decision.title}</h3>
                      <span 
                        className="decision-type"
                        style={{ backgroundColor: getTypeColor(decision.decision_type) }}
                      >
                        {decision.decision_type}
                      </span>
                    </div>
                  </div>
                  <span className="decision-status">{decision.status}</span>
                </div>

                {decision.description && (
                  <p className="decision-description">{decision.description}</p>
                )}

                {decision.status === 'decided' && decision.final_decision && (
                  <div className="final-decision">
                    <strong>📝 Final Decision:</strong>
                    <p>{decision.final_decision}</p>
                  </div>
                )}

                <div className="vote-summary">
                  <div className="vote-count approve">
                    <ThumbsUp size={16} />
                    {decision.vote_counts.approve}
                  </div>
                  <div className="vote-count reject">
                    <ThumbsDown size={16} />
                    {decision.vote_counts.reject}
                  </div>
                  <div className="vote-count concern">
                    <AlertCircle size={16} />
                    {decision.vote_counts.concern}
                  </div>
                  <div className="vote-count abstain">
                    <MessageSquare size={16} />
                    {decision.vote_counts.abstain}
                  </div>
                </div>

                {decision.status !== 'decided' && decision.status !== 'cancelled' && (
                  <div className="voting-actions">
                    {!hasVoted ? (
                      <>
                        <button 
                          className="vote-btn approve"
                          onClick={() => handleVote(decision.id, 'approve')}
                        >
                          <ThumbsUp size={16} /> Approve
                        </button>
                        <button 
                          className="vote-btn reject"
                          onClick={() => handleVote(decision.id, 'reject')}
                        >
                          <ThumbsDown size={16} /> Reject
                        </button>
                        <button 
                          className="vote-btn concern"
                          onClick={() => handleVote(decision.id, 'concern')}
                        >
                          <AlertCircle size={16} /> Concern
                        </button>
                      </>
                    ) : (
                      <div className="voted-badge">
                        ✓ You voted: <strong>{userVote?.vote}</strong>
                      </div>
                    )}

                    {decision.proposed_by === currentUserId && (
                      <button 
                        className="btn-finalize"
                        onClick={() => handleFinalize(decision.id)}
                      >
                        Finalize Decision
                      </button>
                    )}
                  </div>
                )}

                <div className="decision-footer">
                  <small>
                    Proposed {new Date(decision.created_at).toLocaleDateString()}
                  </small>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

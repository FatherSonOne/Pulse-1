import React, { useState, useEffect } from 'react';
import { decisionService, Decision, DecisionVote, DecisionWithVotes } from '../services/decisionService';
import { CheckCircle, XCircle, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';
import './DecisionObject.css';

interface DecisionObjectProps {
  messageId: string;
  workspaceId: string;
  currentUserId: string;
  initialText?: string;
}

export const DecisionObject: React.FC<DecisionObjectProps> = ({
  messageId,
  workspaceId,
  currentUserId,
  initialText
}) => {
  const [decision, setDecision] = useState<DecisionWithVotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingDecision, setIsCreatingDecision] = useState(false);

  useEffect(() => {
    loadDecision();
  }, [messageId, workspaceId]);

  useEffect(() => {
    if (decision) {
      const subscription = decisionService.subscribeToDecisions(
        workspaceId,
        (updatedDecision) => {
          if (updatedDecision.id === decision.id) {
            loadDecision(); // Reload when decision changes
          }
        }
      );
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [decision?.id, workspaceId]);

  const loadDecision = async () => {
    setLoading(true);
    const decisions = await decisionService.getWorkspaceDecisions(workspaceId);
    const found = decisions.find(d => d.message_id === messageId);
    setDecision(found || null);
    setLoading(false);
  };

  const handleCreateDecision = async () => {
    if (!initialText) return;

    setIsCreatingDecision(true);
    const newDecision = await decisionService.createDecision({
      workspace_id: workspaceId,
      message_id: messageId,
      title: initialText.substring(0, 100),
      description: initialText,
      decision_type: 'general',
      proposed_by: currentUserId
    });

    if (newDecision) {
      await loadDecision();
    }
    setIsCreatingDecision(false);
  };

  const handleVote = async (choice: 'approve' | 'reject') => {
    if (!decision) return;

    const vote = await decisionService.castVote({
      decision_id: decision.id,
      user_id: currentUserId,
      vote: choice
    });

    if (vote) {
      await loadDecision();
    }
  };

  const getUserVote = (): 'approve' | 'reject' | null => {
    if (!decision?.votes) return null;
    const userVote = decision.votes.find(v => v.user_id === currentUserId);
    if (!userVote) return null;
    if (userVote.vote === 'approve' || userVote.vote === 'reject') {
      return userVote.vote;
    }
    return null;
  };

  const approveCount = decision?.vote_counts?.approve || 0;
  const rejectCount = decision?.vote_counts?.reject || 0;

  if (loading) {
    return <div className="decision-object loading">Loading decision...</div>;
  }

  // Show "Mark as Decision" button if no decision exists yet
  if (!decision) {
    return (
      <div className="decision-object create">
        <button
          className="create-decision-btn"
          onClick={handleCreateDecision}
          disabled={isCreatingDecision}
        >
          <CheckCircle size={16} />
          {isCreatingDecision ? 'Creating Decision...' : 'Mark as Decision'}
        </button>
      </div>
    );
  }

  const userVote = getUserVote();
  const statusIcon = decision.status === 'decided'
    ? <CheckCircle size={20} className="status-icon approved" />
    : decision.status === 'cancelled'
    ? <XCircle size={20} className="status-icon rejected" />
    : <Clock size={20} className="status-icon pending" />;

  const isOpen = decision.status === 'proposed' || decision.status === 'voting';

  return (
    <div className={`decision-object ${decision.status}`}>
      <div className="decision-header">
        {statusIcon}
        <span className="decision-label">
          {isOpen ? 'Pending Decision' :
           decision.status === 'decided' ? 'Decision Made' :
           'Decision Cancelled'}
        </span>
        <span className="vote-count">
          {approveCount} approvals
        </span>
      </div>

      <div className="decision-content">
        <p className="proposal-text">{decision.description || decision.title}</p>
      </div>

      {isOpen && (
        <div className="vote-actions">
          <button
            className={`vote-btn approve ${userVote === 'approve' ? 'active' : ''}`}
            onClick={() => handleVote('approve')}
            disabled={!!userVote}
          >
            <ThumbsUp size={16} />
            Approve ({approveCount})
          </button>
          <button
            className={`vote-btn reject ${userVote === 'reject' ? 'active' : ''}`}
            onClick={() => handleVote('reject')}
            disabled={!!userVote}
          >
            <ThumbsDown size={16} />
            Reject ({rejectCount})
          </button>
        </div>
      )}

      {!isOpen && (
        <div className="decision-result">
          <div className="vote-summary">
            <div className="vote-stat">
              <ThumbsUp size={14} />
              <span>{approveCount} approved</span>
            </div>
            <div className="vote-stat">
              <ThumbsDown size={14} />
              <span>{rejectCount} rejected</span>
            </div>
          </div>
          {decision.decided_at && (
            <div className="resolved-time">
              Resolved {new Date(decision.decided_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { decisionService, DecisionWithVotes, DecisionVote } from '../services/decisionService';
import { CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import './DecisionCard.css';

interface DecisionCardProps {
  decision: DecisionWithVotes;
  currentUserId: string;
  onVote?: () => void;
}

interface VoteResults {
  total_votes: number;
  choices: {
    [key: string]: {
      count: number;
      percentage: number;
      voters: string[];
    };
  };
  average_confidence?: number;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  currentUserId,
  onVote
}) => {
  const [results, setResults] = useState<VoteResults | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<DecisionVote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [decision.id, decision.votes]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculate results from the votes included in the decision
      const votes = decision.votes || [];
      const voteCounts = decisionService.calculateVoteCounts(votes);
      const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);

      // Find user's vote
      const currentUserVote = votes.find(v => v.user_id === currentUserId);
      setUserVote(currentUserVote || null);
      setHasVoted(!!currentUserVote);

      // Calculate results with percentages
      const choices: VoteResults['choices'] = {};
      const voteTypes: Array<keyof typeof voteCounts> = ['approve', 'reject', 'abstain', 'concern'];

      voteTypes.forEach(voteType => {
        const count = voteCounts[voteType];
        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const voters = votes
          .filter(v => v.vote === voteType)
          .map(v => v.user_id);

        choices[voteType] = {
          count,
          percentage,
          voters
        };
      });

      setResults({
        total_votes: totalVotes,
        choices
      });
    } catch (error) {
      console.error('Failed to load decision data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (choice: 'approve' | 'reject' | 'abstain' | 'concern') => {
    try {
      await decisionService.castVote({
        decision_id: decision.id,
        user_id: currentUserId,
        vote: choice
      });
      setHasVoted(true);
      onVote?.();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const getStatusIcon = () => {
    switch (decision.status) {
      case 'voting':
        return <Clock size={16} />;
      case 'decided':
        return <CheckCircle size={16} />;
      case 'proposed':
        return <AlertCircle size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getStatusColor = () => {
    switch (decision.status) {
      case 'voting': return '#f59e0b';
      case 'decided': return '#10b981';
      case 'proposed': return '#667eea';
      default: return '#6b7280';
    }
  };

  const getVoteLabel = (voteType: string): string => {
    const labels: Record<string, string> = {
      approve: 'Approve',
      reject: 'Reject',
      abstain: 'Abstain',
      concern: 'Concern'
    };
    return labels[voteType] || voteType;
  };

  return (
    <div className={`decision-card status-${decision.status}`}>
      <div className="decision-header">
        <div className="decision-title">
          <h3>{decision.title}</h3>
          <div
            className="decision-status"
            style={{
              backgroundColor: `${getStatusColor()}15`,
              color: getStatusColor()
            }}
          >
            {getStatusIcon()}
            <span>{decision.status}</span>
          </div>
        </div>

        {decision.description && (
          <p className="decision-description">{decision.description}</p>
        )}

        <div className="decision-meta">
          <span className="decision-type">{decision.decision_type}</span>
          <span className="decision-date">
            {new Date(decision.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {decision.status === 'voting' && (
        <div className="decision-voting">
          {!hasVoted ? (
            <div className="voting-options">
              <p>Cast your vote:</p>
              <button
                className="vote-button vote-approve"
                onClick={() => handleVote('approve')}
              >
                Approve
              </button>
              <button
                className="vote-button vote-reject"
                onClick={() => handleVote('reject')}
              >
                Reject
              </button>
              <button
                className="vote-button vote-concern"
                onClick={() => handleVote('concern')}
              >
                Concern
              </button>
              <button
                className="vote-button vote-abstain"
                onClick={() => handleVote('abstain')}
              >
                Abstain
              </button>
            </div>
          ) : (
            <div className="voted-indicator">
              <CheckCircle size={16} />
              <span>You voted: <strong>{getVoteLabel(userVote?.vote || '')}</strong></span>
            </div>
          )}
        </div>
      )}

      {results && results.total_votes > 0 && (
        <div className="decision-results">
          <div className="results-header">
            <span>Results ({results.total_votes} votes)</span>
          </div>

          {Object.entries(results.choices)
            .filter(([_, data]) => data.count > 0)
            .map(([choice, data]) => (
              <div key={choice} className="result-bar">
                <div className="result-label">
                  <span>{getVoteLabel(choice)}</span>
                  <span>{data.count} ({data.percentage}%)</span>
                </div>
                <div className="result-progress">
                  <div
                    className={`result-fill result-fill-${choice}`}
                    style={{ width: `${data.percentage}%` }}
                  ></div>
                </div>
                {data.voters.length > 0 && (
                  <div className="result-voters">
                    {data.voters.slice(0, 3).join(', ')}
                    {data.voters.length > 3 && ` +${data.voters.length - 3} more`}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {decision.status === 'decided' && decision.final_decision && (
        <div className="final-decision">
          <CheckCircle size={18} />
          <div>
            <strong>Decision: {decision.final_decision}</strong>
            {decision.decided_at && (
              <p className="decision-timestamp">
                Decided on {new Date(decision.decided_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

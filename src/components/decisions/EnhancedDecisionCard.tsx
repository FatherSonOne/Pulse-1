import React, { useEffect, useState } from 'react';
import { decisionService, DecisionWithVotes, DecisionVote } from '../../services/decisionService';
import { taskService } from '../../services/taskService';
import { decisionAnalyticsService, RiskAssessment } from '../../services/decisionAnalyticsService';
import { taskIntelligenceService } from '../../services/taskIntelligenceService';
import { CheckCircle, Clock, AlertCircle, TrendingUp, Users, Bell, Sparkles, ListTodo, AlertTriangle, Info } from 'lucide-react';
import '../DecisionCard.css';
import './EnhancedDecisionCard.css';

interface EnhancedDecisionCardProps {
  decision: DecisionWithVotes;
  currentUserId: string;
  workspaceId: string;
  onVote?: () => void;
  onOpenMission?: (decision: DecisionWithVotes) => void;
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

export const EnhancedDecisionCard: React.FC<EnhancedDecisionCardProps> = ({
  decision,
  currentUserId,
  workspaceId,
  onVote,
  onOpenMission
}) => {
  const [results, setResults] = useState<VoteResults | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<DecisionVote | null>(null);
  const [loading, setLoading] = useState(true);

  // AI features state
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [suggestedStakeholders, setSuggestedStakeholders] = useState<string[]>([]);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [loadingStakeholders, setLoadingStakeholders] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  useEffect(() => {
    loadData();
    loadAIInsights();
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

  const loadAIInsights = async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) return;

    // Load risk assessment
    if (decision.status === 'voting' || decision.status === 'proposed') {
      setLoadingRisk(true);
      try {
        const risk = await decisionAnalyticsService.assessDecisionRisk(decision, apiKey);
        setRiskAssessment(risk);
      } catch (error) {
        console.error('Failed to load risk assessment:', error);
      } finally {
        setLoadingRisk(false);
      }
    }

    // Load AI-suggested stakeholders if already stored
    if (decision.ai_suggested_stakeholders && decision.ai_suggested_stakeholders.length > 0) {
      setSuggestedStakeholders(decision.ai_suggested_stakeholders);
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

  const handleSendReminder = async () => {
    // TODO: Implement send reminder functionality
    // This would integrate with notification service or email
    alert(`Reminder sent for: "${decision.title}"\n\nIn production, this would send notifications to stakeholders who haven't voted yet.`);
  };

  const handleGenerateTasks = async () => {
    if (decision.status !== 'decided') {
      alert('Tasks can only be generated from decided decisions.');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      alert('Please add your Gemini API key in settings to use AI task generation.');
      return;
    }

    setGeneratingTasks(true);
    try {
      // Extract tasks from decision using AI
      const extractedTasks = await taskIntelligenceService.extractTasksFromDecision(decision, apiKey);

      if (extractedTasks.length === 0) {
        alert('No tasks could be generated from this decision.');
        return;
      }

      // Create tasks in database
      const createdTasks = [];
      for (const taskData of extractedTasks) {
        const newTask = await taskService.createTask({
          title: taskData.title || 'Untitled Task',
          description: taskData.description || '',
          priority: taskData.priority || 'medium',
          status: 'todo',
          workspace_id: workspaceId,
          created_by: currentUserId,
          metadata: {
            ...taskData.metadata,
            decision_id: decision.id,
            generated_by_ai: true,
          }
        });
        createdTasks.push(newTask);
      }

      alert(`Successfully generated ${createdTasks.length} tasks from this decision!\n\nSwitch to the Tasks tab to view them.`);

    } catch (error) {
      console.error('Failed to generate tasks:', error);
      alert('Failed to generate tasks. Please try again.');
    } finally {
      setGeneratingTasks(false);
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

  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return '#10b981'; // green
      case 'medium': return '#f59e0b'; // amber
      case 'high': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return <CheckCircle size={14} />;
      case 'medium': return <Info size={14} />;
      case 'high': return <AlertTriangle size={14} />;
      default: return <Info size={14} />;
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

  const getPredictedCompletion = () => {
    if (decision.ai_predicted_completion) {
      const date = new Date(decision.ai_predicted_completion);
      return date.toLocaleDateString();
    }
    return null;
  };

  return (
    <div className={`decision-card enhanced-decision-card status-${decision.status}`}>
      <div className="decision-header">
        <div className="decision-title">
          <h3>{decision.title}</h3>
          <div className="decision-badges">
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

            {/* AI Risk Badge */}
            {riskAssessment && (decision.status === 'voting' || decision.status === 'proposed') && (
              <div
                className="ai-badge risk-badge"
                style={{
                  backgroundColor: `${getRiskColor(riskAssessment.riskLevel)}15`,
                  color: getRiskColor(riskAssessment.riskLevel)
                }}
                title={riskAssessment.reasoning}
              >
                {getRiskIcon(riskAssessment.riskLevel)}
                <span>{riskAssessment.riskLevel} risk</span>
              </div>
            )}

            {/* Predicted Completion Badge */}
            {getPredictedCompletion() && decision.status === 'voting' && (
              <div className="ai-badge completion-badge" title="AI predicted completion date">
                <Clock size={14} />
                <span>{getPredictedCompletion()}</span>
              </div>
            )}
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

        {/* AI Suggested Stakeholders */}
        {suggestedStakeholders.length > 0 && (
          <div className="stakeholder-suggestions">
            <div className="stakeholder-header">
              <Users size={14} />
              <span>AI-suggested stakeholders:</span>
            </div>
            <div className="stakeholder-chips">
              {suggestedStakeholders.map((stakeholder, idx) => (
                <div key={idx} className="stakeholder-chip">
                  <div className="stakeholder-avatar">
                    {stakeholder.charAt(0).toUpperCase()}
                  </div>
                  <span>{stakeholder}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Risk Recommendations */}
        {riskAssessment && riskAssessment.recommendations.length > 0 && riskAssessment.riskLevel !== 'low' && (
          <div className="ai-recommendations">
            <div className="recommendations-header">
              <Sparkles size={14} />
              <span>AI Recommendations:</span>
            </div>
            <ul className="recommendations-list">
              {riskAssessment.recommendations.slice(0, 2).map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
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

      {/* AI Action Buttons */}
      <div className="decision-actions">
        {decision.status === 'voting' && (
          <button
            className="action-button send-reminder"
            onClick={handleSendReminder}
            title="Send reminder to stakeholders who haven't voted"
          >
            <Bell size={16} />
            <span>Send Reminder</span>
          </button>
        )}

        {decision.status === 'decided' && (
          <button
            className="action-button generate-tasks"
            onClick={handleGenerateTasks}
            disabled={generatingTasks}
            title="Generate tasks from this decision using AI"
          >
            {generatingTasks ? (
              <>
                <div className="spinner-small"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <ListTodo size={16} />
                <span>Generate Tasks</span>
              </>
            )}
          </button>
        )}

        {onOpenMission && (
          <button
            className="action-button view-mission"
            onClick={() => onOpenMission(decision)}
            title="View in Decision Mission"
          >
            <TrendingUp size={16} />
            <span>View Mission</span>
          </button>
        )}
      </div>
    </div>
  );
};

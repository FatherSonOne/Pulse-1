import React, { useEffect, useState, memo } from 'react';
import { decisionService, DecisionWithVotes, DecisionVote } from '../../services/decisionService';
import { taskService } from '../../services/taskService';
import { decisionAnalyticsService, RiskAssessment } from '../../services/decisionAnalyticsService';
import { taskIntelligenceService } from '../../services/taskIntelligenceService';
import { consensusDetectorService } from '../../services/consensusDetectorService'; // Phase 2: Consensus detection
import { CheckCircle, Clock, AlertCircle, TrendingUp, Bell, Sparkles, ListTodo, AlertTriangle, Info } from 'lucide-react';
import { TaskExtractionModal, ExtractedTask } from '../tasks/TaskExtractionModal';
import { notificationService } from '../../services/notificationService';
import '../DecisionCard.css';
import './EnhancedDecisionCard.css';

interface EnhancedDecisionCardProps {
  decision: DecisionWithVotes;
  currentUserId: string;
  workspaceId: string;
  linkedTaskCount?: number; // Pre-computed count to avoid N+1 queries
  onVote?: () => void;
  onOpenMission?: (decision: DecisionWithVotes) => void;
  onGenerateTasks?: (decision: DecisionWithVotes) => void; // Phase 2: Open DecisionDecomposer
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

// Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (
  prevProps: EnhancedDecisionCardProps,
  nextProps: EnhancedDecisionCardProps
): boolean => {
  // Check if decision ID or updated_at changed
  if (prevProps.decision.id !== nextProps.decision.id) return false;
  if (prevProps.decision.updated_at !== nextProps.decision.updated_at) return false;

  // Check if votes array length changed (indicates new vote)
  if ((prevProps.decision.votes?.length || 0) !== (nextProps.decision.votes?.length || 0)) return false;

  // Check if status changed
  if (prevProps.decision.status !== nextProps.decision.status) return false;

  // Check if user ID or workspace ID changed
  if (prevProps.currentUserId !== nextProps.currentUserId) return false;
  if (prevProps.workspaceId !== nextProps.workspaceId) return false;

  // Check if linked task count changed
  if ((prevProps.linkedTaskCount ?? 0) !== (nextProps.linkedTaskCount ?? 0)) return false;

  // Props are equal, skip re-render
  return true;
};

const EnhancedDecisionCardComponent: React.FC<EnhancedDecisionCardProps> = ({
  decision,
  currentUserId,
  workspaceId,
  linkedTaskCount: linkedTaskCountProp,
  onVote,
  onOpenMission,
  onGenerateTasks
}) => {
  const [results, setResults] = useState<VoteResults | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<DecisionVote | null>(null);
  const [loading, setLoading] = useState(true);

  // AI features state
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [consensusResult, setConsensusResult] = useState<{ reached: boolean; winning_choice: string | null; confidence: number; reasoning: string } | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  // Task extraction modal state
  const [showTaskExtractionModal, setShowTaskExtractionModal] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [linkedTaskCount, setLinkedTaskCount] = useState<number>(linkedTaskCountProp ?? 0);

  // Sync prop to state when it changes
  useEffect(() => {
    if (linkedTaskCountProp !== undefined) {
      setLinkedTaskCount(linkedTaskCountProp);
    }
  }, [linkedTaskCountProp]);

  // Reload base data whenever the decision id or vote array changes
  useEffect(() => {
    loadData();
  }, [decision.id, decision.votes]);

  // Load AI insights only once per decision, or when the vote *count* changes.
  // Using vote count (not the full array reference) prevents redundant API calls
  // when the parent re-renders the same data.
  const voteCount = decision.votes?.length ?? 0;
  useEffect(() => {
    loadAIInsights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision.id, voteCount]);

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
          .filter(v => v.choice === voteType)
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

    // Load risk assessment — service handles caching & 429 backoff internally
    if (decision.status === 'voting' || decision.status === 'proposed') {
      setLoadingRisk(true);
      try {
        const risk = await decisionAnalyticsService.assessDecisionRisk(decision, apiKey);
        // confidence === -1 means quota exhausted; still store it so the UI can
        // show a friendly message instead of leaving the panel in loading state
        setRiskAssessment(risk);
      } finally {
        setLoadingRisk(false);
      }
    }

    // Run consensus detection when enough votes exist
    if (decision.status === 'voting' && (decision.votes?.length ?? 0) >= 3) {
      try {
        const result = consensusDetectorService.detectConsensus(decision);
        setConsensusResult({
          reached: result.reached,
          winning_choice: result.winning_choice,
          confidence: result.confidence,
          reasoning: result.reasoning,
        });
      } catch {
        // Consensus detection is non-critical
      }
    }
  };

  const handleVote = async (choice: 'approve' | 'reject' | 'abstain' | 'concern') => {
    try {
      await decisionService.castVote({
        decision_id: decision.id,
        user_id: currentUserId,
        choice: choice
      });
      setHasVoted(true);
      onVote?.();
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleSendReminder = async () => {
    try {
      await notificationService.notifyDecisionEvent({
        type: 'new_vote',
        decisionTitle: decision.title,
        actionUrl: `/decisions?id=${decision.id}`,
      });
    } catch (error) {
      console.error('Failed to send reminder:', error);
    }
  };

  // Phase 7.5: Keyboard navigation handlers
  const handleButtonKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  const handleGenerateTasks = async () => {
    // Phase 2: Use DecisionDecomposer if callback provided
    if (onGenerateTasks) {
      onGenerateTasks(decision);
      return;
    }

    // Fallback to legacy extraction modal
    if (decision.status !== 'decided' && decision.status !== 'approved') {
      alert('Tasks can only be generated from approved or decided decisions.');
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
      const tasks = await taskIntelligenceService.extractTasksFromDecision(decision, apiKey);

      if (tasks.length === 0) {
        alert('No tasks could be generated from this decision.');
        setGeneratingTasks(false);
        return;
      }

      // Show the review modal with extracted tasks
      setExtractedTasks(tasks as ExtractedTask[]);
      setShowTaskExtractionModal(true);

    } catch (error) {
      console.error('Failed to generate tasks:', error);
      alert('Failed to generate tasks. Please try again.');
    } finally {
      setGeneratingTasks(false);
    }
  };

  const handleSaveExtractedTasks = async (tasks: ExtractedTask[]) => {
    // Create tasks in database with decision linkage
    const createdTasks = [];
    for (const taskData of tasks) {
      const newTask = await taskService.createTask({
        title: taskData.title,
        description: taskData.description || '',
        priority: taskData.priority,
        status: 'todo',
        workspace_id: workspaceId,
        created_by: currentUserId,
        metadata: {
          decision_id: decision.id,
          generated_by_ai: true,
          estimated_duration: taskData.estimated_duration
        }
      });
      createdTasks.push(newTask);
    }

    setLinkedTaskCount(prev => prev + createdTasks.length);

    alert(`Successfully created ${createdTasks.length} ${createdTasks.length === 1 ? 'task' : 'tasks'} from this decision!\n\nSwitch to the Tasks tab to view them.`);
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

  return (
    <div className={`decision-card enhanced-decision-card status-${decision.status}`} role="article" aria-label={`Decision: ${decision.title}`}>
      <div className="decision-header">
        <div className="decision-title">
          <h3>{decision.title}</h3>
          <div className="decision-badges" role="group" aria-label="Decision status and risk indicators">
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

            {/* AI Risk Badge — hidden when quota is exhausted (confidence === -1) */}
            {riskAssessment && riskAssessment.confidence !== -1 && (decision.status === 'voting' || decision.status === 'proposed') && (
              <div
                className="ai-badge risk-badge"
                style={{
                  backgroundColor: `${getRiskColor(riskAssessment.riskLevel)}15`,
                  color: getRiskColor(riskAssessment.riskLevel)
                }}
                aria-label={`${riskAssessment.riskLevel} risk: ${riskAssessment.reasoning}`}
                title={riskAssessment.reasoning}
              >
                {getRiskIcon(riskAssessment.riskLevel)}
                <span>{riskAssessment.riskLevel} risk</span>
              </div>
            )}
            {riskAssessment && riskAssessment.confidence === -1 && (decision.status === 'voting' || decision.status === 'proposed') && (
              <div
                className="ai-badge"
                style={{ opacity: 0.5 }}
                title="AI risk assessment unavailable — Gemini API quota exceeded"
                aria-label="AI risk assessment unavailable"
              >
                <AlertCircle size={14} />
                <span>risk N/A</span>
              </div>
            )}

            {/* Consensus Badge */}
            {consensusResult && decision.status === 'voting' && (
              <div
                className="ai-badge"
                style={{
                  backgroundColor: consensusResult.reached ? '#10b98115' : '#f59e0b15',
                  color: consensusResult.reached ? '#10b981' : '#f59e0b'
                }}
                title={consensusResult.reasoning}
              >
                {consensusResult.reached ? <CheckCircle size={14} /> : <Clock size={14} />}
                <span>{consensusResult.reached ? `Consensus: ${consensusResult.winning_choice}` : 'No consensus yet'}</span>
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


        {/* AI Risk Recommendations — hidden when quota exhausted */}
        {riskAssessment && riskAssessment.confidence !== -1 && riskAssessment.recommendations.length > 0 && riskAssessment.riskLevel !== 'low' && (
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
            <div className="voting-options" role="group" aria-label="Cast your vote">
              <p>Cast your vote:</p>
              <button
                type="button"
                className="vote-button vote-approve"
                onClick={() => handleVote('approve')}
                onKeyDown={(e) => handleButtonKeyDown(e, () => handleVote('approve'))}
                aria-label="Vote to approve this decision"
              >
                Approve
              </button>
              <button
                type="button"
                className="vote-button vote-reject"
                onClick={() => handleVote('reject')}
                onKeyDown={(e) => handleButtonKeyDown(e, () => handleVote('reject'))}
                aria-label="Vote to reject this decision"
              >
                Reject
              </button>
              <button
                type="button"
                className="vote-button vote-concern"
                onClick={() => handleVote('concern')}
                onKeyDown={(e) => handleButtonKeyDown(e, () => handleVote('concern'))}
                aria-label="Vote with concern about this decision"
              >
                Concern
              </button>
              <button
                type="button"
                className="vote-button vote-abstain"
                onClick={() => handleVote('abstain')}
                onKeyDown={(e) => handleButtonKeyDown(e, () => handleVote('abstain'))}
                aria-label="Abstain from voting on this decision"
              >
                Abstain
              </button>
            </div>
          ) : (
            <div className="voted-indicator">
              <CheckCircle size={16} />
              <span>You voted: <strong>{getVoteLabel(userVote?.choice || '')}</strong></span>
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
      <div className="decision-actions" role="group" aria-label="Decision actions">
        {decision.status === 'voting' && (
          <button
            type="button"
            className="action-button send-reminder"
            onClick={handleSendReminder}
            onKeyDown={(e) => handleButtonKeyDown(e, handleSendReminder)}
            aria-label="Send reminder to stakeholders who haven't voted"
          >
            <Bell size={16} aria-hidden="true" />
            <span>Send Reminder</span>
          </button>
        )}

        {(decision.status === 'decided' || decision.status === 'approved') && (
          <button
            type="button"
            className="action-button generate-tasks"
            onClick={handleGenerateTasks}
            onKeyDown={(e) => handleButtonKeyDown(e, handleGenerateTasks)}
            disabled={generatingTasks}
            aria-label={generatingTasks ? "Generating tasks..." : "Generate tasks from this decision using AI"}
          >
            {generatingTasks ? (
              <>
                <div className="spinner-small" aria-hidden="true"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <ListTodo size={16} aria-hidden="true" />
                <span>Generate Tasks</span>
                {linkedTaskCount > 0 && (
                  <span className="task-count-badge" title={`${linkedTaskCount} linked ${linkedTaskCount === 1 ? 'task' : 'tasks'}`}>
                    {linkedTaskCount}
                  </span>
                )}
              </>
            )}
          </button>
        )}

        {onOpenMission && (
          <button
            type="button"
            className="action-button view-mission"
            onClick={() => onOpenMission(decision)}
            onKeyDown={(e) => handleButtonKeyDown(e, () => onOpenMission(decision))}
            aria-label="View this decision in Decision Mission"
          >
            <TrendingUp size={16} aria-hidden="true" />
            <span>View Mission</span>
          </button>
        )}
      </div>

      {/* Task Extraction Modal */}
      {showTaskExtractionModal && (
        <TaskExtractionModal
          tasks={extractedTasks}
          decisionTitle={decision.title || 'this decision'}
          onClose={() => setShowTaskExtractionModal(false)}
          onSave={handleSaveExtractedTasks}
        />
      )}
    </div>
  );
};

// Export memoized component with custom comparison
export const EnhancedDecisionCard = memo(EnhancedDecisionCardComponent, arePropsEqual);

import React, { useState, memo } from 'react';
import { Task } from '../../services/taskService';
import { taskIntelligenceService, AITaskPriority } from '../../services/taskIntelligenceService';
import { Zap, RefreshCw, AlertCircle, TrendingUp, CheckCircle, X } from 'lucide-react';
import './AITaskPrioritizer.css';

export interface AITaskPrioritizerProps {
  tasks: Task[];
  onPrioritizationComplete: (prioritizedTasks: AITaskPriority[]) => void;
  onClose?: () => void;
  /**
   * @deprecated No longer used — AI calls route through the ai-router edge
   * function with platform-managed keys. Retained as an optional prop for
   * backward compatibility with existing callers.
   */
  apiKey?: string;
}

// Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (
  prevProps: AITaskPrioritizerProps,
  nextProps: AITaskPrioritizerProps
): boolean => {
  // Check if tasks array length changed
  if (prevProps.tasks.length !== nextProps.tasks.length) return false;

  // Check if any task's updated_at changed
  for (let i = 0; i < prevProps.tasks.length; i++) {
    if (prevProps.tasks[i].id !== nextProps.tasks[i].id) return false;
    if (prevProps.tasks[i].updated_at !== nextProps.tasks[i].updated_at) return false;
  }

  // Props are equal, skip re-render
  return true;
};

const AITaskPrioritizerComponent: React.FC<AITaskPrioritizerProps> = ({
  tasks,
  onPrioritizationComplete,
  onClose,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<AITaskPriority[] | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handlePrioritize = async () => {
    if (tasks.length === 0) {
      setError('No tasks to prioritize');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Router (ai-router edge function) handles auth + keys server-side —
      // no client-side API key required.
      const prioritizedTasks = await taskIntelligenceService.intelligentPrioritization(
        tasks,
        undefined,
      );

      setLastAnalysis(prioritizedTasks);
      setShowResults(true);
      // Don't apply automatically - wait for user to click Apply
    } catch (err) {
      console.error('AI prioritization failed:', err);
      setError('Failed to analyze tasks. Please try again in a moment.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplySorting = () => {
    if (lastAnalysis) {
      onPrioritizationComplete(lastAnalysis);
      // Save preference
      localStorage.setItem('ai_prioritization_enabled', 'true');
      if (onClose) {
        onClose();
      }
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#ef4444'; // Red for high priority
    if (score >= 60) return '#f59e0b'; // Amber for medium-high
    if (score >= 40) return '#10b981'; // Green for medium
    return '#6b7280'; // Gray for low
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  // Calculate summary statistics
  const getSummaryStats = () => {
    if (!lastAnalysis || lastAnalysis.length === 0) return null;

    const critical = lastAnalysis.filter(t => t.aiScore >= 80).length;
    const high = lastAnalysis.filter(t => t.aiScore >= 60 && t.aiScore < 80).length;
    const medium = lastAnalysis.filter(t => t.aiScore >= 40 && t.aiScore < 60).length;
    const low = lastAnalysis.filter(t => t.aiScore < 40).length;
    const blockingTasks = lastAnalysis.filter(t => t.blocksOthers).length;

    return { critical, high, medium, low, blockingTasks };
  };

  const stats = getSummaryStats();

  return (
    <div className="ai-task-prioritizer-overlay" role="dialog" aria-label="AI Task Prioritization">
      <div className="ai-task-prioritizer">
        {/* Header */}
        <div className="prioritizer-header">
          <div className="prioritizer-header-left">
            <Zap size={20} aria-hidden="true" />
            <div>
              <h3 className="prioritizer-title">AI Task Prioritization</h3>
              <p className="prioritizer-subtitle">
                Analyze {tasks.length} task{tasks.length !== 1 ? 's' : ''} with AI to determine optimal priority
              </p>
            </div>
          </div>
          <div className="prioritizer-header-right">
            <button
              type="button"
              className="prioritize-button"
              onClick={handlePrioritize}
              disabled={isAnalyzing || tasks.length === 0}
              aria-label={isAnalyzing ? "Analyzing tasks with AI" : `Prioritize ${tasks.length} tasks with AI`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={16} className="spinning" aria-hidden="true" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Zap size={16} aria-hidden="true" />
                  <span>Prioritize Tasks</span>
                </>
              )}
            </button>
            {onClose && (
              <button
                type="button"
                className="prioritizer-close-button"
                onClick={onClose}
                aria-label="Close AI Task Prioritizer"
              >
                <X size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

      <div className="prioritizer-content">
      {/* Error message */}
      {error && (
        <div className="prioritizer-error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary statistics */}
      {stats && showResults && (
        <div className="prioritizer-stats">
          <div className="stat-card critical">
            <div className="stat-value">{stats.critical}</div>
            <div className="stat-label">Critical</div>
          </div>
          <div className="stat-card high">
            <div className="stat-value">{stats.high}</div>
            <div className="stat-label">High</div>
          </div>
          <div className="stat-card medium">
            <div className="stat-value">{stats.medium}</div>
            <div className="stat-label">Medium</div>
          </div>
          <div className="stat-card low">
            <div className="stat-value">{stats.low}</div>
            <div className="stat-label">Low</div>
          </div>
          {stats.blockingTasks > 0 && (
            <div className="stat-card blocking">
              <div className="stat-value">{stats.blockingTasks}</div>
              <div className="stat-label">Blocking Others</div>
            </div>
          )}
        </div>
      )}

      {/* Results list */}
      {lastAnalysis && showResults && (
        <div className="prioritizer-results">
          <div className="results-header">
            <TrendingUp size={16} aria-hidden="true" />
            <h4>Prioritization Results</h4>
            <button
              type="button"
              className="toggle-button"
              onClick={() => setShowResults(!showResults)}
              aria-label={showResults ? 'Hide prioritization details' : 'Show prioritization details'}
            >
              {showResults ? 'Hide' : 'Show'} Details
            </button>
          </div>

          <div className="results-list">
            {lastAnalysis.map((item, index) => {
              const task = tasks.find(t => t.id === item.taskId);
              if (!task) return null;

              return (
                <div key={item.taskId} className="result-item">
                  <div className="result-rank">#{index + 1}</div>

                  <div className="result-content">
                    <div className="result-header">
                      <h5 className="result-title">{task.title}</h5>
                      <div
                        className="result-score"
                        style={{
                          backgroundColor: `${getScoreColor(item.aiScore)}15`,
                          color: getScoreColor(item.aiScore)
                        }}
                      >
                        <Zap size={12} />
                        <span>{item.aiScore}</span>
                        <span className="score-label">{getScoreLabel(item.aiScore)}</span>
                      </div>
                    </div>

                    <p className="result-reasoning">{item.reasoning}</p>

                    <div className="result-meta">
                      {item.blocksOthers && (
                        <div className="result-badge blocking">
                          <AlertCircle size={12} />
                          <span>Blocks other tasks</span>
                        </div>
                      )}
                      {item.predictedDuration && (
                        <div className="result-badge duration">
                          <span>Est: {item.predictedDuration}</span>
                        </div>
                      )}
                      {item.suggestedAssignee && (
                        <div className="result-badge assignee">
                          <span>Suggest: {item.suggestedAssignee}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!lastAnalysis && !isAnalyzing && tasks.length > 0 && (
        <div className="prioritizer-empty">
          <Zap size={48} color="#ccc" />
          <p>Click "Prioritize Tasks" to analyze your tasks with AI</p>
          <p className="empty-description">
            AI will consider due dates, dependencies, complexity, and manual priority to generate intelligent priority scores
          </p>
        </div>
      )}

      </div>

      {/* Footer with Apply button */}
      {lastAnalysis && lastAnalysis.length > 0 && (
        <div className="prioritizer-footer">
          <button
            type="button"
            className="apply-sorting-button"
            onClick={handleApplySorting}
            aria-label="Apply AI prioritization to task list"
          >
            <CheckCircle size={16} aria-hidden="true" />
            <span>Apply Sorting</span>
          </button>
          {onClose && (
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              aria-label="Cancel and close"
            >
              Cancel
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

// Export memoized component with custom comparison
export const AITaskPrioritizer = memo(AITaskPrioritizerComponent, arePropsEqual);

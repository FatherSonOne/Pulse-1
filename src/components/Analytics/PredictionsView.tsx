/**
 * Predictions View - AI Predictive Analytics Dashboard
 * Part of Observatory Analytics Dashboard
 */

import React, { useState, useEffect } from 'react';
import {
  getAllPredictions,
  getLatestBurnoutIndicator,
  PredictionCache,
  BurnoutIndicator,
} from '../../services/predictiveAnalyticsService';

interface PredictionsViewProps {
  timeRange: string;
}

type PredictionFilter = 'all' | 'churn_risk' | 'optimal_timing' | 'engagement_forecast';

export const PredictionsView: React.FC<PredictionsViewProps> = ({ timeRange }) => {
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<PredictionCache[]>([]);
  const [burnout, setBurnout] = useState<BurnoutIndicator | null>(null);
  const [filterMode, setFilterMode] = useState<PredictionFilter>('all');
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [timeRange, filterMode]);

  const loadData = async () => {
    setLoading(true);
    const [predictionsResult, burnoutResult] = await Promise.all([
      filterMode === 'all'
        ? getAllPredictions(undefined, true)
        : getAllPredictions(filterMode, true),
      getLatestBurnoutIndicator(),
    ]);

    if (predictionsResult.success) setPredictions(predictionsResult.data!);
    if (burnoutResult.success) setBurnout(burnoutResult.data!);

    setLoading(false);
  };

  const getConfidenceColor = (confidence: number | null): string => {
    if (!confidence) return 'rgba(255,255,255,0.3)';
    if (confidence >= 0.8) return 'var(--accent-positive)';
    if (confidence >= 0.6) return 'var(--accent-info)';
    if (confidence >= 0.4) return 'var(--accent-warning)';
    return 'var(--accent-neutral)';
  };

  const getRiskColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'critical': return 'var(--accent-negative)';
      case 'high': return 'var(--accent-warning)';
      case 'moderate': return 'var(--accent-info)';
      case 'low': return 'var(--accent-positive)';
      default: return 'var(--accent-neutral)';
    }
  };

  const getPredictionIcon = (type: string): string => {
    if (type.includes('churn')) return '⚠';
    if (type.includes('timing')) return '⏰';
    if (type.includes('engagement')) return '📈';
    if (type.includes('response')) return '⚡';
    return '🔮';
  };

  const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatValidUntil = (timestamp: string | null): string => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 24) return `${diffHours}h remaining`;
    return `${diffDays}d remaining`;
  };

  if (loading) {
    return (
      <div className="observatory-loading">
        <div className="loading-orb">
          <div className="orb-core" />
          <div className="orb-ring ring-1" />
          <div className="orb-ring ring-2" />
          <div className="orb-ring ring-3" />
        </div>
        <p className="loading-text">Calculating predictions...</p>
      </div>
    );
  }

  return (
    <div className="view-predictions">
      {/* Burnout Monitor - Hero Section */}
      {burnout && (
        <section className="burnout-monitor">
          <div className="monitor-header">
            <h2 className="monitor-title">
              <span className="title-icon">🧠</span>
              Burnout Risk Monitor
            </h2>
          </div>

          <div className="monitor-content">
            <div className="risk-orb">
              <div
                className="orb-glow"
                style={{ '--glow-color': getRiskColor(burnout.risk_level) } as React.CSSProperties}
              />
              <div className="orb-content">
                <span className="risk-value">{burnout.burnout_risk_score.toFixed(0)}</span>
                <span className="risk-unit">/ 100</span>
              </div>
              <span
                className="risk-label"
                style={{ color: getRiskColor(burnout.risk_level) }}
              >
                {burnout.risk_level.toUpperCase()} RISK
              </span>
            </div>

            {/* Risk Factors Grid */}
            <div className="risk-factors">
              <div className={`factor-item ${burnout.avg_response_time_increasing ? 'active' : ''}`}>
                <span className="factor-icon">⏱</span>
                <span className="factor-label">Response Time ↑</span>
              </div>
              <div className={`factor-item ${burnout.message_volume_increasing ? 'active' : ''}`}>
                <span className="factor-icon">📊</span>
                <span className="factor-label">Message Volume ↑</span>
              </div>
              <div className={`factor-item ${burnout.sentiment_declining ? 'active' : ''}`}>
                <span className="factor-icon">😟</span>
                <span className="factor-label">Sentiment ↓</span>
              </div>
              <div className={`factor-item ${burnout.working_hours_extending ? 'active' : ''}`}>
                <span className="factor-icon">🌙</span>
                <span className="factor-label">Working Hours ↑</span>
              </div>
              <div className={`factor-item ${burnout.weekend_activity_high ? 'active' : ''}`}>
                <span className="factor-icon">📅</span>
                <span className="factor-label">Weekend Activity</span>
              </div>
              <div className={`factor-item ${burnout.response_quality_dropping ? 'active' : ''}`}>
                <span className="factor-icon">✍</span>
                <span className="factor-label">Quality ↓</span>
              </div>
            </div>

            {/* Activity Metrics */}
            <div className="activity-metrics">
              <div className="metric-card glass">
                <span className="metric-label">Messages/Day (7d)</span>
                <span className="metric-value">{burnout.messages_per_day_7d?.toFixed(1) || 'N/A'}</span>
              </div>
              <div className="metric-card glass">
                <span className="metric-label">Messages/Day (30d)</span>
                <span className="metric-value">{burnout.messages_per_day_30d?.toFixed(1) || 'N/A'}</span>
              </div>
              <div className="metric-card glass">
                <span className="metric-label">Avg Response (7d)</span>
                <span className="metric-value">
                  {burnout.avg_response_time_7d ? `${(burnout.avg_response_time_7d / 60).toFixed(1)}h` : 'N/A'}
                </span>
              </div>
              <div className="metric-card glass">
                <span className="metric-label">Avg Response (30d)</span>
                <span className="metric-value">
                  {burnout.avg_response_time_30d ? `${(burnout.avg_response_time_30d / 60).toFixed(1)}h` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Recommendations */}
            {burnout.recommended_actions.length > 0 && (
              <div className="panel glass recommendations-panel">
                <h4 className="rec-title">
                  <span className="rec-icon">💡</span>
                  Recommended Actions
                </h4>
                <ul className="recommendations-list">
                  {burnout.recommended_actions.map((action, i) => (
                    <li key={i} className="rec-item">
                      <span className="rec-bullet">◆</span>
                      <span className="rec-text">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Predictions Section */}
      <section className="predictions-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="title-icon">🔮</span>
            AI Predictions
          </h2>

          {/* Filter Tabs */}
          <nav className="filter-tabs inline">
            {[
              { id: 'all', label: 'All Predictions' },
              { id: 'churn_risk', label: 'Churn Risk' },
              { id: 'optimal_timing', label: 'Optimal Timing' },
              { id: 'engagement_forecast', label: 'Engagement' },
            ].map(filter => (
              <button
                key={filter.id}
                className={`filter-tab ${filterMode === filter.id ? 'active' : ''}`}
                onClick={() => setFilterMode(filter.id as PredictionFilter)}
              >
                {filter.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Predictions Grid */}
        {predictions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔮</div>
            <h3>No Predictions Available</h3>
            <p>AI predictions will appear here once data is analyzed</p>
          </div>
        ) : (
          <div className="predictions-grid">
            {predictions.map((prediction, i) => (
              <div
                key={prediction.id}
                className={`prediction-card glass ${expandedPrediction === prediction.id ? 'expanded' : ''}`}
                style={{
                  '--delay': `${i * 0.03}s`,
                  '--confidence-color': getConfidenceColor(prediction.confidence_level),
                } as React.CSSProperties}
              >
                {/* Card Header */}
                <div
                  className="pred-header"
                  onClick={() => setExpandedPrediction(
                    expandedPrediction === prediction.id ? null : prediction.id
                  )}
                >
                  <span className="pred-icon">{getPredictionIcon(prediction.prediction_type)}</span>
                  <div className="pred-info">
                    <h4 className="pred-type">
                      {prediction.prediction_type.replace(/_/g, ' ')}
                    </h4>
                    <div className="pred-meta">
                      <span className="meta-subject">{prediction.subject_type}</span>
                      {prediction.subject_identifier && (
                        <>
                          <span className="meta-divider">•</span>
                          <span className="meta-identifier">{prediction.subject_identifier}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button className="expand-btn" aria-label="Expand details">
                    <span className="expand-icon">
                      {expandedPrediction === prediction.id ? '−' : '+'}
                    </span>
                  </button>
                </div>

                {/* Prediction Value & Label */}
                <div className="pred-result">
                  {prediction.prediction_value !== null && (
                    <div className="result-value">
                      <span className="value-number">{(prediction.prediction_value * 100).toFixed(0)}%</span>
                      {prediction.prediction_label && (
                        <span className="value-label">{prediction.prediction_label}</span>
                      )}
                    </div>
                  )}

                  {/* Confidence Meter */}
                  {prediction.confidence_level !== null && (
                    <div className="confidence-meter">
                      <span className="conf-label">Confidence</span>
                      <div className="conf-bar">
                        <div
                          className="conf-fill"
                          style={{
                            width: `${prediction.confidence_level * 100}%`,
                            background: getConfidenceColor(prediction.confidence_level),
                          }}
                        />
                      </div>
                      <span className="conf-value">{(prediction.confidence_level * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <div className="pred-timestamps">
                  <span className="timestamp-item">
                    Predicted {formatTimeAgo(prediction.predicted_at)}
                  </span>
                  {prediction.valid_until && (
                    <>
                      <span className="timestamp-divider">•</span>
                      <span className="timestamp-item valid">
                        Valid: {formatValidUntil(prediction.valid_until)}
                      </span>
                    </>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedPrediction === prediction.id && (
                  <div className="pred-details">
                    {/* Contributing Factors */}
                    {Object.keys(prediction.factors).length > 0 && (
                      <div className="factors-section">
                        <h5 className="section-label">Contributing Factors</h5>
                        <div className="factors-list">
                          {Object.entries(prediction.factors).map(([key, value], idx) => (
                            <div key={idx} className="factor-row">
                              <span className="factor-key">{key.replace(/_/g, ' ')}</span>
                              <span className="factor-value">
                                {typeof value === 'number' ? value.toFixed(2) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {prediction.recommendations.length > 0 && (
                      <div className="pred-recommendations">
                        <h5 className="section-label">Recommendations</h5>
                        <ul className="pred-rec-list">
                          {prediction.recommendations.map((rec, idx) => (
                            <li key={idx} className="pred-rec-item">
                              <span className="rec-bullet">→</span>
                              <span className="rec-text">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Outcome Tracking */}
                    {prediction.outcome_tracked && prediction.actual_outcome && (
                      <div className="outcome-section">
                        <h5 className="section-label">Actual Outcome</h5>
                        <div className="outcome-result">
                          <span className="outcome-text">{prediction.actual_outcome}</span>
                          {prediction.prediction_accuracy !== null && (
                            <span className="accuracy-badge">
                              {(prediction.prediction_accuracy * 100).toFixed(0)}% accurate
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PredictionsView;

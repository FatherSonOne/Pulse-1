/**
 * Relationships View - Relationship Health Tracker
 * Part of Observatory Analytics Dashboard
 */

import React, { useState, useEffect } from 'react';
import {
  getAllRelationshipHealth,
  getRelationshipHealthSummary,
  RelationshipHealth,
  RelationshipHealthSummary,
} from '../../services/relationshipHealthService';

interface RelationshipsViewProps {
  timeRange: string;
}

type FilterMode = 'all' | 'active' | 'at_risk' | 'dormant';

export const RelationshipsView: React.FC<RelationshipsViewProps> = ({ timeRange }) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RelationshipHealthSummary | null>(null);
  const [relationships, setRelationships] = useState<RelationshipHealth[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    const [summaryResult, relationshipsResult] = await Promise.all([
      getRelationshipHealthSummary(),
      getAllRelationshipHealth(),
    ]);

    if (summaryResult.success) setSummary(summaryResult.data!);
    if (relationshipsResult.success) setRelationships(relationshipsResult.data!);

    setLoading(false);
  };

  const getHealthColor = (status: string): string => {
    switch (status) {
      case 'active': return 'var(--accent-positive)';
      case 'warming': return 'var(--accent-info)';
      case 'cooling': return 'var(--accent-warning)';
      case 'at_risk': return 'var(--accent-negative)';
      case 'dormant': return 'rgba(255,255,255,0.3)';
      default: return 'var(--accent-neutral)';
    }
  };

  const getHealthIcon = (status: string): string => {
    switch (status) {
      case 'active': return '◉';
      case 'warming': return '◎';
      case 'cooling': return '◯';
      case 'at_risk': return '△';
      case 'dormant': return '◇';
      default: return '○';
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '↗';
      case 'declining': return '↘';
      default: return '→';
    }
  };

  const getFrequencyLabel = (freq: string | null): string => {
    if (!freq) return 'Unknown';
    return freq.charAt(0).toUpperCase() + freq.slice(1);
  };

  const formatDaysAgo = (days: number | null): string => {
    if (days === null) return 'Never';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const filteredRelationships = relationships.filter(rel => {
    if (filterMode === 'all') return true;
    return rel.health_status === filterMode;
  });

  if (loading) {
    return (
      <div className="observatory-loading">
        <div className="loading-orb">
          <div className="orb-core" />
          <div className="orb-ring ring-1" />
          <div className="orb-ring ring-2" />
          <div className="orb-ring ring-3" />
        </div>
        <p className="loading-text">Analyzing relationship patterns...</p>
      </div>
    );
  }

  return (
    <div className="view-relationships">
      {/* Summary Hero */}
      <section className="relationships-hero">
        <div className="hero-stats">
          <div className="stat-orb primary">
            <div className="orb-glow" />
            <div className="orb-content">
              <span className="metric-value">{summary?.avg_health_score.toFixed(0) || 0}</span>
              <span className="metric-unit">/ 100</span>
            </div>
            <span className="metric-label">Avg Health Score</span>
          </div>

          <div className="stat-satellites">
            <div className="stat-card glass">
              <div className="card-accent" />
              <span className="metric-value">{summary?.total_relationships || 0}</span>
              <span className="metric-label">Relationships</span>
            </div>

            <div className="stat-card glass accent-positive">
              <div className="card-accent" style={{ background: 'var(--accent-positive)' }} />
              <span className="metric-value">{summary?.active_count || 0}</span>
              <span className="metric-label">Active</span>
            </div>

            <div className="stat-card glass accent-warning">
              <div className="card-accent" style={{ background: 'var(--accent-warning)' }} />
              <span className="metric-value">{summary?.at_risk_count || 0}</span>
              <span className="metric-label">At Risk</span>
            </div>

            <div className="stat-card glass accent-neutral">
              <div className="card-accent" style={{ background: 'rgba(255,255,255,0.3)' }} />
              <span className="metric-value">{summary?.dormant_count || 0}</span>
              <span className="metric-label">Dormant</span>
            </div>
          </div>
        </div>

        {/* Trend Indicators */}
        <div className="panel glass trend-panel">
          <div className="trend-item trend-up">
            <span className="trend-icon">↗</span>
            <span className="trend-value">{summary?.trending_up || 0}</span>
            <span className="trend-label">Improving</span>
          </div>
          <div className="trend-divider" />
          <div className="trend-item trend-down">
            <span className="trend-icon">↘</span>
            <span className="trend-value">{summary?.trending_down || 0}</span>
            <span className="trend-label">Declining</span>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <nav className="filter-tabs">
        {[
          { id: 'all', label: 'All', count: relationships.length },
          { id: 'active', label: 'Active', count: summary?.active_count || 0 },
          { id: 'at_risk', label: 'At Risk', count: summary?.at_risk_count || 0 },
          { id: 'dormant', label: 'Dormant', count: summary?.dormant_count || 0 },
        ].map(filter => (
          <button
            key={filter.id}
            className={`filter-tab ${filterMode === filter.id ? 'active' : ''}`}
            onClick={() => setFilterMode(filter.id as FilterMode)}
          >
            <span className="tab-label">{filter.label}</span>
            <span className="tab-badge">{filter.count}</span>
          </button>
        ))}
      </nav>

      {/* Relationship Cards Grid */}
      {filteredRelationships.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◇</div>
          <h3>No Relationships Found</h3>
          <p>Start messaging to build relationship analytics</p>
        </div>
      ) : (
        <div className="relationships-grid">
          {filteredRelationships.map((rel, i) => (
            <div
              key={rel.id}
              className={`relationship-card glass ${hoveredCard === rel.id ? 'hovered' : ''}`}
              style={{
                '--delay': `${i * 0.03}s`,
                '--health-color': getHealthColor(rel.health_status),
              } as React.CSSProperties}
              onMouseEnter={() => setHoveredCard(rel.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Card Header */}
              <div className="card-header">
                <div className="contact-avatar">
                  {(rel.contact_name || rel.contact_identifier).charAt(0).toUpperCase()}
                </div>
                <div className="contact-info">
                  <h4 className="contact-name">
                    {rel.contact_name || rel.contact_identifier}
                  </h4>
                  <span className="contact-frequency">
                    {getFrequencyLabel(rel.interaction_frequency)} contact
                  </span>
                </div>
                <div className="health-badge" style={{ color: getHealthColor(rel.health_status) }}>
                  <span className="health-icon">{getHealthIcon(rel.health_status)}</span>
                </div>
              </div>

              {/* Health Score Meter */}
              <div className="health-meter">
                <div className="meter-track">
                  <div
                    className="meter-fill"
                    style={{
                      width: `${rel.health_score}%`,
                      background: getHealthColor(rel.health_status),
                    }}
                  />
                  <div
                    className="meter-glow"
                    style={{
                      width: `${rel.health_score}%`,
                      background: getHealthColor(rel.health_status),
                    }}
                  />
                </div>
                <div className="meter-labels">
                  <span className="meter-score">{rel.health_score.toFixed(0)}</span>
                  <span className="meter-status">{rel.health_status.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="card-stats">
                <div className="stat-item">
                  <span className="stat-label">Messages (30d)</span>
                  <span className="stat-value">{rel.message_count_30d}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Last Contact</span>
                  <span className="stat-value">{formatDaysAgo(rel.days_since_last_message)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Sentiment</span>
                  <span className="stat-value trend">
                    {getTrendIcon(rel.sentiment_trend)} {rel.sentiment_trend}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Longest Gap</span>
                  <span className="stat-value">{rel.longest_gap_days || 0}d</span>
                </div>
              </div>

              {/* At Risk Warning */}
              {rel.intervention_suggested && rel.at_risk_reason.length > 0 && (
                <div className="risk-alert">
                  <span className="alert-icon">△</span>
                  <div className="alert-content">
                    <span className="alert-title">Attention Needed</span>
                    <span className="alert-reasons">
                      {rel.at_risk_reason.map(reason => reason.replace('_', ' ')).join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Intervention Message */}
              {rel.intervention_message && (
                <div className="intervention-tip">
                  <span className="tip-icon">◇</span>
                  <p className="tip-text">{rel.intervention_message}</p>
                </div>
              )}

              {/* Reciprocity Indicator */}
              {rel.response_reciprocity_score !== null && (
                <div className="reciprocity-bar">
                  <span className="reciprocity-label">Reciprocity Balance</span>
                  <div className="reciprocity-track">
                    <div
                      className="reciprocity-fill"
                      style={{ width: `${rel.response_reciprocity_score}%` }}
                    />
                  </div>
                  <span className="reciprocity-value">{rel.response_reciprocity_score.toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RelationshipsView;

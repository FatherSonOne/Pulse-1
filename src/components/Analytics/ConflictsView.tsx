/**
 * Conflicts View - Conflict Detection Dashboard
 * Part of Observatory Analytics Dashboard
 */

import React, { useState, useEffect } from 'react';
import {
  getActiveConflicts,
  getAllConflicts,
  getConflictSummary,
  getHotTopics,
  resolveConflict,
  ConflictTracking,
  ConflictSummary,
  HotTopic,
} from '../../services/conflictDetectionService';

interface ConflictsViewProps {
  timeRange: string;
}

type ConflictFilter = 'all' | 'active' | 'resolved' | 'unresolved';

export const ConflictsView: React.FC<ConflictsViewProps> = ({ timeRange }) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ConflictSummary | null>(null);
  const [conflicts, setConflicts] = useState<ConflictTracking[]>([]);
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
  const [filterMode, setFilterMode] = useState<ConflictFilter>('active');
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [timeRange, filterMode]);

  const loadData = async () => {
    setLoading(true);
    const [summaryResult, conflictsResult, hotTopicsResult] = await Promise.all([
      getConflictSummary(),
      filterMode === 'all'
        ? getAllConflicts(undefined, 50)
        : filterMode === 'active'
        ? getActiveConflicts()
        : getAllConflicts(filterMode, 50),
      getHotTopics(),
    ]);

    if (summaryResult.success) setSummary(summaryResult.data!);
    if (conflictsResult.success) setConflicts(conflictsResult.data!);
    if (hotTopicsResult.success) setHotTopics(hotTopicsResult.data!);

    setLoading(false);
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'var(--accent-negative)';
      case 'high': return 'var(--accent-warning)';
      case 'medium': return 'var(--accent-info)';
      case 'low': return 'var(--accent-neutral)';
      default: return 'rgba(255,255,255,0.5)';
    }
  };

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'critical': return '▲';
      case 'high': return '△';
      case 'medium': return '◇';
      case 'low': return '◦';
      default: return '○';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'active': return '◉';
      case 'resolving': return '◎';
      case 'resolved': return '◯';
      case 'unresolved': return '◇';
      default: return '○';
    }
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

  const formatDuration = (hours: number | null): string => {
    if (!hours) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  const handleResolveConflict = async (conflictId: string) => {
    const result = await resolveConflict(conflictId, 'manual_resolution');
    if (result.success) {
      loadData(); // Reload data
    }
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
        <p className="loading-text">Analyzing conflict patterns...</p>
      </div>
    );
  }

  return (
    <div className="view-conflicts">
      {/* Summary Hero */}
      <section className="conflicts-hero">
        <div className="hero-primary">
          <div className="conflict-status-orb">
            <div
              className="orb-glow"
              style={{
                '--glow-color': summary?.active_conflicts === 0
                  ? 'var(--accent-positive)'
                  : 'var(--accent-warning)'
              } as React.CSSProperties}
            />
            <div className="orb-content">
              <span className="metric-value">{summary?.conflict_free_days || 0}</span>
              <span className="metric-unit">days</span>
            </div>
            <span className="metric-label">Conflict Free</span>
          </div>

          <div className="hero-stats">
            <div className="stat-card glass accent-negative">
              <div className="card-accent" style={{ background: 'var(--accent-negative)' }} />
              <span className="metric-value">{summary?.active_conflicts || 0}</span>
              <span className="metric-label">Active Conflicts</span>
            </div>

            <div className="stat-card glass accent-positive">
              <div className="card-accent" style={{ background: 'var(--accent-positive)' }} />
              <span className="metric-value">{summary?.resolved_last_7d || 0}</span>
              <span className="metric-label">Resolved (7d)</span>
            </div>

            <div className="stat-card glass">
              <div className="card-accent" />
              <span className="metric-value">{formatDuration(summary?.avg_resolution_time_hours || 0)}</span>
              <span className="metric-label">Avg Resolution</span>
            </div>

            <div className="stat-card glass accent-warning">
              <div className="card-accent" style={{ background: 'var(--accent-warning)' }} />
              <span className="metric-value">{summary?.hot_topics_count || 0}</span>
              <span className="metric-label">Hot Topics</span>
            </div>
          </div>
        </div>
      </section>

      <div className="conflicts-layout">
        {/* Left Column: Conflicts List */}
        <div className="conflicts-main">
          {/* Filter Tabs */}
          <nav className="filter-tabs">
            {[
              { id: 'active', label: 'Active', count: summary?.active_conflicts || 0 },
              { id: 'resolved', label: 'Resolved', count: summary?.resolved_last_30d || 0 },
              { id: 'all', label: 'All', count: conflicts.length },
            ].map(filter => (
              <button
                key={filter.id}
                className={`filter-tab ${filterMode === filter.id ? 'active' : ''}`}
                onClick={() => setFilterMode(filter.id as ConflictFilter)}
              >
                <span className="tab-label">{filter.label}</span>
                <span className="tab-badge">{filter.count}</span>
              </button>
            ))}
          </nav>

          {/* Conflicts List */}
          {conflicts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◯</div>
              <h3>No Conflicts Detected</h3>
              <p>All communications are running smoothly</p>
            </div>
          ) : (
            <div className="conflicts-list">
              {conflicts.map((conflict, i) => (
                <div
                  key={conflict.id}
                  className={`conflict-card glass ${expandedConflict === conflict.id ? 'expanded' : ''}`}
                  style={{
                    '--delay': `${i * 0.03}s`,
                    '--severity-color': getSeverityColor(conflict.severity),
                  } as React.CSSProperties}
                >
                  {/* Card Header */}
                  <div
                    className="conflict-header"
                    onClick={() => setExpandedConflict(
                      expandedConflict === conflict.id ? null : conflict.id
                    )}
                  >
                    <div className="severity-indicator">
                      <span
                        className="severity-icon"
                        style={{ color: getSeverityColor(conflict.severity) }}
                      >
                        {getSeverityIcon(conflict.severity)}
                      </span>
                      <span className="severity-label">{conflict.severity}</span>
                    </div>

                    <div className="conflict-info">
                      <h4 className="conflict-contact">{conflict.contact_identifier}</h4>
                      <div className="conflict-meta">
                        <span className="meta-item">
                          {getStatusIcon(conflict.status)} {conflict.status}
                        </span>
                        <span className="meta-divider">•</span>
                        <span className="meta-item">{formatTimeAgo(conflict.first_detected_at)}</span>
                        {conflict.channel && (
                          <>
                            <span className="meta-divider">•</span>
                            <span className="meta-item">{conflict.channel}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button className="expand-btn" aria-label="Expand details">
                      <span className="expand-icon">
                        {expandedConflict === conflict.id ? '−' : '+'}
                      </span>
                    </button>
                  </div>

                  {/* Topic & Type */}
                  {conflict.trigger_topic && (
                    <div className="conflict-topic">
                      <span className="topic-icon">◈</span>
                      <span className="topic-text">{conflict.trigger_topic}</span>
                      {conflict.hot_topic && (
                        <span className="hot-badge">🔥 Hot Topic</span>
                      )}
                    </div>
                  )}

                  {/* Expanded Details */}
                  {expandedConflict === conflict.id && (
                    <div className="conflict-details">
                      {/* Tension Score */}
                      {conflict.tension_score !== null && (
                        <div className="tension-meter">
                          <span className="meter-label">Tension Level</span>
                          <div className="meter-track">
                            <div
                              className="meter-fill"
                              style={{
                                width: `${conflict.tension_score * 100}%`,
                                background: getSeverityColor(conflict.severity),
                              }}
                            />
                          </div>
                          <span className="meter-value">{(conflict.tension_score * 100).toFixed(0)}%</span>
                        </div>
                      )}

                      {/* Keywords */}
                      {conflict.trigger_keywords.length > 0 && (
                        <div className="keywords-section">
                          <span className="section-label">Trigger Keywords:</span>
                          <div className="keywords-list">
                            {conflict.trigger_keywords.map((keyword, idx) => (
                              <span key={idx} className="keyword-tag">{keyword}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Initiated/Escalated By */}
                      <div className="conflict-parties">
                        {conflict.initiated_by && (
                          <div className="party-item">
                            <span className="party-label">Initiated by:</span>
                            <span className="party-name">{conflict.initiated_by}</span>
                          </div>
                        )}
                        {conflict.escalated_by && (
                          <div className="party-item">
                            <span className="party-label">Escalated by:</span>
                            <span className="party-name">{conflict.escalated_by}</span>
                          </div>
                        )}
                      </div>

                      {/* Recurring Warning */}
                      {conflict.is_recurring && (
                        <div className="recurring-alert">
                          <span className="alert-icon">⟳</span>
                          <span className="alert-text">Recurring conflict pattern detected</span>
                        </div>
                      )}

                      {/* Resolution Info */}
                      {conflict.status === 'resolved' && conflict.resolved_at && (
                        <div className="resolution-info">
                          <span className="resolution-icon">✓</span>
                          <div className="resolution-details">
                            <span className="resolution-label">Resolved</span>
                            <span className="resolution-meta">
                              {formatTimeAgo(conflict.resolved_at)} •
                              {formatDuration(conflict.time_to_resolution_hours)} to resolve
                              {conflict.resolution_method && ` • ${conflict.resolution_method}`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      {conflict.status === 'active' && (
                        <button
                          className="resolve-btn"
                          onClick={() => handleResolveConflict(conflict.id)}
                        >
                          Mark as Resolved
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Hot Topics */}
        <aside className="hot-topics-sidebar">
          <div className="panel glass hot-topics-panel">
            <h3 className="panel-title">
              <span className="title-icon">🔥</span>
              Hot Topics
            </h3>

            {hotTopics.length === 0 ? (
              <div className="empty-hot-topics">
                <p>No recurring conflict topics detected</p>
              </div>
            ) : (
              <div className="hot-topics-list">
                {hotTopics.map((topic, i) => (
                  <div
                    key={topic.id}
                    className="hot-topic-card"
                    style={{ '--delay': `${i * 0.05}s` } as React.CSSProperties}
                  >
                    <div className="topic-header">
                      <h4 className="topic-name">{topic.topic}</h4>
                      <span className="topic-count">{topic.conflict_count}x</span>
                    </div>

                    <div className="topic-contact">
                      <span className="contact-label">With:</span>
                      <span className="contact-name">{topic.contact_identifier}</span>
                    </div>

                    {topic.avg_severity !== null && (
                      <div className="topic-severity">
                        <span className="severity-label">Avg Severity:</span>
                        <div className="severity-bar">
                          <div
                            className="severity-fill"
                            style={{
                              width: `${topic.avg_severity * 100}%`,
                              background: getSeverityColor(
                                topic.avg_severity > 0.75 ? 'critical' :
                                topic.avg_severity > 0.5 ? 'high' :
                                topic.avg_severity > 0.25 ? 'medium' : 'low'
                              ),
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {topic.last_conflict_at && (
                      <div className="topic-last">
                        Last occurred: {formatTimeAgo(topic.last_conflict_at)}
                      </div>
                    )}

                    {topic.avoidance_recommended && (
                      <div className="avoidance-badge">
                        ⚠ Avoidance recommended
                      </div>
                    )}

                    {topic.communication_tip && (
                      <div className="communication-tip">
                        <span className="tip-icon">💡</span>
                        <p className="tip-text">{topic.communication_tip}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ConflictsView;

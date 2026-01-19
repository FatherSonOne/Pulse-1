/**
 * Pulse Analytics Dashboard - Observatory Edition
 * Responsive to app's dark mode (Tailwind convention: .dark class on html)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getDashboardData,
  getResponseTimeStats,
  getSentimentOverview,
  getCommunicationTrends,
  getTopContacts,
  generateInsights,
  DashboardData,
  ContactEngagement
} from '../../services/analyticsService';
import './AnalyticsDashboard.css';

interface AnalyticsDashboardProps {
  onClose?: () => void;
}

type TimeRange = '7d' | '30d' | '90d' | '365d';
type ViewMode = 'overview' | 'velocity' | 'sentiment' | 'network';

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onClose }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [responseStats, setResponseStats] = useState<any>(null);
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [topContacts, setTopContacts] = useState<ContactEngagement[]>([]);
  const [insights, setInsights] = useState<any[]>([]);

  const daysFromRange = (range: TimeRange): number => {
    switch (range) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '365d': return 365;
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const days = daysFromRange(timeRange);

    const [dashboard, response, sentiment, trend, contacts, insight] = await Promise.all([
      getDashboardData(days),
      getResponseTimeStats(days),
      getSentimentOverview(days),
      getCommunicationTrends(days),
      getTopContacts(10),
      generateInsights()
    ]);

    if (dashboard.success) setDashboardData(dashboard.data!);
    if (response.success) setResponseStats(response.data);
    if (sentiment.success) setSentimentData(sentiment.data);
    if (trend.success) setTrends(trend.data);
    if (contacts.success) setTopContacts(contacts.data!);
    if (insight.success) setInsights(insight.data!);

    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatNumber = (num: number | null | undefined): string => {
    if (num == null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  const getSentimentGlow = (score: number): string => {
    if (score > 0.2) return 'var(--glow-positive)';
    if (score < -0.2) return 'var(--glow-negative)';
    return 'var(--glow-neutral)';
  };

  const getSentimentLabel = (score: number): string => {
    if (score > 0.2) return 'Positive';
    if (score < -0.2) return 'Negative';
    return 'Neutral';
  };

  const getEngagementTier = (score: number): { label: string; class: string } => {
    if (score >= 80) return { label: 'Elite', class: 'tier-elite' };
    if (score >= 60) return { label: 'Active', class: 'tier-active' };
    if (score >= 40) return { label: 'Moderate', class: 'tier-moderate' };
    return { label: 'Low', class: 'tier-low' };
  };

  // Calculate pulse rate (messages per day)
  const pulseRate = dashboardData
    ? (dashboardData.total_messages / daysFromRange(timeRange)).toFixed(1)
    : '0';

  return (
    <div className="pulse-observatory">
      {/* Ambient Background */}
      <div className="observatory-bg">
        <div className="grid-overlay" />
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="scan-line" />
      </div>

      {/* Header Command Bar */}
      <header className="command-bar">
        <div className="command-left">
          <div className="observatory-brand">
            <div className="pulse-indicator">
              <span className="pulse-dot" />
              <span className="pulse-ring" />
            </div>
            <div className="brand-text">
              <h1>Observatory</h1>
              <span className="brand-sub">Communication Intelligence</span>
            </div>
          </div>
        </div>

        <nav className="view-switcher">
          {[
            { id: 'overview', label: 'Overview', icon: '◉' },
            { id: 'velocity', label: 'Velocity', icon: '⚡' },
            { id: 'sentiment', label: 'Sentiment', icon: '◐' },
            { id: 'network', label: 'Network', icon: '⬡' },
          ].map(view => (
            <button
              key={view.id}
              className={`view-btn ${viewMode === view.id ? 'active' : ''}`}
              onClick={() => setViewMode(view.id as ViewMode)}
            >
              <span className="view-icon">{view.icon}</span>
              <span className="view-label">{view.label}</span>
            </button>
          ))}
        </nav>

        <div className="command-right">
          <div className="time-capsule">
            {(['7d', '30d', '90d', '365d'] as TimeRange[]).map(range => (
              <button
                key={range}
                className={`capsule-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range === '365d' ? '1Y' : range.toUpperCase()}
              </button>
            ))}
          </div>
          {onClose && (
            <button className="close-observatory" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="observatory-loading">
          <div className="loading-orb">
            <div className="orb-core" />
            <div className="orb-ring ring-1" />
            <div className="orb-ring ring-2" />
            <div className="orb-ring ring-3" />
          </div>
          <p className="loading-text">Scanning communication patterns...</p>
        </div>
      ) : (
        <main className="observatory-main">
          {/* Insights Ticker */}
          {insights.length > 0 && (
            <div className="insights-ticker">
              <div className="ticker-track">
                {insights.map((insight, i) => (
                  <div key={i} className={`ticker-item ticker-${insight.type}`}>
                    <span className="ticker-icon">
                      {insight.type === 'achievement' && '★'}
                      {insight.type === 'warning' && '△'}
                      {insight.type === 'suggestion' && '◇'}
                      {insight.type === 'info' && '○'}
                    </span>
                    <span className="ticker-title">{insight.title}</span>
                    <span className="ticker-desc">{insight.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overview View */}
          {viewMode === 'overview' && dashboardData && (
            <div className="view-overview">
              {/* Hero Metrics */}
              <section className="hero-metrics">
                <div
                  className={`metric-orb primary ${hoveredMetric === 'pulse' ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredMetric('pulse')}
                  onMouseLeave={() => setHoveredMetric(null)}
                >
                  <div className="orb-glow" />
                  <div className="orb-content">
                    <span className="metric-value">{pulseRate}</span>
                    <span className="metric-unit">/ day</span>
                  </div>
                  <span className="metric-label">Pulse Rate</span>
                </div>

                <div className="metric-satellites">
                  <div
                    className={`metric-card glass ${hoveredMetric === 'total' ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoveredMetric('total')}
                    onMouseLeave={() => setHoveredMetric(null)}
                  >
                    <div className="card-accent" />
                    <span className="metric-value">{formatNumber(dashboardData.total_messages)}</span>
                    <span className="metric-label">Total Messages</span>
                    <div className="metric-split">
                      <span className="split-sent">{formatNumber(dashboardData.messages_sent)} out</span>
                      <span className="split-divider">|</span>
                      <span className="split-received">{formatNumber(dashboardData.messages_received)} in</span>
                    </div>
                  </div>

                  <div
                    className={`metric-card glass ${hoveredMetric === 'response' ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoveredMetric('response')}
                    onMouseLeave={() => setHoveredMetric(null)}
                  >
                    <div className="card-accent accent-velocity" />
                    <span className="metric-value">{formatDuration(dashboardData.avg_response_time)}</span>
                    <span className="metric-label">Avg Response</span>
                  </div>

                  <div
                    className={`metric-card glass ${hoveredMetric === 'sentiment' ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoveredMetric('sentiment')}
                    onMouseLeave={() => setHoveredMetric(null)}
                    style={{ '--glow-color': getSentimentGlow(dashboardData.avg_sentiment) } as React.CSSProperties}
                  >
                    <div className="card-accent accent-sentiment" />
                    <span className="metric-value">{getSentimentLabel(dashboardData.avg_sentiment)}</span>
                    <span className="metric-label">Mood Signal</span>
                  </div>

                  <div
                    className={`metric-card glass ${hoveredMetric === 'contacts' ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoveredMetric('contacts')}
                    onMouseLeave={() => setHoveredMetric(null)}
                  >
                    <div className="card-accent accent-network" />
                    <span className="metric-value">{topContacts.length}</span>
                    <span className="metric-label">Active Nodes</span>
                  </div>
                </div>
              </section>

              {/* Channel Distribution */}
              <section className="panel glass channel-panel">
                <h3 className="panel-title">
                  <span className="title-icon">◈</span>
                  Channel Flow
                </h3>
                <div className="channel-flow">
                  {Object.entries(dashboardData.channel_breakdown)
                    .filter(([channel]) => channel !== 'sms' && channel !== 'slack')
                    .map(([channel, count]) => {
                      const safeCount = count ?? 0;
                      const total = Object.entries(dashboardData.channel_breakdown)
                        .filter(([ch]) => ch !== 'sms' && ch !== 'slack')
                        .reduce((a, [, b]) => a + (b ?? 0), 0);
                      const percent = total > 0 ? (safeCount / total) * 100 : 0;
                      const channelLabels: Record<string, string> = {
                        email: 'Email',
                        pulse: 'Messages',
                        voxer: 'Voxer'
                      };
                      return (
                        <div key={channel} className={`channel-row channel-${channel}`}>
                          <div className="channel-header">
                            <span className="channel-icon">
                              {channel === 'email' && '✉'}
                              {channel === 'pulse' && '◉'}
                              {channel === 'voxer' && '◎'}
                            </span>
                            <span className="channel-name">{channelLabels[channel] || channel}</span>
                            <span className="channel-stat">{formatNumber(safeCount)}</span>
                          </div>
                          <div className="channel-bar-track">
                            <div
                              className="channel-bar-fill"
                              style={{ width: `${percent}%` }}
                            />
                            <div className="channel-bar-glow" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="channel-percent">{percent.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                </div>
              </section>

              {/* Activity Waveform */}
              {dashboardData.daily_activity.length > 0 && (
                <section className="panel glass activity-panel">
                  <h3 className="panel-title">
                    <span className="title-icon">∿</span>
                    Activity Waveform
                  </h3>
                  <div className="waveform-container">
                    <div className="waveform">
                      {dashboardData.daily_activity.slice(-21).map((day, i) => {
                        const maxValue = Math.max(
                          ...dashboardData.daily_activity.slice(-21).map(d => d.sent + d.received),
                          1
                        );
                        const height = ((day.sent + day.received) / maxValue) * 100;
                        const sentRatio = (day.sent + day.received) > 0
                          ? (day.sent / (day.sent + day.received)) * 100
                          : 50;
                        return (
                          <div
                            key={i}
                            className="wave-bar"
                            style={{
                              '--height': `${height}%`,
                              '--delay': `${i * 0.03}s`,
                              '--sent-ratio': `${sentRatio}%`
                            } as React.CSSProperties}
                            title={`${day.date}: ${day.sent + day.received} messages`}
                          >
                            <div className="bar-fill">
                              <div className="bar-sent" />
                              <div className="bar-received" />
                            </div>
                            <div className="bar-glow" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="waveform-legend">
                      <span className="legend-item"><span className="legend-dot sent" /> Outbound</span>
                      <span className="legend-item"><span className="legend-dot received" /> Inbound</span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Velocity View */}
          {viewMode === 'velocity' && responseStats && (
            <div className="view-velocity">
              <section className="velocity-hero">
                <div className="speedometer">
                  <svg viewBox="0 0 200 120" className="speed-gauge">
                    <defs>
                      <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--accent-positive)" />
                        <stop offset="50%" stopColor="var(--accent-warning)" />
                        <stop offset="100%" stopColor="var(--accent-negative)" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 20 100 A 80 80 0 0 1 180 100"
                      fill="none"
                      stroke="url(#speedGradient)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray="251"
                      strokeDashoffset={251 - (Math.min(responseStats.avgResponseTime / 1440, 1) * 251)}
                      className="speed-arc"
                    />
                  </svg>
                  <div className="speed-value">
                    <span className="value">{formatDuration(responseStats.avgResponseTime)}</span>
                    <span className="label">Average Response</span>
                  </div>
                </div>

                <div className="velocity-stats">
                  <div className="stat-card glass stat-fast">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-value">{formatDuration(responseStats.fastestResponse)}</span>
                    <span className="stat-label">Fastest</span>
                  </div>
                  <div className="stat-card glass stat-slow">
                    <span className="stat-icon">◔</span>
                    <span className="stat-value">{formatDuration(responseStats.slowestResponse)}</span>
                    <span className="stat-label">Slowest</span>
                  </div>
                </div>
              </section>

              <section className="panel glass distribution-panel">
                <h3 className="panel-title">
                  <span className="title-icon">▦</span>
                  Response Distribution
                </h3>
                <div className="distribution-bars">
                  {[
                    { label: 'Within 1 hour', count: responseStats.within1h, class: 'fast' },
                    { label: '1-24 hours', count: responseStats.within24h, class: 'medium' },
                    { label: 'Over 24 hours', count: responseStats.after24h, class: 'slow' },
                  ].map((bucket, i) => {
                    const total = responseStats.within1h + responseStats.within24h + responseStats.after24h || 1;
                    const percent = (bucket.count / total) * 100;
                    return (
                      <div key={i} className={`distribution-row ${bucket.class}`}>
                        <span className="dist-label">{bucket.label}</span>
                        <div className="dist-bar-track">
                          <div
                            className="dist-bar-fill"
                            style={{ width: `${percent}%`, '--delay': `${i * 0.1}s` } as React.CSSProperties}
                          />
                        </div>
                        <span className="dist-count">{bucket.count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {Object.keys(responseStats.byChannel).length > 0 && (
                <section className="panel glass channel-velocity-panel">
                  <h3 className="panel-title">
                    <span className="title-icon">◫</span>
                    By Channel
                  </h3>
                  <div className="channel-velocity-grid">
                    {Object.entries(responseStats.byChannel).map(([channel, avgTime]) => (
                      <div key={channel} className="channel-velocity-card">
                        <span className="cv-channel">{channel}</span>
                        <span className="cv-time">{formatDuration(avgTime as number)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Sentiment View */}
          {viewMode === 'sentiment' && sentimentData && (
            <div className="view-sentiment">
              <section className="sentiment-hero">
                <div className="mood-orb" style={{ '--mood-glow': getSentimentGlow(sentimentData.avgSentiment) } as React.CSSProperties}>
                  <div className="mood-core">
                    <span className="mood-label">{getSentimentLabel(sentimentData.avgSentiment)}</span>
                    <span className="mood-trend">
                      {sentimentData.sentimentTrend === 'improving' && '↗ Rising'}
                      {sentimentData.sentimentTrend === 'declining' && '↘ Falling'}
                      {sentimentData.sentimentTrend === 'stable' && '→ Steady'}
                    </span>
                  </div>
                  <div className="mood-ring ring-1" />
                  <div className="mood-ring ring-2" />
                </div>
              </section>

              <section className="panel glass breakdown-panel">
                <h3 className="panel-title">
                  <span className="title-icon">◐</span>
                  Sentiment Spectrum
                </h3>
                <div className="sentiment-spectrum">
                  <div
                    className="spectrum-segment positive"
                    style={{ flex: sentimentData.positivePercent }}
                  >
                    <span className="segment-value">{sentimentData.positivePercent.toFixed(0)}%</span>
                  </div>
                  <div
                    className="spectrum-segment neutral"
                    style={{ flex: sentimentData.neutralPercent }}
                  >
                    <span className="segment-value">{sentimentData.neutralPercent.toFixed(0)}%</span>
                  </div>
                  <div
                    className="spectrum-segment negative"
                    style={{ flex: sentimentData.negativePercent }}
                  >
                    <span className="segment-value">{sentimentData.negativePercent.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="spectrum-labels">
                  <span className="label-positive">Positive</span>
                  <span className="label-neutral">Neutral</span>
                  <span className="label-negative">Negative</span>
                </div>
              </section>

              {sentimentData.dailySentiment.length > 0 && (
                <section className="panel glass timeline-panel">
                  <h3 className="panel-title">
                    <span className="title-icon">◦◦◦</span>
                    Mood Timeline
                  </h3>
                  <div className="mood-timeline">
                    {sentimentData.dailySentiment.slice(-21).map((day: any, i: number) => (
                      <div
                        key={i}
                        className="timeline-node"
                        style={{ '--delay': `${i * 0.02}s` } as React.CSSProperties}
                        title={`${day.date}: ${getSentimentLabel(day.sentiment)}`}
                      >
                        <div
                          className="node-dot"
                          style={{ '--node-color': getSentimentGlow(day.sentiment) } as React.CSSProperties}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Network View */}
          {viewMode === 'network' && (
            <div className="view-network">
              <section className="network-header">
                <h2 className="network-title">Contact Network</h2>
                <p className="network-subtitle">Your most engaged connections, ranked by interaction strength</p>
              </section>

              {topContacts.length === 0 ? (
                <div className="empty-network">
                  <div className="empty-icon">⬡</div>
                  <h3>No Network Data</h3>
                  <p>Start messaging to build your connection graph</p>
                </div>
              ) : (
                <div className="contact-grid">
                  {topContacts.map((contact, i) => {
                    const tier = getEngagementTier(contact.engagement_score);
                    return (
                      <div
                        key={contact.id}
                        className={`contact-node glass ${tier.class}`}
                        style={{ '--delay': `${i * 0.05}s` } as React.CSSProperties}
                      >
                        <div className="node-rank">#{i + 1}</div>
                        <div className="node-avatar">
                          {(contact.contact_name || contact.contact_identifier).charAt(0).toUpperCase()}
                        </div>
                        <div className="node-info">
                          <span className="node-name">
                            {contact.contact_name || contact.contact_identifier}
                          </span>
                          <span className="node-channel">
                            {contact.preferred_channel || 'Multi-channel'}
                          </span>
                        </div>
                        <div className="node-stats">
                          <div className="engagement-ring">
                            <svg viewBox="0 0 36 36">
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="3"
                              />
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={`${contact.engagement_score} 100`}
                                transform="rotate(-90 18 18)"
                                className="engagement-arc"
                              />
                            </svg>
                            <span className="engagement-value">{Math.round(contact.engagement_score)}</span>
                          </div>
                          <span className={`engagement-trend trend-${contact.engagement_trend}`}>
                            {contact.engagement_trend === 'rising' && '↗'}
                            {contact.engagement_trend === 'falling' && '↘'}
                            {contact.engagement_trend === 'stable' && '→'}
                          </span>
                        </div>
                        <div className="node-messages">
                          {contact.total_messages_sent + contact.total_messages_received} msgs
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default AnalyticsDashboard;

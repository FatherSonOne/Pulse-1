/**
 * Kudos View - Recognition & Kudos Feed
 * Part of Observatory Analytics Dashboard
 */

import React, { useState, useEffect } from 'react';
import { formatTimeAgo } from '../../utils/dateUtils';
import {
  getAllRecognitionEvents,
  getRecognitionOverview,
  getAllWins,
  RecognitionEvent,
  RecognitionOverview,
  WinsTracker,
} from '../../services/recognitionService';
import { AnimatedIcon } from '../ui/AnimatedIcon';

interface KudosViewProps {
  timeRange: string;
}

type FeedFilter = 'all' | 'received' | 'given';

export const KudosView: React.FC<KudosViewProps> = ({ timeRange }) => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<RecognitionOverview | null>(null);
  const [events, setEvents] = useState<RecognitionEvent[]>([]);
  const [wins, setWins] = useState<WinsTracker[]>([]);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [timeRange, feedFilter]);

  const loadData = async () => {
    setLoading(true);
    const [overviewResult, eventsResult, winsResult] = await Promise.all([
      getRecognitionOverview(),
      feedFilter === 'all'
        ? getAllRecognitionEvents(undefined, 50)
        : getAllRecognitionEvents(feedFilter as 'received' | 'given', 50),
      getAllWins(10),
    ]);

    if (overviewResult.success) setOverview(overviewResult.data!);
    if (eventsResult.success) setEvents(eventsResult.data!);
    if (winsResult.success) setWins(winsResult.data!);

    setLoading(false);
  };

  const getEventIconKey = (eventType: string): string => {
    switch (eventType) {
      case 'kudos': return 'star';
      case 'appreciation': return 'star';
      case 'praise': return 'people';
      case 'thank_you': return 'check';
      case 'celebration': return 'sparkle';
      case 'win': return 'trophy';
      default: return 'sparkle';
    }
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'high': return 'var(--accent-positive)';
      case 'medium': return 'var(--accent-info)';
      case 'low': return 'var(--accent-neutral)';
      default: return 'rgba(255,255,255,0.5)';
    }
  };

  const getDirectionLabel = (direction: string): string => {
    switch (direction) {
      case 'received': return 'From';
      case 'given': return 'To';
      case 'self': return 'Personal';
      default: return '';
    }
  };

  // formatTimeAgo imported from ../../utils/dateUtils

  if (loading) {
    return (
      <div className="observatory-loading">
        <div className="loading-orb">
          <div className="orb-core" />
          <div className="orb-ring ring-1" />
          <div className="orb-ring ring-2" />
          <div className="orb-ring ring-3" />
        </div>
        <p className="loading-text">Loading recognition data...</p>
      </div>
    );
  }

  return (
    <div className="view-kudos">
      {/* Hero Stats */}
      <section className="kudos-hero">
        <div className="hero-orbs">
          <div className="stat-orb received">
            <div className="orb-glow" style={{ '--glow-color': 'var(--accent-positive)' } as React.CSSProperties} />
            <div className="orb-content">
              <span className="orb-icon"><AnimatedIcon icon="star" size={24} /></span>
              <span className="metric-value">{overview?.total_received || 0}</span>
            </div>
            <span className="metric-label">Kudos Received</span>
          </div>

          <div className="stat-orb given">
            <div className="orb-glow" style={{ '--glow-color': 'var(--accent-info)' } as React.CSSProperties} />
            <div className="orb-content">
              <span className="orb-icon"><AnimatedIcon icon="star" size={24} /></span>
              <span className="metric-value">{overview?.total_given || 0}</span>
            </div>
            <span className="metric-label">Kudos Given</span>
          </div>

          <div className="stat-orb wins">
            <div className="orb-glow" style={{ '--glow-color': 'var(--accent-warning)' } as React.CSSProperties} />
            <div className="orb-content">
              <span className="orb-icon"><AnimatedIcon icon="trophy" size={24} /></span>
              <span className="metric-value">{overview?.total_wins || 0}</span>
            </div>
            <span className="metric-label">Wins Tracked</span>
          </div>
        </div>

        {/* Appreciation Score */}
        <div className="panel glass appreciation-panel">
          <h3 className="panel-title">
            <span className="title-icon">◈</span>
            Appreciation Score
          </h3>
          <div className="appreciation-meter">
            <div className="meter-ring">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--accent-positive)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(overview?.avg_appreciation_score || 0) * 2.83} 283`}
                  transform="rotate(-90 50 50)"
                  className="appreciation-arc"
                />
              </svg>
              <div className="meter-center">
                <span className="meter-value">{overview?.avg_appreciation_score.toFixed(0) || 0}</span>
                <span className="meter-label">/ 100</span>
              </div>
            </div>
            <div className="appreciation-trend">
              <span className={`trend-badge trend-${overview?.recognition_trend || 'stable'}`}>
                {overview?.recognition_trend === 'rising' && '↗ Rising'}
                {overview?.recognition_trend === 'falling' && '↘ Falling'}
                {overview?.recognition_trend === 'stable' && '→ Stable'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="kudos-layout">
        {/* Main Feed */}
        <div className="kudos-main">
          {/* Filter Tabs */}
          <nav className="filter-tabs">
            {[
              { id: 'all', label: 'All', count: overview?.total_received + overview?.total_given || 0 },
              { id: 'received', label: 'Received', count: overview?.total_received || 0 },
              { id: 'given', label: 'Given', count: overview?.total_given || 0 },
            ].map(filter => (
              <button
                key={filter.id}
                className={`filter-tab ${feedFilter === filter.id ? 'active' : ''}`}
                onClick={() => setFeedFilter(filter.id as FeedFilter)}
              >
                <span className="tab-label">{filter.label}</span>
                <span className="tab-badge">{filter.count}</span>
              </button>
            ))}
          </nav>

          {/* Recognition Feed */}
          {events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><AnimatedIcon icon="star" size={40} /></div>
              <h3>No Recognition Events</h3>
              <p>Start celebrating wins and giving kudos</p>
            </div>
          ) : (
            <div className="recognition-feed">
              {events.map((event, i) => (
                <div
                  key={event.id}
                  className={`recognition-card glass ${expandedEvent === event.id ? 'expanded' : ''}`}
                  style={{
                    '--delay': `${i * 0.03}s`,
                    '--impact-color': getImpactColor(event.impact_level),
                  } as React.CSSProperties}
                >
                  {/* Card Header */}
                  <div className="rec-header">
                    <span className="rec-icon"><AnimatedIcon icon={getEventIconKey(event.event_type)} size={20} /></span>
                    <div className="rec-info">
                      <div className="rec-type">
                        <span className="type-label">{event.event_type.replace('_', ' ')}</span>
                        {event.is_milestone && (
                          <span className="milestone-badge"><AnimatedIcon icon="target" size={12} /> Milestone</span>
                        )}
                      </div>
                      <div className="rec-meta">
                        <span className="meta-direction">{getDirectionLabel(event.direction)}</span>
                        {event.direction === 'received' && event.from_contact_name && (
                          <span className="meta-contact">{event.from_contact_name}</span>
                        )}
                        {event.direction === 'given' && event.to_contact_name && (
                          <span className="meta-contact">{event.to_contact_name}</span>
                        )}
                        <span className="meta-divider">•</span>
                        <span className="meta-time">{formatTimeAgo(event.detected_at)}</span>
                        {event.channel && (
                          <>
                            <span className="meta-divider">•</span>
                            <span className="meta-channel">{event.channel}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Impact Indicator */}
                    <div
                      className="impact-badge"
                      style={{ borderColor: getImpactColor(event.impact_level) }}
                    >
                      <span className="impact-label">{event.impact_level}</span>
                    </div>
                  </div>

                  {/* Message Excerpt */}
                  {event.message_excerpt && (
                    <div className="rec-excerpt">
                      <p className="excerpt-text">"{event.message_excerpt}"</p>
                    </div>
                  )}

                  {/* Category & Topic */}
                  {(event.recognition_category || event.topic) && (
                    <div className="rec-tags">
                      {event.recognition_category && (
                        <span className="tag category-tag">{event.recognition_category}</span>
                      )}
                      {event.topic && (
                        <span className="tag topic-tag">{event.topic}</span>
                      )}
                    </div>
                  )}

                  {/* Keywords */}
                  {event.keywords_detected.length > 0 && (
                    <div className="rec-keywords">
                      {event.keywords_detected.slice(0, 5).map((keyword, idx) => (
                        <span key={idx} className="keyword-chip">{keyword}</span>
                      ))}
                    </div>
                  )}

                  {/* Milestone Details */}
                  {event.is_milestone && event.milestone_description && (
                    <div className="milestone-details">
                      <span className="milestone-icon"><AnimatedIcon icon="target" size={16} /></span>
                      <div className="milestone-content">
                        {event.milestone_type && (
                          <span className="milestone-type">{event.milestone_type}</span>
                        )}
                        <p className="milestone-desc">{event.milestone_description}</p>
                      </div>
                    </div>
                  )}

                  {/* Positivity Score */}
                  {event.positivity_score !== null && (
                    <div className="positivity-meter">
                      <span className="pos-label">Positivity</span>
                      <div className="pos-bar">
                        <div
                          className="pos-fill"
                          style={{ width: `${event.positivity_score * 100}%` }}
                        />
                      </div>
                      <span className="pos-value">{(event.positivity_score * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Top Appreciators & Wins */}
        <aside className="kudos-sidebar">
          {/* Top Appreciators */}
          {overview?.top_appreciators && overview.top_appreciators.length > 0 && (
            <div className="panel glass appreciators-panel">
              <h3 className="panel-title">
                <AnimatedIcon icon="people" size={16} />
                Top Appreciators
              </h3>
              <div className="appreciators-list">
                {overview.top_appreciators.map((appreciator, i) => (
                  <div key={i} className="appreciator-item">
                    <span className="app-rank">#{i + 1}</span>
                    <div className="app-avatar">
                      {appreciator.contact.charAt(0).toUpperCase()}
                    </div>
                    <span className="app-name">{appreciator.contact}</span>
                    <span className="app-count">{appreciator.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Wins */}
          {wins.length > 0 && (
            <div className="panel glass wins-panel">
              <h3 className="panel-title">
                <AnimatedIcon icon="trophy" size={16} />
                Recent Wins
              </h3>
              <div className="wins-list">
                {wins.map((win, i) => (
                  <div
                    key={win.id}
                    className="win-card"
                    style={{ '--delay': `${i * 0.05}s` } as React.CSSProperties}
                  >
                    <div className="win-header">
                      <span className="win-icon"><AnimatedIcon icon="trophy" size={16} /></span>
                      <h4 className="win-title">{win.win_title}</h4>
                    </div>

                    {win.win_description && (
                      <p className="win-description">{win.win_description}</p>
                    )}

                    <div className="win-meta">
                      <span className="win-time">{formatTimeAgo(win.detected_at)}</span>
                      {win.mentioned_by_contact && (
                        <>
                          <span className="meta-divider">•</span>
                          <span className="win-contact">by {win.mentioned_by_contact}</span>
                        </>
                      )}
                    </div>

                    {win.win_type && (
                      <span className="win-type-badge">{win.win_type}</span>
                    )}

                    {win.celebrated && (
                      <div className="celebrated-badge">
                        <span className="celebrate-icon"><AnimatedIcon icon="sparkle" size={14} /></span>
                        <span className="celebrate-text">Celebrated!</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default KudosView;

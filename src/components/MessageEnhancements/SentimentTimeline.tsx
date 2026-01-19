import React, { useState, useMemo } from 'react';

// Types
interface SentimentDataPoint {
  timestamp: Date;
  messageId: string;
  messagePreview: string;
  sender: 'user' | 'contact';
  senderName: string;
  sentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  score: number; // -1 to 1
  emotions: string[];
  keywords: string[];
}

interface SentimentPeriod {
  startDate: Date;
  endDate: Date;
  averageScore: number;
  dominantSentiment: SentimentDataPoint['sentiment'];
  messageCount: number;
  keyMoments: SentimentDataPoint[];
}

interface SentimentInsight {
  type: 'trend' | 'pattern' | 'alert' | 'tip';
  title: string;
  description: string;
  icon: string;
  timestamp?: Date;
}

interface SentimentTimelineProps {
  conversationId: string;
  dataPoints?: SentimentDataPoint[];
  timeRange?: '7d' | '30d' | '90d' | 'all';
  onMessageClick?: (messageId: string) => void;
  onClose?: () => void;
}

// Sentiment utilities
const getSentimentColor = (sentiment: SentimentDataPoint['sentiment']) => {
  switch (sentiment) {
    case 'very_positive': return '#22c55e';
    case 'positive': return '#86efac';
    case 'neutral': return '#9ca3af';
    case 'negative': return '#fca5a5';
    case 'very_negative': return '#ef4444';
  }
};

const getSentimentEmoji = (sentiment: SentimentDataPoint['sentiment']) => {
  switch (sentiment) {
    case 'very_positive': return '😄';
    case 'positive': return '🙂';
    case 'neutral': return '😐';
    case 'negative': return '😟';
    case 'very_negative': return '😢';
  }
};

const getScoreToSentiment = (score: number): SentimentDataPoint['sentiment'] => {
  if (score >= 0.6) return 'very_positive';
  if (score >= 0.2) return 'positive';
  if (score >= -0.2) return 'neutral';
  if (score >= -0.6) return 'negative';
  return 'very_negative';
};

// Mock data generator
const generateMockDataPoints = (): SentimentDataPoint[] => {
  const now = Date.now();
  const emotions = ['joy', 'gratitude', 'excitement', 'frustration', 'concern', 'curiosity', 'relief', 'disappointment'];
  const keywords = ['project', 'deadline', 'meeting', 'thanks', 'help', 'issue', 'great', 'problem', 'progress', 'update'];

  const messages = [
    { text: 'Great progress on the project!', score: 0.8 },
    { text: 'Thanks for your help with this', score: 0.6 },
    { text: 'Can we discuss the timeline?', score: 0.1 },
    { text: 'I\'m a bit concerned about the deadline', score: -0.4 },
    { text: 'This is really frustrating', score: -0.7 },
    { text: 'Let me know if you need anything', score: 0.3 },
    { text: 'The meeting went well', score: 0.5 },
    { text: 'We need to talk about the issues', score: -0.3 },
    { text: 'I appreciate your patience', score: 0.7 },
    { text: 'This isn\'t working as expected', score: -0.5 },
    { text: 'Excited about the new features!', score: 0.85 },
    { text: 'Just following up on our discussion', score: 0.1 },
  ];

  return messages.map((msg, i) => ({
    timestamp: new Date(now - (messages.length - i) * 4 * 60 * 60 * 1000),
    messageId: `msg-${i}`,
    messagePreview: msg.text,
    sender: i % 3 === 0 ? 'user' : 'contact',
    senderName: i % 3 === 0 ? 'You' : 'Alice',
    sentiment: getScoreToSentiment(msg.score),
    score: msg.score,
    emotions: emotions.sort(() => Math.random() - 0.5).slice(0, 2),
    keywords: keywords.sort(() => Math.random() - 0.5).slice(0, 3),
  }));
};

export const SentimentTimeline: React.FC<SentimentTimelineProps> = ({
  conversationId,
  dataPoints: propDataPoints,
  timeRange: initialTimeRange = '30d',
  onMessageClick,
  onClose,
}) => {
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [activeTab, setActiveTab] = useState<'timeline' | 'insights' | 'emotions'>('timeline');
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  // Use provided or mock data
  const dataPoints = useMemo(() => propDataPoints || generateMockDataPoints(), [propDataPoints]);

  // Filter by time range
  const filteredData = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();

    switch (timeRange) {
      case '7d':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoff.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoff.setDate(now.getDate() - 90);
        break;
      default:
        return dataPoints;
    }

    return dataPoints.filter(d => d.timestamp >= cutoff);
  }, [dataPoints, timeRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { average: 0, trend: 'stable', positive: 0, negative: 0, neutral: 0 };
    }

    const average = filteredData.reduce((sum, d) => sum + d.score, 0) / filteredData.length;

    // Calculate trend (comparing first half to second half)
    const mid = Math.floor(filteredData.length / 2);
    const firstHalf = filteredData.slice(0, mid);
    const secondHalf = filteredData.slice(mid);
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.score, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.score, 0) / (secondHalf.length || 1);

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondAvg - firstAvg > 0.15) trend = 'improving';
    else if (secondAvg - firstAvg < -0.15) trend = 'declining';

    const positive = filteredData.filter(d => d.score > 0.2).length;
    const negative = filteredData.filter(d => d.score < -0.2).length;
    const neutral = filteredData.length - positive - negative;

    return { average, trend, positive, negative, neutral };
  }, [filteredData]);

  // Generate insights
  const insights = useMemo((): SentimentInsight[] => {
    const insights: SentimentInsight[] = [];

    // Trend insight
    if (stats.trend === 'improving') {
      insights.push({
        type: 'trend',
        title: 'Positive Trend',
        description: 'Conversation sentiment has been improving over time. Keep up the good work!',
        icon: '📈',
      });
    } else if (stats.trend === 'declining') {
      insights.push({
        type: 'alert',
        title: 'Sentiment Declining',
        description: 'Conversation sentiment has been declining. Consider addressing any underlying issues.',
        icon: '⚠️',
      });
    }

    // Ratio insight
    const positiveRatio = stats.positive / (filteredData.length || 1);
    if (positiveRatio > 0.7) {
      insights.push({
        type: 'pattern',
        title: 'Highly Positive',
        description: `${Math.round(positiveRatio * 100)}% of messages have positive sentiment.`,
        icon: '🌟',
      });
    } else if (positiveRatio < 0.3 && stats.negative > stats.positive) {
      insights.push({
        type: 'tip',
        title: 'Relationship Tip',
        description: 'Try starting with positive acknowledgments before addressing concerns.',
        icon: '💡',
      });
    }

    // Find emotional peaks
    const peaks = filteredData.filter(d => Math.abs(d.score) > 0.6);
    if (peaks.length > 0) {
      const positive = peaks.filter(d => d.score > 0);
      const negative = peaks.filter(d => d.score < 0);

      if (positive.length > 0) {
        insights.push({
          type: 'pattern',
          title: 'Emotional Highlights',
          description: `Found ${positive.length} highly positive moments in your conversation.`,
          icon: '✨',
          timestamp: positive[positive.length - 1].timestamp,
        });
      }

      if (negative.length > 0) {
        insights.push({
          type: 'alert',
          title: 'Tension Points',
          description: `Detected ${negative.length} moments of frustration or concern.`,
          icon: '🔴',
          timestamp: negative[negative.length - 1].timestamp,
        });
      }
    }

    return insights;
  }, [filteredData, stats]);

  // Aggregate emotions
  const emotionStats = useMemo(() => {
    const counts = new Map<string, number>();
    filteredData.forEach(d => {
      d.emotions.forEach(emotion => {
        counts.set(emotion, (counts.get(emotion) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [filteredData]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Calculate chart dimensions
  const chartWidth = 550;
  const chartHeight = 150;
  const padding = 30;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '650px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>📊</span>
            Sentiment Timeline
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            {filteredData.length} messages analyzed
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '12px',
          padding: '14px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '1.8rem',
            marginBottom: '4px',
          }}>
            {getSentimentEmoji(getScoreToSentiment(stats.average))}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Overall</div>
        </div>

        <div style={{
          background: `rgba(34, 197, 94, 0.1)`,
          borderRadius: '12px',
          padding: '14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#4ade80' }}>
            {stats.positive}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Positive</div>
        </div>

        <div style={{
          background: 'rgba(156, 163, 175, 0.1)',
          borderRadius: '12px',
          padding: '14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#9ca3af' }}>
            {stats.neutral}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Neutral</div>
        </div>

        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '12px',
          padding: '14px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f87171' }}>
            {stats.negative}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Negative</div>
        </div>
      </div>

      {/* Trend Badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <div style={{
          background: stats.trend === 'improving' ? 'rgba(34, 197, 94, 0.15)' :
                      stats.trend === 'declining' ? 'rgba(239, 68, 68, 0.15)' :
                      'rgba(156, 163, 175, 0.15)',
          border: `1px solid ${
            stats.trend === 'improving' ? 'rgba(34, 197, 94, 0.3)' :
            stats.trend === 'declining' ? 'rgba(239, 68, 68, 0.3)' :
            'rgba(156, 163, 175, 0.3)'
          }`,
          borderRadius: '20px',
          padding: '6px 16px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>
            {stats.trend === 'improving' ? '📈' : stats.trend === 'declining' ? '📉' : '➡️'}
          </span>
          <span style={{
            color: stats.trend === 'improving' ? '#4ade80' :
                   stats.trend === 'declining' ? '#f87171' :
                   '#9ca3af',
          }}>
            Sentiment {stats.trend}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
      }}>
        {[
          { id: 'timeline', label: 'Timeline', icon: '📈' },
          { id: 'insights', label: 'Insights', icon: '💡' },
          { id: 'emotions', label: 'Emotions', icon: '😊' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              background: activeTab === tab.id ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)',
              border: activeTab === tab.id ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Timeline Chart */}
        {activeTab === 'timeline' && (
          <div>
            {/* SVG Chart */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              overflow: 'hidden',
            }}>
              <svg
                width="100%"
                height={chartHeight + padding * 2}
                viewBox={`0 0 ${chartWidth} ${chartHeight + padding * 2}`}
                style={{ display: 'block' }}
              >
                {/* Y-axis labels */}
                <text x="10" y={padding} fontSize="10" fill="rgba(255,255,255,0.4)">😄</text>
                <text x="10" y={chartHeight / 2 + padding} fontSize="10" fill="rgba(255,255,255,0.4)">😐</text>
                <text x="10" y={chartHeight + padding} fontSize="10" fill="rgba(255,255,255,0.4)">😢</text>

                {/* Grid lines */}
                <line
                  x1={padding}
                  y1={chartHeight / 2 + padding}
                  x2={chartWidth - 10}
                  y2={chartHeight / 2 + padding}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4"
                />

                {/* Area fill */}
                {filteredData.length > 1 && (
                  <path
                    d={`
                      M ${padding} ${chartHeight / 2 + padding}
                      ${filteredData.map((d, i) => {
                        const x = padding + (i / (filteredData.length - 1)) * (chartWidth - padding - 10);
                        const y = padding + (1 - (d.score + 1) / 2) * chartHeight;
                        return `L ${x} ${y}`;
                      }).join(' ')}
                      L ${chartWidth - 10} ${chartHeight / 2 + padding}
                      Z
                    `}
                    fill="url(#sentimentGradient)"
                    opacity="0.3"
                  />
                )}

                {/* Line */}
                {filteredData.length > 1 && (
                  <path
                    d={`M ${filteredData.map((d, i) => {
                      const x = padding + (i / (filteredData.length - 1)) * (chartWidth - padding - 10);
                      const y = padding + (1 - (d.score + 1) / 2) * chartHeight;
                      return `${x},${y}`;
                    }).join(' L ')}`}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                  />
                )}

                {/* Data points */}
                {filteredData.map((d, i) => {
                  const x = padding + (i / Math.max(filteredData.length - 1, 1)) * (chartWidth - padding - 10);
                  const y = padding + (1 - (d.score + 1) / 2) * chartHeight;

                  return (
                    <g
                      key={d.messageId}
                      onMouseEnter={() => setHoveredPoint(d.messageId)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => onMessageClick?.(d.messageId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={hoveredPoint === d.messageId ? 8 : 5}
                        fill={getSentimentColor(d.sentiment)}
                        stroke="white"
                        strokeWidth="2"
                        style={{ transition: 'r 0.2s ease' }}
                      />
                    </g>
                  );
                })}

                {/* Gradient definitions */}
                <defs>
                  <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="50%" stopColor="#9ca3af" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Hovered Message Preview */}
            {hoveredPoint && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '16px',
              }}>
                {(() => {
                  const point = filteredData.find(d => d.messageId === hoveredPoint);
                  if (!point) return null;

                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ fontSize: '1.5rem' }}>{getSentimentEmoji(point.sentiment)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                          <strong>{point.senderName}</strong> · {formatDate(point.timestamp)}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>{point.messagePreview}</p>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          {point.emotions.map(emotion => (
                            <span
                              key={emotion}
                              style={{
                                fontSize: '0.75rem',
                                background: 'rgba(255,255,255,0.1)',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                textTransform: 'capitalize',
                              }}
                            >
                              {emotion}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Message List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredData.slice().reverse().slice(0, 5).map((point) => (
                <div
                  key={point.messageId}
                  onClick={() => onMessageClick?.(point.messageId)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${getSentimentColor(point.sentiment)}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{getSentimentEmoji(point.sentiment)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{point.senderName}</div>
                      <p style={{
                        margin: '4px 0 0',
                        fontSize: '0.85rem',
                        opacity: 0.8,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {point.messagePreview}
                      </p>
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                      {formatDate(point.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {activeTab === 'insights' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {insights.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🔍</span>
                <p>Not enough data to generate insights yet.</p>
              </div>
            ) : (
              insights.map((insight, i) => (
                <div
                  key={i}
                  style={{
                    background: insight.type === 'alert' ? 'rgba(239, 68, 68, 0.1)' :
                               insight.type === 'trend' ? 'rgba(34, 197, 94, 0.1)' :
                               insight.type === 'tip' ? 'rgba(251, 191, 36, 0.1)' :
                               'rgba(139, 92, 246, 0.1)',
                    border: `1px solid ${
                      insight.type === 'alert' ? 'rgba(239, 68, 68, 0.3)' :
                      insight.type === 'trend' ? 'rgba(34, 197, 94, 0.3)' :
                      insight.type === 'tip' ? 'rgba(251, 191, 36, 0.3)' :
                      'rgba(139, 92, 246, 0.3)'
                    }`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{insight.icon}</span>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{insight.title}</div>
                    <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>{insight.description}</p>
                    {insight.timestamp && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '8px' }}>
                        {formatDate(insight.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Emotions */}
        {activeTab === 'emotions' && (
          <div>
            <h4 style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '16px' }}>
              Detected Emotions
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {emotionStats.map(([emotion, count]) => {
                const percentage = (count / filteredData.length) * 100;

                return (
                  <div key={emotion}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>{emotion}</span>
                      <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>{count} times</span>
                    </div>
                    <div style={{
                      height: '8px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                        borderRadius: '4px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Compact sentiment badge
export const SentimentBadge: React.FC<{
  sentiment: SentimentDataPoint['sentiment'];
  showLabel?: boolean;
  onClick?: () => void;
}> = ({ sentiment, showLabel = false, onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        background: `${getSentimentColor(sentiment)}20`,
        border: `1px solid ${getSentimentColor(sentiment)}50`,
        borderRadius: '12px',
        padding: '4px 10px',
        color: getSentimentColor(sentiment),
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.8rem',
      }}
    >
      <span>{getSentimentEmoji(sentiment)}</span>
      {showLabel && <span style={{ textTransform: 'capitalize' }}>{sentiment.replace('_', ' ')}</span>}
    </button>
  );
};

export default SentimentTimeline;

import React, { useState, useMemo } from 'react';

// Types
interface Reaction {
  id: string;
  emoji: string;
  name: string;
  count: number;
  users: string[];
  messageId: string;
  timestamp: Date;
}

interface ReactionTrend {
  emoji: string;
  name: string;
  totalCount: number;
  percentChange: number;
  peakHour: number;
  topUsers: { name: string; count: number }[];
}

interface ReactionInsight {
  type: 'positive' | 'negative' | 'neutral' | 'tip';
  title: string;
  description: string;
  emoji: string;
}

interface ReactionsAnalyticsProps {
  conversationId: string;
  reactions?: Reaction[];
  timeRange?: '7d' | '30d' | '90d' | 'all';
  onClose?: () => void;
}

// Mock data generator
const generateMockReactions = (): Reaction[] => {
  const emojis = [
    { emoji: '👍', name: 'thumbs up' },
    { emoji: '❤️', name: 'heart' },
    { emoji: '😂', name: 'laugh' },
    { emoji: '😮', name: 'wow' },
    { emoji: '😢', name: 'sad' },
    { emoji: '😡', name: 'angry' },
    { emoji: '🎉', name: 'celebrate' },
    { emoji: '🔥', name: 'fire' },
    { emoji: '👏', name: 'clap' },
    { emoji: '💯', name: 'hundred' },
  ];

  const users = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const reactions: Reaction[] = [];

  for (let i = 0; i < 150; i++) {
    const emojiData = emojis[Math.floor(Math.random() * emojis.length)];
    const userCount = Math.floor(Math.random() * 4) + 1;
    const selectedUsers = users.sort(() => Math.random() - 0.5).slice(0, userCount);

    reactions.push({
      id: `reaction-${i}`,
      emoji: emojiData.emoji,
      name: emojiData.name,
      count: userCount,
      users: selectedUsers,
      messageId: `msg-${Math.floor(Math.random() * 50)}`,
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    });
  }

  return reactions;
};

export const ReactionsAnalytics: React.FC<ReactionsAnalyticsProps> = ({
  conversationId,
  reactions: propReactions,
  timeRange: initialTimeRange = '30d',
  onClose,
}) => {
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'insights' | 'breakdown'>('overview');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  // Use provided reactions or generate mock data
  const reactions = useMemo(() => propReactions || generateMockReactions(), [propReactions]);

  // Filter reactions by time range
  const filteredReactions = useMemo(() => {
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
        return reactions;
    }

    return reactions.filter(r => r.timestamp >= cutoff);
  }, [reactions, timeRange]);

  // Calculate reaction trends
  const trends = useMemo((): ReactionTrend[] => {
    const emojiMap = new Map<string, { name: string; counts: number[]; hours: number[]; users: Map<string, number> }>();

    filteredReactions.forEach(reaction => {
      if (!emojiMap.has(reaction.emoji)) {
        emojiMap.set(reaction.emoji, {
          name: reaction.name,
          counts: [],
          hours: [],
          users: new Map(),
        });
      }

      const data = emojiMap.get(reaction.emoji)!;
      data.counts.push(reaction.count);
      data.hours.push(reaction.timestamp.getHours());

      reaction.users.forEach(user => {
        data.users.set(user, (data.users.get(user) || 0) + 1);
      });
    });

    return Array.from(emojiMap.entries()).map(([emoji, data]) => {
      const totalCount = data.counts.reduce((a, b) => a + b, 0);

      // Calculate peak hour
      const hourCounts = new Array(24).fill(0);
      data.hours.forEach(h => hourCounts[h]++);
      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

      // Get top users
      const topUsers = Array.from(data.users.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

      return {
        emoji,
        name: data.name,
        totalCount,
        percentChange: Math.round((Math.random() - 0.3) * 100), // Mock change
        peakHour,
        topUsers,
      };
    }).sort((a, b) => b.totalCount - a.totalCount);
  }, [filteredReactions]);

  // Calculate insights
  const insights = useMemo((): ReactionInsight[] => {
    const insights: ReactionInsight[] = [];

    const totalReactions = filteredReactions.length;
    const positiveEmojis = ['👍', '❤️', '😂', '🎉', '🔥', '👏', '💯'];
    const negativeEmojis = ['😢', '😡'];

    const positiveCount = filteredReactions.filter(r => positiveEmojis.includes(r.emoji)).length;
    const negativeCount = filteredReactions.filter(r => negativeEmojis.includes(r.emoji)).length;

    const positiveRatio = totalReactions > 0 ? positiveCount / totalReactions : 0;

    if (positiveRatio > 0.8) {
      insights.push({
        type: 'positive',
        title: 'Highly Positive Sentiment',
        description: `${Math.round(positiveRatio * 100)}% of reactions are positive! Your messages resonate well.`,
        emoji: '🌟',
      });
    } else if (positiveRatio < 0.5) {
      insights.push({
        type: 'negative',
        title: 'Mixed Reactions',
        description: 'Consider adjusting your communication style for more positive engagement.',
        emoji: '💭',
      });
    }

    // Most popular emoji insight
    if (trends.length > 0) {
      const topEmoji = trends[0];
      insights.push({
        type: 'neutral',
        title: `${topEmoji.emoji} is Your Top Reaction`,
        description: `Used ${topEmoji.totalCount} times. Peak usage at ${topEmoji.peakHour}:00.`,
        emoji: topEmoji.emoji,
      });
    }

    // Engagement tip
    if (totalReactions < 20) {
      insights.push({
        type: 'tip',
        title: 'Boost Engagement',
        description: 'Try asking questions or sharing interesting content to encourage more reactions.',
        emoji: '💡',
      });
    }

    // Diversity insight
    const uniqueEmojis = new Set(filteredReactions.map(r => r.emoji)).size;
    if (uniqueEmojis >= 8) {
      insights.push({
        type: 'positive',
        title: 'Diverse Reactions',
        description: `${uniqueEmojis} different emojis used! Your content evokes varied responses.`,
        emoji: '🎨',
      });
    }

    return insights;
  }, [filteredReactions, trends]);

  // Calculate hourly distribution
  const hourlyDistribution = useMemo(() => {
    const hours = new Array(24).fill(0);
    filteredReactions.forEach(r => {
      hours[r.timestamp.getHours()]++;
    });
    const max = Math.max(...hours, 1);
    return hours.map(count => ({ count, percentage: (count / max) * 100 }));
  }, [filteredReactions]);

  // Total stats
  const stats = useMemo(() => {
    const totalReactions = filteredReactions.reduce((sum, r) => sum + r.count, 0);
    const uniqueMessages = new Set(filteredReactions.map(r => r.messageId)).size;
    const uniqueUsers = new Set(filteredReactions.flatMap(r => r.users)).size;
    const avgPerMessage = uniqueMessages > 0 ? (totalReactions / uniqueMessages).toFixed(1) : '0';

    return { totalReactions, uniqueMessages, uniqueUsers, avgPerMessage };
  }, [filteredReactions]);

  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98))',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      maxWidth: '700px',
      width: '100%',
      maxHeight: '85vh',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>📊</span>
            Reactions Analytics
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            Understand engagement patterns
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
              fontSize: '0.85rem',
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

      {/* Stats Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {[
          { label: 'Total Reactions', value: stats.totalReactions, icon: '🎯' },
          { label: 'Messages Reacted', value: stats.uniqueMessages, icon: '💬' },
          { label: 'Unique Reactors', value: stats.uniqueUsers, icon: '👥' },
          { label: 'Avg per Message', value: stats.avgPerMessage, icon: '📈' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '12px',
      }}>
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'trends', label: 'Trends', icon: '📈' },
          { id: 'insights', label: 'Insights', icon: '💡' },
          { id: 'breakdown', label: 'Breakdown', icon: '🔍' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              background: activeTab === tab.id ? 'rgba(138, 43, 226, 0.3)' : 'transparent',
              border: activeTab === tab.id ? '1px solid rgba(138, 43, 226, 0.5)' : '1px solid transparent',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Emoji Leaderboard */}
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', opacity: 0.9 }}>
            🏆 Reaction Leaderboard
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {trends.slice(0, 5).map((trend, index) => (
              <div
                key={trend.emoji}
                onClick={() => setSelectedEmoji(selectedEmoji === trend.emoji ? null : trend.emoji)}
                style={{
                  background: selectedEmoji === trend.emoji
                    ? 'rgba(138, 43, 226, 0.2)'
                    : 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: index === 0 ? 'linear-gradient(135deg, #FFD700, #FFA500)' :
                            index === 1 ? 'linear-gradient(135deg, #C0C0C0, #A0A0A0)' :
                            index === 2 ? 'linear-gradient(135deg, #CD7F32, #8B4513)' :
                            'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}>
                  {index + 1}
                </div>
                <span style={{ fontSize: '1.8rem' }}>{trend.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500' }}>{trend.name}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                    Peak at {formatHour(trend.peakHour)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{trend.totalCount}</div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: trend.percentChange >= 0 ? '#4ade80' : '#f87171',
                  }}>
                    {trend.percentChange >= 0 ? '↑' : '↓'} {Math.abs(trend.percentChange)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Hourly Activity */}
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', opacity: 0.9 }}>
            ⏰ Reaction Activity by Hour
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '2px',
            height: '80px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            padding: '12px 8px',
          }}>
            {hourlyDistribution.map((hour, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(hour.percentage, 5)}%`,
                    background: hour.percentage > 70
                      ? 'linear-gradient(180deg, #8b5cf6, #7c3aed)'
                      : hour.percentage > 40
                      ? 'linear-gradient(180deg, #a78bfa, #8b5cf6)'
                      : 'rgba(167, 139, 250, 0.3)',
                    borderRadius: '2px 2px 0 0',
                    transition: 'height 0.3s ease',
                  }}
                  title={`${formatHour(i)}: ${hour.count} reactions`}
                />
                {i % 4 === 0 && (
                  <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>
                    {formatHour(i)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', opacity: 0.9 }}>
            📈 Reaction Trends
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {trends.map((trend) => (
              <div
                key={trend.emoji}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '2rem' }}>{trend.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{trend.name}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                      {trend.totalCount} total uses
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    background: trend.percentChange >= 0
                      ? 'rgba(74, 222, 128, 0.2)'
                      : 'rgba(248, 113, 113, 0.2)',
                    color: trend.percentChange >= 0 ? '#4ade80' : '#f87171',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                  }}>
                    {trend.percentChange >= 0 ? '+' : ''}{trend.percentChange}%
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                }}>
                  <div style={{
                    width: `${(trend.totalCount / (trends[0]?.totalCount || 1)) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                    borderRadius: '4px',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ opacity: 0.6 }}>
                    Peak: {formatHour(trend.peakHour)}
                  </span>
                  <span style={{ opacity: 0.6 }}>
                    Top users: {trend.topUsers.map(u => u.name).join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', opacity: 0.9 }}>
            💡 AI-Powered Insights
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {insights.map((insight, index) => (
              <div
                key={index}
                style={{
                  background: insight.type === 'positive'
                    ? 'rgba(74, 222, 128, 0.1)'
                    : insight.type === 'negative'
                    ? 'rgba(248, 113, 113, 0.1)'
                    : insight.type === 'tip'
                    ? 'rgba(251, 191, 36, 0.1)'
                    : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${
                    insight.type === 'positive' ? 'rgba(74, 222, 128, 0.3)' :
                    insight.type === 'negative' ? 'rgba(248, 113, 113, 0.3)' :
                    insight.type === 'tip' ? 'rgba(251, 191, 36, 0.3)' :
                    'rgba(255,255,255,0.1)'
                  }`,
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '1.5rem' }}>{insight.emoji}</div>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{insight.title}</div>
                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{insight.description}</div>
                </div>
              </div>
            ))}

            {insights.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                opacity: 0.5,
              }}>
                Not enough data to generate insights yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'breakdown' && (
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', opacity: 0.9 }}>
            🔍 Detailed Breakdown
          </h3>

          {/* Emoji grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
            marginBottom: '20px',
          }}>
            {trends.map((trend) => (
              <button
                key={trend.emoji}
                onClick={() => setSelectedEmoji(selectedEmoji === trend.emoji ? null : trend.emoji)}
                style={{
                  background: selectedEmoji === trend.emoji
                    ? 'rgba(138, 43, 226, 0.3)'
                    : 'rgba(255,255,255,0.05)',
                  border: selectedEmoji === trend.emoji
                    ? '2px solid rgba(138, 43, 226, 0.5)'
                    : '2px solid transparent',
                  borderRadius: '12px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{trend.emoji}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{trend.totalCount}</span>
              </button>
            ))}
          </div>

          {/* Selected emoji details */}
          {selectedEmoji && (
            <div style={{
              background: 'rgba(138, 43, 226, 0.1)',
              border: '1px solid rgba(138, 43, 226, 0.3)',
              borderRadius: '12px',
              padding: '20px',
            }}>
              {(() => {
                const selected = trends.find(t => t.emoji === selectedEmoji);
                if (!selected) return null;

                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '2.5rem' }}>{selected.emoji}</span>
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', textTransform: 'capitalize' }}>
                          {selected.name}
                        </div>
                        <div style={{ opacity: 0.7 }}>{selected.totalCount} total reactions</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '8px' }}>Top Users</div>
                        {selected.topUsers.map((user, i) => (
                          <div key={user.name} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                          }}>
                            <span>{i + 1}. {user.name}</span>
                            <span style={{ opacity: 0.7 }}>{user.count}x</span>
                          </div>
                        ))}
                      </div>

                      <div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '8px' }}>Stats</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Peak Hour</span>
                            <span style={{ fontWeight: 'bold' }}>{formatHour(selected.peakHour)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Trend</span>
                            <span style={{
                              fontWeight: 'bold',
                              color: selected.percentChange >= 0 ? '#4ade80' : '#f87171',
                            }}>
                              {selected.percentChange >= 0 ? '+' : ''}{selected.percentChange}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>% of Total</span>
                            <span style={{ fontWeight: 'bold' }}>
                              {Math.round((selected.totalCount / stats.totalReactions) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Compact badge showing reaction summary
export const ReactionsSummaryBadge: React.FC<{
  reactions: Reaction[];
  onClick?: () => void;
}> = ({ reactions, onClick }) => {
  const topEmojis = useMemo(() => {
    const counts = new Map<string, number>();
    reactions.forEach(r => {
      counts.set(r.emoji, (counts.get(r.emoji) || 0) + r.count);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [reactions]);

  const total = reactions.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) return null;

  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(138, 43, 226, 0.2)',
        border: '1px solid rgba(138, 43, 226, 0.3)',
        borderRadius: '20px',
        padding: '4px 12px',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.85rem',
        transition: 'all 0.2s ease',
      }}
    >
      {topEmojis.map(([emoji]) => (
        <span key={emoji}>{emoji}</span>
      ))}
      <span style={{ opacity: 0.8, marginLeft: '4px' }}>{total}</span>
    </button>
  );
};

export default ReactionsAnalytics;

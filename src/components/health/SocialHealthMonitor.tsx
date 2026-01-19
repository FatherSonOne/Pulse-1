import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { AlertTriangle, TrendingUp, TrendingDown, Users, Clock, MessageCircle, AlertCircle } from 'lucide-react';
import './SocialHealthMonitor.css';

interface HealthMetrics {
  channelId: string;
  channelName: string;
  responseRate: number;
  avgResponseTime: number;
  messageLoad: Record<string, number>;
  unresolvedAsks: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  riskLevel: 'low' | 'medium' | 'high';
}

interface Nudge {
  id: string;
  type: 'follow_up' | 'clarify' | 'de_escalate' | 'check_in';
  userId: string;
  channelId: string;
  messageId: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

interface Props {
  currentUserId: string;
  channels: Array<{ id: string; name: string }>;
}

export function SocialHealthMonitor({ currentUserId, channels }: Props) {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [showNudges, setShowNudges] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  useEffect(() => {
    loadHealthMetrics();
    loadNudges();
    
    const interval = setInterval(() => {
      loadHealthMetrics();
      loadNudges();
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [channels]);

  const loadHealthMetrics = async () => {
    const metrics: HealthMetrics[] = [];

    for (const channel of channels) {
      // Get messages from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: messages } = await supabase
        .from('pulse_messages')
        .select('*, user:pulse_users(id, full_name)')
        .eq('channel_id', channel.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (!messages || messages.length === 0) continue;

      // Calculate response rate
      let questionsAsked = 0;
      let questionsAnswered = 0;
      const messagesByUser: Record<string, number> = {};
      const responseTimes: number[] = [];

      messages.forEach((msg: any, index: number) => {
        // Count messages per user
        messagesByUser[msg.user_id] = (messagesByUser[msg.user_id] || 0) + 1;

        // Detect questions
        if (msg.content.includes('?')) {
          questionsAsked++;
          
          // Check if answered in next 5 messages
          const nextMessages = messages.slice(Math.max(0, index - 5), index);
          if (nextMessages.some((m: any) => m.user_id !== msg.user_id)) {
            questionsAnswered++;
            
            // Calculate response time
            const nextMsg = nextMessages.find((m: any) => m.user_id !== msg.user_id);
            if (nextMsg) {
              const responseTime = new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime();
              responseTimes.push(responseTime / 1000 / 60); // Convert to minutes
            }
          }
        }
      });

      const responseRate = questionsAsked > 0 ? (questionsAnswered / questionsAsked) * 100 : 100;
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      // Detect unresolved asks
      const unresolvedAsks = messages.filter((msg: any) => 
        msg.content.toLowerCase().includes('can you') ||
        msg.content.toLowerCase().includes('could you') ||
        msg.content.toLowerCase().includes('please')
      ).length - questionsAnswered;

      // Calculate sentiment (simplified)
      const positiveWords = ['great', 'thanks', 'awesome', 'perfect', 'good'];
      const negativeWords = ['issue', 'problem', 'urgent', 'blocked', 'help'];
      
      let sentimentScore = 0;
      messages.forEach((msg: any) => {
        const content = msg.content.toLowerCase();
        positiveWords.forEach(word => {
          if (content.includes(word)) sentimentScore++;
        });
        negativeWords.forEach(word => {
          if (content.includes(word)) sentimentScore--;
        });
      });

      const sentiment = sentimentScore > 5 ? 'positive' : sentimentScore < -5 ? 'negative' : 'neutral';

      // Calculate risk level
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (responseRate < 50 || unresolvedAsks > 10 || avgResponseTime > 120) {
        riskLevel = 'high';
      } else if (responseRate < 70 || unresolvedAsks > 5 || avgResponseTime > 60) {
        riskLevel = 'medium';
      }

      metrics.push({
        channelId: channel.id,
        channelName: channel.name,
        responseRate,
        avgResponseTime,
        messageLoad: messagesByUser,
        unresolvedAsks,
        sentiment,
        riskLevel,
      });
    }

    setHealthMetrics(metrics);
  };

  const loadNudges = async () => {
    const { data } = await supabase
      .from('pulse_nudges')
      .select('*')
      .eq('user_id', currentUserId)
      .eq('dismissed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setNudges(data);
    }
  };

  const dismissNudge = async (nudgeId: string) => {
    await supabase
      .from('pulse_nudges')
      .update({ dismissed: true })
      .eq('id', nudgeId);

    setNudges(prev => prev.filter(n => n.id !== nudgeId));
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return '#f87171';
      case 'medium': return '#fbbf24';
      default: return '#34d399';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😟';
      default: return '😐';
    }
  };

  const getNudgeIcon = (type: string) => {
    switch (type) {
      case 'follow_up': return <Clock size={16} />;
      case 'clarify': return <MessageCircle size={16} />;
      case 'de_escalate': return <AlertCircle size={16} />;
      case 'check_in': return <Users size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const topLoadedUsers = selectedChannel
    ? Object.entries(healthMetrics.find(m => m.channelId === selectedChannel)?.messageLoad || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  return (
    <div className="social-health-monitor">
      {/* Nudges Bell */}
      <div className="nudges-bell" onClick={() => setShowNudges(!showNudges)}>
        <AlertTriangle size={20} />
        {nudges.length > 0 && <span className="nudge-badge">{nudges.length}</span>}
      </div>

      {/* Nudges Panel */}
      {showNudges && (
        <div className="nudges-panel">
          <div className="nudges-header">
            <h3>Smart Nudges</h3>
            <span className="nudge-count">{nudges.length} suggestions</span>
          </div>

          {nudges.length === 0 ? (
            <div className="empty-nudges">
              <p>No nudges right now! 🎉</p>
              <p className="empty-subtext">You're all caught up</p>
            </div>
          ) : (
            <div className="nudges-list">
              {nudges.map(nudge => (
                <div key={nudge.id} className={`nudge-item priority-${nudge.priority}`}>
                  <div className="nudge-icon">{getNudgeIcon(nudge.type)}</div>
                  <div className="nudge-content">
                    <div className="nudge-reason">{nudge.reason}</div>
                    <div className="nudge-time">
                      {new Date(nudge.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <button 
                    className="dismiss-btn"
                    onClick={() => dismissNudge(nudge.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Health Dashboard */}
      <div className="health-dashboard">
        <div className="dashboard-header">
          <h2>Channel Health</h2>
          <p className="dashboard-subtitle">Monitor team wellness and prevent burnout</p>
        </div>

        <div className="metrics-grid">
          {healthMetrics.map(metric => (
            <div 
              key={metric.channelId}
              className="metric-card"
              style={{ borderLeftColor: getRiskColor(metric.riskLevel) }}
              onClick={() => setSelectedChannel(
                selectedChannel === metric.channelId ? null : metric.channelId
              )}
            >
              <div className="metric-header">
                <h3>#{metric.channelName}</h3>
                <span className="sentiment-badge">
                  {getSentimentIcon(metric.sentiment)}
                </span>
              </div>

              <div className="metric-stats">
                <div className="stat">
                  <div className="stat-icon">
                    {metric.responseRate >= 70 ? 
                      <TrendingUp size={16} style={{ color: '#34d399' }} /> : 
                      <TrendingDown size={16} style={{ color: '#f87171' }} />
                    }
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{metric.responseRate.toFixed(0)}%</div>
                    <div className="stat-label">Response Rate</div>
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-icon">
                    <Clock size={16} />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{metric.avgResponseTime.toFixed(0)}m</div>
                    <div className="stat-label">Avg Response</div>
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{metric.unresolvedAsks}</div>
                    <div className="stat-label">Unresolved</div>
                  </div>
                </div>
              </div>

              {selectedChannel === metric.channelId && (
                <div className="detailed-metrics">
                  <div className="section-title">Message Load Distribution</div>
                  {topLoadedUsers.length > 0 ? (
                    <div className="load-bars">
                      {topLoadedUsers.map(([userId, count]) => (
                        <div key={userId} className="load-bar">
                          <div className="load-label">User {userId.slice(0, 8)}</div>
                          <div className="load-progress">
                            <div 
                              className="load-fill"
                              style={{ 
                                width: `${(count / topLoadedUsers[0][1]) * 100}%` 
                              }}
                            />
                          </div>
                          <div className="load-count">{count} msgs</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No message data available</p>
                  )}

                  <div className="health-recommendations">
                    {metric.riskLevel === 'high' && (
                      <div className="recommendation high">
                        <AlertTriangle size={16} />
                        <span>High risk: Consider redistributing workload</span>
                      </div>
                    )}
                    {metric.unresolvedAsks > 5 && (
                      <div className="recommendation medium">
                        <MessageCircle size={16} />
                        <span>Many unresolved asks: Schedule check-in</span>
                      </div>
                    )}
                    {metric.avgResponseTime > 60 && (
                      <div className="recommendation medium">
                        <Clock size={16} />
                        <span>Slow responses: Team may be overloaded</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
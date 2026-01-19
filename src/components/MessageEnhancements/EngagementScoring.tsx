// Engagement Scoring System
import React, { useMemo, useState } from 'react';

interface EngagementMetrics {
  overallScore: number; // 0-100
  components: {
    frequency: number;      // How often messages are exchanged
    reciprocity: number;    // Balance of conversation
    depth: number;          // Length and substance of messages
    timeliness: number;     // Response speed
    consistency: number;    // Regular communication patterns
  };
  trend: 'rising' | 'falling' | 'stable';
  level: 'excellent' | 'good' | 'moderate' | 'low' | 'minimal';
  insights: string[];
}

interface EngagementScoringProps {
  messages: Array<{
    id: string;
    text: string;
    sender: 'user' | 'other';
    timestamp: string;
    reactions?: string[];
  }>;
  contactName: string;
  compact?: boolean;
}

export const EngagementScoring: React.FC<EngagementScoringProps> = React.memo(({
  messages = [],
  contactName,
  compact = false
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const metrics = useMemo((): EngagementMetrics | null => {
    if (messages.length < 5) return null;

    // Calculate frequency score (messages per day, last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentMessages = messages.filter(m => new Date(m.timestamp) > thirtyDaysAgo);
    const daysSpan = Math.max(1, Math.ceil((now.getTime() - thirtyDaysAgo.getTime()) / (24 * 60 * 60 * 1000)));
    const msgsPerDay = recentMessages.length / daysSpan;
    const frequencyScore = Math.min(100, msgsPerDay * 20); // 5+ msgs/day = 100

    // Calculate reciprocity score (balance between user and other)
    const userMsgs = messages.filter(m => m.sender === 'user').length;
    const otherMsgs = messages.filter(m => m.sender === 'other').length;
    const totalMsgs = userMsgs + otherMsgs;
    const ratio = Math.min(userMsgs, otherMsgs) / Math.max(userMsgs, otherMsgs, 1);
    const reciprocityScore = ratio * 100;

    // Calculate depth score (average message length)
    const avgLength = messages.reduce((sum, m) => sum + m.text.length, 0) / messages.length;
    const depthScore = Math.min(100, avgLength / 2); // 200+ chars = 100

    // Calculate timeliness (already have response time logic, simplified here)
    const responseTimes: number[] = [];
    let lastTime: Date | null = null;
    let lastSender: string | null = null;
    messages.forEach(msg => {
      const msgTime = new Date(msg.timestamp);
      if (lastTime && lastSender !== msg.sender) {
        const diff = (msgTime.getTime() - lastTime.getTime()) / (1000 * 60);
        if (diff > 0 && diff < 1440) responseTimes.push(diff);
      }
      lastTime = msgTime;
      lastSender = msg.sender;
    });
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 60;
    const timelinessScore = Math.max(0, 100 - (avgResponseTime / 2)); // <10min = ~95

    // Calculate consistency (how regular are the conversations)
    const messageDates = messages.map(m => new Date(m.timestamp).toDateString());
    const uniqueDays = new Set(messageDates).size;
    const consistencyScore = Math.min(100, (uniqueDays / 30) * 100);

    // Overall score (weighted average)
    const overallScore = Math.round(
      frequencyScore * 0.25 +
      reciprocityScore * 0.2 +
      depthScore * 0.2 +
      timelinessScore * 0.2 +
      consistencyScore * 0.15
    );

    // Determine level
    let level: EngagementMetrics['level'];
    if (overallScore >= 80) level = 'excellent';
    else if (overallScore >= 60) level = 'good';
    else if (overallScore >= 40) level = 'moderate';
    else if (overallScore >= 20) level = 'low';
    else level = 'minimal';

    // Determine trend (compare recent vs older)
    const recentHalf = messages.slice(-Math.floor(messages.length / 2));
    const olderHalf = messages.slice(0, Math.floor(messages.length / 2));
    const recentFreq = recentHalf.length / Math.max(1, olderHalf.length);
    let trend: EngagementMetrics['trend'] = 'stable';
    if (recentFreq > 1.2) trend = 'rising';
    else if (recentFreq < 0.8) trend = 'falling';

    // Generate insights
    const insights: string[] = [];
    if (reciprocityScore < 50) {
      insights.push(userMsgs > otherMsgs
        ? `${contactName} could be more responsive`
        : 'Consider reaching out more often');
    }
    if (timelinessScore > 80) {
      insights.push('Great response times on both sides!');
    }
    if (depthScore < 40) {
      insights.push('Try having deeper conversations');
    }
    if (consistencyScore > 70) {
      insights.push('You communicate regularly - keep it up!');
    }
    if (trend === 'rising') {
      insights.push('Engagement is increasing - great momentum!');
    }

    return {
      overallScore,
      components: {
        frequency: Math.round(frequencyScore),
        reciprocity: Math.round(reciprocityScore),
        depth: Math.round(depthScore),
        timeliness: Math.round(timelinessScore),
        consistency: Math.round(consistencyScore)
      },
      trend,
      level,
      insights: insights.slice(0, 3)
    };
  }, [messages, contactName]);

  if (!metrics) {
    return compact ? null : (
      <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-2">
        Need more messages to calculate engagement
      </div>
    );
  }

  const getLevelColor = (level: EngagementMetrics['level']) => {
    switch (level) {
      case 'excellent': return 'text-emerald-500';
      case 'good': return 'text-green-500';
      case 'moderate': return 'text-blue-500';
      case 'low': return 'text-amber-500';
      case 'minimal': return 'text-red-500';
    }
  };

  const getLevelBg = (level: EngagementMetrics['level']) => {
    switch (level) {
      case 'excellent': return 'bg-emerald-100 dark:bg-emerald-900/40';
      case 'good': return 'bg-green-100 dark:bg-green-900/40';
      case 'moderate': return 'bg-blue-100 dark:bg-blue-900/40';
      case 'low': return 'bg-amber-100 dark:bg-amber-900/40';
      case 'minimal': return 'bg-red-100 dark:bg-red-900/40';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getLevelBg(metrics.level)}`}>
          <i className={`fa-solid fa-fire text-xs ${getLevelColor(metrics.level)}`} />
        </div>
        <div>
          <div className={`text-sm font-bold ${getLevelColor(metrics.level)}`}>
            {metrics.overallScore}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 capitalize">
            {metrics.level}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getLevelBg(metrics.level)}`}>
              <i className={`fa-solid fa-fire text-sm ${getLevelColor(metrics.level)}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Engagement Score</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">with {contactName}</p>
            </div>
          </div>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showBreakdown ? 'Summary' : 'Breakdown'}
          </button>
        </div>
      </div>

      {/* Main Score */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${getLevelColor(metrics.level)}`}>
              {metrics.overallScore}
            </span>
            <span className={`text-lg font-medium capitalize ${getLevelColor(metrics.level)}`}>
              {metrics.level}
            </span>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            metrics.trend === 'rising' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
            metrics.trend === 'falling' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
            'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
          }`}>
            {metrics.trend === 'rising' && <i className="fa-solid fa-arrow-trend-up" />}
            {metrics.trend === 'falling' && <i className="fa-solid fa-arrow-trend-down" />}
            {metrics.trend === 'stable' && <i className="fa-solid fa-minus" />}
            <span className="capitalize">{metrics.trend}</span>
          </div>
        </div>

        {/* Score Breakdown */}
        {showBreakdown ? (
          <div className="space-y-3">
            {Object.entries(metrics.components).map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-600 dark:text-zinc-400 capitalize">{key}</span>
                  <span className="font-medium text-zinc-800 dark:text-white">{value}</span>
                </div>
                <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      value >= 70 ? 'bg-emerald-500' :
                      value >= 50 ? 'bg-blue-500' :
                      value >= 30 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Visual Ring */}
            <div className="flex justify-center mb-4">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-zinc-200 dark:text-zinc-700"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={`${metrics.overallScore * 2.51} 251`}
                    strokeLinecap="round"
                    className={getLevelColor(metrics.level)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${getLevelColor(metrics.level)}`}>
                    {metrics.overallScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {Object.entries(metrics.components).map(([key, value]) => (
                <div key={key} className="p-1">
                  <div className={`text-sm font-bold ${
                    value >= 70 ? 'text-emerald-500' :
                    value >= 50 ? 'text-blue-500' :
                    value >= 30 ? 'text-amber-500' :
                    'text-red-500'
                  }`}>
                    {value}
                  </div>
                  <div className="text-[8px] text-zinc-400 dark:text-zinc-500 uppercase truncate">
                    {key.slice(0, 4)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Insights */}
        {metrics.insights.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-1.5 mb-2">
              <i className="fa-solid fa-lightbulb text-amber-500 text-xs" />
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Insights
              </span>
            </div>
            <div className="space-y-1.5">
              {metrics.insights.map((insight, idx) => (
                <div key={idx} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5">
                  <i className="fa-solid fa-circle text-[4px] mt-1.5 text-zinc-400" />
                  {insight}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Compact engagement badge
export const EngagementBadge: React.FC<{
  score: number;
  trend?: 'rising' | 'falling' | 'stable';
}> = ({ score, trend }) => {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
    if (s >= 60) return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
    if (s >= 40) return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
    if (s >= 20) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
    return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
  };

  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getColor(score)}`}>
      <i className="fa-solid fa-fire" />
      <span>{score}</span>
      {trend === 'rising' && <i className="fa-solid fa-arrow-up text-[8px]" />}
      {trend === 'falling' && <i className="fa-solid fa-arrow-down text-[8px]" />}
    </div>
  );
};

export default EngagementScoring;

// Response Time Tracker with Insights
import React, { useMemo, useState } from 'react';

interface ResponseMetric {
  contactName: string;
  contactId: string;
  avgResponseTime: number; // in minutes
  trend: 'improving' | 'declining' | 'stable';
  lastResponseTime: number;
  responseCount: number;
  fastestResponse: number;
  slowestResponse: number;
}

interface ResponseTimeTrackerProps {
  messages: Array<{
    id: string;
    sender: 'user' | 'other';
    timestamp: string;
    contactId?: string;
  }>;
  contactName: string;
  compact?: boolean;
}

export const ResponseTimeTracker: React.FC<ResponseTimeTrackerProps> = React.memo(({
  messages = [],
  contactName,
  compact = false
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate response time metrics
  const metrics = useMemo(() => {
    const responseTimes: number[] = [];
    let lastMessageTime: Date | null = null;
    let lastSender: 'user' | 'other' | null = null;

    messages.forEach(msg => {
      const msgTime = new Date(msg.timestamp);

      if (lastMessageTime && lastSender && msg.sender !== lastSender) {
        // This is a response
        const timeDiff = (msgTime.getTime() - lastMessageTime.getTime()) / (1000 * 60); // minutes
        if (timeDiff > 0 && timeDiff < 24 * 60) { // Ignore gaps over 24 hours
          responseTimes.push(timeDiff);
        }
      }

      lastMessageTime = msgTime;
      lastSender = msg.sender;
    });

    if (responseTimes.length === 0) {
      return null;
    }

    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const recentTimes = responseTimes.slice(-5);
    const olderTimes = responseTimes.slice(0, -5);

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentTimes.length > 0 && olderTimes.length > 0) {
      const recentAvg = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
      const olderAvg = olderTimes.reduce((a, b) => a + b, 0) / olderTimes.length;
      if (recentAvg < olderAvg * 0.8) trend = 'improving';
      else if (recentAvg > olderAvg * 1.2) trend = 'declining';
    }

    return {
      avgResponseTime: avgTime,
      trend,
      lastResponseTime: responseTimes[responseTimes.length - 1] || 0,
      responseCount: responseTimes.length,
      fastestResponse: Math.min(...responseTimes),
      slowestResponse: Math.max(...responseTimes),
      distribution: {
        under5min: responseTimes.filter(t => t < 5).length,
        under30min: responseTimes.filter(t => t >= 5 && t < 30).length,
        under1hr: responseTimes.filter(t => t >= 30 && t < 60).length,
        over1hr: responseTimes.filter(t => t >= 60).length
      }
    };
  }, [messages]);

  const formatTime = (minutes: number): string => {
    if (minutes < 1) return 'instant';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  const getSpeedLabel = (minutes: number): { label: string; color: string } => {
    if (minutes < 5) return { label: 'Lightning', color: 'text-emerald-500' };
    if (minutes < 30) return { label: 'Quick', color: 'text-green-500' };
    if (minutes < 60) return { label: 'Normal', color: 'text-blue-500' };
    if (minutes < 180) return { label: 'Slow', color: 'text-amber-500' };
    return { label: 'Delayed', color: 'text-red-500' };
  };

  if (!metrics) {
    return compact ? null : (
      <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-2">
        Not enough data to calculate response times
      </div>
    );
  }

  const speedInfo = getSpeedLabel(metrics.avgResponseTime);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <i className={`fa-solid fa-bolt text-xs ${speedInfo.color}`} />
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {formatTime(metrics.avgResponseTime)} avg
          </span>
        </div>
        <div className="flex items-center gap-1">
          {metrics.trend === 'improving' && <i className="fa-solid fa-arrow-trend-up text-emerald-500 text-[10px]" />}
          {metrics.trend === 'declining' && <i className="fa-solid fa-arrow-trend-down text-red-500 text-[10px]" />}
          {metrics.trend === 'stable' && <i className="fa-solid fa-minus text-zinc-400 text-[10px]" />}
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
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <i className="fa-solid fa-stopwatch text-blue-500 text-sm" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white">Response Time</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">with {contactName}</p>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showDetails ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-zinc-900 dark:text-white">
                {formatTime(metrics.avgResponseTime)}
              </span>
              <span className={`text-sm font-medium ${speedInfo.color}`}>
                {speedInfo.label}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Average response time
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            metrics.trend === 'improving' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
            metrics.trend === 'declining' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
            'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
          }`}>
            {metrics.trend === 'improving' && <i className="fa-solid fa-arrow-trend-up" />}
            {metrics.trend === 'declining' && <i className="fa-solid fa-arrow-trend-down" />}
            {metrics.trend === 'stable' && <i className="fa-solid fa-minus" />}
            <span className="capitalize">{metrics.trend}</span>
          </div>
        </div>

        {/* Distribution Bar */}
        <div className="mb-4">
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1.5 flex justify-between">
            <span>Response Distribution</span>
            <span>{metrics.responseCount} responses</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700">
            {metrics.distribution.under5min > 0 && (
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${(metrics.distribution.under5min / metrics.responseCount) * 100}%` }}
                title={`Under 5min: ${metrics.distribution.under5min}`}
              />
            )}
            {metrics.distribution.under30min > 0 && (
              <div
                className="bg-green-500 h-full"
                style={{ width: `${(metrics.distribution.under30min / metrics.responseCount) * 100}%` }}
                title={`5-30min: ${metrics.distribution.under30min}`}
              />
            )}
            {metrics.distribution.under1hr > 0 && (
              <div
                className="bg-blue-500 h-full"
                style={{ width: `${(metrics.distribution.under1hr / metrics.responseCount) * 100}%` }}
                title={`30min-1hr: ${metrics.distribution.under1hr}`}
              />
            )}
            {metrics.distribution.over1hr > 0 && (
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${(metrics.distribution.over1hr / metrics.responseCount) * 100}%` }}
                title={`Over 1hr: ${metrics.distribution.over1hr}`}
              />
            )}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-emerald-500">{'<5m'}</span>
            <span className="text-[9px] text-green-500">5-30m</span>
            <span className="text-[9px] text-blue-500">30m-1h</span>
            <span className="text-[9px] text-amber-500">{'>1h'}</span>
          </div>
        </div>

        {/* Detailed Stats */}
        {showDetails && (
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-700">
            <div className="text-center">
              <div className="text-lg font-bold text-zinc-900 dark:text-white">
                {formatTime(metrics.fastestResponse)}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Fastest</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-zinc-900 dark:text-white">
                {formatTime(metrics.lastResponseTime)}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Last</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-zinc-900 dark:text-white">
                {formatTime(metrics.slowestResponse)}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Slowest</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Mini response time badge for inline use
export const ResponseTimeBadge: React.FC<{
  avgTime: number;
  trend: 'improving' | 'declining' | 'stable';
}> = ({ avgTime, trend }) => {
  const formatTime = (minutes: number): string => {
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${Math.round(minutes / 60)}h`;
  };

  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
      avgTime < 30 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
      avgTime < 120 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
    }`}>
      <i className="fa-solid fa-bolt" />
      <span>{formatTime(avgTime)}</span>
      {trend === 'improving' && <i className="fa-solid fa-arrow-up text-[8px]" />}
      {trend === 'declining' && <i className="fa-solid fa-arrow-down text-[8px]" />}
    </div>
  );
};

export default ResponseTimeTracker;

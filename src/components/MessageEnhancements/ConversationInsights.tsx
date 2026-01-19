import React, { useState, useMemo } from 'react';

// Types
interface ConversationMetrics {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  avgResponseTime: number; // minutes
  longestStreak: number; // days
  currentStreak: number;
  topContacts: TopContact[];
  activityByHour: number[];
  activityByDay: number[];
  sentimentTrend: SentimentPoint[];
  messageTypes: MessageTypeBreakdown;
}

interface TopContact {
  id: string;
  name: string;
  avatar?: string;
  messageCount: number;
  avgResponseTime: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  lastActive: Date;
}

interface SentimentPoint {
  date: Date;
  score: number; // -1 to 1
  messageCount: number;
}

interface MessageTypeBreakdown {
  text: number;
  media: number;
  voice: number;
  documents: number;
  links: number;
}

interface InsightCard {
  id: string;
  type: 'achievement' | 'tip' | 'trend' | 'alert';
  title: string;
  description: string;
  icon: string;
  color: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ConversationInsightsProps {
  onContactSelect?: (contactId: string) => void;
  onInsightAction?: (insightId: string) => void;
}

// Mock data generator
const generateMockMetrics = (): ConversationMetrics => ({
  totalMessages: 2847,
  sentMessages: 1423,
  receivedMessages: 1424,
  avgResponseTime: 12,
  longestStreak: 45,
  currentStreak: 12,
  topContacts: [
    { id: '1', name: 'Alice Chen', messageCount: 342, avgResponseTime: 8, sentiment: 'positive', lastActive: new Date(Date.now() - 1000 * 60 * 30) },
    { id: '2', name: 'Bob Smith', messageCount: 256, avgResponseTime: 15, sentiment: 'neutral', lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    { id: '3', name: 'Carol Davis', messageCount: 198, avgResponseTime: 5, sentiment: 'positive', lastActive: new Date(Date.now() - 1000 * 60 * 60 * 5) },
    { id: '4', name: 'David Wilson', messageCount: 167, avgResponseTime: 22, sentiment: 'negative', lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24) },
    { id: '5', name: 'Eve Thompson', messageCount: 145, avgResponseTime: 10, sentiment: 'positive', lastActive: new Date(Date.now() - 1000 * 60 * 60 * 48) }
  ],
  activityByHour: [5, 8, 12, 25, 45, 78, 120, 180, 210, 195, 165, 145, 130, 125, 140, 155, 170, 185, 150, 110, 75, 45, 25, 10],
  activityByDay: [180, 245, 310, 285, 265, 120, 95],
  sentimentTrend: [
    { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), score: 0.3, messageCount: 180 },
    { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), score: 0.5, messageCount: 245 },
    { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), score: 0.4, messageCount: 310 },
    { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), score: 0.6, messageCount: 285 },
    { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), score: 0.7, messageCount: 265 },
    { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), score: 0.55, messageCount: 120 },
    { date: new Date(), score: 0.65, messageCount: 95 }
  ],
  messageTypes: {
    text: 2150,
    media: 385,
    voice: 125,
    documents: 112,
    links: 75
  }
});

const generateMockInsights = (): InsightCard[] => [
  {
    id: '1',
    type: 'achievement',
    title: '12-Day Streak!',
    description: 'You\'ve been consistently responsive for 12 days straight.',
    icon: 'fa-fire',
    color: 'orange'
  },
  {
    id: '2',
    type: 'tip',
    title: 'Best Time to Message',
    description: 'Your contacts are most responsive between 9-11 AM.',
    icon: 'fa-clock',
    color: 'blue'
  },
  {
    id: '3',
    type: 'trend',
    title: 'Sentiment Improving',
    description: 'Your conversation tone has improved 23% this week.',
    icon: 'fa-chart-line',
    color: 'green'
  },
  {
    id: '4',
    type: 'alert',
    title: 'Pending Response',
    description: 'You have 3 messages waiting over 24 hours.',
    icon: 'fa-bell',
    color: 'red'
  }
];

export const ConversationInsights: React.FC<ConversationInsightsProps> = ({
  onContactSelect,
  onInsightAction
}) => {
  const [metrics] = useState<ConversationMetrics>(generateMockMetrics);
  const [insights] = useState<InsightCard[]>(generateMockInsights);
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'activity' | 'insights'>('overview');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const maxHourActivity = useMemo(() => Math.max(...metrics.activityByHour), [metrics.activityByHour]);
  const maxDayActivity = useMemo(() => Math.max(...metrics.activityByDay), [metrics.activityByDay]);

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive': return 'text-green-500';
      case 'negative': return 'text-red-500';
      default: return 'text-zinc-500';
    }
  };

  const getInsightColor = (color: string): { bg: string; text: string; border: string } => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
      blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
      green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
      red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
      purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' }
    };
    return colors[color] || colors.blue;
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-cyan-200 dark:border-cyan-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm">
            <i className="fa-solid fa-chart-pie text-cyan-500" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Conversation Insights</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">{metrics.totalMessages.toLocaleString()} messages analyzed</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{metrics.sentMessages}</p>
            <p className="text-xs text-zinc-500">Sent</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.receivedMessages}</p>
            <p className="text-xs text-zinc-500">Received</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.avgResponseTime}m</p>
            <p className="text-xs text-zinc-500">Avg Response</p>
          </div>
          <div className="bg-white/50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <i className="fa-solid fa-fire text-orange-500" />
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{metrics.currentStreak}</p>
            </div>
            <p className="text-xs text-zinc-500">Day Streak</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
        {[
          { id: 'overview' as const, label: 'Overview', icon: 'fa-home' },
          { id: 'contacts' as const, label: 'Contacts', icon: 'fa-users' },
          { id: 'activity' as const, label: 'Activity', icon: 'fa-chart-bar' },
          { id: 'insights' as const, label: 'Insights', icon: 'fa-lightbulb' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition ${
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Message Types */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Message Types</p>
            <div className="space-y-2">
              {Object.entries(metrics.messageTypes).map(([type, count]) => {
                const icons: Record<string, string> = {
                  text: 'fa-comment',
                  media: 'fa-image',
                  voice: 'fa-microphone',
                  documents: 'fa-file',
                  links: 'fa-link'
                };
                const percentage = Math.round((count / metrics.totalMessages) * 100);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                      <i className={`fa-solid ${icons[type]} text-zinc-500 text-sm`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="capitalize text-zinc-700 dark:text-zinc-300">{type}</span>
                        <span className="text-zinc-500">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sentiment Trend Mini */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Weekly Sentiment</p>
            <div className="flex items-end justify-between h-20 gap-1">
              {metrics.sentimentTrend.map((point, i) => {
                const height = Math.round(((point.score + 1) / 2) * 100);
                const color = point.score > 0.3 ? 'bg-green-500' : point.score < -0.3 ? 'bg-red-500' : 'bg-yellow-500';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full ${color} rounded-t transition-all`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] text-zinc-400">{dayNames[point.date.getDay()]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="space-y-2">
          {metrics.topContacts.map((contact, index) => (
            <button
              key={contact.id}
              onClick={() => onContactSelect?.(contact.id)}
              className="w-full p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-cyan-300 dark:hover:border-cyan-700 transition text-left"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold">
                    {contact.name.charAt(0)}
                  </div>
                  <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-zinc-900 text-white text-[10px] flex items-center justify-center font-bold">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-zinc-900 dark:text-white">{contact.name}</p>
                    <i className={`fa-solid fa-face-smile ${getSentimentColor(contact.sentiment)} text-xs`} />
                  </div>
                  <p className="text-xs text-zinc-500">{formatTimeAgo(contact.lastActive)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{contact.messageCount}</p>
                  <p className="text-xs text-zinc-500">~{contact.avgResponseTime}m response</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Time Range Selector */}
          <div className="flex gap-1 justify-end">
            {(['week', 'month', 'year'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  timeRange === range
                    ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          {/* Hourly Activity */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Activity by Hour</p>
            <div className="flex items-end justify-between h-32 gap-0.5">
              {metrics.activityByHour.map((count, hour) => {
                const height = Math.round((count / maxHourActivity) * 100);
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-cyan-500 dark:bg-cyan-400 rounded-t hover:bg-cyan-600 transition-all cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${hour}:00 - ${count} messages`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-zinc-400">
              <span>12am</span>
              <span>6am</span>
              <span>12pm</span>
              <span>6pm</span>
              <span>12am</span>
            </div>
          </div>

          {/* Daily Activity */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">Activity by Day</p>
            <div className="flex items-end justify-between h-24 gap-2">
              {metrics.activityByDay.map((count, day) => {
                const height = Math.round((count / maxDayActivity) * 100);
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-500 dark:bg-blue-400 rounded-t hover:bg-blue-600 transition-all cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${dayNames[day]} - ${count} messages`}
                    />
                    <span className="text-[10px] text-zinc-400">{dayNames[day]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-2">
          {insights.map(insight => {
            const colors = getInsightColor(insight.color);
            return (
              <div
                key={insight.id}
                className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center ${colors.text}`}>
                    <i className={`fa-solid ${insight.icon}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium text-sm ${colors.text}`}>{insight.title}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{insight.description}</p>
                    {insight.action && (
                      <button
                        onClick={() => {
                          insight.action?.onClick();
                          onInsightAction?.(insight.id);
                        }}
                        className={`mt-2 text-xs font-medium ${colors.text} hover:underline`}
                      >
                        {insight.action.label} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Compact Insights Badge
interface InsightsBadgeProps {
  unreadInsights: number;
  onClick?: () => void;
}

export const InsightsBadge: React.FC<InsightsBadgeProps> = ({ unreadInsights, onClick }) => (
  <button
    onClick={onClick}
    className="relative p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
  >
    <i className="fa-solid fa-chart-pie text-zinc-500" />
    {unreadInsights > 0 && (
      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-white text-[10px] flex items-center justify-center">
        {unreadInsights}
      </span>
    )}
  </button>
);

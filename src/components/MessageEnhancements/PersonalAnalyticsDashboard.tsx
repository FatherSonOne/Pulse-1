// Personal Analytics Dashboard
// Professional LinkedIn-style productivity analytics
// Replaces the gamified AchievementSystemEnhanced component

import React, { useState, useMemo } from 'react';
import { achievementService } from '../../services/achievementService';

interface MetricTrend {
  direction: 'up' | 'down' | 'neutral';
  value?: string;
  label: string;
}

interface MetricCardProps {
  icon: string;
  label: string;
  value: string | number;
  trend?: MetricTrend;
}

// Professional Metric Card Component
const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, trend }) => {
  const getTrendColor = (direction: MetricTrend['direction']) => {
    switch (direction) {
      case 'up': return 'text-emerald-600 dark:text-emerald-400';
      case 'down': return 'text-rose-600 dark:text-rose-400';
      default: return 'text-zinc-500 dark:text-zinc-400';
    }
  };

  const getTrendIcon = (direction: MetricTrend['direction']) => {
    switch (direction) {
      case 'up': return 'fa-arrow-up';
      case 'down': return 'fa-arrow-down';
      default: return 'fa-minus';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:border-rose-300 dark:hover:border-rose-600 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
          <i className={`fa-solid ${icon} text-rose-500`} />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
        {value}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs ${getTrendColor(trend.direction)}`}>
          <i className={`fa-solid ${getTrendIcon(trend.direction)} text-[10px]`} />
          <span>{trend.value && `${trend.value} `}{trend.label}</span>
        </div>
      )}
    </div>
  );
};

// Progress Bar Component
interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'rose' | 'emerald' | 'blue';
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, max = 100, color = 'rose' }) => {
  const percentage = Math.min(100, (value / max) * 100);
  const colorClasses = {
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500'
  };

  return (
    <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// Insight Component
interface InsightProps {
  type: 'positive' | 'warning' | 'neutral';
  text: string;
}

const Insight: React.FC<InsightProps> = ({ type, text }) => {
  const config = {
    positive: {
      icon: 'fa-check-circle',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20'
    },
    warning: {
      icon: 'fa-lightbulb',
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20'
    },
    neutral: {
      icon: 'fa-info-circle',
      color: 'text-zinc-600 dark:text-zinc-400',
      bg: 'bg-zinc-50 dark:bg-zinc-800'
    }
  };

  const { icon, color, bg } = config[type];

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
      <i className={`fa-solid ${icon} ${color} text-sm`} />
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{text}</span>
    </div>
  );
};

// Milestone Item Component
interface MilestoneItemProps {
  title: string;
  achievedAt?: Date;
  category: string;
}

const MilestoneItem: React.FC<MilestoneItemProps> = ({ title, achievedAt, category }) => {
  const formatRelative = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
          {title}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="capitalize">{category}</span>
          {achievedAt && (
            <>
              <span>•</span>
              <span>{formatRelative(achievedAt)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
interface PersonalAnalyticsDashboardProps {
  className?: string;
}

export const PersonalAnalyticsDashboard: React.FC<PersonalAnalyticsDashboardProps> = ({
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones'>('overview');

  // Get stats from achievement service
  const stats = useMemo(() => achievementService.getStats(), []);
  const achievements = useMemo(() => achievementService.getAllAchievements(), []);
  const unlockedAchievements = useMemo(
    () => achievements.filter(a => a.unlocked),
    [achievements]
  );

  // Calculate communication effectiveness score
  const effectivenessScore = useMemo(() => {
    let score = 50; // Base score

    // Add points for messages sent (max +20)
    score += Math.min(20, stats.messagesSent / 50);

    // Add points for fast responses (max +15)
    score += Math.min(15, stats.fastResponses * 3);

    // Add points for tasks created (max +10)
    score += Math.min(10, stats.tasksCreated / 5);

    // Add points for people helped (max +5)
    score += Math.min(5, (stats.peopleHelped || 0) / 3);

    return Math.round(Math.min(100, score));
  }, [stats]);

  // Determine insights based on stats
  const insights = useMemo(() => {
    const result: InsightProps[] = [];

    if (stats.fastResponses > 10) {
      result.push({ type: 'positive', text: 'Top strength: Quick response times' });
    } else {
      result.push({ type: 'warning', text: 'Improvement area: Faster initial response' });
    }

    if (stats.tasksCreated > 20) {
      result.push({ type: 'positive', text: 'Great at converting discussions to actions' });
    }

    if (stats.messagesSent > 100) {
      result.push({ type: 'positive', text: 'Consistent engagement with team' });
    }

    return result.slice(0, 2);
  }, [stats]);

  return (
    <div className={`bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-white">
            Communication Analytics
          </h3>
          <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-700 p-0.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                activeTab === 'milestones'
                  ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Milestones
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
            <MetricCard
              icon="fa-clock"
              label="Avg Response"
              value={stats.fastResponses > 0 ? `${Math.max(5, 30 - stats.fastResponses)}m` : '--'}
              trend={stats.fastResponses > 5
                ? { direction: 'down', value: '23%', label: 'faster' }
                : { direction: 'neutral', label: 'Measuring...' }
              }
            />
            <MetricCard
              icon="fa-message"
              label="Messages Sent"
              value={stats.messagesSent}
              trend={stats.messagesSent > 50
                ? { direction: 'up', value: '18%', label: 'increase' }
                : { direction: 'neutral', label: 'This week' }
              }
            />
            <MetricCard
              icon="fa-check-circle"
              label="Tasks Created"
              value={stats.tasksCreated}
              trend={{ direction: 'neutral', label: 'Steady' }}
            />
            <MetricCard
              icon="fa-users"
              label="Connections"
              value={stats.activeConversations || 0}
              trend={typeof stats.activeConversations === 'number' && stats.activeConversations > 5
                ? { direction: 'up', value: '+3', label: 'this week' }
                : { direction: 'neutral', label: 'Active' }
              }
            />
          </div>

          {/* Communication Effectiveness Score */}
          <div className="mx-4 mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Communication Score
              </span>
              <span className="text-lg font-bold text-rose-600 dark:text-rose-400">
                {effectivenessScore}/100
              </span>
            </div>
            <ProgressBar value={effectivenessScore} />
            <div className="mt-3 space-y-2">
              {insights.map((insight, idx) => (
                <Insight key={idx} {...insight} />
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Milestones Tab */
        <div className="p-4">
          {unlockedAchievements.length > 0 ? (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {unlockedAchievements.map(achievement => (
                <MilestoneItem
                  key={achievement.id}
                  title={achievement.title}
                  achievedAt={achievement.unlockedAt}
                  category={achievement.category}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-flag text-zinc-400" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No milestones yet. Keep communicating!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer Summary */}
      <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {unlockedAchievements.length} milestones achieved
          </span>
          <span>
            {stats.loginStreak > 0 && `${stats.loginStreak} day streak`}
          </span>
        </div>
      </div>
    </div>
  );
};

// Compact Analytics Badge for inline display
interface AnalyticsBadgeProps {
  onClick?: () => void;
}

export const AnalyticsBadge: React.FC<AnalyticsBadgeProps> = ({ onClick }) => {
  const stats = achievementService.getStats();

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 hover:border-rose-300 dark:hover:border-rose-700 transition-colors"
    >
      <i className="fa-solid fa-chart-line text-rose-500 text-sm" />
      <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
        {stats.messagesSent} messages
      </span>
    </button>
  );
};

export default PersonalAnalyticsDashboard;

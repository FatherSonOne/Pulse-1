// Conversation Health Component
import React from 'react';
import { TrendingUp, TrendingDown, Minus, Heart, MessageCircle, CheckCircle, Lightbulb } from 'lucide-react';
import type { ConversationHealth } from '../../types/messageEnhancements';

interface ConversationHealthProps {
  health: ConversationHealth;
  compact?: boolean;
}

export const ConversationHealthWidget: React.FC<ConversationHealthProps> = ({
  health,
  compact = false
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-blue-600 dark:text-blue-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };
  
  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'bg-blue-100 dark:bg-blue-900/30';
    if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };
  
  const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
      case 'declining':
        return <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />;
      default:
        return <Minus className="w-3 h-3 text-gray-600 dark:text-gray-400" />;
    }
  };
  
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getScoreBg(health.score)}`}>
          <Heart className={`w-4 h-4 ${getScoreColor(health.score)}`} />
        </div>
        <div>
          <div className={`text-sm font-semibold ${getScoreColor(health.score)}`}>
            {health.score}/100
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Health Score
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getScoreBg(health.score)}`}>
            <Heart className={`w-6 h-6 ${getScoreColor(health.score)}`} />
          </div>
          <div>
            <div className={`text-2xl font-bold ${getScoreColor(health.score)}`}>
              {health.score}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Health Score
            </div>
          </div>
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Response Time</span>
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {health.responseTime.average.toFixed(1)}h
          </div>
          <div className="flex items-center gap-1 mt-1">
            {getTrendIcon(health.responseTime.trend)}
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {health.responseTime.trend}
            </span>
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Engagement</span>
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {health.engagement.level}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {health.engagement.participationRate.toFixed(1)} msgs/day
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Sentiment</span>
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {health.sentiment.overall}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Productivity</span>
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {health.productivity.tasksCreated + health.productivity.decisionsCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tasks & Decisions
          </div>
        </div>
      </div>
      
      {/* Issues & Recommendations */}
      {health.issues.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Recommendations
            </span>
          </div>
          <div className="space-y-2">
            {health.recommendations.slice(0, 3).map((rec, index) => (
              <div
                key={index}
                className="text-xs text-gray-600 dark:text-gray-400 pl-6 relative before:content-['•'] before:absolute before:left-2"
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

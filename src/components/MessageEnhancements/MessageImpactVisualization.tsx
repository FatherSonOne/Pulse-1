// Message Impact Visualization Component
import React from 'react';
import { Eye, MessageSquare, CheckCircle, Zap, TrendingUp } from 'lucide-react';
import type { MessageImpact } from '../../types/messageEnhancements';

interface MessageImpactVisualizationProps {
  impact: MessageImpact;
  compact?: boolean;
}

export const MessageImpactVisualization: React.FC<MessageImpactVisualizationProps> = ({
  impact,
  compact = false
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 5) return 'text-blue-600 dark:text-blue-400';
    if (score >= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };
  
  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-green-100 dark:bg-green-900/30';
    if (score >= 5) return 'bg-blue-100 dark:bg-blue-900/30';
    if (score >= 3) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-gray-100 dark:bg-gray-700';
  };
  
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <div className={`flex items-center gap-1 ${getScoreColor(impact.score)}`}>
          <Zap className="w-3 h-3" />
          <span className="font-medium">{impact.score.toFixed(1)}</span>
        </div>
        {impact.immediateReaders > 0 && (
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Eye className="w-3 h-3" />
            <span>{impact.immediateReaders}</span>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getScoreBg(impact.score)}`}>
          <Zap className={`w-5 h-5 ${getScoreColor(impact.score)}`} />
        </div>
        <div>
          <div className={`text-xl font-bold ${getScoreColor(impact.score)}`}>
            {impact.score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Impact Score
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Eye className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Immediate</span>
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {impact.immediateReaders}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Referenced</span>
          </div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {impact.referencedCount}
          </div>
        </div>
        
        {impact.decisionsGenerated > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Decisions</span>
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {impact.decisionsGenerated}
            </div>
          </div>
        )}
        
        {impact.actionsGenerated > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-orange-600 dark:text-orange-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Actions</span>
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {impact.actionsGenerated}
            </div>
          </div>
        )}
      </div>
      
      {impact.engagementRate > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Engagement Rate: {impact.engagementRate.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
};

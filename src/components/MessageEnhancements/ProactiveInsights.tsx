// Proactive Insights Component
import React from 'react';
import { Lightbulb, AlertCircle, TrendingUp, FileText, Users, X } from 'lucide-react';
import type { ProactiveInsight } from '../../types/messageEnhancements';

interface ProactiveInsightsProps {
  insights: ProactiveInsight[];
  onDismiss: (index: number) => void;
  onActionClick: (action: string) => void;
}

export const ProactiveInsights: React.FC<ProactiveInsightsProps> = ({
  insights,
  onDismiss,
  onActionClick
}) => {
  if (insights.length === 0) return null;
  
  const getIcon = (type: ProactiveInsight['type']) => {
    switch (type) {
      case 'blocker':
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'prediction':
        return <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'opportunity':
        return <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Lightbulb className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    }
  };
  
  const getColorClasses = (type: ProactiveInsight['type']) => {
    switch (type) {
      case 'blocker':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
      case 'prediction':
        return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20';
      case 'opportunity':
        return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20';
    }
  };
  
  return (
    <div className="space-y-3 mb-4">
      {insights.map((insight, index) => (
        <div
          key={index}
          className={`border rounded-lg p-4 ${getColorClasses(insight.type)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(insight.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {insight.title}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    {insight.description}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full"
                        style={{ width: `${insight.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {Math.round(insight.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onDismiss(index)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Suggested Actions */}
              {insight.suggestedActions.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Suggested Actions:
                  </div>
                  <div className="space-y-1.5">
                    {insight.suggestedActions.map((action, actionIndex) => (
                      <button
                        key={actionIndex}
                        onClick={() => onActionClick(action)}
                        className="block w-full text-left text-xs px-3 py-2 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-700"
                      >
                        → {action}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Related Resources */}
              {(insight.relevantDocs.length > 0 || insight.relatedPeople.length > 0) && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap gap-3">
                    {insight.relevantDocs.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <FileText className="w-3 h-3" />
                        <span>{insight.relevantDocs.length} relevant docs</span>
                      </div>
                    )}
                    {insight.relatedPeople.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Users className="w-3 h-3" />
                        <span>{insight.relatedPeople.length} related people</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

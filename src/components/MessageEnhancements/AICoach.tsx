// AI Coach Component
import React from 'react';
import { AlertTriangle, Info, MessageCircle, X } from 'lucide-react';
import type { AICoachSuggestion } from '../../types/messageEnhancements';

interface AICoachProps {
  suggestions: AICoachSuggestion[];
  onApplySuggestion: (suggestion: AICoachSuggestion) => void;
  onDismiss: (index: number) => void;
}

export const AICoach: React.FC<AICoachProps> = ({
  suggestions,
  onApplySuggestion,
  onDismiss
}) => {
  if (suggestions.length === 0) return null;
  
  const getIcon = (severity: AICoachSuggestion['severity']) => {
    switch (severity) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };
  
  const getColorClasses = (severity: AICoachSuggestion['severity']) => {
    switch (severity) {
      case 'warning':
        return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
      case 'error':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
      default:
        return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20';
    }
  };
  
  return (
    <div className="space-y-2 mb-3">
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className={`border rounded-lg p-3 ${getColorClasses(suggestion.severity)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(suggestion.severity)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {suggestion.message}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {suggestion.suggestion}
                  </div>
                </div>
                <button
                  onClick={() => onDismiss(index)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {suggestion.alternativeText && (
                <button
                  onClick={() => onApplySuggestion(suggestion)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3" />
                  Apply suggested version
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

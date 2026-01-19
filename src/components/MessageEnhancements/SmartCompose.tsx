// Smart Compose Component
import React, { useState, useEffect } from 'react';
import { Sparkles, Zap } from 'lucide-react';
import type { SmartComposeSuggestion } from '../../types/messageEnhancements';

interface SmartComposeProps {
  text: string;
  suggestions: SmartComposeSuggestion[];
  onSelectSuggestion: (text: string) => void;
  loading?: boolean;
}

export const SmartCompose: React.FC<SmartComposeProps> = ({
  text,
  suggestions,
  onSelectSuggestion,
  loading
}) => {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    // Show suggestions when there are any and text is long enough
    setVisible(suggestions.length > 0 && text.length > 10);
  }, [suggestions, text]);
  
  if (!visible && !loading) return null;
  
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Generating suggestions...</span>
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Smart Suggestions
              </span>
              <button
                onClick={() => setVisible(false)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Dismiss
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onSelectSuggestion(suggestion.text);
                    setVisible(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                        {suggestion.text}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {suggestion.type}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-12 bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                            <div
                              className="bg-blue-600 h-1 rounded-full"
                              style={{ width: `${suggestion.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { meetingDetectionService, SuggestedEvent } from '../services/meetingDetectionService';
import { CalendarEvent } from '../types';

interface SuggestedEventsPanelProps {
  onAcceptEvent: (event: Partial<CalendarEvent>) => void;
}

export const SuggestedEventsPanel: React.FC<SuggestedEventsPanelProps> = ({
  onAcceptEvent,
}) => {
  const [suggestions, setSuggestions] = useState<SuggestedEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadSuggestions();

    // Listen for new suggestions (custom event)
    const handleNewSuggestion = () => {
      loadSuggestions();
    };

    window.addEventListener('pulse:new-suggestion', handleNewSuggestion);
    return () => window.removeEventListener('pulse:new-suggestion', handleNewSuggestion);
  }, []);

  const loadSuggestions = () => {
    const pending = meetingDetectionService.getPendingSuggestedEvents();
    setSuggestions(pending);
  };

  const handleAccept = (suggestion: SuggestedEvent) => {
    onAcceptEvent(suggestion.event);
    meetingDetectionService.acceptSuggestedEvent(suggestion.id);
    loadSuggestions();
  };

  const handleDismiss = (id: string) => {
    meetingDetectionService.dismissSuggestedEvent(id);
    loadSuggestions();
  };

  const handleClearAll = () => {
    suggestions.forEach(s => meetingDetectionService.dismissSuggestedEvent(s.id));
    loadSuggestions();
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'conversation':
        return 'fa-comments';
      case 'email':
        return 'fa-envelope';
      case 'vox':
        return 'fa-microphone';
      default:
        return 'fa-calendar';
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
            <i className="fa-solid fa-sparkles text-white text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              AI Suggested Events
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {suggestions.length} {suggestions.length === 1 ? 'suggestion' : 'suggestions'} from conversations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {suggestions.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
            >
              Clear all
            </button>
          )}
          <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition">
            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
          </button>
        </div>
      </div>

      {/* Suggestions List */}
      {isExpanded && (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-96 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
            >
              {/* Event Info */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <i className={`fa-solid ${getSourceIcon(suggestion.source)} text-blue-600 dark:text-blue-400`}></i>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title */}
                  {suggestion.event.title && (
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1 truncate">
                      {suggestion.event.title}
                    </h4>
                  )}

                  {/* Time */}
                  {suggestion.event.start && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                      <i className="fa-regular fa-clock mr-1.5"></i>
                      {formatTime(suggestion.event.start)}
                    </p>
                  )}

                  {/* Context */}
                  {suggestion.context && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 italic line-clamp-2">
                      "{suggestion.context}"
                    </p>
                  )}
                </div>

                {/* Confidence Badge */}
                <div className="flex-shrink-0">
                  <div className={`text-xs font-medium px-2 py-1 rounded ${
                    suggestion.confidence >= 80
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : suggestion.confidence >= 60
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  }`}>
                    {suggestion.confidence}%
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAccept(suggestion)}
                  className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition"
                >
                  <i className="fa-solid fa-plus mr-1.5"></i>
                  Add to Calendar
                </button>
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestedEventsPanel;

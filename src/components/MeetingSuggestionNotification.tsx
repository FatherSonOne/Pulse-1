import React, { useState } from 'react';
import { SuggestedEvent } from '../services/meetingDetectionService';

interface MeetingSuggestionNotificationProps {
  suggestion: SuggestedEvent;
  onAccept: (suggestion: SuggestedEvent) => void;
  onDismiss: (id: string) => void;
}

export const MeetingSuggestionNotification: React.FC<MeetingSuggestionNotificationProps> = ({
  suggestion,
  onAccept,
  onDismiss,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const getSourceIcon = () => {
    switch (suggestion.source) {
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

  const getConfidenceColor = () => {
    if (suggestion.confidence >= 80) return 'text-green-500';
    if (suggestion.confidence >= 60) return 'text-yellow-500';
    return 'text-orange-500';
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-lg animate-slide-in-right">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <i className={`fa-solid ${getSourceIcon()} text-white text-sm`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>Meeting Detected</span>
              <i className="fa-solid fa-sparkles text-purple-500 text-xs"></i>
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              From {suggestion.source}
            </p>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Event Preview */}
      {suggestion.event && (
        <div className="space-y-2 mb-3">
          {/* Title */}
          {suggestion.event.title && (
            <div className="flex items-start gap-2">
              <i className="fa-solid fa-calendar-check text-blue-500 text-sm mt-0.5 flex-shrink-0"></i>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {suggestion.event.title}
              </p>
            </div>
          )}

          {/* Time */}
          {suggestion.event.start && (
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <i className="fa-regular fa-clock w-4 text-zinc-400"></i>
              <span>{formatTime(suggestion.event.start)}</span>
            </div>
          )}

          {/* Location */}
          {suggestion.event.location && (
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <i className="fa-solid fa-location-dot w-4 text-zinc-400"></i>
              <span className="truncate">{suggestion.event.location}</span>
            </div>
          )}
        </div>
      )}

      {/* Context */}
      {!isExpanded && suggestion.context && (
        <button
          onClick={() => setIsExpanded(true)}
          className="text-xs text-zinc-500 dark:text-zinc-400 italic line-clamp-2 text-left hover:text-zinc-700 dark:hover:text-zinc-300 transition"
        >
          "{suggestion.context}"
        </button>
      )}

      {isExpanded && suggestion.context && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 italic mb-3 p-2 bg-white/50 dark:bg-black/20 rounded">
          "{suggestion.context}"
        </div>
      )}

      {/* Confidence Indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300`}
            style={{ width: `${suggestion.confidence}%` }}
          ></div>
        </div>
        <span className={`text-xs font-medium ${getConfidenceColor()}`}>
          {suggestion.confidence}%
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onAccept(suggestion)}
          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-plus"></i>
          Add to Calendar
        </button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default MeetingSuggestionNotification;

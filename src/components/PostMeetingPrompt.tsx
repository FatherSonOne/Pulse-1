import React, { useState } from 'react';
import { MeetingFollowUp, FollowUpSuggestion } from '../services/postMeetingService';

interface PostMeetingPromptProps {
  followUp: MeetingFollowUp;
  onCreateAction: (suggestion: FollowUpSuggestion) => void;
  onDismiss: (id: string) => void;
  onSkip: (id: string) => void;
}

export const PostMeetingPrompt: React.FC<PostMeetingPromptProps> = ({
  followUp,
  onCreateAction,
  onDismiss,
  onSkip,
}) => {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');

  const toggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleCreateSelected = () => {
    selectedSuggestions.forEach(index => {
      onCreateAction(followUp.suggestions[index]);
    });
  };

  const timeSinceEnd = () => {
    const minutes = Math.floor((Date.now() - followUp.eventEnd.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'text-zinc-500 bg-zinc-50 dark:bg-zinc-900/20';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 rounded-2xl shadow-xl overflow-hidden animate-slide-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4 text-white">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <i className="fa-solid fa-calendar-check text-lg"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold">How did your meeting go?</h3>
              <p className="text-sm text-purple-100">
                {followUp.eventTitle} • {timeSinceEnd()}
              </p>
            </div>
          </div>
          <button
            onClick={() => onDismiss(followUp.id)}
            className="text-white/80 hover:text-white transition"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Quick Note */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Quick notes from the meeting (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key decisions, action items, next steps..."
            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            rows={3}
          />
        </div>

        {/* Suggestions */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
            <i className="fa-solid fa-sparkles text-purple-500"></i>
            Suggested follow-up actions
          </h4>
          <div className="space-y-2">
            {followUp.suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => toggleSuggestion(index)}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  selectedSuggestions.has(index)
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-purple-300 dark:hover:border-purple-700 bg-zinc-50 dark:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                      selectedSuggestions.has(index)
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {selectedSuggestions.has(index) && (
                      <i className="fa-solid fa-check text-white text-xs"></i>
                    )}
                  </div>

                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getPriorityColor(
                      suggestion.priority
                    )}`}
                  >
                    <i className={`fa-solid ${suggestion.icon}`}></i>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {suggestion.title}
                      </h5>
                      {suggestion.priority && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(
                            suggestion.priority
                          )}`}
                        >
                          {suggestion.priority}
                        </span>
                      )}
                    </div>
                    {suggestion.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                        {suggestion.description}
                      </p>
                    )}
                    {suggestion.suggestedTime && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        <i className="fa-regular fa-clock mr-1"></i>
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        }).format(suggestion.suggestedTime)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Attendees */}
        {followUp.attendees && followUp.attendees.length > 0 && (
          <div className="mb-6 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              <i className="fa-solid fa-user-group mr-1"></i>
              Attendees
            </p>
            <div className="flex flex-wrap gap-2">
              {followUp.attendees.map((attendee, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full text-zinc-700 dark:text-zinc-300"
                >
                  {attendee}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateSelected}
            disabled={selectedSuggestions.size === 0}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-zinc-300 disabled:to-zinc-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-check"></i>
            Create {selectedSuggestions.size > 0 ? `${selectedSuggestions.size} ` : ''}
            {selectedSuggestions.size === 1 ? 'Action' : 'Actions'}
          </button>
          <button
            onClick={() => onSkip(followUp.id)}
            className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-medium transition"
          >
            Skip
          </button>
        </div>

        {/* Tip */}
        <p className="text-xs text-zinc-400 text-center mt-4">
          <i className="fa-solid fa-lightbulb mr-1"></i>
          Tip: Select multiple actions to create them all at once
        </p>
      </div>
    </div>
  );
};

export default PostMeetingPrompt;

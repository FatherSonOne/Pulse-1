import React, { useState, useRef, useEffect } from 'react';
import { CalendarEvent, Contact } from '../types';
import { calendarAIService } from '../services/calendarAIService';

import { AlertTriangle, Check, Clock, Lightbulb, Loader2, MapPin, Sparkles, Users } from 'lucide-react';

interface NaturalLanguageEventInputProps {
  contacts: Contact[];
  onEventCreated: (event: Partial<CalendarEvent>) => void;
  onCancel?: () => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const NaturalLanguageEventInput: React.FC<NaturalLanguageEventInputProps> = ({
  contacts,
  onEventCreated,
  onCancel,
  className = '',
  placeholder = 'Schedule team meeting tomorrow at 2pm for 1 hour...',
  autoFocus = false,
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<Partial<CalendarEvent> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Debounced parsing for live preview
  useEffect(() => {
    clearTimeout(debounceTimer.current);

    if (input.trim().length < 5) {
      setPreview(null);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        setIsProcessing(true);
        setError(null);
        const parsed = await calendarAIService.parseNaturalLanguageEvent(input, contacts);

        if (parsed && parsed.title) {
          setPreview(parsed);
        } else {
          setPreview(null);
        }
      } catch (err) {
        console.error('Error parsing natural language:', err);
        setError('Could not parse event from input');
      } finally {
        setIsProcessing(false);
      }
    }, 500);

    return () => clearTimeout(debounceTimer.current);
  }, [input, contacts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) {
      onEventCreated(preview);
      setInput('');
      setPreview(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (input) {
        setInput('');
        setPreview(null);
      } else {
        onCancel?.();
      }
    } else if (e.key === 'Enter' && preview) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const formatPreviewTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const getDuration = () => {
    if (!preview?.start || !preview?.end) return null;
    const duration = (preview.end.getTime() - preview.start.getTime()) / (1000 * 60);
    if (duration < 60) return `${duration}m`;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        {/* Input Field */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-4 py-3 pr-12 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />

          {/* Loading Spinner */}
          {isProcessing && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="animate-spin text-blue-500" />
            </div>
          )}

          {/* AI Icon */}
          {!isProcessing && input && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Sparkles className="text-purple-500" />
            </div>
          )}
        </div>

        {/* Preview Card */}
        {preview && !error && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden z-50 animate-fade-in">
            <div className="p-4">
              {/* Title */}
              <div className="flex items-start gap-3 mb-3">
                <i className={`fa-solid ${preview.type === 'meet' ? 'fa-video' : preview.type === 'call' ? 'fa-phone' : 'fa-calendar'} text-blue-500 mt-1`}></i>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-zinc-900 dark:text-white truncate">
                    {preview.title}
                  </h4>
                  {preview.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {preview.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                {/* Date & Time */}
                {preview.start && (
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <Clock className="w-4 text-zinc-400" />
                    <span>
                      {formatPreviewTime(preview.start)}
                      {preview.end && ` • ${getDuration()}`}
                    </span>
                  </div>
                )}

                {/* Location */}
                {preview.location && (
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <MapPin className="w-4 text-zinc-400" />
                    <span className="truncate">{preview.location}</span>
                  </div>
                )}

                {/* Attendees */}
                {preview.attendees && preview.attendees.length > 0 && (
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <Users className="w-4 text-zinc-400" />
                    <span className="truncate">
                      {preview.attendees.slice(0, 3).join(', ')}
                      {preview.attendees.length > 3 && ` +${preview.attendees.length - 3} more`}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition"
                >
                  <Check className="mr-2" />
                  Create Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput('');
                    setPreview(null);
                  }}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Tip */}
            <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
              <Lightbulb className="mr-1" />
              Press <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded">Enter</kbd> to create or <kbd className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 rounded">Esc</kbd> to cancel
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="mr-2" />
            {error}
          </div>
        )}
      </form>

      {/* Example Prompts */}
      {!input && !preview && (
        <div className="mt-3 text-xs text-zinc-500">
          <span className="font-medium">Try:</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {[
              'Team standup tomorrow 9am',
              'Lunch with Sarah next Tuesday noon',
              'Block 2 hours for coding this afternoon',
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInput(example)}
                className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-400 transition"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NaturalLanguageEventInput;

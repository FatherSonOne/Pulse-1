// MeetingExtractor.tsx - Detect and extract meeting requests from emails
import React, { useState, useEffect } from 'react';
import { CachedEmail } from '../../services/emailSyncService';

interface ExtractedMeeting {
  title: string;
  date: Date | null;
  time: string | null;
  duration: string | null;
  location: string | null;
  attendees: string[];
  sourceEmail: CachedEmail;
  confidence: 'high' | 'medium' | 'low';
}

interface MeetingExtractorProps {
  email: CachedEmail;
  onAddToCalendar: (meeting: ExtractedMeeting) => void;
  onDismiss: () => void;
}

export const MeetingExtractor: React.FC<MeetingExtractorProps> = ({
  email,
  onAddToCalendar,
  onDismiss,
}) => {
  const [meeting, setMeeting] = useState<ExtractedMeeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    extractMeetingInfo();
  }, [email]);

  const extractMeetingInfo = () => {
    setLoading(true);
    try {
      const text = `${email.subject || ''} ${email.body_text || ''}`.toLowerCase();
      const originalText = `${email.subject || ''} ${email.body_text || ''}`;

      // Check if this looks like a meeting request
      const meetingKeywords = [
        'meeting', 'call', 'sync', 'catch up', 'discuss',
        'schedule', 'appointment', 'conference', 'zoom',
        'google meet', 'teams', 'webex', 'calendar invite'
      ];

      const hasMeetingKeyword = meetingKeywords.some(kw => text.includes(kw));
      if (!hasMeetingKeyword) {
        setMeeting(null);
        setLoading(false);
        return;
      }

      // Extract date patterns
      const datePatterns = [
        // "January 15th", "Jan 15", etc.
        /(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)?,?\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?/gi,
        // "1/15", "01/15/2024", etc.
        /(?:on\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g,
        // "next Monday", "this Friday", etc.
        /(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
        // "tomorrow", "today"
        /\b(?:tomorrow|today)\b/gi,
      ];

      let extractedDate: Date | null = null;
      let dateString: string | null = null;

      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          dateString = match[0];
          extractedDate = parseRelativeDate(dateString);
          break;
        }
      }

      // Extract time patterns
      const timePatterns = [
        // "at 2:30 PM", "2:30pm", etc.
        /(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))/gi,
        // "at 14:30", "14:00", etc.
        /(?:at\s+)?(\d{1,2}:\d{2})(?!\s*(?:am|pm))/gi,
      ];

      let extractedTime: string | null = null;

      for (const pattern of timePatterns) {
        const match = text.match(pattern);
        if (match) {
          extractedTime = match[0].replace(/^at\s+/i, '');
          break;
        }
      }

      // Extract duration
      const durationPatterns = [
        /(\d+)\s*(?:hour|hr)s?/gi,
        /(\d+)\s*(?:minute|min)s?/gi,
        /(?:for\s+)?(\d+(?:\.\d+)?)\s*h(?:ou)?rs?/gi,
      ];

      let extractedDuration: string | null = null;

      for (const pattern of durationPatterns) {
        const match = text.match(pattern);
        if (match) {
          extractedDuration = match[0];
          break;
        }
      }

      // Extract location/link
      const locationPatterns = [
        /(https?:\/\/[^\s]+(?:zoom|meet|teams|webex)[^\s]*)/gi,
        /(?:at|location[:\s]+)([^,.\n]+(?:office|room|building|street|ave|blvd)[^,.\n]*)/gi,
        /(meet\.google\.com\/[^\s]+)/gi,
        /(zoom\.us\/[^\s]+)/gi,
      ];

      let extractedLocation: string | null = null;

      for (const pattern of locationPatterns) {
        const match = originalText.match(pattern);
        if (match) {
          extractedLocation = match[0];
          break;
        }
      }

      // Extract title from subject or first sentence
      let title = email.subject || 'Meeting';
      if (title.toLowerCase().startsWith('re:')) {
        title = title.substring(3).trim();
      }
      if (title.toLowerCase().startsWith('fwd:')) {
        title = title.substring(4).trim();
      }

      // Determine confidence
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (extractedDate && extractedTime) {
        confidence = 'high';
      } else if (extractedDate || extractedTime) {
        confidence = 'medium';
      }

      // Get attendees
      const attendees: string[] = [email.from_email];
      if (email.to_emails) {
        attendees.push(...email.to_emails);
      }

      setMeeting({
        title,
        date: extractedDate,
        time: extractedTime,
        duration: extractedDuration,
        location: extractedLocation,
        attendees: [...new Set(attendees)], // Deduplicate
        sourceEmail: email,
        confidence,
      });
    } catch (error) {
      console.error('Error extracting meeting:', error);
      setMeeting(null);
    } finally {
      setLoading(false);
    }
  };

  const parseRelativeDate = (dateStr: string): Date | null => {
    const today = new Date();
    const lower = dateStr.toLowerCase();

    if (lower.includes('today')) {
      return today;
    }

    if (lower.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = days.findIndex(d => lower.includes(d));

    if (dayIndex !== -1) {
      const result = new Date(today);
      const currentDay = today.getDay();
      let daysUntil = dayIndex - currentDay;

      if (lower.includes('next')) {
        daysUntil += 7;
      } else if (daysUntil <= 0) {
        daysUntil += 7;
      }

      result.setDate(result.getDate() + daysUntil);
      return result;
    }

    // Try parsing absolute dates
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Date not detected';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const getConfidenceStyles = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return {
          bg: 'bg-green-500/20',
          text: 'text-green-600 dark:text-green-400',
          label: 'High confidence',
        };
      case 'medium':
        return {
          bg: 'bg-amber-500/20',
          text: 'text-amber-600 dark:text-amber-400',
          label: 'Medium confidence',
        };
      default:
        return {
          bg: 'bg-stone-500/20',
          text: 'text-stone-600 dark:text-stone-400',
          label: 'Low confidence',
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-circle-notch fa-spin text-blue-500"></i>
          <span className="text-stone-600 dark:text-zinc-400 text-sm">Analyzing for meeting details...</span>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return null;
  }

  const confidenceStyles = getConfidenceStyles(meeting.confidence);

  return (
    <div className="bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-500/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <i className="fa-solid fa-calendar-plus text-white text-sm"></i>
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-white text-sm">Meeting Detected</h3>
            <span className={`text-xs ${confidenceStyles.text}`}>{confidenceStyles.label}</span>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="w-6 h-6 rounded hover:bg-blue-500/20 flex items-center justify-center text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-white transition"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>

      {/* Meeting details */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <div className="text-xs text-stone-500 dark:text-zinc-500 mb-1">Title</div>
          <div className="font-medium text-stone-900 dark:text-white">{meeting.title}</div>
        </div>

        {/* Date & Time */}
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-stone-500 dark:text-zinc-500 mb-1">Date</div>
            <div className="flex items-center gap-2 text-sm text-stone-700 dark:text-zinc-300">
              <i className="fa-regular fa-calendar text-blue-500"></i>
              {formatDate(meeting.date)}
            </div>
          </div>
          {meeting.time && (
            <div>
              <div className="text-xs text-stone-500 dark:text-zinc-500 mb-1">Time</div>
              <div className="flex items-center gap-2 text-sm text-stone-700 dark:text-zinc-300">
                <i className="fa-regular fa-clock text-blue-500"></i>
                {meeting.time}
              </div>
            </div>
          )}
        </div>

        {/* Duration */}
        {meeting.duration && (
          <div>
            <div className="text-xs text-stone-500 dark:text-zinc-500 mb-1">Duration</div>
            <div className="text-sm text-stone-700 dark:text-zinc-300">{meeting.duration}</div>
          </div>
        )}

        {/* Location */}
        {meeting.location && (
          <div>
            <div className="text-xs text-stone-500 dark:text-zinc-500 mb-1">Location / Link</div>
            <div className="text-sm text-blue-600 dark:text-blue-400 truncate">
              {meeting.location.startsWith('http') ? (
                <a href={meeting.location} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {meeting.location}
                </a>
              ) : (
                meeting.location
              )}
            </div>
          </div>
        )}

        {/* Attendees */}
        {meeting.attendees.length > 0 && (
          <div>
            <div className="text-xs text-stone-500 dark:text-zinc-500 mb-1">Attendees</div>
            <div className="flex flex-wrap gap-1.5">
              {meeting.attendees.slice(0, 4).map((attendee, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 rounded-full"
                >
                  {attendee}
                </span>
              ))}
              {meeting.attendees.length > 4 && (
                <span className="text-xs px-2 py-1 text-stone-500 dark:text-zinc-500">
                  +{meeting.attendees.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => onAddToCalendar(meeting)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-medium rounded-lg transition"
          >
            <i className="fa-solid fa-calendar-plus"></i>
            Add to Calendar
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-stone-600 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-white font-medium rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-800 transition"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingExtractor;

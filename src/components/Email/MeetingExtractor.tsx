// MeetingExtractor.tsx - Detect and extract meeting requests from emails
import React, { useState, useEffect } from 'react';
import { CachedEmail } from '../../services/emailSyncService';

import { Calendar, CalendarPlus, Clock, Loader2, X } from 'lucide-react';

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
        attendees.push(...email.to_emails.map(r => typeof r === 'string' ? r : (r.name || r.email)));
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

  // Confidence → Pulse status tokens. High = positive (green), Medium =
  // warning (amber), Low = neutral (gray). Per DESIGN.md "Status-Stays-
  // Status" rule, semantic status colors stay in their own vocabulary —
  // here they sit inside a coral-bordered AI surface as content, not
  // chrome, so the coral budget isn't burned by the status pill itself.
  const getConfidenceTone = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return { color: 'var(--pulse-tone-positive)', bg: 'var(--pulse-tone-positive-soft)', label: 'High confidence' };
      case 'medium':
        return { color: 'var(--pulse-tone-warning)',  bg: 'var(--pulse-tone-warning-soft)',  label: 'Medium confidence' };
      default:
        return { color: 'var(--pulse-tone-neutral)',  bg: 'var(--pulse-tone-neutral-soft)',  label: 'Low confidence' };
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--pulse-rose-soft)', border: '1px solid color-mix(in oklab, var(--pulse-rose) 25%, var(--pulse-border))', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--pulse-rose)' }} aria-hidden />
          <span style={{ fontSize: 13, color: 'var(--pulse-ink-2)' }}>Scanning the thread for meeting details…</span>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return null;
  }

  const tone = getConfidenceTone(meeting.confidence);

  return (
    <div style={{
      background: 'var(--pulse-rose-soft)',
      border: '1px solid color-mix(in oklab, var(--pulse-rose) 25%, var(--pulse-border))',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header — AiChip-style provenance label + confidence chip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid color-mix(in oklab, var(--pulse-rose) 15%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 8px', borderRadius: 4,
            background: 'var(--pulse-surface-raised)',
            color: 'var(--pulse-rose-text)',
            fontFamily: 'var(--pulse-font-mono)',
            fontSize: 10, fontWeight: 500,
            letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1,
          }}>
            <CalendarPlus className="w-3 h-3" aria-hidden />
            Claude · Meeting
          </span>
          <span style={{
            padding: '3px 7px', borderRadius: 4,
            background: tone.bg, color: tone.color,
            fontFamily: 'var(--pulse-font-mono)',
            fontSize: 10, fontWeight: 500,
            letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1,
          }}>
            {tone.label}
          </span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss meeting suggestion"
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--pulse-ink-3)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 140ms ease, color 140ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--pulse-surface-raised)'; e.currentTarget.style.color = 'var(--pulse-ink-2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--pulse-ink-3)'; }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Meeting details */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--pulse-surface)' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Title</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pulse-ink)' }}>{meeting.title}</div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 10, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Date</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--pulse-ink-2)' }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--pulse-rose)' }} aria-hidden />
              {formatDate(meeting.date)}
            </div>
          </div>
          {meeting.time && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Time</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--pulse-ink-2)' }}>
                <Clock className="w-3.5 h-3.5" style={{ color: 'var(--pulse-rose)' }} aria-hidden />
                {meeting.time}
              </div>
            </div>
          )}
        </div>

        {meeting.duration && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Duration</div>
            <div style={{ fontSize: 13, color: 'var(--pulse-ink-2)' }}>{meeting.duration}</div>
          </div>
        )}

        {meeting.location && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Location / Link</div>
            <div style={{ fontSize: 13, color: 'var(--pulse-rose-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meeting.location.startsWith('http') ? (
                <a href={meeting.location} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  {meeting.location}
                </a>
              ) : (
                meeting.location
              )}
            </div>
          </div>
        )}

        {meeting.attendees.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--pulse-ink-3)', fontFamily: 'var(--pulse-font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Attendees</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {meeting.attendees.slice(0, 4).map((attendee, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 999,
                  background: 'var(--pulse-surface-raised)',
                  color: 'var(--pulse-ink-2)',
                }}>
                  {attendee}
                </span>
              ))}
              {meeting.attendees.length > 4 && (
                <span style={{ fontSize: 11, padding: '3px 6px', color: 'var(--pulse-ink-3)' }}>
                  +{meeting.attendees.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
          <button
            onClick={() => onAddToCalendar(meeting)}
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--pulse-rose)', color: 'white',
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 4px 12px var(--pulse-rose-glow)',
              transition: 'background 160ms ease, transform 160ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--pulse-rose-deep)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--pulse-rose)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <CalendarPlus className="w-3.5 h-3.5" aria-hidden />
            Add to Calendar
          </button>
          <button
            onClick={onDismiss}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid var(--pulse-border)', cursor: 'pointer',
              background: 'transparent', color: 'var(--pulse-ink-2)',
              fontSize: 13, fontWeight: 500,
              transition: 'background 160ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--pulse-surface-raised)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingExtractor;

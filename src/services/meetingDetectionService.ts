import { CalendarEvent, Contact } from '../types';
import { calendarAIService } from './calendarAIService';
import { supabase } from './supabase';

export interface SuggestedEvent {
  id: string;
  source: 'conversation' | 'email' | 'vox';
  sourceId: string; // conversation/message ID
  sourceContactId?: string; // Contact who mentioned it
  confidence: number; // 0-100
  event: Partial<CalendarEvent>;
  context: string; // Original text snippet
  createdAt: Date;
  dismissed?: boolean;
  accepted?: boolean;
}

interface MeetingDetectionResult {
  hasMeeting: boolean;
  confidence: number;
  suggestedEvent?: Partial<CalendarEvent>;
  context: string;
}

class MeetingDetectionService {
  private detectionPatterns = {
    // Time indicators
    timePatterns: [
      /\b(tomorrow|tonight|today|later)\b/i,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(next\s+week|this\s+week|next\s+month)\b/i,
      /\b(\d{1,2}:\d{2}\s*(am|pm)?)\b/i,
      /\b(\d{1,2}\s*(am|pm))\b/i,
      /\b(morning|afternoon|evening|noon)\b/i,
    ],

    // Meeting indicators
    meetingPatterns: [
      /\b(meet|meeting|meetup|call|video\s*call|zoom|teams|hangout)\b/i,
      /\b(schedule|calendar|book|set\s*up)\b/i,
      /\b(appointment|session|discussion|chat|talk)\b/i,
      /\b(coffee|lunch|dinner|breakfast)\b/i,
      /\b(review|sync|standup|check-?in)\b/i,
    ],

    // Action indicators
    actionPatterns: [
      /\b(let'?s|we\s*should|how\s*about|want\s*to)\b/i,
      /\b(can\s*we|could\s*we|shall\s*we)\b/i,
      /\b(available|free)\b/i,
    ],
  };

  /**
   * Detect if a message contains meeting-related content
   */
  async detectMeeting(
    messageText: string,
    contactId?: string
  ): Promise<MeetingDetectionResult> {
    const text = messageText.toLowerCase();

    // Quick pattern-based detection
    const hasTime = this.detectionPatterns.timePatterns.some(p => p.test(text));
    const hasMeetingWord = this.detectionPatterns.meetingPatterns.some(p => p.test(text));
    const hasAction = this.detectionPatterns.actionPatterns.some(p => p.test(text));

    // Calculate initial confidence
    let confidence = 0;
    if (hasTime) confidence += 40;
    if (hasMeetingWord) confidence += 35;
    if (hasAction) confidence += 25;

    // If confidence is too low, skip AI parsing
    if (confidence < 50) {
      return {
        hasMeeting: false,
        confidence,
        context: messageText.slice(0, 150),
      };
    }

    // Use AI to parse the meeting details
    try {
      const contacts: Contact[] = [];
      if (contactId) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .single();

        if (contact) {
          contacts.push(contact);
        }
      }

      const suggestedEvent = await calendarAIService.parseNaturalLanguageEvent(
        messageText,
        contacts
      );

      if (suggestedEvent && suggestedEvent.title) {
        return {
          hasMeeting: true,
          confidence: Math.min(confidence + 20, 95), // Boost confidence if AI parsed successfully
          suggestedEvent,
          context: messageText.slice(0, 150),
        };
      }
    } catch (error) {
      console.error('Error parsing meeting with AI:', error);
    }

    return {
      hasMeeting: confidence >= 70,
      confidence,
      context: messageText.slice(0, 150),
    };
  }

  /**
   * Save a suggested event to the database
   */
  async saveSuggestedEvent(suggestion: Omit<SuggestedEvent, 'id'>): Promise<SuggestedEvent> {
    const id = `suggested_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const suggestedEvent: SuggestedEvent = {
      id,
      ...suggestion,
    };

    // Store in localStorage for now (could be moved to Supabase)
    const stored = this.getSuggestedEvents();
    stored.push(suggestedEvent);
    localStorage.setItem('pulse_suggested_events', JSON.stringify(stored));

    return suggestedEvent;
  }

  /**
   * Get all suggested events
   */
  getSuggestedEvents(): SuggestedEvent[] {
    const stored = localStorage.getItem('pulse_suggested_events');
    if (!stored) return [];

    try {
      const events = JSON.parse(stored);
      return events.map((e: any) => ({
        ...e,
        createdAt: new Date(e.createdAt),
        event: {
          ...e.event,
          start: e.event.start ? new Date(e.event.start) : undefined,
          end: e.event.end ? new Date(e.event.end) : undefined,
        },
      }));
    } catch (error) {
      console.error('Error parsing suggested events:', error);
      return [];
    }
  }

  /**
   * Get pending (not dismissed/accepted) suggested events
   */
  getPendingSuggestedEvents(): SuggestedEvent[] {
    return this.getSuggestedEvents().filter(e => !e.dismissed && !e.accepted);
  }

  /**
   * Dismiss a suggested event
   */
  dismissSuggestedEvent(id: string): void {
    const events = this.getSuggestedEvents();
    const updated = events.map(e =>
      e.id === id ? { ...e, dismissed: true } : e
    );
    localStorage.setItem('pulse_suggested_events', JSON.stringify(updated));
  }

  /**
   * Accept a suggested event
   */
  acceptSuggestedEvent(id: string): void {
    const events = this.getSuggestedEvents();
    const updated = events.map(e =>
      e.id === id ? { ...e, accepted: true } : e
    );
    localStorage.setItem('pulse_suggested_events', JSON.stringify(updated));
  }

  /**
   * Clear all suggested events
   */
  clearSuggestedEvents(): void {
    localStorage.removeItem('pulse_suggested_events');
  }

  /**
   * Get count of pending suggestions
   */
  getPendingCount(): number {
    return this.getPendingSuggestedEvents().length;
  }
}

export const meetingDetectionService = new MeetingDetectionService();
export default meetingDetectionService;

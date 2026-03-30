import { CalendarEvent } from '../types';
import { supabase } from './supabase';
import { isEntomateConnected } from './meetingService';

export interface MeetingFollowUp {
  id: string;
  eventId: string;
  eventTitle: string;
  eventEnd: Date;
  attendees?: string[];
  promptedAt: Date;
  dismissed?: boolean;
  actionsCreated?: boolean;
  followUpScheduled?: boolean;
  userResponse?: string;
  suggestions: FollowUpSuggestion[];
}

export interface FollowUpSuggestion {
  type: 'meeting' | 'task' | 'reminder' | 'note';
  title: string;
  description?: string;
  suggestedTime?: Date;
  priority?: 'low' | 'medium' | 'high';
  icon: string;
}

class PostMeetingService {
  private checkInterval: NodeJS.Timeout | null = null;
  private currentEvents: CalendarEvent[] = [];
  private promptedEventIds = new Set<string>();
  private readonly PROMPT_DELAY = 5 * 60 * 1000; // 5 minutes after meeting ends
  private readonly PROMPT_WINDOW = 15 * 60 * 1000; // 15 minute window to show prompt

  /**
   * Start monitoring for ended meetings.
   * Subsequent calls only update the events reference — the interval is not restarted.
   */
  startMonitoring(events: CalendarEvent[]): void {
    // Always update the events reference for the next scheduled check
    this.currentEvents = events;

    // Only start the interval once
    if (this.checkInterval) return;

    // Check every 2 minutes using the always-current events ref
    this.checkInterval = setInterval(() => {
      this.checkEndedMeetings(this.currentEvents);
    }, 2 * 60 * 1000);

    // Also check immediately
    this.checkEndedMeetings(this.currentEvents);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check for recently ended meetings
   */
  private checkEndedMeetings(events: CalendarEvent[]): void {
    const now = new Date();

    const recentlyEnded = events.filter(event => {
      // Skip if already prompted
      if (this.promptedEventIds.has(event.id)) return false;

      const endTime = event.end.getTime();
      const timeSinceEnd = now.getTime() - endTime;

      // Check if meeting ended within the prompt window
      return (
        timeSinceEnd >= this.PROMPT_DELAY &&
        timeSinceEnd <= this.PROMPT_WINDOW &&
        event.type === 'meet' // Only for meetings
      );
    });

    for (const event of recentlyEnded) {
      this.createFollowUpPrompt(event);
      this.promptedEventIds.add(event.id);
    }
  }

  /**
   * Generate follow-up suggestions based on meeting details
   */
  private async generateSuggestions(event: CalendarEvent): Promise<FollowUpSuggestion[]> {
    const suggestions: FollowUpSuggestion[] = [];

    // Suggest follow-up meeting (in 1-2 weeks)
    const followUpDate = new Date(event.end);
    followUpDate.setDate(followUpDate.getDate() + 7); // 1 week later
    suggestions.push({
      type: 'meeting',
      title: `Follow-up: ${event.title}`,
      description: 'Schedule a follow-up meeting',
      suggestedTime: followUpDate,
      priority: 'medium',
      icon: 'fa-calendar-plus',
    });

    // Suggest task for action items
    suggestions.push({
      type: 'task',
      title: 'Review action items',
      description: `Review and complete action items from ${event.title}`,
      priority: 'high',
      icon: 'fa-list-check',
    });

    // Suggest reminder to send documents/notes
    const reminderDate = new Date(event.end);
    reminderDate.setHours(reminderDate.getHours() + 24); // Tomorrow
    suggestions.push({
      type: 'reminder',
      title: 'Send meeting notes',
      description: `Send notes and documents from ${event.title}`,
      suggestedTime: reminderDate,
      priority: 'medium',
      icon: 'fa-paper-plane',
    });

    // Suggest creating meeting notes
    suggestions.push({
      type: 'note',
      title: 'Document key takeaways',
      description: 'Create notes with decisions and next steps',
      priority: 'high',
      icon: 'fa-note-sticky',
    });

    // Suggest exporting to Entomate for AI analysis (if connected)
    try {
      const connected = await isEntomateConnected();
      if (connected) {
        suggestions.push({
          type: 'task',
          title: 'Export to Entomate',
          description: `Send recording to Entomate for AI transcription, sentiment analysis & action items`,
          priority: 'medium',
          icon: 'fa-share-from-square',
        });
      }
    } catch {
      // Entomate not available — skip suggestion
    }

    return suggestions;
  }

  /**
   * Create a follow-up prompt for a meeting
   */
  private async createFollowUpPrompt(event: CalendarEvent): Promise<MeetingFollowUp> {
    const suggestions = await this.generateSuggestions(event);

    const followUp: MeetingFollowUp = {
      id: `followup_${event.id}_${Date.now()}`,
      eventId: event.id,
      eventTitle: event.title,
      eventEnd: event.end,
      attendees: event.attendees,
      promptedAt: new Date(),
      suggestions,
    };

    // Save to localStorage
    this.saveFollowUp(followUp);

    // Dispatch custom event for UI to listen
    window.dispatchEvent(new CustomEvent('pulse:meeting-ended', { detail: followUp }));

    return followUp;
  }

  /**
   * Save follow-up to storage
   */
  private saveFollowUp(followUp: MeetingFollowUp): void {
    const stored = this.getFollowUps();
    stored.push(followUp);
    localStorage.setItem('pulse_meeting_followups', JSON.stringify(stored));
  }

  /**
   * Get all follow-ups
   */
  getFollowUps(): MeetingFollowUp[] {
    const stored = localStorage.getItem('pulse_meeting_followups');
    if (!stored) return [];

    try {
      const followUps = JSON.parse(stored);
      return followUps.map((f: any) => ({
        ...f,
        eventEnd: new Date(f.eventEnd),
        promptedAt: new Date(f.promptedAt),
        suggestions: f.suggestions.map((s: any) => ({
          ...s,
          suggestedTime: s.suggestedTime ? new Date(s.suggestedTime) : undefined,
        })),
      }));
    } catch (error) {
      console.error('Error parsing follow-ups:', error);
      return [];
    }
  }

  /**
   * Get pending (not dismissed/actioned) follow-ups
   */
  getPendingFollowUps(): MeetingFollowUp[] {
    return this.getFollowUps().filter(f => !f.dismissed && !f.actionsCreated);
  }

  /**
   * Dismiss a follow-up prompt
   */
  dismissFollowUp(id: string): void {
    const followUps = this.getFollowUps();
    const updated = followUps.map(f =>
      f.id === id ? { ...f, dismissed: true } : f
    );
    localStorage.setItem('pulse_meeting_followups', JSON.stringify(updated));

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('pulse:followup-updated'));
  }

  /**
   * Mark follow-up as actioned
   */
  markAsActioned(id: string, response?: string): void {
    const followUps = this.getFollowUps();
    const updated = followUps.map(f =>
      f.id === id ? { ...f, actionsCreated: true, userResponse: response } : f
    );
    localStorage.setItem('pulse_meeting_followups', JSON.stringify(updated));

    // Dispatch update event
    window.dispatchEvent(new CustomEvent('pulse:followup-updated'));
  }

  /**
   * Clear all follow-ups
   */
  clearFollowUps(): void {
    localStorage.removeItem('pulse_meeting_followups');
    this.promptedEventIds.clear();
    window.dispatchEvent(new CustomEvent('pulse:followup-updated'));
  }

  /**
   * Get count of pending follow-ups
   */
  getPendingCount(): number {
    return this.getPendingFollowUps().length;
  }

  /**
   * Reset prompted events (for testing)
   */
  resetPrompted(): void {
    this.promptedEventIds.clear();
  }
}

export const postMeetingService = new PostMeetingService();
export default postMeetingService;

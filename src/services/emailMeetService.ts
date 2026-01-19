// Email Meet Service
// Creates Google Meet links via Calendar API

import { supabase } from './supabase';
import { CalendarEvent } from '../types';
import { googleCalendarService } from './googleCalendarService';

interface MeetOptions {
  title: string;
  start: Date;
  end: Date;
  attendees?: string[];
  description?: string;
}

class EmailMeetService {
  async createMeetLink(options: MeetOptions): Promise<{ meetLink: string; eventId: string }> {
    // Use Google Calendar service to create a meet-enabled event
    const event: Partial<CalendarEvent> = {
      title: options.title,
      start: options.start,
      end: options.end,
      description: options.description,
      attendees: options.attendees || [],
      type: 'meet',
    };

    // Create with conference data version to enable Meet link
    const created = await googleCalendarService.createEvent(event, 'primary', {
      conferenceDataVersion: 1,
    });

    const meetLink = created.meetLink;
    if (!meetLink) {
      throw new Error('Failed to create Google Meet link');
    }

    return {
      meetLink,
      eventId: created.googleEventId || created.id,
    };
  }
}

export const emailMeetService = new EmailMeetService();
export default emailMeetService;

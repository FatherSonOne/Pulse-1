/**
 * Google Calendar Service
 * Handles fetching, creating, updating, and deleting calendar events via Google Calendar API
 */

import { supabase } from './supabase';
import { CalendarEvent } from '../types';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  colorId?: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  recurrence?: string[];
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
  creator?: {
    email: string;
    displayName?: string;
  };
  organizer?: {
    email: string;
    displayName?: string;
  };
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole?: string;
}

// Refresh Google access token using the refresh token
const refreshGoogleAccessToken = async (refreshToken: string): Promise<string | null> => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId || !refreshToken) {
    console.warn('[Google Calendar] Missing client ID or refresh token for Google token refresh');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Google Calendar] Google token refresh failed:', errorData);
      return null;
    }

    const data = await response.json();
    if (data.access_token) {
      console.log('[Google Calendar] Successfully refreshed Google access token');
      return data.access_token;
    }

    return null;
  } catch (error) {
    console.error('[Google Calendar] Error refreshing Google token:', error);
    return null;
  }
};

// Get Google access token from Supabase session
// This function tries to get the token and refresh if needed
const getGoogleAccessToken = async (): Promise<string | null> => {
  // First, try to get the current session
  let { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('[Google Calendar] Session error:', error);
    return null;
  }

  if (!session) {
    console.error('[Google Calendar] No session found');
    return null;
  }

  // The provider_token contains the Google OAuth access token
  if (session.provider_token) {
    console.log('[Google Calendar] Got valid provider token');
    return session.provider_token;
  }

  // Try refreshing using Google's refresh token (Supabase doesn't refresh provider_token automatically)
  const refreshToken = (session as any)?.provider_refresh_token;
  if (refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    if (refreshed) {
      return refreshed;
    }
  }

  console.warn('[Google Calendar] No provider_token in session.');
  console.log('[Google Calendar] Session provider:', session.user?.app_metadata?.provider);
  console.log('[Google Calendar] User may need to re-authenticate with Google.');
  console.log('[Google Calendar] To enable calendar access, user should click "Connect Calendar" button.');
  return null;
};

// Refresh token if needed - try Google refresh token first, then Supabase session refresh
const refreshTokenIfNeeded = async (): Promise<string | null> => {
  console.log('[Google Calendar] Attempting token refresh for Google API access...');

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('[Google Calendar] Failed to load session:', error);
    return null;
  }

  if (!session) {
    console.error('[Google Calendar] No session available');
    return null;
  }

  if (session.provider_token) {
    return session.provider_token;
  }

  const refreshToken = (session as any)?.provider_refresh_token;
  if (refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    if (refreshed) {
      return refreshed;
    }
  }

  // Fallback: refresh Supabase session (may not include provider_token)
  console.log('[Google Calendar] Falling back to Supabase session refresh...');
  const refreshResult = await supabase.auth.refreshSession();

  if (refreshResult.error) {
    console.error('[Google Calendar] Failed to refresh session:', refreshResult.error);
    return null;
  }

  const refreshedSession = refreshResult.data.session;
  if (!refreshedSession?.provider_token) {
    console.warn('[Google Calendar] No provider token after session refresh');
    console.warn('[Google Calendar] User may need to re-authenticate with Google');
    return null;
  }

  return refreshedSession.provider_token;
};

// Convert Google Calendar event to app CalendarEvent format
const googleEventToCalendarEvent = (event: GoogleCalendarEvent, calendarId: string): CalendarEvent => {
  const startDate = event.start.dateTime
    ? new Date(event.start.dateTime)
    : new Date(event.start.date + 'T00:00:00');

  const endDate = event.end.dateTime
    ? new Date(event.end.dateTime)
    : new Date(event.end.date + 'T23:59:59');

  // Map Google color IDs to our color classes
  const colorMap: Record<string, string> = {
    '1': 'bg-blue-600',
    '2': 'bg-emerald-600',
    '3': 'bg-purple-600',
    '4': 'bg-red-600',
    '5': 'bg-amber-600',
    '6': 'bg-orange-600',
    '7': 'bg-cyan-600',
    '8': 'bg-zinc-600',
    '9': 'bg-indigo-600',
    '10': 'bg-green-600',
    '11': 'bg-pink-600',
  };

  // Determine event type based on content
  let eventType: CalendarEvent['type'] = 'event';
  if (event.hangoutLink || event.conferenceData) {
    eventType = 'meet';
  } else if (event.summary?.toLowerCase().includes('call')) {
    eventType = 'call';
  } else if (event.summary?.toLowerCase().includes('deadline')) {
    eventType = 'deadline';
  } else if (event.summary?.toLowerCase().includes('remind')) {
    eventType = 'reminder';
  }

  return {
    id: event.id,
    title: event.summary || 'Untitled Event',
    start: startDate,
    end: endDate,
    color: colorMap[event.colorId || ''] || 'bg-blue-600',
    description: event.description,
    location: event.location,
    attendees: event.attendees?.map(a => a.email) || [],
    calendarId: calendarId,
    allDay: !event.start.dateTime, // If no dateTime, it's an all-day event
    type: eventType,
    // Google-specific fields
    googleEventId: event.id,
    meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
    source: 'google',
    htmlLink: event.htmlLink,
    recurrence: event.recurrence,
    reminders: event.reminders,
    creator: event.creator,
    organizer: event.organizer,
    attendeesDetailed: event.attendees?.map(a => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus as CalendarEvent['attendeesDetailed'][0]['responseStatus'],
    })),
  };
};

// Convert app CalendarEvent to Google Calendar event format
const calendarEventToGoogleEvent = (event: Partial<CalendarEvent>): Partial<GoogleCalendarEvent> => {
  const googleEvent: Partial<GoogleCalendarEvent> = {
    summary: event.title,
    description: event.description,
    location: event.location,
  };

  if (event.allDay) {
    googleEvent.start = {
      date: event.start?.toISOString().split('T')[0],
    };
    googleEvent.end = {
      date: event.end?.toISOString().split('T')[0],
    };
  } else {
    googleEvent.start = {
      dateTime: event.start?.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    googleEvent.end = {
      dateTime: event.end?.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  if (event.attendees?.length) {
    googleEvent.attendees = event.attendees.map(email => ({ email }));
  }

  // Add Google Meet conferencing if event is a meet
  if (event.type === 'meet') {
    const requestId = (crypto as any)?.randomUUID?.() || `meet-${Date.now()}`;
    (googleEvent as any).conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    };
  }

  return googleEvent;
};

class GoogleCalendarService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  // Initialize and get valid token
  private async getValidToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Try to get token from session
    let token = await getGoogleAccessToken();

    if (!token) {
      // Try refreshing the session
      token = await refreshTokenIfNeeded();
    }

    if (!token) {
      // This error will be caught by the Calendar component to show the connect button
      const error = new Error('GOOGLE_CALENDAR_NOT_CONNECTED');
      (error as any).code = 'GOOGLE_CALENDAR_NOT_CONNECTED';
      (error as any).userMessage = 'Click "Connect Calendar" to enable Google Calendar sync';
      throw error;
    }

    this.accessToken = token;
    // Cache for 50 minutes (tokens typically expire in 1 hour)
    this.tokenExpiry = Date.now() + 50 * 60 * 1000;

    return token;
  }

  // Make authenticated API request
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getValidToken();

    const response = await fetch(`${GOOGLE_CALENDAR_API}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Calendar API error:', errorData);

      if (response.status === 401) {
        // Token expired, clear cache and retry once
        this.accessToken = null;
        this.tokenExpiry = 0;
        const newToken = await refreshTokenIfNeeded();
        if (newToken) {
          return this.apiRequest(endpoint, options);
        }
      }

      throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  // Check if user has Google Calendar connected
  async isConnected(): Promise<boolean> {
    try {
      const token = await getGoogleAccessToken();
      return !!token;
    } catch {
      return false;
    }
  }

  // Get list of user's calendars
  async getCalendarList(): Promise<GoogleCalendar[]> {
    const response = await this.apiRequest<{ items: GoogleCalendar[] }>(
      '/users/me/calendarList'
    );
    return response.items || [];
  }

  // Alias for getCalendarList (for backwards compatibility)
  async getCalendars(): Promise<GoogleCalendar[]> {
    return this.getCalendarList();
  }

  // Get events from a specific calendar
  async getEvents(
    calendarId: string = 'primary',
    options: {
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
      singleEvents?: boolean;
      orderBy?: 'startTime' | 'updated';
    } = {}
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();

    if (options.timeMin) {
      params.set('timeMin', options.timeMin.toISOString());
    }
    if (options.timeMax) {
      params.set('timeMax', options.timeMax.toISOString());
    }
    if (options.maxResults) {
      params.set('maxResults', options.maxResults.toString());
    }
    if (options.singleEvents !== false) {
      params.set('singleEvents', 'true');
    }
    if (options.orderBy) {
      params.set('orderBy', options.orderBy);
    }

    const response = await this.apiRequest<{ items: GoogleCalendarEvent[] }>(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
    );

    return (response.items || []).map(event =>
      googleEventToCalendarEvent(event, calendarId)
    );
  }

  // Get events from all calendars
  async getAllEvents(
    options: {
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
    } = {}
  ): Promise<CalendarEvent[]> {
    const calendars = await this.getCalendarList();
    const allEvents: CalendarEvent[] = [];

    // Fetch events from each calendar in parallel
    const eventPromises = calendars.map(calendar =>
      this.getEvents(calendar.id, options).catch(err => {
        console.warn(`Failed to fetch events from calendar ${calendar.id}:`, err);
        return [];
      })
    );

    const eventArrays = await Promise.all(eventPromises);

    for (const events of eventArrays) {
      allEvents.push(...events);
    }

    // Sort by start date
    return allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Get upcoming events (next 7 days by default)
  async getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.getAllEvents({
      timeMin: now,
      timeMax: futureDate,
      maxResults: 50,
    });
  }

  // Get today's events
  async getTodayEvents(): Promise<CalendarEvent[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.getAllEvents({
      timeMin: startOfDay,
      timeMax: endOfDay,
    });
  }

  // Create a new event
  async createEvent(
    event: Partial<CalendarEvent>,
    calendarId: string = 'primary',
    options: {
      sendUpdates?: 'all' | 'externalOnly' | 'none';
      conferenceDataVersion?: 0 | 1;
    } = {}
  ): Promise<CalendarEvent> {
    const params = new URLSearchParams();
    if (options.sendUpdates) {
      params.set('sendUpdates', options.sendUpdates);
    }
    if (options.conferenceDataVersion !== undefined) {
      params.set('conferenceDataVersion', options.conferenceDataVersion.toString());
    }

    const googleEvent = calendarEventToGoogleEvent(event);

    const created = await this.apiRequest<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      {
        method: 'POST',
        body: JSON.stringify(googleEvent),
      }
    );

    return googleEventToCalendarEvent(created, calendarId);
  }

  // Update an existing event
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEvent>,
    calendarId: string = 'primary',
    options: {
      sendUpdates?: 'all' | 'externalOnly' | 'none';
    } = {}
  ): Promise<CalendarEvent> {
    const params = new URLSearchParams();
    if (options.sendUpdates) {
      params.set('sendUpdates', options.sendUpdates);
    }

    const googleEvent = calendarEventToGoogleEvent(updates);

    const updated = await this.apiRequest<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?${params.toString()}`,
      {
        method: 'PATCH',
        body: JSON.stringify(googleEvent),
      }
    );

    return googleEventToCalendarEvent(updated, calendarId);
  }

  // Delete an event
  async deleteEvent(
    eventId: string,
    calendarId: string = 'primary',
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'all'
  ): Promise<void> {
    await this.apiRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`,
      {
        method: 'DELETE',
      }
    );
  }

  // Quick add event using natural language
  async quickAdd(
    text: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    const created = await this.apiRequest<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/quickAdd?text=${encodeURIComponent(text)}`,
      {
        method: 'POST',
      }
    );

    return googleEventToCalendarEvent(created, calendarId);
  }

  // Get free/busy information
  async getFreeBusy(
    timeMin: Date,
    timeMax: Date,
    calendarIds: string[] = ['primary']
  ): Promise<Record<string, { start: Date; end: Date }[]>> {
    const response = await this.apiRequest<{
      calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
    }>('/freeBusy', {
      method: 'POST',
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: calendarIds.map(id => ({ id })),
      }),
    });

    const result: Record<string, { start: Date; end: Date }[]> = {};

    for (const [calId, data] of Object.entries(response.calendars)) {
      result[calId] = data.busy.map(slot => ({
        start: new Date(slot.start),
        end: new Date(slot.end),
      }));
    }

    return result;
  }

  // Find available time slots
  async findAvailableSlots(
    date: Date,
    durationMinutes: number = 30,
    workingHoursStart: number = 9,
    workingHoursEnd: number = 17
  ): Promise<{ start: Date; end: Date }[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(workingHoursStart, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(workingHoursEnd, 0, 0, 0);

    const freeBusy = await this.getFreeBusy(startOfDay, endOfDay);
    const busySlots = freeBusy['primary'] || [];

    const availableSlots: { start: Date; end: Date }[] = [];
    let currentTime = new Date(startOfDay);

    for (const busy of busySlots) {
      if (currentTime < busy.start) {
        // There's a gap before this busy slot
        const gapDuration = (busy.start.getTime() - currentTime.getTime()) / (1000 * 60);
        if (gapDuration >= durationMinutes) {
          availableSlots.push({
            start: new Date(currentTime),
            end: new Date(busy.start),
          });
        }
      }
      currentTime = new Date(Math.max(currentTime.getTime(), busy.end.getTime()));
    }

    // Check for time after the last busy slot
    if (currentTime < endOfDay) {
      const gapDuration = (endOfDay.getTime() - currentTime.getTime()) / (1000 * 60);
      if (gapDuration >= durationMinutes) {
        availableSlots.push({
          start: new Date(currentTime),
          end: endOfDay,
        });
      }
    }

    return availableSlots;
  }

  // Get historical events with configurable date range (default 2 years back)
  async getHistoricalEvents(
    options: {
      yearsBack?: number;
      startDate?: Date;
      endDate?: Date;
      maxResults?: number;
    } = {}
  ): Promise<CalendarEvent[]> {
    const { yearsBack = 2, startDate, endDate, maxResults = 2500 } = options;

    const timeMin = startDate || new Date(Date.now() - yearsBack * 365 * 24 * 60 * 60 * 1000);
    const timeMax = endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead

    return this.getAllEvents({
      timeMin,
      timeMax,
      maxResults,
    });
  }

  // Get events for a specific month (for lazy loading as user navigates)
  async getEventsByMonth(year: number, month: number): Promise<CalendarEvent[]> {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    return this.getAllEvents({
      timeMin: startOfMonth,
      timeMax: endOfMonth,
    });
  }

  // Search events across calendar history
  async searchEvents(
    query: string,
    options: { timeMin?: Date; timeMax?: Date; maxResults?: number } = {}
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('singleEvents', 'true');
    params.set('orderBy', 'startTime');

    if (options.timeMin) params.set('timeMin', options.timeMin.toISOString());
    if (options.timeMax) params.set('timeMax', options.timeMax.toISOString());
    if (options.maxResults) params.set('maxResults', options.maxResults.toString());

    const response = await this.apiRequest<{ items: GoogleCalendarEvent[] }>(
      `/calendars/primary/events?${params.toString()}`
    );

    return (response.items || []).map(event => googleEventToCalendarEvent(event, 'primary'));
  }

  // Create a new Google Calendar
  async createCalendar(calendarData: {
    summary: string;
    description?: string;
    timeZone?: string;
  }): Promise<GoogleCalendar> {
    const response = await this.apiRequest<GoogleCalendar>(
      '/calendars',
      {
        method: 'POST',
        body: JSON.stringify({
          summary: calendarData.summary,
          description: calendarData.description,
          timeZone: calendarData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      }
    );

    return response;
  }

  // Get calendar context for AI (summary of upcoming events)
  async getCalendarContextForAI(): Promise<string> {
    try {
      const connected = await this.isConnected();
      if (!connected) {
        return 'Google Calendar is not connected.';
      }

      const todayEvents = await this.getTodayEvents();
      const upcomingEvents = await this.getUpcomingEvents(3);

      let context = '## Calendar Context\n\n';

      // Today's schedule
      context += '### Today\'s Schedule\n';
      if (todayEvents.length === 0) {
        context += 'No events scheduled for today.\n';
      } else {
        for (const event of todayEvents) {
          const timeStr = event.allDay
            ? 'All day'
            : `${event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          context += `- ${timeStr}: ${event.title}`;
          if (event.location) context += ` (at ${event.location})`;
          if (event.attendees?.length) context += ` with ${event.attendees.length} attendees`;
          context += '\n';
        }
      }

      // Upcoming events (excluding today)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const futureEvents = upcomingEvents.filter(e => e.start >= tomorrow);

      if (futureEvents.length > 0) {
        context += '\n### Upcoming Events (Next 3 Days)\n';
        for (const event of futureEvents.slice(0, 10)) {
          const dateStr = event.start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
          const timeStr = event.allDay
            ? 'All day'
            : event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          context += `- ${dateStr} ${timeStr}: ${event.title}`;
          if (event.attendees?.length) context += ` (${event.attendees.length} attendees)`;
          context += '\n';
        }
      }

      return context;
    } catch (error) {
      console.error('Error getting calendar context:', error);
      return 'Unable to fetch calendar context.';
    }
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService();

// Export types
export type { CalendarEvent };

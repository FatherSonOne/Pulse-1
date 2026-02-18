/**
 * Outlook Calendar Service
 * Handles Microsoft Graph API OAuth flow and calendar CRUD operations.
 *
 * Setup requirements:
 *  1. Azure App Registration at https://portal.azure.com
 *  2. Add redirect URI: <your-app-origin>/auth/microsoft/callback
 *  3. Grant API permissions: Calendars.Read, Calendars.ReadWrite, User.Read
 *  4. Set env vars: VITE_MICROSOFT_CLIENT_ID, VITE_MICROSOFT_TENANT_ID (or "common")
 */

import { CalendarEvent } from '../types';

const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const STORAGE_KEY_TOKEN   = 'pulse_outlook_access_token';
const STORAGE_KEY_EXPIRY  = 'pulse_outlook_token_expiry';
const STORAGE_KEY_REFRESH = 'pulse_outlook_refresh_token';
const STORAGE_KEY_CALS    = 'pulse_outlook_calendars';

// ─── Microsoft Graph types ────────────────────────────────────────────────────

export interface OutlookCalendar {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
  hexColor?: string;
}

export interface OutlookEvent {
  id: string;
  subject: string;
  body?: { contentType: string; content: string };
  bodyPreview?: string;
  start: { dateTime: string; timeZone: string };
  end:   { dateTime: string; timeZone: string };
  location?: { displayName: string };
  attendees?: Array<{
    emailAddress: { address: string; name?: string };
    status?: { response: string };
  }>;
  isAllDay?: boolean;
  isCancelled?: boolean;
  onlineMeeting?: { joinUrl: string };
  onlineMeetingUrl?: string;
  webLink?: string;
  recurrence?: unknown;
  categories?: string[];
  organizer?: { emailAddress: { address: string; name?: string } };
  importance?: string;
}

// Microsoft OIDC well-known colors → our hex palette
const OUTLOOK_COLOR_MAP: Record<string, string> = {
  auto:        '#3b82f6',
  lightBlue:   '#38bdf8',
  lightGreen:  '#34d399',
  lightOrange: '#fb923c',
  lightGray:   '#9ca3af',
  lightYellow: '#fbbf24',
  lightTeal:   '#2dd4bf',
  lightPink:   '#f472b6',
  lightBrown:  '#a16207',
  lightRed:    '#f87171',
  maxColor:    '#8b5cf6',
};

// ─── Token helpers ────────────────────────────────────────────────────────────

const saveTokens = (access: string, expiresIn: number, refresh?: string) => {
  localStorage.setItem(STORAGE_KEY_TOKEN, access);
  localStorage.setItem(STORAGE_KEY_EXPIRY, String(Date.now() + expiresIn * 1000));
  if (refresh) localStorage.setItem(STORAGE_KEY_REFRESH, refresh);
};

const loadToken = (): { token: string | null; expiry: number } => ({
  token:  localStorage.getItem(STORAGE_KEY_TOKEN),
  expiry: Number(localStorage.getItem(STORAGE_KEY_EXPIRY) || '0'),
});

const clearTokens = () => {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_EXPIRY);
  localStorage.removeItem(STORAGE_KEY_REFRESH);
  localStorage.removeItem(STORAGE_KEY_CALS);
};

// ─── Event conversion ─────────────────────────────────────────────────────────

const autoDetectType = (subject: string, body: string, hasTeams: boolean): CalendarEvent['type'] => {
  const text = (subject + ' ' + body).toLowerCase();
  if (hasTeams || text.includes('teams') || text.includes('zoom') || text.includes('meet.google')) return 'meet';
  if (/\bcall\b|\bphone\b|\bdial\b/.test(text)) return 'call';
  if (/\bdeadline\b|\bdue\b|\bsubmit\b|\blaunch\b|\bship\b/.test(text)) return 'deadline';
  if (/\bfocus\b|\bdeep work\b|\bheads.down\b/.test(text)) return 'focus';
  if (/\bflight\b|\bairport\b|\btravel\b|\btrip\b|\bvacation\b/.test(text)) return 'travel';
  if (/\bdoctor\b|\bdentist\b|\bgym\b|\bworkout\b|\btherapy\b|\bappointment\b/.test(text)) return 'health';
  if (/\blunch\b|\bdinner\b|\bcoffee\b|\bparty\b|\bbirthday\b|\bsocial\b/.test(text)) return 'social';
  if (/\bpersonal\b|\bfamily\b|\berrand\b|\bhaircut\b/.test(text)) return 'personal';
  return 'event';
};

const outlookEventToCalendarEvent = (ev: OutlookEvent, calendarId: string): CalendarEvent => {
  const startStr = ev.start.dateTime;
  const endStr   = ev.end.dateTime;

  // Graph returns UTC or local; parse safely
  const start = new Date(ev.isAllDay ? startStr.split('T')[0] + 'T00:00:00' : startStr);
  const end   = new Date(ev.isAllDay ? endStr.split('T')[0]   + 'T23:59:59' : endStr);

  const joinUrl = ev.onlineMeeting?.joinUrl || ev.onlineMeetingUrl;
  const body    = ev.bodyPreview || ev.body?.content || '';
  const type    = autoDetectType(ev.subject || '', body, !!joinUrl);

  return {
    id:             `outlook_${ev.id}`,
    title:          ev.subject || 'Untitled',
    start,
    end,
    color:          'bg-blue-600',
    description:    body,
    location:       ev.location?.displayName,
    attendees:      ev.attendees?.map(a => a.emailAddress.address) || [],
    calendarId,
    providerCalendarId: calendarId,
    allDay:         !!ev.isAllDay,
    type,
    source:         'outlook',
    outlookEventId: ev.id,
    meetLink:       joinUrl,
    htmlLink:       ev.webLink,
    organizer:      ev.organizer
      ? { email: ev.organizer.emailAddress.address, displayName: ev.organizer.emailAddress.name }
      : undefined,
    attendeesDetailed: ev.attendees?.map(a => ({
      email:          a.emailAddress.address,
      displayName:    a.emailAddress.name,
      responseStatus: (a.status?.response === 'accepted' ? 'accepted'
        : a.status?.response === 'declined' ? 'declined'
        : 'needsAction') as CalendarEvent['attendeesDetailed'][0]['responseStatus'],
    })),
  };
};

const calendarEventToOutlookEvent = (event: Partial<CalendarEvent>): Record<string, unknown> => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const body: Record<string, unknown> = {
    subject: event.title,
    body: { contentType: 'text', content: event.description || '' },
  };

  if (event.allDay) {
    body.isAllDay = true;
    body.start = { dateTime: event.start?.toISOString().split('T')[0] + 'T00:00:00', timeZone: tz };
    body.end   = { dateTime: event.end?.toISOString().split('T')[0]   + 'T00:00:00', timeZone: tz };
  } else {
    body.start = { dateTime: event.start?.toISOString().replace('Z', ''), timeZone: tz };
    body.end   = { dateTime: event.end?.toISOString().replace('Z', ''),   timeZone: tz };
  }

  if (event.location) {
    body.location = { displayName: event.location };
  }

  if (event.attendees?.length) {
    body.attendees = event.attendees.map(email => ({
      emailAddress: { address: email },
      type: 'required',
    }));
  }

  // Request Teams meeting link for meet-type events
  if (event.type === 'meet') {
    body.isOnlineMeeting = true;
    body.onlineMeetingProvider = 'teamsForBusiness';
  }

  return body;
};

// ─── Main service class ───────────────────────────────────────────────────────

class OutlookCalendarService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Start OAuth PKCE flow — opens Microsoft login popup */
  async connect(): Promise<void> {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';

    if (!clientId) {
      throw new Error('VITE_MICROSOFT_CLIENT_ID is not set. Please configure your Azure App Registration.');
    }

    const redirectUri = `${window.location.origin}/auth/microsoft/callback`;
    const scopes = [
      'https://graph.microsoft.com/Calendars.Read',
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ].join(' ');

    // Generate PKCE verifier + challenge
    const verifier  = this.generateCodeVerifier();
    const challenge = await this.generateCodeChallenge(verifier);
    const state     = crypto.randomUUID();

    sessionStorage.setItem('outlook_pkce_verifier', verifier);
    sessionStorage.setItem('outlook_oauth_state', state);

    const params = new URLSearchParams({
      client_id:             clientId,
      response_type:         'code',
      redirect_uri:          redirectUri,
      scope:                 scopes,
      state,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
      prompt:                'select_account',
    });

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
    window.location.href = authUrl;
  }

  /** Handle the OAuth callback — call this from the /auth/microsoft/callback route */
  async handleCallback(code: string, returnedState: string): Promise<void> {
    const expectedState = sessionStorage.getItem('outlook_oauth_state');
    const verifier      = sessionStorage.getItem('outlook_pkce_verifier');

    if (returnedState !== expectedState) {
      throw new Error('OAuth state mismatch — possible CSRF attack.');
    }

    const clientId   = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    const tenantId   = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';
    const redirectUri = `${window.location.origin}/auth/microsoft/callback`;

    const body = new URLSearchParams({
      client_id:     clientId,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      code_verifier: verifier || '',
    });

    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Outlook token exchange failed: ${err.error_description || res.statusText}`);
    }

    const data = await res.json();
    saveTokens(data.access_token, data.expires_in, data.refresh_token);
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    sessionStorage.removeItem('outlook_pkce_verifier');
    sessionStorage.removeItem('outlook_oauth_state');
  }

  /** Disconnect and clear stored tokens */
  disconnect(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
    clearTokens();
  }

  /** Returns true if there is a stored, non-expired token */
  isConnected(): boolean {
    const { token, expiry } = loadToken();
    return !!token && Date.now() < expiry;
  }

  // ── Token management ──────────────────────────────────────────────────────

  private async getValidToken(): Promise<string> {
    // Use in-memory cache first
    if (this.accessToken && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Try localStorage
    const { token, expiry } = loadToken();
    if (token && Date.now() < expiry - 5 * 60 * 1000) {
      this.accessToken = token;
      this.tokenExpiry = expiry;
      return token;
    }

    // Try refreshing
    const refreshed = await this.refreshAccessToken();
    if (refreshed) return refreshed;

    throw new Error('Outlook session expired. Please reconnect your Microsoft account.');
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
    const clientId     = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    const tenantId     = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';

    if (!refreshToken || !clientId) return null;

    try {
      const body = new URLSearchParams({
        client_id:     clientId,
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        scope: [
          'https://graph.microsoft.com/Calendars.Read',
          'https://graph.microsoft.com/Calendars.ReadWrite',
          'https://graph.microsoft.com/User.Read',
          'offline_access',
        ].join(' '),
      });

      const res = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (!res.ok) {
        console.warn('[Outlook] Token refresh failed — clearing tokens');
        clearTokens();
        return null;
      }

      const data = await res.json();
      saveTokens(data.access_token, data.expires_in, data.refresh_token);
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;
      return data.access_token;
    } catch (err) {
      console.error('[Outlook] Token refresh error:', err);
      return null;
    }
  }

  // ── Graph API helpers ────────────────────────────────────────────────────

  private async graphGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getValidToken();
    const url   = new URL(`${GRAPH_API}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[Outlook] GET ${path} failed: ${err.error?.message || res.statusText}`);
    }
    return res.json();
  }

  private async graphPost<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getValidToken();
    const res = await fetch(`${GRAPH_API}${path}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[Outlook] POST ${path} failed: ${err.error?.message || res.statusText}`);
    }
    return res.json();
  }

  private async graphPatch<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getValidToken();
    const res = await fetch(`${GRAPH_API}${path}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[Outlook] PATCH ${path} failed: ${err.error?.message || res.statusText}`);
    }
    return res.json();
  }

  private async graphDelete(path: string): Promise<void> {
    const token = await this.getValidToken();
    const res = await fetch(`${GRAPH_API}${path}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`[Outlook] DELETE ${path} failed: ${err.error?.message || res.statusText}`);
    }
  }

  // ── Calendar list ────────────────────────────────────────────────────────

  async getCalendars(): Promise<OutlookCalendar[]> {
    try {
      const data = await this.graphGet<{ value: OutlookCalendar[] }>('/me/calendars', {
        $select: 'id,name,color,isDefaultCalendar,canEdit,hexColor',
        $top:    '50',
      });
      const cals = data.value || [];
      localStorage.setItem(STORAGE_KEY_CALS, JSON.stringify(cals));
      return cals;
    } catch (err) {
      console.error('[Outlook] getCalendars error:', err);
      // Return cached if available
      const cached = localStorage.getItem(STORAGE_KEY_CALS);
      return cached ? JSON.parse(cached) : [];
    }
  }

  getCachedCalendars(): OutlookCalendar[] {
    const cached = localStorage.getItem(STORAGE_KEY_CALS);
    return cached ? JSON.parse(cached) : [];
  }

  // ── Events CRUD ───────────────────────────────────────────────────────────

  async getEvents(startDate: Date, endDate: Date, calendarId = 'primary'): Promise<CalendarEvent[]> {
    const calPath = calendarId === 'primary'
      ? '/me/calendar/calendarView'
      : `/me/calendars/${calendarId}/calendarView`;

    try {
      // Graph calendarView requires startDateTime and endDateTime
      const data = await this.graphGet<{ value: OutlookEvent[] }>(calPath, {
        startDateTime: startDate.toISOString(),
        endDateTime:   endDate.toISOString(),
        $select:       'id,subject,body,bodyPreview,start,end,location,attendees,isAllDay,isCancelled,onlineMeeting,onlineMeetingUrl,webLink,organizer,categories',
        $top:          '500',
        $orderby:      'start/dateTime asc',
      });

      return (data.value || [])
        .filter(ev => !ev.isCancelled)
        .map(ev => outlookEventToCalendarEvent(ev, calendarId));
    } catch (err) {
      console.error('[Outlook] getEvents error:', err);
      return [];
    }
  }

  async getAllCalendarsEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const calendars = await this.getCalendars();
    const results   = await Promise.allSettled(
      calendars.map(cal => this.getEvents(startDate, endDate, cal.id))
    );

    return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  }

  async createEvent(event: Partial<CalendarEvent>, calendarId = 'primary'): Promise<CalendarEvent> {
    const calPath = calendarId === 'primary'
      ? '/me/calendar/events'
      : `/me/calendars/${calendarId}/events`;

    const body    = calendarEventToOutlookEvent(event);
    const created = await this.graphPost<OutlookEvent>(calPath, body);
    return outlookEventToCalendarEvent(created, calendarId);
  }

  async updateEvent(outlookEventId: string, updates: Partial<CalendarEvent>, calendarId = 'primary'): Promise<CalendarEvent> {
    const calPath = calendarId === 'primary'
      ? `/me/calendar/events/${outlookEventId}`
      : `/me/calendars/${calendarId}/events/${outlookEventId}`;

    const body    = calendarEventToOutlookEvent(updates);
    const updated = await this.graphPatch<OutlookEvent>(calPath, body);
    return outlookEventToCalendarEvent(updated, calendarId);
  }

  async deleteEvent(outlookEventId: string, calendarId = 'primary'): Promise<void> {
    const calPath = calendarId === 'primary'
      ? `/me/calendar/events/${outlookEventId}`
      : `/me/calendars/${calendarId}/events/${outlookEventId}`;

    await this.graphDelete(calPath);
  }

  // ── User profile ─────────────────────────────────────────────────────────

  async getUserProfile(): Promise<{ displayName: string; mail: string; id: string } | null> {
    try {
      return await this.graphGet('/me', { $select: 'displayName,mail,id' });
    } catch {
      return null;
    }
  }

  // ── PKCE helpers ─────────────────────────────────────────────────────────

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const data    = new TextEncoder().encode(verifier);
    const digest  = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}

export const outlookCalendarService = new OutlookCalendarService();
export { OUTLOOK_COLOR_MAP };

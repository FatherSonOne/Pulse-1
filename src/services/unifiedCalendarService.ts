/**
 * Unified Calendar Service
 * Provider-agnostic abstraction over Google Calendar, Outlook, and local events.
 * Consumers import this service; they never need to know which provider is active.
 */

import { CalendarEvent } from '../types';
import { googleCalendarService, GoogleCalendar } from './googleCalendarService';
import { outlookCalendarService, OutlookCalendar } from './outlookCalendarService';
import { dataService } from './dataService';

// ─── Provider descriptor ──────────────────────────────────────────────────────

export type CalendarProviderType = 'local' | 'google' | 'outlook';

export interface CalendarProviderInfo {
  type: CalendarProviderType;
  label: string;
  icon: string;        // Font Awesome class
  color: string;       // Hex
  connected: boolean;
  userEmail?: string;
  calendars: ProviderCalendar[];
}

export interface ProviderCalendar {
  id: string;
  name: string;
  color: string;
  primary: boolean;
  provider: CalendarProviderType;
  enabled: boolean;    // User can toggle individual calendars on/off
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const PREFS_KEY = 'pulse_unified_cal_prefs';

interface CalendarPrefs {
  disabledCalendars: string[];  // "provider:calendarId" keys
}

const loadPrefs = (): CalendarPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : { disabledCalendars: [] };
  } catch {
    return { disabledCalendars: [] };
  }
};

const savePrefs = (prefs: CalendarPrefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
};

const calKey = (provider: CalendarProviderType, calId: string) => `${provider}:${calId}`;

// ─── Main service ─────────────────────────────────────────────────────────────

class UnifiedCalendarService {

  // ── Provider status ───────────────────────────────────────────────────────

  isGoogleConnected(): boolean {
    try {
      return googleCalendarService.isAuthenticated?.() ?? false;
    } catch {
      return false;
    }
  }

  isOutlookConnected(): boolean {
    return outlookCalendarService.isConnected();
  }

  /** Returns a summary of every configured provider with their calendars */
  async getProviders(): Promise<CalendarProviderInfo[]> {
    const prefs   = loadPrefs();
    const providers: CalendarProviderInfo[] = [];

    // ── Local ────────────────────────────────────────────────────────────
    providers.push({
      type:      'local',
      label:     'Local Events',
      icon:      'fa-calendar',
      color:     '#6b7280',
      connected: true,
      calendars: [{
        id:       'local',
        name:     'Local Events',
        color:    '#6b7280',
        primary:  true,
        provider: 'local',
        enabled:  !prefs.disabledCalendars.includes(calKey('local', 'local')),
      }],
    });

    // ── Google ───────────────────────────────────────────────────────────
    if (this.isGoogleConnected()) {
      try {
        const gCals: GoogleCalendar[] = await googleCalendarService.getCalendars();
        providers.push({
          type:      'google',
          label:     'Google Calendar',
          icon:      'fa-brands fa-google',
          color:     '#4285f4',
          connected: true,
          calendars: gCals.map(c => ({
            id:       c.id,
            name:     c.summary,
            color:    c.backgroundColor || '#4285f4',
            primary:  !!c.primary,
            provider: 'google' as CalendarProviderType,
            enabled:  !prefs.disabledCalendars.includes(calKey('google', c.id)),
          })),
        });
      } catch (err) {
        console.warn('[Unified] Could not fetch Google calendars:', err);
        providers.push({
          type: 'google', label: 'Google Calendar',
          icon: 'fa-brands fa-google', color: '#4285f4',
          connected: true, calendars: [],
        });
      }
    } else {
      providers.push({
        type: 'google', label: 'Google Calendar',
        icon: 'fa-brands fa-google', color: '#4285f4',
        connected: false, calendars: [],
      });
    }

    // ── Outlook ───────────────────────────────────────────────────────────
    if (this.isOutlookConnected()) {
      try {
        const oCals: OutlookCalendar[] = await outlookCalendarService.getCalendars();
        const profile = await outlookCalendarService.getUserProfile();
        providers.push({
          type:      'outlook',
          label:     'Outlook Calendar',
          icon:      'fa-brands fa-microsoft',
          color:     '#0078d4',
          connected: true,
          userEmail: profile?.mail,
          calendars: oCals.map(c => ({
            id:       c.id,
            name:     c.name,
            color:    c.hexColor || '#0078d4',
            primary:  !!c.isDefaultCalendar,
            provider: 'outlook' as CalendarProviderType,
            enabled:  !prefs.disabledCalendars.includes(calKey('outlook', c.id)),
          })),
        });
      } catch (err) {
        console.warn('[Unified] Could not fetch Outlook calendars:', err);
        providers.push({
          type: 'outlook', label: 'Outlook Calendar',
          icon: 'fa-brands fa-microsoft', color: '#0078d4',
          connected: true, calendars: [],
        });
      }
    } else {
      providers.push({
        type: 'outlook', label: 'Outlook Calendar',
        icon: 'fa-brands fa-microsoft', color: '#0078d4',
        connected: false, calendars: [],
      });
    }

    return providers;
  }

  // ── Event fetching ────────────────────────────────────────────────────────

  /**
   * Fetch all enabled-calendar events across every connected provider.
   * Falls back gracefully if any provider fails.
   */
  async getAllEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const prefs = loadPrefs();
    const all: CalendarEvent[] = [];

    // Local
    if (!prefs.disabledCalendars.includes(calKey('local', 'local'))) {
      try {
        const local = await dataService.getEvents(startDate, endDate);
        all.push(...local);
      } catch (err) {
        console.warn('[Unified] Local events error:', err);
      }
    }

    // Google
    if (this.isGoogleConnected()) {
      try {
        const gCals: GoogleCalendar[] = await googleCalendarService.getCalendars().catch(() => []);
        const enabledGCals = gCals.filter(
          c => !prefs.disabledCalendars.includes(calKey('google', c.id))
        );
        const results = await Promise.allSettled(
          enabledGCals.map(c => googleCalendarService.getEvents(startDate, endDate, c.id))
        );
        results.forEach(r => {
          if (r.status === 'fulfilled') all.push(...r.value);
        });
      } catch (err) {
        console.warn('[Unified] Google events error:', err);
      }
    }

    // Outlook
    if (this.isOutlookConnected()) {
      try {
        const oCals = outlookCalendarService.getCachedCalendars();
        const enabledOCals = oCals.length > 0
          ? oCals.filter(c => !prefs.disabledCalendars.includes(calKey('outlook', c.id)))
          : [{ id: 'primary', name: 'Calendar' }];

        const results = await Promise.allSettled(
          enabledOCals.map(c => outlookCalendarService.getEvents(startDate, endDate, c.id))
        );
        results.forEach(r => {
          if (r.status === 'fulfilled') all.push(...r.value);
        });
      } catch (err) {
        console.warn('[Unified] Outlook events error:', err);
      }
    }

    // Deduplicate by title+start (same meeting could exist in Google and local)
    return this.deduplicate(all).sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // ── Write operations ──────────────────────────────────────────────────────

  /**
   * Create an event on the given provider. Defaults to local if not specified.
   */
  async createEvent(event: Partial<CalendarEvent>, provider: CalendarProviderType = 'local', calendarId?: string): Promise<CalendarEvent> {
    switch (provider) {
      case 'google':
        return googleCalendarService.createEvent(event, calendarId || 'primary');
      case 'outlook':
        return outlookCalendarService.createEvent(event, calendarId || 'primary');
      default:
        return dataService.createEvent(event as CalendarEvent);
    }
  }

  async updateEvent(event: CalendarEvent, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    switch (event.source) {
      case 'google':
        if (!event.googleEventId) throw new Error('Missing googleEventId');
        return googleCalendarService.updateEvent(event.googleEventId, updates, event.providerCalendarId);
      case 'outlook':
        if (!event.outlookEventId) throw new Error('Missing outlookEventId');
        return outlookCalendarService.updateEvent(event.outlookEventId, updates, event.providerCalendarId);
      default:
        return dataService.updateEvent(event.id, updates);
    }
  }

  async deleteEvent(event: CalendarEvent): Promise<void> {
    switch (event.source) {
      case 'google':
        if (!event.googleEventId) throw new Error('Missing googleEventId');
        await googleCalendarService.deleteEvent(event.googleEventId, event.providerCalendarId);
        break;
      case 'outlook':
        if (!event.outlookEventId) throw new Error('Missing outlookEventId');
        await outlookCalendarService.deleteEvent(event.outlookEventId, event.providerCalendarId);
        break;
      default:
        await dataService.deleteEvent(event.id);
    }
  }

  // ── Calendar visibility prefs ─────────────────────────────────────────────

  setCalendarEnabled(provider: CalendarProviderType, calendarId: string, enabled: boolean): void {
    const prefs = loadPrefs();
    const key   = calKey(provider, calendarId);

    if (enabled) {
      prefs.disabledCalendars = prefs.disabledCalendars.filter(k => k !== key);
    } else {
      if (!prefs.disabledCalendars.includes(key)) {
        prefs.disabledCalendars.push(key);
      }
    }

    savePrefs(prefs);
  }

  isCalendarEnabled(provider: CalendarProviderType, calendarId: string): boolean {
    return !loadPrefs().disabledCalendars.includes(calKey(provider, calendarId));
  }

  // ── Connection actions ────────────────────────────────────────────────────

  async connectOutlook(): Promise<void> {
    await outlookCalendarService.connect();
  }

  disconnectOutlook(): void {
    outlookCalendarService.disconnect();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private deduplicate(events: CalendarEvent[]): CalendarEvent[] {
    const seen = new Set<string>();
    return events.filter(ev => {
      // Key: normalized title + start minute — catches same event from multiple providers
      const key = `${ev.title.toLowerCase().trim()}|${Math.floor(ev.start.getTime() / 60000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const unifiedCalendarService = new UnifiedCalendarService();

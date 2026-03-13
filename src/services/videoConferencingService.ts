/**
 * videoConferencingService.ts
 *
 * Generates video conferencing links for calendar events.
 * Supports: Pulse Meet (always available), Google Meet,
 *           Zoom (requires API keys), Microsoft Teams (requires API keys).
 *
 * If a provider is not configured, returns null and a setup prompt
 * rather than throwing — the UI shows a "Connect in Settings" state.
 */

import { supabase } from './supabase';
import { outlookCalendarService } from './outlookCalendarService';
import { createPulseRoom } from './pulseVideoService';

// ── Types ────────────────────────────────────────────────────────────────────

export type VideoProvider = 'pulse' | 'meet' | 'zoom' | 'teams' | 'none';

export interface VideoLinkResult {
  provider: VideoProvider;
  url: string | null;
  /** Human-readable label shown on the join button */
  label: string;
  /** True when the provider requires OAuth/API setup that isn't done */
  needsSetup: boolean;
  setupPrompt?: string;
}

// ── Pulse Meet ────────────────────────────────────────────────────────────────

/**
 * Generates a Pulse native meeting room URL backed by a real Daily.co room.
 * Creates the room server-side via the daily-rooms Edge Function.
 * Falls back to a local URL if the edge function is unreachable.
 */
export async function generatePulseMeetingLink(eventId: string, title?: string): Promise<VideoLinkResult> {
  try {
    const room = await createPulseRoom(eventId, title ?? 'Pulse Meeting');
    return {
      provider:   'pulse',
      url:        `/meet/${room.roomName}`,
      label:      'Join Pulse Meet',
      needsSetup: false,
    };
  } catch (err) {
    console.warn('[videoConferencingService] Daily room creation failed, using local fallback:', err);
    const roomId = eventId.replace(/-/g, '').slice(0, 16);
    return {
      provider:   'pulse',
      url:        `/meet/pulse-${roomId}`,
      label:      'Join Pulse Meet',
      needsSetup: false,
    };
  }
}

// ── Google Meet ───────────────────────────────────────────────────────────────

/**
 * Returns a Google Meet link using the existing googleCalendarService if connected.
 * Falls back to setup prompt if Google Calendar is not connected.
 */
export async function generateMeetLink(eventTitle: string): Promise<VideoLinkResult> {
  // Check if Google Calendar OAuth token exists in the session
  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;

  if (!providerToken) {
    return {
      provider:    'meet',
      url:         null,
      label:       'Google Meet',
      needsSetup:  true,
      setupPrompt: 'Connect Google Calendar in Settings to generate Meet links.',
    };
  }

  try {
    // Create a minimal calendar event via the Google API to get a Meet link
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${providerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: eventTitle,
          start:   { dateTime: new Date().toISOString() },
          end:     { dateTime: new Date(Date.now() + 3600000).toISOString() },
          conferenceData: {
            createRequest: {
              requestId:             `pulse-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      },
    );

    if (!res.ok) throw new Error('Google API error');

    const event = await res.json() as { conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] } };
    const meetLink = event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ?? null;

    return {
      provider:   'meet',
      url:        meetLink,
      label:      'Join Google Meet',
      needsSetup: !meetLink,
      setupPrompt: meetLink ? undefined : 'Could not generate Meet link — check Google Calendar connection.',
    };
  } catch {
    return {
      provider:    'meet',
      url:         null,
      label:       'Google Meet',
      needsSetup:  true,
      setupPrompt: 'Failed to generate Meet link. Reconnect Google Calendar in Settings.',
    };
  }
}

// ── Zoom ──────────────────────────────────────────────────────────────────────

// Zoom Server-to-Server OAuth token cache
let _zoomTokenCache: { token: string; expiresAt: number } | null = null;

async function getZoomAccessToken(): Promise<string | null> {
  const clientId     = import.meta.env.VITE_ZOOM_CLIENT_ID     as string | undefined;
  const clientSecret = import.meta.env.VITE_ZOOM_CLIENT_SECRET as string | undefined;
  const accountId    = import.meta.env.VITE_ZOOM_ACCOUNT_ID    as string | undefined;

  if (!clientId || !clientSecret || !accountId) return null;

  // Return cached token if still valid (5-minute buffer)
  if (_zoomTokenCache && Date.now() < _zoomTokenCache.expiresAt - 5 * 60 * 1000) {
    return _zoomTokenCache.token;
  }

  // Also check sessionStorage
  const cached = sessionStorage.getItem('pulse_zoom_token');
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { token: string; expiresAt: number };
      if (Date.now() < parsed.expiresAt - 5 * 60 * 1000) {
        _zoomTokenCache = parsed;
        return parsed.token;
      }
    } catch { /* stale — refetch */ }
  }

  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}` },
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string; expires_in: number };
    const entry = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    _zoomTokenCache = entry;
    sessionStorage.setItem('pulse_zoom_token', JSON.stringify(entry));
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Generates a Zoom meeting link via Server-to-Server OAuth.
 * Requires VITE_ZOOM_CLIENT_ID, VITE_ZOOM_CLIENT_SECRET, VITE_ZOOM_ACCOUNT_ID.
 * If not configured, returns a setup prompt.
 */
export async function generateZoomLink(
  topic: string,
  startTime: Date,
  durationMinutes: number,
): Promise<VideoLinkResult> {
  const token = await getZoomAccessToken();

  if (!token) {
    return {
      provider:    'zoom',
      url:         null,
      label:       'Zoom',
      needsSetup:  true,
      setupPrompt: 'Add VITE_ZOOM_CLIENT_ID, VITE_ZOOM_CLIENT_SECRET, and VITE_ZOOM_ACCOUNT_ID to enable Zoom links.',
    };
  }

  try {
    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        type:       2, // scheduled
        start_time: startTime.toISOString(),
        duration:   durationMinutes,
        settings:   { join_before_host: true },
      }),
    });

    if (!res.ok) throw new Error('Zoom API error');

    const meeting = await res.json() as { join_url: string };
    return {
      provider:   'zoom',
      url:        meeting.join_url,
      label:      'Join Zoom Meeting',
      needsSetup: false,
    };
  } catch {
    return {
      provider:    'zoom',
      url:         null,
      label:       'Zoom',
      needsSetup:  true,
      setupPrompt: 'Failed to create Zoom meeting. Check your Zoom integration in Settings.',
    };
  }
}

// ── Microsoft Teams ───────────────────────────────────────────────────────────

/**
 * Generates a Teams meeting link via Microsoft Graph API.
 * Reuses the existing Outlook OAuth token — no separate Teams setup needed
 * once OnlineMeetings.ReadWrite is granted to the Azure app.
 */
export async function generateTeamsLink(
  subject: string,
  startTime: Date,
): Promise<VideoLinkResult> {
  const token = outlookCalendarService.getAccessToken();

  if (!token) {
    return {
      provider:    'teams',
      url:         null,
      label:       'Microsoft Teams',
      needsSetup:  true,
      setupPrompt: 'Connect Outlook in Settings to enable Teams meeting links.',
    };
  }

  try {
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const res = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        startDateTime: startTime.toISOString(),
        endDateTime:   endTime.toISOString(),
      }),
    });

    if (!res.ok) throw new Error('Teams API error');

    const meeting = await res.json() as { joinWebUrl?: string };
    return {
      provider:   'teams',
      url:        meeting.joinWebUrl ?? null,
      label:      'Join Teams Meeting',
      needsSetup: !meeting.joinWebUrl,
      setupPrompt: meeting.joinWebUrl ? undefined : 'Teams meeting created but no join URL returned.',
    };
  } catch {
    return {
      provider:    'teams',
      url:         null,
      label:       'Microsoft Teams',
      needsSetup:  true,
      setupPrompt: 'Failed to create Teams meeting. Ensure OnlineMeetings.ReadWrite scope is granted.',
    };
  }
}

// ── URL detection ─────────────────────────────────────────────────────────────

/**
 * Detects the video provider from a URL string.
 */
export function detectConferencingFromUrl(url: string): VideoProvider {
  if (!url) return 'none';
  if (url.includes('meet.google.com'))     return 'meet';
  if (url.includes('zoom.us'))             return 'zoom';
  if (url.includes('teams.microsoft.com')) return 'teams';
  if (url.includes('/meet/'))              return 'pulse';
  return 'none';
}

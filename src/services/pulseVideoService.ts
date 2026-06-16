/**
 * pulseVideoService.ts
 * Client-side service for Pulse Video (powered by Daily.co).
 * All Daily API calls go through the `daily-rooms` Supabase Edge Function
 * so the API key is never exposed to the browser.
 */

import { supabase } from './supabaseClient';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-rooms`;

/**
 * Distinct error codes so callers can surface the right message.
 * - 'no-session'     — user has never signed in / signed out
 * - 'auth-expired'   — refresh attempted, still no valid token (sign-in required)
 * - 'forbidden'      — server returned 401/403 with a valid-looking token
 * - 'server'         — non-auth server error (5xx, validation, etc.)
 */
export type EdgeErrorCode = 'no-session' | 'auth-expired' | 'forbidden' | 'server';

export class EdgeCallError extends Error {
  code: EdgeErrorCode;
  status?: number;
  constructor(code: EdgeErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'EdgeCallError';
    this.code = code;
    this.status = status;
  }
}

/** True if the access_token is within `bufferSec` of expiring (or already expired). */
function isExpiringSoon(expiresAtSec: number | undefined | null, bufferSec = 30): boolean {
  if (!expiresAtSec) return true;
  return expiresAtSec * 1000 - Date.now() < bufferSec * 1000;
}

/** Resolve a fresh access_token, refreshing the session if needed. */
async function getFreshAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token && !isExpiringSoon(session.expires_at)) {
    return session.access_token;
  }
  // Token missing or about to expire — try a single refresh.
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error) console.warn('[pulseVideoService] refreshSession error:', error.message);
  return refreshed.session?.access_token ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callEdge(body: Record<string, unknown>): Promise<any> {
  const token = await getFreshAccessToken();
  if (!token) {
    throw new EdgeCallError(
      'no-session',
      'You need to sign in to start or join a Pulse meeting.',
    );
  }

  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let data: { error?: string } & Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty body / non-JSON response — leave data as {} */
  }

  if (res.ok) return data;

  // Map error responses to actionable codes.
  if (res.status === 401 || res.status === 403) {
    // Edge said "Invalid token" / "Authentication required" with our fresh token.
    // The session is genuinely no good — caller should prompt sign-in.
    // Log enough context to debug without exposing the token itself.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      console.warn('[pulseVideoService] Edge returned 401 with a fresh token. Session diagnosis:', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        clientUserId: user?.id,
        expiresInSec: session?.expires_at ? session.expires_at - Math.floor(Date.now() / 1000) : null,
        edgeError: data.error,
      });
    } catch (e) {
      console.warn('[pulseVideoService] Diagnostic getSession/getUser also failed:', e);
    }
    throw new EdgeCallError(
      'auth-expired',
      'Your session is no longer valid. Sign out and sign back in to fix this.',
      res.status,
    );
  }
  throw new EdgeCallError(
    'server',
    data.error ?? `Edge function error ${res.status}`,
    res.status,
  );
}

// ── Room management ────────────────────────────────────────────────────────────

export interface PulseRoom {
  roomUrl: string;
  roomName: string;
}

/**
 * Create (or retrieve existing) a Daily room.
 * Pass `eventId` to link the room to a calendar event.
 */
export async function createPulseRoom(eventId?: string, title?: string): Promise<PulseRoom> {
  return callEdge({ action: 'create-room', eventId, title });
}

/**
 * Get a meeting token for the current user to join a room.
 * `isOwner: true` grants host controls (mute all, end meeting, record).
 */
export async function getMeetingToken(roomName: string, isOwner: boolean, displayName?: string): Promise<string> {
  const data = await callEdge({ action: 'create-token', roomName, isOwner, displayName });
  return data.token as string;
}

/**
 * Notify the server that recording has started (updates DB status).
 */
export async function notifyRecordingStarted(roomName: string): Promise<void> {
  await callEdge({ action: 'start-recording', roomName });
}

/**
 * Notify the server that recording has stopped.
 */
export async function notifyRecordingStopped(roomName: string): Promise<void> {
  await callEdge({ action: 'stop-recording', roomName });
}

/**
 * Fetch recordings for a room from Daily.
 */
export interface DailyRecording {
  id: string;
  room_name: string;
  start_ts: number;
  status: string;
  max_participants: number;
  duration: number;
  s3key?: string;
  share_token?: string;
}

export async function getRoomRecordings(roomName: string): Promise<DailyRecording[]> {
  const data = await callEdge({ action: 'get-recordings', roomName });
  return data.recordings ?? [];
}

/**
 * Save transcript and AI summary to the room record after the meeting ends.
 */
export async function saveTranscript(roomName: string, transcript: string, summary: string): Promise<void> {
  await callEdge({ action: 'save-transcript', roomName, transcript, summary });
}

// ── Supabase queries ───────────────────────────────────────────────────────────

export interface VideoRoomRecord {
  id: string;
  room_name: string;
  room_url: string;
  title?: string;
  calendar_event_id?: string;
  created_at: string;
  status: 'waiting' | 'active' | 'recording' | 'ended';
  recording_url?: string;
  transcript?: string;
  summary?: string;
  duration_seconds?: number;
}

/**
 * Get the video room linked to a calendar event (if any).
 */
export async function getRoomForEvent(eventId: string): Promise<VideoRoomRecord | null> {
  const { data, error } = await supabase
    .from('pulse_video_rooms')
    .select('*')
    .eq('calendar_event_id', eventId)
    .single();

  if (error || !data) return null;
  return data as VideoRoomRecord;
}

/**
 * Get all past rooms created by the current user.
 */
export async function getMyPastRooms(): Promise<VideoRoomRecord[]> {
  const { data, error } = await supabase
    .from('pulse_video_rooms')
    .select('*')
    .eq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return (data ?? []) as VideoRoomRecord[];
}

/**
 * Mark a room as active (called when first participant joins).
 */
export async function markRoomActive(roomName: string): Promise<void> {
  await supabase
    .from('pulse_video_rooms')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('room_name', roomName);
}

/**
 * Mark a room as ended and store duration.
 */
export async function markRoomEnded(roomName: string, durationSeconds: number): Promise<void> {
  await supabase
    .from('pulse_video_rooms')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('room_name', roomName);
}

/**
 * Look up a room record by its Daily room name.
 */
export async function getRoomByName(roomName: string): Promise<VideoRoomRecord | null> {
  const { data, error } = await supabase
    .from('pulse_video_rooms')
    .select('*')
    .eq('room_name', roomName)
    .single();

  if (error || !data) return null;
  return data as VideoRoomRecord;
}

/**
 * Poll Daily for a recording on a specific room, then persist the URL to Supabase.
 * Retries every `intervalMs` up to `maxAttempts` times.
 * Returns the recording download URL when found, or null if timed out.
 *
 * Call this after a meeting ends — Daily takes 2-5 minutes to process recordings.
 */
export async function pollForRecording(
  roomName: string,
  maxAttempts = 20,
  intervalMs = 20000,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, intervalMs));
    }

    try {
      const { recordings } = await callEdge({ action: 'get-recordings', roomName });
      const ready = (recordings as DailyRecording[]).find(r => r.status === 'finished' || r.status === 'ready');

      if (ready) {
        // Fetch the access/download link via the edge function
        const { url } = await callEdge({ action: 'get-recording-link', recordingId: ready.id });
        if (url) {
          // Persist to Supabase
          await supabase
            .from('pulse_video_rooms')
            .update({ recording_id: ready.id, recording_url: url, status: 'ended' })
            .eq('room_name', roomName);
          return url as string;
        }
      }
    } catch (err) {
      console.warn(`[pulseVideoService] Poll attempt ${attempt + 1} failed:`, err);
    }
  }
  return null;
}

/**
 * Fetch unresolved rooms (ended, no recording_url yet) and kick off polling for each.
 * Call this when the user opens the Recordings modal so stale rooms catch up.
 */
export async function syncPendingRecordings(): Promise<void> {
  // Catch any recently-ended room missing a recording_url. We intentionally do
  // NOT require recording_id here: in the client-poll (Path B) flow recording_id
  // stays null until pollForRecording resolves it, so the old
  // `recording_id IS NOT NULL` filter never matched Path-B rooms. pollForRecording
  // queries Daily by room_name, so a non-recorded room is just one cheap
  // get-recordings call that finds nothing and no-ops.
  const { data: pendingRooms } = await supabase
    .from('pulse_video_rooms')
    .select('room_name, ended_at')
    .eq('status', 'ended')
    .is('recording_url', null);

  if (!pendingRooms?.length) return;

  // Only retry rooms that ended within the last 30 minutes — beyond that the
  // user can reopen Recordings to retry, and we avoid sweeping stale rooms.
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recentRooms = pendingRooms.filter(r =>
    r.ended_at && new Date(r.ended_at).getTime() > cutoff
  );

  // One lightweight Daily check per room in background (non-blocking). A single
  // attempt keeps non-recorded rooms to a single API call; rooms still
  // processing on Daily's side self-heal on the next modal open.
  for (const room of recentRooms) {
    pollForRecording(room.room_name, 1, 0).catch(() => {});
  }
}

/**
 * Helper — extract room name from a Pulse meet URL.
 * e.g. "/meet/pulse-abc123def456789" → "pulse-abc123def456789"
 */
export function getRoomNameFromUrl(url: string): string | null {
  const match = url.match(/\/meet\/([a-z0-9-]+)/);
  return match ? match[1] : null;
}

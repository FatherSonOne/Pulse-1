// ============================================================
// ETA Share Service
//
// Live ETA share — the user creates a tokenized public link that
// shows their moving pin + travel time to a destination. Anyone
// with the link can view (no Pulse account required). Auto-expires
// at the chosen duration; auto-marks 'arrived' when the sharer
// gets within ARRIVAL_RADIUS_M of the destination.
//
// Position + ETA progress is updated by a hook in locationService's
// broadcast tick (same 15s debounce as the user_locations upsert,
// so the directions API quota stays sane).
// ============================================================

import { supabase } from './supabase';
import { getTravelTime } from './directionsService';

const ARRIVAL_RADIUS_M = 75;          // mark 'arrived' when within this distance
const MIN_UPDATE_INTERVAL_MS = 12_000; // skip updates if we just ran one
const ETA_DIRECTIONS_MIN_DISTANCE_M = 500; // skip API call for tiny movements

export interface EtaShare {
  id: string;
  token: string;
  userId: string;
  destinationLat: number;
  destinationLng: number;
  destinationLabel: string | null;
  recipientContactId: string | null;
  recipientLabel: string | null;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  status: 'active' | 'arrived' | 'canceled' | 'expired';
  lastLat: number | null;
  lastLng: number | null;
  lastEtaSeconds: number | null;
  lastDistanceM: number | null;
  lastUpdatedAt: string | null;
  createdAt: string;
}

export interface PublicEtaShare {
  id: string;
  token: string;
  destinationLat: number;
  destinationLng: number;
  destinationLabel: string | null;
  recipientLabel: string | null;
  status: EtaShare['status'];
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastEtaSeconds: number | null;
  lastDistanceM: number | null;
  lastUpdatedAt: string | null;
}

interface CreateEtaShareInput {
  destination: { lat: number; lng: number; label?: string };
  expiresInMinutes: number;
  recipientContactId?: string;
  recipientLabel?: string;
}

let lastTickAt = 0;

function rowToShare(row: Record<string, unknown>): EtaShare {
  return {
    id: String(row.id),
    token: String(row.token),
    userId: String(row.user_id),
    destinationLat: Number(row.destination_lat),
    destinationLng: Number(row.destination_lng),
    destinationLabel: (row.destination_label ?? null) as string | null,
    recipientContactId: (row.recipient_contact_id ?? null) as string | null,
    recipientLabel: (row.recipient_label ?? null) as string | null,
    startedAt: String(row.started_at),
    expiresAt: String(row.expires_at),
    endedAt: (row.ended_at ?? null) as string | null,
    status: row.status as EtaShare['status'],
    lastLat: row.last_lat == null ? null : Number(row.last_lat),
    lastLng: row.last_lng == null ? null : Number(row.last_lng),
    lastEtaSeconds: row.last_eta_seconds == null ? null : Number(row.last_eta_seconds),
    lastDistanceM: row.last_distance_m == null ? null : Number(row.last_distance_m),
    lastUpdatedAt: (row.last_updated_at ?? null) as string | null,
    createdAt: String(row.created_at),
  };
}

function rowToPublic(row: Record<string, unknown>): PublicEtaShare {
  return {
    id: String(row.id),
    token: String(row.token),
    destinationLat: Number(row.destination_lat),
    destinationLng: Number(row.destination_lng),
    destinationLabel: (row.destination_label ?? null) as string | null,
    recipientLabel: (row.recipient_label ?? null) as string | null,
    status: row.status as EtaShare['status'],
    startedAt: String(row.started_at),
    expiresAt: String(row.expires_at),
    endedAt: (row.ended_at ?? null) as string | null,
    lastLat: row.last_lat == null ? null : Number(row.last_lat),
    lastLng: row.last_lng == null ? null : Number(row.last_lng),
    lastEtaSeconds: row.last_eta_seconds == null ? null : Number(row.last_eta_seconds),
    lastDistanceM: row.last_distance_m == null ? null : Number(row.last_distance_m),
    lastUpdatedAt: (row.last_updated_at ?? null) as string | null,
  };
}

/** Create a new active share. Returns the share row + the full public URL. */
export async function createEtaShare(input: CreateEtaShareInput): Promise<{ share: EtaShare; url: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // URL-safe token. crypto.randomUUID gives us 36 chars with hyphens; we
  // strip hyphens for a cleaner URL but keep entropy at 128 bits.
  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000);

  const { data, error } = await supabase
    .from('eta_shares')
    .insert({
      token,
      user_id: user.id,
      destination_lat: input.destination.lat,
      destination_lng: input.destination.lng,
      destination_label: input.destination.label ?? null,
      recipient_contact_id: input.recipientContactId ?? null,
      recipient_label: input.recipientLabel ?? null,
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;

  const share = rowToShare(data as Record<string, unknown>);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/eta/${token}`;
  return { share, url };
}

/** List active shares for the current user. */
export async function listActiveShares(): Promise<EtaShare[]> {
  const { data, error } = await supabase
    .from('eta_shares')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false });
  if (error) {
    console.error('[etaShareService] listActiveShares error:', error);
    return [];
  }
  return (data ?? []).map(r => rowToShare(r as Record<string, unknown>));
}

/**
 * Cancel a share (user-initiated end). Marks status='canceled' and sets
 * ended_at so the public viewer shows the canceled state.
 */
export async function cancelEtaShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('eta_shares')
    .update({ status: 'canceled', ended_at: new Date().toISOString() })
    .eq('id', shareId);
  if (error) throw error;
}

/**
 * Public-side lookup. Uses the SECURITY DEFINER RPC so callers don't
 * need to be authenticated (recipients are anonymous by design).
 */
export async function getEtaShareByToken(token: string): Promise<PublicEtaShare | null> {
  const { data, error } = await supabase.rpc('get_eta_share_by_token', { p_token: token });
  if (error) {
    console.error('[etaShareService] getEtaShareByToken error:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return rowToPublic(row as Record<string, unknown>);
}

/**
 * Called from locationService's broadcast tick. Refreshes ETA + distance
 * for every active share owned by the current user and auto-completes
 * any share whose sharer has reached the destination.
 *
 * Throttled to MIN_UPDATE_INTERVAL_MS to avoid hammering the directions
 * API even if multiple ticks fire close together.
 */
export async function tickActiveShares(currentLat: number, currentLng: number): Promise<void> {
  const now = Date.now();
  if (now - lastTickAt < MIN_UPDATE_INTERVAL_MS) return;
  lastTickAt = now;

  const shares = await listActiveShares();
  if (shares.length === 0) return;

  // Auto-expire anything past expires_at — cheap local check before any API calls.
  const expiredIds = shares
    .filter(s => new Date(s.expiresAt).getTime() <= now)
    .map(s => s.id);
  if (expiredIds.length > 0) {
    await supabase
      .from('eta_shares')
      .update({ status: 'expired', ended_at: new Date().toISOString() })
      .in('id', expiredIds);
  }

  const stillActive = shares.filter(s => !expiredIds.includes(s.id));

  await Promise.allSettled(
    stillActive.map(s => updateShareProgress(s, currentLat, currentLng))
  );
}

async function updateShareProgress(
  share: EtaShare,
  currentLat: number,
  currentLng: number,
): Promise<void> {
  const distanceM = haversineMeters(
    currentLat, currentLng,
    share.destinationLat, share.destinationLng,
  );

  // Arrived — mark complete and skip the directions call.
  if (distanceM <= ARRIVAL_RADIUS_M) {
    await supabase
      .from('eta_shares')
      .update({
        status: 'arrived',
        ended_at: new Date().toISOString(),
        last_lat: currentLat,
        last_lng: currentLng,
        last_distance_m: distanceM,
        last_eta_seconds: 0,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', share.id);
    return;
  }

  // Skip the Directions API when the user has barely moved — cuts quota
  // for stop-and-go traffic. The recipient still sees the new pin via
  // the lat/lng update below.
  let etaSeconds: number | null = share.lastEtaSeconds;
  if (distanceM >= ETA_DIRECTIONS_MIN_DISTANCE_M) {
    const travel = await getTravelTime(
      { lat: currentLat, lng: currentLng },
      { lat: share.destinationLat, lng: share.destinationLng },
    );
    if (travel) etaSeconds = Math.round(travel.minutes * 60);
  } else {
    // Within 500m — use a walking-speed proxy (5 km/h ≈ 1.4 m/s).
    etaSeconds = Math.max(30, Math.round(distanceM / 1.4));
  }

  await supabase
    .from('eta_shares')
    .update({
      last_lat: currentLat,
      last_lng: currentLng,
      last_eta_seconds: etaSeconds,
      last_distance_m: distanceM,
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', share.id);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Human-friendly "12 min" / "1 hr 3 min" — null safe. */
export function formatEta(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds <= 60) return 'Arriving';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`;
}

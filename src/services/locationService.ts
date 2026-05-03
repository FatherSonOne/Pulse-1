import { supabase } from './supabase';
import { Contact } from '../types';
import {
  Place,
  PlaceWithRole,
  rowToPlace,
  PlaceRole,
} from '../types/placeTypes';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// Module-level geocoding cache — prevents duplicate API calls for same address
const geocodeCache = new Map<string, { lat: number; lng: number }>();

// ============================================================
// Geocoding
// ============================================================

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  if (geocodeCache.has(trimmed)) {
    return geocodeCache.get(trimmed)!;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results?.[0]) {
      const loc = data.results[0].geometry.location;
      const coords = { lat: loc.lat, lng: loc.lng };
      geocodeCache.set(trimmed, coords);
      return coords;
    }
    return null;
  } catch (err) {
    console.error('[locationService] geocodeAddress error:', err);
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results?.[0]) {
      return data.results[0].formatted_address as string;
    }
    return null;
  } catch (err) {
    console.error('[locationService] reverseGeocode error:', err);
    return null;
  }
}

// Bulk geocode contacts that have address text but no lat/lng.
// Returns a map of contactId → {lat, lng}.
// Respects a 50ms delay between calls to avoid hitting rate limits.
export async function geocodeContactsBatch(
  contacts: Contact[]
): Promise<Map<string, { lat: number; lng: number }>> {
  const results = new Map<string, { lat: number; lng: number }>();
  for (const contact of contacts) {
    const address = contact.address || contact.homeAddress;
    if (!address) continue;
    const coords = await geocodeAddress(address);
    if (coords) results.set(contact.id, coords);
    await new Promise(r => setTimeout(r, 50));
  }
  return results;
}

// ============================================================
// Persistence
// ============================================================

export async function saveContactLocation(
  contactId: string,
  locationType: 'home' | 'work',
  lat: number,
  lng: number,
  address: string
): Promise<void> {
  const column = locationType === 'home'
    ? { lat: 'home_lat', lng: 'home_lng', addr: 'home_address' }
    : { lat: 'work_lat', lng: 'work_lng', addr: 'work_address' };

  // Dual-write during the Place-schema rollout: the new places table
  // becomes source of truth, but the legacy contacts.{home,work}_lat
  // columns stay in sync so any consumer that hasn't migrated yet
  // continues to work. A future cleanup migration drops the columns.
  const { error } = await supabase
    .from('contacts')
    .update({
      [column.lat]: lat,
      [column.lng]: lng,
      [column.addr]: address,
      geo_accuracy: 'precise',
      location_updated_at: new Date().toISOString(),
    })
    .eq('id', contactId);

  if (error) {
    console.error('[locationService] saveContactLocation error:', error);
    throw error;
  }

  // Mirror to the universal Place schema. Failures here are logged but
  // not thrown — the legacy columns remain authoritative until cutover.
  try {
    await upsertContactPlace(contactId, locationType, lat, lng, address);
  } catch (placeErr) {
    console.error('[locationService] upsertContactPlace mirror failed:', placeErr);
  }
}

export async function clearContactLocation(
  contactId: string,
  locationType: 'home' | 'work'
): Promise<void> {
  const update = locationType === 'home'
    ? { home_lat: null, home_lng: null, home_address: null }
    : { work_lat: null, work_lng: null, work_address: null };

  const { error } = await supabase
    .from('contacts')
    .update({ ...update, location_updated_at: new Date().toISOString() })
    .eq('id', contactId);

  if (error) throw error;

  // Detach the entity_place link; the place row itself is left for now
  // (a place may be referenced by other entities in the future).
  try {
    await supabase
      .from('entity_places')
      .delete()
      .eq('entity_type', 'contact')
      .eq('entity_id', contactId)
      .eq('role', locationType);
  } catch (placeErr) {
    console.error('[locationService] clear entity_place link failed:', placeErr);
  }
}

// ============================================================
// Universal Place schema — read/write
//
// These are the forward-looking helpers. New consumers should use
// these; legacy consumers will keep working via the dual-write in
// saveContactLocation / clearContactLocation above.
// ============================================================

/**
 * Fetch all places attached to an entity, with the role they play.
 * Returns empty array if none — callers can fall back to legacy
 * columns when needed.
 */
export async function getPlacesForEntity(
  entityType: 'contact' | 'task' | 'decision' | 'event' | 'meeting',
  entityId: string
): Promise<PlaceWithRole[]> {
  const { data, error } = await supabase
    .from('entity_places')
    .select('role, places(*)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) {
    console.error('[locationService] getPlacesForEntity error:', error);
    return [];
  }
  if (!data) return [];

  return data
    .filter(row => row.places)
    .map(row => ({
      ...rowToPlace(row.places as unknown as Record<string, unknown>),
      role: row.role as PlaceRole,
    }));
}

/** Fetch a single place by id. */
export async function getPlace(placeId: string): Promise<Place | null> {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('id', placeId)
    .single();
  if (error || !data) return null;
  return rowToPlace(data as Record<string, unknown>);
}

/**
 * Upsert a contact's home or work place + the entity_places link.
 * Used by the dual-write path in saveContactLocation. Internal but
 * exported for tests.
 */
export async function upsertContactPlace(
  contactId: string,
  role: 'home' | 'work',
  lat: number,
  lng: number,
  address: string
): Promise<Place> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Try to find an existing place attached to this contact in this role.
  const { data: existingLinks } = await supabase
    .from('entity_places')
    .select('place_id')
    .eq('entity_type', 'contact')
    .eq('entity_id', contactId)
    .eq('role', role)
    .limit(1);

  const existingPlaceId = existingLinks?.[0]?.place_id as string | undefined;

  if (existingPlaceId) {
    const { data, error } = await supabase
      .from('places')
      .update({
        lat,
        lng,
        address,
        name: role === 'home' ? 'Home' : 'Work',
        type: role,
      })
      .eq('id', existingPlaceId)
      .select('*')
      .single();
    if (error) throw error;
    return rowToPlace(data as Record<string, unknown>);
  }

  // Insert new place + link in a single round-trip-pair.
  const { data: placeRow, error: placeErr } = await supabase
    .from('places')
    .insert({
      owner_user_id: user.id,
      lat,
      lng,
      address,
      name: role === 'home' ? 'Home' : 'Work',
      type: role,
      created_by: user.id,
    })
    .select('*')
    .single();
  if (placeErr) throw placeErr;

  const { error: linkErr } = await supabase
    .from('entity_places')
    .insert({
      entity_type: 'contact',
      entity_id: contactId,
      place_id: placeRow.id,
      role,
    });
  if (linkErr) throw linkErr;

  return rowToPlace(placeRow as Record<string, unknown>);
}

// ============================================================
// User position
// ============================================================

export function getCurrentUserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// ============================================================
// Distance
// ============================================================

// Haversine formula — returns distance in miles
export function distanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
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

export function formatDistance(miles: number): string {
  if (miles < 0.1) return 'Nearby';
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles.toFixed(1)} mi`;
}

// ============================================================
// Real-Time Location Sharing (Phase 3)
// ============================================================

export interface UserLocation {
  userId: string;
  lat: number;
  lng: number;
  accuracyM?: number;
  heading?: number;
  speedKmh?: number;
  locationLabel?: string;
  isSharing: boolean;
  updatedAt: Date;
}

export interface LocationShareConsent {
  id: string;
  subjectUserId: string;
  viewerUserId: string;
  isGranted: boolean;
  shareLevel: 'precise' | 'approximate' | 'city_only';
  expiresAt?: Date;
}

let watchId: number | null = null;
let broadcastDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Start broadcasting current user's position to user_locations table.
// Returns a stop function.
export function startLocationBroadcast(
  userId: string,
  onError?: (err: GeolocationPositionError) => void
): () => void {
  if (!navigator.geolocation) return () => {};

  const writePosition = (pos: GeolocationPosition) => {
    if (broadcastDebounceTimer) clearTimeout(broadcastDebounceTimer);
    broadcastDebounceTimer = setTimeout(async () => {
      await supabase.from('user_locations').upsert({
        user_id: userId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
        heading: pos.coords.heading ?? null,
        speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
        is_sharing: true,
        updated_at: new Date().toISOString(),
      });
    }, 15000); // max 1 write per 15 seconds
  };

  watchId = navigator.geolocation.watchPosition(writePosition, onError, {
    enableHighAccuracy: false,
    maximumAge: 30000,
    timeout: 10000,
  });

  return () => stopLocationBroadcast();
}

export function stopLocationBroadcast(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (broadcastDebounceTimer) {
    clearTimeout(broadcastDebounceTimer);
    broadcastDebounceTimer = null;
  }
}

// Subscribe to another Pulse user's live location.
// Returns an unsubscribe function.
export function subscribeToUserLocation(
  targetUserId: string,
  onUpdate: (loc: UserLocation) => void
): () => void {
  const channel = supabase
    .channel(`location:${targetUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_locations',
        filter: `user_id=eq.${targetUserId}`,
      },
      payload => {
        const row = payload.new as Record<string, unknown>;
        onUpdate({
          userId: row.user_id as string,
          lat: row.lat as number,
          lng: row.lng as number,
          accuracyM: row.accuracy_m as number | undefined,
          heading: row.heading as number | undefined,
          speedKmh: row.speed_kmh as number | undefined,
          locationLabel: row.location_label as string | undefined,
          isSharing: row.is_sharing as boolean,
          updatedAt: new Date(row.updated_at as string),
        });
      }
    )
    .subscribe();

  return () => { channel.unsubscribe(); };
}

export async function setLocationSharing(
  userId: string,
  isSharing: boolean
): Promise<void> {
  const { error } = await supabase
    .from('user_locations')
    .upsert({ user_id: userId, is_sharing: isSharing, lat: 0, lng: 0 });
  if (error) throw error;
}

export async function checkLocationConsent(
  subjectUserId: string,
  viewerUserId: string
): Promise<LocationShareConsent | null> {
  const { data, error } = await supabase
    .from('location_share_consents')
    .select('*')
    .eq('subject_user_id', subjectUserId)
    .eq('viewer_user_id', viewerUserId)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    subjectUserId: data.subject_user_id,
    viewerUserId: data.viewer_user_id,
    isGranted: data.is_granted,
    shareLevel: data.share_level,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
  };
}

export async function upsertLocationConsent(
  subjectUserId: string,
  viewerUserId: string,
  isGranted: boolean,
  shareLevel: 'precise' | 'approximate' | 'city_only' = 'precise',
  expiresAt?: Date
): Promise<void> {
  const { error } = await supabase.from('location_share_consents').upsert({
    subject_user_id: subjectUserId,
    viewer_user_id: viewerUserId,
    is_granted: isGranted,
    share_level: shareLevel,
    expires_at: expiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

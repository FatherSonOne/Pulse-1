import { supabase } from './supabase';
import { Contact } from '../types';
import {
  Place,
  PlaceWithRole,
  rowToPlace,
  PlaceRole,
  PlaceType,
} from '../types/placeTypes';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// ============================================================
// Geocoding — hardening (issue #35 / Stream A3)
// ============================================================

const GEOCODE_CACHE_KEY = 'pulse:geocode:v1';
const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GEOCODE_TIMEOUT_MS = 8000;
const GEOCODE_MAX_RETRIES = 3;
const GEOCODE_QPS = 10;
const GEOCODE_REFILL_MS = 1000 / GEOCODE_QPS;
const GEOCODE_DAILY_WARN_THRESHOLD = 1000;
const BATCH_CONSECUTIVE_FAILURE_LIMIT = 3;

type CacheEntry = { lat: number; lng: number; ts: number };

function loadCacheFromStorage(): Map<string, { lat: number; lng: number }> {
  if (typeof localStorage === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as { entries?: Record<string, CacheEntry> };
    const cutoff = Date.now() - GEOCODE_CACHE_TTL_MS;
    const fresh = new Map<string, { lat: number; lng: number }>();
    for (const [k, v] of Object.entries(parsed.entries ?? {})) {
      if (v && typeof v.ts === 'number' && v.ts >= cutoff) {
        fresh.set(k, { lat: v.lat, lng: v.lng });
      }
    }
    return fresh;
  } catch {
    return new Map();
  }
}

function persistCacheEntry(key: string, value: { lat: number; lng: number }): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as { entries?: Record<string, CacheEntry> })
      : { entries: {} };
    if (!parsed.entries) parsed.entries = {};
    parsed.entries[key] = { ...value, ts: Date.now() };
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Storage full / unavailable — silent. In-memory cache still serves the session.
  }
}

const geocodeCache = loadCacheFromStorage();

// Sequential token bucket: each call reserves a slot REFILL_MS after the
// previous reservation, capping aggregate throughput at GEOCODE_QPS.
let nextGeocodeAvailableAt = 0;
async function acquireGeocodeToken(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextGeocodeAvailableAt - now);
  nextGeocodeAvailableAt = Math.max(now, nextGeocodeAvailableAt) + GEOCODE_REFILL_MS;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

let geocodeDailyDate = '';
let geocodeDailyCount = 0;
function incrementGeocodeDailyCounter(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== geocodeDailyDate) {
    geocodeDailyDate = today;
    geocodeDailyCount = 0;
  }
  geocodeDailyCount++;
  if (geocodeDailyCount === GEOCODE_DAILY_WARN_THRESHOLD) {
    console.warn(
      `[locationService] Geocode call count crossed ${GEOCODE_DAILY_WARN_THRESHOLD} on ${geocodeDailyDate} — approaching Google's free-tier daily limit.`
    );
  }
}

type GeocodeResponse = {
  status: string;
  results?: Array<{
    geometry: { location: { lat: number; lng: number } };
    formatted_address?: string;
  }>;
  error_message?: string;
};

// Routes through the `maps-geocode` Supabase edge function. The server
// holds GOOGLE_MAPS_SERVER_KEY (unrestricted-by-referer) so we don't
// hit the "API keys with referer restrictions cannot be used with this
// API" rejection Google returns for direct browser calls.
//
// Signature preserved (params: string of either "address=X" or
// "latlng=Y,Z") so all existing callers keep working. We parse the
// params back into the structured body the edge function expects.
async function fetchGoogleGeocode(params: string): Promise<GeocodeResponse> {
  // Parse the legacy params string into the proxy's structured body.
  let proxyBody: { kind: 'forward'; address: string } | { kind: 'reverse'; lat: number; lng: number };
  const addrMatch = params.match(/^address=(.+)$/);
  const latlngMatch = params.match(/^latlng=(-?[\d.]+),(-?[\d.]+)$/);
  if (addrMatch) {
    proxyBody = { kind: 'forward', address: decodeURIComponent(addrMatch[1]) };
  } else if (latlngMatch) {
    proxyBody = { kind: 'reverse', lat: Number(latlngMatch[1]), lng: Number(latlngMatch[2]) };
  } else {
    throw new Error(`fetchGoogleGeocode: unrecognized params shape "${params}"`);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= GEOCODE_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const base = Math.min(2000, 250 * Math.pow(2, attempt - 1));
      const jitter = base * (Math.random() * 0.5 - 0.25);
      await new Promise(r => setTimeout(r, base + jitter));
    }
    await acquireGeocodeToken();
    incrementGeocodeDailyCounter();

    try {
      const { data, error } = await supabase.functions.invoke('maps-geocode', {
        body: proxyBody,
      });
      if (error) {
        lastErr = error;
        continue;
      }
      const payload = data as {
        result?: { lat: number | null; lng: number | null; formatted_address: string | null } | null;
        status?: string;
        error?: string;
        detail?: string;
      };
      // Edge function returns `error: 'upstream_error'` with detail for
      // REQUEST_DENIED; translate back to the legacy shape so the
      // resolveAddress 'denied' branch still triggers and logs cleanly.
      if (payload.error === 'upstream_error') {
        return {
          status: 'REQUEST_DENIED',
          error_message: payload.detail ?? 'upstream error',
        };
      }
      if (payload.error) {
        lastErr = new Error(`maps-geocode ${payload.error}`);
        continue;
      }
      if (!payload.result) {
        return { status: payload.status ?? 'ZERO_RESULTS' };
      }
      const r = payload.result;
      if (r.lat == null || r.lng == null) {
        return { status: 'ZERO_RESULTS' };
      }
      return {
        status: 'OK',
        results: [{
          geometry: { location: { lat: r.lat, lng: r.lng } },
          formatted_address: r.formatted_address ?? undefined,
        }],
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('geocode failed after retries');
}

// Resolved variants the batch loop needs to distinguish:
//   ok        → success (or cache hit), reset failure streak
//   no-match  → ZERO_RESULTS, soft miss, do NOT count toward streak
//   denied    → REQUEST_DENIED, almost always a misconfigured key — abort early
//   error     → any other transient/persistent failure
type GeocodeResult =
  | { kind: 'ok'; coords: { lat: number; lng: number } }
  | { kind: 'no-match' }
  | { kind: 'denied'; message?: string }
  | { kind: 'error'; error: unknown };

async function resolveAddress(trimmed: string): Promise<GeocodeResult> {
  if (geocodeCache.has(trimmed)) {
    return { kind: 'ok', coords: geocodeCache.get(trimmed)! };
  }
  try {
    const data = await fetchGoogleGeocode(`address=${encodeURIComponent(trimmed)}`);
    if (data.status === 'OK' && data.results?.[0]) {
      const loc = data.results[0].geometry.location;
      const coords = { lat: loc.lat, lng: loc.lng };
      geocodeCache.set(trimmed, coords);
      persistCacheEntry(trimmed, coords);
      return { kind: 'ok', coords };
    }
    if (data.status === 'ZERO_RESULTS') return { kind: 'no-match' };
    if (data.status === 'REQUEST_DENIED') {
      return { kind: 'denied', message: data.error_message };
    }
    return { kind: 'error', error: new Error(`geocode google ${data.status}`) };
  } catch (err) {
    return { kind: 'error', error: err };
  }
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const result = await resolveAddress(trimmed);
  if (result.kind === 'ok') return result.coords;
  if (result.kind === 'denied') {
    console.error('[locationService] geocodeAddress denied:', result.message);
  } else if (result.kind === 'error') {
    console.error('[locationService] geocodeAddress error:', result.error);
  }
  return null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const data = await fetchGoogleGeocode(`latlng=${lat},${lng}`);
    if (data.status === 'OK' && data.results?.[0]) {
      return data.results[0].formatted_address ?? null;
    }
    return null;
  } catch (err) {
    console.error('[locationService] reverseGeocode error:', err);
    return null;
  }
}

export async function geocodeContactsBatch(
  contacts: Contact[]
): Promise<Map<string, { lat: number; lng: number }>> {
  const results = new Map<string, { lat: number; lng: number }>();
  let consecutiveFailures = 0;

  for (const contact of contacts) {
    const address = (contact.address || contact.homeAddress || '').trim();
    if (!address) continue;

    const result = await resolveAddress(address);

    if (result.kind === 'ok') {
      results.set(contact.id, result.coords);
      consecutiveFailures = 0;
    } else if (result.kind === 'no-match') {
      // Bad address text is not an API failure — don't count toward abort streak.
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      if (result.kind === 'denied') {
        console.error('[locationService] batch geocode denied:', result.message);
      } else {
        console.error('[locationService] batch geocode error:', result.error);
      }
      if (consecutiveFailures >= BATCH_CONSECUTIVE_FAILURE_LIMIT) {
        console.warn(
          `[locationService] batch aborted after ${BATCH_CONSECUTIVE_FAILURE_LIMIT} consecutive failures — preserving daily quota.`
        );
        break;
      }
    }
  }
  return results;
}

// ============================================================
// Persistence
// ============================================================

// Strict UUID v4-ish detector — matches the format Supabase emits for
// `uuid_generate_v4()`. Used to tell a real DB-rooted contact from a
// virtual one (Google contacts get ids like `google_c123…`, never UUIDs).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isContactUuid(id: string): boolean { return UUID_RE.test(id); }

/** Make sure the contact has a row in the public.contacts table and return
 *  its canonical UUID id. Google-sourced contacts (id prefix `google_…`)
 *  live only in client memory until they earn a write — this is where they
 *  get promoted, with `external_id` preserving the Google resource id and
 *  `source = 'google'` recording the origin.
 *
 *  Callers must propagate the returned id back into their local state when
 *  it differs from `contact.id`, otherwise subsequent writes will keep
 *  re-promoting the same contact.
 */
export async function ensureContactInDB(contact: Contact): Promise<string> {
  if (isContactUuid(contact.id)) return contact.id;

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    throw new Error('ensureContactInDB: not authenticated');
  }

  // Strip the `google_` (or other) prefix so external_id holds just the
  // upstream resource id. Falls back to the full original id when there's
  // no recognised prefix.
  const externalId = contact.id.replace(/^(google_|vision_)/, '');

  const insertPayload = {
    user_id: user.id,
    name: contact.name,
    role: contact.role || 'Contact',
    company: contact.company ?? null,
    avatar_color: contact.avatarColor || '#6366f1',
    // Status column has a check constraint; the in-memory Contact already
    // narrows to these values, but be defensive in case a Google sync
    // produced something unexpected.
    status: (['online', 'offline', 'busy', 'away'] as const).includes(contact.status as any)
      ? contact.status
      : 'offline',
    email: contact.email || '',
    phone: contact.phone ?? null,
    address: contact.address ?? null,
    notes: contact.notes ?? null,
    source: (contact.source === 'google' || contact.source === 'vision') ? contact.source : 'local',
    external_id: externalId,
    platform: 'web',
  };

  const { data, error } = await supabase
    .from('contacts')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error || !data) {
    console.error('[locationService] ensureContactInDB insert failed:', error);
    throw error ?? new Error('ensureContactInDB: no row returned');
  }

  return data.id as string;
}

export async function saveContactLocation(
  contact: Contact,
  locationType: 'home' | 'work',
  lat: number,
  lng: number,
  address: string,
  // Optional geofence radius in meters. When set, geofence enter/exit/
  // approach events fire as the user crosses the radius. Null disables
  // the geofence on this place.
  geofenceRadiusM: number | null = null
): Promise<string> {
  // Step 1: resolve to a real DB row. Promotes Google/Vision contacts
  // on demand so PATCH-by-id can run against a valid UUID.
  const canonicalId = await ensureContactInDB(contact);

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
    .eq('id', canonicalId);

  if (error) {
    console.error('[locationService] saveContactLocation error:', error);
    throw error;
  }

  // Mirror to the universal Place schema. Failures here are logged but
  // not thrown — the legacy columns remain authoritative until cutover.
  try {
    await upsertContactPlace(canonicalId, locationType, lat, lng, address, geofenceRadiusM);
  } catch (placeErr) {
    console.error('[locationService] upsertContactPlace mirror failed:', placeErr);
  }

  return canonicalId;
}

export async function clearContactLocation(
  contactId: string,
  locationType: 'home' | 'work'
): Promise<void> {
  // Mirror saveContactLocation's UUID handling: a virtual contact (Google /
  // Vision, id prefix like `google_…`) has nothing in the DB to clear yet,
  // so a clear-by-id would hit zero rows and silently no-op. Skip the round
  // trip and let the caller refresh its local state. This is the symmetric
  // guard the empty-state flow needs once it lets users open the edit modal
  // for an un-promoted contact and click Clear.
  if (!isContactUuid(contactId)) {
    console.warn(
      '[locationService] clearContactLocation called with non-UUID id; nothing to clear in DB:',
      contactId,
    );
    return;
  }

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
 * List every place the current user can see — RLS enforces both
 * personal-by-owner and workspace-by-membership boundaries, so no
 * extra filtering is needed in TS. Sorted by created_at descending
 * so the picker shows recent places first.
 */
export async function listUserPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[locationService] listUserPlaces error:', error);
    return [];
  }
  return (data ?? []).map(row => rowToPlace(row as Record<string, unknown>));
}

/**
 * Create a new personal place for the current user. Workspace places
 * use a different flow (the picker can extend to that later).
 */
export async function createPlace(input: {
  lat: number;
  lng: number;
  address?: string | null;
  name?: string | null;
  type?: PlaceType;
}): Promise<Place> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('places')
    .insert({
      owner_user_id: user.id,
      lat: input.lat,
      lng: input.lng,
      address: input.address ?? null,
      name: input.name ?? null,
      type: input.type ?? 'custom',
      created_by: user.id,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('createPlace failed');
  return rowToPlace(data as Record<string, unknown>);
}

/**
 * Update the geofence radius on a place. Pass null to disable the
 * geofence entirely (no enter/exit events will fire). Used by the
 * entity-side surfaces (TaskEditModal location section, decision
 * geo-anchor) so any attached place can be promoted from "just a
 * marker" to "fires arrival events".
 */
export async function setPlaceGeofence(
  placeId: string,
  radiusM: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('places')
    .update({ geofence_radius_m: radiusM })
    .eq('id', placeId);
  if (error) throw error;
}

/**
 * Attach a place to an entity in a specific role. If a row with the
 * same (entity_type, entity_id, place_id, role) already exists, the
 * insert is a no-op (handled by the composite PK).
 */
export async function attachPlaceToEntity(
  entityType: 'contact' | 'task' | 'decision' | 'event' | 'meeting',
  entityId: string,
  placeId: string,
  role: PlaceRole,
): Promise<void> {
  const { error } = await supabase
    .from('entity_places')
    .upsert({
      entity_type: entityType,
      entity_id: entityId,
      place_id: placeId,
      role,
    }, { onConflict: 'entity_type,entity_id,place_id,role' });
  if (error) throw error;
}

/**
 * Remove every place link for an entity in a given role. Used when
 * the user clears or replaces the entity's location for that role.
 */
export async function detachPlaceFromEntity(
  entityType: 'contact' | 'task' | 'decision' | 'event' | 'meeting',
  entityId: string,
  role: PlaceRole,
): Promise<void> {
  const { error } = await supabase
    .from('entity_places')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('role', role);
  if (error) throw error;
}

/**
 * Build a `entityId → placeId` lookup for every entity of the given
 * type that has a place attached and is visible to the user. The list
 * view consumers (e.g. DecisionTaskHub) use this for one-shot place
 * filtering without N+1 fetches. If an entity has multiple roles, the
 * last row wins (callers that care about a specific role should
 * filter the result themselves or call getPlacesForEntity).
 */
export async function getEntityPlaceMap(
  entityType: 'contact' | 'task' | 'decision' | 'event' | 'meeting',
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('entity_places')
    .select('entity_id, place_id')
    .eq('entity_type', entityType);
  if (error) {
    console.error('[locationService] getEntityPlaceMap error:', error);
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as { entity_id: string; place_id: string };
    out[r.entity_id] = r.place_id;
  }
  return out;
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
  address: string,
  geofenceRadiusM: number | null = null
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
        geofence_radius_m: geofenceRadiusM,
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
      geofence_radius_m: geofenceRadiusM,
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
//
// Side effect: also runs geofence detection on every raw position update
// (independent of the 15-second DB-write debounce) so enter/exit/approach
// events fire as soon as we have a fresh fix. geofenceService is loaded
// lazily to keep this file's import surface unchanged.
export function startLocationBroadcast(
  userId: string,
  onError?: (err: GeolocationPositionError) => void
): () => void {
  if (!navigator.geolocation) return () => {};

  // Lazy import so existing call sites that don't care about geofences
  // don't pay the cost on first paint. We also init the notification
  // fan-out (toast + native + feed item) once the modules resolve and
  // bring in the ETA share ticker for any active live shares.
  let geofenceModule: typeof import('./geofenceService') | null = null;
  let etaShareModule: typeof import('./etaShareService') | null = null;
  Promise.all([
    import('./geofenceService'),
    import('./geofenceNotificationService'),
    import('./etaShareService'),
  ]).then(([gfMod, notifMod, etaMod]) => {
    geofenceModule = gfMod;
    etaShareModule = etaMod;
    gfMod.startGeofenceDetection(userId);
    notifMod.initGeofenceNotifications();
  }).catch(err => {
    console.warn('[locationService] geofence pipeline failed to load:', err);
  });

  const writePosition = (pos: GeolocationPosition) => {
    // Run geofence detection immediately on every raw tick — not on the
    // debounced DB write — so enter/exit/approach events are detected
    // as soon as the OS gives us a fix.
    if (geofenceModule) {
      geofenceModule
        .processPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
        .catch(err => console.warn('[locationService] geofence processPosition failed:', err));
    }

    // Refresh any active ETA shares — has its own internal 12s throttle,
    // so calling on every raw tick is cheap when no shares are active.
    if (etaShareModule) {
      etaShareModule
        .tickActiveShares(pos.coords.latitude, pos.coords.longitude)
        .catch(err => console.warn('[locationService] etaShare tick failed:', err));
    }

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
  // Tear down geofence session too. Lazy-loaded to avoid a hard import.
  import('./geofenceService')
    .then(mod => mod.stopGeofenceDetection())
    .catch(() => { /* module never loaded — nothing to stop */ });
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

// ============================================================
// Phase 7 — Multi-recipient broadcast
//
// The spec called for a new `live_location_recipients` table; in practice
// Pulse already has the same shape under `location_share_consents` (Phase 3
// bilateral consent). These helpers wrap the bulk grant/revoke flow the
// BROADCAST chip drives so the consent table doesn't sprout ad-hoc upserts
// across the codebase.
//
// Session set: the recipients picked for the current broadcast live in
// module state so the stop handler knows which consents to revoke (without
// touching long-standing manual grants the user set elsewhere).
// ============================================================

let currentBroadcastRecipients = new Set<string>();

/** Active recipients viewer ids visible to the current process. Empty when
 *  no broadcast is running or the user is broadcasting to nobody. */
export function getActiveBroadcastRecipientIds(): string[] {
  return Array.from(currentBroadcastRecipients);
}

/** Replace the current broadcast recipient set. Grants new ids (upserts
 *  with is_granted=true), revokes ids dropped from the set (is_granted=false),
 *  preserves any consent rows the user added manually outside this session. */
export async function setBroadcastRecipients(
  broadcasterUserId: string,
  recipientUserIds: string[],
  shareLevel: 'precise' | 'approximate' | 'city_only' = 'precise',
): Promise<void> {
  const nextSet = new Set(recipientUserIds);
  const prevSet = currentBroadcastRecipients;

  const toGrant = recipientUserIds.filter(id => !prevSet.has(id));
  const toRevoke = Array.from(prevSet).filter(id => !nextSet.has(id));

  const updatedAt = new Date().toISOString();

  if (toGrant.length > 0) {
    const { error } = await supabase.from('location_share_consents').upsert(
      toGrant.map(viewerId => ({
        subject_user_id: broadcasterUserId,
        viewer_user_id: viewerId,
        is_granted: true,
        share_level: shareLevel,
        expires_at: null,
        updated_at: updatedAt,
      })),
    );
    if (error) throw error;
  }

  if (toRevoke.length > 0) {
    // Mark previously-this-session grants as revoked. Bulk update keyed by
    // (subject_user_id, viewer_user_id). Supabase's update doesn't take a
    // composite-key array natively, so iterate — usually a handful of rows.
    for (const viewerId of toRevoke) {
      const { error } = await supabase
        .from('location_share_consents')
        .update({ is_granted: false, updated_at: updatedAt })
        .eq('subject_user_id', broadcasterUserId)
        .eq('viewer_user_id', viewerId);
      if (error) throw error;
    }
  }

  currentBroadcastRecipients = nextSet;
}

/** Revoke all session-granted consents and clear the in-memory set. Called
 *  when the user toggles BROADCAST off. Pre-existing consents granted from
 *  the LocationSharePanel (per-contact) are intentionally untouched —
 *  they were never part of this session's set. */
export async function endBroadcastRecipients(broadcasterUserId: string): Promise<void> {
  const recipients = Array.from(currentBroadcastRecipients);
  currentBroadcastRecipients = new Set();
  if (recipients.length === 0) return;
  const updatedAt = new Date().toISOString();
  for (const viewerId of recipients) {
    await supabase
      .from('location_share_consents')
      .update({ is_granted: false, updated_at: updatedAt })
      .eq('subject_user_id', broadcasterUserId)
      .eq('viewer_user_id', viewerId)
      .then(() => {}, () => {}); // swallow per-recipient errors — best effort
  }
}

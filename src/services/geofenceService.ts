// ============================================================
// Geofence Service
//
// Client-side enter/exit/approach detection driven by the location
// broadcast tick. On each new user position we compute distance to
// every geofenced place the user owns/shares and, when the state
// transitions, write a row to `geofence_events` and dispatch to
// the surfacing layer (today_feed + native notification + toast).
//
// State machine (per place):
//   outside     -> inside        => "enter"  event
//   outside     -> approaching   => "approach" event (within 2x radius)
//   approaching -> inside        => "enter"  event
//   approaching -> outside       => silent (drift; not noteworthy)
//   inside      -> approaching   => silent
//   inside      -> outside       => "exit" event
//
// Throttling: same event_type for the same place is suppressed for
// MIN_EVENT_INTERVAL_MS to avoid GPS-jitter spam.
//
// Server-side detection (Postgres trigger on user_locations UPDATE)
// is a future iteration when we need background reliability while
// the app is closed.
// ============================================================

import { supabase } from './supabase';

const PLACES_REFRESH_MS = 5 * 60 * 1000;     // re-fetch geofenced places every 5 min
const MIN_EVENT_INTERVAL_MS = 5 * 60 * 1000; // 5 min throttle on same event type / place
const APPROACH_OUTER_MULTIPLIER = 2;         // approach band = radius..2*radius

interface GeofencedPlace {
  id: string;
  name: string | null;
  address: string | null;
  lat: number;
  lng: number;
  radiusM: number;
  // Optional entity context — the first attached entity, used to give
  // the surfaced feed item a human-friendly subject ("Acme HQ — work
  // location for John Doe").
  entity?: {
    type: 'contact' | 'task' | 'decision' | 'event' | 'meeting';
    id: string;
    role: string;
  };
}

type PlaceState = 'outside' | 'approaching' | 'inside';

interface GeofenceTransition {
  place: GeofencedPlace;
  eventType: 'enter' | 'exit' | 'approach';
  distanceM: number;
  lat: number;
  lng: number;
  accuracyM?: number;
}

// Module-level singleton state. Lives for the browser tab's session.
let activeUserId: string | null = null;
let cachedPlaces: GeofencedPlace[] = [];
let placesLoadedAt = 0;
const stateMap = new Map<string, PlaceState>();
const lastEventAt = new Map<string, number>(); // key = `${placeId}:${eventType}`

// Listeners react to a fired event (notification dispatcher subscribes here).
type TransitionListener = (t: GeofenceTransition) => void;
const listeners = new Set<TransitionListener>();

export function onGeofenceTransition(listener: TransitionListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function startGeofenceDetection(userId: string): void {
  activeUserId = userId;
  // Force a fresh load on next position so a new geofence created
  // since last session is picked up immediately.
  placesLoadedAt = 0;
  stateMap.clear();
  lastEventAt.clear();
}

export function stopGeofenceDetection(): void {
  activeUserId = null;
  cachedPlaces = [];
  stateMap.clear();
  lastEventAt.clear();
}

/** Call from a fresh geolocation tick. Cheap when no geofenced places exist. */
export async function processPosition(
  lat: number,
  lng: number,
  accuracyM?: number
): Promise<void> {
  if (!activeUserId) return;

  await ensurePlacesLoaded(activeUserId);
  if (cachedPlaces.length === 0) return;

  const transitions: GeofenceTransition[] = [];

  for (const place of cachedPlaces) {
    const distanceM = haversineMeters(lat, lng, place.lat, place.lng);
    const newState = classifyState(distanceM, place.radiusM);
    const oldState = stateMap.get(place.id) ?? 'outside';

    if (newState === oldState) continue;
    stateMap.set(place.id, newState);

    const eventType = transitionToEvent(oldState, newState);
    if (!eventType) continue;

    if (isThrottled(place.id, eventType)) continue;
    lastEventAt.set(`${place.id}:${eventType}`, Date.now());

    transitions.push({ place, eventType, distanceM, lat, lng, accuracyM });
  }

  if (transitions.length === 0) return;

  // Persist + dispatch in parallel; failures in one shouldn't block others.
  await Promise.allSettled(transitions.map(t => persistAndDispatch(t)));
}

/** Force-refresh the geofenced-places cache; call after the user saves a new geofence. */
export async function refreshGeofences(): Promise<void> {
  if (!activeUserId) return;
  placesLoadedAt = 0;
  await ensurePlacesLoaded(activeUserId);
}

// ============================================================
// Internals
// ============================================================

async function ensurePlacesLoaded(userId: string): Promise<void> {
  const now = Date.now();
  if (cachedPlaces.length > 0 && now - placesLoadedAt < PLACES_REFRESH_MS) return;

  const { data, error } = await supabase
    .from('places')
    .select(`
      id,
      name,
      address,
      lat,
      lng,
      geofence_radius_m,
      entity_places (
        entity_type,
        entity_id,
        role
      )
    `)
    .not('geofence_radius_m', 'is', null)
    .or(`owner_user_id.eq.${userId},workspace_id.not.is.null`);

  if (error) {
    console.warn('[geofenceService] failed to load geofenced places:', error.message);
    return;
  }

  cachedPlaces = (data ?? []).map(row => {
    const eps = Array.isArray(row.entity_places) ? row.entity_places : [];
    const first = eps[0] as { entity_type?: string; entity_id?: string; role?: string } | undefined;
    return {
      id: String(row.id),
      name: (row.name ?? null) as string | null,
      address: (row.address ?? null) as string | null,
      lat: Number(row.lat),
      lng: Number(row.lng),
      radiusM: Number(row.geofence_radius_m),
      entity: first?.entity_type
        ? {
            type: first.entity_type as GeofencedPlace['entity']['type'],
            id: String(first.entity_id),
            role: String(first.role),
          }
        : undefined,
    };
  });
  placesLoadedAt = now;
}

function classifyState(distanceM: number, radiusM: number): PlaceState {
  if (distanceM <= radiusM) return 'inside';
  if (distanceM <= radiusM * APPROACH_OUTER_MULTIPLIER) return 'approaching';
  return 'outside';
}

function transitionToEvent(
  oldState: PlaceState,
  newState: PlaceState
): GeofenceTransition['eventType'] | null {
  if (oldState !== 'inside' && newState === 'inside') return 'enter';
  if (oldState === 'inside' && newState !== 'inside') return 'exit';
  if (oldState === 'outside' && newState === 'approaching') return 'approach';
  return null;
}

function isThrottled(placeId: string, eventType: string): boolean {
  const key = `${placeId}:${eventType}`;
  const last = lastEventAt.get(key);
  if (!last) return false;
  return Date.now() - last < MIN_EVENT_INTERVAL_MS;
}

async function persistAndDispatch(t: GeofenceTransition): Promise<void> {
  if (!activeUserId) return;

  const { error } = await supabase.from('geofence_events').insert({
    user_id: activeUserId,
    place_id: t.place.id,
    event_type: t.eventType,
    lat: t.lat,
    lng: t.lng,
    accuracy_m: t.accuracyM ?? null,
    distance_m: t.distanceM,
    entity_type: t.place.entity?.type ?? null,
    entity_id: t.place.entity?.id ?? null,
  });

  if (error) {
    console.warn('[geofenceService] failed to insert event:', error.message);
    return;
  }

  for (const l of listeners) {
    try { l(t); } catch (err) {
      console.error('[geofenceService] listener threw:', err);
    }
  }
}

// Haversine in meters (locationService.distanceMiles returns miles;
// kept inline to avoid a circular import).
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

export type { GeofenceTransition, GeofencedPlace };

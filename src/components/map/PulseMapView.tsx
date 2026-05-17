import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, GoogleMap, Polygon, Polyline, useJsApiLoader } from '@react-google-maps/api';
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Globe,
  Home,
  MapPin,
  MapPinned,
  Navigation,
  Radio,
  Sparkles,
  Sun,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { AppView, CalendarEvent, Contact, Thread } from '../../types';
import { ContactCircle } from '../../types/contactCircleTypes';
import { GOOGLE_MAPS_LIBRARIES, convexHull, getMapOptions, computeBounds } from '../../services/mapService';
import {
  geocodeAddress,
  getCurrentUserLocation,
  geocodeContactsBatch,
  saveContactLocation,
  subscribeToUserLocation,
  UserLocation,
} from '../../services/locationService';
import { dataService } from '../../services/dataService';
import { supabase } from '../../services/supabase';
import {
  AtlasProposal,
  getAiPausedUntil,
  proposeAtlasInsight,
  proposeRoute,
  proposeWeekPlan,
  RouteProposal,
  WeekProposal,
} from '../../services/mapAIService';
import MapFilterBar, { MapFilter } from './MapFilterBar';
import MapContactMarker from './contacts/MapContactMarker';
import MapRadiusRings from './contacts/MapRadiusRings';
import MapContactPanel from './contacts/MapContactPanel';
import MapCircleOverlay from './contacts/MapCircleOverlay';
import MapMeetingMarker from './contacts/MapMeetingMarker';
import LocationEditModal from './contacts/LocationEditModal';
import ImAtFAB from './sub/ImAtFAB';
import LiveTeamView from './sub/LiveTeamView';

interface PulseMapViewProps {
  contacts: Contact[];
  circles: ContactCircle[];
  isDarkMode: boolean;
  userId: string;
  onContactAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  // `previousId` is supplied when the save promoted a Google/Vision contact
  // into the DB and the canonical id changed. Parent stores must match by
  // previousId to find the row in any local cache that still holds it.
  onContactUpdated?: (updated: Contact, previousId?: string) => void;
  // ─── Phase 5 geo-relevance signals ─────────────────────────────────────────
  // Optional. When provided by the parent, these drive TODAY/WEEK lens
  // membership and AI route prompts. When omitted, PulseMapView falls back
  // to a self-fetch via dataService on mount, and ultimately to the legacy
  // lastSeen + isTeamMember + pulseUserId proxy if even that returns empty.
  // App.tsx doesn't lift this fetch today (Dashboard owns the equivalent
  // data) so the self-fetch is the default path; the props are here so a
  // future parent — or a test — can supply pre-computed signals.
  todayEvents?: CalendarEvent[];
  weekEvents?: CalendarEvent[];
  recentMessageContactIds?: Set<string>;
}

type MapLens = 'today' | 'week' | 'atlas';

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const DEFAULT_ZOOM = 11;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const LENS_OPTIONS: { id: MapLens; label: string; Icon: typeof Sun }[] = [
  { id: 'today', label: 'Today', Icon: Sun },
  { id: 'week',  label: 'Week',  Icon: CalendarRange },
  { id: 'atlas', label: 'Atlas', Icon: Globe },
];

// ─── AI strip + accepted-route shared types ─────────────────────────────────
// Hoisted out of the component so the AiStrip sub-component can reference
// them in its props without circular-scope contortions.
type AiProposal =
  | { kind: 'route';   proposal: RouteProposal }
  | { kind: 'plan';    proposal: WeekProposal }
  | { kind: 'insight'; proposal: AtlasProposal };
type AiState =
  | { status: 'idle' }
  | { status: 'fetching' }
  | { status: 'ready'; data: AiProposal }
  | { status: 'none' }
  | { status: 'paused'; until: number }
  // Reorder mode is entered from a 'ready' route proposal. orderedIds is a
  // working draft the user mutates via drag; baseProposal is the snapshot we
  // revert to on Cancel without losing the AI's original rationale.
  | { status: 'reordering'; orderedIds: string[]; baseProposal: RouteProposal };
interface AcceptedRoute {
  orderedMarkerKeys: string[];
  path: google.maps.LatLngLiteral[];
  durationMin: number;
  arrivesAt: Date;
}
type MarkerData = { contact: Contact; locType: 'home' | 'work'; lat: number; lng: number };
type MeetingMarkerData = { event: CalendarEvent; lat: number; lng: number };

// ─── Geo-relevance signals (Phase 5) ────────────────────────────────────────
// Wraps the inputs lensIncludesContact and the AI prompt builder need. Lifted
// to module scope so the helper is pure & testable without the component.
interface GeoSignals {
  todayEvents: CalendarEvent[];
  weekEvents: CalendarEvent[];
  recentMessageContactIds: Set<string>;
  /** True when at least one source returned non-empty data; tells the lens
   *  helper to switch from the legacy proxy to real signals. */
  hasRealSignals: boolean;
}

// Email-lookup helper: an event's attendees array is usually email addresses
// (Google/Outlook) or display names. Returns true if any attendee matches
// this contact by email (case-insensitive) or, failing that, by display name.
function contactAttendsEvent(c: Contact, e: CalendarEvent): boolean {
  if (!e.attendees || e.attendees.length === 0) return false;
  const contactEmail = c.email?.toLowerCase().trim();
  const contactName = c.name?.toLowerCase().trim();
  for (const att of e.attendees) {
    const lower = (att || '').toLowerCase().trim();
    if (!lower) continue;
    if (contactEmail && lower === contactEmail) return true;
    if (contactName && lower === contactName) return true;
    // Detailed attendees with embedded "Name <email>" formatting.
    if (contactEmail && lower.includes(contactEmail)) return true;
  }
  return false;
}

// Real-signal predicate. Atlas always shows everything pinned. TODAY/WEEK
// admit a contact when ANY of: they're in recentMessageContactIds, they
// attend an event in the lens window, OR (defensive) the legacy proxy still
// places them in the window. The fallback keeps a freshly-installed Pulse
// (no calendar yet, no message history yet) from looking empty.
function lensIncludesContact(
  c: Contact,
  lens: MapLens,
  now: number,
  signals: GeoSignals,
): boolean {
  if (lens === 'atlas') return true;

  if (signals.hasRealSignals) {
    if (signals.recentMessageContactIds.has(c.id)) return true;
    const eventList = lens === 'today' ? signals.todayEvents : signals.weekEvents;
    if (eventList.some(e => contactAttendsEvent(c, e))) return true;
    // Real signals exist but this contact isn't tied to them. Still honour
    // the team/pulse-user override so the operator's own circle is visible
    // even on quiet days.
    if (c.isTeamMember || c.pulseUserId) return true;
    return false;
  }

  // Legacy proxy — no real signals yet (Google Calendar not connected,
  // no thread history, etc.). Keeps the section usable for fresh installs.
  if (c.isTeamMember || c.pulseUserId) return true;
  const seen = c.lastSeen ? c.lastSeen.getTime() : 0;
  const window = lens === 'today' ? DAY_MS : WEEK_MS;
  return now - seen <= window;
}

const PulseMapView: React.FC<PulseMapViewProps> = ({
  contacts,
  circles,
  isDarkMode,
  userId,
  onContactAction,
  onContactUpdated,
  todayEvents: todayEventsProp,
  weekEvents: weekEventsProp,
  recentMessageContactIds: recentMessageContactIdsProp,
}) => {
  const [lens, setLens] = useState<MapLens>('today');
  const [showLiveSheet, setShowLiveSheet] = useState(false);

  // AI strip state machine (idle → fetching → ready/none). See the hoisted
  // types above the component for the proposal shape.
  const [aiState, setAiState] = useState<AiState>({ status: 'idle' });

  // Populated when the user clicks Accept on a TODAY route proposal. Drives
  // the polyline overlay, the marker renumbering, and the "Underway" strip.
  const [acceptedRoute, setAcceptedRoute] = useState<AcceptedRoute | null>(null);
  const [acceptingRoute, setAcceptingRoute] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'pulse-google-maps',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedLocType, setSelectedLocType] = useState<'home' | 'work'>('home');
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [liveLocations, setLiveLocations] = useState<Map<string, UserLocation>>(new Map());
  const [filter, setFilter] = useState<MapFilter>({
    circles: [],
    locationType: 'all',
    searchQuery: '',
  });
  const [showAddLocationPicker, setShowAddLocationPicker] = useState(false);
  const [pickerContactId, setPickerContactId] = useState<string | null>(null);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [geoBannerDismissed, setGeoBannerDismissed] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('pulse:map:geo-banner-dismissed') === '1';
  });

  const dismissGeoBanner = useCallback(() => {
    setGeoBannerDismissed(true);
    try { localStorage.setItem('pulse:map:geo-banner-dismissed', '1'); } catch {
      // localStorage unavailable — banner stays dismissed for the session via state.
    }
  }, []);

  useEffect(() => { setLocalContacts(contacts); }, [contacts]);

  // ─── Phase 5 — geo-relevance signals ──────────────────────────────────────
  // When the parent doesn't supply pre-computed signals, fetch a small slice
  // from dataService on mount. Cheap (DB reads with internal caching) and
  // self-contained — lets PulseMapView graduate from the lastSeen proxy
  // without forcing App.tsx to lift Dashboard's data layer up.
  const [fetchedEvents, setFetchedEvents] = useState<CalendarEvent[]>([]);
  const [fetchedThreads, setFetchedThreads] = useState<Thread[]>([]);
  const needsSelfFetch =
    todayEventsProp === undefined &&
    weekEventsProp === undefined &&
    recentMessageContactIdsProp === undefined;
  useEffect(() => {
    if (!needsSelfFetch) return;
    let cancelled = false;
    const now = new Date();
    const weekEnd = new Date(now.getTime() + WEEK_MS);
    Promise.all([
      dataService.getEvents(now, weekEnd).catch(() => [] as CalendarEvent[]),
      dataService.getThreads().catch(() => [] as Thread[]),
    ]).then(([events, threads]) => {
      if (cancelled) return;
      setFetchedEvents(events);
      setFetchedThreads(threads);
    });
    return () => { cancelled = true; };
  }, [needsSelfFetch]);

  // Compose the signal bundle from whichever source has data — props win when
  // the parent supplied them, otherwise the self-fetch results are used.
  const geoSignals = useMemo<GeoSignals>(() => {
    const now = Date.now();
    const dayCutoff = now - DAY_MS;
    const weekCutoff = now + WEEK_MS;

    const events = todayEventsProp !== undefined || weekEventsProp !== undefined
      ? [...(todayEventsProp ?? []), ...(weekEventsProp ?? [])]
      : fetchedEvents;

    const todayEvents = todayEventsProp ?? events.filter(e => {
      const t = e.start instanceof Date ? e.start.getTime() : new Date(e.start).getTime();
      return Number.isFinite(t) && t >= now - DAY_MS && t < now + DAY_MS;
    });
    const weekEvents = weekEventsProp ?? events.filter(e => {
      const t = e.start instanceof Date ? e.start.getTime() : new Date(e.start).getTime();
      return Number.isFinite(t) && t >= dayCutoff && t < weekCutoff;
    });

    let recentMessageContactIds = recentMessageContactIdsProp;
    if (recentMessageContactIds === undefined) {
      const ids = new Set<string>();
      for (const thread of fetchedThreads) {
        const lastMsg = thread.messages?.[thread.messages.length - 1];
        const ts = lastMsg?.timestamp instanceof Date
          ? lastMsg.timestamp.getTime()
          : lastMsg?.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;
        if (ts >= dayCutoff) ids.add(thread.contactId);
      }
      recentMessageContactIds = ids;
    }

    const hasRealSignals =
      todayEvents.length > 0 ||
      weekEvents.length > 0 ||
      recentMessageContactIds.size > 0;

    return { todayEvents, weekEvents, recentMessageContactIds, hasRealSignals };
  }, [todayEventsProp, weekEventsProp, recentMessageContactIdsProp, fetchedEvents, fetchedThreads]);

  // ─── Phase 6 — visited-stops feed for the AI proposal ─────────────────────
  // Pulls today's geofence enter events for the operator and maps each
  // place_id to its matching stop id (contact-home/work). Fed to
  // proposeRoute as visitedIds so the model doesn't re-propose stops the
  // operator already arrived at. Refreshes on any geofence event surfaced
  // by geofenceNotificationService — listening here keeps the prompt
  // current without a polling loop.
  const [visitedStopIds, setVisitedStopIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    const loadVisited = async () => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('geofence_events')
        .select('place_id, entity_type, entity_id, event_type, occurred_at')
        .eq('event_type', 'enter')
        .gte('occurred_at', dayStart.toISOString());
      if (error || cancelled || !data) return;

      // Map place_id → contact stop id via entity_type='contact' rows. A
      // place may be reachable both via its own id and via the contact's
      // home/work role; the role on entity_places tells us which side it's
      // bound to. We don't query entity_places here — the row already
      // carries entity_type + entity_id (geofenceService denormalises).
      const ids = new Set<string>();
      for (const row of data) {
        const r = row as { entity_type?: string; entity_id?: string; place_id?: string };
        if (r.entity_type === 'contact' && r.entity_id) {
          // Conservative: mark BOTH home and work as visited when the row
          // doesn't carry a role hint. Geofences are usually role-specific
          // so this rarely over-counts, and over-counting just means the
          // model treats one role as done — handled gracefully downstream.
          ids.add(markerKey(r.entity_id, 'home'));
          ids.add(markerKey(r.entity_id, 'work'));
        }
      }
      setVisitedStopIds(ids);
    };
    loadVisited();
    return () => { cancelled = true; };
  }, [lens]);

  // ─── Meeting marker geocoding ─────────────────────────────────────────────
  // Geocode the location text on calendar events lazily; the geocode cache
  // dedupes across runs so re-renders are cheap. Events without a location
  // string are skipped (no marker, but still count toward lensIncludesContact
  // via attendees). Failed geocodes are recorded so we don't retry in a loop.
  const [meetingMarkers, setMeetingMarkers] = useState<MeetingMarkerData[]>([]);
  const geocodedEventsRef = useRef<Map<string, { lat: number; lng: number } | null>>(new Map());
  useEffect(() => {
    const sourceEvents = lens === 'today' ? geoSignals.todayEvents : geoSignals.weekEvents;
    const eventsToTry = sourceEvents.filter(e => !!e.location?.trim());
    if (eventsToTry.length === 0) {
      if (meetingMarkers.length > 0) setMeetingMarkers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const next: MeetingMarkerData[] = [];
      for (const e of eventsToTry) {
        const cached = geocodedEventsRef.current.get(e.id);
        if (cached === null) continue; // known-failed
        let coords = cached;
        if (!coords) {
          const result = await geocodeAddress(e.location!).catch(() => null);
          geocodedEventsRef.current.set(e.id, result);
          if (!result) continue;
          coords = result;
        }
        next.push({ event: e, lat: coords.lat, lng: coords.lng });
      }
      if (!cancelled) setMeetingMarkers(next);
    })();
    return () => { cancelled = true; };
    // meetingMarkers intentionally NOT in deps — setting it inside the effect
    // would loop. Re-evaluation triggers on real input changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens, geoSignals.todayEvents, geoSignals.weekEvents]);

  useEffect(() => {
    getCurrentUserLocation()
      .then(pos => setUserPosition(pos))
      .catch((err: unknown) => {
        if (
          err && typeof err === 'object' && 'code' in err &&
          (err as GeolocationPositionError).code === 1
        ) {
          setGeoBlocked(true);
        }
      });
  }, []);

  // Batch geocode contacts that have address text but no lat/lng. The ref
  // de-dupes inflight requests so the deps array can stay correct.
  const geocodeRequestedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const needsGeocode = localContacts.filter(c =>
      (c.address || c.homeAddress)
      && !c.homeLat
      && !c.workLat
      && !geocodeRequestedRef.current.has(c.id)
    );
    if (needsGeocode.length === 0) return;

    needsGeocode.forEach(c => geocodeRequestedRef.current.add(c.id));

    geocodeContactsBatch(needsGeocode).then(results => {
      results.forEach(async (coords, contactId) => {
        const contact = needsGeocode.find(c => c.id === contactId);
        if (!contact) return;
        const address = contact.homeAddress || contact.address || '';
        try {
          // saveContactLocation may promote a Google/Vision contact, in which
          // case the canonical id differs from the cached one — update local
          // state by the OLD id and write the new id into the row.
          const canonicalId = await saveContactLocation(contact, 'home', coords.lat, coords.lng, address);
          setLocalContacts(prev =>
            prev.map(c => c.id === contactId
              ? { ...c, id: canonicalId, homeLat: coords.lat, homeLng: coords.lng, homeAddress: address }
              : c
            )
          );
        } catch {
          // Promotion / write failed (auth, RLS, schema). Surface in the
          // request set so we don't loop on a dead contact and keep the
          // user's UI usable.
          geocodeRequestedRef.current.add(contactId);
        }
      });
    });
  }, [localContacts]);

  useEffect(() => {
    const linked = localContacts.filter(c => c.pulseUserId);
    const unsubs: Array<() => void> = [];
    linked.forEach(c => {
      const unsub = subscribeToUserLocation(c.pulseUserId!, loc => {
        setLiveLocations(prev => new Map(prev).set(c.id, loc));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(fn => fn());
  }, [localContacts]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const visibleMarkers = useMemo<MarkerData[]>(() => {
    const q = filter.searchQuery.toLowerCase();
    const now = Date.now();
    return localContacts.flatMap(c => {
      if (q && !c.name.toLowerCase().includes(q)) return [];
      if (!lensIncludesContact(c, lens, now, geoSignals)) return [];
      if (filter.circles.length > 0) {
        const inCircle = circles.some(
          circle => filter.circles.includes(circle.id) && circle.memberContactIds.includes(c.id)
        );
        if (!inCircle) return [];
      }

      const markers: MarkerData[] = [];
      if (
        (filter.locationType === 'all' || filter.locationType === 'home') &&
        c.homeLat != null && c.homeLng != null
      ) {
        markers.push({ contact: c, locType: 'home', lat: c.homeLat, lng: c.homeLng });
      }
      if (
        (filter.locationType === 'all' || filter.locationType === 'work') &&
        c.workLat != null && c.workLng != null
      ) {
        markers.push({ contact: c, locType: 'work', lat: c.workLat, lng: c.workLng });
      }
      return markers;
    });
  }, [localContacts, filter, circles, lens]);

  // Fit bounds when the marker set changes (lens switch, filter change).
  // With 0 markers we DON'T refit — that produces a degenerate 1-point fit
  // that zooms to maxZoom and feels broken. Instead, pan to userPosition
  // gently so the empty state card sits over a useful neighbourhood. Fit
  // includes meeting markers too, so a meeting in a different neighbourhood
  // doesn't fall off-screen when the lens switches to TODAY.
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const points: Array<{ lat: number; lng: number }> = [
      ...visibleMarkers.map(m => ({ lat: m.lat, lng: m.lng })),
      ...meetingMarkers.map(m => ({ lat: m.lat, lng: m.lng })),
    ];
    if (points.length === 0) {
      if (userPosition) mapRef.current.panTo(userPosition);
      return;
    }
    if (userPosition) points.push(userPosition);
    const bounds = computeBounds(points);
    if (!bounds) return;
    if (points.length === 1) {
      mapRef.current.panTo(points[0]);
      mapRef.current.setZoom(13);
      return;
    }
    mapRef.current.fitBounds(bounds, 80);
  }, [isLoaded, visibleMarkers, meetingMarkers, userPosition]);

  // Stable marker key used by the AI proposal and the accepted-route mapping.
  const markerKey = (contactId: string, locType: 'home' | 'work') => `${contactId}-${locType}`;
  const meetingKey = (eventId: string) => `meeting-${eventId}`;

  // Unified stop list — feeds the AI prompt, the reorder draggable list, and
  // the acceptance resolver. A "stop" is anything we can route to: a contact
  // marker OR a geocoded meeting. Includes a back-pointer (`lat`, `lng`) so
  // handleAcceptRoute can resolve orderedIds without a second lookup.
  const allStops = useMemo(
    () => {
      const contactStops = visibleMarkers.map(m => ({
        id: markerKey(m.contact.id, m.locType),
        label: `${m.contact.name} · ${m.locType === 'home' ? 'Home' : 'Work'}`,
        lat: m.lat,
        lng: m.lng,
      }));
      const meetingStops = meetingMarkers
        .filter(mm => geoSignals.todayEvents.some(e => e.id === mm.event.id)
          || geoSignals.weekEvents.some(e => e.id === mm.event.id))
        .map(mm => ({
          id: meetingKey(mm.event.id),
          label: `${mm.event.title} · meeting`,
          lat: mm.lat,
          lng: mm.lng,
        }));
      return [...contactStops, ...meetingStops];
    },
    [visibleMarkers, meetingMarkers, geoSignals.todayEvents, geoSignals.weekEvents],
  );

  // ─── AI proposal effect — paint-first, fetch in the background, collapse
  // silently on failure. Aborts on lens change or new marker set. Skips when
  // a route is already accepted (the strip then renders the Underway state)
  // or when the user is actively reordering a proposal (would wipe their
  // draft on every marker filter change). ─────────────────────────────────────
  const isReordering = aiState.status === 'reordering';
  useEffect(() => {
    if (!isLoaded) return;
    if (acceptedRoute) return; // Underway — don't re-propose.
    if (isReordering) return;  // User is mid-drag — preserve the working order.
    if (allStops.length === 0) {
      setAiState({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setAiState({ status: 'fetching' });

    const debounceTimer = setTimeout(async () => {
      if (controller.signal.aborted) return;

      // Use the unified stops list — contact markers PLUS meeting markers
      // resolved from calendar events with a location. The AI gets both,
      // letting it weave meetings into the route order (e.g. "1pm meeting at
      // X first, then the cluster of contacts nearby, then home stop").
      const stops = allStops.map(s => ({
        id: s.id,
        label: s.label,
        lat: s.lat,
        lng: s.lng,
      }));

      // Helper — null proposal could mean "no insight" OR "circuit open
      // because we hit the workspace cap." Surface paused explicitly so the
      // user knows AI is on a break, not broken.
      const settleNullProposal = () => {
        const pausedUntil = getAiPausedUntil();
        if (pausedUntil != null) setAiState({ status: 'paused', until: pausedUntil });
        else setAiState({ status: 'none' });
      };

      try {
        if (lens === 'today') {
          if (stops.length < 2) {
            setAiState({ status: 'none' });
            return;
          }
          const proposal = await proposeRoute({
            stops,
            origin: userPosition,
            signal: controller.signal,
            visitedIds: Array.from(visitedStopIds),
          });
          if (controller.signal.aborted) return;
          if (!proposal) { settleNullProposal(); return; }
          setAiState({ status: 'ready', data: { kind: 'route', proposal } });
          return;
        }
        if (lens === 'week') {
          const proposal = await proposeWeekPlan({ stops, signal: controller.signal });
          if (controller.signal.aborted) return;
          if (!proposal) { settleNullProposal(); return; }
          setAiState({ status: 'ready', data: { kind: 'plan', proposal } });
          return;
        }
        // Atlas — insight from the network at large.
        const snapshots = visibleMarkers.map(m => {
          const staleMs = m.contact.lastSeen ? Date.now() - m.contact.lastSeen.getTime() : null;
          return {
            id: m.contact.id,
            name: m.contact.name,
            lat: m.lat,
            lng: m.lng,
            staleDays: staleMs != null ? Math.floor(staleMs / DAY_MS) : null,
            circles: circles
              .filter(c => c.memberContactIds.includes(m.contact.id))
              .map(c => c.name),
          };
        });
        const proposal = await proposeAtlasInsight({ contacts: snapshots, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!proposal) { settleNullProposal(); return; }
        setAiState({ status: 'ready', data: { kind: 'insight', proposal } });
      } catch {
        if (!controller.signal.aborted) settleNullProposal();
      }
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
    // allStops includes meeting markers — they need to participate in the AI
    // proposal alongside contact markers. visitedStopIds suppresses already-
    // arrived stops from the prompt so the AI doesn't re-route to them.
  }, [isLoaded, lens, allStops, userPosition, circles, acceptedRoute, isReordering, visitedStopIds]);

  // ─── Route accept — calls the Google Directions JS service for the polyline
  // and the leg-duration math, then flips the strip into the Underway state.
  // Accepts from either a fresh ready-route proposal OR a user-reordered draft
  // (same DirectionsService call, just a different orderedIds source). ─────────
  const handleAcceptRoute = useCallback(async () => {
    if (acceptingRoute) return;
    let orderedIds: string[] | null = null;
    if (aiState.status === 'reordering') {
      orderedIds = aiState.orderedIds;
    } else if (aiState.status === 'ready' && aiState.data.kind === 'route') {
      orderedIds = aiState.data.proposal.orderedIds;
    } else {
      return;
    }
    if (orderedIds.length < 2) return;

    // Resolve every ordered id from the unified allStops list — handles both
    // contact markers and meeting markers without forking the lookup.
    // Defensive filter for ids that vanished between proposal and accept
    // (filter change, reorder against a stale set, etc.).
    const orderedResolved = orderedIds
      .map(id => allStops.find(s => s.id === id))
      .filter((s): s is typeof allStops[number] => s != null);
    if (orderedResolved.length < 2) return;

    const origin = userPosition ?? { lat: orderedResolved[0].lat, lng: orderedResolved[0].lng };
    const destination = {
      lat: orderedResolved[orderedResolved.length - 1].lat,
      lng: orderedResolved[orderedResolved.length - 1].lng,
    };
    const waypoints = orderedResolved.slice(0, -1).map(s => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }));

    setAcceptingRoute(true);
    try {
      const ds = new google.maps.DirectionsService();
      const result = await ds.route({
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false, // AI already proposed the order
      });
      const route = result.routes[0];
      if (!route) {
        setAcceptingRoute(false);
        return;
      }
      const path = route.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
      const totalSec = route.legs.reduce((acc, leg) => acc + (leg.duration?.value ?? 0), 0);
      const durationMin = Math.round(totalSec / 60);
      setAcceptedRoute({
        orderedMarkerKeys: orderedResolved.map(s => s.id),
        path,
        durationMin,
        arrivesAt: new Date(Date.now() + totalSec * 1000),
      });
    } catch {
      // Directions failed — leave the strip as-is so the user can retry.
    } finally {
      setAcceptingRoute(false);
    }
  }, [aiState, acceptingRoute, allStops, userPosition]);

  const handleDismissRoute = useCallback(() => {
    setAcceptedRoute(null);
  }, []);

  // ─── Reorder lifecycle. Enter from a ready route proposal, mutate the draft
  // order via drag, then either accept the new order (Accept reuses
  // handleAcceptRoute which now consumes the reorder draft) or revert. ────────
  const handleStartReorder = useCallback(() => {
    if (aiState.status !== 'ready' || aiState.data.kind !== 'route') return;
    setAiState({
      status: 'reordering',
      orderedIds: aiState.data.proposal.orderedIds.slice(),
      baseProposal: aiState.data.proposal,
    });
  }, [aiState]);

  const handleReorderChange = useCallback((nextOrder: string[]) => {
    setAiState(prev =>
      prev.status === 'reordering' ? { ...prev, orderedIds: nextOrder } : prev,
    );
  }, []);

  const handleReorderCancel = useCallback(() => {
    setAiState(prev =>
      prev.status === 'reordering'
        ? { status: 'ready', data: { kind: 'route', proposal: prev.baseProposal } }
        : prev,
    );
  }, []);

  // Stops the AiStrip's reorder list renders. Uses the unified allStops so
  // meetings show up in the drag list alongside contact stops. Mapped to
  // {id, label} only — the strip doesn't need lat/lng.
  const reorderableStops = useMemo(
    () => allStops.map(s => ({ id: s.id, label: s.label })),
    [allStops],
  );

  // Open the first leg in the OS maps app — closest current platform-native
  // affordance to "tap to start" without bundling Apple/Google Maps SDKs.
  const handleOpenInSystemMaps = useCallback(() => {
    if (!acceptedRoute) return;
    const firstStop = allStops.find(s => s.id === acceptedRoute.orderedMarkerKeys[0]);
    if (!firstStop) return;
    const destStr = `${firstStop.lat},${firstStop.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destStr)}&travelmode=driving`;
    window.open(url, '_blank', 'noopener');
  }, [acceptedRoute, allStops]);

  const selectedContact = localContacts.find(c => c.id === selectedContactId) ?? null;

  // `previousId` is supplied when the save promoted a virtual contact and
  // the row's id changed (e.g. `google_…` → UUID). Without it, the local
  // list matcher wouldn't find the row to replace. Propagates upward so the
  // App-level cache can apply the same id-shift fix.
  const handleContactUpdated = useCallback((updated: Contact, previousId?: string) => {
    const matchId = previousId ?? updated.id;
    setLocalContacts(prev => prev.map(c => c.id === matchId ? updated : c));
    onContactUpdated?.(updated, previousId);
  }, [onContactUpdated]);

  // Atlas density halos — one soft rose Circle per pinned location.
  // Overlapping halos sum optically to produce a heat-map feel without
  // relying on Google's deprecated HeatmapLayer. Recomputed only when the
  // underlying contact pin set changes; not affected by lens or filter
  // (Atlas lens decides whether to render them at all).
  const atlasDensityHalos = useMemo(() => {
    const halos: Array<{ key: string; lat: number; lng: number; radiusM: number; opacity: number }> = [];
    for (const c of localContacts) {
      const strong = c.pulseUserId || c.isTeamMember;
      const baseOpacity = strong ? 0.09 : 0.06;
      const radiusM = strong ? 1200 : 1000;
      if (c.homeLat != null && c.homeLng != null) {
        halos.push({ key: `halo-${c.id}-home`, lat: c.homeLat, lng: c.homeLng, radiusM, opacity: baseOpacity });
      }
      if (c.workLat != null && c.workLng != null) {
        halos.push({ key: `halo-${c.id}-work`, lat: c.workLat, lng: c.workLng, radiusM, opacity: baseOpacity });
      }
    }
    return halos;
  }, [localContacts]);

  // Live broadcasters across all linked contacts — drives the corner chip
  // that replaces the old LIVE TEAM peer lens.
  const liveBroadcasters = useMemo(() => {
    const list: Array<{ contact: Contact; location: UserLocation }> = [];
    for (const c of localContacts) {
      const loc = liveLocations.get(c.id);
      if (loc?.isSharing) list.push({ contact: c, location: loc });
    }
    return list;
  }, [localContacts, liveLocations]);

  const contactsWithoutLocations = useMemo(
    () => localContacts.filter(c => c.homeLat == null && c.workLat == null),
    [localContacts]
  );
  const contactsWithAddressText = useMemo(
    () => localContacts.filter(c => (c.address || c.homeAddress) && c.homeLat == null && c.workLat == null),
    [localContacts]
  );

  // Keyboard shortcuts — 1/2/3 lens, B broadcast (delegates to MapFilterBar),
  // / focus search, Esc closes panels. Skip when typing in inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (e.key === 'Escape') {
        if (showLiveSheet) { setShowLiveSheet(false); return; }
        if (selectedContactId) { setSelectedContactId(null); return; }
        if (selectedMeetingId) { setSelectedMeetingId(null); return; }
        if (selectedCircleId) { setSelectedCircleId(null); return; }
        if (showAddLocationPicker) { setShowAddLocationPicker(false); return; }
        return;
      }
      if (inField) return;
      if (e.key === '1') { setLens('today'); e.preventDefault(); return; }
      if (e.key === '2') { setLens('week');  e.preventDefault(); return; }
      if (e.key === '3') { setLens('atlas'); e.preventDefault(); return; }
      if (e.key === '/') {
        searchInputRef.current?.focus();
        e.preventDefault();
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showLiveSheet, selectedContactId, selectedMeetingId, selectedCircleId, showAddLocationPicker]);

  if (loadError) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 text-sm ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} />
          Map's offline — check API key in Settings → Integrations.
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('pulse:navigate', {
            detail: { view: AppView.SETTINGS, section: 'integrations' },
          }))}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 transition-colors"
        >
          Open Settings
        </button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <MapPinned size={32} className="text-rose-500 motion-safe:animate-pulse" />
        <p className="text-sm">Loading map…</p>
      </div>
    );
  }

  const pickerContact = pickerContactId
    ? localContacts.find(c => c.id === pickerContactId) ?? null
    : null;
  // Empty when there's nothing routable on the map — contacts OR meetings.
  // A TODAY view with only a meeting still wants the map visible.
  const hasNoLocations = visibleMarkers.length === 0 && meetingMarkers.length === 0;
  const atlasHasAnyPinned = localContacts.some(c => c.homeLat != null || c.workLat != null);

  return (
    <div className="flex flex-col w-full h-full">
      <style>{`
        @keyframes contactsMapPanelEnter {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .contacts-map-panel-enter {
          animation: contactsMapPanelEnter 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes mapSheetUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .map-sheet-up {
          animation: mapSheetUp 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .contacts-map-panel-enter,
          .map-sheet-up { animation: none; }
        }
      `}</style>

      {/* Lens row — the section's identity. TODAY is default and most-built;
          ATLAS demotes the old address-book-on-a-map to a tertiary lens. */}
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${
          isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-gray-200'
        }`}
        role="tablist"
        aria-label="Map lens"
      >
        <div className="flex items-center gap-1">
          {LENS_OPTIONS.map(({ id, label, Icon }) => {
            const active = lens === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLens(id)}
                title={`${label} (${id === 'today' ? '1' : id === 'week' ? '2' : '3'})`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                  active
                    ? `text-rose-500 ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'}`
                    : `${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Icon size={11} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI strip — driven by aiState + acceptedRoute. Committed-coral band
          is the one place coral exceeds the ≤10% rule on this surface,
          accepted in the shape brief. */}
      {(lens !== 'atlas' || atlasHasAnyPinned) && !hasNoLocations && (
        <AiStrip
          lens={lens}
          markerCount={visibleMarkers.length}
          aiState={aiState}
          acceptedRoute={acceptedRoute}
          acceptingRoute={acceptingRoute}
          isDarkMode={isDarkMode}
          stops={reorderableStops}
          onAccept={handleAcceptRoute}
          onDismissRoute={handleDismissRoute}
          onOpenInSystemMaps={handleOpenInSystemMaps}
          onReorderStart={handleStartReorder}
          onReorderChange={handleReorderChange}
          onReorderCancel={handleReorderCancel}
        />
      )}

      {/* Wrapper does NOT remount on lens change — the map camera state is
          expensive to rebuild and Atlas markers vanish off-screen if we
          force a remount. The lens-change fade lives on the AI strip
          + empty-state card instead, where it carries actual signal. */}
      <div className="relative flex-1 overflow-hidden rounded-b-xl">
        <MapFilterBar
          filter={filter}
          circles={circles}
          isDarkMode={isDarkMode}
          onFilterChange={setFilter}
          geoBlocked={geoBlocked && !geoBannerDismissed}
          onDismissGeoBanner={dismissGeoBanner}
          userId={userId}
          searchInputRef={searchInputRef}
          contacts={localContacts}
        />

        <GoogleMap
          mapContainerClassName="w-full h-full"
          center={userPosition ?? DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          options={getMapOptions(isDarkMode)}
          onLoad={onMapLoad}
          onClick={() => { setSelectedContactId(null); setSelectedCircleId(null); setSelectedMeetingId(null); }}
        >
          {userPosition && (
            <MapRadiusRings center={userPosition} isDarkMode={isDarkMode} />
          )}

          {lens === 'atlas' && circles.map(circle => (
            <MapCircleOverlay
              key={circle.id}
              circle={circle}
              contacts={localContacts}
              isSelected={selectedCircleId === circle.id}
              isDarkMode={isDarkMode}
              onClick={() => setSelectedCircleId(
                selectedCircleId === circle.id ? null : circle.id
              )}
            />
          ))}

          {visibleMarkers.map(({ contact, locType, lat, lng }) => {
            const live = liveLocations.get(contact.id);
            const key = markerKey(contact.id, locType);
            const seqIdx = acceptedRoute ? acceptedRoute.orderedMarkerKeys.indexOf(key) : -1;
            return (
              <MapContactMarker
                key={key}
                contact={contact}
                locationType={locType}
                lat={lat}
                lng={lng}
                isSelected={selectedContactId === contact.id && selectedLocType === locType}
                isLive={!!live && live.isSharing}
                liveLocation={live}
                onClick={() => {
                  setSelectedContactId(contact.id);
                  setSelectedLocType(locType);
                  setSelectedMeetingId(null);
                }}
                sequenceNumber={seqIdx >= 0 ? seqIdx + 1 : undefined}
              />
            );
          })}

          {/* Meeting markers — only render on TODAY/WEEK (Atlas is the
              network-browsing lens and shouldn't carry today-specific noise). */}
          {lens !== 'atlas' && meetingMarkers
            .filter(mm => (lens === 'today' ? geoSignals.todayEvents : geoSignals.weekEvents)
              .some(e => e.id === mm.event.id))
            .map(mm => {
              const key = meetingKey(mm.event.id);
              const seqIdx = acceptedRoute ? acceptedRoute.orderedMarkerKeys.indexOf(key) : -1;
              return (
                <MapMeetingMarker
                  key={key}
                  event={mm.event}
                  lat={mm.lat}
                  lng={mm.lng}
                  isSelected={selectedMeetingId === mm.event.id}
                  onClick={() => {
                    setSelectedMeetingId(prev => (prev === mm.event.id ? null : mm.event.id));
                    setSelectedContactId(null);
                  }}
                  sequenceNumber={seqIdx >= 0 ? seqIdx + 1 : undefined}
                />
              );
            })}

          {/* Accepted-route polyline. Coral with shadow stroke for legibility
              on light + dark map tiles. Click → opens system maps on the
              first leg. */}
          {acceptedRoute && (
            <Polyline
              path={acceptedRoute.path}
              onClick={handleOpenInSystemMaps}
              options={{
                strokeColor: '#f43f5e',
                strokeOpacity: 0.95,
                strokeWeight: 5,
                clickable: true,
                geodesic: false,
                zIndex: 5,
                icons: [{
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                  offset: '0',
                  repeat: '14px',
                }],
              }}
            />
          )}

          {/* Atlas-only — Circle territory polygons (convex hull over members
              who have at least one pinned location). Each territory wears
              the circle's own colour at low opacity so multiple territories
              read without fighting for the same coral. */}
          {lens === 'atlas' && circles.map(circle => {
            const members = localContacts.filter(c =>
              circle.memberContactIds.includes(c.id) && (c.homeLat != null || c.workLat != null),
            );
            const points: Array<{ lat: number; lng: number }> = [];
            for (const m of members) {
              if (m.homeLat != null && m.homeLng != null) points.push({ lat: m.homeLat, lng: m.homeLng });
              if (m.workLat != null && m.workLng != null) points.push({ lat: m.workLat, lng: m.workLng });
            }
            if (points.length < 3) return null;
            const hull = convexHull(points);
            const isFocused = selectedCircleId === circle.id;
            return (
              <Polygon
                key={`territory-${circle.id}`}
                paths={hull}
                onClick={() => setSelectedCircleId(isFocused ? null : circle.id)}
                options={{
                  fillColor: circle.color,
                  fillOpacity: isFocused ? 0.18 : 0.08,
                  strokeColor: circle.color,
                  strokeOpacity: isFocused ? 0.9 : 0.4,
                  strokeWeight: isFocused ? 2 : 1,
                  clickable: true,
                  zIndex: 1,
                }}
              />
            );
          })}

          {/* Atlas-only — density rendering via overlapping rose-tinted
              circles. Each pinned point contributes a soft 1km halo; where
              points cluster, the halos sum optically and produce a heat-map
              feel without depending on Google's deprecated HeatmapLayer
              (sunset May 2026, warning hot today). Pulse-linked + team
              members render slightly stronger so the active network reads
              through the rest of the dots. */}
          {lens === 'atlas' && atlasDensityHalos.map(halo => (
            <Circle
              key={halo.key}
              center={{ lat: halo.lat, lng: halo.lng }}
              radius={halo.radiusM}
              options={{
                fillColor: '#f43f5e',
                fillOpacity: halo.opacity,
                strokeOpacity: 0,
                clickable: false,
                zIndex: 0,
              }}
            />
          ))}
        </GoogleMap>

        {hasNoLocations && (
          <LensEmptyState
            lens={lens}
            isDarkMode={isDarkMode}
            atlasHasAnyPinned={atlasHasAnyPinned}
            hasGeocodingInFlight={contactsWithAddressText.length > 0}
            canAddLocation={contactsWithoutLocations.length > 0}
            onOpenAtlas={() => setLens('atlas')}
            onAutoGeocode={() => {
              // Force a re-run: pretend the request set is empty so the
              // useEffect picks them up.
              geocodeRequestedRef.current.clear();
              setLocalContacts(prev => [...prev]);
            }}
            onPinWhereIAm={() => {
              if (!userPosition) return;
              // Open the picker for the first contact without a location,
              // pre-filling current GPS would need a deeper LocationEditModal
              // change — Phase 2 polish.
              setShowAddLocationPicker(true);
            }}
            onPickContact={() => setShowAddLocationPicker(true)}
          />
        )}

        {selectedContact && (
          <MapContactPanel
            contact={selectedContact}
            locationType={selectedLocType}
            circles={circles}
            userPosition={userPosition}
            liveLocation={liveLocations.get(selectedContact.id)}
            myUserId={userId}
            isDarkMode={isDarkMode}
            onClose={() => setSelectedContactId(null)}
            onAction={onContactAction}
            onContactUpdated={handleContactUpdated}
          />
        )}

        {/* Live presence chip — bottom-left. Replaces the old peer-lens
            LiveTeamView entry point. Tap opens the sheet. */}
        {liveBroadcasters.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLiveSheet(true)}
            className={`absolute bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold shadow backdrop-blur-sm flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 transition-colors ${
              isDarkMode ? 'bg-zinc-900/80 text-gray-200 hover:bg-zinc-900' : 'bg-white/85 text-gray-700 hover:bg-white'
            }`}
            aria-label={`${liveBroadcasters.length} broadcasting — open list`}
          >
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500/70 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <span>{liveBroadcasters.length} broadcasting</span>
          </button>
        )}

        {/* Marker count badge — bottom-left when no broadcasters, otherwise
            tucked right of the live chip. */}
        {liveBroadcasters.length === 0 && (
          <div
            className={`absolute bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold shadow backdrop-blur-sm flex items-center gap-1.5 ${
              isDarkMode ? 'bg-zinc-900/80 text-gray-300' : 'bg-white/85 text-gray-600'
            }`}
          >
            <Users size={12} className="text-rose-500" />
            {visibleMarkers.length} on map
          </div>
        )}

        {/* I'm at… FAB — wire to Messages. Only renders when GPS is on. */}
        <ImAtFAB
          userPosition={userPosition}
          contacts={localContacts}
          isDarkMode={isDarkMode}
          onSend={(contactId, body) => {
            // Prefill event for any listener that wires it up (Messages
            // doesn't pick this up today; the clipboard copy in ImAtFAB
            // is the deterministic fallback). Routes to Messages with the
            // contact selected so paste is one keystroke away.
            window.dispatchEvent(new CustomEvent('pulse:messages:draft', {
              detail: { contactId, body, source: 'map-im-at' },
            }));
            onContactAction('message', contactId);
          }}
        />

        {showAddLocationPicker && (
          <ContactLocationPickerOverlay
            contacts={contactsWithoutLocations}
            isDarkMode={isDarkMode}
            onClose={() => setShowAddLocationPicker(false)}
            onPick={(id) => {
              setShowAddLocationPicker(false);
              setPickerContactId(id);
            }}
          />
        )}

        {pickerContact && (
          <LocationEditModal
            contact={pickerContact}
            isOpen={true}
            isDarkMode={isDarkMode}
            onClose={() => setPickerContactId(null)}
            onSave={(updated, previousId) => {
              handleContactUpdated(updated, previousId);
              setPickerContactId(null);
            }}
          />
        )}

        {showLiveSheet && (
          <LiveBroadcastSheet
            contacts={localContacts}
            liveLocations={liveLocations}
            isDarkMode={isDarkMode}
            onClose={() => setShowLiveSheet(false)}
            onContactAction={onContactAction}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================
// AI strip — Phase 2 wired. Renders one of:
//   • Underway state (accepted route in flight)
//   • Ready proposal (Gemini returned)
//   • Quiet placeholder (TODAY + 2+ stops while AI is fetching)
//   • Nothing (everything else)
// Speed is craft — no spinners, no "AI is thinking…" theatre.
// ============================================================

interface AiStripProps {
  lens: MapLens;
  markerCount: number;
  aiState: AiState;
  acceptedRoute: AcceptedRoute | null;
  acceptingRoute: boolean;
  isDarkMode: boolean;
  /** Available stops keyed by markerKey — used by the reorder list to render
   *  human-readable labels without coupling AiStrip to MarkerData. */
  stops: Array<{ id: string; label: string }>;
  onAccept: () => void;
  onDismissRoute: () => void;
  onOpenInSystemMaps: () => void;
  onReorderStart: () => void;
  onReorderChange: (orderedIds: string[]) => void;
  onReorderCancel: () => void;
}

function formatArrivalTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

const AiStrip: React.FC<AiStripProps> = ({
  lens,
  markerCount,
  aiState,
  acceptedRoute,
  acceptingRoute,
  isDarkMode,
  stops,
  onAccept,
  onDismissRoute,
  onOpenInSystemMaps,
  onReorderStart,
  onReorderChange,
  onReorderCancel,
}) => {
  // Local UI state — collapsed by default. Rationale expansion is per-mount
  // (reset whenever the proposal swaps) so a fresh proposal doesn't surprise
  // the user with someone else's reasoning still open.
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  // Cell over which the dragged item is currently hovering — drives the drop
  // indicator without depending on browser-specific DragEvent.dataTransfer
  // behaviour. Null when nothing is being hovered.
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const stripCls = `flex items-center gap-3 px-3 py-2 ${
    isDarkMode
      ? 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent'
      : 'bg-gradient-to-r from-rose-50 via-rose-50/40 to-transparent'
  }`;
  const wrapperBorderCls = isDarkMode ? 'border-b border-rose-500/15' : 'border-b border-rose-500/20';
  const monoStyle = { fontFamily: "'JetBrains Mono', monospace" } as const;

  // Reset the Why? expansion when the underlying proposal changes (a new
  // route arrives or we leave reorder mode). Otherwise the toggle would
  // attach to whichever rationale happens to be in scope next.
  const proposalSignature =
    aiState.status === 'ready' && aiState.data.kind === 'route'
      ? aiState.data.proposal.summary
      : '';
  useEffect(() => { setWhyExpanded(false); }, [proposalSignature]);

  // 1. Underway — accepted route in flight, takes precedence over any pending
  //    AI fetch. Two buttons: Open in Maps + Dismiss.
  if (acceptedRoute) {
    const arriving = formatArrivalTime(acceptedRoute.arrivesAt);
    return (
      <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
        <Navigation size={14} className="text-rose-500 flex-shrink-0" />
        <span
          className="text-[10px] tracking-[0.1em] uppercase text-rose-500 flex-shrink-0"
          style={monoStyle}
        >
          PULSE AI · UNDERWAY
        </span>
        <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          {acceptedRoute.orderedMarkerKeys.length} stops · {acceptedRoute.durationMin} min · arriving {arriving}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenInSystemMaps}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
          >
            Open in Maps
            <ChevronRight size={11} />
          </button>
          <button
            type="button"
            onClick={onDismissRoute}
            aria-label="Dismiss route"
            className={`p-1 rounded transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-rose-500/10 text-gray-500'
            }`}
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  // 2. Reorder mode — drag-to-reorder draggable list, header replaces the
  //    usual summary row. Drop handler swaps positions; Accept replays
  //    DirectionsService against the new sequence; Cancel reverts. ────────────
  if (aiState.status === 'reordering') {
    const handleDrop = (toIdx: number) => {
      if (dragFromIdx == null || dragFromIdx === toIdx) {
        setDragFromIdx(null);
        setDragOverIdx(null);
        return;
      }
      const next = aiState.orderedIds.slice();
      const [moved] = next.splice(dragFromIdx, 1);
      next.splice(toIdx, 0, moved);
      onReorderChange(next);
      setDragFromIdx(null);
      setDragOverIdx(null);
    };
    const validCount = aiState.orderedIds.filter(id => stops.some(s => s.id === id)).length;
    return (
      <div className={wrapperBorderCls}>
        <div className={stripCls} role="status" aria-live="polite">
          <ArrowUpDown size={14} className="text-rose-500 flex-shrink-0" />
          <span
            className="text-[10px] tracking-[0.1em] uppercase text-rose-500 flex-shrink-0"
            style={monoStyle}
          >
            PULSE AI · REORDER
          </span>
          <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Drag to reorder, then Accept.
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={onReorderCancel}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-rose-500/10'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={acceptingRoute || validCount < 2}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {acceptingRoute ? 'Routing…' : 'Accept'}
            </button>
          </div>
        </div>
        <ul
          className={`px-3 pb-2 pt-1 space-y-1 ${
            isDarkMode ? 'bg-rose-500/[0.04]' : 'bg-rose-50/40'
          }`}
          aria-label="Reorder stops"
        >
          {aiState.orderedIds.map((id, idx) => {
            const stop = stops.find(s => s.id === id);
            if (!stop) return null;
            const isDragging = dragFromIdx === idx;
            const isOver = dragOverIdx === idx && dragFromIdx !== idx;
            return (
              <li
                key={id}
                draggable
                onDragStart={(e) => {
                  setDragFromIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  // Some browsers need a payload to initiate the drag image.
                  try { e.dataTransfer.setData('text/plain', id); } catch { /* IE-era safety */ }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIdx(idx);
                }}
                onDragLeave={() => {
                  setDragOverIdx(prev => (prev === idx ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(idx);
                }}
                onDragEnd={() => {
                  setDragFromIdx(null);
                  setDragOverIdx(null);
                }}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing select-none transition-all ${
                  isDarkMode
                    ? 'bg-zinc-900/60 border border-white/5 hover:border-rose-500/30'
                    : 'bg-white border border-rose-100 hover:border-rose-300'
                } ${isDragging ? 'opacity-40' : ''} ${isOver ? 'ring-2 ring-rose-500/60 ring-offset-0' : ''}`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold text-rose-500 ${
                    isDarkMode ? 'bg-rose-500/15' : 'bg-rose-100'
                  }`}
                  style={monoStyle}
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  {stop.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // 3. Ready proposal.
  if (aiState.status === 'ready') {
    const data = aiState.data;
    if (data.kind === 'route') {
      const summary = data.proposal.summary;
      const rationale = data.proposal.rationale;
      const count = data.proposal.orderedIds.length;
      return (
        <div className={wrapperBorderCls}>
          <div className={stripCls} role="status" aria-live="polite">
            <Sparkles size={14} className="text-rose-500 flex-shrink-0" />
            <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500 flex-shrink-0" style={monoStyle}>
              PULSE AI · ROUTE
            </span>
            <span
              className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
              title={rationale ?? summary}
            >
              {summary}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {rationale && (
                <button
                  type="button"
                  onClick={() => setWhyExpanded(v => !v)}
                  aria-expanded={whyExpanded}
                  aria-controls="pulse-ai-rationale"
                  className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                    isDarkMode ? 'text-gray-400 hover:text-rose-300 hover:bg-white/5' : 'text-gray-500 hover:text-rose-600 hover:bg-rose-500/5'
                  }`}
                >
                  Why?
                  <ChevronDown
                    size={11}
                    className={`transition-transform ${whyExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={onReorderStart}
                disabled={acceptingRoute || count < 2}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-rose-500/10'
                }`}
              >
                <ArrowUpDown size={11} />
                Reorder
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={acceptingRoute || count < 2}
                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {acceptingRoute ? 'Routing…' : 'Accept'}
              </button>
            </div>
          </div>
          {rationale && (
            <div
              id="pulse-ai-rationale"
              aria-hidden={!whyExpanded}
              className={isDarkMode ? 'bg-rose-500/[0.04]' : 'bg-rose-50/40'}
              style={{
                maxHeight: whyExpanded ? 240 : 0,
                overflow: 'hidden',
                transition: 'max-height 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <p
                className={`px-3 py-2 text-xs leading-relaxed ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}
                style={{ maxWidth: '70ch' }}
              >
                {rationale}
              </p>
            </div>
          )}
        </div>
      );
    }
    if (data.kind === 'plan' || data.kind === 'insight') {
      const label = data.kind === 'plan' ? 'PULSE AI · PLAN' : 'PULSE AI · INSIGHT';
      return (
        <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
          <Sparkles size={14} className="text-rose-500 flex-shrink-0" />
          <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500 flex-shrink-0" style={monoStyle}>
            {label}
          </span>
          <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            {data.proposal.summary}
          </span>
        </div>
      );
    }
  }

  // 4. Fetching placeholder — only for TODAY with >=2 stops, where a route
  //    proposal is genuinely imminent. Other lenses fail silent.
  if (aiState.status === 'fetching' && lens === 'today' && markerCount >= 2) {
    return (
      <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
        <Sparkles size={14} className={`flex-shrink-0 ${isDarkMode ? 'text-rose-500/70' : 'text-rose-500/80'}`} />
        <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500/70 flex-shrink-0" style={monoStyle}>
          PULSE AI · ROUTE
        </span>
        <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {markerCount} stops on the map.
        </span>
      </div>
    );
  }

  // 5. Paused — workspace hit the AI cap. Tell the truth, don't bark.
  if (aiState.status === 'paused' && lens === 'today' && markerCount >= 2) {
    return (
      <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
        <Sparkles size={14} className="text-rose-500/60 flex-shrink-0" />
        <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500/60 flex-shrink-0" style={monoStyle}>
          PULSE AI · PAUSED
        </span>
        <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Route proposals on a short break. Resuming after the workspace cap clears.
        </span>
      </div>
    );
  }

  // 6. Today + 1 stop — declare it honestly even when AI returned none.
  if (lens === 'today' && markerCount === 1) {
    return (
      <div className={`${stripCls} ${wrapperBorderCls}`} role="status" aria-live="polite">
        <Sparkles size={14} className="text-rose-500/70 flex-shrink-0" />
        <span className="text-[10px] tracking-[0.1em] uppercase text-rose-500/70 flex-shrink-0" style={monoStyle}>
          PULSE AI · ROUTE
        </span>
        <span className={`text-xs flex-1 truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No route today, just one stop.
        </span>
      </div>
    );
  }

  // Everything else — hide.
  return null;
};

// ============================================================
// Lens-specific empty state. Replaces the prior single-CTA card
// with copy + paths matched to the active lens.
// ============================================================

interface LensEmptyStateProps {
  lens: MapLens;
  isDarkMode: boolean;
  atlasHasAnyPinned: boolean;
  hasGeocodingInFlight: boolean;
  canAddLocation: boolean;
  onOpenAtlas: () => void;
  onAutoGeocode: () => void;
  onPinWhereIAm: () => void;
  onPickContact: () => void;
}

const LensEmptyState: React.FC<LensEmptyStateProps> = ({
  lens,
  isDarkMode,
  atlasHasAnyPinned,
  hasGeocodingInFlight,
  canAddLocation,
  onOpenAtlas,
  onAutoGeocode,
  onPinWhereIAm,
  onPickContact,
}) => {
  // Atlas-empty (first-run, no pins anywhere): three-path onboarding.
  if (lens === 'atlas' && !atlasHasAnyPinned) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6">
        <div
          className={`rounded-2xl px-6 py-5 shadow-lg backdrop-blur-2xl border max-w-md pointer-events-auto ${
            isDarkMode ? 'bg-zinc-950/85 border-white/10' : 'bg-white/90 border-gray-200'
          }`}
        >
          <MapPin size={28} className="text-rose-500/70 mb-3" />
          <p className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            Pin your network to see distance, routes, and circles.
          </p>
          <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Pick a starting move — the rest fills in as you go.
          </p>
          <div className="flex flex-col gap-2">
            {hasGeocodingInFlight && (
              <button
                type="button"
                onClick={onAutoGeocode}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
              >
                <Sparkles size={12} />
                Auto-geocode contacts with addresses
              </button>
            )}
            <button
              type="button"
              onClick={onPinWhereIAm}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isDarkMode ? 'border-white/10 text-gray-200 hover:border-rose-500/40 hover:text-rose-300' : 'border-gray-200 text-gray-700 hover:border-rose-500/40 hover:text-rose-600'
              }`}
            >
              <Home size={12} />
              Pin a contact's home or work
            </button>
            <button
              type="button"
              onClick={onPickContact}
              disabled={!canAddLocation}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode ? 'border-white/10 text-gray-200 hover:border-rose-500/40 hover:text-rose-300' : 'border-gray-200 text-gray-700 hover:border-rose-500/40 hover:text-rose-600'
              }`}
            >
              <Upload size={12} />
              Import addresses from a list
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Atlas mid-state: addresses queued for geocoding.
  if (lens === 'atlas' && hasGeocodingInFlight) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`rounded-2xl px-6 py-5 text-center shadow-lg backdrop-blur-2xl border max-w-sm pointer-events-auto ${
            isDarkMode ? 'bg-zinc-950/85 border-white/10' : 'bg-white/90 border-gray-200'
          }`}
        >
          <MapPinned size={28} className="text-rose-500/70 mx-auto mb-3 motion-safe:animate-pulse" />
          <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            Geocoding addresses…
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Pins appear as Google resolves each contact.
          </p>
        </div>
      </div>
    );
  }

  // Today / Week empty when Atlas has pins: tell the truth, offer the lens swap.
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className={`rounded-2xl px-6 py-5 text-center shadow-lg backdrop-blur-2xl border max-w-sm pointer-events-auto ${
          isDarkMode ? 'bg-zinc-950/85 border-white/10' : 'bg-white/90 border-gray-200'
        }`}
      >
        <Sun size={28} className="text-rose-500/70 mx-auto mb-3" />
        <p className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {lens === 'today' ? 'Nothing on the map today.' : 'Nothing on the map this week.'}
        </p>
        <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Open Atlas to browse your full network.
        </p>
        <button
          type="button"
          onClick={onOpenAtlas}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            isDarkMode ? 'border-white/15 text-gray-200 hover:border-rose-500/40 hover:text-rose-300' : 'border-gray-200 text-gray-700 hover:border-rose-500/40 hover:text-rose-600'
          }`}
        >
          <Globe size={11} />
          Switch to Atlas
        </button>
      </div>
    </div>
  );
};

// ============================================================
// Live broadcast sheet — slide-up wrapper around LiveTeamView.
// Replaces the previous peer-lens treatment of live presence.
// ============================================================

interface LiveBroadcastSheetProps {
  contacts: Contact[];
  liveLocations: Map<string, UserLocation>;
  isDarkMode: boolean;
  onClose: () => void;
  onContactAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
}

const LiveBroadcastSheet: React.FC<LiveBroadcastSheetProps> = ({
  contacts,
  liveLocations,
  isDarkMode,
  onClose,
  onContactAction,
}) => (
  <div
    className="absolute inset-0 z-30 flex items-end justify-center"
    style={{ background: 'rgba(0,0,0,0.45)' }}
    onClick={onClose}
    role="dialog"
    aria-modal="true"
    aria-label="Live broadcasters"
  >
    <div
      className={`w-full max-w-2xl rounded-t-2xl border-t border-x shadow-2xl overflow-hidden map-sheet-up ${
        isDarkMode ? 'bg-zinc-950 border-white/10' : 'bg-white border-gray-200'
      }`}
      style={{ maxHeight: '70%' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-rose-500" />
          <span
            className="text-[11px] tracking-[0.1em] uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Broadcasting now
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`p-1 rounded transition-colors ${
            isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-[60vh] overflow-y-auto">
        <LiveTeamView
          contacts={contacts}
          liveLocations={liveLocations}
          isDarkMode={isDarkMode}
          onContactAction={onContactAction}
        />
      </div>
    </div>
  </div>
);

// ============================================================
// Contact picker overlay (empty-state path). Inline because it's
// tightly coupled to the empty state and not reused elsewhere.
// ============================================================

interface ContactLocationPickerOverlayProps {
  contacts: Contact[];
  isDarkMode: boolean;
  onClose: () => void;
  onPick: (contactId: string) => void;
}

const ContactLocationPickerOverlay: React.FC<ContactLocationPickerOverlayProps> = ({
  contacts,
  isDarkMode,
  onClose,
  onPick,
}) => {
  const [query, setQuery] = useState('');
  const filtered = contacts.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase())
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pick a contact to locate"
    >
      <div
        ref={containerRef}
        className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden ${
          isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`px-5 py-4 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
          <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Pick a contact to locate
          </h3>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className={`mt-3 w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${
              isDarkMode
                ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-rose-500'
                : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
            }`}
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className={`px-5 py-8 text-sm text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              No contacts match your search.
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                  isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: c.avatarColor || '#f43f5e' }}
                >
                  {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {c.name}
                  </p>
                  {c.role && (
                    <p className={`text-xs truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {c.role}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PulseMapView;

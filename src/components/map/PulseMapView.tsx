import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, GoogleMap, Polygon, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { AlertTriangle, MapPinned, Users } from 'lucide-react';
import { AppView, CalendarEvent, Contact } from '../../types';
import { ContactCircle } from '../../types/contactCircleTypes';
import { GOOGLE_MAPS_LIBRARIES, convexHull, getMapOptions, computeBounds } from '../../services/mapService';
import { UserLocation } from '../../services/locationService';
import {
  getAiPausedUntil,
  proposeAtlasInsight,
  proposeRoute,
  proposeWeekPlan,
  RouteProposal,
} from '../../services/mapAIService';
import MapFilterBar, { MapFilter } from './MapFilterBar';
import MapContactMarker from './contacts/MapContactMarker';
import MapRadiusRings from './contacts/MapRadiusRings';
import MapContactPanel from './contacts/MapContactPanel';
import MapCircleOverlay from './contacts/MapCircleOverlay';
import MapMeetingMarker from './contacts/MapMeetingMarker';
import LocationEditModal from './contacts/LocationEditModal';
import ImAtFAB from './sub/ImAtFAB';
import {
  DAY_MS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  LENS_OPTIONS,
  MAP_VIEW_LS_KEY,
  MAP_VIEW_OPTIONS,
  type MapLens,
  type MapViewMode,
} from './sub/mapLens';
import type { AcceptedRoute, AiState } from './sub/aiTypes';
import { AiStrip } from './sub/AiStrip';
import { LensEmptyState } from './sub/LensEmptyState';
import { LiveBroadcastSheet } from './sub/LiveBroadcastSheet';
import { ContactLocationPickerOverlay } from './sub/ContactLocationPickerOverlay';
import { useGeoRelevanceSignals, lensIncludesContact } from './hooks/useGeoRelevanceSignals';
import { useMeetingMarkers } from './hooks/useMeetingMarkers';
import { useVisitedStops } from './hooks/useVisitedStops';
import { useUserPosition } from './hooks/useUserPosition';
import { useContactGeocoding } from './hooks/useContactGeocoding';
import { useLivePresence } from './hooks/useLivePresence';

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

type MarkerData = { contact: Contact; locType: 'home' | 'work'; lat: number; lng: number };

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
  // Visually-hidden announcer for keyboard / SR users — lens + view-mode
  // swaps are otherwise silent. Driven by effects after visibleMarkers is
  // computed, so it can include the up-to-date marker count.
  const [srAnnouncement, setSrAnnouncement] = useState('');

  // Base-tile mode. Persisted so the user's pick survives reloads. Default
  // roadmap (the Coral Cockpit canvas the rest of the section is tuned to).
  const [viewMode, setViewMode] = useState<MapViewMode>(() => {
    if (typeof localStorage === 'undefined') return 'roadmap';
    const saved = localStorage.getItem(MAP_VIEW_LS_KEY);
    return (['roadmap', 'satellite', 'terrain', 'hybrid'] as const).includes(saved as MapViewMode)
      ? (saved as MapViewMode)
      : 'roadmap';
  });
  const changeViewMode = useCallback((next: MapViewMode) => {
    setViewMode(next);
    try { localStorage.setItem(MAP_VIEW_LS_KEY, next); } catch { /* ignore */ }
  }, []);

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
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedLocType, setSelectedLocType] = useState<'home' | 'work'>('home');
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [filter, setFilter] = useState<MapFilter>({
    circles: [],
    locationType: 'all',
    searchQuery: '',
  });
  const [showAddLocationPicker, setShowAddLocationPicker] = useState(false);
  const [pickerContactId, setPickerContactId] = useState<string | null>(null);

  const { userPosition, geoBlocked } = useUserPosition();
  const liveLocations = useLivePresence(localContacts);
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

  // Phase 5 geo-relevance signals, Phase 6 visited stops, and meeting-marker
  // geocoding all live in dedicated hooks under ./hooks/. They preserve the
  // exact prior behaviour — same effect deps, same memo composition — and
  // return the same shapes the rest of the component consumes.
  const geoSignals = useGeoRelevanceSignals({
    todayEventsProp,
    weekEventsProp,
    recentMessageContactIdsProp,
  });
  const visitedStopIds = useVisitedStops(lens);
  const meetingMarkers = useMeetingMarkers(lens, geoSignals.todayEvents, geoSignals.weekEvents);
  const { resetRequested: resetContactGeocoding } = useContactGeocoding(localContacts, setLocalContacts);

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

  // Lens / view-mode swap announcer — fires on lens or marker-count change
  // (lens swap usually changes both) and on viewMode change. Skips the
  // initial mount so SR users don't get spammed with a "Today lens" message
  // they didn't trigger; the empty initial string serves as that gate.
  useEffect(() => {
    const lensLabel = LENS_OPTIONS.find(o => o.id === lens)?.label ?? lens;
    const count = visibleMarkers.length;
    setSrAnnouncement(`${lensLabel} lens, ${count} ${count === 1 ? 'contact' : 'contacts'} on map`);
  }, [lens, visibleMarkers.length]);

  useEffect(() => {
    const viewLabel = MAP_VIEW_OPTIONS.find(o => o.id === viewMode)?.label ?? viewMode;
    setSrAnnouncement(`${viewLabel} view`);
  }, [viewMode]);

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
      if (e.key === '4') { changeViewMode('roadmap');   e.preventDefault(); return; }
      if (e.key === '5') { changeViewMode('satellite'); e.preventDefault(); return; }
      if (e.key === '6') { changeViewMode('terrain');   e.preventDefault(); return; }
      if (e.key === '7') { changeViewMode('hybrid');    e.preventDefault(); return; }
      if (e.key === '/') {
        searchInputRef.current?.focus();
        e.preventDefault();
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showLiveSheet, selectedContactId, selectedMeetingId, selectedCircleId, showAddLocationPicker, changeViewMode]);

  if (loadError) {
    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center h-full gap-3 text-sm ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} aria-hidden="true" />
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
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center justify-center h-full gap-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
      >
        <MapPinned size={32} className="text-rose-500 motion-safe:animate-pulse" aria-hidden="true" />
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
    <div className={`pulse-map-section flex flex-col w-full h-full rounded-xl overflow-hidden border ${
      isDarkMode ? 'border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]' : 'border-gray-200 shadow-sm'
    }`}>
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
        /* WCAG 2.2 SC 2.4.11 — keep focused controls clear of the sticky
           lens row + AI strip above and the FAB / chip below. ~96px tops
           covers both bars at their tallest; 80px bottom clears ImAtFAB. */
        .pulse-map-section :focus-visible {
          scroll-margin-top: 96px;
          scroll-margin-bottom: 80px;
        }
      `}</style>

      {/* SR-only live region — announces lens / view-mode swaps and marker
          count for keyboard and screen-reader users. Empty on mount so the
          initial render doesn't fire an announcement. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      {/* Lens row — the section's identity. TODAY is default and most-built;
          ATLAS demotes the old address-book-on-a-map to a tertiary lens.
          View toggle (right) flips base tiles (4=Map, 5=Sat, 6=Terr, 7=Hyb).
          The two groups share styling so they read as siblings, not strangers. */}
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${
          isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-gray-200'
        }`}
      >
        <div
          role="group"
          aria-label="Map lens"
          className="flex items-center gap-1"
        >
          {LENS_OPTIONS.map(({ id, label, Icon }) => {
            const active = lens === id;
            const hotkey = id === 'today' ? '1' : id === 'week' ? '2' : '3';
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-keyshortcuts={hotkey}
                onClick={() => setLens(id)}
                title={`${label} lens — press ${hotkey}`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                  active
                    ? `text-rose-500 ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'}`
                    : `${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Icon size={11} aria-hidden="true" />
                <span>{label}</span>
                <kbd
                  aria-hidden="true"
                  className={`ml-0.5 px-1 rounded text-[9px] leading-none font-normal ${
                    active
                      ? isDarkMode ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-600'
                      : isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {hotkey}
                </kbd>
              </button>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="Map view mode"
          className={`flex items-center gap-0.5 rounded-md p-0.5 ${
            isDarkMode ? 'bg-white/[0.03]' : 'bg-gray-50'
          }`}
        >
          {MAP_VIEW_OPTIONS.map(({ id, label, Icon, hotkey }) => {
            const active = viewMode === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-keyshortcuts={hotkey}
                aria-label={`${label} view`}
                onClick={() => changeViewMode(id)}
                title={`${label} view — press ${hotkey}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                  active
                    ? `text-rose-500 ${isDarkMode ? 'bg-rose-500/10' : 'bg-white shadow-sm'}`
                    : `${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-white/60'}`
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Icon size={11} aria-hidden="true" />
                <span className="hidden sm:inline" aria-hidden="true">{label}</span>
                <kbd
                  aria-hidden="true"
                  className={`ml-0.5 px-1 rounded text-[9px] leading-none font-normal ${
                    active
                      ? isDarkMode ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-600'
                      : isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {hotkey}
                </kbd>
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
      <div className="relative flex-1 overflow-hidden">
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
          mapTypeId={viewMode}
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
              // Force a re-run: clear the in-flight cache and trigger the
              // useContactGeocoding effect by handing it a fresh array ref.
              resetContactGeocoding();
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
            <span className="relative inline-flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500/70 motion-safe:animate-ping" />
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

export default PulseMapView;

// Named exports for E2E test harnesses (e2e/harness/MapTestHarness.tsx).
// These components are otherwise internal — exporting them avoids the harness
// having to recreate dialog/reorder UI to test focus management and a11y.
export { AiStrip, LiveBroadcastSheet };
export type { AiState, AcceptedRoute };

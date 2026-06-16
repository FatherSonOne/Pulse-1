import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { AlertTriangle, MapPinned, Radar, Users } from 'lucide-react';
import { AppView, CalendarEvent, Contact } from '../../types';
import { ContactCircle } from '../../types/contactCircleTypes';
import { Place } from '../../types/placeTypes';
import { getMapOptions } from '../../services/mapService';
import { UserLocation, getActiveBroadcastRecipientIds, listUserPlaces } from '../../services/locationService';
import MapFilterAccessories, { MapFilter, MapFilterControls } from './MapFilterBar';
import MapContactMarker, { MapContactMarkerBody } from './contacts/MapContactMarker';
import MapRadiusRings from './contacts/MapRadiusRings';
import MapContactPanel from './contacts/MapContactPanel';
import MapCircleOverlay from './contacts/MapCircleOverlay';
import MapMeetingMarker, { MapMeetingMarkerBody } from './contacts/MapMeetingMarker';
import LocationEditModal from './contacts/LocationEditModal';
import ImAtFAB from './sub/ImAtFAB';
import {
  DAY_MS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  type MapLens,
  type MapHorizon,
} from './sub/mapLens';
import { AiStrip } from './sub/AiStrip';
import { LensEmptyState } from './sub/LensEmptyState';
import { LiveBroadcastSheet } from './sub/LiveBroadcastSheet';
import { LiveTeamDrawer } from './horizon/LiveTeamDrawer';
import BroadcastRecipientPicker from './sub/BroadcastRecipientPicker';
import { useBroadcastControl } from './horizon/useBroadcastControl';
import { GeofencesDrawer } from './horizon/GeofencesDrawer';
import { MapLibreGeofenceRings } from './provider/MapLibreGeofenceRings';
import { ContactLocationPickerOverlay } from './sub/ContactLocationPickerOverlay';
import { useGeoRelevanceSignals, lensIncludesContact } from './hooks/useGeoRelevanceSignals';
import { useContactCircles } from './hooks/useContactCircles';
import { useMeetingMarkers } from './hooks/useMeetingMarkers';
import { useCalendarTravelBuffers } from '../../hooks/useCalendarTravelBuffers';
import { useVisitedStops } from './hooks/useVisitedStops';
import { useUserPosition } from './hooks/useUserPosition';
import { useContactGeocoding } from './hooks/useContactGeocoding';
import { useLivePresence } from './hooks/useLivePresence';
import { useMapAiProposals } from './hooks/useMapAiProposals';
import { useMapViewMode } from './hooks/useMapViewMode';
import { useMapBaseStyle } from './hooks/useMapBaseStyle';
import { useGoogleMapsLoader } from './hooks/useGoogleMapsLoader';
import { useSrAnnouncer } from './hooks/useSrAnnouncer';
import { useFitBounds } from './hooks/useFitBounds';
import { createGoogleMapAdapter } from './provider/googleAdapter';
import { createMapLibreAdapter } from './provider/maplibreAdapter';
import { useMapLibreRenderer } from './provider/useMapLibreRenderer';
import { useFeatures } from '../../contexts/FeatureContext';
import { MapLibreAcceptedRoute } from './provider/MapLibreAcceptedRoute';
import { MapLibreAtlasTerritories } from './provider/MapLibreAtlasTerritories';
import { MapLibreAtlasHalos } from './provider/MapLibreAtlasHalos';
import { MapLibreCircleOverlays } from './provider/MapLibreCircleOverlays';
import { MapMarkerPortal } from './provider/MapMarkerPortal';
import { MapLibreRadiusRings } from './provider/MapLibreRadiusRings';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useMapKeyboardShortcuts } from './hooks/useMapKeyboardShortcuts';
import { useMarkerOffsets, type OffsetableMarker } from './hooks/useMarkerOffsets';
import { useMarkerClusters, type ClusterCentroid } from './hooks/useMarkerClusters';
import { useSpiderAnimation } from './hooks/useSpiderAnimation';
import { MapLensRow } from './sub/MapLensRow';
import { HorizonScrubber } from './horizon/HorizonScrubber';
import { MapViewPicker } from './sub/MapViewPicker';
import { BaseStyleSwitch } from './horizon/BaseStyleSwitch';
import MapClusterMarker, { MapClusterMarkerBody } from './sub/MapClusterMarker';
import SpiderLines, { SpiderLinesBody } from './sub/SpiderLines';
import { computeMarkerLayout } from './sub/markerLayout';
import { AtlasHalos } from './overlays/AtlasHalos';
import { AtlasTerritories } from './overlays/AtlasTerritories';
import { AcceptedRoutePolyline } from './overlays/AcceptedRoutePolyline';

// Lazy so maplibre-gl only loads when the MapLibre renderer flag is ON —
// keeps it out of the default Google-path bundle entirely. (P1c spike.)
const MapLibreCanvas = React.lazy(() =>
  import('./provider/MapLibreCanvas').then(m => ({ default: m.MapLibreCanvas })),
);

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
  circles: circlesProp,
  isDarkMode,
  userId,
  onContactAction,
  onContactUpdated,
  todayEvents: todayEventsProp,
  weekEvents: weekEventsProp,
  recentMessageContactIds: recentMessageContactIdsProp,
}) => {
  // Legacy lens (OFF path — the TODAY/WEEK/ATLAS tabs). Under Horizon the derived
  // `lens` below replaces it; this state only drives the legacy MapLensRow.
  const [legacyLens, setLegacyLens] = useState<MapLens>('today');
  // Direction D (Horizon, P5) — the scrubber's time detent + the orthogonal Atlas
  // boolean. Independent of legacyLens; only consumed when mapHorizonOn.
  const [horizon, setHorizon] = useState<MapHorizon>('today');
  const [atlasMode, setAtlasMode] = useState(false);
  const [showLiveSheet, setShowLiveSheet] = useState(false);
  const { viewMode, changeViewMode } = useMapViewMode();
  const { isLoaded, loadError } = useGoogleMapsLoader();
  // MapLibre renderer (P1c spike) — flag-gated; default OFF → Google path.
  const mapLibreOn = useMapLibreRenderer();
  // Direction D (Horizon) — the new UX is renderer-coupled, so it activates only
  // when mapHorizon AND the MapLibre renderer are both on. When off, every Horizon
  // surface below falls back to the legacy control (P3: BaseStyleSwitch ↔ MapViewPicker).
  const { features } = useFeatures();
  const mapHorizonOn = features.mapHorizon && mapLibreOn;
  // F0 (Tier-3 §8B) — Floating Chrome rebuild. Double-gated on mapHorizonOn so it
  // only activates on the MapLibre Horizon branch; OFF keeps the banded Horizon
  // byte-identical. When ON, the top-chrome bands are suppressed and the chrome
  // re-renders as absolute floating islands over the full-bleed map.
  const mapHorizonFloat = features.mapHorizonFloat && mapHorizonOn;
  const { baseStyle, density, changeBaseStyle, changeDensity } = useMapBaseStyle(isDarkMode);

  // The whole existing pipeline keys off a MapLens. Under Horizon we PROJECT the
  // scrubber state onto it (now/today → 'today', 3d/week → 'week', atlasMode →
  // 'atlas') so every downstream consumer (AI proposal kind, meeting markers,
  // atlas-render branches, SR announcer, empty state) is untouched. The marker-
  // window predicate gets the PRECISE horizon instead (markerLens) — only
  // lensIncludesContact distinguishes now/3d (P1). OFF path: both are the legacy lens.
  const lens: MapLens = mapHorizonOn
    ? (atlasMode ? 'atlas' : horizon === 'now' || horizon === 'today' ? 'today' : 'week')
    : legacyLens;
  const markerLens: MapLens | MapHorizon = mapHorizonOn
    ? (atlasMode ? 'atlas' : horizon)
    : legacyLens;

  // Circle source. App.tsx mounts us with circles={[]}; self-fetch the user's
  // circles when the prop is empty so the Atlas territories / filter chips /
  // circle overlays aren't starved. Prop wins when a parent supplies it.
  const circles = useContactCircles(circlesProp, userId);

  const mapRef = useRef<google.maps.Map | null>(null);
  // MapLibre map instance (set on its 'load' event); stays null on the Google path.
  const mapLibreRef = useRef<MaplibreMap | null>(null);
  const [mapLibreReady, setMapLibreReady] = useState(false);
  // Bumped each time MapLibreCanvas swaps the style for a theme flip. setStyle()
  // clears ALL sources/layers, so the overlay layer-managers (route, atlas,
  // rings, circles) are re-keyed on this to re-add themselves onto the new
  // style. The projected-DOM markers (MapMarkerPortal) survive a swap untouched
  // and are deliberately NOT keyed on it.
  const [styleEpoch, setStyleEpoch] = useState(0);
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
  // Tracked zoom for the cluster hook. null until onLoad fires; the hook
  // treats null as "render normally" so first paint isn't blocked.
  const [zoom, setZoom] = useState<number | null>(null);

  const { userPosition, geoBlocked } = useUserPosition();
  const liveLocations = useLivePresence(localContacts);
  // Single owner of the live-location broadcast state machine (P8). Lives here
  // (always mounted) so the filter-bar pill and the LiveTeamDrawer drive ONE
  // broadcast and it persists while panels open/close. Instantiating it inside
  // either child would double the keyboard listener + start/stop effect.
  const broadcast = useBroadcastControl(userId);

  // Geofences (P9, Horizon-only). geofencedPlaces drives BOTH the ring overlay
  // and the drawer list, kept in sync by refetching after a drawer edit. Fetched
  // only under Horizon so the OFF path makes no extra query.
  const [showGeofences, setShowGeofences] = useState(false);
  const [geofenceRingsVisible, setGeofenceRingsVisible] = useState(true);
  const [geofencedPlaces, setGeofencedPlaces] = useState<Place[]>([]);
  const refreshGeofencedPlaces = useCallback(async () => {
    const all = await listUserPlaces();
    setGeofencedPlaces(all.filter(p => p.geofenceRadiusM != null));
  }, []);
  useEffect(() => {
    if (mapHorizonOn) void refreshGeofencedPlaces();
  }, [mapHorizonOn, refreshGeofencedPlaces]);
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
  // Travel-buffer warnings for today's geo-anchored agenda — keyed by the
  // arriving event id so a meeting marker can flag a tight/late connection
  // from the previous located event. Content-fingerprinted internally, so a
  // new todayEvents reference doesn't re-fetch.
  const travelBuffers = useCalendarTravelBuffers(geoSignals.todayEvents);
  const { resetRequested: resetContactGeocoding } = useContactGeocoding(localContacts, setLocalContacts);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    const z = map.getZoom();
    if (typeof z === 'number') setZoom(z);
  }, []);

  // MapLibre map ready (P1c) — stash the instance and flip ready so useFitBounds
  // re-runs and frames the camera against the freshly mounted MapLibre map.
  const handleMapLibreReady = useCallback((map: MaplibreMap) => {
    mapLibreRef.current = map;
    const z = map.getZoom();
    if (typeof z === 'number') setZoom(z);
    setMapLibreReady(true);
  }, []);

  // A theme-driven setStyle() in MapLibreCanvas wiped every overlay source/layer
  // off the new style — bump the epoch so the layer-managers below re-mount and
  // re-add onto it.
  const handleStyleSwapped = useCallback(() => setStyleEpoch(e => e + 1), []);

  // Zoom-change handler — gates cluster vs spiderfy vs normal regimes inside
  // useMarkerClusters. The event fires without a payload so we re-read.
  const onZoomChanged = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom();
    if (typeof z === 'number') setZoom(z);
  }, []);

  const visibleMarkers = useMemo<MarkerData[]>(() => {
    const q = filter.searchQuery.toLowerCase();
    const now = Date.now();
    return localContacts.flatMap(c => {
      if (q && !c.name.toLowerCase().includes(q)) return [];
      if (!lensIncludesContact(c, markerLens, now, geoSignals)) return [];
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
    // geoSignals drives lensIncludesContact — without it in deps, TODAY/WEEK
    // membership would not recompute after the async self-fetch resolves real
    // calendar/message signals (the prior staleness bug).
  }, [localContacts, filter, circles, markerLens, geoSignals]);

  const srAnnouncement = useSrAnnouncer(markerLens, visibleMarkers.length, viewMode);

  // Renderer-agnostic camera adapters (P1a/P1c). Both are stable — each reads
  // its own map ref lazily, so a single instance keeps working once the map
  // loads. The active one is picked by the renderer flag.
  const mapCamera = useMemo(() => createGoogleMapAdapter(() => mapRef.current), []);
  const mapLibreCamera = useMemo(() => createMapLibreAdapter(() => mapLibreRef.current), []);
  const activeCamera = mapLibreOn ? mapLibreCamera : mapCamera;
  // "Ready" = the ACTIVE renderer's map is mounted: Google → JS API loaded
  // (mapRef set in onMapLoad); MapLibre → its 'load' fired (mapLibreReady).
  const cameraReady = mapLibreOn ? mapLibreReady : isLoaded;
  useFitBounds(activeCamera, cameraReady, visibleMarkers, meetingMarkers, userPosition);

  // Direction D (P4) — AI "focus / jump" affordances on previously-dead fields.
  // focusId (AtlasProposal): select + pan to a contact, or select a circle.
  const handleFocusEntity = useCallback((id: string) => {
    const c = localContacts.find(x => x.id === id);
    if (c) {
      setSelectedCircleId(null);
      setSelectedContactId(id);
      const lat = c.homeLat ?? c.workLat ?? null;
      const lng = c.homeLng ?? c.workLng ?? null;
      if (lat != null && lng != null) activeCamera?.panTo({ lat, lng });
      return;
    }
    if (circles.some(x => x.id === id)) {
      setSelectedContactId(null);
      setSelectedCircleId(id);
    }
  }, [localContacts, circles, activeCamera]);

  // focusDate (WeekProposal, YYYY-MM-DD): narrow the scrubber toward that day —
  // today / within 3 days / else the week. No-op on the legacy path (only wired
  // into AiStrip when mapHorizonOn). 'now' (3h) is never a whole-day target.
  const handleJumpToDate = useCallback((iso: string) => {
    const target = new Date(`${iso}T00:00:00`).getTime();
    if (Number.isNaN(target)) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const days = Math.round((target - startOfToday.getTime()) / DAY_MS);
    setHorizon(days <= 0 ? 'today' : days <= 3 ? '3d' : 'week');
  }, []);

  // MapLibre cluster-disc click — mirrors handleClusterClick but drives the
  // MapLibre camera adapter (the Google handleClusterClick uses google.maps).
  const handleClusterClickML = useCallback((cluster: ClusterCentroid) => {
    if (
      cluster.bounds.north === cluster.bounds.south &&
      cluster.bounds.east === cluster.bounds.west
    ) {
      mapLibreCamera.panTo({ lat: cluster.lat, lng: cluster.lng });
      const z = mapLibreCamera.getZoom() ?? 14;
      mapLibreCamera.setZoom(Math.min(z + 2, 18));
      return;
    }
    mapLibreCamera.fitBounds(
      [
        { lat: cluster.bounds.south, lng: cluster.bounds.west },
        { lat: cluster.bounds.north, lng: cluster.bounds.east },
      ],
      { top: 80, right: 80, bottom: 120, left: 80 },
    );
  }, [mapLibreCamera]);

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

  // Marker disambiguation — group near-coord markers and assign a per-marker
  // CSS-pixel offset so two contacts pinned at the same office park no
  // longer stack into a single tappable pile. Includes meeting markers so
  // a meeting at the same address as a contact also fans out.
  const offsetableMarkers = useMemo<OffsetableMarker[]>(() => {
    const list: OffsetableMarker[] = visibleMarkers.map(m => ({
      key: markerKey(m.contact.id, m.locType),
      lat: m.lat,
      lng: m.lng,
    }));
    if (lens !== 'atlas') {
      const events = lens === 'today' ? geoSignals.todayEvents : geoSignals.weekEvents;
      for (const mm of meetingMarkers) {
        if (!events.some(e => e.id === mm.event.id)) continue;
        list.push({ key: meetingKey(mm.event.id), lat: mm.lat, lng: mm.lng });
      }
    }
    return list;
  }, [visibleMarkers, meetingMarkers, lens, geoSignals.todayEvents, geoSignals.weekEvents]);

  const markerOffsets = useMarkerOffsets(offsetableMarkers);

  // Cluster + spiderfy layer composing over useMarkerOffsets. Tags every
  // marker key with a mode (normal | cluster-member | spider-anchor |
  // spider-leg) and emits cluster centroids for the disc layer.
  const {
    entries: clusterEntries,
    clusters,
    expandedAnchorKey,
    toggleAnchor,
    collapseAll: collapseSpiders,
  } = useMarkerClusters(offsetableMarkers, zoom, mapRef);

  // Spider expand/contract choreography. Owns the exit-window timing so
  // legs the cluster hook has already retagged 'cluster-member' can still
  // render through their exit animation. exitingKeys gates the unmount
  // short-circuit below.
  const {
    legAnimations,
    activeSpider,
    exitingKeys,
    reducedMotion,
  } = useSpiderAnimation({ clusterEntries, expandedAnchorKey });

  // Anchor position for SpiderLines — resolved from the visibleMarkers
  // (or meetingMarkers) entry matching the active spider's anchor key.
  // Skipped under reduced motion since activeSpider is already null then.
  const spiderAnchorPos = useMemo(() => {
    if (!activeSpider) return null;
    for (const m of visibleMarkers) {
      if (markerKey(m.contact.id, m.locType) === activeSpider.anchorKey) {
        return { lat: m.lat, lng: m.lng };
      }
    }
    for (const mm of meetingMarkers) {
      if (meetingKey(mm.event.id) === activeSpider.anchorKey) {
        return { lat: mm.lat, lng: mm.lng };
      }
    }
    return null;
  }, [activeSpider, visibleMarkers, meetingMarkers]);

  // Stable dispatchers — passed to every marker so React.memo can skip
  // re-render when nothing else changed. The handlers read live state via
  // a ref so they themselves never need new identities. Without this, the
  // memo wraps on the marker components are defeated by inline closures
  // (every PulseMapView render would create a new onClick per marker and
  // every marker would re-render anyway — 500 wasted reconciliations).
  const clusterEntriesRef = useRef(clusterEntries);
  useEffect(() => { clusterEntriesRef.current = clusterEntries; }, [clusterEntries]);

  const handleContactSelect = useCallback((contactId: string, locType: 'home' | 'work') => {
    const key = `${contactId}-${locType}`;
    const cluster = clusterEntriesRef.current.get(key);
    if (cluster?.mode === 'spider-anchor' && cluster.anchorBucketKey) {
      toggleAnchor(cluster.anchorBucketKey);
      return;
    }
    setSelectedContactId(contactId);
    setSelectedLocType(locType);
    setSelectedMeetingId(null);
  }, [toggleAnchor]);

  const handleMeetingSelect = useCallback((eventId: string) => {
    const key = `meeting-${eventId}`;
    const cluster = clusterEntriesRef.current.get(key);
    if (cluster?.mode === 'spider-anchor' && cluster.anchorBucketKey) {
      toggleAnchor(cluster.anchorBucketKey);
      return;
    }
    setSelectedMeetingId(prev => (prev === eventId ? null : eventId));
    setSelectedContactId(null);
  }, [toggleAnchor]);

  // Cluster-disc click → zoom to the cluster's bbox. Same-point clusters
  // (bounds collapsed to a coord) get a controlled +2 zoom step so
  // spiderfy at zoom ≥17 takes over without the "fitBounds to a
  // zero-area rect" snap.
  const handleClusterClick = useCallback((cluster: ClusterCentroid) => {
    const map = mapRef.current;
    if (!map) return;
    if (cluster.bounds.north === cluster.bounds.south &&
        cluster.bounds.east === cluster.bounds.west) {
      map.panTo({ lat: cluster.lat, lng: cluster.lng });
      const z = map.getZoom() ?? 14;
      map.setZoom(Math.min(z + 2, 18));
      return;
    }
    const bounds = new google.maps.LatLngBounds(
      { lat: cluster.bounds.south, lng: cluster.bounds.west },
      { lat: cluster.bounds.north, lng: cluster.bounds.east },
    );
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, []);

  // AI proposal FSM + accept/reorder/dismiss/open-in-maps handlers all live
  // in useMapAiProposals. The hook owns aiState, acceptedRoute, and
  // acceptingRoute; the strip prop wiring below stays prop-for-prop identical
  // to the prior inline implementation.
  const {
    aiState,
    acceptedRoute,
    acceptingRoute,
    reorderableStops,
    handleAcceptRoute,
    handleDismissRoute,
    handleStartReorder,
    handleReorderChange,
    handleReorderCancel,
    handleOpenInSystemMaps,
  } = useMapAiProposals({
    isLoaded,
    lens,
    allStops,
    userPosition,
    circles,
    visitedStopIds,
    visibleMarkers,
  });

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

  useMapKeyboardShortcuts({
    setLens: setLegacyLens,
    changeViewMode,
    mapHorizonOn,
    setHorizon,
    toggleAtlasMode: () => setAtlasMode(a => !a),
    searchInputRef,
    showLiveSheet,
    setShowLiveSheet,
    selectedContactId,
    setSelectedContactId,
    selectedMeetingId,
    setSelectedMeetingId,
    selectedCircleId,
    setSelectedCircleId,
    showAddLocationPicker,
    setShowAddLocationPicker,
  });

  if (loadError && !mapLibreOn) {
    return (
      <div
        role="alert"
        className={`flex flex-col items-center justify-center h-full gap-3 text-sm ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} aria-hidden="true" />
          Map offline. Check the API key in Settings → Integrations.
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

  if (!isLoaded && !mapLibreOn) {
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
        /* ─── Spider expand/contract animation ────────────────────────
           The leg wrapper carries a transform:translate from
           useMarkerOffsets — we layer scale + opacity via a separate
           animation keyed off a CSS variable so the existing transition
           keeps working. backwards/forwards fill modes let the leg
           start hidden before --spider-delay completes (entering) and
           stay hidden after the exit animation finishes (exiting)
           while the parent waits to unmount. */
        @keyframes spider-leg-in {
          from { opacity: 0; scale: 0.6; }
          to   { opacity: 1; scale: 1; }
        }
        @keyframes spider-leg-out {
          from { opacity: 1; scale: 1; }
          to   { opacity: 0; scale: 0.6; }
        }
        .spider-leg-enter {
          animation: spider-leg-in 220ms cubic-bezier(0.16, 1, 0.3, 1)
                     var(--spider-delay, 0ms) backwards;
        }
        .spider-leg-exit {
          animation: spider-leg-out 180ms cubic-bezier(0.16, 1, 0.3, 1)
                     var(--spider-delay, 0ms) forwards;
        }
        /* Reduced-motion path: 100ms opacity-only fade, no stagger.
           The marker's wrapper still applies these classes; useSpider-
           Animation just emits delayMs: 0 so all legs animate together. */
        @keyframes spider-leg-fade-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spider-leg-fade-out { from { opacity: 1; } to { opacity: 0; } }
        .spider-leg-fade-in  { animation: spider-leg-fade-in  100ms linear backwards; }
        .spider-leg-fade-out { animation: spider-leg-fade-out 100ms linear forwards; }
        @media (prefers-reduced-motion: reduce) {
          .spider-leg-enter { animation: spider-leg-fade-in  100ms linear backwards; }
          .spider-leg-exit  { animation: spider-leg-fade-out 100ms linear forwards; }
        }
        /* WCAG 2.2 SC 2.4.11 — keep focused controls clear of the sticky
           chrome above and the FAB / chips below. After the distill pass
           the chrome collapsed to a single 40px lens-row + optional 32px
           accessory row + optional 40px AI strip — ~112px tops with all
           three present. Bottom must clear ImAtFAB (~64px) + the view
           picker stacked above it (~96px). */
        .pulse-map-section :focus-visible {
          scroll-margin-top: 112px;
          scroll-margin-bottom: 96px;
        }
      `}</style>

      {/* SR-only live region — announces lens / view-mode swaps and marker
          count for keyboard and screen-reader users. Empty on mount so the
          initial render doesn't fire an announcement. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      {/* Chrome — lens triad (left) + inline filter controls (right) share a
          single 40px band. View-mode picker lives as a floating chip at the
          map's bottom-right (see MapViewPicker below). The geo-blocked
          banner and circle filter chips appear as accessory rows beneath
          when they have something to say. */}
      {/* Chrome band: under Horizon the scrubber + Atlas-mode toggle replace the
          TODAY/WEEK/ATLAS tabs (same band, same right slot); the legacy MapLensRow
          stays for the OFF path. Additive — no deletion.
          F0 (mapHorizonFloat): the whole top-chrome band stack (scrubber +
          accessories + AI strip) is suppressed under the floating-chrome rebuild;
          those surfaces re-appear as absolute floating islands over the full-bleed
          map (see the floating-chrome layer inside the map wrapper below). */}
      {!mapHorizonFloat && (
      <>
      {mapHorizonOn ? (
        <HorizonScrubber
          horizon={horizon}
          onHorizonChange={setHorizon}
          atlasMode={atlasMode}
          onAtlasModeChange={setAtlasMode}
          isDarkMode={isDarkMode}
          right={
            <MapFilterControls
              filter={filter}
              isDarkMode={isDarkMode}
              onFilterChange={setFilter}
              searchInputRef={searchInputRef}
              neutralChrome={mapHorizonOn}
              broadcast={broadcast}
              onOpenLiveDrawer={() => setShowLiveSheet(true)}
            />
          }
        />
      ) : (
        <MapLensRow
          lens={legacyLens}
          isDarkMode={isDarkMode}
          onLensChange={setLegacyLens}
          right={
            <MapFilterControls
              filter={filter}
              isDarkMode={isDarkMode}
              onFilterChange={setFilter}
              searchInputRef={searchInputRef}
              neutralChrome={mapHorizonOn}
              broadcast={broadcast}
            />
          }
        />
      )}
      <MapFilterAccessories
        filter={filter}
        circles={circles}
        isDarkMode={isDarkMode}
        onFilterChange={setFilter}
        geoBlocked={geoBlocked && !geoBannerDismissed}
        onDismissGeoBanner={dismissGeoBanner}
        neutralChrome={mapHorizonOn}
      />

      {/* AI strip — driven by aiState + acceptedRoute. Committed-coral band
          is the one place coral exceeds the ≤10% rule on this surface,
          accepted in the shape brief. */}
      {(lens !== 'atlas' || atlasHasAnyPinned) && !hasNoLocations && (
        <AiStrip
          lens={lens}
          horizon={mapHorizonOn ? horizon : undefined}
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
          onFocusEntity={mapHorizonOn ? handleFocusEntity : undefined}
          onJumpToDate={mapHorizonOn ? handleJumpToDate : undefined}
        />
      )}
      </>
      )}

      {/* Wrapper does NOT remount on lens change — the map camera state is
          expensive to rebuild and Atlas markers vanish off-screen if we
          force a remount. The lens-change fade lives on the AI strip
          + empty-state card instead, where it carries actual signal. */}
      <div className="relative flex-1 overflow-hidden">
        {mapLibreOn ? (
          <>
          {/* P1c — bare MapLibre canvas. P2 (geometry) — accepted-route line.
             Markers/anchors + Coral styling still pending (P2-anchor / P3). */}
          <React.Suspense fallback={<div className="w-full h-full" />}>
            <MapLibreCanvas
              center={userPosition ?? DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              isDarkMode={isDarkMode}
              baseStyle={mapHorizonOn ? baseStyle : undefined}
              density={mapHorizonOn ? density : undefined}
              className="w-full h-full"
              onReady={handleMapLibreReady}
              onStyleSwapped={handleStyleSwapped}
              onZoomChanged={setZoom}
              onClick={() => {
                setSelectedContactId(null);
                setSelectedCircleId(null);
                setSelectedMeetingId(null);
                collapseSpiders();
              }}
            />
          </React.Suspense>
          {/* Layer-manager overlays are keyed on styleEpoch: a theme-driven
              setStyle() clears their sources/layers off the new style, so the
              epoch bump re-mounts them to re-add. (Portal markers below survive
              a swap and are NOT keyed.) */}
          {userPosition && mapLibreReady && (
            <MapLibreRadiusRings key={`rings-${styleEpoch}`} map={mapLibreRef.current} center={userPosition} isDarkMode={isDarkMode} />
          )}
          {/* P9 — all-geofences ring overlay (lens-independent; flag + drawer
              visibility toggle gate it). Real place geometry — renders whether or
              not Live detection is running. */}
          {mapHorizonOn && mapLibreReady && geofenceRingsVisible && geofencedPlaces.length > 0 && (
            <MapLibreGeofenceRings
              key={`geofences-${styleEpoch}`}
              map={mapLibreRef.current}
              places={geofencedPlaces.map(p => ({
                id: p.id, lat: p.lat, lng: p.lng, geofenceRadiusM: p.geofenceRadiusM ?? 0, name: p.name,
              }))}
            />
          )}
          {acceptedRoute && mapLibreReady && (
            <MapLibreAcceptedRoute
              key={`route-${styleEpoch}`}
              map={mapLibreRef.current}
              path={acceptedRoute.path}
              onClick={handleOpenInSystemMaps}
            />
          )}
          {/* Atlas-only geometry — halos under territories (matches Google
              zIndex 0 < 1). Markers/anchors still pending (P2-anchor). */}
          {lens === 'atlas' && mapLibreReady && (
            <>
              <MapLibreAtlasHalos key={`halos-${styleEpoch}`} map={mapLibreRef.current} contacts={localContacts} />
              <MapLibreAtlasTerritories
                key={`territories-${styleEpoch}`}
                map={mapLibreRef.current}
                circles={circles}
                contacts={localContacts}
                selectedCircleId={selectedCircleId}
                onSelectCircle={setSelectedCircleId}
              />
              <MapLibreCircleOverlays
                key={`circles-${styleEpoch}`}
                map={mapLibreRef.current}
                circles={circles}
                contacts={localContacts}
                selectedCircleId={selectedCircleId}
                onSelectCircle={setSelectedCircleId}
                isDarkMode={isDarkMode}
              />
            </>
          )}
          {/* P2 anchor proof — contact markers via projected portal (MapMarkerPortal
              + the shared MapContactMarkerBody). Clustering / spiderfy / offsets /
              meeting markers still pending (they need the projection port); each
              visible contact renders individually here. */}
          {mapLibreReady && visibleMarkers.map(({ contact, locType, lat, lng }) => {
            const key = markerKey(contact.id, locType);
            const layout = computeMarkerLayout(key, clusterEntries, exitingKeys, legAnimations, markerOffsets);
            if (layout.hidden) return null;
            const live = liveLocations.get(contact.id);
            const isLiveSharing = !!live && live.isSharing;
            const seqIdx = acceptedRoute ? acceptedRoute.orderedMarkerKeys.indexOf(key) : -1;
            return (
              <MapMarkerPortal
                key={key}
                map={mapLibreRef.current}
                lat={isLiveSharing && live ? live.lat : lat}
                lng={isLiveSharing && live ? live.lng : lng}
              >
                <MapContactMarkerBody
                  contact={contact}
                  locationType={locType}
                  isSelected={selectedContactId === contact.id && selectedLocType === locType}
                  isLive={isLiveSharing}
                  onClick={handleContactSelect}
                  sequenceNumber={seqIdx >= 0 ? seqIdx + 1 : undefined}
                  offsetX={layout.offsetX}
                  offsetY={layout.offsetY}
                  showLabel={layout.showLabel}
                  mode={layout.mode}
                  animationPhase={layout.animationPhase}
                  animationDelayMs={layout.animationDelayMs}
                  reducedMotion={reducedMotion}
                />
              </MapMarkerPortal>
            );
          })}
          {/* Meeting markers via the same projected portal — TODAY/WEEK only,
              filtered to located events of the active lens (mirrors Google). */}
          {mapLibreReady && lens !== 'atlas' && meetingMarkers
            .filter(mm => (lens === 'today' ? geoSignals.todayEvents : geoSignals.weekEvents)
              .some(e => e.id === mm.event.id))
            .map(mm => {
              const key = meetingKey(mm.event.id);
              const layout = computeMarkerLayout(key, clusterEntries, exitingKeys, legAnimations, markerOffsets);
              if (layout.hidden) return null;
              const seqIdx = acceptedRoute ? acceptedRoute.orderedMarkerKeys.indexOf(key) : -1;
              return (
                <MapMarkerPortal key={key} map={mapLibreRef.current} lat={mm.lat} lng={mm.lng}>
                  <MapMeetingMarkerBody
                    event={mm.event}
                    isSelected={selectedMeetingId === mm.event.id}
                    onClick={handleMeetingSelect}
                    travelBuffer={lens === 'today' ? travelBuffers.get(mm.event.id) : undefined}
                    sequenceNumber={seqIdx >= 0 ? seqIdx + 1 : undefined}
                    offsetX={layout.offsetX}
                    offsetY={layout.offsetY}
                    showLabel={layout.showLabel}
                    mode={layout.mode}
                    animationPhase={layout.animationPhase}
                    animationDelayMs={layout.animationDelayMs}
                    reducedMotion={reducedMotion}
                  />
                </MapMarkerPortal>
              );
            })}
          {/* Cluster discs (zoom <= 15). Click zooms the MapLibre camera to the
              cluster's bbox. */}
          {mapLibreReady && clusters.map(cluster => (
            <MapMarkerPortal key={cluster.id} map={mapLibreRef.current} lat={cluster.lat} lng={cluster.lng}>
              <MapClusterMarkerBody cluster={cluster} onClick={handleClusterClickML} />
            </MapMarkerPortal>
          ))}
          {/* Spider tether lines (zoom >= 17, expanded group). */}
          {mapLibreReady && activeSpider && spiderAnchorPos && (
            <MapMarkerPortal map={mapLibreRef.current} lat={spiderAnchorPos.lat} lng={spiderAnchorPos.lng}>
              <SpiderLinesBody spider={activeSpider} />
            </MapMarkerPortal>
          )}
          </>
        ) : (
        <GoogleMap
          mapContainerClassName="w-full h-full"
          center={userPosition ?? DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          mapTypeId={viewMode}
          options={getMapOptions(isDarkMode)}
          onLoad={onMapLoad}
          onZoomChanged={onZoomChanged}
          onClick={() => {
            setSelectedContactId(null);
            setSelectedCircleId(null);
            setSelectedMeetingId(null);
            // Map-click also collapses any expanded spider — keeps the
            // dismiss surface consistent with selection clearing.
            collapseSpiders();
          }}
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
            const cluster = clusterEntries.get(key);
            const exitAnim = exitingKeys.has(key) ? legAnimations.get(key) : undefined;
            // 'cluster-member' → represented by a disc / anchor; skip
            // UNLESS the leg is mid-exit, in which case render it
            // through its exit animation before letting it unmount.
            if (cluster?.mode === 'cluster-member' && !exitAnim) return null;

            const seqIdx = acceptedRoute ? acceptedRoute.orderedMarkerKeys.indexOf(key) : -1;
            const baseOffset = markerOffsets.get(key);

            const isSpiderLeg = cluster?.mode === 'spider-leg' || !!exitAnim;
            const isSpiderAnchor = cluster?.mode === 'spider-anchor';
            // Exiting legs render at their last-known offset so the exit
            // animation has a place to fade out from.
            const offX = exitAnim ? exitAnim.offsetX
              : isSpiderLeg ? cluster?.offsetX ?? 0
              : isSpiderAnchor ? 0
              : baseOffset?.offsetX;
            const offY = exitAnim ? exitAnim.offsetY
              : isSpiderLeg ? cluster?.offsetY ?? 0
              : isSpiderAnchor ? 0
              : baseOffset?.offsetY;
            const showLabel = isSpiderLeg ? false : isSpiderAnchor ? true : (baseOffset?.showLabel ?? true);

            const animEntry = legAnimations.get(key);
            const animationPhase = animEntry?.phase;
            const animationDelayMs = animEntry?.delayMs ?? 0;

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
                onClick={handleContactSelect}
                sequenceNumber={seqIdx >= 0 ? seqIdx + 1 : undefined}
                offsetX={offX}
                offsetY={offY}
                showLabel={showLabel}
                mode={isSpiderLeg ? 'spider-leg' : 'normal'}
                animationPhase={animationPhase}
                animationDelayMs={animationDelayMs}
                reducedMotion={reducedMotion}
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
              const cluster = clusterEntries.get(key);
              const exitAnim = exitingKeys.has(key) ? legAnimations.get(key) : undefined;
              if (cluster?.mode === 'cluster-member' && !exitAnim) return null;

              const seqIdx = acceptedRoute ? acceptedRoute.orderedMarkerKeys.indexOf(key) : -1;
              const baseOffset = markerOffsets.get(key);
              const isSpiderLeg = cluster?.mode === 'spider-leg' || !!exitAnim;
              const isSpiderAnchor = cluster?.mode === 'spider-anchor';
              const offX = exitAnim ? exitAnim.offsetX
                : isSpiderLeg ? cluster?.offsetX ?? 0
                : isSpiderAnchor ? 0
                : baseOffset?.offsetX;
              const offY = exitAnim ? exitAnim.offsetY
                : isSpiderLeg ? cluster?.offsetY ?? 0
                : isSpiderAnchor ? 0
                : baseOffset?.offsetY;
              const showLabel = isSpiderLeg ? false : isSpiderAnchor ? true : (baseOffset?.showLabel ?? true);

              const animEntry = legAnimations.get(key);
              const animationPhase = animEntry?.phase;
              const animationDelayMs = animEntry?.delayMs ?? 0;

              return (
                <MapMeetingMarker
                  key={key}
                  event={mm.event}
                  lat={mm.lat}
                  lng={mm.lng}
                  isSelected={selectedMeetingId === mm.event.id}
                  onClick={handleMeetingSelect}
                  travelBuffer={lens === 'today' ? travelBuffers.get(mm.event.id) : undefined}
                  sequenceNumber={seqIdx >= 0 ? seqIdx + 1 : undefined}
                  offsetX={offX}
                  offsetY={offY}
                  showLabel={showLabel}
                  mode={isSpiderLeg ? 'spider-leg' : 'normal'}
                  animationPhase={animationPhase}
                  animationDelayMs={animationDelayMs}
                  reducedMotion={reducedMotion}
                />
              );
            })}

          {/* Cluster discs — drawn after individual markers so the disc
              wins the click target above any sliver of marker that might
              poke through at the same coord. Empty at zoom ≥ 16. */}
          {clusters.map(cluster => (
            <MapClusterMarker
              key={cluster.id}
              cluster={cluster}
              onClick={handleClusterClick}
            />
          ))}

          {/* Spider tether lines — only rendered when a spider is open
              AND prefers-reduced-motion is off. Anchored at the spider's
              centroid; sized to span the leg fan. */}
          {activeSpider && spiderAnchorPos && (
            <SpiderLines
              lat={spiderAnchorPos.lat}
              lng={spiderAnchorPos.lng}
              spider={activeSpider}
            />
          )}

          {acceptedRoute && (
            <AcceptedRoutePolyline path={acceptedRoute.path} onClick={handleOpenInSystemMaps} />
          )}

          {lens === 'atlas' && (
            <AtlasTerritories
              circles={circles}
              contacts={localContacts}
              selectedCircleId={selectedCircleId}
              onSelectCircle={setSelectedCircleId}
            />
          )}

          {lens === 'atlas' && <AtlasHalos contacts={localContacts} />}
        </GoogleMap>
        )}

        {hasNoLocations && (
          <LensEmptyState
            lens={lens}
            isDarkMode={isDarkMode}
            atlasHasAnyPinned={atlasHasAnyPinned}
            hasGeocodingInFlight={contactsWithAddressText.length > 0}
            canAddLocation={contactsWithoutLocations.length > 0}
            onOpenAtlas={() => { if (mapHorizonOn) setAtlasMode(true); else setLegacyLens('atlas'); }}
            onAutoGeocode={() => {
              // Force a re-run: clear the in-flight cache and trigger the
              // useContactGeocoding effect by handing it a fresh array ref.
              resetContactGeocoding();
              setLocalContacts(prev => [...prev]);
            }}
            onPinWhereIAm={() => {
              // Opens the contact picker → LocationEditModal. Note this does
              // NOT prefill current GPS (that needs a deeper LocationEditModal
              // change — tracked as follow-up), so it must not gate on
              // userPosition: doing so made the button a silent no-op whenever
              // GPS was off. Honest behaviour is "always opens the picker".
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

        {/* Base-map control — floats at the map's bottom-right, where Google Maps'
            own zoom + attribution chrome lives, so it reads as "how the map
            renders," not as part of the top navigation. Under Horizon (MapLibre +
            mapHorizon) this is the renderer-real Light/Dark/Contrast + density
            switch; otherwise the legacy Sat/Terr/Hybrid picker stays (it's still
            live on the Google fallback). Additive — no deletion. */}
        {mapHorizonOn ? (
          <BaseStyleSwitch
            baseStyle={baseStyle}
            density={density}
            isDarkMode={isDarkMode}
            onBaseStyleChange={changeBaseStyle}
            onDensityChange={changeDensity}
          />
        ) : (
          <MapViewPicker
            viewMode={viewMode}
            isDarkMode={isDarkMode}
            onViewModeChange={changeViewMode}
          />
        )}

        {/* Geofences entry (Horizon) — bottom-left, above the live/pinned cluster.
            Opens the first-class GeofencesDrawer; always available under Horizon so
            the operator can manage geofences + read the honest detection note even
            with zero live broadcasters. */}
        {mapHorizonOn && (
          <button
            type="button"
            onClick={() => setShowGeofences(true)}
            aria-haspopup="dialog"
            aria-label={`Geofences${geofencedPlaces.length > 0 ? ` — ${geofencedPlaces.length}` : ''}`}
            className={`absolute bottom-14 left-4 px-2.5 py-1 rounded-md text-[10px] tracking-[0.1em] uppercase shadow-md backdrop-blur-sm flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition-colors ${
              isDarkMode ? 'bg-zinc-900/85 text-gray-200 hover:bg-zinc-900 border border-white/10 focus-visible:ring-zinc-400' : 'bg-white/90 text-gray-700 hover:bg-white border border-gray-200 focus-visible:ring-zinc-500'
            }`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Radar size={11} aria-hidden="true" />
            <span>Geofences{geofencedPlaces.length > 0 ? ` · ${geofencedPlaces.length}` : ''}</span>
          </button>
        )}

        {/* Live presence chip — bottom-left. Replaces the old peer-lens
            LiveTeamView entry point. Tap opens the sheet. */}
        {liveBroadcasters.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLiveSheet(true)}
            className={`absolute bottom-4 left-4 px-2.5 py-1 rounded-md text-[10px] tracking-[0.1em] uppercase shadow-md backdrop-blur-sm flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 transition-colors ${
              isDarkMode ? 'bg-zinc-900/85 text-gray-200 hover:bg-zinc-900 border border-white/10' : 'bg-white/90 text-gray-700 hover:bg-white border border-gray-200'
            }`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            aria-label={`${liveBroadcasters.length} broadcasting — open list`}
          >
            <span className="relative inline-flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500/70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <span>{liveBroadcasters.length} live</span>
          </button>
        )}

        {/* Marker count badge — bottom-left when no broadcasters, otherwise
            tucked right of the live chip. Mono uppercase to match the lens
            row + view picker + broadcast pill. */}
        {liveBroadcasters.length === 0 && (
          <div
            className={`absolute bottom-4 left-4 px-2.5 py-1 rounded-md text-[10px] tracking-[0.1em] uppercase shadow-md backdrop-blur-sm flex items-center gap-1.5 ${
              isDarkMode ? 'bg-zinc-900/85 text-gray-300 border border-white/10' : 'bg-white/90 text-gray-600 border border-gray-200'
            }`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Users size={11} className="text-rose-500" aria-hidden="true" />
            {visibleMarkers.length} pinned
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
          mapHorizonOn ? (
            <LiveTeamDrawer
              contacts={localContacts}
              liveLocations={liveLocations}
              isDarkMode={isDarkMode}
              userId={userId}
              broadcast={broadcast}
              onClose={() => setShowLiveSheet(false)}
              onContactAction={onContactAction}
            />
          ) : (
            <LiveBroadcastSheet
              contacts={localContacts}
              liveLocations={liveLocations}
              isDarkMode={isDarkMode}
              onClose={() => setShowLiveSheet(false)}
              onContactAction={onContactAction}
            />
          )
        )}

        {/* Recipient picker — rendered once here (always-mounted host) so both
            the filter-bar pill (OFF path) and the LiveTeamDrawer master switch
            (Horizon path) summon the SAME picker over the shared broadcast
            state. Moved out of MapFilterControls when the state was lifted. */}
        {broadcast.showRecipientPicker && (
          <BroadcastRecipientPicker
            contacts={localContacts}
            initialSelectedUserIds={getActiveBroadcastRecipientIds()}
            isDarkMode={isDarkMode}
            onCancel={() => broadcast.setShowRecipientPicker(false)}
            onConfirm={broadcast.handleRecipientConfirm}
          />
        )}

        {showGeofences && mapHorizonOn && (
          <GeofencesDrawer
            places={geofencedPlaces}
            isDarkMode={isDarkMode}
            isLiveOn={broadcast.liveOn}
            ringsVisible={geofenceRingsVisible}
            onToggleRings={setGeofenceRingsVisible}
            onPlacesChanged={refreshGeofencedPlaces}
            onClose={() => setShowGeofences(false)}
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
export type { AiState, AcceptedRoute } from './sub/aiTypes';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap } from '@react-google-maps/api';
import { AlertTriangle, MapPinned, Users } from 'lucide-react';
import { AppView, CalendarEvent, Contact } from '../../types';
import { ContactCircle } from '../../types/contactCircleTypes';
import { getMapOptions } from '../../services/mapService';
import { UserLocation } from '../../services/locationService';
import MapFilterAccessories, { MapFilter, MapFilterControls } from './MapFilterBar';
import MapContactMarker from './contacts/MapContactMarker';
import MapRadiusRings from './contacts/MapRadiusRings';
import MapContactPanel from './contacts/MapContactPanel';
import MapCircleOverlay from './contacts/MapCircleOverlay';
import MapMeetingMarker from './contacts/MapMeetingMarker';
import LocationEditModal from './contacts/LocationEditModal';
import ImAtFAB from './sub/ImAtFAB';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  type MapLens,
} from './sub/mapLens';
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
import { useMapAiProposals } from './hooks/useMapAiProposals';
import { useMapViewMode } from './hooks/useMapViewMode';
import { useGoogleMapsLoader } from './hooks/useGoogleMapsLoader';
import { useSrAnnouncer } from './hooks/useSrAnnouncer';
import { useFitBounds } from './hooks/useFitBounds';
import { useMapKeyboardShortcuts } from './hooks/useMapKeyboardShortcuts';
import { useMarkerOffsets, type OffsetableMarker } from './hooks/useMarkerOffsets';
import { useMarkerClusters, type ClusterCentroid } from './hooks/useMarkerClusters';
import { useSpiderAnimation } from './hooks/useSpiderAnimation';
import { MapLensRow } from './sub/MapLensRow';
import { MapViewPicker } from './sub/MapViewPicker';
import MapClusterMarker from './sub/MapClusterMarker';
import SpiderLines from './sub/SpiderLines';
import { AtlasHalos } from './overlays/AtlasHalos';
import { AtlasTerritories } from './overlays/AtlasTerritories';
import { AcceptedRoutePolyline } from './overlays/AcceptedRoutePolyline';

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
  const { viewMode, changeViewMode } = useMapViewMode();
  const { isLoaded, loadError } = useGoogleMapsLoader();

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
  // Tracked zoom for the cluster hook. null until onLoad fires; the hook
  // treats null as "render normally" so first paint isn't blocked.
  const [zoom, setZoom] = useState<number | null>(null);

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
    const z = map.getZoom();
    if (typeof z === 'number') setZoom(z);
  }, []);

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

  const srAnnouncement = useSrAnnouncer(lens, visibleMarkers.length, viewMode);
  useFitBounds(mapRef, isLoaded, visibleMarkers, meetingMarkers, userPosition);

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
    setLens,
    changeViewMode,
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

  if (loadError) {
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
        /* ─── Spider expand/contract animation ────────────────────────
           The leg's wrapper carries `transform: translate(...)` from
           useMarkerOffsets — we layer scale + opacity via a separate
           transform on a CSS variable so the existing transition keeps
           working. backwards/forwards fill modes let the leg "start
           hidden" before --spider-delay completes (entering) and "stay
           hidden" after the exit animation finishes (exiting) while
           the parent waits to unmount. */
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
      <MapLensRow
        lens={lens}
        isDarkMode={isDarkMode}
        onLensChange={setLens}
        right={
          <MapFilterControls
            filter={filter}
            isDarkMode={isDarkMode}
            onFilterChange={setFilter}
            userId={userId}
            searchInputRef={searchInputRef}
            contacts={localContacts}
          />
        }
      />
      <MapFilterAccessories
        filter={filter}
        circles={circles}
        isDarkMode={isDarkMode}
        onFilterChange={setFilter}
        geoBlocked={geoBlocked && !geoBannerDismissed}
        onDismissGeoBanner={dismissGeoBanner}
      />

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

        {/* View-mode picker — floats at the map's bottom-right. Lives where
            Google Maps' own zoom + attribution chrome lives, so it reads as
            "how the map renders," not as part of the top navigation. */}
        <MapViewPicker
          viewMode={viewMode}
          isDarkMode={isDarkMode}
          onViewModeChange={changeViewMode}
        />

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
export type { AiState, AcceptedRoute } from './sub/aiTypes';

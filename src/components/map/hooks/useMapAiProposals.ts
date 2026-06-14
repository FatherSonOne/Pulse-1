// ─────────────────────────────────────────────────────────────────────────────
// useMapAiProposals — owns the AI strip's finite-state machine (idle /
// fetching / ready / none / paused / reordering), the accepted-route
// snapshot, and every handler the strip wires into.
//
// Paint-first contract: the map paints stops as soon as Google JS is loaded
// and the marker set is non-empty. The proposal fetch is debounced (300ms),
// AbortController'd, and silently collapses to `none` or `paused` when the
// model returns null or the workspace AI cap kicks in. A ready route can
// transition into `reordering` (a working draft the user mutates via drag /
// keyboard) without losing the original proposal — Cancel reverts to it.
//
// `handleAcceptRoute` is dual-source: it consumes either the fresh
// proposal's orderedIds or the reorder draft, runs them through Google's
// DirectionsService for the polyline + arrival-time math, and flips the
// strip into the Underway state.
//
// Re-runs whenever the inputs the proposal depends on change. Skips when a
// route is already accepted (the strip then renders Underway) or when the
// user is mid-drag (would wipe their draft on every marker filter change).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Contact } from '../../../types';
import type { ContactCircle } from '../../../types/contactCircleTypes';
import {
  getAiPausedUntil,
  proposeAtlasInsight,
  proposeRoute,
  proposeWeekPlan,
} from '../../../services/mapAIService';
import { buildMultiStopDirectionsUrl } from '../../../services/mapDirectionsUrl';
import { DAY_MS, type MapLens } from '../sub/mapLens';
import type { AcceptedRoute, AiState } from '../sub/aiTypes';

export interface AiProposalStop {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface AiProposalContactMarker {
  contact: Contact;
  lat: number;
  lng: number;
}

export interface UseMapAiProposalsInput {
  isLoaded: boolean;
  lens: MapLens;
  allStops: AiProposalStop[];
  userPosition: { lat: number; lng: number } | null;
  circles: ContactCircle[];
  visitedStopIds: Set<string>;
  /** Used to build the Atlas insight snapshot (contact-level details the
   *  prompt needs beyond the unified stop list). */
  visibleMarkers: AiProposalContactMarker[];
}

export interface UseMapAiProposalsResult {
  aiState: AiState;
  acceptedRoute: AcceptedRoute | null;
  acceptingRoute: boolean;
  isReordering: boolean;
  reorderableStops: Array<{ id: string; label: string }>;
  handleAcceptRoute: () => Promise<void>;
  handleDismissRoute: () => void;
  handleStartReorder: () => void;
  handleReorderChange: (nextOrder: string[]) => void;
  handleReorderCancel: () => void;
  handleOpenInSystemMaps: () => void;
}

export function useMapAiProposals(input: UseMapAiProposalsInput): UseMapAiProposalsResult {
  const { isLoaded, lens, allStops, userPosition, circles, visitedStopIds, visibleMarkers } = input;

  const [aiState, setAiState] = useState<AiState>({ status: 'idle' });
  const [acceptedRoute, setAcceptedRoute] = useState<AcceptedRoute | null>(null);
  const [acceptingRoute, setAcceptingRoute] = useState(false);

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
  }, [isLoaded, lens, allStops, userPosition, circles, acceptedRoute, isReordering, visitedStopIds, visibleMarkers]);

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

  // Hand the FULL accepted-route sequence to the OS maps app — closest
  // platform-native affordance to "tap to start" without bundling Apple/Google
  // Maps SDKs. Routes from the operator's GPS (when known) through every stop
  // in order. Previously this opened only the first stop, dropping the rest of
  // the AI-ordered route.
  const handleOpenInSystemMaps = useCallback(() => {
    if (!acceptedRoute) return;
    const orderedStops = acceptedRoute.orderedMarkerKeys
      .map(id => allStops.find(s => s.id === id))
      .filter((s): s is typeof allStops[number] => s != null);
    if (orderedStops.length === 0) return;
    const url = buildMultiStopDirectionsUrl(
      orderedStops.map(s => ({ lat: s.lat, lng: s.lng })),
      userPosition,
    );
    if (url) window.open(url, '_blank', 'noopener');
  }, [acceptedRoute, allStops, userPosition]);

  return {
    aiState,
    acceptedRoute,
    acceptingRoute,
    isReordering,
    reorderableStops,
    handleAcceptRoute,
    handleDismissRoute,
    handleStartReorder,
    handleReorderChange,
    handleReorderCancel,
    handleOpenInSystemMaps,
  };
}

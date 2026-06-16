// ─────────────────────────────────────────────────────────────────────────────
// horizonStubs — the honest "not-yet-real" registry for the Map Direction D
// (Horizon) redesign. See docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md (§P2,
// §3.9, §8 + corrections log).
//
// WHY THIS EXISTS: the dead Sat/Terr/Hybrid picker taught us that a control which
// PERSISTS a choice but changes NOTHING is a lie. Before the Horizon phases build
// drawers and switches, every capability that is `ui_only_no_backend` (a real-
// looking control with no working backend behind it yet) is enumerated HERE so a
// later phase renders it as a truthful disabled / "coming soon" state instead of a
// working-looking control. This file is data only — it is imported by the drawer/
// switch phases (P3/P8/P9/P11+) to gate affordances; it ships ahead of them so the
// honesty contract is established before the first surface is built.
//
// NOTHING here is a feature. Adding an entry does not build anything; REMOVING an
// entry is how a later phase signals "this is now real, render it for real."
// ─────────────────────────────────────────────────────────────────────────────

/** Lifecycle of a Horizon capability that isn't fully real yet. */
export type HorizonStubStatus =
  /** No backend at all yet — the phase that owns it must BUILD it, never fake it. */
  | 'net-new'
  /** A field/column the backend already populates but no UI renders — surfacing it
   *  is zero/near-zero backend work (the honest cheap win). */
  | 'backend-ready-ui-missing'
  /** Explicitly out of scope for v1 (Horizon-2 / separate Rule-A item). Render as
   *  "coming soon", never as an actionable control. */
  | 'deferred';

export interface HorizonStub {
  /** Stable key a consumer checks before enabling an affordance. */
  id: string;
  /** Human label for the surface this stub governs. */
  label: string;
  status: HorizonStubStatus;
  /** The phase that owns making this real (or where it's deferred to). */
  owner: string;
  /** The ONE truthful thing the UI must do until this is real. Drawers/switches
   *  render this verbatim-ish as the disabled-state explanation. */
  honestFallback: string;
}

export const HORIZON_STUBS = {
  // ── §2.4 / P3 — base-style switch (replaces dead Sat/Terr/Hybrid) ───────────
  contrastBaseStyle: {
    id: 'contrastBaseStyle',
    label: 'Contrast base map style',
    status: 'net-new',
    owner: 'P3',
    honestFallback:
      'buildCoralStyle is Light/Dark only. Until P3 ships a fully-styled Contrast ' +
      'palette variant, the Contrast option must be disabled — never show it as ' +
      'selectable while it renders an unstyled or half-styled map.',
  },
  mapDensity: {
    id: 'mapDensity',
    label: 'Map label/symbol density',
    status: 'net-new',
    owner: 'P3',
    honestFallback:
      'No density parameter exists in the Coral Cockpit style yet. Until P3 threads ' +
      'a density param through the label/symbol layer filters, the density control ' +
      'is disabled (it would change nothing — a Sat/Terr/Hybrid-style lie).',
  },

  // ── §2.6 / P9 — geofences drawer ────────────────────────────────────────────
  allGeofenceRings: {
    id: 'allGeofenceRings',
    label: 'All-geofences ring overlay',
    status: 'net-new',
    owner: 'P9',
    honestFallback:
      'Today MapRadiusRings only rings the SELECTED contact + the user dot. A ' +
      'set-of-all-geofences overlay is net-new per renderer (mirror MapLibreAtlasHalos). ' +
      'Until P9, the "show rings on map" toggle is disabled.',
  },
  completionGeofence: {
    id: 'completionGeofence',
    label: 'Complete-on-arrival geofence',
    status: 'deferred',
    owner: '§8 (Horizon-2)',
    honestFallback:
      'completion_geofence is an enumerated PlaceRole with ZERO rows and no ' +
      'producer/consumer. The whole "auto-complete a task when I arrive" loop is ' +
      'unbuilt — present it as "coming soon", not as a working option.',
  },

  // ── §3.3 / P8 — live team drawer ────────────────────────────────────────────
  shareLevelCoarsening: {
    id: 'shareLevelCoarsening',
    label: 'Approximate / city-only location sharing',
    status: 'deferred',
    owner: 'P8 (coarsening) / §8',
    honestFallback:
      'share_level {precise, approximate, city_only} is schema-ready but NO ' +
      'coordinate-coarsening code exists — non-precise levels still flow precise ' +
      'coords. Disable the non-precise options with a "precise only for now" note; ' +
      'shipping the selector as if it changes what the viewer sees would be a lie.',
  },

  // ── §3.1 / §3.7 — geosearch / edge-fn provenance (optional, deferred) ────────
  providerProvenanceChip: {
    id: 'providerProvenanceChip',
    label: 'Map data provider chip ("served by Stadia")',
    status: 'deferred',
    owner: '§8',
    honestFallback:
      'Only maps-geosearch emits a `provider` field; the other four maps-* fns emit ' +
      'none. A global "served by Stadia" chip is net-new backend on four fns — ' +
      'deferred for v1. Do not assume provenance is available everywhere.',
  },
  geosearchCategoryChip: {
    id: 'geosearchCategoryChip',
    label: 'Geosearch result category chip',
    status: 'backend-ready-ui-missing',
    owner: 'P11 (optional)',
    honestFallback:
      'GeoSearchResult.type is already parsed but never rendered. A category chip is ' +
      'a zero-backend UI add (optional in P11) — safe to surface for real once built.',
  },

  // ── §3.5 — durable places for events/meetings ───────────────────────────────
  eventMeetingDurablePlaces: {
    id: 'eventMeetingDurablePlaces',
    label: 'Durable places for events/meetings',
    status: 'deferred',
    owner: '§8',
    honestFallback:
      'entity_type IN (event, meeting) is allowed by schema but has NO producer; ' +
      'events re-geocode event.location text each session and cannot carry a ' +
      'geofence. Durable event places are a net-new producer — deferred for v1.',
  },
} as const satisfies Record<string, HorizonStub>;

export type HorizonStubId = keyof typeof HORIZON_STUBS;

/** True when a Horizon capability is NOT yet real and a consumer must render its
 *  honest fallback instead of an actionable control. (Every registered stub is
 *  not-yet-real by definition; this reads intent-fully at the call site.) */
export const isHorizonStub = (id: HorizonStubId): boolean => id in HORIZON_STUBS;

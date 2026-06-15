# Map — Direction D "Horizon" Redesign — Implementation Handoff

**Date:** 2026-06-15
**Author of record:** Claude (Opus 4.8, 1M ctx) — verified-inventory pass
**Status:** PROPOSAL. Not yet started. No code changed by this document.
**Flag (proposed):** `mapHorizon` — default **OFF** (see §6).
**Mock:** `_design-playground/maps-redesign.html`, Direction D.
**Predecessor handoffs:** `docs/MAP_MAPLIBRE_REBRAND_HANDOFF_2026-06-14.md`,
`docs/MAP_MAPLIBRE_REBRAND_P3-P5_HANDOFF_2026-06-14.md`,
`docs/contacts_maps.md`, `docs/contacts_maps_phase3.md`.

---

## 1. Title + context

### What this is

The dedicated **Map** section (`AppView.MAP`, root component
`src/components/map/PulseMapView.tsx`) is being reimagined from a
**3-fixed-tab** model (TODAY / WEEK / ATLAS) into a **time-horizon** model:
a continuous scrubber (Now → Today → 3 days → Week) plus an **Atlas**
zoom-out *mode* that is decoupled from the time axis. This is "Direction D"
in `_design-playground/maps-redesign.html`.

### What already changed (the ground this builds on)

These are **verified-true this session** and are the foundation the redesign
sits on — do not re-litigate them:

- **MapLibre is the LIVE default renderer.** `mapLibreRenderer` graduated to
  **default `true`** on 2026-06-15
  (`src/contexts/FeatureContext.tsx:164`; persisted-blob masking handled by the
  `FLAGS_VERSION = 1` migration block at `:175,190-195`). The live map is the
  MapLibre **"Coral Cockpit"** vector style (OpenFreeMap / OpenMapTiles /
  OSM), via `provider/coralCockpitStyle.ts` → `buildCoralStyle(isDarkMode)`.
  The Google `<GoogleMap>` path still exists as the fallback when the flag is
  forced off (`PulseMapView.tsx:805-981`).
- **The data layer is off Google.** All five `maps-*` edge functions migrated
  to **Stadia** (Pelias geocoding, Photon geosearch autocomplete, Valhalla
  routing/matrix), with Google as a deploy-time fallback, deployed 2026-06-15.
  This is what closed the legal gate that previously blocked a non-Google base
  map.
- **The Sat/Terr/Hybrid control is DEAD on the live renderer.** `viewMode`
  (from `useMapViewMode`) is consumed **only** at
  `<GoogleMap mapTypeId={viewMode}>` (`PulseMapView.tsx:810`). MapLibre's
  `MapLibreCanvas` takes only `center/zoom/isDarkMode` and never reads
  `viewMode`. The `MapViewPicker` (`sub/MapViewPicker.tsx`), its hotkeys
  (4/5/6/7), and `MAP_VIEW_OPTIONS` (`sub/mapLens.ts:32-37`) still render and
  persist, but they change **nothing** visually under MapLibre. Replacing this
  with a renderer-real control is a core goal of Direction D.

### What Direction D is (one paragraph)

Replace the three fixed tabs with **(a)** a time-horizon scrubber whose
windows map onto the *existing* lens data layer
(`hooks/useGeoRelevanceSignals.ts` + the `DAY_MS` / `WEEK_MS` constants in
`sub/mapLens.ts:18-19`) and **(b)** an **Atlas toggle** that is a boolean
*mode* (network zoom-out), not a peer tab. The AI signal card adapts to the
active horizon. The dead Sat/Terr/Hybrid picker is replaced by a
**renderer-real base-style switch** (Light / Dark / Contrast) plus a
**density** toggle. **Coral becomes signal-only** (AI proposals, live
presence/broadcast, accepted route); chrome goes neutral. **Routes &
planning**, **Live team**, and **Geofences** — all of which have real,
already-shipped backends that today live in sheets/pills/modals — are
promoted to **first-class right-side drawers**. **"I'm at…"** moves from
freeform-text + reverse-geocode to **live geosearch**.

### Prime directive (read before touching anything)

**This document PROPOSES. It does not authorize.** Per `CLAUDE.md` Rule A,
every removal/replacement of working code below requires its **own** explicit
pros/cons and the user's approval **for that specific change** before
execution. The disposition matrix (§3) and the replaced-vs-preserved tables
(§4) name what *would* change; they are not a green light to delete. When in
doubt: additive, reversible, flag-gated. Over-engineer rather than undercut
months of working code.

Two more `CLAUDE.md` constraints that bite this surface specifically:

- **Schema-first.** Pulse's geo schema is deliberately inconsistent (text vs
  uuid ids, columns absent from the realtime publication). Verify real columns
  via the Supabase MCP before writing any query — and note that
  **migration files for `places` are STALE** (the live RLS was superseded by
  `20260521000010_places_rls_to_user_has_permission.sql`; see §9).
- **AI/Gemini is server-side.** All map AI proposals route through the
  `ai-router` edge function via `mapAIService.ts` → `invokeAIJson`. No client
  API keys. Do not reintroduce direct calls.

---

## 2. Design summary — the Horizon model, precisely

### 2.1 The time-horizon scrubber

A continuous axis with four detents:

| Detent | Meaning | Window (proposed) | Reuses |
|---|---|---|---|
| **Now** | The next stop only / immediate proximity | events within ~`[now, now + 3h)` (DECISION — see §7) and/or the single nearest un-visited stop | `useGeoRelevanceSignals` + a NEW narrow window |
| **Today** | Today's route | `start ∈ [now − DAY_MS, now + DAY_MS)` | `geoSignals.todayEvents` (EXISTS) |
| **3 days** | Near-term batch | `start ∈ [now − DAY_MS, now + 3·DAY_MS)` | a NEW derivation on `geoSignals.weekEvents` |
| **Week** | Full week batch-planning | `start ∈ [now − DAY_MS, now + WEEK_MS)` | `geoSignals.weekEvents` (EXISTS) |

**The data is already fetched.** `useGeoRelevanceSignals`
(`hooks/useGeoRelevanceSignals.ts:88-153`) self-fetches
`dataService.getEvents(now, weekEnd)` + `getThreads()` out to `now + WEEK_MS`
and exposes `GeoSignals = { todayEvents, weekEvents, recentMessageContactIds,
hasRealSignals }` (`:23-30`). The window math lives in the memo (`:115-152`):
`todayEvents` uses `±DAY_MS`; `weekEvents` uses `+WEEK_MS`;
`recentMessageContactIds` uses `now − DAY_MS`. **Only two windows are computed
today.** "Now" and "3 days" are NEW derivations on data already in hand — no
new fetch, no schema change.

The membership predicate `lensIncludesContact(c, lens, now, signals)`
(`:55-80`, also imported directly into `PulseMapView.tsx:25` and called at the
`visibleMarkers` filter `:210`) gates which contacts appear per window. Today
it branches `atlas → always true`, then a real-signals path
(recent-message / `contactAttendsEvent` against today/week events / team-pulse
override), then a legacy `lastSeen` proxy. **The scrubber needs new branches
here** (`now` = next-stop-only; `3d` = 3-day event window). Existing branches
are PRESERVED.

### 2.2 Atlas as a decoupled boolean MODE

Today `'atlas'` is a `MapLens` enum *value* (`sub/mapLens.ts:14`), i.e. a peer
tab. Direction D makes Atlas an **orthogonal boolean** (`atlasMode: boolean`)
that triggers a network zoom-out (`useFitBounds` over all pinned contacts) and
swaps the AI card to `proposeAtlasInsight`. The scrubber and Atlas mode are
independent: you can be in any time-horizon and toggle Atlas on/off. This is a
**state-shape change** (Rule A — §4), not a data-layer change; the windows are
unaffected.

### 2.3 AI card horizon-adaptivity

The proposal FSM (`hooks/useMapAiProposals.ts`, states in `sub/aiTypes.ts:17-26`)
**already** lens-adapts: `today → proposeRoute`, `week → proposeWeekPlan`,
`atlas → proposeAtlasInsight` (effect `:90-179`). Direction D extends the
branch:

- **Now** → `proposeRoute` (next-stop nudge framing).
- **Today** → `proposeRoute` (full route — unchanged).
- **3 days / Week** → `proposeWeekPlan` (batch planning).
- **Atlas mode** → `proposeAtlasInsight` (network insight).

All three propose-functions are server-side via `ai-router` with a **30-min
circuit breaker** (`mapAIService.ts:60`) and a **1500ms** client timeout, fail
-quiet (null, no spinner). The `paused` state (`getAiPausedUntil`) must be
preserved across **all** horizons. Two AI fields are **already returned but
unconsumed** and are ready for D's "jump to / focus this" affordance:
`WeekProposal.focusDate` and `AtlasProposal.focusId` (defined in
`mapAIService.ts`, never read — `AiStrip.tsx` reads only `.summary`,
`.rationale`, `.orderedIds.length`).

### 2.4 Renderer-real base-style switch + density (replaces dead Sat/Terr/Hybrid)

`buildCoralStyle(isDarkMode)` is **two-state only** (Light / Dark) — confirmed:
no Contrast variant, no density parameter (`provider/coralCockpitStyle.ts`).
Direction D's switch is **Light / Dark / Contrast + density**:

- **Light / Dark** — EXIST in `buildCoralStyle`.
- **Contrast** — NET-NEW: a third palette variant in `coralCockpitStyle.ts`.
- **Density** — NET-NEW: a parameter threading label/symbol-layer filters (hide
  minor labels at low density).

This is the **honest** replacement: build the missing variants, do not fake
them. Until built, Contrast and density are `ui_only_no_backend`.

### 2.5 Coral = signal only

Per `CLAUDE.md` §4, coral is reserved for AI-output and live signal. Direction
D pulls rose/coral OFF filters (`MapFilterControls`/`MapFilterAccessories`),
view controls, and focus rings (neutral via `var(--pulse-*)` tokens). Coral
STAYS on: the AI strip/card, the accepted-route polyline, the live-presence
chip, and broadcast state. This is a CSS/token change, not a backend touch.

### 2.6 Routes / Live / Geofences as first-class drawers

All three have **real, shipped backends** that today are hidden in
sheets/pills/modals. Direction D promotes each to a right-side drawer:

- **Routes & planning** — composes `routeService.getDrivingRoute` +
  `mapAIService.proposeRoute/proposeWeekPlan` + `buildMultiStopDirectionsUrl`
  + the accept/reorder/dismiss handlers from `useMapAiProposals`.
- **Live team** — composes `useLivePresence` + `startLocationBroadcast` +
  `setBroadcastRecipients` + `location_share_consents` + ETA shares. **BLOCKED
  on a realtime migration** — see §3 and §9 (`user_locations` is NOT in
  `supabase_realtime`, so presence is wired-but-dead today).
- **Geofences** — composes `listUserPlaces(geofence_radius_m)` +
  `setPlaceGeofence` + `geofence_events` history + the `geofenceService`
  engine. Needs a new "all-geofences" ring overlay and must honestly surface
  that detection only runs while broadcast is active.

### 2.7 "I'm at…" on live geosearch

`ImAtFAB` resolves location via `reverseGeocode` ONLY (`sub/ImAtFAB.tsx:15,57`).
Direction D wires it to **`geosearchService.geosearch`** (Stadia autocomplete,
REAL and deployed). Keep `reverseGeocode` as the GPS-dot fallback label. NOTE:
the in-code comment claiming "Messages doesn't pick this up today" is
**STALE/false** — the `pulse:messages:draft` handoff IS wired end-to-end
(`Messages.tsx:1901-1934`); do not "fix" a non-bug or strip the working path.

---

## 3. Backend → UI disposition matrix

The heart of this document. Every backend capability appears with its Horizon
UI home or an explicit deferred/unsurfaced disposition. **Status legend:**
`real` (wired end-to-end), `partial` (works but a leg missing/in-flight),
`stub` (schema/service exists, no live consumer or net-new), `orphaned` (no
live caller). **UI status:** `surfaced`, `partial`, `unsurfaced`,
`ui_only_no_backend`.

Critic-found items (dead columns, the realtime gap, type couplings, stale
migrations, RLS footguns) are **folded in** and marked **[CRITIC]**.

### 3.1 Geocoding & search

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| Forward geocoding | `locationService.geocodeAddress` L212-226 → edge `maps-geocode {kind:forward}` | service | real | I'm at sheet / marker layer | surfaced | Stadia/Pelias primary, Google fallback. 30-day cache + 10 QPS. Backbone. Pickers use geosearch, but batch/meeting geocode still rides this path (split geocoder). |
| Reverse geocoding | `locationService.reverseGeocode` L228-239 → `maps-geocode {kind:reverse}` | service | real | I'm at sheet | surfaced | No forward-cache reuse. Currently ImAtFAB's only resolver → keep as GPS-dot fallback label; picker moves to geosearch. |
| Batch contact geocoding (quota breaker) | `geocodeContactsBatch` L241-275; caller `useContactGeocoding` L41; 3-failure abort L266-271 | service | real | marker layer | surfaced | Reads `address‖homeAddress`. Triggered by empty-state auto-geocode. Still Google-path `maps-geocode`, not Stadia geosearch — **split geocoder #3** (optionally unify in D). |
| Promote virtual contact → DB row | `ensureContactInDB` L297-343; `isContactUuid` L284-285; INSERT `contacts` | service | real | none (internal to save) | surfaced | Strips `google_`/`vision_` → `external_id`. `contacts.user_id` is TEXT. Load-bearing. Preserve verbatim. |
| Save contact home/work (dual-write) | `saveContactLocation` L345-393; legacy `contacts.{home,work}_*` UPDATE + mirror `upsertContactPlace`→`places`/`entity_places` | service | **partial** | I'm at / marker layer (via LocationEditModal) | surfaced | **IN-FLIGHT dual-write by design**: legacy cols authoritative, places mirror best-effort (L385-390). Map reads LEGACY only. **Rule A: do NOT consolidate** — the "redundant" places store is the migration target. |
| Clear contact location | `clearContactLocation` L395-436 | service | real | marker layer (LocationEditModal) | surfaced | Non-UUID guard → no-op. Nulls legacy + deletes `entity_places` link (place row left). Preserve. |
| Live place autocomplete | `geosearchService.geosearch` L41-71 → edge `maps-geosearch` → `{lat,lng,name,address,type}` | service | real | **I'm at sheet** / Routes drawer / pickers | partial | Stadia autocomplete, Photon fallback. min 3 chars; debounce is caller's. Active only when `mapLibreRenderer` ON (=now default). **#2: ImAtFAB does NOT call it** — D wires it. `result.type` parsed but UNRENDERED — D can surface category. |
| `maps-geocode` edge fn | `supabase/functions/maps-geocode/index.ts` | edge | real | I'm at / marker layer | surfaced | Stadia primary, Google fallback (no Photon here). `status` parsed only for ZERO_RESULTS; **no `provider` field**. **[CRITIC]** NOT in `config.toml` — relies on platform `verify_jwt=true` default; pin explicitly (§3.7). |
| `maps-geosearch` edge fn | `supabase/functions/maps-geosearch/index.ts` | edge | real | I'm at / Routes / pickers | partial | Stadia autocomplete, **Photon** fallback (only fn with Photon). `request_failed` returns **500** (only fn not 502). **EMITS `provider`** (only fn that does) — client never reads it; D could surface provenance. **[CRITIC]** Not in `config.toml`. |

### 3.2 Routing & AI planning

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| Single-pair driving time | `directionsService.getTravelTime` L98-159 → edge `maps-directions` → `{minutes,distanceMeters}` | service | real | marker layer (panel ETA) / Routes drawer | surfaced | Stadia/Valhalla `costing:auto`, Google fallback. Day-scoped cache + 10 QPS. Used by MapContactPanel, etaShareService. Preserve. |
| Batched travel-time matrix | `distanceMatrixService.getTravelTimesForPairs` L114-204 → edge `maps-distance` (max 25) → diagonal; 7-day DOW cache | service | real | marker layer (TODAY meeting buffers) | surfaced | The B4 feature. SHARED by Calendar (`useCalendarTravelBuffers`→`TravelBufferChip`) AND Map (`PulseMapView L173`). Cache keyed by day-of-week. Reuse for Horizon multi-stop estimates. |
| Multi-stop route geometry | `routeService.getDrivingRoute` L36-95 → edge `maps-route` (max 25 wp) → `{path,durationSec,durationMin}` | service | real | AI card (Accept) / Routes drawer / marker (polyline) | surfaced | Server decodes polyline: **Valhalla 1e6 / Google 1e5** (load-bearing — wrong factor garbles line, `maps-route` L100/L123). No cache (one-shot). 12s client race + 2 retries. **PRESERVE polyline logic exactly.** |
| OS-maps deep-link builder | `mapDirectionsUrl.buildMultiStopDirectionsUrl` L30-60 (pure); caller `useMapAiProposals` `handleOpenInSystemMaps` L287 | derived | real | AI card / Routes drawer ("Open in Maps") | surfaced | Google `dir/?api=1` for all platforms (≤25 wp). Pure, no network. The route hand-off action. |
| `maps-directions` edge fn | `supabase/functions/maps-directions/index.ts` | edge | real | marker (ETA) / Routes | surfaced | Stadia/Valhalla primary, Google fallback. Google-fail `status` is dead on wire. No `provider`. **[CRITIC]** Not in `config.toml`. |
| `maps-distance` edge fn | `supabase/functions/maps-distance/index.ts` | edge | real | marker (buffers) | surfaced | Valhalla matrix diagonal; Google fallback requires `cell.status OK`. `too_many_pairs` at 25. Dead `status`. No `provider`. **[CRITIC]** Not in `config.toml`. |
| `maps-route` edge fn | `supabase/functions/maps-route/index.ts` | edge | real | AI card / Routes / polyline | surfaced | Waypoint order PRESERVED (AI pre-orders). Dual-factor `decodePolyline`. Dead `status`. No `provider`. **[CRITIC]** Not in `config.toml`. PRESERVE polyline. |
| AI route proposal (Now/Today) | `mapAIService.proposeRoute` L132-196 → `invokeAIJson('calendar_prep')` via `ai-router`; `RouteProposal{orderedIds,summary,rationale?}` | ai | real | AI card (Now/Today windows) | surfaced | Haiku, temp 0.2. Two-stage visited filter + output id-validation. `rationale` IS consumed (`AiStrip L325`). Now=next-stop nudge + Today=route both map here. |
| AI week-plan proposal (3d/Week) | `mapAIService.proposeWeekPlan` L211-252 → `invokeAIJson('task_prioritization')`; `WeekProposal{summary,focusDate?}` | ai | partial | AI card (3 days / Week) | partial | Gemini Flash, temp 0.3. min 2 stops, no caps. **`focusDate` DEFINED-BUT-DEAD** — ready for D's scrubber-jump affordance. New "3 days" window reuses this. |
| AI atlas insight (Atlas mode) | `mapAIService.proposeAtlasInsight` L272-320 → `invokeAIJson('proactive_nudge')`; `AtlasProposal{summary,focusId?}` | ai | partial | AI card (Atlas mode) | partial | Gemini Flash, temp 0.35. min 3 contacts, slices to stalest-30. **`focusId` DEFINED-BUT-DEAD** — ready for "focus this contact". Atlas → boolean MODE in D. |
| AI circuit breaker + pause | `getAiPausedUntil` L71-73, `isCircuitOpen` L63-65, `CIRCUIT_PAUSE_MS` 30min L60 | ai | real | AI card (Paused state) | surfaced | Session-scoped, resets on reload. Fail-quiet. D's adaptive card MUST preserve `paused` across all horizons. |
| AI proposal FSM (lens-adaptive) | `useMapAiProposals` effect L90-179 (300ms debounce + AbortController); `AiState` `aiTypes.ts:17-26` | derived | real | AI card | surfaced | States idle/fetching/ready/none/paused/reordering. Already lens-branches. D's scrubber maps onto this — needs a NEW `MapLens`/horizon value + matching effect branch. Skips re-propose when accepted/reordering. |
| Accept-route → polyline + ETA + reorder | `handleAcceptRoute` L185-236 (→`getDrivingRoute`), reorder L245-266, dismiss L238-240, OS-maps L281-292 | derived | real | AI card / marker (coral polyline) | surfaced | `acceptedRoute = {orderedMarkerKeys,path,durationMin,arrivesAt}` = the CORAL accepted-route signal. Routes drawer hosts accept/reorder/dismiss. |
| **[CRITIC]** AcceptedRoute.path Google-type coupling | `aiTypes.ts:30` `path: google.maps.LatLngLiteral[]`; consumed by MapLibre `MapLibreAcceptedRoute` (`PulseMapView L698`) | ai type | partial | Routes drawer / coral polyline | surfaced | Works via structural typing on the DEFAULT MapLibre renderer, but a Google type name in a MapLibre world is a latent coupling. D's Routes drawer should normalize `AcceptedRoute` to the renderer-neutral `LatLngLiteral` in `provider/types.ts`. |
| **[CRITIC]** Defined-but-dead AI fields | `WeekProposal.focusDate`, `AtlasProposal.focusId` (mapAIService) | ai type | partial | AI card (3d/Week + Atlas) | unsurfaced | Returned by model, parsed into types, never read (`AiStrip` reads only `.summary`/`.rationale`/`.orderedIds.length`). D's "jump to / focus" affordance = net-new UI on EXISTING backend. |
| `ai-router` edge fn (transport) | `supabase/functions/ai-router`; tasks `calendar_prep`/`task_prioritization`/`proactive_nudge` (`tasks.ts`); `invokeAIJson`→`invoke('ai-router')` | edge | real | AI card (all horizons) | surfaced | **No dedicated maps branch** — proposals are CLIENT-orchestrated over 3 generic task types. Enforces workspace membership + hard-cap metering server-side. New horizons can ride existing tasks. |

### 3.3 Live presence & broadcast

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| Start live broadcast (orchestration hub) | `startLocationBroadcast` L776-841; watchPosition → 15s-debounced `user_locations` upsert + geofence tick + eta tick | service | real | Live drawer / broadcast pill | surfaced | Single tick fans out to 3 systems. Lazy-imports geofence/notif/eta. The engine; preserve. |
| Stop live broadcast | `stopLocationBroadcast` L843-856 | service | real | Live drawer | surfaced | Clears watch+debounce, stops geofence detection. |
| Subscribe to peer live location | `subscribeToUserLocation` L860-892; channel `location:{id}` postgres_changes UPDATE on `user_locations` | realtime | **partial — BROKEN pending migration** | Live drawer / marker (live override) | surfaced (inert) | **[CRITIC]** `user_locations` is **NOT** in `supabase_realtime` → the subscription **never fires**. Code is correct; table is unpublished. **Required additive migration** (§9) before the Live drawer renders live. |
| Live presence mount (per-contact channels) | `useLivePresence.ts:19-30` (1 channel / pulseUserId contact); `liveBroadcasters` memo L456-463; live override L734-742 | realtime | **partial — inert** | Live drawer / marker override / live chip | surfaced (inert) | **[CRITIC]** Inert for the same publication reason. O(N) channels — fine at small N; multiplex if team scale grows. |
| Set own location-sharing flag | `setLocationSharing` L894-902 (upsert `user_locations.is_sharing`) | service | real | Live drawer | **unsurfaced** | **[CRITIC]** No caller found — a real fn with zero consumers. D's Live-drawer "share my location" master switch wires HERE; don't re-implement the upsert. |
| Check/grant location consent | `checkLocationConsent` L904-924, `upsertLocationConsent` L926-942 → `location_share_consents` (unique pair, `share_level` enum) | service | real | Live drawer (LocationSharePanel) | surfaced | Consent spine. `share_level{precise/approximate/city_only}` schema-ready but **down-sampling UNVERIFIED** — treat non-precise as not-yet-enforced. **[CRITIC]** `own_consents` RLS lets the VIEWER write rows — harden before a consent UI (§7). |
| Multi-recipient broadcast targeting | `getActiveBroadcastRecipientIds` L962-964, `setBroadcastRecipients` L969-1011, `endBroadcastRecipients` L1017-1030 → `location_share_consents` diff | service | real | Live drawer (BroadcastRecipientPicker) | surfaced | Spec's `live_location_recipients` folded into `location_share_consents` (comment L944-956). Preserves manual grants, revokes session-only on stop. Reuse as-is. |
| **[CRITIC]** `user_locations.location_label` (half-wired) | col ordinal 7 text NULL; READ by `subscribeToUserLocation` L883 + `TeamRadarTile.tsx:156-159`; NEVER written by `startLocationBroadcast` upsert L819-831 | column | partial | Live drawer | unsurfaced | Real Dashboard reader, **zero producer** → always null in practice. D's Live drawer should DISPLAY and POPULATE it (fold reverseGeocode/geosearch result into the broadcast upsert). |

### 3.4 Geofencing & arrival

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| Geofence detection (client state machine) | `geofenceService.processPosition` L93-126; `classifyState`/`transitionToEvent` L188-209; INSERT `geofence_events` L214-224 | service | real | Geofences drawer | **unsurfaced** | Full engine: enter/exit/approach (band radius..2×), 5-min throttle. **Runs ONLY while broadcast active** (§7). No Map surface renders rings/list today. |
| Geofence subscribe/start/stop/refresh | `onGeofenceTransition` L71-74, `startGeofenceDetection` L76-83, `stopGeofenceDetection` L85-90, `refreshGeofences` L129-133, `ensurePlacesLoaded` L139-186 | service | real | Geofences drawer | partial | `ensurePlacesLoaded` selects `places WHERE geofence_radius_m IS NOT NULL`. `refreshGeofences` called by panel/modal/picker. Drawer = list + toggle radii (`setPlaceGeofence`). |
| Today's visited contact-stops (poll) | `getTodayVisitedContactStops` L267-286 (SELECT `geofence_events` enter since midnight); `useVisitedStops` polls on lens change | derived | real | AI card (`proposeRoute.visitedIds`) / Now+Today window | surfaced | Returns `{entityId}-home/-work` keys. Feeds AI route de-dup. POLLED not subscribed (`useVisitedStops L19 useEffect[lens]`). D Now/Today could subscribe for live strikethrough (needs publication). |
| Geofence notification fan-out (3 surfaces) | `geofenceNotificationService` `initGeofenceNotifications` L27-31, `handleTransition` L39-87: toast + `mobileNotificationService.notify` + `today_feed_items` INSERT | service | real | none on map (adjacent to Geofences drawer) | surfaced | Writes `today_feed_items.metadata.sourceEventType:'geofence'`. Role-aware copy. Surfaces in Today feed. D drawer could show recent transitions reading `geofence_events`. |
| **[CRITIC]** `geofence_events.surfaced` / `surfaced_at` + the `geofence_events_update_surfaced` RLS policy | cols + the ONLY UPDATE path on the table | column | **stub (dead)** | Geofences drawer ("mark reviewed") | ui_only_no_backend | INSERT (L214-224) never sets them; no SELECT reads them; grep finds zero touch. The RLS policy gates a mutation no code uses. D's "unread vs reviewed transition" state is exactly what these are FOR — net-new producer/consumer. |
| **[CRITIC]** `geofence_events.payload` jsonb | col NOT NULL `'{}'` | column | **stub (dead)** | Geofences drawer (rich transition card) | ui_only_no_backend | INSERT never writes it; no SELECT reads it. (notif service writes its context into `today_feed_items.metadata`, NOT here.) Schema slot for dwell time/approach vector/entity snapshot. |
| **[CRITIC]** Geofence detection ⇄ broadcast coupling | `processPosition` driven ONLY by `startLocationBroadcast.writePosition` L805-809 | cross-entity | real (by design) | Geofences drawer (honesty constraint) | n/a | With broadcast OFF, no enter/exit/approach is detected/logged. D drawer must say "Geofence alerts require Live location ON" OR D decouples detection (server-side = Horizon-2). Do NOT present geofences as live-monitored when they aren't. |
| **[CRITIC]** All-geofences ring overlay | none today; `MapRadiusRings`/`MapLibreRadiusRings` only ring the SELECTED contact + user dot (`PulseMapView L691-693`); `listUserPlaces` returns them | ui-without-backend | stub | Geofences drawer ("show rings on map") | ui_only_no_backend | The drawer LIST + `setPlaceGeofence` are real; the map-side ring overlay for the SET of geofences is net-new UI (new overlay per renderer, mirror `MapLibreAtlasHalos`). |
| **[CRITIC]** `completion_geofence` role ("complete on arrival") | `placeTypes.ts:30` + migration `20260503000008` enumerate; NO producer | table | **stub** | Geofences drawer (NEW capability) | ui_only_no_backend | Role enumerated, never written. The "auto-complete task when I arrive" loop is UNBUILT. Needs a producer (`attachPlaceToEntity role=completion_geofence`) + a `geofence_events` enter → task-complete consumer. |

### 3.5 Places & cross-entity

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| Places CRUD — get/list/create/setGeofence | `getPlacesForEntity` L451-473, `getPlace` L476-484, `listUserPlaces` L492-502, `createPlace` L508-533, `setPlaceGeofence` L542-551 | service | real | Geofences drawer / Routes drawer | partial | `createPlace` called by decisions wizard; `listUserPlaces`/`getEntityPlaceMap` by CockpitHub. **The Map reads NOTHING from `places` today.** D's drawers are the first map consumers. |
| entity_places attach/detach (polymorphic) | `attachPlaceToEntity` L558-573, `detachPlaceFromEntity` L579-591, `getEntityPlaceMap` L601-618; `upsertContactPlace` L625-693 | service | real | Routes / cross-entity marker layer | partial | `entity_id` is TEXT. Producers: contact (real), task `primary` (write-only), decision `venue` (write-only). Read by Search's map, NOT the main Map. |
| Task places (entity_places, role primary) | `TaskEditModal.tsx:118-119,453-465` → `attachPlaceToEntity('task',...)`; read by `CockpitHub.getEntityPlaceMap('task')` L657 | table | partial | **marker layer (NEW in D)** | unsurfaced | **Real-but-homeless #1**: written + surfaced in Search's map, NEVER plotted on the main Map (`PulseMapView` has no `tasks` prop). D needs only a READ + marker layer + a `tasks` prop from `App.tsx`. |
| Decision venues (entity_places, role venue) | `wizardSubmit.ts:107-120` → `createPlace({type:'venue'})` + `attachPlaceToEntity('decision',...,'venue')` | table | partial | **marker layer (NEW in D)** | unsurfaced | Same gap. D's decisions-with-place = read `entity_places('decision')` + marker layer. Write side exists. |
| Event/meeting durable places | schema allows `entity_type IN (...,event,meeting)`; **NO producer**; events plotted via ad-hoc `useMeetingMarkers` geocode of `event.location` TEXT | table | **stub** | marker layer (meeting markers) | ui_only_no_backend | Never written. Events re-geocode text every session (no durable place, can't carry a geofence). D could durably-place events (net-new producer). The `meeting` place-TYPE (contacts) ≠ `entity_type='meeting'`. |
| **[CRITIC]** entity_places: no realtime + no UPDATE RLS | publication empty; SELECT/INSERT/DELETE only (rows replaced via composite PK) | realtime | partial | cross-entity marker layer | n/a | D's tasks/decisions markers will be **STATIC**: a place reassignment is delete+insert with no realtime push. The marker layer must **refetch-on-focus / poll**, not subscribe. Disposition the constraint; don't assume live updates. |
| Calendar travel buffers (Map TODAY) | `useCalendarTravelBuffers` (shared) → `PulseMapView L173` → `MapMeetingMarkerBody travelBuffer` L778/L931 | derived | real | marker layer (meetings, TODAY only) | surfaced | Map shares the B4 hook with Calendar. D could extend buffer display to Now/Today windows. (`travelBufferService` + `calendarAIService.analyzeTravelBuffers` are overlapping siblings — consolidation candidate, NOT gap.) |
| **[CRITIC]** SearchMapView (reference, Google-coupled) | `SearchMapView.tsx:15` hardcoded `@react-google-maps/api`; `spatialSearchService L21-23,86` joins `entity_places` for contact/task/event | derived | real | none (separate Search surface) | surfaced | Proves the cross-entity pattern, but is **Google-hardcoded** on a MapLibre-default app. D's markers must be MapLibre-native (reuse the `*Body` portability seam), **NOT** lift SearchMapView's Google path. SearchMapView's own MapLibre migration is a separate Rule-A item. |
| **[CRITIC]** `places.color` + `places.notes` | cols (color CHECK hex, notes text); `createPlace` accepts neither; `PlacePicker` reads only name/address; `PLACE_TYPE_COLORS` `placeTypes.ts:71-78` | column | stub | cross-entity markers / Routes/Geofences detail | ui_only_no_backend | Schema-ready, behavior-absent. D's durable cross-entity markers are where `places.color` (per-place tint) and `places.notes` (detail) earn a home. |

### 3.6 Live presence / arrival tables & ETA (table + ETA cluster)

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| Create tokenized ETA share | `etaShareService.createEtaShare` L114-143 → INSERT `eta_shares`; returns `/eta/{token}` | service | real | marker (panel → EtaShareModal) / Live drawer | surfaced | 32-char token (service strips hyphens; **[CRITIC]** migration comment says 36 — service is authoritative, route regex is `{32}`). `expires_at` has NO default — caller must set. |
| List/cancel active ETA shares | `listActiveShares` L146-157, `cancelEtaShare` L163-169 | service | real | Live drawer (active shares) | surfaced | Only via EtaShareModal today. D Live drawer lists globally (`status='active'` partial index exists). |
| Live ETA tick (progress/arrival/expiry) | `tickActiveShares` L194-218 (12s throttle, auto-expire), `updateShareProgress` L220-272 (≤75m arrive, ≥500m real ETA, <500m walking proxy) | service | real | Live drawer (via broadcast tick) | surfaced | Updates `eta_shares.last_*`/`status`. Auto-arrives at 75m, auto-expires. Preserve. |
| Public ETA viewer read (anon) | `getEtaShareByToken` L175-184 → RPC `get_eta_share_by_token(p_token)`; `EtaSharePage`; route `App.tsx /eta/:token` | rpc | real | none (public page, outside Map) | surfaced | SECURITY DEFINER, `search_path=public`, STABLE. Bypasses owner-only RLS; omits `user_id`+`recipient_contact_id`. The ONLY geo data-access RPC. **[CRITIC]** has a **5-min grace window** (`20260514000002` L119-128) — recently arrived/canceled/expired shares stay visible 5 min (not just `active`); D Live-drawer messaging around "your share just ended" must account for it. Preserve untouched. |

### 3.7 Renderer & controls

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| Camera abstraction (renderer-agnostic) | `googleAdapter L17`/`maplibreAdapter L18` impl `MapProviderApi` (`types.ts L33`); `useFitBounds L54`; `activeCamera` L245 | derived | real | map control | surfaced | Flag selects adapter. D's scrubber/Atlas zoom-out moves go through `useFitBounds`. Preserve. |
| MapLibre base style (Coral Cockpit) | `coralCockpitStyle.buildCoralStyle(isDarkMode)`; `MapLibreCanvas L21/68/105`; OpenFreeMap source | derived | partial | **base-style switch (Light/Dark)** | partial | **TWO-STATE ONLY** (light/dark via `isDarkMode`) — NO Contrast, NO density. D's switch = Light/Dark (exist) + NEW Contrast variant + NEW density param. Contrast/density are `ui_only_no_backend` until built. **This replaces the dead Sat/Terr/Hybrid picker.** |
| Base-tile view mode (Sat/Terr/Hybrid) | `useMapViewMode` (LS `MAP_VIEW_LS_KEY`); `MapViewPicker L23`; consumed ONLY at `<GoogleMap mapTypeId>` L810; `MAP_VIEW_OPTIONS` `mapLens L32-37` | derived | **orphaned** | none (REPLACED by base-style switch) | surfaced | **DEAD on MapLibre**: `viewMode` never reaches `MapLibreCanvas`. Picker + hotkeys 4/5/6/7 persist but change nothing. **Rule A**: removal of `MapViewPicker`/`useMapViewMode`/`MAP_VIEW_OPTIONS` needs pros/cons (§4) — still wired to the Google fallback. |
| Lens triad tabs (TODAY/WEEK/ATLAS) | `MapLensRow L25/54-81`; `LENS_OPTIONS` `mapLens L21-25`; `MapLens` type L14; `setLens` L619; hotkeys 1/2/3 | derived | real | **scrubber + Atlas mode (REPLACES these)** | surfaced | Atlas is a `MapLens` enum VALUE today, not a boolean. D's "Atlas as mode" is a type/state change (§4). The 3 fixed tabs → continuous scrubber. Data layer (windows) survives. **Rule A.** |
| Marker clustering (renderer-aware) | `useMarkerClusters L172-229` (no-Google-map branch raw supercluster L180-228); `markerLayout.computeMarkerLayout L27` | derived | real | marker layer | surfaced | **PARITY COMPLETE on MapLibre** (stale in-file P-comments contradict shipped code). supercluster branch = identical shape to Google. Density toggle could tune cluster regimes. Preserve. |
| Marker offset/spider/fan layout | `computeMarkerLayout L27`; `useMarkerOffsets`, `useSpiderAnimation`; `*Body` split | derived | real | marker layer | surfaced | `*Body` split = renderer-portability seam (owns `translate(-50%,-100%)`). Same DOM under Google `OverlayView` or MapLibre `MapMarkerPortal`. Preserve the seam. |
| Search / locationType / circle filters | `MapFilterControls` (`MapFilterBar L70/152-201`), `MapFilterAccessories` (L259/310-325); `filter` state L131; `visibleMarkers` L205 | derived | real | map control (chrome → NEUTRAL) | surfaced | Preserve function; D pulls rose/coral OFF (coral=signal-only). Cosmetic, no backend. |
| Broadcast pill toggle | `MapFilterBar.handleToggleLive L96`; LS `pulse:map:live-location-on`; opens `BroadcastRecipientPicker`; hotkey B | derived | real | **Live drawer (promoted)** | surfaced | Currently in filter bar. D moves trigger to the Live drawer. Coral STAYS (live = legit signal). Backend unchanged. |
| I'm at FAB (GPS → contact draft) | `ImAtFAB L34/96/147-159`; `reverseGeocode L15/57`; `onSend`→`pulse:messages:draft` + `onContactAction` L1073-1082 | derived | real | **I'm at sheet** | surfaced | **#2: reverseGeocode ONLY** — D wires `geosearch`. The `pulse:messages:draft` handoff IS wired (`Messages.tsx:1901-1934`) — the in-code "Messages doesn't pick this up" comment is STALE/false. Clipboard copy now redundant. |
| Lens empty states | `LensEmptyState L24`; 3 variants; `PulseMapView L983-1007` | derived | real | scrubber / Atlas-mode empty states | surfaced | "Switch to Atlas" becomes "toggle Atlas mode". Preserve auto-geocode + pin-contact CTAs. |
| Live broadcast sheet / Live team view | `LiveBroadcastSheet L23` wraps `LiveTeamView`; live chip L1035-1051; `showLiveSheet` | derived | partial | **Live drawer (promoted from sheet)** | partial | Today a bottom sheet behind a chip. D promotes to first-class right-side drawer. `LiveTeamView` content exists; re-home into the drawer shell. |
| Contact detail panel | `MapContactPanel L53`; `getPlacesForEntity L88`; `handleToggleGeofence L118`; mounts LocationEditModal/LocationSharePanel/EtaShareModal | derived | real | marker (selected) + feeds Geofences/Live drawers | surfaced | The ONLY geofence-config surface today (per-place toggle). D's Geofences drawer aggregates what this does per-contact. Preserve actions (Message/Relay/Meet). |
| **[CRITIC]** `set_places_updated_at()` advisory + INSERT quirk | trigger fn NOT SECURITY DEFINER, no pinned `search_path`; `trg_places_updated_at` BEFORE UPDATE only | rpc/table | real | n/a (hardening) | n/a | Lone DB-baseline violation among geo funcs. Fold a one-line `ALTER FUNCTION ... SET search_path=public,pg_temp` into D's migration batch. Also: `updated_at == created_at` until first edit — Routes/Geofences "recently changed" sort should use `greatest(created_at, updated_at)`. |
| **[CRITIC]** maps-* edge fns auth posture | not declared in `config.toml`; rely on undeclared platform `verify_jwt=true` | edge | real | n/a (hardening) | n/a | D promoting Routes/Live/Geofences = more invoke traffic. Pin `[functions.maps-*] verify_jwt=true` explicitly to match the 14 declared fns; a future deploy can't drift the posture. |
| **[CRITIC]** Provider provenance only on geosearch | `maps-geosearch` emits `provider` (`stadia\|photon`); other four emit none; client never reads any | edge field | partial | I'm at / Routes provenance chip (optional) | ui_only_no_backend | A global "served by Stadia" chip is NET-NEW UI on geosearch (real) but NET-NEW BACKEND on the other four. Don't assume provenance is available everywhere. |
| **[CRITIC]** geosearch `result.type` category | parsed into `GeoSearchResult.type`, never rendered (`GeoSearchInput` shows name/address only) | ai type | partial | I'm at / Routes place picker (category chip) | ui_only_no_backend | Category chip is net-new UI on an already-populated field — zero backend work. |

### 3.8 Flags & gating

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| `mapLibreRenderer` flag | `FeatureContext def L92, default TRUE L164`, `FLAGS_VERSION=1` migration L190-194; `useMapLibreRenderer L36-40`; `?ff_mapLibreRenderer` override | flag | real | base-style switch / which renderer | surfaced | DEFAULT ON. Selects MapLibre vs Google. **D builds on the MapLibre path.** Any new D flag graduating OFF→ON must bump `FLAGS_VERSION` + add its key to the migration block, or persisted `false` masks it. |
| `experimentalEnabled` flag (Map reachability) | `def L54, default FALSE L145`; gates `Sidebar L404` nav; `App.tsx L1465-1480` renders `PulseMapView` WITHOUT re-checking | flag | real | section reachability | surfaced | Gates the Map NAV item only. Direct route to `AppView.MAP` (deep link / command palette) STILL renders the Map when OFF — the gate is nav-only. **DECISION (§7): does Horizon graduate the Map out of Experimental?** |
| `relayLiveRooms` flag | `def L102, default FALSE L167`; NO consumer in `src/components/map/**` | flag | orphaned | none | unsurfaced | NOT a Map flag (Relay voice only). Listed for completeness — the sibling "live" precedent. |
| Map plan/tier entitlement gating | `useEntitlements` — banner-only consumer `Sidebar L265/271`; NONE in `src/components/map/**` | derived | **stub** | Routes/Live/Geofences (if any go paid) | ui_only_no_backend | **NO plan gate on any Map feature today.** Only indirect cap = AI circuit breaker (usage cap, not feature lock). Paid-tier drawers would be NET-NEW (follow `useEntitlements.canUseFeature`, NOT the FeatureContext flag pattern). |
| **[CRITIC]** `share_level` down-sampling | enum `{precise,approximate,city_only}` schema-ready; NO coarsening code path | table | stub | Live drawer consent UI | ui_only_no_backend | A consent UI offering "approximate"/"city only" would be a Sat/Terr/Hybrid-style lie (option persists, precise coords still flow). Implement coarsening (net-new) OR flag non-precise levels `ui_only_no_backend`. Do not ship the selector as if it changes what the viewer sees. |

### 3.9 Net-new Horizon primitives (no backend yet)

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| Time-horizon scrubber (Now→Today→3d→Week) | NO backend; derives from `useGeoRelevanceSignals` windows (only today/week exist) + new horizon values + new `lensIncludesContact` branches | derived | stub | **scrubber (core D primitive)** | ui_only_no_backend | "Now" + "3 days" windows DON'T EXIST — net-new derivations on `weekEvents` (data already fetched to `now+WEEK_MS`). Needs: new horizon enum values, window math in the memo, new predicate branch, matching AI effect branch. Flag-gate. |
| Atlas decoupled to boolean MODE | `MapLens 'atlas'` is an enum VALUE today (`mapLens L14`); `proposeAtlasInsight` keyed to `lens==='atlas'` | derived | stub | Atlas mode (toggle, not peer tab) | ui_only_no_backend | State refactor: decouple atlas into a boolean `atlasMode` that triggers network zoom-out + `proposeAtlasInsight`. **Rule A** — changes lens state shape. Data layer unaffected. |
| Base-style Contrast variant + Density toggle | `buildCoralStyle(isDarkMode)` two-state only | derived | stub | base-style switch | ui_only_no_backend | Light/Dark exist; Contrast style + density param are NET-NEW. The honest replacement for Sat/Terr/Hybrid. |
| Routes & planning drawer | NO drawer; composes `getDrivingRoute` + `proposeRoute/proposeWeekPlan` + `buildMultiStopDirectionsUrl` + accept/reorder handlers | derived | stub | Routes drawer | ui_only_no_backend | All backend pieces REAL. The DRAWER SHELL + IA is net-new UI assembling existing services. Flag-gate. |
| Live team drawer | NO drawer; composes `useLivePresence` + `startLocationBroadcast` + `setBroadcastRecipients` + consents + `listActiveShares` + `setLocationSharing` | derived | stub | Live drawer | ui_only_no_backend | Backend ready EXCEPT the realtime publication gap (§9). Today only a bottom sheet + filter-bar pill. Drawer SHELL net-new. |
| Geofences drawer | NO drawer; composes `listUserPlaces(geofence_radius_m)` + `setPlaceGeofence` + `geofence_events` history + engine | derived | stub | Geofences drawer | ui_only_no_backend | Engine + events + per-place config + notif fan-out REAL. No ring overlay / list today. Drawer SHELL + all-geofences ring overlay net-new. Surface the broadcast-dependency honestly. |
| Coral-neutral chrome conversion | filters/view controls/focus rings use rose/coral; coral budget `CLAUDE.md §4` | derived | n/a (cosmetic) | all chrome | partial | Pure CSS/token change. AcceptedRoute polyline + AI strip + live chip KEEP coral. Consume `var(--pulse-*)`; don't redeclare. |

### 3.10 Orphaned / out of scope

| Capability | Backend ref | Layer | Backend status | Horizon surface | UI status | Notes |
|---|---|---|---|---|---|---|
| `mapboxService` (dead code) | `mapboxService.ts L1-25` (direct `api.mapbox.com` fetch); ONLY importer `Tools.tsx L16` which has ZERO live renderers | service | orphaned | none | unsurfaced | Legacy direct-fetch pattern. Reachable only via unrendered `Tools.tsx`. **Rule A**: a FUTURE pros/cons removal candidate — NOT authorization to delete. D ignores it. |

---

## 4. What is REPLACED vs PRESERVED (Rule A pros/cons per surface)

Each surface below is **working code**. Per `CLAUDE.md` Rule A, these
pros/cons are the *proposal*; the user must approve each specific change before
execution. Nothing here is pre-authorized.

### 4.1 MapLensRow tabs → time-horizon scrubber + Atlas-mode toggle

**Files:** `src/components/map/sub/MapLensRow.tsx`,
`src/components/map/sub/mapLens.ts` (`MapLens` type L14, `LENS_OPTIONS` L21-25),
`src/components/map/PulseMapView.tsx` (`lens` state L103, `setLens` L619,
keyboard 1/2/3 in `useMapKeyboardShortcuts`),
`src/components/map/hooks/useGeoRelevanceSignals.ts` (`lensIncludesContact`),
`src/components/map/hooks/useMapAiProposals.ts` (lens branch).

| Pros | Cons |
|---|---|
| Continuous horizon better matches the real mental model (next-stop → today → near-term → week) than 3 hard tabs. | Replacing the lens type touches every `lens === 'x'` consumer (filter predicate, AI effect, empty states, visited-stops, keyboard map, SR announcer). Wide blast radius. |
| Atlas-as-mode lets you keep a time context while zooming out (impossible with peer tabs). | A continuous control is harder to make keyboard-accessible and SR-friendly than 3 buttons; must not regress `useSrAnnouncer`/`useMapKeyboardShortcuts`. |
| Data layer is untouched (windows are additive). | Risk of regressing the well-tuned `lensIncludesContact` real-signals/legacy-proxy logic if branches are rewritten rather than extended. |

**Preserved:** the entire data layer (`useGeoRelevanceSignals`, `DAY_MS`/`WEEK_MS`,
the `today`/`week` windows, all existing `lensIncludesContact` branches), the AI
FSM, marker pipeline, empty-state CTAs.
**Sacrificed (if approved):** the 3-fixed-tab UI affordance and its 1/2/3
hotkeys (re-mapped to detents), `LENS_OPTIONS` shape. **Net:** additive
state + a new control; the old enum can be kept internally (horizon → derived
`MapLens`-compatible window) to minimize churn.

### 4.2 MapViewPicker (Sat/Terr/Hybrid) → base-style switch (Light/Dark/Contrast + density)

**Files:** `src/components/map/sub/MapViewPicker.tsx`,
`src/components/map/hooks/useMapViewMode.ts`,
`src/components/map/sub/mapLens.ts` (`MAP_VIEW_OPTIONS` L32-37, `MapViewMode`
L30, `MAP_VIEW_LS_KEY` L39), `PulseMapView.tsx:1027-1031` (mount), `:810`
(Google `mapTypeId` consumer), hotkeys 4/5/6/7,
`src/components/map/provider/coralCockpitStyle.ts` (NEW Contrast + density).

| Pros | Cons |
|---|---|
| The current control is DEAD on the live renderer (changes nothing). A renderer-real switch is honest and useful. | `MapViewPicker`/`useMapViewMode`/`MAP_VIEW_OPTIONS` are still wired to the Google FALLBACK path (`<GoogleMap mapTypeId>`). Removing them breaks Sat/Terr/Hybrid for anyone who force-flips `mapLibreRenderer` OFF. |
| Light/Dark already exist in `buildCoralStyle` — only Contrast + density are net-new. | Contrast palette + density layer-filtering is real styling work (every layer's paint must have a contrast/density variant); easy to ship a half-styled Contrast mode. |
| Removes a misleading control (a Sat/Terr/Hybrid lie under MapLibre). | Density semantics need definition (which labels/symbols drop at low density). |

**Preserved (recommended):** keep `MapViewPicker`/`useMapViewMode` mounted
**only on the Google fallback branch**; render the new base-style switch on the
MapLibre branch. This avoids any removal at all (additive) and keeps the
fallback honest. **Sacrificed:** nothing, if the picker is branch-scoped rather
than deleted. Deletion of the Google-path picker is a SEPARATE future Rule-A
item tied to retiring the Google renderer entirely.

### 4.3 AiStrip → adaptive AI card

**Files:** `src/components/map/sub/AiStrip.tsx`,
`src/components/map/hooks/useMapAiProposals.ts`, `aiTypes.ts`.

| Pros | Cons |
|---|---|
| The FSM already lens-adapts — extending to horizons is incremental. | `AiStrip` has 6 carefully-built render branches (Underway/Reorder/Ready route\|plan\|insight/Fetching/Paused/1-stop). A rewrite risks losing edge-case handling (fail-quiet, paused, 1-stop). |
| `focusDate`/`focusId` are already returned — "jump to / focus" is free backend. | A drawer-hosted card changes layout assumptions (the strip is a band today); must preserve the paint-first/no-spinner budget. |

**Preserved:** all 6 branches, the circuit-breaker `paused` state, fail-quiet
behavior, `rationale` rendering, accept/reorder/dismiss. **Sacrificed:** the
fixed top-band placement (moves into/atop the canvas + Routes drawer).
**Net:** re-home + extend, do not rewrite the FSM.

### 4.4 Coral chrome → neutral chrome

**Files:** `MapFilterBar.tsx` (controls + accessories),
`sub/MapViewPicker.tsx`, focus-ring styles across `src/components/map/**`,
consuming `var(--pulse-*)`.

| Pros | Cons |
|---|---|
| Enforces the coral budget (`CLAUDE.md §4`): coral = AI/live signal only. Improves signal clarity. | Pure cosmetic, but touches many files; risk of inconsistent neutral tokens if not centralized. |
| No backend change. | Must NOT strip coral from the AI strip, accepted-route polyline, or live chip (those ARE signal). |

**Preserved:** coral on AI card, accepted-route polyline, live-presence chip,
broadcast-active state. **Sacrificed:** rose/coral on filters, view controls,
focus rings. **Net:** token swap only.

### 4.5 ImAtFAB freeform/reverse-geocode → live geosearch

**Files:** `src/components/map/sub/ImAtFAB.tsx`,
`src/services/geosearchService.ts` (already real).

| Pros | Cons |
|---|---|
| Live autocomplete (Stadia) beats freeform-text + single reverse-geocode for "where am I". `geosearch` is REAL and deployed. | The `pulse:messages:draft` handoff and ack listener (`ImAtFAB.tsx:115-139` ↔ `Messages.tsx:1901-1934`) are working — must NOT be touched while swapping the resolver. |
| `result.type` (category) is available for richer picks at zero backend cost. | geosearch returns `[]` under 3 chars / on error — must handle gracefully (the GPS reverse-geocode label is the fallback). |

**Preserved:** the messages handoff, GPS reverse-geocode as fallback label, the
contact-pick + clipboard-fallback flow. **Sacrificed:** the freeform-only input.
**Net:** add geosearch as the primary resolver; keep reverseGeocode as fallback.

---

## 5. Phased implementation plan

Each phase is **independently shippable and flag-gated** behind `mapHorizon`
(default OFF). Commit at the end of each phase (`CLAUDE.md` §3 — commit each
unit before the next; new files/folders get a `git add` immediately so they
survive). Phases are ordered so the data layer and Rule-A approvals come before
any replacement.

> **Before P1:** obtain Rule-A approval for the §4.1 (tabs → scrubber) and
> §4.2 (Sat/Terr/Hybrid → base-style) replacements. The flag scaffold (P0) and
> the data-layer additions (P1) are purely additive and can proceed without it;
> the *replacement* phases (P5, P6) cannot.

### P0 — Flag scaffold (additive, no consumer)

- **Goal:** add `mapHorizon` (default OFF) with no behavior change.
- **Files:** `src/contexts/FeatureContext.tsx` (add `mapHorizon: boolean` to
  `FeatureFlags`, default `false` in `DEFAULT_FEATURES`; document it like the
  other flags). Optionally a hardcoded `<SettingsCard>` in
  `FeaturesLabsSettings.tsx` (like the MapLibre toggle).
- **New:** none.
- **Data-layer:** none.
- **Acceptance:** `npx tsc --noEmit` clean (no NEW errors — repo has ~1234
  pre-existing; gate on no-new per `reference_pulse_tsc_oom`); flag flips in
  Settings; Map renders identically.
- **Commit:** `feat(map): scaffold mapHorizon flag (default off)`.

### P1 — Data-layer windows ("Now" + "3 days") + Atlas-mode state (additive)

- **Goal:** add the two missing windows and an `atlasMode` boolean to the data
  layer WITHOUT changing the UI (still TODAY/WEEK/ATLAS tabs).
- **Files:** `src/components/map/hooks/useGeoRelevanceSignals.ts`
  (extend the memo `:115-152`: add `nowEvents` = `[now, now + NOW_MS)` and
  `threeDayEvents` = `[now − DAY_MS, now + 3·DAY_MS)` derivations on the
  already-fetched event set; add to the `GeoSignals` shape `:23-30`); add
  `NOW_MS` / `THREE_DAY_MS` constants to `src/components/map/sub/mapLens.ts`
  next to `DAY_MS`/`WEEK_MS`. Extend `lensIncludesContact` `:55-80` with
  `now`/`3d` branches (PRESERVE existing branches; ADD new ones).
- **New:** none (constants only).
- **Data-layer changes:** new windows are pure derivations on
  `geoSignals` events already fetched out to `now + WEEK_MS` — **no new fetch,
  no schema touch.** Atlas-mode boolean is local state, computed alongside (not
  replacing) the `MapLens` enum so consumers keep working.
- **Acceptance:** unit-test the window math (Vitest) for boundary cases
  (event at `now`, at `now+3h`, at `now+3d`); existing tabs unaffected;
  `lensIncludesContact` returns identical results for `today`/`week`/`atlas`.
- **Commit:** `feat(map): add Now + 3-day relevance windows + atlasMode state`.

### P2 — Honest stubs registry (ui_only_no_backend surfaces named, not faked)

- **Goal:** before building drawers, enumerate every `ui_only_no_backend`
  capability so later phases don't accidentally ship a Sat/Terr/Hybrid-style
  lie. This is a code-comment + small constants pass, not a feature.
- **Files:** a single `src/components/map/horizon/horizonStubs.ts` constants
  file listing the not-yet-real surfaces (Contrast style, density, all-geofences
  ring overlay, `completion_geofence`, `share_level` down-sampling, provider
  provenance chip, event/meeting durable places) with a one-line "honest
  fallback" note each. Consumed by drawers in later phases to render disabled/
  "coming soon" states truthfully.
- **New:** `horizon/horizonStubs.ts`.
- **Acceptance:** file `git add`ed + committed; imported nowhere yet (or by a
  type-check-only test).
- **Commit:** `chore(map): register Horizon ui_only_no_backend stubs honestly`.

### P3 — Base-style switch (Light/Dark exist; Contrast + density net-new), behind flag

- **Goal:** replace the dead Sat/Terr/Hybrid picker (MapLibre branch ONLY) with
  Light/Dark/Contrast + density.
- **Files:** `src/components/map/provider/coralCockpitStyle.ts` (add a Contrast
  palette variant + a `density` param that filters minor label/symbol layers);
  `src/components/map/provider/MapLibreCanvas.tsx` (thread the new style choice +
  density, re-`setStyle` on change — reuse the existing `styleEpoch`/
  `handleStyleSwapped` re-key path at `PulseMapView.tsx:124,194`); a new
  `src/components/map/horizon/BaseStyleSwitch.tsx` rendered in the chrome band
  when `mapHorizon` ON. Keep `MapViewPicker` mounted on the **Google fallback
  branch only** (§4.2 — no removal).
- **New:** `horizon/BaseStyleSwitch.tsx`; Contrast variant + density in
  `coralCockpitStyle.ts`.
- **Acceptance:** with `mapHorizon` ON, the switch changes the MapLibre style
  live (Light↔Dark↔Contrast) and density visibly drops minor labels; Contrast
  is fully styled (every layer has a contrast paint — no half-styled layers);
  Google fallback still shows Sat/Terr/Hybrid when `mapLibreRenderer` forced OFF.
- **Commit:** `feat(map): renderer-real base-style switch + density (mapHorizon)`.

### P4 — Adaptive AI card across horizons (re-home + extend, don't rewrite)

- **Goal:** extend the AI FSM to the new horizons + consume `focusDate`/`focusId`.
- **Files:** `src/components/map/hooks/useMapAiProposals.ts` (effect `:90-179`:
  branch `now`/`today` → `proposeRoute`, `3d`/`week` → `proposeWeekPlan`,
  `atlasMode` → `proposeAtlasInsight`); `src/components/map/sub/aiTypes.ts`
  (no shape change needed; optionally normalize `AcceptedRoute.path` to
  renderer-neutral `LatLngLiteral` — see P8); `src/components/map/sub/AiStrip.tsx`
  (add "jump to date" using `focusDate`, "focus contact" using `focusId`;
  preserve all 6 branches + paused).
- **New:** none (extend existing).
- **Data-layer:** consumes P1 windows.
- **Acceptance:** each horizon yields the correct proposal kind; `paused`
  persists across horizon switches; `focusDate`/`focusId` affordances work;
  fail-quiet preserved (no spinner on null); 1500ms budget honored.
- **Commit:** `feat(map): horizon-adaptive AI card + focusDate/focusId affordances`.

### P5 — Time-horizon scrubber + Atlas-mode toggle UI (Rule-A replacement; flag-gated)

- **Goal:** replace the 3 fixed tabs with the scrubber + Atlas toggle (MapLibre
  branch, `mapHorizon` ON only). **Requires §4.1 approval.**
- **Files:** new `src/components/map/horizon/HorizonScrubber.tsx` +
  `horizon/AtlasModeToggle.tsx`; `PulseMapView.tsx` (render scrubber instead of
  `MapLensRow` when `mapHorizon` ON; map scrubber detent → existing
  `MapLens`-compatible window so the rest of the pipeline is untouched; wire
  `atlasMode` boolean); keep `MapLensRow` for the OFF path. Update
  `useMapKeyboardShortcuts` + `useSrAnnouncer` for the scrubber (don't regress
  a11y).
- **New:** `horizon/HorizonScrubber.tsx`, `horizon/AtlasModeToggle.tsx`.
- **Acceptance:** scrubber moves through Now/Today/3d/Week and the marker set +
  AI card update per window; Atlas toggle zooms to network bounds
  (`useFitBounds`) + shows insight; keyboard + SR parity with the old tabs;
  with `mapHorizon` OFF, the old tabs render unchanged.
- **Commit:** `feat(map): Horizon scrubber + Atlas-mode toggle (mapHorizon)`.

### P6 — Coral-neutral chrome (Rule-A token swap; flag-gated)

- **Goal:** pull rose/coral off filters/view controls/focus rings under
  `mapHorizon`; keep coral on AI/live/route signals.
- **Files:** `MapFilterBar.tsx`, `horizon/BaseStyleSwitch.tsx`, focus-ring
  styles in `src/components/map/**`; consume `var(--pulse-*)` neutral tokens.
- **Acceptance:** filters/controls render neutral; AI strip, accepted-route
  polyline, live chip, broadcast-active state KEEP coral; no hardcoded colors
  (all via tokens).
- **Commit:** `refactor(map): coral=signal-only chrome under mapHorizon`.

### P7 — Realtime publication migration (UNBLOCKS Live drawer) + RLS hardening

- **Goal:** the single must-fix for live presence. **Schema-first: dry-run in a
  rolled-back transaction, then apply once** (`CLAUDE.md` §4).
- **Migration (additive):**
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;`
    (REQUIRED — `subscribeToUserLocation`/`useLivePresence` are wired-but-dead
    without it). Optionally add `eta_shares`, `geofence_events` for live
    ETA/transition feeds.
  - `ALTER FUNCTION public.set_places_updated_at() SET search_path = public, pg_temp;`
    (DB-baseline hardening).
  - Tighten `location_share_consents` write policy to subject-only (split the
    `own_consents` ALL policy into SELECT-both / write-subject-only) — **before**
    any consent UI (P9). **VERIFY the live policy via MCP first** — the
    migration files are stale.
  - Pin `[functions.maps-geocode|geosearch|directions|distance|route]
    verify_jwt = true` in `supabase/config.toml`.
- **Acceptance:** dry-run transaction completes clean; after apply, a second
  browser broadcasting causes the first browser's `useLivePresence` to receive
  UPDATE events (live marker override + live chip fire); `places` updates still
  work; consent rows can no longer be written by a viewer.
- **Commit:** `feat(map): publish user_locations to realtime + RLS/search_path hardening`.

### P8 — Live team first-class drawer (composes real backend; needs P7)

- **Goal:** promote Live team from sheet/pill to a right-side drawer.
- **Files:** new `src/components/map/horizon/LiveTeamDrawer.tsx` (re-home
  `LiveTeamView` content); move the broadcast trigger out of `MapFilterBar` into
  the drawer (keep the filter-bar pill for the OFF path); wire the "share my
  location" master switch to `setLocationSharing` (the unsurfaced real fn);
  display + populate `user_locations.location_label`; list active ETA shares
  (`listActiveShares`) with the 5-min grace-window awareness; normalize
  `AcceptedRoute.path` to renderer-neutral `LatLngLiteral` in `provider/types.ts`
  (consumed by `MapLibreAcceptedRoute`).
- **New:** `horizon/LiveTeamDrawer.tsx`.
- **Acceptance:** drawer lists broadcasting teammates (live, post-P7),
  share-my-location toggles `is_sharing`, active ETA shares listed with correct
  "arrived/canceled" grace messaging, consent rows manageable (subject-only
  writes post-P7).
- **Commit:** `feat(map): Live team first-class drawer (mapHorizon)`.

### P9 — Geofences first-class drawer + all-geofences ring overlay (composes real backend)

- **Goal:** promote geofences to a drawer; render rings; honestly surface the
  broadcast dependency.
- **Files:** new `src/components/map/horizon/GeofencesDrawer.tsx` (list
  `listUserPlaces` where `geofence_radius_m IS NOT NULL`; toggle radii via
  `setPlaceGeofence`; show `geofence_events` history; wire the dead
  `surfaced`/`surfaced_at` "mark reviewed" affordance — net-new producer/
  consumer; render `payload` context if present); new all-geofences ring
  overlay per renderer (`horizon/MapLibreGeofenceRings.tsx`, mirroring
  `MapLibreAtlasHalos`'s equirectangular-polygon approach). Surface "Geofence
  alerts require Live location ON" prominently.
- **New:** `horizon/GeofencesDrawer.tsx`, `horizon/MapLibreGeofenceRings.tsx`.
- **Acceptance:** drawer lists geofenced places + recent transitions; rings
  render on the MapLibre map; radius toggle persists; "mark reviewed" sets
  `surfaced`; the broadcast dependency is visible and truthful.
- **Commit:** `feat(map): Geofences drawer + all-geofences ring overlay (mapHorizon)`.

### P10 — Routes & planning first-class drawer (composes real backend)

- **Goal:** promote route accept/reorder/dismiss + plan + OS-maps into a drawer.
- **Files:** new `src/components/map/horizon/RoutesDrawer.tsx` (host
  accept/reorder/dismiss from `useMapAiProposals`, "Open in Maps" via
  `buildMultiStopDirectionsUrl`, plan summaries from `proposeWeekPlan` with the
  `focusDate` jump; show accepted-route ETA/`arrivesAt`).
- **New:** `horizon/RoutesDrawer.tsx`.
- **Acceptance:** accept a route → coral polyline + ETA in drawer; reorder
  updates the route; "Open in Maps" opens the full sequence; dismiss clears and
  re-enables proposals.
- **Commit:** `feat(map): Routes & planning first-class drawer (mapHorizon)`.

### P11 — "I'm at…" on live geosearch (preserve the messages handoff)

- **Goal:** swap ImAtFAB's resolver to `geosearch`; keep reverseGeocode fallback
  + the working messages handoff.
- **Files:** `src/components/map/sub/ImAtFAB.tsx` (add a `GeoSearchInput`-style
  autocomplete via `geosearchService.geosearch`; keep `reverseGeocode` for the
  GPS-dot default; optionally surface `result.type` category). **Do NOT touch**
  the `pulse:messages:draft` dispatch/ack (`:115-139`) or `Messages.tsx`'s
  listener.
- **Acceptance:** typing ≥3 chars shows live suggestions; pick → draft to
  Messages still works (handoff + ack intact); GPS-only path still falls back to
  reverseGeocode label.
- **Commit:** `feat(map): I'm at sheet on live geosearch (mapHorizon)`.

### P12 — Cross-entity markers (tasks + decisions on the Map) — surface orphaned real capability

- **Goal:** plot the real-but-homeless task places + decision venues on the main
  Map (MapLibre-native; static/refetch, NOT subscribed).
- **Files:** `App.tsx` (pass a `tasks` (and decisions) prop into `PulseMapView`
  — `PulseMapViewProps` `:67-88` currently has neither); `PulseMapView.tsx`
  (read `entity_places` for `task`/`decision` via `getPlacesForEntity` /
  `getEntityPlaceMap`, build a marker layer reusing the `*Body` renderer-
  portability seam — do NOT lift `SearchMapView`'s Google path);
  refetch-on-focus (entity_places has no realtime + no UPDATE RLS — markers are
  static). Optionally consume `places.color`/`places.notes`.
- **New:** a cross-entity marker layer component (MapLibre-native).
- **Acceptance:** tasks with a place + decisions with a venue render as markers
  under `mapHorizon`; a place reassignment shows after refetch (no live update,
  by design); coral NOT used for these (they're not signal).
- **Commit:** `feat(map): plot task places + decision venues on the Map (mapHorizon)`.

### Honest-stub phase (folded into P3/P9, called out)

Anything `ui_only_no_backend` ships as a **truthful disabled/"coming soon"
state**, never as a working-looking control: Contrast/density (build them in
P3 — don't fake), all-geofences ring overlay (build in P9), `share_level`
non-precise levels (P8 — either implement coarsening or disable the option with
a note), `completion_geofence` and event/meeting durable places (DEFERRED, §8),
provider-provenance chip and geosearch category (optional, zero/partial
backend — gate appropriately).

---

## 6. Flag strategy

- **New flag:** `mapHorizon: boolean`, **default `false`** in
  `DEFAULT_FEATURES` (`FeatureContext.tsx`). Document it inline like the other
  flags (what it gates, default rationale).
- **Coexistence:**
  - `mapHorizon` gates the **new Horizon UX** (scrubber, Atlas-mode toggle,
    base-style switch, neutral chrome, the three drawers, geosearch I'm-at,
    cross-entity markers). When OFF, the Map renders **exactly** as today
    (`MapLensRow` tabs, `MapViewPicker`, AiStrip band, sheets/pills).
  - `mapHorizon` assumes `mapLibreRenderer` ON (the live default). The Horizon
    surfaces target the MapLibre branch. On the Google fallback branch
    (`mapLibreRenderer` forced OFF), the Horizon UX should **fall back to the
    legacy tabs/picker** (don't render the base-style switch — it's MapLibre-
    only). Treat `mapHorizon && mapLibreOn` as the activation condition for the
    renderer-coupled pieces.
  - `experimentalEnabled` still gates Map **reachability** (nav). Horizon does
    NOT change that; the Map stays in the Experimental section unless the user
    decides to graduate it (§7). Note `App.tsx:1465-1480` renders the Map
    without re-checking `experimentalEnabled`, so a deep link reaches Horizon
    too once `mapHorizon` is ON — acceptable for dev/beta.
- **Graduation (later):** when `mapHorizon` flips OFF→ON by default, you **must
  bump `FLAGS_VERSION`** and add `merged.mapHorizon = DEFAULT_FEATURES.mapHorizon`
  to the migration block (`FeatureContext.tsx:190-195`), or persisted `false`
  blobs mask the flip (same mechanism that graduated `mapLibreRenderer`).
- **Rollback path:** flip `mapHorizon` OFF (Settings or `localStorage
  pulse_feature_flags`) → instant return to the legacy Map; no data migration to
  reverse (P1 windows are additive derivations; P7's realtime publication +
  search_path are additive/idempotent and harmless to the legacy UI). The P7
  RLS tightening (consent write policy) is the only non-UI change — it is a
  security improvement and should NOT be rolled back with the flag.

---

## 7. Open questions / decisions for the user

1. **What does "Now" mean precisely?** Proposed `[now, now + 3h)` for events
   AND/OR "the single nearest un-visited stop." Pick one or both. (Affects
   `NOW_MS` and the `lensIncludesContact('now', ...)` branch.)
2. **Should tasks and decisions plot as stops on the Map?** They're real-but-
   homeless (P12). Yes = surface a genuine orphaned capability; but it adds
   marker types and a `tasks`/`decisions` prop to `PulseMapView`. Confirm scope.
3. **Background/server geofencing is Horizon-2.** Today geofence detection runs
   ONLY while broadcast is active (client-side). Do we (a) ship the Geofences
   drawer with an honest "requires Live location ON" banner now, or (b) hold the
   drawer until server-side detection exists? Recommend (a).
4. **Does Horizon graduate the Map out of the Experimental section?**
   (`experimentalEnabled`.) If yes, that's a separate nav change with its own
   launch-readiness bar (SMS/push/etc. are unrelated, but the Map's live-presence
   depends on P7).
5. **`share_level` (approximate / city_only):** implement coordinate
   coarsening (net-new backend) or disable the non-precise options with a
   "precise only for now" note? Shipping the selector without coarsening is a
   privacy lie. Recommend disable-with-note until coarsening is built.
6. **Density semantics:** which labels/symbols drop at low density? Need a
   concrete rule before P3 (e.g. low = POI labels off, road labels thinned).
7. **Provider provenance chip** (Stadia/Photon): worth surfacing? It's free on
   geosearch but net-new backend on the other four maps fns. Likely DEFER.

---

## 8. Deferred (explicitly out of scope for v1)

- **Server-side geofence detection** (always-on, not broadcast-coupled) — a
  Horizon-2 backend project (Edge/cron + a server trigger). v1 surfaces the
  client engine honestly with the broadcast dependency stated.
- **`completion_geofence` ("auto-complete task on arrival")** — needs a net-new
  producer (`attachPlaceToEntity role=completion_geofence`) AND a
  `geofence_events` enter → task-complete consumer. The whole loop is unbuilt.
- **Event/meeting durable places** — net-new producer; events stay on ad-hoc
  `event.location` text-geocoding for v1 (re-geocode each session, no geofence).
- **`share_level` coordinate coarsening** — net-new backend; v1 disables the
  non-precise options (see §7.5).
- **Plan/tier entitlement gating on Map drawers** — none exists today; if any
  drawer goes paid it's net-new (`useEntitlements.canUseFeature`). v1 ships all
  drawers ungated (matching today's posture).
- **Provider-provenance chip on the four non-geosearch fns** — net-new backend
  (they emit no `provider`). v1 defers.
- **`SearchMapView` MapLibre migration** — separate Rule-A item; v1 leaves it
  Google-hardcoded and does NOT lift its code into the main Map.
- **`mapboxService` / `Tools.tsx` removal** — orphaned dead code; a future
  Rule-A pros/cons proposal, not part of Horizon.
- **Realtime for `eta_shares` / `geofence_events`** (live ETA progress / live
  transition feed) — P7 must add `user_locations`; the other two are OPTIONAL in
  v1 (ETA tick + visited-stops poll remain acceptable). Add later for live feeds.
- **Multiplexing `useLivePresence` to one channel** — O(N)-channels is fine at
  current team scale; revisit only if scale demands.

---

## 9. Corrections log (so future sessions don't repeat stale assumptions)

1. **`mapLibreRenderer` is DEFAULT ON.** Graduated 2026-06-15
   (`FeatureContext.tsx:164` + `FLAGS_VERSION=1` migration `:190-195`). The LIVE
   map is MapLibre "Coral Cockpit" (OpenFreeMap/OSM vector), NOT Google. Any doc
   or comment implying Google is live is stale.
2. **Sat/Terr/Hybrid is a DEAD control under MapLibre.** `viewMode` reaches only
   `<GoogleMap mapTypeId>` (`PulseMapView.tsx:810`); `MapLibreCanvas` never reads
   it. Replaced by the base-style switch in D.
3. **`user_locations` is NOT in `supabase_realtime`** — live `pg_publication_tables`
   returned `[]` for all 6 geo tables. So `subscribeToUserLocation` /
   `useLivePresence` receive **nothing**; live presence is **wired-but-dead**.
   Earlier inventories that called this a working REAL channel are WRONG — it is
   `partial/broken-pending-migration`. The marker live-override, live chip, and
   LiveBroadcastSheet all depend on a feed that cannot fire until P7's
   `ALTER PUBLICATION ... ADD TABLE user_locations`. (Also affects `eta_shares`,
   `geofence_events` — both absent; public ETA viewer + geofence feed are
   write-only/poll-only by necessity, not choice.)
4. **`places` RLS migration files are STALE.** `20260503000008` uses
   `wm.role IN ('owner','admin')`, but `20260521000010_places_rls_to_user_has_permission.sql`
   superseded it — live policies use `user_has_permission(workspace_id,'workspace.update')`.
   Read the LIVE policy via MCP, not the migration file (confirms `CLAUDE.md`'s
   "migration file is stale" rule for this exact table).
5. **`geofence_events.surfaced` / `surfaced_at` / `payload` are DEAD columns**,
   not "partial." The INSERT (`geofenceService.ts:214-224`) never writes them; no
   SELECT reads them; the `geofence_events_update_surfaced` RLS policy gates a
   mutation no code uses. They are schema-ready-but-unwired (D's Geofences drawer
   would be their first producer/consumer).
6. **`user_locations.location_label` is half-wired** (omitted from earlier
   column dumps): a real Dashboard READER (`TeamRadarTile.tsx:156-159` via
   `subscribeToUserLocation:883`) but ZERO producer (`startLocationBroadcast`
   upsert `:819-831` never sets it) → always null. D's Live drawer should
   display AND populate it.
7. **The "I'm at…" → Messages handoff is REAL and bidirectional.** The in-code
   comments at `ImAtFAB.tsx:8` / `PulseMapView.tsx:1074-1075` ("Messages doesn't
   pick this up") are STALE/FALSE — `Messages.tsx:1901-1934` listens, opens/
   creates the thread, prefills, and acks. Do NOT "fix" this non-bug or strip the
   working path. (The clipboard copy is now a redundant fallback.)
8. **MapLibre marker/cluster/coral PARITY IS COMPLETE.** The in-file
   "still pending P2/P3" comments (`PulseMapView.tsx:668-669,703,726-729`)
   contradict the shipped code directly below them (full `computeMarkerLayout`,
   meeting markers, cluster discs, spider lines, Coral Cockpit style). The
   "MapLibre markers pending" claim is STALE — treat parity as done.
9. **`buildCoralStyle` is TWO-STATE ONLY** (light/dark via `isDarkMode`) — no
   Contrast variant, no density param. The "density" in `AtlasHalos`/
   `MapLibreAtlasHalos` is Atlas contact-cluster HEAT rendering, NOT a UI density
   toggle. D's Contrast + density are NET-NEW; do not assume a density backend
   exists.
10. **There is no dedicated "maps proposal branch" in `ai-router`.** Map AI
    proposals are CLIENT-orchestrated in `mapAIService.ts` over three PRE-EXISTING
    generic task types (`calendar_prep`, `task_prioritization`, `proactive_nudge`)
    — not map-specific router tasks.
11. **`WeekProposal.focusDate` / `AtlasProposal.focusId` are returned-but-dead**
    (confirmed at the consumer: `AiStrip.tsx:415` reads only `.summary`;
    `rationale` IS read at `:325`). D's "jump to / focus" affordance = net-new UI
    on EXISTING backend, not a backend change.
12. **The 5 `maps-*` edge fns are NOT declared in `config.toml`** — they rely on
    the undeclared platform `verify_jwt=true` default. Pin them explicitly in P7.
13. **`entity_places` has NO realtime + NO UPDATE RLS** (rows replaced via
    composite PK). D's cross-entity (task/decision) markers will be STATIC —
    refetch/poll, never subscribe.
14. **`eta_shares.token` is 32 chars** (service strips hyphens; route regex is
    `^/eta/([a-f0-9]{32})$`). The migration comment (`20260514000002` L24-25)
    saying "36 chars" is STALE — the live column is length-agnostic TEXT UNIQUE;
    the 32-char service behavior is authoritative.
15. **`get_eta_share_by_token` has a 5-minute grace window** (`20260514000002`
    L119-128) — recently arrived/canceled/expired shares stay visible 5 min, not
    just `active`. Live-drawer / "your share just ended" messaging must account
    for it.
16. **`set_places_updated_at()` lacks a pinned `search_path` and is not
    SECURITY DEFINER** (live `pg_proc`: `prosecdef=false, proconfig=null`) — the
    lone DB-baseline violation among geo routines. Also fires BEFORE UPDATE only,
    so `updated_at == created_at` until first edit. Harden + handle the sort
    quirk in P7.
17. **`location_share_consents.own_consents` is an ALL policy keyed on
    `(subject OR viewer)`** — a VIEWER can write/grant consent rows. Tighten to
    subject-only writes BEFORE any consent UI (P7) — it's a privacy footgun, a
    backend item that must precede the UI.
18. **`mapboxService` is orphaned** (reachable only via the unrendered
    `Tools.tsx`). A FUTURE Rule-A removal candidate — NOT authorization to delete;
    Horizon ignores it.

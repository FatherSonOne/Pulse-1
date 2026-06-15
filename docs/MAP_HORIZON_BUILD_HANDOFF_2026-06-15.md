# Map — Horizon (Direction D) Build Playbook (P0–P13)

| | |
|---|---|
| **Doc** | `docs/MAP_HORIZON_BUILD_HANDOFF_2026-06-15.md` |
| **Date** | 2026-06-15 |
| **Status** | Ready to execute — proposal; Rule-A phases (P3, P5, P6, P7, P8, P13) need explicit pros/cons approval before execution |
| **Flag** | `mapHorizon` (boolean, default `false`) — added in P0; `?ff_mapHorizon=on|off` dev override mirrors `useMapLibreRenderer` (the reader is net-new, added in P0/P5) |
| **Strategic source** | `docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md` — owns the §3 backend→UI matrix and the §4 Rule-A pros/cons. This doc is the EXECUTION companion: self-contained, but cites "strategic §X" for the matrix and pros/cons rather than reproducing them. |
| **Predecessor handoffs** | `docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md` (strategic direction), and the map-redesign lineage it supersedes — see memory `project_pulse_map_redesign` (TODAY/WEEK/ATLAS triage-first hybrid) and `project_pulse_contacts_maps_roadmap` (5-phase stabilize→spatial plan). Reference mock: `_design-playground/maps-redesign.html` (Direction-D). |

> This playbook reflects the locked user decisions of 2026-06-15: **"Now" detent = nearest un-visited stop AND events in `[now, now+3h)` (BOTH), `NOW_MS = 3h`**; **tasks + decisions plot on the Map (P12 in scope)**; **the Map graduates out of Experimental (P13), gated on P7 + a launch-readiness pass.**

---

## How to use this doc

1. **One phase per session / work-unit.** Each phase is a complete, self-contained unit with its own gate, files, steps, acceptance criteria, verify commands, commit, and rollback. Do not start a phase until its **Depends on** are satisfied.
2. **Commit at every phase boundary.** Each phase ends with a conventional-commit message; run it before starting the next phase. Multi-phase work that leaves a phase uncommitted is the documented Pulse lost-work failure mode (CLAUDE.md §3).
3. **`git add` new files the moment you create them** (CLAUDE.md §1 "the one rule that matters"). Every phase that introduces a new file or the `src/components/map/horizon/` directory must `git add` it immediately — untracked files are the state most at risk in this repo.
4. **Every phase is independently shippable behind `mapHorizon` (default OFF).** With the flag off, the live Map is byte-for-byte the current Coral Cockpit. Shipping a phase to `main` is safe because no default-user behavior changes until P13 (and only then with approval).
5. **Rule-A phases require explicit pros/cons approval BEFORE execution.** P3, P5, P6, P7, P8, and P13 each replace or materially alter a working surface (control, policy, default-visible nav). Before executing any of them, present the exact files/lines + a Pros/Cons list and WAIT for approval — see strategic §4 for the pre-written pros/cons. Auditing/planning a Rule-A phase is allowed at any time; executing it is not.
6. **P7 must dry-run before apply.** The realtime publication + RLS migration runs inside a `DO $$ … RAISE EXCEPTION 'rollback' $$` wrapper first (must abort ONLY on the intentional rollback), then applies once via `apply_migration`. Never apply-then-debug against the live function (CLAUDE.md schema-first).
7. **P13 is last and gated.** It graduates the Map out of Experimental and changes default-visible surface area. Execute only after P7 is live (`user_locations` published to `supabase_realtime`, re-verified) AND a launch-readiness pass on the Map's surfaces is complete.

---

## Dependency DAG

```
P0  flag scaffold ─────────────────────────────────────────────┐  (root; everything reads the flag)
 │                                                              │
 ├─► P1  data-layer windows (Now 3h + 3-day, PURE DATA) ──► P5  │
 │        (adds NOW_MS/THREE_DAY_MS + nowEvents/threeDayEvents;   │
 │         does NOT widen MapLens or touch lensIncludesContact)   │
 │                                                              │
 ├─► P2  honest-stubs registry ──► P3 (graduates 2 stub rows)   │
 │                                                              │
 ├─► P3  base-style switch + density [Rule-A §4.2] ──► P5, P6   │
 │        (P3 after P0/P2; P4 after P0/P1; both parallelizable)  │
 │                                                              │
 ├─► P4  adaptive AI card ──(soft)──► P5, P10                   │
 │                                                              │
 ├─► P5  scrubber + Atlas toggle [Rule-A §4.1]  (needs P0,P1)   │
 │        └─► P6 (neutralizes the now-neutral chrome)           │
 │                                                              │
 ├─► P6  coral-neutral chrome [Rule-A §4.4]  (needs P0, P5)     │
 │                                                              │
 ├─► P7  realtime publication + RLS [Rule-A §4]  (STANDALONE) ──► P8, P13
 │                                                              │
 ├─► P8  live team drawer [Rule-A §3.3/§4]  (needs P0, P7)      │
 │                                                              │
 ├─► P9  geofences drawer + rings  (needs P0; indep of P7)      │
 ├─► P10 routes & planning drawer  (needs P0, P3)               │
 ├─► P11 "I'm at…" live geosearch  (needs P0; standalone)       │
 ├─► P12 cross-entity markers      (needs P0; standalone)       │
 │                                                              │
 └─► P13 graduate Map out of Experimental [Rule-A §4]
          NEEDS P7 (live) + launch-readiness pass — LAST PHASE
```

Ordered reading:
- **P0 first, always** — it adds the flag every later phase reads.
- **After P0/P1:** P2, P3, P4 are parallelizable (independent surfaces). P1 is the data prerequisite for P5.
- **P3** depends on **P0, P2** only — NOT P1 (P1 is the data layer for the scrubber, not for the base-style switch). **P5** needs P0 + P1 (and Rule-A §4.1 approval). **P6** needs P0 + P5 (and Rule-A §4.4 approval) — it neutralizes the chrome P5 introduced plus pre-existing filter chrome.
- **P7** is standalone (DB/config only) but **blocks P8 and P13**.
- **P8** needs P7 (publishes `user_locations`) — without it the live list is wired-but-dead.
- **P9, P10, P11, P12** are mutually independent feature drawers/overlays; each needs only P0 (P10 also wants P3's shell).
- **P13 is last** and gated on P7-live + launch-readiness.

**SAFE-TO-START-NOW (additive, no approval):** **P0, P1, P2, P4, P9, P10, P11, P12.**
**GATED (do not execute without the cited approval/precondition):** **P3** (Rule-A §4.2), **P5** (Rule-A §4.1), **P6** (Rule-A §4.4), **P7** (Rule-A §4 — dry-run first), **P8** (Rule-A §3.3/§4 + P7-live), **P13** (Rule-A §4 + P7-live + launch-readiness).

---

## Global conventions

- **Flag pattern.** All net-new Horizon behavior is gated on `mapHorizon` (FeatureContext, default `false`). Read it through a dedicated resolver `useMapHorizon()` that mirrors `provider/useMapLibreRenderer.ts` exactly: `readDevOverride() ?? features.mapHorizon` (the inlined `readDevOverride` keys `ff_mapHorizon`), supporting the `?ff_mapHorizon=on|off` URL override for manual verification. **There is NO generic `ff_mapHorizon` reader today** — `lib/featureFlags.ts:readDevOverride` (:327-349) only serves flags in that lib's own config; `mapHorizon` is a FeatureContext flag with no `ff_` parser until `useMapHorizon` exists. So **P0 creates `src/components/map/provider/useMapHorizon.ts`** (verbatim clone of `useMapLibreRenderer.ts`, key `ff_mapHorizon`, flag `features.mapHorizon`) — the `?ff_mapHorizon=on` override only works once that hook is added, so P0 must add it for every later phase's eyeball step (P0/P1/P2/P4 verify with `?ff_mapHorizon=on`) to be valid. Components either consume the hook or receive `mapHorizon` as a threaded prop (preferred for testable leaf components).
- **`FLAGS_VERSION` bump rule.** A net-new flag defaulting to `false` does NOT require a `FLAGS_VERSION` bump — the `{ ...DEFAULT_FEATURES, ...parsed }` merge backfills `false` for keys absent from a persisted blob, so a stale blob cannot mask it. **Only bump `FLAGS_VERSION` (and add a one-time migration line in the loader) when flipping an EXISTING flag's default** so the new default overrides a stale persisted value. This is the rule for any future `mapHorizon: true` default flip (P13 optional) — never bump it for the P0 scaffold.
- **New-component home.** All net-new Horizon UI lives under **`src/components/map/horizon/`** (created + `git add`ed in P2). New hooks may live in `src/components/map/hooks/`; new MapLibre overlays in `src/components/map/provider/`. The flag resolver lives at `src/components/map/provider/useMapHorizon.ts` (or `hooks/useMapHorizon.ts` — be consistent; pick one and reference it everywhere).
- **Coral = signal ONLY.** `--pulse-coral` / rose is reserved for the four real signals: the AI strip/card, the accepted-route polyline, the live-presence chip, and the broadcast-active state (plus geofence rings, which are a live/route signal). All new chrome — scrubber detents, Atlas toggle, base-style switch, filter chips, drawer headers, task/decision markers — must be neutral `var(--pulse-*)` (CLAUDE.md §4). Never redeclare colors locally; tokens are canonical at `src/styles/pulse-tokens.css`.
- **Commit each phase before the next.** Conventional-commit form, HEREDOC body, signed `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do not batch unrelated phases into one commit.
- **`mapHorizon` assumes `mapLibreRenderer` ON.** The live Map renders on MapLibre by default (`mapLibreRenderer: true`, FeatureContext.tsx:164). Renderer-coupled Horizon pieces (base-style switch, geofence rings, entity markers, the MapLibre marker portals) gate on `mapLibreOn && mapHorizonOn` and fall back to legacy on the Google branch — they do not render on the Google fallback. Pure-data/UI pieces (scrubber, AI card, drawers' non-map content) work on either renderer but are still flag-gated.

---

## Global verification

- **Type-check:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — the heap flag is mandatory; the default heap OOMs and reports a false "clean" (memory `reference_pulse_tsc_oom`). The repo carries **~1234 pre-existing type errors** (vite/esbuild skip type-check), so **gate on NO NEW errors**, never zero. Scope each phase's check with a `grep -E "<changed-files>"` filter. **Do NOT run two full-repo `tsc` passes at once** — two concurrent full tscs OOM the box and crash the host (exit `0xC0000409`).
- **Unit/integration tests:** `npm run test` (Vitest) — gate on no new failures.
- **Backend-dependent surfaces:** `npm run dev:full` (NOT `npm run dev`) — required for any surface hitting an edge fn or `server.js`: Live presence, Geofences, Routes (`maps-route`/`maps-directions`), `location_label` reverse-geocode, and the "I'm at…" geosearch. "Failed to fetch" = backend down; JSON errors (`invalid_auth`/`missing_scope`) = token (memory `reference_pulse_backend_local_dev`).
- **Manual eyeball:** load with `?ff_mapLibreRenderer=on&ff_mapHorizon=on` (Experimental Features must be enabled to open the Map until P13). Confirm the OFF path (`?ff_mapHorizon=off`) is byte-identical to today for every phase.
- **Schema/RLS truth:** for any DB phase, verify live via the Supabase MCP (project ref `ucaeuszgoihoyrvhewxk`) — `mcp__claude_ai_Supabase__execute_sql` / `list_tables` / `get_advisors` — never trust migration files alone (Pulse RLS files are documented to drift from live).
- **Reference mock:** `_design-playground/maps-redesign.html` (Direction-D) is the visual target for the scrubber, drawers, and base-style switch.

---

## Risk register

| Risk | Phase | Mitigation |
|---|---|---|
| **`MapLens` consumer drift** — the canonical design does NOT widen `MapLens`; P5 keeps the `'today' \| 'week' \| 'atlas'` enum and adds a SEPARATE `MapHorizon` (`'now' \| 'today' \| 'threeDay' \| 'week'`) mapped to `MapLens` via `horizonToLens`. The risk is a future change that widens the enum instead. | P5 | Do NOT widen `MapLens`; do NOT rewrite `lensIncludesContact` (it stays binary `today`/`week` and works because `horizonToLens` only ever yields `'today'`/`'week'`/`'atlas'`). Keep `'now'`/`'threeDay'` granularity in P5's post-filter. Derive `effectiveLens` so no `'now'`/`'threeDay'` ever reaches a `MapLens` consumer (P5 uses `horizonToLens`). |
| **A11y regression** — scrubber/drawer/AI-affordance replace keyboard + SR-tested controls; reorder-list focus management is load-bearing. | P5, P8, P9, P10 | Copy `role="group"`/`aria-pressed`/`aria-keyshortcuts` from `MapLensRow`; copy `useDialogA11y` focus-trap from `LiveBroadcastSheet`; copy the `requestAnimationFrame`+`focusRowByIdx` reorder pattern intact; add a horizon-label SR announcer mirroring the lens announcer. Verify each detent fires one announcement. |
| **Half-styled Contrast palette** — `buildCoralStyle` is two-state; a new `CONTRAST` palette must fill all 17 `CoralPalette` fields or layers render with `undefined` paint. | P3 | `CONTRAST` must fill every field of the `CoralPalette` shape (coralCockpitStyle.ts:43-61 — the 17 fields: `canvas, landNatural, park, water, building, roadLocal, roadArterial, roadHighwayFill, roadHighwayStroke, boundary, labelText, labelHalo, waterLabel, roadLabel, roadLabelHalo, adminLabel, localityLabel`); keep rose ONLY on `roadHighwayFill`/`roadHighwayStroke` (the motorway); tune in the eyeball pass. Preserve the boolean overload + the `OPENFREEMAP_STYLE` string fallback so the Google/Horizon-off paths are byte-identical. |
| **Realtime migration leaking or breaking broadcast** — publishing `user_locations` + splitting the consent ALL policy could expose data or block the working broadcast-recipient flow. | P7 | Realtime honors RLS — `consented_location_read` already gates reads. Dry-run the migration in a rolled-back `DO` block; confirm the 2-browser BROADCAST test still works after the consent split (the one functional risk); `get_advisors` after apply. |
| **Consent RLS footgun** — the old `own_consents` ALL policy has `with_check NULL`, so a viewer can self-grant consent; the fix must not break `setBroadcastRecipients` (broadcaster self-grants their viewers). | P7 | Split into read-both / write-subject-only. Verify the broadcast helpers write rows where `subject_user_id = broadcaster = auth.uid()` so they still pass `consents_insert_subject`. Test BROADCAST end-to-end post-split. |
| **Touching the working "I'm at…" handoff** — the `pulse:messages:draft` dispatch ↔ listener ↔ ack is real and bidirectional; an accidental edit breaks message prefill. | P11 (and P5 gotcha) | DO NOT touch `ImAtFAB.tsx:115-139` ↔ `PulseMapView.tsx:1069-1081` ↔ `Messages.tsx:1897-1929` (`src/components/Messages.tsx`, NOT a `Messages/` subdir). P11 changes only the `placeName` source. Watch the free-text-send trade-off (Rule-A pros/cons if load-bearing). |
| **`AcceptedRoute` Google-type coupling** — `AcceptedRoute.path` is typed `google.maps.LatLngLiteral[]`; retyping to renderer-neutral `LatLng[]` touches a shared type. | P8 (P4 if it lands first) | `provider/types.ts` already defines a structurally-compatible `LatLng`; the retype is type-only (consumers already accept `{lat;lng}[]`), zero-runtime. Coordinate so the retype happens once (P4 or P8, not both). |
| **N+1 entity-place fetch** — plotting tasks/decisions per-entity hits `getPlacesForEntity` in a loop. | P12 | Use `getEntityPlaceMap` + a single `places.in('id', ids)` batch (`getPlacesByIds`); refetch-on-focus (no realtime on `entity_places`/`places`). |
| **Half-graduated nav** — moving the Map item in only one of the two nav surfaces leaves it default on desktop but Experimental-gated on mobile. | P13 | Section-level move in BOTH `Sidebar.tsx:132` AND `mobileNavConfig.ts:92` (NOT `MobileNavSheet.tsx:54` — that's the consumer gate). Gate execution on P7-live + launch-readiness; keep the `mapHorizon` default flip as a separate optional decision. |

---

## At-a-glance phase table

| Phase | Title | Gate | Depends on | New files |
|---|---|---|---|---|
| **P0** | Flag scaffold | additive | — | none |
| **P1** | Data-layer windows (Now 3h + 3-day) | additive | P0 | `sub/__tests__/mapLens.test.ts`, `hooks/__tests__/useGeoRelevanceSignals.test.ts` |
| **P2** | Honest-stubs registry | additive | P0 | `horizon/horizonStubs.ts` |
| **P3** | Renderer-real base-style switch + density | Rule-A §4.2 | P0, P2 | `horizon/BaseStyleSwitch.tsx`, `provider/useMapHorizon.ts` (if not in P0) |
| **P4** | Adaptive AI card (+ owns `AcceptedRoute.path`→`LatLng[]` retype, type-only) | additive | P0 (+ scrubber soft) → **blocks P8 (retype)** | none |
| **P5** | Time-horizon scrubber + Atlas-mode toggle | Rule-A §4.1 | P0, P1 | `horizon/HorizonScrubber.tsx`, `horizon/AtlasModeToggle.tsx`, `provider/useMapHorizon.ts` (if not in P0/P3) |
| **P6** | Coral-neutral chrome (signal-only coral) | Rule-A §4.4 | P0, P5 | `horizon/mapHorizonTokens.ts` (optional) |
| **P7** | Realtime publication + RLS/security hardening | Rule-A §4 | — (blocks P8, P13) | `supabase/migrations/20260616000001_map_horizon_realtime_and_rls.sql` |
| **P8** | Live team first-class drawer | Rule-A §3.3/§4 | P0, P7, **P4 (owns `AcceptedRoute.path` retype — run first)** | `horizon/LiveTeamDrawer.tsx`, `horizon/useBroadcastControl.ts` |
| **P9** | Geofences drawer + all-geofences ring overlay | additive | P0 | `horizon/GeofencesDrawer.tsx`, `provider/MapLibreGeofenceRings.tsx` (+ `geofenceService` helpers) |
| **P10** | Routes & planning drawer | additive | P0, P3 | `horizon/RoutesDrawer.tsx` |
| **P11** | "I'm at…" on live geosearch | additive | P0 | none |
| **P12** | Cross-entity markers (tasks + decisions) | additive | P0 | `hooks/useEntityPlaceMarkers.ts`, `contacts/EntityPlaceMarker.tsx` (optional) |
| **P13** | Graduate Map out of Experimental | Rule-A §4 | P7 (live) + launch-readiness | none |

---

---

## Phases

I have full ground truth now. All citations from the prompt are confirmed accurate:
- `FeatureContext.tsx`: interface 15-103, `mapLibreRenderer` :92, `DEFAULT_FEATURES` :124-168, `mapLibreRenderer: true` :164, `FLAGS_VERSION` block :175 + migration :189-195, `FEATURE_NAMES` :362-379, `FEATURE_DESCRIPTIONS` :392-403, `FEATURE_CATEGORIES` :323-357.
- `FeaturesLabsSettings.tsx`: MapLibre `<SettingsCard>` :38-45.
- `mapLens.ts`: `DAY_MS`/`WEEK_MS` :18-19 confirmed.
- `useGeoRelevanceSignals.ts`: `GeoSignals` :23-30, `lensIncludesContact` :55-80, memo :115-152, all confirmed.
- `useVisitedStops.ts` (:19) → `getTodayVisitedContactStops` returns `Set<"${contactId}-home"|"${contactId}-work">` (geofenceService :267-286). One important correction: visited stops are keyed by **marker key** (`${id}-home`/`-work`), NOT by bare `contact.id` — the 'now' branch must account for this.

Here is the markdown for P0 and P1.

---

### P0 — Flag scaffold (additive)
**Gate:** additive (no approval) — and **Depends on:** none (this is the root phase).
**Goal:** Add a new `mapHorizon: boolean` feature flag (default `false`) to the canonical flag registry and surface an optional dev/test toggle in Features & Labs. Zero behavior change — no consumer reads it yet.
**Preconditions:**
- On `main`, clean working tree except the one pre-existing `M docs/RELAY_MOBILE_STUDIO_SHELL_HANDOFF_2026-06-15.md` (already dirty at session start — do NOT stage it). Confirm with `git status --short` before any commit; if anything else is dirty/untracked, STOP and surface it (CLAUDE.md pause-and-verify).
- `mapLibreRenderer` default is already `true` (FeatureContext.tsx:164) — do not touch it.

**Files to touch:**
- `src/contexts/FeatureContext.tsx` — **interface `FeatureFlags` :15–103**, after the `relayLiveRooms: boolean;` member (:102, last member before the closing `}` at :103) — add the `mapHorizon` member with a doc comment.
- `src/contexts/FeatureContext.tsx` — **`DEFAULT_FEATURES` :124–168**, after `relayLiveRooms: false,` (:167, last entry before closing `}` at :168) — add `mapHorizon: false,`.
- `src/contexts/FeatureContext.tsx` — **`FEATURE_NAMES` :362–379** (a *total* `Record<keyof FeatureFlags, string>` — TypeScript will error if `mapHorizon` is missing) — add `mapHorizon: 'Map Horizon (Beta)',` after the `relayLiveRooms` entry (:378).
- `src/contexts/FeatureContext.tsx` — **`FEATURE_DESCRIPTIONS` :392–403** (a `Partial<Record<...>>`, so this is optional but recommended for the Settings copy) — add a `mapHorizon` description.
- `src/contexts/FeatureContext.tsx` — **`FLAGS_VERSION` :175** — leave at `1`. **Do NOT bump it.** The version-bump migration block (:189–195) exists only to force a *changed* default over a stale persisted value. A net-new flag defaulting to `false` cannot be masked by a stale blob (it isn't in any persisted blob yet; `{ ...DEFAULT_FEATURES, ...parsed }` at :188 supplies `false` for keys absent from `parsed`), so no migration is needed. Note this reasoning in the commit body.
- `src/components/settings/FeaturesLabsSettings.tsx` — **after the MapLibre `<SettingsCard>` :38–45** — add a sibling `<SettingsCard>` with a `<ToggleItem>` mirroring the MapLibre one (the closest analogue), wired to `features.mapHorizon` / `toggleFeature('mapHorizon')`.

**New files:**
- `src/components/map/provider/useMapHorizon.ts` — flag resolver, **verbatim clone of `provider/useMapLibreRenderer.ts`** with `mapLibreRenderer`→`mapHorizon` and the inlined `readDevOverride` key `ff_mapLibreRenderer`→`ff_mapHorizon`. This is the ONLY `?ff_mapHorizon` reader in the codebase; without it the URL override is inert (there is no generic FeatureContext `ff_` parser). `git add` it immediately. Later phases (P3/P5) reference this hook rather than re-creating it.

**Steps:**
1. In `FeatureContext.tsx`, add the interface member immediately after `relayLiveRooms: boolean;` (:102):
   ```ts
   // Map Horizon redesign (Direction D) master switch. OFF by default → the Map
   // section renders the current Coral Cockpit (TODAY/WEEK/ATLAS lens triad on
   // MapLibre). ON → the Horizon shell (Now/3-day/Week/Atlas detents, renderer-
   // real base-style switch, tasks+decisions on the map, live presence once P7
   // publishes user_locations). Additive over the working map; every Horizon
   // surface is gated on this flag until launch-readiness (P13).
   // See docs/MAP_HORIZON_BUILD_HANDOFF_2026-06-15.md (P0–P13).
   mapHorizon: boolean;
   ```
2. In `DEFAULT_FEATURES`, add after `relayLiveRooms: false,` (:167):
   ```ts
   // Map Horizon OFF by default (dark-launch); P0 = flag scaffold only, no consumer.
   mapHorizon: false,
   ```
3. In `FEATURE_NAMES` (the TOTAL `Record<keyof FeatureFlags, string>`, :362-379), add after the `relayLiveRooms` entry — `relayLiveRooms` is the LAST entry at `:378`, record closes at `:379`:
   ```ts
   mapHorizon: 'Map Horizon (Beta)',
   ```
4. In `FEATURE_DESCRIPTIONS` (the `Partial<Record<...>>`, :392-403), add after the `logosVisionSync` entry — `logosVisionSync` is the LAST entry at `:402`, record closes at `:403`; note this Partial has NO `relayLiveRooms`/`mapLibreRenderer` entry, so the anchor differs from FEATURE_NAMES:
   ```ts
   mapHorizon: 'Reimagine the Map with the Horizon redesign (Now / 3-day / Week / Atlas time detents, live presence, tasks & decisions on the map). Requires Experimental Features on to open the Map. For testing & development.',
   ```
5. Do **not** add `mapHorizon` to any `FEATURE_CATEGORIES` array (:323–357) — those arrays render a generic toggle loop and adding it would double up with the explicit `<SettingsCard>` in step 6. The explicit card is the chosen surface (mirrors how `mapLibreRenderer` / `experimentalEnabled` / `emailEnabled` / `slackSend` each get their own card outside the category loop).
6. In `FeaturesLabsSettings.tsx`, insert directly after the MapLibre `<SettingsCard>` close (`</SettingsCard>` at :45), before the Email `<SettingsCard>` (:50):
   ```tsx
   {/* Map Horizon (Direction D) on/off. OFF (default) → the Map section renders
       the current Coral Cockpit. ON → the Horizon redesign shell. Requires
       Experimental Features on (and the Map) to be visible. Mirror of the
       ?ff_mapHorizon dev override, per-browser via Settings. For testing. */}
   <SettingsCard>
     <ToggleItem
       label="Map Horizon (Beta)"
       desc="When on, the Map section renders the Horizon redesign (Now / 3-day / Week / Atlas time detents, live presence, tasks & decisions on the map) instead of the current map. Requires Experimental Features on to open the Map. For testing & development."
       active={features.mapHorizon}
       onToggle={() => toggleFeature('mapHorizon')}
     />
   </SettingsCard>
   ```

**Data / schema / migration:** none.

**Code patterns:** plugs into the existing flag plumbing — no new shapes. The toggle helper signature it relies on:
```ts
// FeatureContext.tsx:113
toggleFeature: (featureId: keyof FeatureFlags, enabled?: boolean) => void;
// FeatureContext.tsx:362
export const FEATURE_NAMES: Record<keyof FeatureFlags, string> = { ... };  // TOTAL record — must list mapHorizon
```
The dev-override URL param (`?ff_mapHorizon=on`) is consumed by whatever generic `ff_*` reader already maps `ff_<key>` → `toggleFeature(<key>, true)` — verify it exists before relying on it in P0's eyeball step; if the repo has no generic `ff_` parser, toggle via Settings → Features & Labs or `localStorage.setItem('pulse_feature_flags', ...)` instead. (The strategic doc references `?ff_mapHorizon=on`; confirm the param plumbing in the App entry before quoting it in later phases.)

**Acceptance criteria:**
- `features.mapHorizon === false` on a fresh load (no persisted blob) and on a browser with an existing `pulse_feature_flags` blob (the spread at :188 backfills `false`).
- The Features & Labs panel shows a "Map Horizon (Beta)" toggle that flips and persists across reload (writes to `pulse_feature_flags` via the `:225–231` effect).
- No other flag's value changed; `mapLibreRenderer` is still `true`.
- Zero runtime behavior change anywhere outside Settings.

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "FeatureContext|FeaturesLabsSettings"` — must be empty (gate on NO NEW errors; repo carries ~1234 pre-existing). The total `FEATURE_NAMES` record is the most likely place a missing key would surface, so this check is the real gate.
- `npm run test -- FeatureContext` — passes if such a test exists; otherwise n/a.
- Manual: dev server → Settings → Features & Labs → toggle "Map Horizon (Beta)" on/off, reload, confirm it sticks. Then DevTools console: `JSON.parse(localStorage.pulse_feature_flags).mapHorizon` reflects the toggle.

**Commit:**
```
feat(map): scaffold mapHorizon feature flag (default off)

Add `mapHorizon: boolean` to FeatureFlags (default false) + the total
FEATURE_NAMES record + FEATURE_DESCRIPTIONS, and an optional Features &
Labs toggle mirroring mapLibreRenderer. No consumer yet — flag scaffold
only for the Map Horizon (Direction D) redesign. FLAGS_VERSION stays at 1:
a net-new false default can't be masked by a stale persisted blob (the
{...DEFAULT_FEATURES, ...parsed} merge backfills absent keys), so no
version-bump migration is required.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Rollback:** revert the single commit (`git revert <sha>`). The flag is defaulted-off with no consumer, so the revert is inert.

**Preserve-verbatim / gotchas:**
- **Do NOT bump `FLAGS_VERSION`** (:175) and do NOT touch the v1 migration block (:189–195) — that block force-resets `mapLibreRenderer` once-per-bump; bumping it would re-fire that reset on every existing browser for no reason.
- **Do NOT add `mapHorizon` to `FEATURE_CATEGORIES`** — it would render a second toggle alongside the explicit card.
- `FEATURE_NAMES` is `Record<keyof FeatureFlags, string>` (total) — omitting `mapHorizon` is a compile error; that's the safety net, lean on tsc.
- Don't restyle / reorder the surrounding `<SettingsCard>`s — additive insert only.

---

### P1 — Data-layer windows (additive)
**Gate:** additive (no approval) — and **Depends on:** P0 (flag exists; not strictly required for the pure-data extension — P1 adds no flag-gated behavior, only data the later Horizon consumer (P5) reads).
**Goal:** Extend the geo time-window math with a **Now** window `[now, now+3h)` and a **3-day** window `[now−DAY_MS, now+3·DAY_MS)` — adding `NOW_MS` / `THREE_DAY_MS` constants (in `mapLens.ts`) and two new derived event sets (`nowEvents`, `threeDayEvents`) on the `GeoSignals` bundle — **without altering** any existing `'today'`/`'week'`/`'atlas'` behavior. **P1 is PURE DATA: it does NOT widen the `MapLens` union and does NOT touch `lensIncludesContact`.** P5 owns the `MapHorizon` type, `horizonToLens`, and the granularity post-filter that consumes `nowEvents`/`threeDayEvents`.
**Preconditions:**
- P0 committed (or in the same working tree).
- The `MapLens` union is `'today' | 'week' | 'atlas'` (mapLens.ts:14) and **stays that way** — P1 does NOT widen it. The canonical design (P5) keeps the enum and adds a separate `MapHorizon` type mapped via `horizonToLens`, so no `switch`/ternary over `MapLens` ever becomes non-exhaustive and `lensIncludesContact` is never rewritten. **For P1, only the `mapLens.ts` constants (`NOW_MS`/`THREE_DAY_MS`), the `GeoSignals` shape, and the memo derivation change.** The PulseMapView consumer sites that branch on lens (e.g. :313, :765, :897) are untouched by P1 — P5 switches them to `effectiveLens` when it lands. P1 declares `NOW_MS`/`THREE_DAY_MS` **once** in `mapLens.ts`; P5 imports them rather than re-declaring (so the constants live in exactly one place).

**Files to touch:**
- `src/components/map/sub/mapLens.ts` — **:18–19** (`DAY_MS = 24*60*60*1000`, `WEEK_MS = 7*DAY_MS`) — add `NOW_MS` and `THREE_DAY_MS` immediately after. **This is the single declaration site for both constants** (P5 imports them, does not re-declare). Do NOT touch the `MapLens` type (:14) or `LENS_OPTIONS` (:21–25) — they stay exactly as today.
- `src/components/map/hooks/useGeoRelevanceSignals.ts` — **`GeoSignals` interface :23–30** — add `nowEvents: CalendarEvent[];` and `threeDayEvents: CalendarEvent[];`.
- `src/components/map/hooks/useGeoRelevanceSignals.ts` — **memo :115–152** — derive `nowEvents` and `threeDayEvents` from the already-composed `events` array and include them in the returned bundle (:151) and nothing else in the deps changes (the source `events`/`fetchedEvents`/props are already deps at :152).
- `src/components/map/hooks/useGeoRelevanceSignals.ts` — **import line :21** (`import { DAY_MS, WEEK_MS, type MapLens } from '../sub/mapLens';`) — add `NOW_MS, THREE_DAY_MS` to the import.
- **NOT touched by P1:** `lensIncludesContact` (:55–80) stays byte-identical. Its binary `today`/`week` ternaries (:65, :78) keep working because P5's `horizonToLens` only ever passes `'today'`/`'week'`/`'atlas'` into it; the finer `'now'`/`'threeDay'` granularity is P5's post-filter over `nowEvents`/`threeDayEvents`, not a predicate change.

**New files:**
- `src/components/map/sub/__tests__/mapLens.test.ts` — boundary tests for the new constants — copy the colocated-`__tests__` + Vitest pattern from `src/components/Messages/__tests__/useConversationMoments.test.ts` (this repo colocates `__tests__` dirs; there are no map tests yet, so this is the first).
- `src/components/map/hooks/__tests__/useGeoRelevanceSignals.test.ts` — boundary tests for the memo's `nowEvents`/`threeDayEvents` derivation (half-open windows) plus a regression snapshot that `lensIncludesContact('today'|'week'|'atlas', …)` is byte-identical to pre-P1 (P1 does not change the predicate, so this is a guard that nothing leaked into it) — same pattern.

**Steps:**
1. **Confirm the data-only scope.** P1 adds two constants + two derived event sets and nothing else. It does NOT widen `MapLens` and does NOT touch `lensIncludesContact`, so there is no exhaustiveness audit to run — the union is unchanged. (P5 is the phase that introduces the `MapHorizon` type and switches consumers to `effectiveLens`; its precondition step re-greps the lens consumers.)
2. In `mapLens.ts`, after `WEEK_MS` (:19), add the two constants (this is their ONLY declaration; P5 imports them):
   ```ts
   // Map Horizon (Direction D) windows. NOW_MS = the "Now" detent's forward
   // horizon (3 hours): events in [now, now + NOW_MS). THREE_DAY_MS feeds the
   // "3-day" detent's backward edge math; the 3-day window itself is
   // [now - DAY_MS, now + 3*DAY_MS) (yesterday's tail through three days out).
   export const NOW_MS = 3 * 60 * 60 * 1000;   // 3h forward horizon for the "Now" detent
   export const THREE_DAY_MS = 3 * DAY_MS;     // 3-day forward span (window adds a -DAY_MS tail)
   ```
   Do NOT edit the `MapLens` type (:14) or `LENS_OPTIONS` (:21–25).
4. In `useGeoRelevanceSignals.ts`, extend the import (:21):
   ```ts
   import { DAY_MS, WEEK_MS, NOW_MS, THREE_DAY_MS, type MapLens } from '../sub/mapLens';
   ```
5. In `useGeoRelevanceSignals.ts`, extend `GeoSignals` (:23–30), adding the two fields after `weekEvents` (:25):
   ```ts
   export interface GeoSignals {
     todayEvents: CalendarEvent[];
     weekEvents: CalendarEvent[];
     /** Events in [now, now + NOW_MS) — the "Now" detent (3h forward horizon). */
     nowEvents: CalendarEvent[];
     /** Events in [now - DAY_MS, now + THREE_DAY_MS) — the "3-day" detent. */
     threeDayEvents: CalendarEvent[];
     recentMessageContactIds: Set<string>;
     hasRealSignals: boolean;
   }
   ```
6. In the memo (:115–152), after the existing `weekEvents` derivation (:128–131) and before the `recentMessageContactIds` block (:133), add — reusing the already-computed `now` (:116) and `dayCutoff` (:117):
   ```ts
   const nowEnd = now + NOW_MS;
   const nowEvents = events.filter(e => {
     const t = e.start instanceof Date ? e.start.getTime() : new Date(e.start).getTime();
     return Number.isFinite(t) && t >= now && t < nowEnd;
   });
   const threeDayEnd = now + THREE_DAY_MS;
   const threeDayEvents = events.filter(e => {
     const t = e.start instanceof Date ? e.start.getTime() : new Date(e.start).getTime();
     return Number.isFinite(t) && t >= dayCutoff && t < threeDayEnd;
   });
   ```
   Then update the return (:151) to include them:
   ```ts
   return { todayEvents, weekEvents, nowEvents, threeDayEvents, recentMessageContactIds, hasRealSignals };
   ```
   - **Do NOT change the memo deps (:152)** — `nowEvents`/`threeDayEvents` derive purely from `events` (which is already `fetchedEvents`/`todayEventsProp`/`weekEventsProp`-derived, all in deps) and the literal constants. No new dep needed.
   - **`hasRealSignals` (:146–149): leave unchanged.** It already trips on `todayEvents.length || weekEvents.length || recentMessageContactIds.size`; since `nowEvents ⊆ today-ish` and `threeDayEvents ⊇ weekEvents`-adjacent, any non-empty new window implies a non-empty existing window in practice. Folding them into `hasRealSignals` is a *behavior change* to the proxy/real switch — out of scope for P1; do not.
7. **Do NOT touch `lensIncludesContact` (:55–80).** Its binary `eventList` ternary (:65 `lens === 'today' ? signals.todayEvents : signals.weekEvents`) and `window` ternary (:78 `lens === 'today' ? DAY_MS : WEEK_MS`) stay verbatim. They keep working under Horizon because P5's `horizonToLens` only ever yields `'today'`/`'week'`/`'atlas'` — a real `MapLens` value the existing ternaries already handle. The finer `'now'`/`'threeDay'` granularity is NOT a predicate change; it is P5's post-filter over the new `nowEvents`/`threeDayEvents` data fields P1 produces.
8. **'now' nearest-un-visited-stop logic is deferred to P5 (the Now-detent consumer), not P1.** P1 only produces the data (`nowEvents` = events in `[now, now+3h)`); the "nearest un-visited stop" half is a ranking/selection concern that needs the operator's live position + per-contact distance, which the pure `lensIncludesContact` predicate cannot compute and which P1 deliberately does not attempt. Record the key convention for P5 so it isn't re-derived wrong: the visited-set is `getTodayVisitedContactStops()` (geofenceService.ts:267) via `useVisitedStops(lens)` (useVisitedStops.ts:19), a `Set` of **marker keys** `${contactId}-home` / `${contactId}-work` — **NOT bare contact ids** (geofenceService.ts:281–282). When P5 lands the Now post-filter, "un-visited" iff `!visitedStopIds.has(\`${c.id}-home\`) && !visitedStopIds.has(\`${c.id}-work\`)`, and "nearest" ranks the un-visited set by haversine to the operator's last `user_locations` position.

**Data / schema / migration:** none — P1 operates entirely on already-fetched in-memory event/thread data (the existing `dataService.getEvents` / `getThreads` self-fetch at :102–104). No SQL. (The `geofence_events` read backing `useVisitedStops` already exists and is unchanged.)

**Code patterns:** the real shapes this plugs into:
```ts
// useGeoRelevanceSignals.ts:23 — the bundle, extended in step 5
export interface GeoSignals {
  todayEvents: CalendarEvent[];
  weekEvents: CalendarEvent[];
  recentMessageContactIds: Set<string>;
  hasRealSignals: boolean;
}
// useGeoRelevanceSignals.ts:55 — the predicate signature (UNCHANGED in P1)
export function lensIncludesContact(c: Contact, lens: MapLens, now: number, signals: GeoSignals): boolean
// useGeoRelevanceSignals.ts:35 — attendee match used by every event branch
export function contactAttendsEvent(c: Contact, e: CalendarEvent): boolean
// useVisitedStops.ts:19 — visited marker-key set (consumed by a LATER phase, not P1)
export function useVisitedStops(lens: MapLens): Set<string>  // Set<`${contactId}-home`|`${contactId}-work`>
// geofenceService.ts:267 — its source
export async function getTodayVisitedContactStops(): Promise<Set<string>>
// mapLens.ts:18 — the window constants P1 sits beside
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
```
Event-start coercion pattern (copy verbatim from the existing :125 / :129 derivations): `const t = e.start instanceof Date ? e.start.getTime() : new Date(e.start).getTime(); return Number.isFinite(t) && …`.

**Acceptance criteria:**
- `NOW_MS === 10_800_000` (3h) and `THREE_DAY_MS === 259_200_000` (3·DAY_MS) — exported from `mapLens.ts`.
- `GeoSignals` returned by `useGeoRelevanceSignals` has `nowEvents` and `threeDayEvents` arrays; `nowEvents` ⊆ events with `start ∈ [now, now+3h)`, `threeDayEvents` ⊆ events with `start ∈ [now−DAY_MS, now+3d)`.
- `lensIncludesContact` is **unchanged** — `lensIncludesContact(c, 'today'|'week'|'atlas', now, signals)` is byte-identical to pre-P1 (regression-test this explicitly; the predicate is not edited by P1).
- `MapLens` is **still** `'today' | 'week' | 'atlas'` (NOT widened) and the repo compiles.
- No change to `hasRealSignals`, memo deps, `lensIncludesContact`, the predicate signature, the `MapLens` type, or `LENS_OPTIONS`.
- `NOW_MS`/`THREE_DAY_MS` are exported from `mapLens.ts` exactly once (no duplicate declaration anywhere — P5 imports them).

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "mapLens|useGeoRelevanceSignals"` — gate on NO NEW errors. P1 doesn't widen the union or touch consumers, so there is no exhaustiveness break to expect; a new error here means an unintended edit leaked.
- `npm run test -- mapLens useGeoRelevanceSignals` — runs the two new Vitest files.
- **Vitest boundary cases (must author):**
  - *NOW_MS window* — event at `start = now` → **in** `nowEvents`; `start = now + NOW_MS − 1` → **in**; `start = now + NOW_MS` → **out** (half-open upper); `start = now − 1` → **out** (no backward tail).
  - *THREE_DAY_MS window* — `start = now − DAY_MS` → **in** (inclusive lower); `start = now − DAY_MS − 1` → **out**; `start = now + THREE_DAY_MS − 1` → **in**; `start = now + THREE_DAY_MS` → **out**.
  - *non-finite guard* — event with `start = new Date('invalid')` → excluded from both new sets (`Number.isFinite` false).
  - *string vs Date start* — same event as ISO string vs `Date` object yields identical membership (exercises the :125-style coercion).
  - *regression* — `lensIncludesContact('today'|'week'|'atlas', …)` for a fixed fixture returns the pre-P1 result (lock a snapshot before editing). P1 does not edit the predicate, so this is purely a guard that no change leaked into it. The `'now'`/`'threeDay'` membership/ranking behavior is tested in P5 (the Now/3-day post-filter consumer), not here.
- Manual eyeball is deferred (no Horizon consumer reads `'now'`/`'threeDay'` yet) — P1 is data-layer only; visual verification with `?ff_mapHorizon=on` happens in the phase that adds the detent UI.

**Commit:**
```
feat(map): add Now (3h) + 3-day geo windows to the lens data layer

Add NOW_MS (3h) + THREE_DAY_MS (3*DAY_MS) constants beside DAY_MS/WEEK_MS
(single declaration in mapLens.ts; P5 imports them), and derive nowEvents
([now, now+3h)) + threeDayEvents ([now-DAY_MS, now+3d)) on the GeoSignals
bundle. PURE DATA: MapLens is NOT widened and lensIncludesContact is NOT
touched — the canonical Horizon design (P5) keeps the MapLens enum and adds
a separate MapHorizon type mapped via horizonToLens, so the existing binary
today/week ternaries keep working unchanged. hasRealSignals, the predicate,
memo deps, the MapLens type, and LENS_OPTIONS are all unchanged. The 'now'
nearest-un-visited-stop ranking and the 'now'/'threeDay' granularity
post-filter are owned by P5 (the Now/3-day detent consumer). Vitest covers
half-open window boundaries + a regression guard that lensIncludesContact
is byte-identical.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Rollback:** `git revert <sha>`. Pure additive data layer — no consumer reads `nowEvents`/`threeDayEvents` until P5, so the revert is inert beyond removing the constants/fields. (If P5 already shipped and imports `NOW_MS`/`THREE_DAY_MS` from `mapLens.ts`, do NOT revert P1 without first reverting P5 — P5 depends on the constants.)

**Preserve-verbatim / gotchas:**
- **Do NOT touch `lensIncludesContact` at all** (:55–80) — not the `'atlas'` early return (:61), the `recentMessageContactIds.has(c.id)` check (:64), the `eventList` ternary (:65), the team/pulse overrides (:70, :76), the `lastSeen` proxy, or the `window` ternary (:78). P1 is data-only; the predicate is unchanged.
- **Do NOT fold `nowEvents`/`threeDayEvents` into `hasRealSignals`** (:146) — that silently changes the proxy↔real switch for existing lenses. Out of scope.
- **Do NOT widen the `MapLens` type (:14) and do NOT add `'now'`/`'threeDay'` to `LENS_OPTIONS`** (mapLens.ts:21). The canonical design keeps the enum and adds a separate `MapHorizon` type in P5; widening `MapLens` here would create a duplicate/competing model and make consumers non-exhaustive — exactly the contradiction this playbook resolves.
- **`NOW_MS`/`THREE_DAY_MS` declared once.** They live only in `mapLens.ts` (added here). P5 imports them — it must NOT re-declare them, or the second `export const` shadows/conflicts.
- **Visited keys are marker keys, not contact ids** — `${contactId}-home`/`${contactId}-work` (geofenceService.ts:281–282). Any future nearest-un-visited logic must `Set.has(\`${c.id}-home\`)` / `-work`, never `Set.has(c.id)`. This corrects the natural (wrong) assumption that the visited set is keyed by bare contact id.
- The strategic handoff's §3 backend→UI matrix is the cross-reference for which GeoSignals field each Horizon surface consumes — see strategic §3; P1 only produces the fields, it does not wire any surface.

---

**Verification notes (corrections to prior citations):** Every line anchor in the prompt was re-verified against the live files and is **correct** as given (`mapLens.ts:18–19`, `GeoSignals` :23–30, `lensIncludesContact` :55–80, memo :115–152, `mapLibreRenderer` default :164, MapLibre `<SettingsCard>` in FeaturesLabsSettings :38–45). **One material correction to the task framing:** `useVisitedStops` / `getTodayVisitedContactStops` return a `Set` of **marker keys** (`${contactId}-home` / `${contactId}-work`), not bare contact ids (geofenceService.ts:281–282) — the 'now' nearest-un-visited-stop logic must key on those, and that ranking half is correctly deferred out of the pure `lensIncludesContact` predicate (it needs operator position + distance, which the predicate signature doesn't carry). No map tests exist yet, so P1's two `__tests__` files are the first under `src/components/map`.

---

All ground truth verified against the strategic doc. Now I'll write the three phase sections.

---

```markdown
## P2 · P3 · P4 — Map Horizon Build Playbook (execution companion)

> **Cross-reference:** strategic doc `docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md`
> (matrix §3, Rule-A pros/cons §4). This section is self-contained but cites the
> strategic §X for the matrix/pros-cons rather than reproducing them.
>
> **VERIFIED-CORRECTION (carried into every phase below):** the strategic doc's
> §3.7 row for `MapViewPicker` says it is "still wired to the Google fallback."
> That is **imprecise**. In the live code `<MapViewPicker>` is mounted
> **unconditionally** at `src/components/map/PulseMapView.tsx:1027`, *outside* the
> `mapLibreOn ? (…) : (…)` block (which opens at `:666`). It is NOT inside the
> Google branch. Its output (`viewMode`) only ever reaches `<GoogleMap mapTypeId>`,
> so on the default MapLibre renderer the picker is rendered-but-inert. P3 below
> handles this with the picker's REAL mount location, not the doc's stated one.

---

### P2 — Honest-stubs registry (additive)

**Gate:** additive (no approval) — and **Depends on:** P0 (the `mapHorizon` flag must exist in `FeatureContext`; P2 itself only *references* the flag name in a comment, it does not read it).

**Goal:** Land one source-of-truth module that names every Horizon surface whose UI is real but whose backend is `ui_only_no_backend` (per strategic §3), each with a one-line honest-fallback note, so later phases (and any reviewer) can see at a glance what must NOT be shipped as if it were live.

**Preconditions:**
- The `horizon/` directory does not exist yet (verified: `Glob src/components/map/horizon/**` → no files).
- You have read strategic §3.3, §3.4, §3.7, §3.8 rows flagged `ui_only_no_backend` / `stub`.

**Files to touch:** none (P2 is purely additive — a new file plus an immediate `git add`).

**New files:**
- `src/components/map/horizon/horizonStubs.ts` — a typed, exported constant registry of honest-stub surfaces with fallback notes. Pure data + types, zero React, zero side effects. "Copy the comment-density + named-export pattern from `src/components/map/sub/mapLens.ts:14-39`" (small, well-documented constants module that other map files import).

**Steps:**
1. Create `src/components/map/horizon/horizonStubs.ts`.
2. Define a discriminated record type and the registry. Every entry must map to a strategic-§3 row that is `ui_only_no_backend` or `stub`. Use this exact shape (it intentionally mirrors the strategic matrix columns so the two never drift):

   ```ts
   // ───────────────────────────────────────────────────────────────────────────
   // horizonStubs — single source of truth for Map "Horizon" surfaces whose UI is
   // real but whose BACKEND is not. Each entry is a surface that later phases may
   // RENDER, but must render HONESTLY: the `fallback` note states exactly what the
   // surface must do until its backend lands, so we never ship a Sat/Terr/Hybrid-
   // style lie (a control that persists a choice that changes nothing).
   //
   // Every id here corresponds to a `ui_only_no_backend` / `stub` row in
   // docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md §3. Keep them in sync.
   //
   // Gated behind the `mapHorizon` flag (FeatureContext, default false) at the
   // CONSUMER sites — this module itself is flag-agnostic data.
   // ───────────────────────────────────────────────────────────────────────────

   export type HorizonStubId =
     | 'contrastStyle'
     | 'baseStyleDensity'
     | 'allGeofencesRing'
     | 'completionGeofence'
     | 'shareLevelCoarsening'
     | 'providerProvenanceChip'
     | 'durablePlaceForEvent';

   export interface HorizonStub {
     /** Stable id, referenced by the consuming phase. */
     id: HorizonStubId;
     /** Human label for the surface. */
     label: string;
     /** Strategic-doc §3 row this maps to (for traceability). */
     strategicRef: string;
     /** One line: what is REAL today vs. what is missing. */
     status: string;
     /** One line: how the surface must behave UNTIL the backend lands. */
     fallback: string;
   }

   export const HORIZON_STUBS: Record<HorizonStubId, HorizonStub> = {
     contrastStyle: {
       id: 'contrastStyle',
       label: 'Base-style "Contrast" palette',
       strategicRef: '§2.4 / §3.7',
       status: 'buildCoralStyle is two-state (Light/Dark) only — coralCockpitStyle.ts. No Contrast palette exists.',
       fallback: 'Until P3 ships the third palette, the Contrast option must be absent (not a dead toggle). P3 builds it for real.',
     },
     baseStyleDensity: {
       id: 'baseStyleDensity',
       label: 'Base-style label/symbol density',
       strategicRef: '§2.4 / §3.7',
       status: 'No density parameter on buildCoralStyle; all label layers always present.',
       fallback: 'Density control must filter REAL style layers (P3). Never persist a density that changes nothing.',
     },
     allGeofencesRing: {
       id: 'allGeofencesRing',
       label: 'All-geofences ring overlay on the map',
       strategicRef: '§3.4',
       status: 'MapRadiusRings/MapLibreRadiusRings ring only the SELECTED contact + user dot (PulseMapView:691-693). No overlay for the SET of geofences.',
       fallback: 'The Geofences drawer LIST + setPlaceGeofence are real; the map-side ring-for-all overlay is net-new UI. Drawer may list places; the "show all rings" map layer is a later phase, not P2/P3/P4.',
     },
     completionGeofence: {
       id: 'completionGeofence',
       label: '"Complete task on arrival" (completion_geofence role)',
       strategicRef: '§3.4',
       status: 'Role enumerated (placeTypes.ts:30, migration 20260503000008) but NEVER written; no producer, no geofence_events→task-complete consumer.',
       fallback: 'Do NOT offer "auto-complete on arrival" as a working option. If surfaced at all, label it "coming soon" — the loop is unbuilt.',
     },
     shareLevelCoarsening: {
       id: 'shareLevelCoarsening',
       label: 'Location share-level coarsening (approximate / city-only)',
       strategicRef: '§3.3 / §3.8',
       status: 'share_level enum {precise,approximate,city_only} is schema-ready, but there is NO coarsening code path — precise coords flow regardless.',
       fallback: 'A consent UI must NOT offer approximate/city-only as if they reduce what the viewer sees. Either implement coarsening first, or restrict the selector to "precise" / "off".',
     },
     providerProvenanceChip: {
       id: 'providerProvenanceChip',
       label: 'Provider provenance chip ("served by Stadia")',
       strategicRef: '§3.7',
       status: 'Only maps-geosearch emits a `provider` field (stadia|photon); the other four edge fns emit none, and the client reads none of them.',
       fallback: 'A provenance chip is honest ONLY on geosearch surfaces. Do not show a global "served by Stadia" chip on routes/geocode — that is net-new backend.',
     },
     durablePlaceForEvent: {
       id: 'durablePlaceForEvent',
       label: 'Durable place for meetings/events',
       strategicRef: '§3.5',
       status: 'Meeting markers are geocoded ad-hoc (useMeetingMarkers); they are NOT persisted as places/entity_places rows.',
       fallback: 'Plotting a meeting is real (ephemeral marker). Do not imply a meeting has a saved, geofence-able place until a producer writes one.',
     },
   };

   /** Convenience accessor for a single stub (throws in dev if the id is unknown,
    *  so a typo in a consumer surfaces immediately). */
   export function getHorizonStub(id: HorizonStubId): HorizonStub {
     const s = HORIZON_STUBS[id];
     if (!s && typeof console !== 'undefined') console.warn('[horizonStubs] unknown id:', id);
     return s;
   }
   ```

3. **Immediately** `git add` the new file and the (empty-until-now) directory so it can never vanish from the working tree (CLAUDE.md "the one rule that matters"):
   ```bash
   git add f:/pulse1/src/components/map/horizon/horizonStubs.ts
   ```

**Data / schema / migration:** none.

**Code patterns:** the module is the pattern (constants + types only). It is modelled on `src/components/map/sub/mapLens.ts` (`export type MapLens`, `export const LENS_OPTIONS`) — same "small typed constants other map files import" shape; no React, no hooks, no flag read.

**Acceptance criteria:**
- `src/components/map/horizon/horizonStubs.ts` exists, exports `HORIZON_STUBS`, `HorizonStub`, `HorizonStubId`, `getHorizonStub`.
- Every entry's `strategicRef` points at a real strategic-§3 row that is `ui_only_no_backend` or `stub`.
- No file outside `horizon/` is modified.
- The file is `git add`ed (tracked, not `??` in `git status --short`).

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep horizonStubs` → expect **no output** (no new errors; repo has ~1234 pre-existing — gate on NO NEW errors only).
- `git status --short f:/pulse1/src/components/map/horizon/` → expect `A  …/horizonStubs.ts` (added/tracked), not `??`.
- `npm run test` → expect no new failures (this file has no tests yet and no runtime consumers, so the suite is unaffected).

**Commit:**
```
feat(map): add Horizon honest-stubs registry (P2)

New src/components/map/horizon/horizonStubs.ts — single source of truth
for Map "Horizon" surfaces whose UI is real but backend is not
(ui_only_no_backend per strategic handoff §3). Each entry carries a
one-line honest-fallback note so later phases never ship a control that
persists a choice that changes nothing. Pure data/types, no consumers
yet, flag-agnostic. git add'd immediately per repo discipline.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Rollback:** `git rm f:/pulse1/src/components/map/horizon/horizonStubs.ts` (no consumers exist, so removal is side-effect-free), then commit. Or `git revert <sha>`.

**Preserve-verbatim / gotchas:**
- This is pure scaffold; it deletes/rewrites nothing, so **no Rule-A approval is needed**.
- Do NOT add a runtime consumer here — P2's only job is the registry. Consumers come in P3 (`contrastStyle`, `baseStyleDensity`) and later phases (the rest).
- Keep `strategicRef` strings accurate; if a strategic-§3 row moves, update the ref. This module is the contract that keeps "we shipped a lie" from happening — every entry's `fallback` is load-bearing.

---

### P3 — Renderer-real base-style switch + density (additive on MapLibre, no removal)

**Gate:** REQUIRES Rule-A approval before execution — cite **strategic §4.2** (MapViewPicker (Sat/Terr/Hybrid) → base-style switch). *The reason it is Rule-A even though it is additive:* it introduces a competing control surface to the existing `MapViewPicker`/`useMapViewMode`. P3 does **not remove** either — but because §4.2 frames the base-style switch as the *replacement* for the dead picker, the user must approve the direction (add-the-switch, keep-the-picker-on-Google-only) before execution, AND must explicitly approve any later removal of the picker (that removal is a separate, out-of-P3 change). **Depends on:** P0 (`mapHorizon` flag), P2 (`horizonStubs` — P3 graduates `contrastStyle` + `baseStyleDensity` from stub to real).

**Goal:** Give the MapLibre renderer a *real* base-style switch — Light / Dark / **Contrast** (net-new palette) plus a **density** parameter that filters minor label/symbol layers — and thread that selection through `MapLibreCanvas` so it `setStyle`s on change (reusing the existing theme-swap re-key path). The existing `MapViewPicker` stays mounted and untouched.

**Preconditions:**
- P2 merged (the registry exists; P3 will satisfy `contrastStyle` and `baseStyleDensity`).
- `mapHorizon` flag exists (P0) and a resolver hook `useMapHorizon()` exists, mirroring `useMapLibreRenderer` (`src/components/map/provider/useMapLibreRenderer.ts` — copy it verbatim, swap the flag key to `mapHorizon` / `ff_mapHorizon`). If P0 did not create the hook, create it as part of P3's "New files."
- You have READ `provider/coralCockpitStyle.ts` (the two-state builder), `provider/MapLibreCanvas.tsx` (the mount + theme-swap effect), and the `styleEpoch`/`handleStyleSwapped` re-key path in `PulseMapView.tsx`.

**Files to touch:**
- `src/components/map/provider/coralCockpitStyle.ts` — **`buildCoralStyle(isDarkMode: boolean)` at line 342** is two-state (palette = `isDarkMode ? DARK : LIGHT`, line 343); palettes `LIGHT` (`:64`) and `DARK` (`:85`); layer builder `coralLayers(p)` at `:112`; label layers `label-water :261`, `label-road :277`, `label-place-other :296`, `label-place-city :314`. *Change:* add a `CONTRAST` palette constant, change the signature to accept a style descriptor (theme + density), and have `coralLayers` accept a density flag that drops/thins minor label + POI-ish layers at low density. **Additive — the existing two-arg-less call must keep working (see Steps for the back-compat overload).**
- `src/components/map/provider/MapLibreCanvas.tsx` — props `isDarkMode` (`:27`) drive the mount style (`buildCoralStyle(appliedThemeRef.current)` `:68`) and the theme-swap effect (`:98-113`, calls `buildCoralStyle(isDarkMode)` `:105` then `map.setStyle` `:110`, fires `onStyleSwapped` `:108`). *Change:* add `baseStyle` (theme variant) + `density` props; widen the swap-effect guard from "theme changed" to "style descriptor changed"; rebuild + `setStyle` on any descriptor change.
- `src/components/map/PulseMapView.tsx`:
  - `styleEpoch` state **`:124`** + `handleStyleSwapped` **`:194`** (bumps the epoch) — VERIFIED exact lines; the prompt's "~124/194" is correct. **No change to this mechanism** — P3 reuses it: a Contrast/density swap clears overlay sources just like a theme flip, so the same epoch bump must re-key the overlays.
  - `<MapLibreCanvas …>` mount **`:671-685`** (currently passes `isDarkMode`, `onStyleSwapped={handleStyleSwapped}`, etc.). *Change:* pass the new `baseStyle` + `density` from the new `BaseStyleSwitch` state, gated by `useMapHorizon()`.
  - `<MapViewPicker …>` mount **`:1027`** (unconditional, outside the `mapLibreOn` block). *Change (P3-scoped, additive):* leave it mounted as-is, but when `mapHorizon` is ON, render `<BaseStyleSwitch>` alongside/above it. **Do NOT remove the picker** (Rule A — its removal is a separate approved change).

**New files:**
- `src/components/map/horizon/BaseStyleSwitch.tsx` — the renderer-real base-style + density control, rendered only when `mapHorizon` is ON. Owns `{ baseStyle: 'light'|'dark'|'contrast', density: 'normal'|'low' }` selection (or lifts it to PulseMapView — see Steps). "Copy the floating-control + mono-uppercase + dark/light class pattern from `src/components/map/sub/MapViewPicker.tsx`" (same bottom-right chrome idiom, same `isDarkMode` styling, same `'JetBrains Mono'` label treatment seen at `PulseMapView.tsx:1042`).
- `src/components/map/provider/useMapHorizon.ts` — flag resolver, **only if P0 didn't already create it.** Verbatim copy of `provider/useMapLibreRenderer.ts:36-40` with `mapLibreRenderer`→`mapHorizon` and `ff_mapLibreRenderer`→`ff_mapHorizon`.

**Steps:**
1. **Palette (coralCockpitStyle.ts).** Add a `CONTRAST` palette next to `LIGHT` (`:64`) and `DARK` (`:85`). Keep the same `CoralPalette` shape (`:43-61`). Contrast = higher-separation neutrals + stronger label text + preserved rose-only motorway accent (coral stays signal-only — CLAUDE.md §4). Suggested values (tune in the eyeball pass): darker `labelText` (`#27272a`), brighter `canvas` (`#ffffff`), `water` (`#cfd8e3`), thicker label halos, `roadHighwayStroke` stays `#fb7185`-family (do not move coral off the motorway). Add a type for the variant:
   ```ts
   export type BaseStyleVariant = 'light' | 'dark' | 'contrast';
   export type LabelDensity = 'normal' | 'low';
   ```
2. **Density rule (coralCockpitStyle.ts → `coralLayers`).** Define **low density** precisely:
   - **POI / minor place labels OFF:** drop `label-place-other` (`:296`, the `village/suburb/neighbourhood/hamlet/...` filter) entirely. (POI/transit are already omitted by design — see `:111` — so there is no separate POI layer to hide.)
   - **Road labels thinned:** on `label-road` (`:277`) raise `minzoom` from `12` to `14` and reduce `text-size` from `11` to `10` so arterial/local road names only appear when zoomed in.
   - **Keep:** water labels (`:261`), city/town labels (`:314`), all geometry, boundaries, and the motorway rose accent — low density removes *clutter*, never *signal*.
   - Implement by giving `coralLayers` a second param and conditionally excluding/patching layers:
     ```ts
     function coralLayers(p: CoralPalette, density: LabelDensity): LayerSpecification[] {
       const low = density === 'low';
       const layers = [ /* …existing geometry/road/boundary layers unchanged… */ ];
       // water labels — always
       layers.push(/* label-water unchanged */);
       // road labels — thinned at low density
       layers.push(/* label-road with minzoom: low ? 14 : 12, text-size: low ? 10 : 11 */);
       // minor place labels — omitted at low density
       if (!low) layers.push(/* label-place-other unchanged */);
       // city/town labels — always
       layers.push(/* label-place-city unchanged */);
       return layers as unknown as LayerSpecification[];
     }
     ```
     (Reshape the current single `layers` array literal at `:113-330` into the geometry block + conditional label pushes; do not change any geometry/road layer.)
3. **Builder signature (coralCockpitStyle.ts, `:342`).** Add an overload so existing callers (`MapLibreCanvas.tsx:68`, `:105` call `buildCoralStyle(boolean)`) keep compiling, and a new descriptor form for Horizon:
   ```ts
   export interface BaseStyleDescriptor { variant: BaseStyleVariant; density: LabelDensity; }

   export async function buildCoralStyle(isDarkMode: boolean): Promise<StyleSpecification | string>;
   export async function buildCoralStyle(desc: BaseStyleDescriptor): Promise<StyleSpecification | string>;
   export async function buildCoralStyle(
     arg: boolean | BaseStyleDescriptor,
   ): Promise<StyleSpecification | string> {
     const desc: BaseStyleDescriptor =
       typeof arg === 'boolean'
         ? { variant: arg ? 'dark' : 'light', density: 'normal' }
         : arg;
     const palette = desc.variant === 'dark' ? DARK : desc.variant === 'contrast' ? CONTRAST : LIGHT;
     try {
       const res = await fetch(OPENFREEMAP_STYLE);
       if (!res.ok) return OPENFREEMAP_STYLE;
       const base = await res.json();
       if (!base?.sources?.[OMT_SOURCE]) return OPENFREEMAP_STYLE;
       base.sources[OMT_SOURCE].attribution = ATTRIBUTION;
       const style = {
         version: 8,
         name: `Pulse Coral Cockpit (${desc.variant}, ${desc.density})`,
         glyphs: base.glyphs,
         sprite: base.sprite,
         sources: base.sources,
         layers: coralLayers(palette, desc.density),
       };
       return style as StyleSpecification;
     } catch {
       return OPENFREEMAP_STYLE;
     }
   }
   ```
   The boolean overload means **the Google-path / non-Horizon MapLibre path is byte-for-byte unchanged** (`{ variant, density: 'normal' }`), so the boolean fallback (the `OPENFREEMAP_STYLE` constant returned on network/parse failure) at `:346/348/360` is preserved verbatim.
4. **MapLibreCanvas props (MapLibreCanvas.tsx).** Add to `MapLibreCanvasProps` (`:23`):
   ```ts
   /** Horizon base-style variant; defaults to deriving from isDarkMode for
    *  back-compat. When supplied, drives the style instead of isDarkMode. */
   baseStyle?: BaseStyleVariant;
   /** Label/symbol density; 'normal' (default) or 'low'. */
   density?: LabelDensity;
   ```
   Import `BaseStyleVariant`, `LabelDensity`, `BaseStyleDescriptor` from `./coralCockpitStyle`.
5. **MapLibreCanvas descriptor + mount (MapLibreCanvas.tsx).** Compute a single descriptor and use it both at mount and in the swap effect:
   ```ts
   const descriptor: BaseStyleDescriptor = {
     variant: baseStyle ?? (isDarkMode ? 'dark' : 'light'),
     density: density ?? 'normal',
   };
   ```
   - At mount (`:68`): replace `buildCoralStyle(appliedThemeRef.current)` with `buildCoralStyle(descriptorRef.current)` where `descriptorRef` seeds from the mount-time descriptor (mirror the existing `appliedThemeRef` pattern at `:55`).
   - Track the applied descriptor: replace `appliedThemeRef` (`:55`, `:101`, `:102`) with an `appliedDescRef` holding the full `{variant,density}`. The swap-effect guard (`:101` `if (appliedThemeRef.current === isDarkMode) return;`) becomes a deep-equal on the descriptor:
     ```ts
     const sameDesc =
       appliedDescRef.current.variant === descriptor.variant &&
       appliedDescRef.current.density === descriptor.density;
     if (sameDesc) return;
     appliedDescRef.current = descriptor;
     ```
   - In the swap effect body (`:104-110`): `const style = await buildCoralStyle(descriptor);` then the existing `map.once('style.load', …onStyleSwapped)` + `map.setStyle(style …)`. **This is the only behavioural change to the effect — it now re-runs on variant OR density change, not just theme.** Update the effect deps (`:113`) from `[isDarkMode]` to `[descriptor.variant, descriptor.density, isDarkMode]` (keep `isDarkMode` so the back-compat path still triggers).
   - The `onStyleSwapped` callback (`:108`) is unchanged — it still fires after the new style loads, so PulseMapView's `handleStyleSwapped` (`:194`) bumps `styleEpoch` and re-keys overlays exactly as for a theme flip. **This is why the swap is safe: `setStyle` clears overlay sources/layers, and the existing epoch mechanism already re-adds them.**
6. **BaseStyleSwitch.tsx (new).** Build a 3-segment variant control (Light / Dark / Contrast) + a density toggle (Normal / Low). State can be local to the switch with an `onChange({variant, density})` callback, OR (preferred for cleanliness) lifted into `PulseMapView` so the mount can read it. Recommended: lift it.
   - Style it like `MapViewPicker` (read `src/components/map/sub/MapViewPicker.tsx` for the exact floating bottom-right chrome, `isDarkMode` classes, focus-visible rings, and mono labels).
   - Coral budget: this is **chrome**, so its active-segment indicator must NOT use coral/rose — use neutral `var(--pulse-*)` tokens (CLAUDE.md §4). The map's coral stays on the AcceptedRoute polyline + AI strip + live chip only.
   - Reference `HORIZON_STUBS.contrastStyle` / `HORIZON_STUBS.baseStyleDensity` in a leading comment to mark that P3 graduates these two from `ui_only_no_backend` to real (they now drive real style layers, so the registry note is satisfied — leave the entries in place but the consumer is now honest).
7. **PulseMapView wiring.**
   - Add `const mapHorizonOn = useMapHorizon();` near `const mapLibreOn = useMapLibreRenderer();` (`:108`).
   - Add state: `const [baseStyle, setBaseStyle] = useState<BaseStyleVariant>(isDarkMode ? 'dark' : 'contrast'…)` — **default `variant` to follow `isDarkMode`** (light/dark) so Horizon-off behaviour is identical; default `density: 'normal'`. Persist to localStorage with a dedicated key (e.g. `pulse:map:horizon-base-style`) mirroring `MAP_VIEW_LS_KEY` (`mapLens.ts:39`), so the choice survives reloads.
   - Thread into the canvas mount (`:671`): add `baseStyle={mapHorizonOn ? baseStyle : undefined}` and `density={mapHorizonOn ? density : undefined}`. When Horizon is OFF both are `undefined` → MapLibreCanvas falls back to `isDarkMode` + `'normal'` → **zero behaviour change**.
   - Render `<BaseStyleSwitch>` only when `mapLibreOn && mapHorizonOn` (it controls a MapLibre-only style; on the Google path it would be inert). Mount it near the existing `<MapViewPicker>` (`:1027`) — e.g. directly above it — and **keep `<MapViewPicker>` mounted unchanged** (Rule A: no removal in P3).

**Data / schema / migration:** none (pure client/renderer; no edge fn, no SQL). The persisted base-style choice is localStorage only.

**Code patterns (real signatures the work plugs into):**
- `buildCoralStyle(isDarkMode: boolean): Promise<StyleSpecification | string>` — `coralCockpitStyle.ts:342` (becomes overloaded; boolean form preserved).
- `interface CoralPalette { canvas; landNatural; park; water; building; roadLocal; roadArterial; roadHighwayFill; roadHighwayStroke; boundary; labelText; labelHalo; waterLabel; roadLabel; roadLabelHalo; adminLabel; localityLabel; }` — `coralCockpitStyle.ts:43-61` (`CONTRAST` must fill all 17 fields).
- `function coralLayers(p: CoralPalette): LayerSpecification[]` — `coralCockpitStyle.ts:112` (gains a `density` param).
- The theme-swap effect — `MapLibreCanvas.tsx:98-113`: guard `if (appliedThemeRef.current === isDarkMode) return;` (`:101`) → descriptor deep-equal; `map.once('style.load', …onStyleSwapped)` (`:107-109`) + `map.setStyle(style …)` (`:110`) unchanged in shape.
- `onStyleSwapped` → `const handleStyleSwapped = useCallback(() => setStyleEpoch(e => e + 1), []);` — `PulseMapView.tsx:194`; overlays keyed `key={`route-${styleEpoch}`}` etc. at `:692-718`.
- `<MapLibreCanvas … isDarkMode={isDarkMode} onStyleSwapped={handleStyleSwapped} …/>` — `PulseMapView.tsx:671-685`.
- `useMapLibreRenderer` pattern (flag + `?ff_` override + localStorage) — `provider/useMapLibreRenderer.ts:36-40`.

**Acceptance criteria:**
- With `?ff_mapHorizon=on`: a base-style switch appears on the MapLibre map; selecting **Contrast** visibly re-styles the base map (higher-separation neutrals, stronger labels) via a real `setStyle`, and the motorway rose accent persists.
- Selecting **Low** density removes minor place labels and pushes road labels to higher zoom; **Normal** restores them. The change is a real layer-set change (inspect via `map.getStyle().layers`), not a no-op.
- After any switch, route/rings/atlas overlays still render (the `styleEpoch` re-key fired) — no missing polyline after a style swap.
- With `?ff_mapHorizon=off` (default): the map is byte-for-byte the prior behaviour — `BaseStyleSwitch` is not rendered, `MapViewPicker` is still present, and the canvas uses `buildCoralStyle(isDarkMode)`'s boolean path.
- A theme flip (dark mode toggle) still swaps Light↔Dark correctly when Horizon is OFF (back-compat path) and is respected as the default variant when Horizon is ON.
- The Google fallback path (`mapLibreRenderer` off) is untouched.

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "coralCockpitStyle|MapLibreCanvas|BaseStyleSwitch|PulseMapView|useMapHorizon"` → no new errors.
- `npm run test` → no new failures.
- Manual eyeball, dev server up (`npm run dev:full`):
  1. `…/?ff_mapLibreRenderer=on&ff_mapHorizon=on` → open the Map (Experimental section must be enabled; `experimentalEnabled` flag). Confirm `BaseStyleSwitch` renders and `MapViewPicker` is still present.
  2. Click Contrast → base map visibly changes; in devtools console `mapLibreRef`’s `map.getStyle().name` includes `(contrast, …)`.
  3. Toggle Low density → minor place labels disappear; `map.getStyle().layers.find(l=>l.id==='label-place-other')` is `undefined`; Normal → it returns.
  4. Accept a route (Today/Now), then switch style → the polyline reappears (epoch re-key).
  5. `…/?ff_mapHorizon=off` → switch absent, picker present, map identical to pre-P3.

**Commit:**
```
feat(map): renderer-real base-style switch + density on MapLibre (P3)

Adds a third Coral Cockpit palette (Contrast) and a label/symbol density
parameter to buildCoralStyle, threaded through MapLibreCanvas via new
baseStyle + density props that re-setStyle on change (reusing the existing
theme-swap → onStyleSwapped → styleEpoch overlay re-key path). New
horizon/BaseStyleSwitch (mapHorizon-gated) drives them. Low density drops
minor place labels and thins road labels; coral stays motorway-only.

Additive on MapLibre — buildCoralStyle keeps a boolean overload so the
Google path and Horizon-off MapLibre path are unchanged. MapViewPicker is
NOT removed (still wired to the Google mapTypeId fallback). Graduates the
contrastStyle + baseStyleDensity entries in horizonStubs from
ui_only_no_backend to real.

Requires Rule-A approval per strategic handoff §4.2 (base-style switch as
the replacement for the dead Sat/Terr/Hybrid picker).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Rollback:** `git revert <sha>`. Because the `mapHorizon` flag defaults OFF and `MapLibreCanvas`'s new props are optional with back-compat defaults, the safest field rollback is to flip `mapHorizon` off — the switch disappears and the canvas reverts to the boolean style path with no redeploy.

**Preserve-verbatim / gotchas:**
- **Rule A — DO NOT remove or rewrite** `MapViewPicker` (`sub/MapViewPicker.tsx`), `useMapViewMode`, or `MAP_VIEW_OPTIONS` (`mapLens.ts:32-37`). They remain wired to `<GoogleMap mapTypeId>` (PulseMapView ~`:810`) on the Google fallback. Their removal is a *separate* approved change, explicitly out of P3.
- **Preserve the boolean overload + the `OPENFREEMAP_STYLE` safe fallback** (`coralCockpitStyle.ts:346/348/360`; the constant is defined at `:28`). The fallback returns the `OPENFREEMAP_STYLE` string URL on network/parse failure — never under-attributed; do not let the descriptor refactor drop the `string` return arm.
- **Coral budget (CLAUDE.md §4):** Contrast palette must keep rose ONLY on the motorway (`roadHighwayStroke`/`roadHighwayFill`); `BaseStyleSwitch` active-state must be neutral, not coral.
- **Do not break the epoch re-key contract:** the swap effect MUST keep calling `onStyleSwapped` after `style.load` for variant/density changes (not just theme), or overlays silently vanish after a style switch. This is the single most likely regression — test it (acceptance #3/#4).
- **Marker portals survive a swap and are deliberately NOT keyed on `styleEpoch`** (PulseMapView comment `:119-123`); do not "fix" that by keying them — it would flicker every marker on each switch.
- **Stale in-file comment:** `PulseMapView.tsx:668-669` says "Markers/anchors + Coral styling still pending (P2-anchor / P3)." This is STALE — coral styling already ships (the MapLibre canvas renders `buildCoralStyle`). P3 only ADDS the Contrast variant + density on top; it does NOT build coral from scratch. Update or delete that stale comment as part of P3 so a future reader isn't misled into thinking coral is unbuilt.

---

### P4 — Adaptive AI card (extend, don't rewrite)

**Gate:** additive (no approval) — extends the AI card and consumes already-returned fields; **does not remove or rewrite** any existing branch. **Depends on:** P0 (`mapHorizon` flag) and — for the *now*-specific framing — P5 (which derives `effectiveLens` and threads it, plus optionally the raw `MapHorizon`, into `useMapAiProposals`). **Canonical model (do not deviate): `MapLens` is NOT widened.** The proposal-KIND switch is already keyed on `MapLens` (`today`→route, `week`→plan, `atlas`→insight); because P5's `horizonToLens` collapses `now`→`today` and `threeDay`→`week` (and `effectiveLens==='atlas'` when Atlas-mode is on), the existing switch already yields the right kind once it receives `effectiveLens`. P4 therefore adds only: (1) the `focusDate`/`focusId` affordance, and (2) optional *now*-nudge framing read from the raw `MapHorizon` (never from a widened `MapLens`). If P4 lands before P5, it ships (1) now and the framing in (2) stays inert until P5 threads the horizon.

**Goal:** Extend the proposal FSM so each Horizon detent maps to the right AI call — **now/today → `proposeRoute`, 3d/week → `proposeWeekPlan`, atlas → `proposeAtlasInsight`** — and surface the already-returned-but-dead `WeekProposal.focusDate` / `AtlasProposal.focusId` in the AI card as a "jump to / focus this" affordance. Preserve all 6 AiStrip branches, the paused state, and fail-quiet.

**Preconditions:**
- The `MapLens` union (`sub/mapLens.ts:14`) is `'today' | 'week' | 'atlas'` and **stays that way** — the scrubber phase (P5) does NOT widen it; it adds a separate `MapHorizon` type (`'now'|'today'|'threeDay'|'week'`) and a `horizonToLens` mapper, threading `effectiveLens` (a `MapLens`) into `useMapAiProposals`. **P4 must NOT redefine or widen `MapLens`.** The FSM keeps branching on the `MapLens` value it receives; `now`/`threeDay` never reach it as lens values (they collapse via `horizonToLens`). The only finer-grained input P4 may consume is an *optional* raw `horizon: MapHorizon` prop (for `now` framing), added by P5.
- USER DECISION (locked 2026-06-15): "**Now**" detent = nearest un-visited stop AND events in `[now, now+3h)` (BOTH); `NOW_MS = 3h`. The *windowing* (which stops/events are in scope) is computed upstream (the scrubber/`useGeoRelevanceSignals` phase) and arrives in `allStops`/`visibleMarkers`; P4's job is only to pick the right AI call + framing for the `now` lens, not to compute the window.
- You have READ `hooks/useMapAiProposals.ts` (the FSM effect), `sub/aiTypes.ts` (the `AiState` union), `services/mapAIService.ts` (the three propose-fns + circuit breaker), and `sub/AiStrip.tsx` (the 6 branches).

**Files to touch:**
- `src/components/map/hooks/useMapAiProposals.ts` — the proposal effect **`:90-179`** with the lens switch at **`:126` (`if (lens === 'today')` → `proposeRoute`), `:142` (`if (lens === 'week')` → `proposeWeekPlan`), `:149-166` (else → `proposeAtlasInsight`)**; `settleNullProposal` helper `:119-123`; deps array `:179`. *Change:* the **kind switch needs NO new arms** — once P5 passes `effectiveLens`, `today` (covers `now`) → route, `week` (covers `threeDay`) → plan, `atlas` (covers Atlas-mode, since `effectiveLens==='atlas'` when the mode is on) → insight. P4's only optional edit here is to accept a new `horizon?: MapHorizon` input (for `now`-nudge framing) and thread it through. Keep the `< 2` stop guard (`:127`), the abort checks, and `settleNullProposal` exactly as-is.
- `src/components/map/sub/aiTypes.ts` — `AiState` union **`:17-26`**; `AiProposal` **`:12-15`**. *Change:* **none required** for the now/3d branches (they reuse `kind: 'route'` / `kind: 'plan'`). Only touch if you choose to add a `kind`-level distinction for "now" framing — **prefer not to** (reuse `'route'` to keep all 6 AiStrip branches intact).
- `src/components/map/sub/aiTypes.ts` — **`:30`** `path: google.maps.LatLngLiteral[]` inside `AcceptedRoute`. *Change (P4 OWNS this — type-only, zero-runtime, NOT Rule-A):* retype to the renderer-neutral `LatLng[]` from `provider/types.ts` (add `import type { LatLng } from '../provider/types';`). `provider/types.ts:14-17` already defines a structurally-compatible `LatLng`, and `MapLibreAcceptedRoute`/`AcceptedRoutePolyline` already accept `{lat;lng}[]`, so this is a pure type widening with no runtime change — it does NOT require Rule-A approval. Doing it in P4 means P8 inherits the neutral type and does not re-do it (see P8 Step 1 precondition + the P4→P8 dependency in the at-a-glance table).
- `src/components/map/sub/AiStrip.tsx` — plan/insight render branch **`:406-419`** currently reads only `data.proposal.summary` (`:415`); route branch reads `.summary`/`.rationale`/`.orderedIds.length` (`:324-326`). *Change:* in the plan/insight branch, when `data.proposal.focusDate` (plan) or `data.proposal.focusId` (insight) is present, render a small neutral "Jump to" / "Focus" affordance that calls a new optional `onFocus` prop. **Preserve the existing summary rendering verbatim;** the affordance is additive.
- `src/components/map/PulseMapView.tsx` — `<AiStrip … />` mount **`:644-658`**. *Change:* pass a new optional `onFocus` handler that, given a `focusDate`/`focusId`, does the "jump to" (e.g. set the scrubber to `focusDate`'s window, or select the contact/circle `focusId`). Wire it to existing setters (`setSelectedContactId`, `setSelectedCircleId`, or the scrubber's set-window). **Additive prop** — if omitted, AiStrip renders no affordance (back-compat).

**New files:** none. (P4 is an extension of existing files; do not create a parallel AI component — Rule A.)

**Steps:**
1. **Confirm the canonical shape (no FSM branch on Atlas-mode).** P5 derives `effectiveLens: MapLens` such that `effectiveLens === 'atlas'` whenever Atlas-mode is on (else `horizonToLens(horizon)`), and passes it as the hook's existing `lens` input. So the FSM keeps its single `MapLens` switch — it does **not** need an `atlasMode` input or an atlas-first branch; the `else`/atlas arm fires naturally when `effectiveLens` is `'atlas'`. P4 consumes `effectiveLens` plus an *optional* raw `horizon` (for `now` framing) — nothing more.
2. **The kind switch is unchanged — verify it receives `effectiveLens`.** Do NOT add `lens === 'now'`/`'threeDay'` arms; those values never arrive as a `MapLens` (P5's `horizonToLens` collapses them), so such arms would be dead code. The three existing arms already produce the right kind once P5 threads `effectiveLens` in (`useMapAiProposals.ts:126-166`) — preserve them verbatim:
   ```ts
   if (lens === 'today') {                                 // 'now' arrives here too (horizonToLens collapse)
     if (stops.length < 2) { setAiState({ status: 'none' }); return; }   // preserve :127-130
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
   if (lens === 'week') {                                  // 'threeDay' arrives here too
     const proposal = await proposeWeekPlan({ stops, signal: controller.signal });
     if (controller.signal.aborted) return;
     if (!proposal) { settleNullProposal(); return; }
     setAiState({ status: 'ready', data: { kind: 'plan', proposal } });
     return;
   }
   // Atlas — insight from the network at large (unchanged from :149-166; fires when effectiveLens==='atlas').
   ```
   **Optional `now`-nudge framing** (only if P5 threads the raw `horizon`): to word the route card as a single next-stop nudge when the detent is `now`, read `horizon === 'now'` (the raw `MapHorizon`, NOT the lens) and adjust **copy only** — the `proposeRoute` call is identical. If `horizon` isn't threaded, skip this; the card still works.
   - **`proposeRoute` signature (mapAIService.ts:132):** `proposeRoute(opts: { stops: RouteStopInput[]; origin?: {lat;lng}|null; signal?; timeoutMs?=1500; visitedIds?: string[] }): Promise<RouteProposal | null>`. The `now` detent passes the **same** args — the *window* differences are already baked into `allStops`/`visitedStopIds` upstream by P1+P5. No new param.
   - **`proposeWeekPlan` signature (mapAIService.ts:211):** `proposeWeekPlan(opts: { stops: WeekStopInput[]; signal?; timeoutMs?=1500 }): Promise<WeekProposal | null>`. The `threeDay` detent reuses it unchanged (it maps to `week`).
   - **`proposeAtlasInsight` signature (mapAIService.ts:272):** `proposeAtlasInsight(opts: { contacts: AtlasContactSnapshot[]; signal?; timeoutMs?=1500 }): Promise<AtlasProposal | null>`. Atlas branch unchanged.
3. **Preserve the circuit breaker + timeout + fail-quiet.** Do NOT add try/catch around individual calls — the existing single `try { … } catch { settleNullProposal() }` at `:125-169` wraps all branches and already handles abort/timeout/cap. `settleNullProposal` (`:119-123`) reads `getAiPausedUntil()` (mapAIService.ts:71) and emits `paused` vs `none`. Each propose-fn already self-checks `isCircuitOpen()` (mapAIService.ts:139/214/275) and the 1500ms `withTimeout` (mapAIService.ts:99/176). **Leave all of that exactly as-is.**
4. **Update the effect deps (`:179`).** The existing `lens` dep covers the kind switch (P5 passes `effectiveLens` as that same `lens` prop, so a detent/Atlas-mode change re-runs the effect). If you thread the optional raw `horizon` for `now` framing, **add `horizon` to the deps array** at `:179` so the framing re-evaluates on a detent change. (`atlasMode` needs no separate dep — it is folded into `effectiveLens`.) Verify the final deps include every new input.
5. **Surface `focusDate` / `focusId` in AiStrip (`sub/AiStrip.tsx:406-419`).** The plan/insight branch currently renders only `summary`. Add an optional affordance:
   ```ts
   // in AiStripProps (around :25-41):
   onFocus?: (target: { focusDate?: string; focusId?: string }) => void;

   // in the plan/insight branch (:406-419), after the summary <span>:
   {(data.kind === 'plan' && data.proposal.focusDate) ||
    (data.kind === 'insight' && data.proposal.focusId) ? (
     onFocus && (
       <button
         type="button"
         onClick={() => onFocus(
           data.kind === 'plan'
             ? { focusDate: data.proposal.focusDate }
             : { focusId: data.proposal.focusId },
         )}
         className={/* NEUTRAL chrome — NOT coral; mirror the Reorder button's
                       neutral text/hover classes from :363-365 */}
       >
         {data.kind === 'plan' ? 'Jump to day' : 'Focus'}
         <ChevronRight size={11} aria-hidden="true" />
       </button>
     )
   ) : null}
   ```
   - **`WeekProposal.focusDate?: string`** (mapAIService.ts:45) and **`AtlasProposal.focusId?: string`** (mapAIService.ts:52) are the already-returned-but-dead fields. Both optional — render the affordance only when present.
   - **Coral budget:** this affordance is an *action on AI output*, but it is chrome-adjacent — keep it neutral (reuse the Reorder button's neutral classes at `:363-365`), NOT coral. The `PULSE AI ·` label + Sparkles icon already carry the coral signal for the strip; do not add a second coral element.
   - **Preserve the existing summary `<span>` verbatim** (`:414-416`) and the wrapping `div`/`role="status"` (`:409`).
6. **Wire `onFocus` in PulseMapView (`:644-658`).** Add `onFocus={handleAiFocus}` to the `<AiStrip>` mount. Implement `handleAiFocus`:
   ```ts
   const handleAiFocus = useCallback((t: { focusDate?: string; focusId?: string }) => {
     if (t.focusId) {
       // focusId is a contact id or circle id (per AtlasProposal doc, mapAIService.ts:52).
       // Try contact first, then circle.
       if (localContacts.some(c => c.id === t.focusId)) setSelectedContactId(t.focusId);
       else if (circles.some(c => c.id === t.focusId)) setSelectedCircleId(t.focusId);
     }
     if (t.focusDate) {
       // Set the scrubber to the window containing focusDate (scrubber phase API),
       // or no-op until that API exists. Do NOT fabricate a setter — verify the
       // scrubber's exposed set-window fn before wiring.
     }
   }, [localContacts, circles]);
   ```
   - **Verify before writing:** the exact contact/circle selection setters are `setSelectedContactId` (`PulseMapView.tsx:126`) and `setSelectedCircleId` (`:128`). The `focusDate`→scrubber wiring depends on the scrubber phase exposing a "set window from a date" function — if it does not yet exist, leave a TODO and make `focusDate` a no-op (the affordance still renders harmlessly, or gate it off until the setter lands). Do not invent a setter.
7. **(If P4 lands before P5)** The kind switch already works on the current `MapLens` (`today`/`week`/`atlas`), so ship the `focusDate`/`focusId` affordance now — nothing to defer there. The optional `now`-nudge framing stays inert until P5 threads the raw `horizon`; leave a one-line `// TODO(P5): now-framing via horizon` marker where the route copy would branch. No union change, so there is nothing to "activate" later.

**Data / schema / migration:** none (all three propose-fns already route server-side via `ai-router`; no new edge fn, no SQL).

**Code patterns (real signatures the work plugs into):**
- FSM effect skeleton — `useMapAiProposals.ts:90-179`: guards `if (!isLoaded) return;` `:91`, `if (acceptedRoute) return;` `:92`, `if (isReordering) return;` `:93`, `if (allStops.length === 0) {…idle}` `:94`; `setAiState({status:'fetching'})` `:100`; `setTimeout(async …, 300)` `:102`; `settleNullProposal` `:119-123`.
- `AiState` union — `sub/aiTypes.ts:17-26`: `{status:'idle'} | {status:'fetching'} | {status:'ready'; data: AiProposal} | {status:'none'} | {status:'paused'; until:number} | {status:'reordering'; orderedIds:string[]; baseProposal:RouteProposal}`.
- `AiProposal` — `sub/aiTypes.ts:12-15`: `{kind:'route'; proposal:RouteProposal} | {kind:'plan'; proposal:WeekProposal} | {kind:'insight'; proposal:AtlasProposal}`.
- `RouteProposal { orderedIds:string[]; summary:string; rationale?:string }` — `mapAIService.ts:31-39`.
- `WeekProposal { summary:string; focusDate?:string }` — `mapAIService.ts:41-46`.
- `AtlasProposal { summary:string; focusId?:string }` — `mapAIService.ts:48-53`.
- Circuit breaker — `getAiPausedUntil(): number | null` `mapAIService.ts:71`; `CIRCUIT_PAUSE_MS = 30*60*1000` `:60`; `withTimeout(p, 1500, signal)` `:99` / called at `:176/237/305`.
- AiStrip branches to PRESERVE — `sub/AiStrip.tsx`: (1) Underway `:95`, (2) Reorder `:137`, (3) Ready/route `:323` + Ready/plan|insight `:406`, (4) Fetching `:424`, (5) Paused `:439`, (6) Today+1-stop `:454`, fallthrough `return null` `:469`.

**Acceptance criteria:**
- Scrubber at **Now** (when the lens exists): AI card shows `PULSE AI · ROUTE` with a route proposal scoped to the now-window stops; ≥2 stops required (else `none`); single-stop/empty paths unchanged.
- Scrubber at **Today**: identical to current `proposeRoute` behaviour (regression-free).
- Scrubber at **3 days**: AI card shows `PULSE AI · PLAN` (plan proposal) — same branch as Week.
- Scrubber at **Week**: identical to current `proposeWeekPlan` behaviour.
- **Atlas mode**: `PULSE AI · INSIGHT` with an insight proposal (unchanged), now with a "Focus" affordance when `focusId` is returned; clicking it selects the contact/circle.
- Plan proposals with a `focusDate` show a "Jump to day" affordance (no-op or scrubber-set per step 6).
- **Paused** and **fail-quiet** preserved across ALL horizons: workspace cap → `PULSE AI · PAUSED` on route horizons; null/timeout → silent collapse (`none`), no spinner beyond the existing fetching placeholder.
- All 6 AiStrip branches still render correctly; `onFocus` omitted → no affordance, no error.
- No new AI call shape; no client API key; circuit breaker still pauses 30m on cap.

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "useMapAiProposals|aiTypes|AiStrip|mapAIService|PulseMapView"` → no new errors. (`MapLens` is NOT widened, so expect no exhaustiveness break; a new error here means an unintended edit leaked — e.g. an accidental `now`/`threeDay` lens branch.)
- `npm run test` → no new failures. If a Vitest spec exists for `useMapAiProposals`/`AiStrip` (search `e2e`/`__tests__` and the DEV e2e harness referenced in `aiTypes.ts:6`), extend it to cover the now/3d branches; otherwise note no unit coverage exists.
- Manual eyeball (`npm run dev:full`, `…/?ff_mapLibreRenderer=on&ff_mapHorizon=on`, Map open):
  1. Move scrubber across Now/Today/3d/Week → the strip label cycles ROUTE/ROUTE/PLAN/PLAN appropriately; toggle Atlas mode → INSIGHT.
  2. With a workspace that hits the AI cap (or temporarily force `circuitPausedUntil`), confirm `PULSE AI · PAUSED` shows on route horizons and the strip never spins.
  3. When a plan/insight returns `focusDate`/`focusId`, the affordance appears and selecting it focuses the right contact/circle (or sets the scrubber window).

**Commit:**
```
feat(map): horizon-adaptive AI card across all detents (P4)

useMapAiProposals now maps every Horizon detent to the right server-side
call: now/today -> proposeRoute, 3d/week -> proposeWeekPlan, atlas ->
proposeAtlasInsight. AiStrip consumes the previously-returned-but-dead
WeekProposal.focusDate / AtlasProposal.focusId via an additive, neutral
"Jump to day"/"Focus" affordance wired to contact/circle selection (and
the scrubber window where available).

Extends the FSM in place — all 6 AiStrip branches, the 30-min circuit
breaker, the 1500ms timeout, and fail-quiet (paused/none, no spinner) are
preserved verbatim. No new AI call shape, no client key.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Rollback:** `git revert <sha>`. The change is additive to existing branches; reverting restores the prior 3-arm lens switch and removes the `onFocus` affordance. No data/migration to undo.

**Preserve-verbatim / gotchas:**
- **Rule A — DO NOT rewrite the FSM.** Extend the existing effect's switch and `settleNullProposal`; do not replace the hook, the `AiState` union, or any of the 6 AiStrip branches. The reorder lifecycle (`:242-266`), accept-route (`:185-236`), and open-in-system-maps (`:281-292`) are untouched.
- **Preserve fail-quiet + paused on every horizon.** The single outer `try/catch` (`:125-169`) and `settleNullProposal` are the contract — do not add per-branch error UI or spinners. The only loading affordance allowed is the existing `fetching` placeholder, which is deliberately scoped to `lens === 'today' && markerCount >= 2` (AiStrip `:424`) — decide with the scrubber phase whether to widen it to `now` (a one-line condition change in AiStrip branch 4), but keep it conservative.
- **Reuse `kind: 'route'` for "now"** — do NOT add a 4th `AiProposal` kind. A new kind would force a new AiStrip branch and risk breaking the 6-branch invariant. The "now" framing (if any copy change is wanted) is a label tweak inside the existing route branch, gated on `lens === 'now'`, not a type change.
- **`focusId` is a contact id OR circle id** (mapAIService.ts:52 doc) — handle both; selecting a non-existent id must no-op silently (defensive `.some()` check before `setSelected*`).
- **`focusDate` wiring is scrubber-dependent** — verify the scrubber exposes a set-window-from-date API before wiring; if not, leave it a no-op with a TODO. Do not fabricate a setter (CLAUDE.md Rule B — no assumptions).
- **`MapLens` is NOT widened — do NOT redefine it.** Per the reconciled design, `MapHorizon` (`'now'|'today'|'threeDay'|'week'`) is a SEPARATE type owned by P5; `MapLens` (`'today'|'week'|'atlas'`) is unchanged. P4 consumes whatever lens value reaches it (`effectiveLens` once P5 lands, or `lens` before) and groups `route` vs `plan` by it — P4 must NOT edit `mapLens.ts:14`. If P4 lands before P5, the kind switch is unchanged (it already handles `today`/`week`/`atlas`); only the optional `now`-framing stays inert until P5 threads the raw `horizon`.
- **AiStrip branch-line anchors are volatile** — the `:406-419`/`:324-326`/`:95-470` line numbers drift as branches are edited; re-grep the `kind === 'plan'`/`kind === 'route'`/`kind === 'insight'` branches in `AiStrip.tsx` immediately before editing rather than trusting the quoted lines.
- **`AcceptedRoute.path` retype is P4's (type-only, not Rule-A)** — see Files to touch; do it once here so P8 inherits it.
- **AI is server-side (CLAUDE.md §4).** All three propose-fns already go through `ai-router`/`invokeAIJson`; do not introduce any direct model call in P4.
```

---

**Notes on verified corrections vs. the prompt / strategic doc:**

1. **`MapViewPicker` mount location — CORRECTED.** The prompt and strategic §3.7 imply the picker is "still wired to the Google fallback branch." Verified: `<MapViewPicker>` is mounted **unconditionally at `PulseMapView.tsx:1027`**, *outside* the `mapLibreOn ? (…) : (…)` block that opens at `:666`. Its *output* (`viewMode`) only reaches `<GoogleMap mapTypeId>`, so on MapLibre it's inert — but the JSX mount itself is not branch-gated. P3 instructs to keep it mounted as-is (no removal) and add `BaseStyleSwitch` alongside it, gated on `mapLibreOn && mapHorizonOn`.

2. **`styleEpoch`/`handleStyleSwapped` lines — CONFIRMED EXACT.** Prompt said "~124/194"; verified `styleEpoch` state is at `PulseMapView.tsx:124` and `handleStyleSwapped` is at `:194`. The swap path is: `MapLibreCanvas.setStyle` (`:110`) → `style.load` → `onStyleSwapped` (`:108`) → `handleStyleSwapped` (`:194`) → `styleEpoch++` → overlays re-key (`:692-718`).

3. **`buildCoralStyle` is two-state — CONFIRMED.** Single `isDarkMode: boolean` param at `coralCockpitStyle.ts:342`, `palette = isDarkMode ? DARK : LIGHT` at `:343`. No Contrast, no density. P3 adds both via an overload that preserves the boolean form.

4. **AiStrip reads only `.summary`/`.rationale`/`.orderedIds` — CONFIRMED.** Route branch reads `.summary` (`:324`), `.rationale` (`:325`), `.orderedIds.length` (`:326`); plan/insight branch reads only `data.proposal.summary` (`:415`). It does NOT read `.focusDate`/`.focusId` — P4 adds that consumption.

5. **FSM effect lines — CONFIRMED.** `useMapAiProposals.ts:90-179`, lens switch at `:126` (today→route), `:142` (week→plan), `:149-166` (atlas→insight); `settleNullProposal` `:119-123`; deps `:179`.

6. **Circuit breaker / timeout — CONFIRMED.** `getAiPausedUntil` at `mapAIService.ts:71`, `CIRCUIT_PAUSE_MS` `:60`, `withTimeout(…, 1500, …)` default at `:99`/`:133`/`:212`/`:273`.

7. **`mapHorizon` flag does not yet exist** in `FeatureContext.tsx` (verified — only `mapLibreRenderer:true` `:164` and `relayLiveRooms:false` `:167`). P0 owns adding it (type at `:103` after `relayLiveRooms`, default at `:168`, label in `FEATURE_*` at `:378`); P3/P4 assume P0 created it + a `useMapHorizon` resolver hook (pattern: `useMapLibreRenderer.ts:36-40`).

8. **`horizon/` directory does not exist yet** (verified via Glob) — P2 creates it and must `git add` immediately per CLAUDE.md.

---

I have all the verified ground truth I need. One important correction to note: the strategic doc's P5 sketch references a `BaseStyleSwitch.tsx` for P6, but P6 as I own it scopes to chrome token swaps in `MapFilterBar.tsx` + focus rings — the base-style switch itself is a P-other (the §4.2 work). I'll note the boundary. Also note the dev-override convention: there is no existing `?ff_mapHorizon` reader yet, so P5 must add one (mirroring `useMapLibreRenderer`).

Here are the two phase sections I own.

---

### P5 — Time-horizon scrubber + Atlas-mode toggle
**Gate:** REQUIRES Rule-A approval (strategic §4.1 — "MapLensRow tabs → time-horizon scrubber + Atlas-mode toggle") — and **Depends on:** P0 (flag scaffold), P1 (horizon-window data layer), P3/P4 if those add the horizon→window resolver; if P1 only adds `DAY_MS`-family constants, this phase implements the detent→window map inline. Soft-depends on P4 (AI card) only for the AI strip to react to the new window — not a hard blocker (the strip already keys on `lens`).
**Goal:** Behind `mapHorizon` ON (MapLibre branch), render a continuous time-horizon scrubber (Now → Today → 3 days → Week) plus a decoupled Atlas-mode toggle in place of `MapLensRow`, deriving an existing `MapLens`-compatible window from the active detent so every downstream consumer keeps working unchanged. With `mapHorizon` OFF, `MapLensRow` renders exactly as today.

**Preconditions:**
- `mapHorizon: boolean` exists in `FeatureFlags` (default `false`) from P0.
- Rule-A approval for §4.1 is recorded (the scrubber REPLACES the 3-tab affordance on the gated path).
- A horizon→`MapLens` window resolver exists. **VERIFY whether P1 already shipped one.** If not, this phase owns it (see Steps 2). The locked user decision: **"Now" detent = nearest un-visited stop AND events in `[now, now+3h)` (BOTH), `NOW_MS = 3h`.**
- Confirm the lens consumers below are still the live set (re-grep before editing — the file changes between phases):
  - `lens` / `setLens` state — **VERIFIED `PulseMapView.tsx:103`** (`const [lens, setLens] = useState<MapLens>('today')`).
  - `visibleMarkers` filter calling `lensIncludesContact(c, lens, now, geoSignals)` — **VERIFIED `PulseMapView.tsx:210`** (the strategic handoff cited "~210"; exact line is **210**, inside the memo at `:205-236`).
  - `LensEmptyState` — **VERIFIED rendered `PulseMapView.tsx:984`**, prop `lens={lens}` at `:985`; component at `sub/LensEmptyState.tsx:24`.
  - `useVisitedStops(lens)` — **VERIFIED `PulseMapView.tsx:167`**; hook `hooks/useVisitedStops.ts:19` (re-fetches on `[lens]`).
  - `useSrAnnouncer(lens, visibleMarkers.length, viewMode)` — **VERIFIED `PulseMapView.tsx:238`**; hook `hooks/useSrAnnouncer.ts:13`.
  - keyboard map — **VERIFIED hook is `useMapKeyboardShortcuts`** (NOT a generic name): `hooks/useMapKeyboardShortcuts.ts`, called `PulseMapView.tsx:474`; `1/2/3 → setLens('today'|'week'|'atlas')` at `useMapKeyboardShortcuts.ts:74-76`.
  - `useMeetingMarkers(lens, …)` — **VERIFIED `PulseMapView.tsx:168`** (also keys on lens; do not miss it).
  - `useMapAiProposals({ … lens … })` — **VERIFIED `PulseMapView.tsx:432,434`** (lens passed into the FSM hook).
  - `offsetableMarkers` reads `lens !== 'atlas'` — **VERIFIED `PulseMapView.tsx:312-313`**.
  - Atlas-gated render blocks read `lens === 'atlas'` — **VERIFIED** at `:643` (AI strip gate), `:704` (MapLibre atlas geometry), `:764` (MapLibre meeting filter), `:827/:896/:970/:979` (Google path), `:990` (`onOpenAtlas → setLens('atlas')`).

**Files to touch:**
- `src/components/map/PulseMapView.tsx` — **L103** (`lens` state): KEEP. Add net-new `horizon` + `atlasMode` state alongside it (do not remove `lens`). — **L616-630** (the `<MapLensRow>` block): branch — render `<HorizonScrubber>` + `<AtlasModeToggle>` when `mapHorizon` ON, else the existing `<MapLensRow>`. — **L167-168** (`useVisitedStops(lens)`, `useMeetingMarkers(lens, …)`): no signature change — they keep receiving the **derived** `lens`. — **L238** (`useSrAnnouncer(lens, …)`): keep call; the derived `lens` plus a new horizon-label announcer (Step 6). — **L474-488** (`useMapKeyboardShortcuts({ setLens, … })`): pass a horizon-aware setter set (Step 5).
- `src/components/map/sub/mapLens.ts` — **L14** (`export type MapLens`): KEEP unchanged. Add net-new `MapHorizon` type + `HORIZON_OPTIONS` + `NOW_MS`/`THREE_DAY_MS` constants + a `horizonToLens(h: MapHorizon): MapLens` mapper here (co-located with `DAY_MS`/`WEEK_MS` at `:18-19`). Additive only.
- `src/components/map/hooks/useMapKeyboardShortcuts.ts` — **L22-37** (`UseMapKeyboardShortcutsInput`), **L74-76** (the `1/2/3 → setLens` block): extend to drive horizon detents when `mapHorizon` ON, without removing the `setLens` path (OFF path still uses it). See Steps 5.
- `src/components/map/hooks/useSrAnnouncer.ts` — **L13-31**: add an optional horizon-label parameter / second announcer effect so a detent change announces the horizon (not just `lens`). Additive; OFF path unaffected.

**New files:**
- `src/components/map/horizon/HorizonScrubber.tsx` — the continuous detent control (Now / Today / 3 days / Week) + `<kbd>` hints + SR group. **Copy the pattern from `sub/MapLensRow.tsx:25-92`** (role="group", `aria-label`, per-button `aria-pressed`/`aria-keyshortcuts`, mono-uppercase `text-[10px] tracking-[0.1em]`, `<kbd>` chip, `right` slot for the filter controls). Reuse the same `right` slot contract so `MapFilterControls` drops in identically.
- `src/components/map/horizon/AtlasModeToggle.tsx` — a single boolean toggle (network zoom-out), visually distinct from the scrubber detents (it is NOT a 4th detent). **Copy the toggle/`aria-pressed` button pattern from `MapFilterBar.tsx:208-243`** (the Broadcast pill) for the on/off affordance — but neutral-chromed (no coral; coral lands only as signal in P6's preserved set, and Atlas-active is chrome state, not signal).
- `src/components/map/provider/useMapHorizonRenderer.ts` (or `hooks/useMapHorizon.ts`) — resolves `mapHorizon` with a `?ff_mapHorizon=on|off` dev override. **Copy `provider/useMapLibreRenderer.ts` VERBATIM in structure** (`readDevOverride()` + `override ?? features.mapHorizon`). There is **no existing `?ff_mapHorizon` reader** — this is the one place that adds it; manual verification (`?ff_mapHorizon=on`) depends on it.

**Steps:**
1. **Add the dev-override hook** `useMapHorizon()` mirroring `useMapLibreRenderer.ts` (swap `mapLibreRenderer`→`mapHorizon`, key `ff_mapHorizon`). Import it in `PulseMapView.tsx` next to `const mapLibreOn = useMapLibreRenderer();` (**:108**): `const mapHorizonOn = useMapHorizon();`.
2. **Define the horizon model in `mapLens.ts`** (additive, below `WEEK_MS` at `:19`). **`NOW_MS`/`THREE_DAY_MS` are already declared by P1** at this same location — do NOT re-declare them here (a second `export const` would conflict); just reference them. Add only the `MapHorizon` type, `HORIZON_OPTIONS`, and `horizonToLens`:
   ```ts
   export type MapHorizon = 'now' | 'today' | 'threeDay' | 'week';
   // NOW_MS (3h) and THREE_DAY_MS (3*DAY_MS) are declared by P1 above — reuse them.
   export const HORIZON_OPTIONS: { id: MapHorizon; label: string; hotkey: string }[] = [
     { id: 'now',      label: 'Now',    hotkey: '1' },
     { id: 'today',    label: 'Today',  hotkey: '2' },
     { id: 'threeDay', label: '3 Days', hotkey: '3' },
     { id: 'week',     label: 'Week',   hotkey: '4' },
   ];
   // Derive an EXISTING MapLens-compatible window so all downstream consumers
   // (lensIncludesContact, useVisitedStops, useMeetingMarkers, useMapAiProposals)
   // stay untouched. 'now' and 'today' both ride the existing 'today' window;
   // 'threeDay' and 'week' ride 'week'. The finer 'now'/'3-day' granularity is
   // applied as an ADDITIONAL client-side filter (Step 4), never by widening the
   // lens enum.
   export const horizonToLens = (h: MapHorizon): MapLens =>
     h === 'week' || h === 'threeDay' ? 'week' : 'today';
   ```
   This honors §4.1's "**keep the old enum internally**" preservation directive — no `MapLens` consumer is rewritten.
3. **Wire state in `PulseMapView.tsx`** (do NOT delete `lens`/`setLens` at `:103`):
   - Add `const [horizon, setHorizon] = useState<MapHorizon>('today');` and `const [atlasMode, setAtlasMode] = useState(false);`.
   - Derive the lens the rest of the pipeline consumes:
     ```ts
     const effectiveLens: MapLens = mapHorizonOn
       ? (atlasMode ? 'atlas' : horizonToLens(horizon))
       : lens;
     ```
   - **Replace every internal read of `lens` with `effectiveLens`** at the consumer call-sites — `useVisitedStops(effectiveLens)` (:167), `useMeetingMarkers(effectiveLens, …)` (:168), `lensIncludesContact(c, effectiveLens, now, geoSignals)` (:210), `useSrAnnouncer(effectiveLens, …)` (:238), `offsetableMarkers`/atlas gates (:312, :643, :704, :764, :827, :896, :970, :979), `useMapAiProposals({ lens: effectiveLens, … })` (:434), `LensEmptyState lens={effectiveLens}` (:985), `onOpenAtlas={() => mapHorizonOn ? setAtlasMode(true) : setLens('atlas')}` (:990). **This is a rename of reads, not a removal of `lens`** — the OFF path still drives `lens` via `MapLensRow`/keyboard, and `effectiveLens === lens` when `mapHorizonOn` is false. (Rule-A: this is the approved §4.1 replacement, scoped to the gated branch via the ternary.)
4. **Apply the finer Now/3-day window as a client-side filter** (the locked "BOTH" rule for Now): when `mapHorizonOn && horizon === 'now' && !atlasMode`, additionally narrow the meeting set to events whose start ∈ `[now, now+NOW_MS)` AND surface the nearest un-visited stop. Implement as a thin predicate applied to `meetingMarkers`/`visibleMarkers` **after** `lensIncludesContact` (do not push horizon granularity into `lensIncludesContact` — §4.1 Cons explicitly warns against rewriting that tuned predicate). For `threeDay`, narrow week-window events to `[now-DAY_MS, now+THREE_DAY_MS)`. Keep these as `useMemo` filters layered on top; the `today`/`week` windows from `useGeoRelevanceSignals` are unchanged.
5. **Keyboard parity** (`useMapKeyboardShortcuts.ts`): extend `UseMapKeyboardShortcutsInput` (`:22-37`) with optional `mapHorizonOn?: boolean; setHorizon?: (h: MapHorizon) => void; atlasMode?: boolean; setAtlasMode?: (b: boolean) => void;`. In the key block (`:74-80`), branch: when `mapHorizonOn`, map **`1→setHorizon('now')`, `2→setHorizon('today')`, `3→setHorizon('threeDay')`, `4→setHorizon('week')`, `a`/`A → setAtlasMode(v => !v)`** (Atlas-mode toggle), and **`5`/`6`/`7` → NO-OP** (the Sat/Terr/Hybrid `changeViewMode` they drive on the OFF path is dead on MapLibre — explicitly do nothing rather than change a non-existent view mode). `/` (focus search) and the `Escape` ladder are unchanged on both paths. When OFF, keep the exact existing `1/2/3 → setLens` + `4/5/6/7 → changeViewMode` behavior. **Preserve the `inField`/`isOverlayOpen()` guards (`:72-73`) and the `Escape` ladder (`:64-70`) verbatim.** Note: under `mapHorizon` ON the `4` key is reassigned from `roadmap` view to the Week detent and `5/6/7` go inert — acceptable because Sat/Terr/Hybrid is dead on MapLibre and the base-style switch (§4.2) owns its own keys; document this in the header comment block at `:7-13`.
6. **SR parity** (`useSrAnnouncer.ts`): add an optional 4th param `horizonLabel?: string`. Add a second `useEffect` keyed on `horizonLabel` that sets `"{Horizon} horizon, {markerCount} {contacts}"`. The existing lens/view effects stay (OFF path). In `PulseMapView.tsx`, compute the label from `HORIZON_OPTIONS.find(o => o.id === horizon)?.label` (or `"Atlas"` when `atlasMode`) and pass it only when `mapHorizonOn`. This guarantees SR users hear a detent/Atlas change exactly as they hear a 1/2/3 tab change today.
7. **Build `HorizonScrubber.tsx`**: render `HORIZON_OPTIONS` as a `role="group" aria-label="Time horizon"` of `aria-pressed` buttons (detents), each with `aria-keyshortcuts` and a `<kbd>` chip, mono-uppercase, accept a `right` slot (pass `MapFilterControls` exactly as `MapLensRow` does at `PulseMapView.tsx:620-629`). Neutral-chrome the active state (P6 will finalize tokens; build it neutral from the start — active detent uses `var(--pulse-surface-raised)` + `var(--pulse-ink)`, not rose).
8. **Build `AtlasModeToggle.tsx`**: a single `aria-pressed={atlasMode}` button (label "Atlas", `aria-keyshortcuts="a"`, `<kbd>A</kbd>`), neutral chrome, placed adjacent to the scrubber. On press → `setAtlasMode(!atlasMode)`.
9. **Render-branch in `PulseMapView.tsx`** at the `<MapLensRow>` site (`:616-630`):
   ```tsx
   {mapHorizonOn ? (
     <div className="flex items-center justify-between gap-3 px-2 py-1.5 border-b ...">
       <div className="flex items-center gap-2">
         <HorizonScrubber horizon={horizon} onHorizonChange={setHorizon} isDarkMode={isDarkMode} disabled={atlasMode} />
         <AtlasModeToggle atlasMode={atlasMode} onToggle={() => setAtlasMode(v => !v)} isDarkMode={isDarkMode} />
       </div>
       <MapFilterControls filter={filter} isDarkMode={isDarkMode} onFilterChange={setFilter} userId={userId} searchInputRef={searchInputRef} contacts={localContacts} />
     </div>
   ) : (
     <MapLensRow lens={lens} isDarkMode={isDarkMode} onLensChange={setLens} right={<MapFilterControls … />} />
   )}
   ```
   `MapFilterAccessories` below (`:631-638`) stays unconditional for both paths.
10. **Atlas-mode camera**: `useFitBounds(activeCamera, cameraReady, visibleMarkers, meetingMarkers, userPosition)` (`:249`) already frames all markers; because `effectiveLens === 'atlas'` when `atlasMode`, `visibleMarkers` expands to everything pinned (`lensIncludesContact` returns `true` for atlas at `useGeoRelevanceSignals.ts:61`) and `useFitBounds` zooms to network bounds automatically. No new camera call needed — verify the existing fit triggers on the marker-set change.

**Data / schema / migration:** none. This phase is UI + derived-state only; the data layer (`useGeoRelevanceSignals`, `DAY_MS`/`WEEK_MS`, `lensIncludesContact`) is consumed unchanged.

**Code patterns (real signatures this work plugs into):**
- `MapLens` (the type the derived `effectiveLens` must satisfy): `sub/mapLens.ts:14` → `export type MapLens = 'today' | 'week' | 'atlas';`
- The predicate (do NOT rewrite — pass the derived lens): `useGeoRelevanceSignals.ts:55` → `export function lensIncludesContact(c: Contact, lens: MapLens, now: number, signals: GeoSignals): boolean`.
- `GeoSignals` shape (unchanged, just read): `useGeoRelevanceSignals.ts:23-30` → `{ todayEvents: CalendarEvent[]; weekEvents: CalendarEvent[]; recentMessageContactIds: Set<string>; hasRealSignals: boolean }`.
- Keyboard hook contract: `useMapKeyboardShortcuts.ts:39` → `export function useMapKeyboardShortcuts(input: UseMapKeyboardShortcutsInput): void` with `setLens: (lens: MapLens) => void` / `changeViewMode: (mode: MapViewMode) => void`.
- SR hook contract: `useSrAnnouncer.ts:13` → `export function useSrAnnouncer(lens: MapLens, markerCount: number, viewMode: MapViewMode): string`.
- The `right`-slot contract to reuse: `MapLensRow.tsx:17-23` (`MapLensRowProps`, `right?: React.ReactNode`).
- Dev-override hook to clone: `provider/useMapLibreRenderer.ts` (`readDevOverride()` + `override ?? features.mapLibreRenderer`).

**Acceptance criteria:**
- With `?ff_mapHorizon=on` (MapLibre default-on): the lens row is replaced by the scrubber (Now/Today/3 Days/Week) + an Atlas toggle. Moving the scrubber changes the visible marker set and the AI card per window; **Now** shows only the nearest un-visited stop + meetings in the next 3h; **3 Days** shows the 3-day window; **Week** matches the old Week tab; **Atlas** toggle (or `A`) zooms to full network bounds and shows everything pinned, independent of the scrubber position.
- Keyboard: `1/2/3/4` move detents, `A` toggles Atlas, `/` still focuses search, `Escape` ladder unchanged. SR announces each detent + Atlas change (verify via the live region at `PulseMapView.tsx:607-609`).
- With `?ff_mapHorizon=off` (or flag default OFF): `MapLensRow` renders **byte-identical** to today; `1/2/3 → setLens`, `4/5/6/7 → changeViewMode` all unchanged; no scrubber mounts.
- `lensIncludesContact`, `useVisitedStops`, `useMeetingMarkers`, `useMapAiProposals`, `LensEmptyState` all receive a valid `MapLens` in both paths (no `'now'`/`'threeDay'` ever leaks into a `MapLens` consumer).

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "components/map" ` — gate on **NO NEW errors** (repo carries ~1234 pre-existing; full-repo OOMs at default heap).
- `npm run test` (Vitest) — full suite green; if a map test exists it must still pass.
- Manual (dev server, `npm run dev:full`): load `?ff_mapHorizon=on`, tab through detents with `1/2/3/4` and `A`; toggle `?ff_mapHorizon=off` and confirm the old 3-tab row returns identically. With a screen reader / the SR live region inspected in DevTools, confirm each detent fires one announcement.

**Commit:** `feat(map): Horizon scrubber + Atlas-mode toggle (mapHorizon)`
(HEREDOC body noting: §4.1 Rule-A-approved replacement, flag-gated `mapHorizon` OFF default, `MapLensRow` preserved on OFF path, `MapLens` enum preserved internally via `horizonToLens`. Sign with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` line. `git add src/components/map/horizon/` immediately so the new folder survives — CLAUDE.md §1.)

**Rollback:** Set `mapHorizon` default `false` (already) and/or `?ff_mapHorizon=off` — the ternary at the render site (`:616`) routes back to `MapLensRow` with zero behavior change. To fully revert: `git revert <sha>`; the new `horizon/` folder and `useMapHorizon` hook are orphaned but harmless (tree-shaken; only imported under the flag branch).

**Preserve-verbatim / gotchas:**
- **Rule A — do NOT delete `MapLensRow.tsx`, `lens`/`setLens` (`:103`), `LENS_OPTIONS`, or the `MapLens` enum.** They remain the OFF-path UI and the internal window type. The scrubber is purely additive + branch-gated.
- **Do NOT push `'now'`/`'threeDay'` into the `MapLens` type or into `lensIncludesContact`** — that would widen the tuned real-signals/legacy-proxy branches (§4.1 Cons). Granularity lives in the post-filter only.
- **Do NOT touch the "I'm at…" handoff** (`PulseMapView.tsx:1069-1083` dispatch ↔ `Messages.tsx:1897-1929` (`src/components/Messages.tsx`) ↔ `ImAtFAB.tsx:125`) — out of scope (P11 owns it; the locked ground-truth says it's real + bidirectional).
- The `4` key changes meaning under the flag (Week detent vs `roadmap` view). This is intentional (Sat/Terr/Hybrid is dead on MapLibre) but MUST be documented in `useMapKeyboardShortcuts.ts`'s header comment so a future reader isn't confused.
- `MapFilterControls` has its own `B`-key broadcast handler (`MapFilterBar.tsx:122-139`) and `inField` guard — independent of the scrubber; leave it untouched. Confirm no `1/2/3/4`/`A` collision with form fields (the scrubber's keys are guarded by the same `inField` check in `useMapKeyboardShortcuts`).
- Re-grep `lens === 'atlas'` / `lens === 'today'` / `lens === 'week'` across `PulseMapView.tsx` immediately before editing (line numbers drift between phases) and confirm each MapLibre-branch consumer is switched to `effectiveLens`. A missed site = a marker-set that ignores the scrubber.
- The **Google-branch atlas gates** (`:827/:896/:970/:979`, inside the `:805-980` else-branch) *can* be switched to `effectiveLens` for consistency, but they are **inert on the Horizon path** — the scrubber renders only on MapLibre (`mapHorizon` assumes `mapLibreRenderer` ON), so the Horizon path never enters the Google branch. Priority is the MapLibre branch + the shared consumers (`useVisitedStops`/`useMeetingMarkers`/`lensIncludesContact`/`useMapAiProposals`/`useSrAnnouncer`/`LensEmptyState`); the Google gates are optional cleanup, not load-bearing for Horizon.

---

### P6 — Coral-neutral chrome (signal-only coral)
**Gate:** REQUIRES Rule-A approval (strategic §4.4 — "Coral chrome → neutral chrome") — and **Depends on:** P0 (flag), P5 (the `HorizonScrubber`/`AtlasModeToggle` must already be neutral by construction; this phase additionally neutralizes the pre-existing filter/control/focus-ring chrome).
**Goal:** Behind `mapHorizon` ON, pull rose/coral off non-signal chrome (filter controls, accessories, focus rings) and route it through neutral `var(--pulse-*)` tokens, while **preserving coral on the four real signals**: the AI strip/card, the accepted-route polyline, the live-presence chip, and the broadcast-active state. With `mapHorizon` OFF, all chrome stays exactly as today.

**Preconditions:**
- §4.4 Rule-A approval recorded.
- `mapHorizon` flag + `useMapHorizon()` from P5 available (the conversion is gated, so a flag-OFF user sees zero change — keeps the legacy look intact and the change reversible).
- Re-confirm the coral inventory (re-grep before editing — these are the swap targets vs. the preserve set):
  - **VERIFIED swap targets (chrome — convert to neutral under the flag):**
    - `MapFilterBar.tsx` — location-type active chip `bg-rose-500 text-white` (**:191-192**); Broadcast pill focus ring `focus-visible:ring-rose-500` (**:213**); search clear-button focus ring `focus-visible:ring-rose-500` (**:165**); accessory geo-banner dismiss focus ring `focus-visible:ring-rose-500` (**:294**). (Broadcast pill's **active** `bg-rose-500` at **:215** is a PRESERVE — see below.)
    - `sub/MapViewPicker.tsx` — active view chip `text-rose-500 bg-rose-500/10|bg-rose-50` (**:49**) + focus ring `focus-visible:ring-rose-500` (**:47**). NOTE: MapViewPicker is the dead Sat/Terr/Hybrid control; under `mapHorizon` it is being replaced by the §4.2 base-style switch, so its tokens may not need conversion if it's not rendered on the flag path. **VERIFY whether MapViewPicker still renders under `mapHorizon` ON** (the §4.2 phase, not P6, decides this). If it does render on the flag path, neutralize it; if §4.2 already swapped it for `BaseStyleSwitch`, neutralize `BaseStyleSwitch` instead.
    - `PulseMapView.tsx` — the **marker-count badge** `Users` icon `text-rose-500` (**:1063**) is chrome (a passive count, not live signal) → neutralize under the flag. The Settings/loading error states' rose (`:505`, `:520`) are Google-fallback-only and out of the MapLibre flag path — leave them.
    - `sub/MapLensRow.tsx` (**:61-64**) and `sub/MapViewPicker.tsx` active/focus rose: **only relevant on the OFF path** — do NOT touch (OFF path must stay identical). The flag-ON path uses `HorizonScrubber` (already neutral from P5).
    - Focus rings across `src/components/map/**`: the pervasive `focus-visible:ring-rose-500` on neutral controls. Convert to a neutral focus token on the flag path **only where the control is chrome** (filters, scrubber, view/base-style picker, badges). **Do NOT neutralize focus rings on signal controls** (AI strip buttons, broadcast pill, live chip) — a coral focus ring there is consistent with the signal.
  - **VERIFIED preserve set (coral IS signal — DO NOT touch):**
    - AI strip/card: `sub/AiStrip.tsx` — the rose-tinted band gradient (**:78-79**), border (**:81**), Navigation icon/label (**:99-101**), Accept CTA `bg-rose-500` (**:113**), reorder/sequence chips (**:166-307**). The whole component is the AI-signal surface (strategic §4.4 + CLAUDE.md §4 coral budget exception, already documented at `PulseMapView.tsx:640-642`).
    - Accepted-route polyline: `overlays/AcceptedRoutePolyline.tsx` (Google) + `provider/MapLibreAcceptedRoute.tsx` (MapLibre). Route = coral signal.
    - Live-presence chip: `PulseMapView.tsx:1035-1051` — the `bg-rose-500/70 animate-ping` + `bg-rose-500` dot and `focus-visible:ring-rose-500` (**:1039, :1046-1047**). Live = signal.
    - Broadcast-active state: `MapFilterBar.tsx:215` (`liveOn ? 'bg-rose-500 text-white'`) and its live-dot (**:223-225**). Broadcasting = live signal.
    - Cluster disc focus ring `focus-visible:ring-rose-500` (`sub/MapClusterMarker.tsx:61`): the cluster disc is a coral marker-family element (a route/marker affordance), not neutral chrome — leave it (or treat per the marker-coral rule; default: PRESERVE).

**Files to touch:**
- `src/components/map/MapFilterBar.tsx` — **:165** (search clear focus ring), **:191-192** (location-type active chip fill+text), **:294** (geo-banner dismiss focus ring): swap rose→neutral tokens **under the `mapHorizon` flag** (the component needs the flag — see Steps 1). PRESERVE **:213/:215/:223-225** (broadcast pill focus ring is borderline; the **active** fill + dot MUST stay coral).
- `src/components/map/PulseMapView.tsx` — **:1063** (marker-count `Users` icon `text-rose-500`): neutralize under the flag. PRESERVE **:1035-1051** (live chip) and **:1046-1047** (ping dot).
- `src/components/map/horizon/HorizonScrubber.tsx` + `AtlasModeToggle.tsx` (from P5) — confirm they were built neutral; no change expected (this phase is the audit that they are).
- `src/components/map/sub/MapViewPicker.tsx` **OR** `horizon/BaseStyleSwitch.tsx` (whichever renders on the flag path per §4.2) — **:47, :49**: neutralize the active/focus rose. (If MapViewPicker is OFF-path-only under the flag, skip it.)
- Focus-ring sweep: `src/components/map/**` chrome controls — replace `focus-visible:ring-rose-500` with the neutral focus token **on chrome only**, gated.

**New files:**
- (Optional) `src/components/map/horizon/mapHorizonTokens.ts` — a tiny export of the neutral class strings used by the gated chrome (active-chip, focus-ring, badge-icon) so the swap is **centralized** (strategic §4.4 Cons: "risk of inconsistent neutral tokens if not centralized"). **Copy the const-map pattern from `MapFilterBar.tsx:63-67` (`LOCATION_OPTIONS`)** — a single source the components import. Responsibility: one place that defines `activeChip`, `chromeFocusRing`, `badgeIcon` neutral classes.

**Steps:**
1. **Thread the flag into the chrome components.** `MapFilterControls`/`MapFilterAccessories` (`MapFilterBar.tsx`) currently take no flag. Pass `mapHorizon?: boolean` down as a prop from `PulseMapView.tsx` (compute `mapHorizonOn` once at `:108`-adjacent from P5's `useMapHorizon()`), OR call `useMapHorizon()` inside the component. **Prop-threading is preferred** (keeps the component testable + avoids a second hook subscription) — add `mapHorizon?: boolean` to `MapFilterControlsProps` (`:44-52`) and `MapFilterAccessoriesProps` (`:54-58`), default `false`.
2. **Define neutral tokens** (in `mapHorizonTokens.ts` or inline-but-centralized):
   - active chip (was `bg-rose-500 text-white`): `bg-[var(--pulse-surface-raised)] text-[var(--pulse-ink)]` with `border border-[var(--pulse-border-strong)]` for the pressed affordance — **no hardcoded hex** (CLAUDE.md token rule).
   - chrome focus ring (was `focus-visible:ring-rose-500`): a neutral ring, e.g. `focus-visible:ring-[var(--pulse-border-strong)]` (or a dedicated `--pulse-focus` if one is added; today the canonical map focus is rose, so use the neutral border-strong token).
   - badge icon (was `text-rose-500`): `text-[var(--pulse-ink-3)]`.
3. **Apply gated swaps** in each chrome site. Pattern (location-type chip at `MapFilterBar.tsx:190-194`):
   ```tsx
   active
     ? (mapHorizon ? NEUTRAL_ACTIVE_CHIP : 'bg-rose-500 text-white')
     : `${isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-200'}`
   ```
   Keep the OFF branch byte-identical. Repeat for focus rings (`:165, :294, :47`) and the marker-count icon (`PulseMapView.tsx:1063`).
4. **Audit the preserve set** — explicitly confirm NO change lands on: `AiStrip.tsx` (any line), `AcceptedRoutePolyline.tsx`/`MapLibreAcceptedRoute.tsx`, the live chip (`PulseMapView.tsx:1035-1051`), broadcast-active (`MapFilterBar.tsx:215, :223-225`). Grep the diff before commit: `git diff -- src/components/map/sub/AiStrip.tsx` must be empty.
5. **No hardcoded colors** — grep the diff for `rose-`, `#f`, `rgba(` additions; every new color must be a `var(--pulse-*)`. The geo-banner amber inline styles (`MapFilterBar.tsx:280-287`) are a `warning` status color, not coral — out of P6 scope (status-stays-status), leave them.

**Data / schema / migration:** none. Pure CSS/token change.

**Code patterns (real signatures this work plugs into):**
- Chrome component props to extend: `MapFilterBar.tsx:44-52` (`MapFilterControlsProps`) + `:54-58` (`MapFilterAccessoriesProps`); both extend `CommonProps` (`:38-42`).
- The centralizable const-map analogue: `MapFilterBar.tsx:63-67` (`LOCATION_OPTIONS`).
- Canonical neutral tokens to consume (verified present in `src/styles/pulse-tokens.css`): `--pulse-ink` (`:70`), `--pulse-ink-3` (`:72`), `--pulse-surface-raised` (`:50`), `--pulse-border` (`:55`), `--pulse-border-strong` (`:56`) — all with `.dark` overrides (`:150-152, :137, :141-142`). **Do NOT redeclare these locally** (CLAUDE.md Pulse-gotcha: tokens are canonical at `pulse-tokens.css`).
- The documented coral-budget exception for the AI strip (preserve): `PulseMapView.tsx:640-642` ("Committed-coral band is the one place coral exceeds the ≤10% rule on this surface, accepted in the shape brief").

**Acceptance criteria:**
- With `?ff_mapHorizon=on`: filter controls (location-type chips, search, clear button), the marker-count badge, and chrome focus rings render in neutral `var(--pulse-*)` tones — no rose on passive chrome.
- The AI strip/card, accepted-route polyline (both renderers), live-presence chip + ping dot, and broadcast-ON pill + live dot **still render coral**.
- With `?ff_mapHorizon=off`: every chrome surface renders **identically to today** (rose chips, rose focus rings) — zero visual diff.
- Zero hardcoded colors introduced (all swaps via tokens); `git diff` shows no new `rose-`/hex on the converted sites and an empty diff for `AiStrip.tsx` + the route overlays.

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "components/map"` — NO NEW errors.
- `npm run test` (Vitest) — green.
- `git diff -- src/components/map/sub/AiStrip.tsx src/components/map/overlays/AcceptedRoutePolyline.tsx src/components/map/provider/MapLibreAcceptedRoute.tsx` — must be **empty** (preserve-set guard).
- Grep guard for hardcoded color regressions on the diff: review `git diff -- src/components/map` for any added `rose-`, `#`, or `rgba(` outside a `var(--pulse-*)`.
- Manual (`npm run dev:full`): toggle `?ff_mapHorizon=on`/`off` and eyeball both themes (light + `.dark`). ON = neutral chrome + coral signals; OFF = legacy rose chrome. Tab-focus a filter chip ON (neutral ring) vs the Accept button (coral ring preserved).

**Commit:** `refactor(map): coral=signal-only chrome under mapHorizon`
(HEREDOC body: §4.4 Rule-A-approved token swap, gated `mapHorizon`, preserves coral on AI strip / accepted-route polyline / live chip / broadcast-active per the coral budget. Sign with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.)

**Rollback:** `?ff_mapHorizon=off` (or default OFF) restores all rose chrome instantly — every swap is wrapped in the flag ternary. Full revert: `git revert <sha>`.

**Preserve-verbatim / gotchas:**
- **Rule A — do NOT strip coral from the four signals:** AI strip/card (`AiStrip.tsx`), accepted-route polyline (`AcceptedRoutePolyline.tsx` + `MapLibreAcceptedRoute.tsx`), live-presence chip (`PulseMapView.tsx:1035-1051`), broadcast-active pill+dot (`MapFilterBar.tsx:215, :223-225`). These ARE signal; neutralizing them inverts the coral budget.
- **Do NOT touch the OFF path** — every swap is gated. The OFF render must be byte-identical (the legacy look is the fallback + the un-flagged production experience until P13 graduation).
- **Centralize the neutral tokens** (one `mapHorizonTokens.ts` or const) — §4.4's named risk is "inconsistent neutral tokens." Three components reuse the same active-chip/focus-ring strings; do not hand-write them per file.
- **The geo-banner amber (`MapFilterBar.tsx:280-287`) is a `warning` status, not coral** — leave it (Status-Stays-Status). Same for the Google-fallback error/loading rose (`PulseMapView.tsx:505, :520`) — out of the MapLibre flag path.
- **MapViewPicker ambiguity:** whether `:47/:49` need neutralizing depends on §4.2's outcome (is MapViewPicker still rendered under the flag, or replaced by `BaseStyleSwitch`?). VERIFY against the §4.2 phase before editing — do not neutralize a control that's no longer mounted on the flag path, and conversely neutralize the `BaseStyleSwitch` if that's what renders.
- **Marker/cluster coral** (`MapClusterMarker.tsx:61`, marker bodies): treat as marker-family signal, not chrome — default PRESERVE unless the §4 matrix explicitly reclassifies cluster discs as neutral.

---

**Verification corrections vs. the strategic handoff (noted per operating rules):**
- The strategic §4.4 / P6 sketch lists `horizon/BaseStyleSwitch.tsx` among P6's files. **Corrected:** `BaseStyleSwitch` is the §4.2 base-style-switch deliverable (a separate phase), not a P6 chrome-token file. P6 only *neutralizes whatever control renders on the flag path* (MapViewPicker if still mounted, else BaseStyleSwitch). I scoped P6 to chrome token swaps and flagged the dependency on §4.2's decision rather than asserting `BaseStyleSwitch` exists.
- The strategic doc cited the `lensIncludesContact` call as "~210" — **verified exact: `PulseMapView.tsx:210`** (inside the memo `:205-236`).
- The keyboard hook's real name is **`useMapKeyboardShortcuts`** (`hooks/useMapKeyboardShortcuts.ts`), called at `PulseMapView.tsx:474` — verified (the prompt asked to find its real name/file).
- There is **no pre-existing `?ff_mapHorizon` reader**; P5 must add `useMapHorizon()` (cloned from `provider/useMapLibreRenderer.ts`) for the `?ff_mapHorizon=on` manual-verify path to work. The `?ff_` convention itself is real (`src/lib/featureFlags.ts:324-329`).

---

All 5 maps functions confirmed live with `verify_jwt: true` (the platform default — and they are NOT declared in config.toml, so a CLI redeploy would silently re-apply the default, which happens to be correct, but the stanzas should be declared to make that explicit/durable). Live verify_jwt states: `maps-geocode: true`, `maps-distance: true`, `maps-directions: true`, `maps-route: true`, `maps-geosearch: true`. All correct.

I now have complete ground truth. Here is the P7 phase section.

---

### P7 — Realtime publication + RLS/security hardening (live-presence unblocker)

**Gate:** REQUIRES Rule-A approval before execution (cite strategic §4 — the `location_share_consents` write-policy tightening is a *replacement* of a live ALL policy that currently lets a viewer write any row where they're the viewer; the publication ADD and the `set_places_updated_at` search_path pin are purely additive and need no approval, but they ship in the same migration, so the whole phase carries the Rule-A flag). — **Depends on:** none (this is the foundational unblocker; P6 live-presence UI and P13 graduation both depend on P7).

**Goal:** Make `user_locations` realtime-broadcasting (the single required change that turns `subscribeToUserLocation` / `useLivePresence` from WIRED-BUT-DEAD into live), and close two security gaps surfaced in the audit: pin `set_places_updated_at()`'s `search_path`, and split the over-permissive `location_share_consents` ALL policy so a viewer can READ consent rows but only the SUBJECT can write them.

**Preconditions:**
- Confirmed live (this session, project `ucaeuszgoihoyrvhewxk`):
  - `pg_publication_tables` for `supabase_realtime` returns **zero** rows for all 6 geo tables (`user_locations`, `eta_shares`, `geofence_events`, `location_share_consents`, `places`, `entity_places`) — none are published.
  - `location_share_consents` has exactly ONE policy: `own_consents` (PERMISSIVE, cmd=ALL, roles `{public}`), `qual = ((subject_user_id = auth.uid()) OR (viewer_user_id = auth.uid()))`, `with_check = NULL`. Because `with_check` is null, Postgres falls back to the USING qual for the write check — so a viewer can INSERT/UPDATE/DELETE any row where `viewer_user_id = auth.uid()` (e.g. self-granting `is_granted=true` on someone else's behalf). That is the bug to fix.
  - `set_places_updated_at()` has `proconfig = NULL` (no pinned `search_path`); it is `BEFORE UPDATE` only (trigger `trg_places_updated_at`, tgtype=19), body = `NEW.updated_at := NOW(); RETURN NEW;`.
  - `user_locations.user_id` is **uuid** (NOT text — contrast with `tasks.user_id`/`contacts.user_id` which are text); RLS already correct: `own_location` (ALL, `user_id = auth.uid()`) + `consented_location_read` (SELECT, gated on `is_sharing = true` AND a granted, unexpired consent row). Realtime respects RLS, so publishing `user_locations` does NOT leak — a viewer only receives rows the SELECT policy already lets them read.
  - `user_locations` REPLICA IDENTITY = `d` (DEFAULT = primary key). For the presence use case (clients filter on the NEW row's `user_id`, which is also the PK target of the upsert) DEFAULT is sufficient; FULL is not required. Noted, not changed.
  - All 5 maps edge fns (`maps-geocode`, `maps-distance`, `maps-directions`, `maps-route`, `maps-geosearch`) are live with `verify_jwt=true` (platform default) and are NOT declared in `config.toml`. The default is already correct; we declare the stanzas so a future CLI redeploy can't silently change them.
- The `mapHorizon` flag is irrelevant to P7 — this is backend/DB infra with no UI; it ships unflagged. (Live presence only becomes *user-visible* via the P6 UI behind `mapHorizon`.)

**Files to touch:**
- `supabase/config.toml` — verified anchor: lines 437–448 (the last declared `[functions.*]` stanzas: `slack-events` :435, `gmail-watch-renew` :444, `gmail-push-receiver` :447) end at line 448, before `[analytics]` at :450 — append the 5 `[functions.maps-*]` stanzas after line 448. What changes: adds explicit `verify_jwt = true` for each maps fn so the durable config matches live and a redeploy can't drift it.

**New files:**
- `supabase/migrations/20260616000001_map_horizon_realtime_and_rls.sql` — responsibility: (1) `ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations`; (2) `ALTER FUNCTION public.set_places_updated_at() SET search_path = public, pg_temp`; (3) drop the over-broad `own_consents` ALL policy and replace with a SELECT-both policy plus subject-only INSERT/UPDATE/DELETE policies. Copy the migration header/comment style from `supabase/migrations/20260318000002_location_sharing.sql` (the original location-sharing migration — same domain) and the security-hardening idempotency style from `supabase/migrations/20260309000111_cleanup_updated_at_functions.sql`.
  - **Timestamp convention:** existing migrations use `YYYYMMDDHHMMSS_snake_name.sql` (e.g. `20260426000006_…`, `20260606…`). Today is 2026-06-15; use `20260616000001` (next-day, sequence `…0001`) so it sorts AFTER every current migration. If a P-earlier phase already lands a `20260616…` migration, bump the trailing serial (…0002) — verify with `ls supabase/migrations/ | sort | tail -5` before finalizing the name.

**Steps:**
1. **Confirm state hasn't drifted** since this handoff — re-run the three verification queries in *Data / schema / migration* §"Pre-apply re-verify" below via the Supabase MCP (`mcp__claude_ai_Supabase__execute_sql`, project `ucaeuszgoihoyrvhewxk`). If `own_consents` no longer matches the quoted text verbatim, STOP and re-derive the DROP/CREATE against the actual live policy (do not trust this doc over live state — per CLAUDE.md schema-first).
2. **Verify `execute_sql` transaction semantics with a probe FIRST.** Before trusting the rolled-back `DO` block, confirm an aborted `DO $$ … RAISE EXCEPTION $$` actually leaves NO trace: run a probe that inserts a temp marker then RAISEs, e.g.
   ```sql
   DO $$ BEGIN
     CREATE TEMP TABLE _p7_probe(x int);  -- temp marker
     RAISE EXCEPTION 'rollback-probe';
   END $$;
   -- then, in a SEPARATE execute_sql call, confirm the marker is gone:
   SELECT to_regclass('pg_temp._p7_probe');  -- expect NULL
   ```
   If the marker survives, the harness is NOT wrapping each call in a rolled-back transaction and the dry-run is unsafe — STOP and re-plan (apply against a Supabase branch instead). Only proceed once the probe confirms a clean rollback.
3. **Dry-run** the full migration body inside the `DO $$ … RAISE EXCEPTION 'rollback' $$` wrapper (full SQL below) via `execute_sql`. Confirm it runs through every statement and aborts ONLY on the intentional `rollback` exception (not on a real error like "policy already exists" or "table is already member of publication"). Read the error text: the rollback RAISE is expected; anything else is a real failure to fix first.
4. **Post-dry-run assertion (proof the rollback worked):** re-run the 3 *Pre-apply re-verify* queries and confirm state is UNCHANGED — `user_locations` still ABSENT from `supabase_realtime`, `own_consents` still present (the 4 new policies NOT created), `set_places_updated_at` `proconfig` still NULL. If any of those changed, the dry-run was NOT rolled back; STOP before the real apply.
5. **Apply once** — run the final (non-DO-block) migration via `mcp__claude_ai_Supabase__apply_migration` with name `20260616000001_map_horizon_realtime_and_rls` so it's recorded in `supabase_migrations.schema_migrations`. (Using `apply_migration`, not `execute_sql`, is what registers it — otherwise the file and the DB drift.)
6. **Write the migration file** to `supabase/migrations/20260616000001_map_horizon_realtime_and_rls.sql` with the SAME final SQL, so the repo file matches what was applied (the MCP applies to the remote DB; the committed file is the source-of-truth record). Verify the applied version is listed via `mcp__claude_ai_Supabase__list_migrations`.
7. **Edit `config.toml`** — append the 5 maps stanzas (block below) after line 448.
8. **Post-apply verify** — re-run the publication + policy + proconfig queries (commands below) and confirm: `user_locations` is now in `supabase_realtime`; `location_share_consents` has 4 policies (1 SELECT both-sided + 3 write subject-only); `set_places_updated_at` `proconfig = {search_path=public,pg_temp}`.
9. **Run `get_advisors`** (`type: 'security'`) via the MCP to confirm no NEW security advisory was introduced by the policy change and that the prior `function_search_path_mutable` advisory for `set_places_updated_at` (if present) is now cleared.
10. **Commit** (message below). Commit the migration file AND `config.toml` together in one commit.

**Data / schema / migration:**

*Pre-apply re-verify (run first, expect identical output to the handoff):*
```sql
-- 1) publication membership (expect 0 rows)
SELECT tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime'
  AND tablename IN ('user_locations','eta_shares','geofence_events');
-- 2) consent policy (expect the single own_consents ALL policy, with_check NULL)
SELECT policyname, cmd, qual, with_check FROM pg_policies
WHERE tablename='location_share_consents';
-- 3) function search_path (expect proconfig NULL)
SELECT proname, proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='set_places_updated_at';
```

*DRY-RUN (rolled-back) — run this FIRST; it must reach the final `RAISE EXCEPTION 'rollback'` cleanly:*
```sql
DO $$
BEGIN
  -- (1) Publish user_locations for realtime. Guarded: skip if already a member
  -- (re-runnable). ADD TABLE errors if the table is already published, so check first.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_locations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations';
  END IF;

  -- (2) Pin search_path on the places updated_at trigger fn (no SECURITY DEFINER,
  -- but search_path hygiene per the 2026-05-31 DB security baseline).
  EXECUTE 'ALTER FUNCTION public.set_places_updated_at() SET search_path = public, pg_temp';

  -- (3) Tighten location_share_consents: replace the single ALL policy
  -- (which let a viewer WRITE rows) with read-both / write-subject-only.
  EXECUTE 'DROP POLICY IF EXISTS own_consents ON public.location_share_consents';

  EXECUTE $p$
    CREATE POLICY consents_select_either ON public.location_share_consents
      FOR SELECT USING (subject_user_id = auth.uid() OR viewer_user_id = auth.uid())
  $p$;
  EXECUTE $p$
    CREATE POLICY consents_insert_subject ON public.location_share_consents
      FOR INSERT WITH CHECK (subject_user_id = auth.uid())
  $p$;
  EXECUTE $p$
    CREATE POLICY consents_update_subject ON public.location_share_consents
      FOR UPDATE USING (subject_user_id = auth.uid())
                 WITH CHECK (subject_user_id = auth.uid())
  $p$;
  EXECUTE $p$
    CREATE POLICY consents_delete_subject ON public.location_share_consents
      FOR DELETE USING (subject_user_id = auth.uid())
  $p$;

  RAISE EXCEPTION 'rollback';  -- dry-run: abort, persist nothing
END $$;
```
Expected outcome: the only error is `ERROR: rollback`. Any other error (real) must be resolved before the apply step. (Note: the `DO`-block `EXECUTE` form is used precisely so the dry-run wraps DDL — plain `ALTER PUBLICATION`/`CREATE POLICY` can't sit inside a transaction-aborting `DO` otherwise. The final apply below uses plain top-level DDL, not the DO block.)

*FINAL APPLY (the actual migration file body — no DO wrapper, idempotent):*
```sql
-- 20260616000001_map_horizon_realtime_and_rls.sql
-- Map Horizon (Direction D) P7: realtime publication + RLS/security hardening.
-- 1) Publish user_locations so subscribeToUserLocation/useLivePresence go live.
--    (eta_shares + geofence_events are intentionally NOT published here — see note.)
-- 2) Pin search_path on set_places_updated_at (DB security baseline 2026-05-31).
-- 3) Split location_share_consents: viewers may READ consent rows, only the
--    SUBJECT may write them (the old single ALL policy let a viewer self-grant).

-- (1) Realtime publication — guarded so a re-run is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;
  END IF;
END $$;

-- (2) search_path hygiene on the trigger function.
ALTER FUNCTION public.set_places_updated_at() SET search_path = public, pg_temp;

-- (3) Consent policy split. DROP the 4 new policies first too, so a retry
-- (e.g. after a partial apply) is safe — CREATE POLICY errors "already exists"
-- on a second non-IF run otherwise.
DROP POLICY IF EXISTS own_consents ON public.location_share_consents;
DROP POLICY IF EXISTS consents_select_either ON public.location_share_consents;
DROP POLICY IF EXISTS consents_insert_subject ON public.location_share_consents;
DROP POLICY IF EXISTS consents_update_subject ON public.location_share_consents;
DROP POLICY IF EXISTS consents_delete_subject ON public.location_share_consents;

CREATE POLICY consents_select_either ON public.location_share_consents
  FOR SELECT USING (subject_user_id = auth.uid() OR viewer_user_id = auth.uid());

CREATE POLICY consents_insert_subject ON public.location_share_consents
  FOR INSERT WITH CHECK (subject_user_id = auth.uid());

CREATE POLICY consents_update_subject ON public.location_share_consents
  FOR UPDATE USING (subject_user_id = auth.uid())
             WITH CHECK (subject_user_id = auth.uid());

CREATE POLICY consents_delete_subject ON public.location_share_consents
  FOR DELETE USING (subject_user_id = auth.uid());
```

*`config.toml` block to append after line 448:*
```toml
# maps-*: Google Maps proxies (geocode/distance/directions/route/geosearch).
# Each requires a valid user JWT (platform verify_jwt=true is the live state and
# the correct one — the functions are called from authenticated sessions via
# supabase.functions.invoke). Declared explicitly so a CLI redeploy does not
# drift them. Map Horizon P7.
[functions.maps-geocode]
verify_jwt = true

[functions.maps-distance]
verify_jwt = true

[functions.maps-directions]
verify_jwt = true

[functions.maps-route]
verify_jwt = true

[functions.maps-geosearch]
verify_jwt = true
```

**eta_shares / geofence_events (optional, NOT in this migration):** Per the locked scope, only `user_locations` is *required* to unblock live presence. `eta_shares` (consumed by `etaShareService.ts`) and `geofence_events` (consumed by `geofenceService.ts`) currently have NO realtime subscribers in the codebase — they're written and read via direct queries / the broadcast ticker, not via `postgres_changes`. Publishing them now would be speculative. To add later (a separate phase, additive): wrap each in the same guarded `IF NOT EXISTS … ALTER PUBLICATION … ADD TABLE` block, and FIRST add a realtime subscriber on the client or they broadcast to nobody. Their RLS must be verified before publishing (realtime honors RLS, so an under-scoped read policy would leak).

**Code patterns:** The client consumers this unblocks (do NOT change them in P7 — they're already correct, this phase just makes them fire):
- `src/services/locationService.ts:860-892` — `subscribeToUserLocation(targetUserId, onUpdate)` opens channel `location:${targetUserId}` listening for `postgres_changes` `event: 'UPDATE'`, `table: 'user_locations'`, `filter: user_id=eq.${targetUserId}`, mapping `payload.new` → `UserLocation` (interface at :745-755: `userId, lat, lng, accuracyM?, heading?, speedKmh?, locationLabel?, isSharing, updatedAt`).
- `src/components/map/hooks/useLivePresence.ts:19-33` — subscribes one channel per contact with a `pulseUserId`, accumulating into `Map<contactId, UserLocation>`.
- Writer: `locationService.ts:776-841` `startLocationBroadcast` upserts `user_locations` on a 15s debounce (`writePosition` :801-832).

**Acceptance criteria:**
- `pg_publication_tables` shows `public.user_locations` under `supabase_realtime`.
- `location_share_consents` has exactly 4 policies: `consents_select_either` (SELECT, both-sided), `consents_insert_subject` / `consents_update_subject` / `consents_delete_subject` (subject-only). A viewer can SELECT a consent row naming them but a viewer-side INSERT/UPDATE/DELETE of `is_granted` on a row where they are NOT the subject is rejected by RLS.
- `set_places_updated_at` `proconfig = {search_path=public,pg_temp}`.
- The migration is registered in `list_migrations` and the committed file matches the applied SQL.
- `config.toml` declares all 5 `[functions.maps-*] verify_jwt = true`.
- **Live presence (2-browser test):**
  1. Browser A: log in as User-A. Browser B: log in as User-B. (Use two profiles / one incognito — the e2e fixture token works for one; the second needs a real second account that is a Pulse contact of the first with `pulseUserId` set.)
  2. Establish consent: User-A is the SUBJECT, User-B is the VIEWER. As User-A, grant location share to User-B (`upsertLocationConsent(A, B, true)` via the LocationSharePanel) — this INSERT now passes `consents_insert_subject` (A = subject = auth.uid()).
  3. As User-A, start broadcasting (the "Share location" / BROADCAST toggle → `startLocationBroadcast`). Wait ≥15s for the first debounced write, or move/refresh to force a position write.
  4. In Browser B, open the Map with `?ff_mapHorizon=on`. User-A's live marker should appear and then MOVE within ~15s of A's position changing, with NO page refresh — proving the `postgres_changes` UPDATE is delivered.
  5. Negative: as User-B (viewer), attempt to write a consent row where B is NOT the subject (e.g. via console `supabase.from('location_share_consents').update({is_granted:true}).eq('subject_user_id', someOtherUserId)`) → expect 0 rows affected / RLS rejection.

**Verify (commands):**
```bash
# Pre/post DB state (via Supabase MCP execute_sql, project ucaeuszgoihoyrvhewxk):
#   the three Pre-apply queries above, re-run after apply.

# Confirm migration registered:
#   mcp__claude_ai_Supabase__list_migrations  → 20260616000001 present

# Security advisors (MCP): mcp__claude_ai_Supabase__get_advisors type='security'
#   → no new policy advisory; set_places_updated_at search_path advisory cleared.

# Type-check (no TS touched in P7, but run the gate — expect NO NEW errors over the ~1234 baseline):
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit

# Unit tests (locationService has no realtime test; ensure nothing regressed):
npm run test

# config.toml sanity (5 maps stanzas present):
#   use Grep tool: pattern "\[functions\.maps-" → 5 matches
```

**Commit:**
```
feat(map): publish user_locations realtime + harden location RLS/search_path (Map Horizon P7)

Map Horizon (Direction D) P7 — the live-presence unblocker.

- ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations:
  subscribeToUserLocation / useLivePresence were wired but dead; the table
  was absent from supabase_realtime so no postgres_changes ever fired.
  Now publishing it (guarded re-run). RLS already gates reads via
  consented_location_read, so realtime leaks nothing.
- ALTER FUNCTION set_places_updated_at SET search_path=public,pg_temp:
  closes the function_search_path_mutable gap (DB security baseline 2026-05-31).
- Split location_share_consents own_consents (ALL) into read-both /
  write-subject-only policies: the old single policy had with_check NULL,
  so a viewer could self-grant consent on a subject's behalf. Now only the
  subject may INSERT/UPDATE/DELETE; both parties may SELECT.
- Declare [functions.maps-*] verify_jwt=true in config.toml to match live
  state (was relying on the platform default) so a redeploy can't drift it.

Migration 20260616000001 dry-run-then-applied per schema-first convention.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

**Rollback:**
- Realtime: `ALTER PUBLICATION supabase_realtime DROP TABLE public.user_locations;` (reverts live presence to dead — non-destructive, no data loss).
- Consent policies: `DROP POLICY IF EXISTS consents_select_either / consents_insert_subject / consents_update_subject / consents_delete_subject ON public.location_share_consents;` then recreate the original: `CREATE POLICY own_consents ON public.location_share_consents FOR ALL USING (subject_user_id = auth.uid() OR viewer_user_id = auth.uid());` (restores the prior — including the looser write surface).
- search_path: `ALTER FUNCTION public.set_places_updated_at() RESET search_path;`.
- `config.toml`: revert the 5 appended stanzas (no behavior change — live default is already true).
- All four are reversible DB/config ops; `git revert <sha>` reverts the committed file but DOES NOT touch the live DB — you must run the rollback SQL via the MCP separately. Note this in the commit if reverting.

**Preserve-verbatim / gotchas:**
- **Rule-A — do NOT delete or rewrite** `subscribeToUserLocation`, `useLivePresence`, `startLocationBroadcast`, `setLocationSharing`, `upsertLocationConsent`, or the `location_share_consents` *bulk broadcast* helpers (`setBroadcastRecipients` :969, `endBroadcastRecipients` :1017) in `locationService.ts`. They are correct and load-bearing; P7 is DB/config only. The broadcast helpers write consent rows where `subject_user_id = broadcasterUserId` — under the NEW policies these still pass `consents_insert_subject`/`consents_update_subject` ONLY when the caller IS the broadcaster (which is always true: the broadcaster grants their own viewers). Confirm in the 2-browser test that BROADCAST still works after the policy split — this is the one functional risk of the RLS change.
- **First-ping INSERT gap (known, do NOT "fix" in P7):** `subscribeToUserLocation` listens for `event: 'UPDATE'` only (`:868`). The very first time a user shares, the `user_locations` row is *created* (the upsert at `:821` / `setLocationSharing` at `:900` is an INSERT for a brand-new user) — an INSERT event, which this subscription ignores. So the viewer sees the marker only after the SECOND write (next 15s debounce tick) or after a manual map refetch. This is a client-side widening (change `event` to `'*'` or add a one-shot initial SELECT) and belongs to the P6 live-presence UI phase, NOT here. Flag it; don't touch it.
- **`lat:0,lng:0` first frame:** `setLocationSharing` (:894-902) upserts `{is_sharing, lat:0, lng:0}`. If the viewer's first realtime frame is that row, the marker briefly renders at null-island (0,0). P6 should guard `lat===0 && lng===0`. Not a P7 change.
- **`updated_at == created_at` sort quirk:** `user_locations` has NO `created_at` column (schema confirmed: only `updated_at`), so this quirk does NOT apply to presence rows. It DOES apply to `location_share_consents` and `places`, where a freshly INSERTed row has `updated_at == created_at` (both default `now()`). Any UI that sorts those tables by `updated_at` desc to surface "most recently changed" will tie-break unpredictably between never-updated rows — sort by `created_at` for stable ordering of fresh rows, or `COALESCE`/secondary-sort by `id`. Relevant to P-later list surfaces, noted here so it isn't rediscovered.
- **REPLICA IDENTITY:** left at DEFAULT for `user_locations` (PK-only old-row on UPDATE/DELETE). Presence filters on `payload.new.user_id` so this is fine. Do NOT set `REPLICA IDENTITY FULL` unless a future feature needs old-row column values on UPDATE (it bloats WAL). Noted.
- **Realtime quota:** `useLivePresence` opens ONE channel per linked contact (`:24-29`). With many contacts this is many concurrent realtime subscriptions. Not a P7 blocker, but flag for P6: consider a single channel with no per-user filter + client-side dispatch if contact counts are high.
- **Do NOT trust the migration file `20260318000002_location_sharing.sql` as ground truth** for current RLS — the live `own_consents` policy and `user_locations` policies were confirmed via `pg_policies` this session; the file may predate live edits (per CLAUDE.md the places RLS is a documented case of stale-file vs live-policy drift). The SQL above is derived from LIVE state.
- **Apply exactly once:** use `apply_migration` (not `execute_sql`) for the final run so it's recorded. The migration is now fully re-runnable: (1) is a guarded no-op, (2) is idempotent, and (3) drops `own_consents` AND the 4 new policies with `DROP POLICY IF EXISTS` before recreating — so a retry after a partial apply is safe.

---

I now have complete, verified ground truth. I'll write the execution-ready P8 and P9 phase sections. One correction to note from my verification: the strategic doc's `provider/types.ts` LatLng already exists (it's defined, structurally compatible with `google.maps.LatLngLiteral`) — so P8's normalization is about retyping `AcceptedRoute.path` to use that existing `LatLng` type, not creating it.

Here are the phase sections:

---

### P8 — Live team first-class drawer
**Gate:** REQUIRES Rule-A approval (cite strategic §3.3 + §4 prime directive) — moving the broadcast trigger out of `MapFilterControls` materially alters a working surface. The new drawer itself + `setLocationSharing` wiring + `location_label` population are additive. (The `AcceptedRoute.path` retype is NOT in P8's Rule-A gate — it is a type-only, zero-runtime change OWNED BY P4; P8 only verifies it's done.) **Depends on:** P0 (flag), P7 (publishes `user_locations` to `supabase_realtime` — without it the drawer's live list is wired-but-dead), **P4 (owns the `AcceptedRoute.path` retype — run P4 first; see Step 1).**

**Goal:** Promote live team presence from the bottom-sheet + corner pill (`LiveBroadcastSheet` / `liveBroadcasters` chip) to a first-class right-side Horizon drawer that (a) owns the broadcast on/off + recipient flow, (b) exposes the unsurfaced "share my location" master switch, (c) populates + displays `user_locations.location_label`, and (d) lists active ETA shares with grace-window-correct status. Renderer-neutralize `AcceptedRoute.path` as a side dependency.

**Preconditions:**
- `mapHorizon` flag exists in `FeatureContext.tsx` (P0) and is readable via `useFeatures()`.
- P7 applied: `user_locations` is in `supabase_realtime` (verify: `SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='user_locations'` returns a row). If P7 is NOT yet applied, the drawer still builds and renders, but the live list stays empty — gate the "promote to drawer" eyeball acceptance on P7.
- Rule-A approval obtained for relocating the broadcast trigger and for the `AcceptedRoute.path` type change.

**Files to touch:**
- `src/components/map/PulseMapView.tsx` — `:1110-1118` renders `<LiveBroadcastSheet>` gated on `showLiveSheet`; `:1035-1051` renders the `liveBroadcasters.length > 0` corner chip; `:621-628` mounts `<MapFilterControls>` in the lens row's `right` slot; `:456-463` derives `liveBroadcasters`; `:143` `useLivePresence(localContacts)`. — **Change:** when `mapHorizon` is ON, render `<LiveTeamDrawer>` instead of `<LiveBroadcastSheet>`; the corner chip becomes the drawer's open trigger (keep its exact markup, just repoint `onClick`). When `mapHorizon` is OFF, the existing sheet + chip path is untouched (flag-gated, additive-by-default).
- `src/components/map/MapFilterBar.tsx` — `MapFilterControls` `:70-256` owns `liveOn`/`showRecipientPicker`/`handleToggleLive`/`handleRecipientConfirm` + the Broadcast pill `:208-243` + `<BroadcastRecipientPicker>` `:245-253` + the broadcast effect `:81-94` + `LIVE_LOCATION_LS_KEY` `:61`. — **Change (Rule-A):** when `mapHorizon` is ON, the broadcast pill in the filter bar becomes the drawer-open affordance for the OFF state (label "Broadcast", opens the drawer) and the actual ON/OFF + recipient-picker logic moves INTO `LiveTeamDrawer`. Extract the broadcast control logic (effect + `handleToggleLive` + `handleRecipientConfirm` + the `liveOn`/`viewerCount` state + LS key) into a shared hook so both surfaces drive identical behavior; do NOT duplicate the logic. When OFF, the filter bar is byte-for-byte the current bar.
- `src/components/map/sub/aiTypes.ts` — `:30` `path` inside `AcceptedRoute`. — **No change in P8 (P4 owns this).** P8 only verifies `:30` is already `path: LatLng[];` (the renderer-neutral type from `provider/types.ts:14-17`); P4 performs the type-only retype. `MapLibreAcceptedRoute` (`provider/MapLibreAcceptedRoute.tsx:28` already takes `Array<{lat;lng}>`) and `AcceptedRoutePolyline` consume `.path`; both are structurally compatible, so the retype is zero-runtime. If P4 hasn't shipped, run it first (Step 1).
- `src/services/locationService.ts` — `startLocationBroadcast` upsert at `:821-830` writes `user_locations` but NEVER sets `location_label` (verified — `location_label` is read by the drawer/`subscribeToUserLocation:883` but never written). — **Change (additive):** fold a reverse-geocode into the debounced upsert so `location_label` is populated. `reverseGeocode(lat,lng)` exists at `:228-239`.

**New files:**
- `src/components/map/horizon/LiveTeamDrawer.tsx` — the first-class drawer. Re-homes `LiveTeamView`'s broadcasting-rows content (the `rows`/`formatLastSeen`/row markup from `sub/LiveTeamView.tsx:30-188`) plus: a "share my location" master switch, the broadcast ON/OFF + recipient-picker controls (moved from `MapFilterBar`), and an "Active ETA shares" section. "Copy the panel/drawer shell + a11y from `sub/LiveBroadcastSheet.tsx:34-85` (the `useDialogA11y` focus-trap/Escape/restore pattern) and the broadcasting-row markup from `sub/LiveTeamView.tsx:107-184`."
- `src/components/map/horizon/useBroadcastControl.ts` — shared hook extracting `MapFilterControls`'s broadcast logic (`MapFilterBar.tsx:73-120`): `liveOn` state seeded from `LIVE_LOCATION_LS_KEY`, the start/stop effect (`:81-94`), `handleToggleLive` (`:96-106`), `handleRecipientConfirm` (`:108-120`), `viewerCount`. So the filter-bar pill and the drawer call one source of truth. "Copy the exact effect + toast + LS-persist sequence from `MapFilterControls`."

**Steps:**
1. **Verify `AcceptedRoute.path` is already `LatLng[]` (precondition check — P4 owns the retype, NOT P8).** Read `aiTypes.ts:30`: it should be `path: LatLng[];` (with `import type { LatLng } from '../provider/types';`). If P4 has shipped, this is already done — proceed. If `aiTypes.ts:30` is still `google.maps.LatLngLiteral[]`, run P4 first (or land its one-line type-only retype) before continuing P8; this is type-only/zero-runtime and is NOT part of P8's Rule-A gate.
2. **Populate `location_label` (additive).** In `locationService.startLocationBroadcast`'s debounced write (`:820-831`), before the `upsert`, call `const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude).catch(() => null);` and add `location_label: label,` to the upsert object. This rides the existing 15s debounce so it does not add geocode quota pressure (reverseGeocode already routes through the `maps-geocode` edge fn + the QPS token bucket). Guard: only geocode when the coords moved meaningfully — reuse the existing debounce gate; no new throttle needed since it's already ≤1/15s. Keep `is_sharing: true` and all other fields unchanged.
3. **Extract `useBroadcastControl`.** Create `horizon/useBroadcastControl.ts` exporting `{ liveOn, viewerCount, showRecipientPicker, setShowRecipientPicker, handleToggleLive, handleRecipientConfirm }` parameterized by `userId`. Move the body verbatim from `MapFilterControls:73-120`. Have `MapFilterControls` consume the hook (delete its inline copies of that state/logic; keep the JSX). This proves the hook before the drawer depends on it.
4. **Build `LiveTeamDrawer`.** Props: `{ contacts: Contact[]; liveLocations: Map<string, UserLocation>; userId: string; isDarkMode: boolean; onClose: () => void; onContactAction: (action:'message'|'vox'|'meet', contactId:string)=>void; }`. Sections, top to bottom:
   - **Header:** Radio icon + "Live team" title + close button (copy `LiveBroadcastSheet:51-73` a11y).
   - **Master switch — "Share my location":** a toggle wired to `setLocationSharing(userId, next)` (verified zero callers — this is its first consumer). This is the consent-level master (writes `user_locations.is_sharing` via upsert) distinct from the broadcast watch loop. On enable, also call `useBroadcastControl.handleToggleLive` to start the actual GPS watch; on disable, stop it. Surface a one-line note that this controls whether teammates with consent can see you.
   - **Broadcast control:** the pill/recipient-picker moved here — render `<BroadcastRecipientPicker>` (`sub/BroadcastRecipientPicker.tsx`) on OFF→ON via `showRecipientPicker`, exactly as `MapFilterControls` does.
   - **Broadcasting now:** the `rows` list re-homed from `LiveTeamView` (filter `liveLocations` for `loc?.isSharing`, sort by `updatedAt` desc). Per row, display `location.locationLabel` when present (now populated by step 2), falling back to the existing `lat,lng` + `formatLastSeen`. Keep the message/vox/meet action buttons (`LiveTeamView:147-181`).
   - **Active ETA shares:** call `etaShareService.listActiveShares()` on mount (and on a light interval, e.g. 30s, since these are not realtime unless P7 also published `eta_shares`). For each `EtaShare`, render `destinationLabel`/`recipientLabel`, `formatEta(lastEtaSeconds)`, and a Cancel button → `cancelEtaShare(share.id)`. **Grace-window awareness:** the public link stays viewable for 5 min after `expiresAt`/`endedAt` (verified in `get_eta_share_by_token`: `expires_at > NOW() - INTERVAL '5 minutes'` AND `ended_at > NOW() - INTERVAL '5 minutes'`). `listActiveShares` only returns `status='active'` rows, so canceled/arrived rows drop from this list immediately — display a transient "Link viewable for 5 more min" note when the user cancels, so the operator understands the recipient isn't cut off instantly.
   - Wrap the whole drawer in `useDialogA11y({ containerRef, onClose, initialFocusRef })`.
5. **Wire into `PulseMapView`.** Add `const { mapHorizon } = useFeatures();`. At `:1110`, branch: `{showLiveSheet && (mapHorizon ? <LiveTeamDrawer .../> : <LiveBroadcastSheet .../>)}`. Pass `userId` (already in scope, see `:625`). The corner chip (`:1035`) keeps `onClick={() => setShowLiveSheet(true)}` for both paths. In `mapHorizon` mode, also let the filter-bar Broadcast pill open the drawer (OFF path) per Rule-A.
6. **Do NOT delete** `LiveBroadcastSheet` or `LiveTeamView` — they remain the flag-OFF path and the E2E harness export (`PulseMapView.tsx:1129` exports `LiveBroadcastSheet`).

**Data / schema / migration:** None. P8 writes only to columns that already exist (`user_locations.location_label`, `user_locations.is_sharing`) and reads `eta_shares` via existing service fns. RLS verified sufficient: `user_locations.own_location` (`polcmd='*'`, `user_id = auth.uid()`) permits the owner's `setLocationSharing` upsert and `location_label` write; `eta_shares_update_owner` permits `cancelEtaShare`. The realtime publication of `user_locations` is owned by P7, not P8.

**Code patterns (real signatures this plugs into):**
- `subscribeToUserLocation` already maps `location_label` → `UserLocation.locationLabel` (`locationService.ts:883`), and the `UserLocation` interface (`:745-755`) already declares `locationLabel?: string` — so step 2's write completes an already-wired read path.
- `setLocationSharing(userId: string, isSharing: boolean): Promise<void>` (`locationService.ts:894-902`) — upserts `{ user_id, is_sharing, lat:0, lng:0 }`. Note it writes `lat:0,lng:0`; if a real fix already exists from the broadcast loop, prefer NOT to clobber it — call `setLocationSharing` only when the broadcast watch is OFF (consent-only mode); when the watch is running, the broadcast upsert already sets `is_sharing:true`.
- `startLocationBroadcast(userId, onError?) => () => void` / `stopLocationBroadcast()` (`:776-856`).
- `setBroadcastRecipients(broadcasterUserId, recipientUserIds, shareLevel?)` (`:969`), `endBroadcastRecipients(broadcasterUserId)` (`:1017`), `getActiveBroadcastRecipientIds(): string[]` (`:962`).
- `checkLocationConsent(subjectUserId, viewerUserId)` (`:904`) / `upsertLocationConsent(subjectUserId, viewerUserId, isGranted, shareLevel?, expiresAt?)` (`:926`) — available if a per-teammate consent affordance is added; not required for the core drawer.
- `etaShareService.listActiveShares(): Promise<EtaShare[]>` (`:146`), `cancelEtaShare(shareId): Promise<void>` (`:163`), `formatEta(seconds): string` (`:289`). `EtaShare` shape at `:22-41`.
- `useLivePresence(contacts): Map<string, UserLocation>` (`hooks/useLivePresence.ts:19`).
- `LatLng` (`provider/types.ts:14-17`) — "Structurally compatible with google.maps.LatLngLiteral."

**Acceptance criteria:**
- With `?ff_mapHorizon=on`: opening the live drawer shows a right-side panel (not the bottom sheet); flag OFF still shows `LiveBroadcastSheet`.
- The "share my location" switch flips `user_locations.is_sharing` (verify via `SELECT is_sharing, location_label FROM user_locations WHERE user_id='<me>'`).
- After a broadcast tick, `user_locations.location_label` is non-null and the drawer row shows the human label instead of raw coords.
- Broadcasting from a second authenticated browser (post-P7) makes the first browser's drawer list that teammate live.
- Active ETA shares list renders with `formatEta` and a working Cancel; after Cancel the row leaves the list and a "viewable 5 more min" note appears.
- The broadcast trigger no longer needs the filter bar in Horizon mode, but the filter bar remains fully functional with the flag OFF.
- `tsc` shows no NEW errors from the `AcceptedRoute.path` retype.

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "horizon/LiveTeamDrawer|useBroadcastControl|aiTypes|locationService|MapFilterBar|PulseMapView"` — gate on NO NEW errors (repo carries ~1234 pre-existing; the heap flag prevents the OOM false-clean).
- `npm run test` (Vitest) — confirm `locationService`/`etaShareService` suites still pass after the upsert change.
- Manual: `npm run dev:full` (backend on :3003 is required for `maps-geocode` reverse-geocode to resolve `location_label` — "Failed to fetch" = backend down), open Map with `?ff_mapHorizon=on`, toggle share-my-location, broadcast, observe label + ETA list.
- DB spot-check: `SELECT user_id, is_sharing, location_label, updated_at FROM user_locations ORDER BY updated_at DESC LIMIT 5;`

**Commit:** `feat(map): Live team first-class drawer + location_label population (mapHorizon)`

**Rollback:** Set `mapHorizon` false → drawer path dark, `LiveBroadcastSheet` + filter-bar broadcast restored. The `location_label` write and `AcceptedRoute.path` retype are harmless when the flag is off (label is additive data; the type change is structurally compatible). To fully revert: `git revert <sha>`.

**Preserve-verbatim / gotchas:**
- **`location_label` lights up TWO consumers, not one.** Populating `user_locations.location_label` (Step 2) is read by `subscribeToUserLocation` (`locationService.ts:883`) AND by `teamRadarService.ts:104`/`:118` (the War Room team-radar surface), which is **NOT** `mapHorizon`-gated. So writing the label additionally surfaces human-readable locations in team radar for all users — additive and honest, but call it out. Verify both read paths are null-tolerant (the column is nullable and `reverseGeocode` can return null), so a null label degrades gracefully everywhere (no crash, fall back to coords).
- **Do NOT delete or rewrite** `sub/LiveBroadcastSheet.tsx` or `sub/LiveTeamView.tsx` — flag-OFF path + E2E harness export. Re-home content by COPY, not move.
- **Do NOT alter** `MapFilterControls`'s flag-OFF behavior — the extracted hook must produce byte-identical OFF behavior; the `B` keyboard shortcut effect (`MapFilterBar.tsx:122-139`) must keep working.
- `setLocationSharing` writes `lat:0, lng:0` (`:900`) — do NOT call it while the broadcast watch is actively upserting real coords, or you'll zero the pin. Gate it to consent-only mode.
- The 5-min grace is a SECURITY DEFINER property of `get_eta_share_by_token`; `listActiveShares` (owner-side, `status='active'` filter) does NOT honor it and will drop canceled rows instantly. The grace only affects the anonymous public viewer. Message the operator accordingly — do not claim the share is "gone."
- `reverseGeocode` can return null (denied/zero-results) — `location_label` must be nullable-tolerant on write and read; never block the position upsert on a failed geocode (`.catch(() => null)`).
- Coral rule: the live/broadcast surfaces legitimately use rose-500 (`--pulse-coral` family) because LIVE is a signal — this is within the coral budget. Do not add coral to drawer chrome (headers, dividers, the share-my-location switch track when off).

---

### P9 — Geofences drawer + all-geofences ring overlay
**Gate:** additive (no approval) — entirely net-new surfaces (a new drawer, a new overlay, a new producer/consumer for already-existing-but-dead columns). No existing working surface is removed or rewritten. **Depends on:** P0 (flag). Independent of P7 (geofences do not need realtime). Soft-coupled to P8 only in that both register under the same Horizon drawer host if P5/P8 build one — if not, P9 mounts its own trigger.

**Goal:** Promote geofences to a first-class Horizon drawer that lists geofenced places (`places` where `geofence_radius_m IS NOT NULL`), lets the operator toggle/adjust radii (`setPlaceGeofence`), shows `geofence_events` history with a "mark reviewed" affordance wiring the dead `surfaced`/`surfaced_at` columns, and renders all geofence radii as rings on the MapLibre map. Prominently and honestly surface that arrival detection only runs while Live location is broadcasting.

**Preconditions:**
- `mapHorizon` flag exists (P0).
- No migration needed (verified below).

**Files to touch:**
- `src/components/map/PulseMapView.tsx` — mount the geofence rings **alongside `<MapLibreRadiusRings>` at `:691-693`** (the non-atlas overlay block, gated only on `userPosition`/`mapLibreReady` — VERIFIED `:691-693`), NOT inside the `lens === 'atlas'` block at `:704-725`. Insert `<MapLibreGeofenceRings key={`geofences-${styleEpoch}`} map={mapLibreRef.current} places={geofencedPlaces} />` gated on `mapHorizon && mapLibreReady` (independent of lens — rings should show across ALL horizons, gated only by the flag + a drawer-driven visibility boolean). **Re-grep the non-atlas overlay insertion point before editing** (it's the `MapLibreRadiusRings`/`MapLibreAcceptedRoute` cluster keyed on `styleEpoch`, currently `:691-700`); do NOT place the rings inside any `lens === 'atlas'` gate (`:704-725`). `:118` `mapLibreReady`; `:143` `liveLocations`. Add a state-or-context entry for the geofences drawer open/close and its trigger.
- `src/services/geofenceService.ts` — `persistAndDispatch` `:211-224` inserts `geofence_events` (verified the insert path; sets `user_id, place_id, event_type, lat, lng, accuracy_m, distance_m, entity_type, entity_id` — does NOT set `payload`, `surfaced`, or `surfaced_at`, which default `'{}'`, `false`, `null`). `getTodayVisitedContactStops` `:267` reads events. — **Change (additive):** add read + mutate helpers for the drawer (see New files / Steps); do NOT change `persistAndDispatch`'s insert shape.
- `src/services/locationService.ts` — `listUserPlaces(): Promise<Place[]>` `:492-502` (returns ALL visible places via RLS, `order created_at desc`); `setPlaceGeofence(placeId, radiusM)` `:542-551`. — **Change:** none (consume as-is). Optionally add a thin `listGeofencedPlaces()` that filters `listUserPlaces` by `geofence_radius_m != null` client-side, or filter in the drawer.

**New files:**
- `src/components/map/horizon/GeofencesDrawer.tsx` — the drawer: geofenced-places list (radius toggle/edit), `geofence_events` history with "mark reviewed", and the honest "requires Live ON" banner. "Copy the drawer shell + `useDialogA11y` from `sub/LiveBroadcastSheet.tsx:34-85`; copy the list-row visual language from `sub/LiveTeamView.tsx:107-184`."
- `src/components/map/provider/MapLibreGeofenceRings.tsx` — null-rendering MapLibre layer manager that draws one circle POLYGON per geofenced place (fill + line). "Copy the equirectangular-ring + GeoJSON source/layer + styleEpoch-keyed mount/teardown pattern verbatim from `provider/MapLibreAtlasHalos.tsx:33-126` (the `circleRing` helper at `:33-42`, the add/teardown effect at `:81-113`, the `setData` effect at `:115-123`). Use `places.geofence_radius_m` as the real metre radius (no strong/weak fudge — these are true geofences)."
- `src/services/geofenceService.ts` additions (or a new `geofenceQueries.ts` — prefer extending the existing service for cohesion): `listRecentGeofenceEvents(limit?)`, `markGeofenceEventSurfaced(eventId)`.

**Steps:**
1. **Add geofence-events read + mutate helpers** to `geofenceService.ts` (additive exports, do not touch `persistAndDispatch`):
   - `listRecentGeofenceEvents(limit = 50): Promise<GeofenceEvent[]>` → `supabase.from('geofence_events').select('*').order('occurred_at', { ascending: false }).limit(limit)`. RLS `geofence_events_select` (`user_id = auth.uid()`) scopes to the operator automatically. Map rows to a typed `GeofenceEvent` (include `id, place_id, event_type, lat, lng, distance_m, entity_type, entity_id, payload, occurred_at, surfaced, surfaced_at`).
   - `markGeofenceEventSurfaced(eventId: string): Promise<void>` → `supabase.from('geofence_events').update({ surfaced: true, surfaced_at: new Date().toISOString() }).eq('id', eventId)`. RLS `geofence_events_update_surfaced` (USING + WITH CHECK `user_id = auth.uid()`) already permits this — VERIFIED, no migration. This is the net-new producer for the previously-dead columns.
2. **Build `MapLibreGeofenceRings.tsx`.** Props: `{ map: MaplibreMap | null; places: Array<{ id:string; lat:number; lng:number; geofenceRadiusM:number; name?:string|null }> }`. Mirror `MapLibreAtlasHalos`: one GeoJSON source (`pulse-geofence-rings`), a `fill` layer (low opacity, e.g. 0.06) + a `line` layer (so the boundary reads). Build features with `circleRing(lat, lng, geofenceRadiusM)` (copy the helper). Per-feature properties can carry `placeId` for future click-to-focus, but click handling is optional in v1. Use coral (`#f43f5e`) for the ring stroke — geofence rings are a live/route signal surface, within the coral budget. Insert below marker layers; teardown on unmount; key on `styleEpoch` in the host.
3. **Build `GeofencesDrawer.tsx`.** Props: `{ isDarkMode: boolean; onClose: () => void; isLiveOn: boolean; onPlacesChanged?: () => void; }`. Sections:
   - **Header:** map-pin/Radio icon + "Geofences" title + close (a11y via `useDialogA11y`).
   - **Honest dependency banner (prominent):** when `!isLiveOn`, render a high-visibility banner: "Geofence alerts require Live location ON. Turn on Broadcast to detect arrivals." Detection is broadcast-coupled — VERIFIED: `geofenceService.processPosition` (`:93`) is only ever invoked from `locationService.startLocationBroadcast`'s `writePosition` (`:805-809`), and `startGeofenceDetection`/`stopGeofenceDetection` are bound to broadcast start/stop (`:795`, `:853-855`). No other caller drives detection. Do NOT imply geofences fire in the background or while the app is closed (the service comment at `:21-23` explicitly defers server-side detection).
   - **Geofenced places list:** `listUserPlaces()` filtered to `geofence_radius_m != null`. Per place: name/address, current radius (m), a control to adjust radius (slider or stepped presets) → `setPlaceGeofence(place.id, radiusM)`, and a remove-geofence action → `setPlaceGeofence(place.id, null)`. After any change, call `geofenceService.refreshGeofences()` (`:129`) so an in-flight detection session picks up the change immediately, and `onPlacesChanged?.()` so the host refetches `geofencedPlaces` for the ring overlay.
   - **Recent transitions (history):** `listRecentGeofenceEvents()`. Per event: `event_type` (enter/exit/approach) with an icon, the place name (join client-side against the places list by `place_id`), relative `occurred_at`, `distance_m`. If `payload` is non-empty (`!== '{}'`), render its context. A "Mark reviewed" button when `!surfaced` → `markGeofenceEventSurfaced(id)` then optimistically set the row reviewed; reviewed rows show a muted "Reviewed" state with `surfaced_at` time. This is the net-new CONSUMER of `surfaced`.
4. **Wire into `PulseMapView`.** Mount `<MapLibreGeofenceRings>` **next to `<MapLibreRadiusRings>` at `:691-693`** (the non-atlas, lens-independent overlay cluster) — NOT inside the `lens === 'atlas'` block at `:704-725` — so rings render on every horizon. Add `geofencedPlaces` state populated from `listUserPlaces()` (filtered) on mount + on `onPlacesChanged`. Add a drawer open/close state + a trigger (a Horizon-drawer tab if P5/P8's drawer host exists; otherwise a corner control near the live chip). Pass `isLiveOn` — derive from the same broadcast state P8's `useBroadcastControl` exposes (or read `localStorage` `pulse:map:live-location-on` as the fallback truth the filter bar already persists, `MapFilterBar.tsx:61`).
5. **Do NOT fake** anything: if Live is off, the rings still render (they're place geometry, real), but the banner makes clear no detection is running. Empty states ("No geofences yet — set a radius on a place to get arrival alerts") must be honest.

**Data / schema / migration:** **None required — VERIFIED via MCP.**
- `geofence_events` already has `surfaced boolean NOT NULL DEFAULT false`, `surfaced_at timestamptz NULL`, `payload jsonb NOT NULL DEFAULT '{}'`.
- RLS already supports the "mark reviewed" UPDATE: policy `geofence_events_update_surfaced` exists with `polcmd='w'`, USING `(user_id = auth.uid())`, WITH CHECK `(user_id = auth.uid())`.
- `places_update` permits owner radius edits (`owner_user_id = auth.uid()::text` — note `owner_user_id` is **text**, not uuid; `setPlaceGeofence` already updates by `id` so the cast is the policy's concern, not the client's).

  If a future iteration wants a "mark all reviewed" bulk path or a server-side surfacing trigger, THAT would need a migration — out of scope for P9. If you do add anything destructive later, use the dry-run-then-apply pattern:
  ```sql
  DO $$
  BEGIN
    -- ... DDL under test ...
    RAISE EXCEPTION 'rollback: dry-run only';
  END $$;
  ```
  then apply once via `apply_migration`. Not needed for P9 as specified.

**Code patterns (real signatures this plugs into):**
- `listUserPlaces(): Promise<Place[]>` (`locationService.ts:492`) — returns ALL visible places (RLS-scoped); filter `geofence_radius_m != null` in TS. `Place` shape comes from `rowToPlace` in `types/placeTypes.ts` (includes `geofenceRadiusM`).
- `setPlaceGeofence(placeId: string, radiusM: number | null): Promise<void>` (`:542`) — null disables.
- `geofenceService.refreshGeofences(): Promise<void>` (`:129`), `processPosition(lat,lng,accuracyM?)` (`:93`) — detection entry; only called from `startLocationBroadcast` (`locationService.ts:805-809`).
- `geofence_events` insert path: `persistAndDispatch` (`geofenceService.ts:211-224`) — the producer; leave untouched.
- `MapLibreAtlasHalos` (`provider/MapLibreAtlasHalos.tsx`) — the exact overlay template: `circleRing` (`:33-42`), add/teardown effect (`:81-113`), `setData` effect (`:115-123`), styleEpoch-keyed mount in host (`PulseMapView.tsx:706`).
- `useDialogA11y({ containerRef, onClose, initialFocusRef })` — focus trap pattern (`sub/LiveBroadcastSheet.tsx:32`).

**Acceptance criteria:**
- With `?ff_mapHorizon=on`: a Geofences drawer opens, listing every place that has a `geofence_radius_m`; flag OFF leaves the map exactly as today (no rings, no drawer).
- Adjusting a place's radius calls `setPlaceGeofence`, persists (verify `SELECT geofence_radius_m FROM places WHERE id='<id>'`), and the ring on the map resizes after refetch.
- Removing a geofence sets `geofence_radius_m = NULL` and the ring disappears.
- Geofence rings render on the MapLibre map at correct geographic scale (they grow/shrink with zoom, like Atlas halos).
- The "requires Live ON" banner shows whenever broadcast is off and is impossible to miss; it is NOT shown when Live is on.
- Recent transitions list shows real `geofence_events`; "Mark reviewed" sets `surfaced=true`/`surfaced_at` (verify `SELECT surfaced, surfaced_at FROM geofence_events WHERE id='<id>'`) and the row flips to the reviewed state.
- No migration was applied (P9 is pure app code).

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "GeofencesDrawer|MapLibreGeofenceRings|geofenceService|locationService|PulseMapView"` — gate on NO NEW errors.
- `npm run test` (Vitest) — `geofenceService` suite still green after the additive helpers.
- DB checks (read-only): `SELECT id, name, geofence_radius_m FROM places WHERE geofence_radius_m IS NOT NULL;` and `SELECT id, event_type, surfaced, surfaced_at, occurred_at FROM geofence_events ORDER BY occurred_at DESC LIMIT 10;`
- Manual: `npm run dev:full`, Map with `?ff_mapHorizon=on`; with a geofenced place present, confirm ring renders; toggle radius; with Live off confirm banner; turn Live on (needs GPS) and confirm banner clears.

**Commit:** `feat(map): Geofences drawer + all-geofences ring overlay + surfaced wiring (mapHorizon)`

**Rollback:** Set `mapHorizon` false → drawer + rings dark; nothing else changes. The additive service helpers and the `surfaced` writes are inert when the drawer is never opened. `git revert <sha>` for a full undo. No DB rollback needed (no schema change).

**Preserve-verbatim / gotchas:**
- **Do NOT modify** `geofenceService.persistAndDispatch`'s insert shape (`:211-224`) — it's the live producer that `getTodayVisitedContactStops` and `useMapAiProposals`' `visitedIds` depend on. P9 only ADDS read/mutate helpers.
- **Do NOT claim background/closed-app detection.** Detection is strictly broadcast-coupled (`processPosition` only fires from `startLocationBroadcast`'s tick) — the banner must reflect this truthfully. The service's own comment (`:21-23`) defers server-side detection to a future iteration; do not imply it exists.
- **`owner_user_id` on `places` is TEXT, not uuid** (verified — matches CLAUDE.md's schema-inconsistency warning). Don't introduce client code that assumes uuid; `setPlaceGeofence` keys by `id` so this is the RLS policy's concern (`owner_user_id = auth.uid()::text`), already correct.
- MapLibre `circle` layers are PIXEL-radius, not metric — that's WHY the rings must be circle POLYGONS (the Atlas-halo equirectangular approach). Do not use a `type:'circle'` layer for geographic radii; it will not scale with zoom. (The in-file "pending" comments in some MapLibre overlays are stale per ground truth — marker/cluster parity is complete — but the pixel-vs-metric constraint is real and current.)
- Coral budget: geofence rings + the "requires Live ON" banner accent legitimately use coral (live/route signal). Keep drawer chrome neutral — no coral on headers, list dividers, or the radius slider track.
- The history list joins events to places by `place_id` client-side; a place may have been deleted while its events persist (FK is on `place_id` but events can outlive a soft context) — render a graceful "Unknown place" fallback rather than crashing on a missing join.

---

Verification notes / corrections to the strategic handoff:
- **`provider/types.ts` already defines `LatLng`** (`:14-17`, "Structurally compatible with google.maps.LatLngLiteral"). P8's normalization is a TYPE-ONLY retype of `AcceptedRoute.path` (`sub/aiTypes.ts:30`) to that existing `LatLng[]`, not a new type — and `MapLibreAcceptedRoute`/`AcceptedRoutePolyline` already accept `{lat;lng}[]`, so it's zero-runtime.
- **P9 needs NO migration.** The strategic doc implies the `surfaced` wiring is "dead columns" needing producer/consumer — true at the app layer, but the DB is fully ready: columns exist AND an UPDATE RLS policy `geofence_events_update_surfaced` already permits the operator's mark-reviewed write (verified via `pg_policy`). The 5-min ETA grace (`get_eta_share_by_token`) is confirmed on BOTH `expires_at` and `ended_at`.
- **`setLocationSharing` confirmed zero callers** (only its definition at `locationService.ts:894`). **`location_label` confirmed read-but-never-written** (read in `subscribeToUserLocation:883`; the `startLocationBroadcast` upsert at `:821-830` omits it).

Relevant verified paths: `f:\pulse1\src\components\map\sub\LiveTeamView.tsx`, `...\sub\LiveBroadcastSheet.tsx`, `...\sub\BroadcastRecipientPicker.tsx`, `...\MapFilterBar.tsx`, `...\PulseMapView.tsx`, `...\sub\aiTypes.ts`, `...\provider\types.ts`, `...\provider\MapLibreAtlasHalos.tsx`, `...\provider\MapLibreAcceptedRoute.tsx`, `...\hooks\useLivePresence.ts`, `f:\pulse1\src\services\locationService.ts`, `...\etaShareService.ts`, `...\geofenceService.ts`.

---

Confirmed: no `RoutesDrawer` exists yet (net-new), no `focusDate` consumer exists yet (the `WeekProposal.focusDate` field is produced by the model but never consumed in the UI — P10 wires it). `setLens` is the lens setter. I now have complete ground truth. Writing the four phases.

---

### P10 — Routes & planning drawer
**Gate:** additive (no approval) — and **Depends on:** P1 (mapHorizon flag), P3 (Horizon shell that mounts the drawer). Reuses the already-shipped `useMapAiProposals` hook unchanged.
**Goal:** A dedicated `RoutesDrawer` panel that surfaces the AI route/plan state in a persistent side panel (not just the thin `AiStrip` band): accept / reorder / dismiss an accepted route, "Open in Maps" for the full sequence, week-plan summaries with a focus-date jump, and the accepted-route ETA / `arrivesAt`. All logic is reused from `useMapAiProposals`; this is a richer *view* over the same FSM.

**Preconditions:**
- `mapHorizon` flag exists (P1) and the Horizon shell (P3) renders a slot for the drawer.
- `useMapAiProposals` is mounted in `PulseMapView` (it already is — `PulseMapView.tsx:421-440`).
- VERIFIED: every handler the drawer needs already exists on the hook's return — `handleAcceptRoute`, `handleDismissRoute`, `handleStartReorder`, `handleReorderChange`, `handleReorderCancel`, `handleOpenInSystemMaps`, plus `aiState`, `acceptedRoute`, `acceptingRoute`, `reorderableStops`. The verified anchors are the **result interface `:63-75`** and the **`PulseMapView` destructure `:421-440`**; `:294-306` is the hook's RETURN object, not the handler definitions. Re-grep the `handleAcceptRoute`/`handleDismissRoute` *definition* lines in `useMapAiProposals.ts` before quoting them — those `useCallback` defs drift; the return object at `:294-306` only lists the handler names.
- VERIFIED: `handleOpenInSystemMaps` already calls `buildMultiStopDirectionsUrl(orderedStops, userPosition)` and opens the full sequence (`useMapAiProposals.ts:281-292`). The drawer reuses this handler verbatim — do NOT re-implement the URL build.
- VERIFIED: `AcceptedRoute` shape is `{ orderedMarkerKeys: string[]; path: google.maps.LatLngLiteral[]; durationMin: number; arrivesAt: Date }` (`aiTypes.ts:28-33`). `arrivesAt` is already populated on accept (`useMapAiProposals.ts:225-230` → `new Date(Date.now() + route.durationSec * 1000)`).
- VERIFIED: `WeekProposal` is `{ summary: string; focusDate?: string }` (`mapAIService.ts:41-46`). `focusDate` is produced by `proposeWeekPlan` (`mapAIService.ts:248`) but `WeekProposal.focusDate` has **no consumer** — P10 is its first consumer. NOTE: a plain `grep -rn focusDate src/` ALSO hits `CalendarTodayView.tsx` (an unrelated, same-named `focusDate` prop on the Calendar's today view). Confirm the "no consumer" claim by scoping the grep to `mapAIService.ts` + `src/components/map`, not repo-wide.

**Files to touch:**
- `src/components/map/PulseMapView.tsx` — `:103` `const [lens, setLens] = useState<MapLens>('today')` — the lens setter the focus-date jump calls; already in scope.
- `src/components/map/PulseMapView.tsx` — `:421-440` the `useMapAiProposals(...)` destructure — add `aiState`, `acceptedRoute` (already destructured) plus pass the full handler set into the new drawer.
- `src/components/map/PulseMapView.tsx` — `:643-660` the existing `<AiStrip ... />` mount site — add the `<RoutesDrawer ... />` mount adjacent to it, **flag-gated on `mapHorizon`** (read via `useFeatures().features.mapHorizon`). The `AiStrip` stays mounted unchanged when `mapHorizon` is off (Rule-A: do not remove the strip — see gotchas). **Ordering: P4 and P10 both edit the `<AiStrip>` mount block (`:644-658`).** Do **P4 first** (it adds AiStrip's `onFocus` affordance + handler); P10 then re-reads the block (lines drift after P4) before inserting `<RoutesDrawer>`. To avoid competing "jump to day" controls, P4's `onFocus`/`handleAiFocus` and P10's `onFocusDate`/`handleFocusDate` must resolve to ONE shared handler (a single `setLens('week')`-and-highlight path), not two independent affordances — pick the shared handler name and reuse it across both AiStrip and RoutesDrawer.
- `src/components/map/PulseMapView.tsx` — top imports (`:1-59`) — add `import RoutesDrawer from './horizon/RoutesDrawer';` and `import { useFeatures } from '../../contexts/FeatureContext';` if not already imported (verify; `PulseMapView` reads `mapLibreOn` via a dedicated `useMapLibreRenderer()` hook at `:108`, so `useFeatures` may not be imported — add it).

**New files:**
- `src/components/map/horizon/RoutesDrawer.tsx` — the routes/planning panel. Responsibility: render the route/plan branch of `aiState` + accepted-route status in a persistent side panel; wire accept/reorder/dismiss/open-in-maps from props; render the week-plan summary with a "Jump to {date}" button that calls `onFocusDate`. **Copy the prop-threading + render-branch pattern from `src/components/map/sub/AiStrip.tsx` (`AiStripProps` at :25-41, the six render branches at :95-470)** — RoutesDrawer is a panel-shaped superset of the same state machine, NOT a replacement.

**Steps:**
1. Define `RoutesDrawerProps` mirroring `AiStripProps` (`AiStrip.tsx:25-41`) plus three additions: `acceptedRoute: AcceptedRoute | null`, `onFocusDate: (isoDate: string) => void`, and `isOpen`/`onToggle` for the panel's own collapsed state. Import `AcceptedRoute`, `AiState` from `../sub/aiTypes` and `MapLens` from `../sub/mapLens`.
2. Render an `Underway` block when `acceptedRoute != null`: show `acceptedRoute.orderedMarkerKeys.length` stops · `acceptedRoute.durationMin` min · `arriving {formatArrivalTime(acceptedRoute.arrivesAt)}` (copy `formatArrivalTime` from `AiStrip.tsx:43-45`), an **"Open in Maps"** button calling `onOpenInSystemMaps`, and a **Dismiss** button calling `onDismissRoute`. This is the panel analog of `AiStrip.tsx:95-131`.
3. Render the `reordering` branch: reuse the drag/keyboard reorder list logic from `AiStrip.tsx:137-318` (the `moveStop` / `handleDrop` / `focusRowByIdx` helpers and the `<ul>` of `aiState.orderedIds`). The Accept button calls `onAccept` (which is `handleAcceptRoute` — it already consumes the reorder draft, `useMapAiProposals.ts:188-189`); Cancel calls `onReorderCancel`.
4. Render the `ready` + `kind === 'route'` branch: summary + optional `rationale` (Why? expansion), a **Reorder** button (`onReorderStart`), and an **Accept** button (`onAccept`). Copy from `AiStrip.tsx:321-405`.
5. Render the `ready` + `kind === 'plan'` branch: show `aiState.data.proposal.summary`; when `aiState.data.proposal.focusDate` is set, render a **"Jump to {focusDate}"** button that calls `onFocusDate(aiState.data.proposal.focusDate)`. (`kind === 'insight'` is Atlas — render its summary read-only, no jump.)
6. In `PulseMapView`, add ONE shared `handleFocusDate` used by BOTH `<AiStrip onFocus>` (P4) and `<RoutesDrawer onFocusDate>` (P10) — do not create a second competing handler: `const handleFocusDate = useCallback((isoDate: string) => { setLens('week'); /* P10 jump target: scroll/center the week view on isoDate */ }, [setLens]);` — VERIFIED: the Week lens (`lens === 'week'`) is the surface that renders week-anchored stops (`PulseMapView.tsx:312-313`, `useMeetingMarkers(lens, ...)` at `:168`). Because Week membership is event-driven (`geoSignals.weekEvents`), the jump's job is to ensure the lens is `week` and (Horizon-shell dependent) to highlight the focus date in the WEEK timeline P3 introduces. If P3's WEEK view has a date selector, pass `isoDate` into it; otherwise the minimum viable jump is `setLens('week')`. (P4's `handleAiFocus` `focusDate` branch should call this SAME `handleFocusDate` so there is one jump-to-day affordance, not two.)
7. Mount `<RoutesDrawer .../>` in `PulseMapView` adjacent to `<AiStrip .../>` (`:644`), gated: `{features.mapHorizon && <RoutesDrawer ... />}`. Keep `<AiStrip>` rendering when `!features.mapHorizon`. (When `mapHorizon` is on, optionally hide the thin strip to avoid duplication — but that is a Rule-A change to a working surface; default is to render both behind the flag and let the visual pass decide. Do NOT delete AiStrip.)
8. Thread the hook outputs into the drawer:
```tsx
<RoutesDrawer
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
  onFocusDate={handleFocusDate}
/>
```

**Data / schema / migration:** none. P10 is pure client UI over existing hook state and the existing `maps-route` edge function (invoked inside `handleAcceptRoute` → `getDrivingRoute`). No AI is added client-side; route/plan proposals already route through `ai-router` server-side (`mapAIService.ts:10`, `invokeAIJson`).

**Code patterns:**
- Handler set (reuse verbatim, all from `UseMapAiProposalsResult`, `useMapAiProposals.ts:63-75`):
```ts
handleAcceptRoute: () => Promise<void>;
handleDismissRoute: () => void;
handleStartReorder: () => void;
handleReorderChange: (nextOrder: string[]) => void;
handleReorderCancel: () => void;
handleOpenInSystemMaps: () => void;
```
- Accepted-route ETA fields the panel renders (`aiTypes.ts:28-33`): `orderedMarkerKeys.length`, `durationMin`, `arrivesAt` (a `Date`).
- Week-plan jump field (`mapAIService.ts:41-46`): `WeekProposal.focusDate?: string` (YYYY-MM-DD).
- "Open in Maps" URL is built by `buildMultiStopDirectionsUrl(orderedStops, origin)` (`mapDirectionsUrl.ts:30`) — but invoke it only through `handleOpenInSystemMaps`; do not call the builder directly from the drawer.

**Acceptance criteria:**
- With `?ff_mapHorizon=on` + ≥2 TODAY stops: the drawer shows `PULSE AI · ROUTE` with Accept / Reorder; Accept transitions to an Underway block showing `N stops · M min · arriving HH:MM`; "Open in Maps" opens a Google Maps `dir/?api=1` URL containing every stop as origin/waypoints/destination; Dismiss clears it.
- Reorder via drag and via keyboard ArrowUp/Down both mutate the draft order; Accept replays `getDrivingRoute` against the new order; Cancel reverts to the AI's original order.
- On the WEEK lens with a plan proposal carrying `focusDate`, a "Jump to {date}" button appears and sets the lens to `week` (and highlights the date if P3's WEEK view supports it).
- With `mapHorizon` OFF, behavior is byte-identical to today (AiStrip only; no RoutesDrawer in the DOM).

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "map/horizon|RoutesDrawer|PulseMapView"` — gate on NO NEW errors (repo has ~1234 pre-existing; do not treat those as a regression).
- `npm run test` (Vitest) — existing `useMapAiProposals` / `AiStrip` tests must stay green.
- Manual: `npm run dev:full`, open Map with `?ff_mapHorizon=on`, TODAY lens, ≥2 located contacts → exercise Accept → Open in Maps → Dismiss; switch to WEEK with a plan → click Jump.

**Commit:** `feat(map): add Horizon RoutesDrawer over useMapAiProposals (P10)`

**Rollback:** `git revert <sha>`. The drawer is flag-gated on `mapHorizon` (default false), so even un-reverted it is dark by default. Removing the `<RoutesDrawer>` mount line restores the prior surface immediately.

**Preserve-verbatim / gotchas:**
- Rule-A: **Do NOT delete or rewrite `src/components/map/sub/AiStrip.tsx`.** RoutesDrawer is additive; AiStrip stays as the non-Horizon surface and as the DEV e2e harness mount target (`AiStrip.tsx:8-9`). Replacing the strip with the drawer is a separate Rule-A decision, not part of P10.
- Do NOT re-implement `buildMultiStopDirectionsUrl` or the accept/route math — call the existing handlers. Re-deriving the URL risks dropping waypoints (the exact bug `mapDirectionsUrl.ts:2-7` was written to fix).
- The reorder list's keyboard re-focus (`requestAnimationFrame` + `focusRowByIdx`, `AiStrip.tsx:155-161`) is load-bearing for a11y — copy it intact, don't simplify.

---

### P11 — "I'm at…" on live geosearch
**Gate:** additive (no approval) — and **Depends on:** none (independent of P1/P3; can ship standalone). Uses existing `geosearchService` + `GeoSearchInput` pattern.
**Goal:** Let the user pick an arbitrary place (not just the reverse-geocoded GPS dot) for the "I'm at…" ping, using the same Photon/OSM autocomplete the location pickers use. Keep `reverseGeocode` as the GPS-dot default label.

**Preconditions:**
- VERIFIED: `geosearch(query, opts)` signature is `(query: string, opts?: { limit?: number; near?: { lat; lng } | null }) => Promise<GeoSearchResult[]>` (`geosearchService.ts:41-44`). `GeoSearchResult` = `{ lat; lng; name: string | null; address: string; type: string | null }` (`geosearchService.ts:18-27`).
- VERIFIED: `GeoSearchInput` is a self-contained, body-portaled, debounced combobox (`GeoSearchInput.tsx:42`) taking `{ isDarkMode, placeholder?, near?, onSelect, inputClassName?, autoFocus?, initialValue? }` (`GeoSearchInput.tsx:19-30`). It already calls `geosearch` internally (`GeoSearchInput.tsx:118`) — ImAtFAB does NOT call the service directly.
- VERIFIED: `ImAtFAB` currently resolves the place label via `reverseGeocode` on sheet open (`ImAtFAB.tsx:51-72`) and the place is a free-text `<input value={placeName}>` (`ImAtFAB.tsx:209-219`).
- VERIFIED (DO NOT TOUCH): the draft handoff is real and bidirectional — `ImAtFAB.tsx:115-139` registers a `pulse:messages:draft:accepted` listener, copies the body to clipboard, then calls `onSend(contactId, body)`; the parent dispatches to Messages at `PulseMapView.tsx:1069-1081` (`onContactAction('message', contactId)`); Messages listens/prefills/acks at `Messages.tsx:1897-1929` (`src/components/Messages.tsx` — there is NO `Messages/Messages.tsx`; the `Messages/` dir holds only sub-components). P11 changes only WHERE `placeName` comes from, never the dispatch/ack contract.

**Files to touch:**
- `src/components/map/sub/ImAtFAB.tsx` — `:15` `import { reverseGeocode } from '../../../services/locationService';` — keep (still used for the GPS fallback label).
- `src/components/map/sub/ImAtFAB.tsx` — add `import GeoSearchInput from './GeoSearchInput';` and `import type { GeoSearchResult } from '../../../services/geosearchService';`.
- `src/components/map/sub/ImAtFAB.tsx` — `:209-227` the free-text Place `<input>` block — replace with `<GeoSearchInput>` while preserving the reverse-geocoded `placeName` as the seed and the GPS fallback. (This is a swap of one input control inside ImAtFAB, authored entirely in this surface — additive in behavior, but see Rule-A note.)
- `src/components/map/sub/ImAtFAB.tsx` — `:96-139` `handlePick` — unchanged except it already reads `placeName`; ensure a geosearch selection updates `placeName` so the existing body-builder (`I'm at ${placeLabel}.`, `:98`) works without edits.

**New files:** none. P11 reuses `GeoSearchInput.tsx` and `geosearchService.ts` as-is.

**Steps:**
1. Add state for the selected place coords (optional, for future precision): `const [selectedPlace, setSelectedPlace] = useState<GeoSearchResult | null>(null);`. The `placeName` string remains the source of truth for the message body.
2. Keep the existing `reverseGeocode` effect (`:51-72`) — it seeds `placeName` from GPS when the sheet opens. This is the GPS-dot fallback label per the brief.
3. Replace the Place `<input>` (`:209-219`) with:
```tsx
<GeoSearchInput
  isDarkMode={isDarkMode}
  near={userPosition}
  initialValue={placeName}
  placeholder={resolving ? 'Resolving address…' : 'Search a place, or use your location'}
  onSelect={(r: GeoSearchResult) => {
    setSelectedPlace(r);
    // Build the same short label shape the reverse-geocode path produces:
    // prefer the POI name, else the first two address segments.
    const label = r.name
      ? (r.type ? `${r.name}` : r.name)
      : (() => {
          const segs = r.address.split(',').map(s => s.trim());
          return segs.length >= 2 ? `${segs[0]}, ${segs[1]}` : r.address;
        })();
    setPlaceName(label);
  }}
  inputClassName={/* match ImAtFAB's existing input styling — copy the className from :214-218 */}
/>
```
4. (Optional, per brief) Surface `result.type` as a small category chip next to the resolved place (e.g. "restaurant", "city") when `selectedPlace?.type` is set. Use neutral chrome, not coral.
5. Keep the resolving `Loader2` spinner only on the reverse-geocode path; `GeoSearchInput` renders its own spinner during search (`GeoSearchInput.tsx:190-196`), so do not double-spin — drop the wrapping `relative`/`Loader2` from the old block if it conflicts, or keep it only while `resolving && !selectedPlace`.
6. `handlePick` (`:96-139`) needs NO change to its dispatch/ack logic — it reads `placeName` which now reflects either the GPS label or the geosearch selection.

**Data / schema / migration:** none. `geosearch` already routes through the `maps-geosearch` edge function (`geosearchService.ts:49`). No new tables, no AI, no client API key.

**Code patterns:**
- `GeoSearchResult` (`geosearchService.ts:18-27`):
```ts
interface GeoSearchResult { lat: number; lng: number; name: string | null; address: string; type: string | null; }
```
- The existing reverse-geocode label-shortening logic to mirror for the geosearch fallback (`ImAtFAB.tsx:64-66`):
```ts
const segments = addr.split(',').map(s => s.trim());
const short = segments.length >= 2 ? `${segments[0]}, ${segments[1]}` : addr;
```
- The untouched ack contract (`ImAtFAB.tsx:115-125`): listens for `pulse:messages:draft:accepted` with `detail.source === 'map-im-at'` and `detail.contactId`.

**Acceptance criteria:**
- Opening "I'm at…" with GPS available still seeds the place field with the reverse-geocoded short label (unchanged default).
- Typing ≥3 chars shows the Photon/OSM dropdown; selecting a result updates the place label and the message body becomes `I'm at <selected place>.`
- Picking a contact still copies the body to clipboard, routes to Messages, and the ack toast swaps from "Copied…" to "Drafted…" when Messages consumes the draft (proves the handoff is intact).
- With no GPS and no selection, the FAB still hides (`ImAtFAB.tsx:143` `if (!userPosition) return null;` preserved).

**Verify (commands):**
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "ImAtFAB|GeoSearchInput"` — NO NEW errors.
- `npm run test` (Vitest).
- Manual: `npm run dev:full`, Map → "I'm at…" → confirm (a) GPS label seeds, (b) search dropdown works, (c) pick contact → Messages opens prefilled and the toast swaps to "Drafted…".

**Commit:** `feat(map): live geosearch in the I'm-at FAB place picker (P11)`

**Rollback:** `git revert <sha>` — restores the free-text `<input>`. The dispatch/ack contract is untouched, so rollback is isolated to the place-input control.

**Preserve-verbatim / gotchas:**
- **DO NOT TOUCH the `pulse:messages:draft` dispatch/ack** (`ImAtFAB.tsx:115-139` ↔ `PulseMapView.tsx:1069-1081` ↔ `Messages.tsx:1897-1929`, i.e. `src/components/Messages.tsx`). It is REAL and bidirectional; the clipboard fallback + 1.5s listener cleanup are load-bearing. P11 only changes the `placeName` source.
- `GeoSearchInput` requires `q.trim().length >= 3` before searching (`geosearchService.ts:45-46`, `GeoSearchInput.tsx:109`) — the dropdown is intentionally empty for 1–2 chars; this is correct, not a bug.
- Rule-A: replacing the free-text input with `GeoSearchInput` removes the ability to type a totally free-form place string and send it without a matching OSM hit. Mitigation: `GeoSearchInput` keeps its `value` editable and `placeName` is still set from `onSelect`; but if the user types a place with NO OSM match, the body would carry the last selected/seeded label, not their raw text. If the free-text-send behavior must be preserved exactly, keep a parallel plain `<input>` toggle or let `placeName` track the GeoSearchInput's raw value. Surface this trade-off as a one-line Rule-A pros/cons before executing if the playbook executor judges free-text-send to be load-bearing.

---

### P12 — Cross-entity markers (surface orphaned capability)
**Gate:** additive (no approval) — and **Depends on:** none on the data side (capability already exists); pairs with P3 for visual placement but ships independently behind `mapHorizon`.
**Goal:** Plot tasks and decisions on the Map (not just contacts/meetings) by reading their `entity_places` links — surfacing a capability the schema already supports but nothing renders today. Markers are static (refetch-on-focus; no realtime, no UPDATE RLS on `entity_places`).

**Preconditions:**
- VERIFIED: `getPlacesForEntity(entityType, entityId)` → `Promise<PlaceWithRole[]>` (`locationService.ts:451-473`) and `getEntityPlaceMap(entityType)` → `Promise<Record<string, string>>` (entityId → placeId) (`locationService.ts:601-618`). `entityType` accepts `'contact' | 'task' | 'decision' | 'event' | 'meeting'`.
- VERIFIED: `getPlacesForEntity` returns full `PlaceWithRole` (PLACE fields incl. `lat`, `lng`, `color`, `notes`, `name`, `type` + `role`) via the `places(*)` join (`locationService.ts:457`). `getEntityPlaceMap` returns only the entityId→placeId map (cheaper, but no coords) — for markers we need coords, so use `getPlacesForEntity` per entity OR a place-id → place fetch (step 3, N+1 mitigation). **Neither returns the task/decision TITLE** — both surface PLACE data only. The marker `label` is therefore `place.name`; the entity's own title would require a `taskService`/`decisionService` lookup (deferred, out of P12 scope).
- VERIFIED: `entity_places` is NOT in `supabase_realtime` and has NO UPDATE policy (only `entity_places_select` / `entity_places_insert` / `entity_places_delete` — confirmed live via `pg_policy`). `places` IS not in realtime either (confirmed live). → markers are static; refetch on view focus, not via subscription.
- VERIFIED: `PulseMapViewProps` (`PulseMapView.tsx:67-88`) has NEITHER a `tasks` NOR a `decisions` prop today. The App render site is `App.tsx:1471-1478` (`<PulseMapView contacts circles isDarkMode userId onContactAction onContactUpdated />`).
- VERIFIED: App.tsx does NOT hold top-level `tasks`/`decisions` arrays (no `const [tasks` / `const [decisions`). Tasks/decisions live in `taskService` (`Task` type at `taskService.ts:4-22`, `workspace_id`-scoped) and `decisionService`. So P12 must either (a) lift a fetch into App and pass it down, or (b) self-fetch inside PulseMapView. **Recommended: self-fetch by entity_places** (matches the contact self-fetch precedent at `PulseMapView.tsx:113` `useContactCircles`), because the marker only needs the entity id + its place coords, not the full Task/Decision object.
- VERIFIED: the renderer-portable marker seam is `MapContactMarkerBody` (the visual body decoupled from positioning, `MapContactMarker.tsx:54-59`, `:248`) projected via `MapMarkerPortal` (`MapMarkerPortal.tsx:29`). The MapLibre contact-marker render uses exactly this pair (`PulseMapView.tsx:730-761`). P12's task/decision layer copies THIS seam — it does NOT use Google `OverlayView` and must NOT lift `SearchMapView`'s Google path.

**Files to touch:**
- `src/App.tsx` — `:1471-1478` `<PulseMapView .../>` — (Option A) pass `tasks`/`decisions` if a parent fetch is lifted. **If self-fetch (recommended), no App.tsx change is needed** beyond optionally passing the active `workspaceId` if not already derivable inside the view. (PulseMapView already takes `userId`; `getEntityPlaceMap`/`getPlacesForEntity` are RLS-scoped, so no explicit workspace prop is required.)
- `src/components/map/PulseMapView.tsx` — `:67-88` `PulseMapViewProps` — add (Option A only) `tasks?: Array<{ id: string; title: string }>` and `decisions?: Array<{ id: string; title: string }>`. Skip for self-fetch.
- `src/components/map/PulseMapView.tsx` — near the other layer hooks (`:160-180`) — add `const entityMarkers = useEntityPlaceMarkers(lens, focusEpoch);` (new hook, below).
- `src/components/map/PulseMapView.tsx` — `:730-761` (the MapLibre contact-marker map block) — add a sibling block that renders task/decision markers through `MapMarkerPortal` + `MapContactMarkerBody` (or a thin new `EntityPlaceMarkerBody`). Gate on `features.mapHorizon`.

**New files:**
- `src/components/map/hooks/useEntityPlaceMarkers.ts` — responsibility: fetch task + decision `entity_places` links and resolve them to `{ entityType, entityId, label, lat, lng, color, notes }[]`; refetch when a `focusEpoch` (bumped on view focus) changes. **Copy the self-fetch + lens-gated pattern from `src/components/map/hooks/useContactCircles.ts`** (the prop-or-self-fetch precedent) and the `getEntityPlaceMap`/`getPlacesForEntity` call shape from `locationService.ts:451-473,601-618`.
- (Optional) `src/components/map/contacts/EntityPlaceMarker.tsx` — a task/decision marker body, **copying `MapContactMarkerBody`'s body+portability split (`MapContactMarker.tsx:54-248`)**. If the contact body is reused directly, skip this file and pass a synthetic `contact`-shaped object — but a dedicated body is cleaner (different icon: a task/check or decision/flag glyph instead of Home/Briefcase).

**Steps:**
1. Create `useEntityPlaceMarkers(lens, focusEpoch)`:
   - For `entityType` in `['task','decision']`, call `getPlacesForEntity` per attached entity OR (preferred, to avoid N+1) call `getEntityPlaceMap('task')` + `getEntityPlaceMap('decision')` to get `entityId → placeId`, collect the unique place ids, then fetch those places (a single `places.select('*').in('id', placeIds)` — add a small `getPlacesByIds(ids: string[])` helper to `locationService` mirroring `getPlace` at `:476-484`, or batch via `getPlacesForEntity` if the entity count is small). VERIFIED there is no existing `getPlacesByIds` — adding one is additive.
   - Map each to `{ entityType: 'task'|'decision', entityId, label: place.name, lat: place.lat, lng: place.lng, color: place.color, notes: place.notes }`. **The label is `place.name` — the task/decision TITLE is NOT available via `entity_places`/`getPlacesForEntity` (those return PLACE rows, not the entity).** Sourcing the actual task/decision title would require a separate `taskService`/`decisionService` fetch keyed by `entityId`, which is OUT of P12 scope (defer). Do not imply `place.name` is the task title; it is the attached place's name.
   - Return `[]` when `lens === 'atlas'` if task/decision plotting should be TODAY/WEEK-only (decision: plot on all lenses unless P3 says otherwise; default plot on TODAY+WEEK to match meeting markers' lens filter at `PulseMapView.tsx:764-766`).
2. Refetch-on-focus: bump `focusEpoch` when the Map view gains focus. Wire it from App (the view switch already remounts/focuses the Map) or use a `visibilitychange` / window-focus listener inside the hook. Because there's no realtime, the hook must re-run on focus so newly geo-anchored tasks/decisions appear without a full reload.
3. Render the markers in the MapLibre block (sibling to `:730-761`):
```tsx
{mapLibreReady && features.mapHorizon && entityMarkers.map(em => (
  <MapMarkerPortal key={`${em.entityType}-${em.entityId}`} map={mapLibreRef.current} lat={em.lat} lng={em.lng}>
    <EntityPlaceMarkerBody
      entityType={em.entityType}
      label={em.label}
      color={em.color}      /* place.color if set, else a neutral default */
      notes={em.notes}
      isSelected={/* optional */ false}
      onClick={/* optional: open the task/decision */}
    />
  </MapMarkerPortal>
))}
```
4. Color: consume `place.color` when set (`placeTypes.ts:44`, `PLACE_TYPE_COLORS` defaults at `:71-78`). **These markers are NOT coral** — coral is reserved for AI/live/route signal (CLAUDE.md §4). Use `PLACE_TYPE_COLORS` (amber for `site`, violet for `venue`, neutral for `custom`) or `place.color`, never `--pulse-coral`.
5. (Optional) Surface `place.notes` in a tooltip/hover on the marker body.

**Data / schema / migration:** none required. Reads existing `entity_places` + `places` under existing RLS. If adding `getPlacesByIds`, it is a read-only client helper, no migration. (Confirm no migration needed: the capability is the whole point — tables already exist and are populated by the entity-side surfaces, e.g. `attachPlaceToEntity` at `locationService.ts:558-573`.)

**Code patterns:**
- `getPlacesForEntity` / `getEntityPlaceMap` (`locationService.ts:451`, `:601`) — the two read paths.
- `PlaceWithRole` shape (`placeTypes.ts:33-68`): has `lat`, `lng`, `color: string | null`, `notes: string | null`, `name`, `type`, `role`.
- Marker seam (`MapContactMarker.tsx:54-59`):
```ts
export type MapContactMarkerBodyProps = Omit<MapContactMarkerProps, 'lat' | 'lng' | 'liveLocation'>;
export const MapContactMarkerBody = memo(MapContactMarkerBodyInner);
```
- Portal seam (`MapMarkerPortal.tsx:22-29`): `{ map, lat, lng, children }`.
- The exact MapLibre marker-map block to mirror: `PulseMapView.tsx:730-761`.

**Acceptance criteria:**
- A task and a decision with an attached place (created via the entity-side location surfaces) render as markers on the Map with `?ff_mapHorizon=on`, positioned at the place's lat/lng, on the MapLibre renderer (default).
- Switching away and back to the Map refetches and reflects a newly geo-anchored task/decision (proves refetch-on-focus, since no realtime).
- Markers use `place.color`/type-default colors — never coral.
- With `mapHorizon` OFF, no task/decision markers render (contacts/meetings unchanged).
- No Google `OverlayView` is introduced for these markers (MapLibre-native via `MapMarkerPortal`).

**Verify (commands):**
- Live data check before building: `mcp__claude_ai_Supabase__execute_sql` (project `ucaeuszgoihoyrvhewxk`):
  `select entity_type, count(*) from entity_places where entity_type in ('task','decision') group by entity_type;` — confirms there are rows to render (if zero, create one via the entity-side surface first, or the acceptance test has nothing to show).
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "useEntityPlaceMarkers|EntityPlaceMarker|PulseMapView|locationService"` — NO NEW errors.
- `npm run test` (Vitest).
- Manual: `npm run dev:full`, geo-anchor a task + a decision, open Map `?ff_mapHorizon=on`, confirm both render and survive a view switch.

**Commit:** `feat(map): plot task + decision entity_places markers on the Horizon map (P12)`

**Rollback:** `git revert <sha>`. Flag-gated (`mapHorizon`), so dark by default. The new hook/component and the optional `getPlacesByIds` helper are additive and unreferenced when reverted.

**Preserve-verbatim / gotchas:**
- **Do NOT lift `SearchMapView`'s Google `OverlayView` marker path** — it's the wrong renderer for the default MapLibre map. Use `MapMarkerPortal` + a `*Body` component (the established seam).
- `entity_places` has NO UPDATE RLS and NO realtime — do NOT wire a subscription or expect live position updates. A place's coords change only via the entity-side delete+re-attach flow; refetch-on-focus is the correct (and only) freshness mechanism.
- N+1 trap: do NOT call `getPlacesForEntity` once per task AND once per decision in a loop over hundreds of entities. Use `getEntityPlaceMap` + a single `places.in('id', ids)` batch (add `getPlacesByIds`).
- Coral budget (CLAUDE.md §4): task/decision markers are content, not AI/live/route signal — they must not borrow `--pulse-coral`. `MapContactMarkerBody` hardcodes `#f43f5e` for the contact badge/sequence — if reusing that body directly, override the color or build a dedicated `EntityPlaceMarkerBody` so these markers don't read as coral signal.
- Rule-A: if Option A (lift a `tasks`/`decisions` fetch into App and add props) is chosen over self-fetch, adding optional props to `PulseMapViewProps` is additive and safe; but DO NOT change the existing required props or the App render site's existing props.

---

### P13 — Graduate Map out of Experimental
**Gate:** REQUIRES Rule-A approval (cite strategic §4 — this is the only phase that changes default-user-visible surface area; its own go/no-go). **Depends on:** P7 (publish `user_locations` to realtime so live presence is actually live) + a launch-readiness pass. Section-level move in BOTH nav surfaces.
**Goal:** Move the Map nav item from the Experimental section into a default (always-visible) section in both the desktop Sidebar and the mobile nav, so the Map is a first-class destination — gated on live presence being real (P7) and a launch-readiness review.

**Preconditions:**
- P7 done: `user_locations` is in `supabase_realtime` (so `subscribeToUserLocation` / `useLivePresence` are live, not wired-but-dead). Re-verify live: `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='user_locations';` must return a row.
- Launch-readiness pass complete (per the `section-launch-readiness` discipline): SMS-style "is this real" audit on the Map's surfaces — confirm no mocked/empty front doors are promoted to default visibility.
- VERIFIED: App.tsx ALREADY renders `<PulseMapView>` unconditionally for `AppView.MAP` (`App.tsx:1465-1480`) — the gate is NAV-only, not a render gate. Graduation does not touch the render path.
- VERIFIED: the Map nav item lives in the **Experimental** section in two places:
  - Desktop: `src/components/Sidebar/Sidebar.tsx:132` (`{ icon: MapPin, label: 'Map', view: AppView.MAP }`), inside the section object whose `label: 'Experimental'` (`:120`), `collapsible: true`, `note: 'features coming in v2.0'` (`:123`). The section disable gate is `src/components/Sidebar/Sidebar.tsx:403-404` (`sectionDisabled = section.label === 'Experimental' && !features.experimentalEnabled`).
  - Mobile: **CORRECTION** — the strategic handoff cites `MobileNavSheet.tsx:54`, but `MobileNavSheet.tsx:54` is the consuming gate (`const locked = !!section.experimental && !features.experimentalEnabled`). The actual Map nav ITEM is defined in `src/components/MobileChrome/mobileNavConfig.ts:92` (`{ view: AppView.MAP, label: 'Map', icon: MapPin }`) inside the `NAV_SECTIONS` Experimental section (`mobileNavConfig.ts:87-95`, `experimental: true`). `MobileNavSheet.tsx` imports `NAV_SECTIONS` from `mobileNavConfig` (`MobileNavSheet.tsx:14`). **Edit `mobileNavConfig.ts:92`, not `MobileNavSheet.tsx:54`.**

**Files to touch:**
- `src/components/Sidebar/Sidebar.tsx` — `:132` — MOVE the `{ icon: MapPin, label: 'Map', view: AppView.MAP }` item out of the Experimental section's `items` array (`:124-139`) and into a default section. Candidate home: the `'Work & People'` section (`:99-108`, `color: 'coral'`) — Map is people/places-adjacent — OR `'Intelligence'` (`:109-118`). Decision: place in `'Work & People'` after Contacts (`:105`). Remove the multi-line Map comment at `:127-131` along with the item (move the relevant note, or drop it — the "experimental Labs lane" rationale no longer applies). Keep `MapPin` imported (still used).
- `src/components/MobileChrome/mobileNavConfig.ts` — `:92` — MOVE `{ view: AppView.MAP, label: 'Map', icon: MapPin }` out of the Experimental `NAV_SECTIONS` entry (`:87-95`) into the matching default section (`'Work & People'`, `:70-77`) to mirror the desktop placement. `MapPin` is already imported (`:23`). Leave `VIEW_LABELS[AppView.MAP] = 'Map'` (`:118`) untouched.
- (Optional) `src/contexts/FeatureContext.tsx` — `:124-168` `DEFAULT_FEATURES` + `:175` `FLAGS_VERSION` — if graduation also flips `mapHorizon` to default-ON, set `mapHorizon: true` and bump `FLAGS_VERSION` to `2`, adding a one-time migration line in the loader (`:190-194` pattern) to force the new default over a stale persisted `false`. This is a SEPARATE decision from the nav move — see gotchas.

**New files:** none.

**Steps:**
1. Re-verify P7: run the `pg_publication_tables` check for `user_locations`. If it's NOT published, STOP — P13's gate is not met; do not graduate. (Live presence going to a default-visible Map while `user_locations` is unpublished ships a dead "live" affordance — the exact thing the launch-readiness pass forbids.)
2. Run the launch-readiness pass on the Map (per `section-launch-readiness`): enumerate every Map surface that could read as a feature (live presence chip, broadcast sheet, AI strip/RoutesDrawer, ETA alerts, geofencing) and confirm each is real or honestly absent. Geofencing / ETA-alerts / Autopilot are stubs (per memory `project_pulse_maps_infra`) — confirm they are not surfaced as working in the default view, or gate them.
3. Desktop move: cut the Map item from `Sidebar.tsx:132` and paste into `'Work & People'` `items` after Contacts (`:106`). Verify the Experimental section still renders with its remaining items (Summit, War Room) and that removing one item doesn't break `collapsible`/`note`.
4. Mobile move: cut `mobileNavConfig.ts:92` and paste into the `'Work & People'` section (`:70-77`). Verify the Experimental section (`:87-95`) still has Summit + War Room.
5. Confirm the Map is now reachable without `experimentalEnabled` on both surfaces: with Experimental OFF, Map must be clickable; with Experimental ON, Map must NOT appear twice.
6. (Optional, only if decided) Flip `mapHorizon` default + `FLAGS_VERSION` bump per the FeatureContext migration pattern (`:190-194`).
7. Update `docs/EXPERIMENTAL_TRIO_CUT_OR_KEEP_AUDIT_2026-06-13.md` to record the Map's graduation (it currently records KEEP-GATED in the Labs lane — that decision is now superseded).

**Data / schema / migration:** none in P13 itself (P7 owns the `user_locations` publication migration). If `mapHorizon` default flips, that's a flag-default change, not a DB migration.

**Code patterns:**
- Desktop section gate to confirm Map escapes (`Sidebar.tsx:403-404`):
```ts
const sectionDisabled = section.label === 'Experimental' && !features.experimentalEnabled;
```
- Mobile section gate (`MobileNavSheet.tsx:54`): `const locked = !!section.experimental && !features.experimentalEnabled;` — once Map is out of the `experimental: true` section, `locked` no longer applies to it.
- Mobile section shape (`mobileNavConfig.ts:45-51`): `{ label, items, experimental? }`.

**Acceptance criteria:**
- With `experimentalEnabled = false` (the default), the Map nav item is visible and clickable in BOTH the desktop Sidebar (`'Work & People'`) and the mobile nav sheet.
- The Experimental section retains Summit + War Room and is otherwise unchanged.
- No duplicate Map entry when `experimentalEnabled = true`.
- The Map view still renders `PulseMapView` (render path untouched).
- P7 re-verified: `user_locations` is in `supabase_realtime` before this ships.

**Verify (commands):**
- P7 gate: `mcp__claude_ai_Supabase__execute_sql` (project `ucaeuszgoihoyrvhewxk`): `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='user_locations';` — MUST return a row.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit 2>&1 | grep -E "Sidebar|mobileNavConfig"` — NO NEW errors.
- `npm run test` (Vitest).
- Manual (default flags, Experimental OFF): desktop Sidebar shows Map under Work & People; mobile sheet shows Map under Work & People; both navigate to the Map. Toggle Experimental ON → Map appears once (not duplicated).

**Commit:** `feat(nav): graduate Map out of Experimental into Work & People (P13)`
(If the flag flips too: a second commit `chore(flags): default mapHorizon on + bump FLAGS_VERSION to 2`.)

**Rollback:** `git revert <sha>` restores the Experimental placement in both files. If `FLAGS_VERSION` was bumped, the revert restores the prior version constant; note that browsers that already ran v2 will have persisted the new value — a clean revert may also need to lower the default back, but per CLAUDE.md never force a destructive flag reset on users; surface to the user.

**Preserve-verbatim / gotchas:**
- **This phase changes default-visible surface area → own go/no-go. Do NOT execute without explicit user approval (Rule A, strategic §4).** Present the exact diff (which section Map moves to in each file) and the P7/launch-readiness gate status before moving anything.
- **Citation correction:** the mobile Map item is in `src/components/MobileChrome/mobileNavConfig.ts:92`, NOT `MobileNavSheet.tsx:54`. Editing `MobileNavSheet.tsx:54` (the `locked` gate) would be wrong.
- It is a SECTION-LEVEL move in BOTH surfaces — not a one-line flag flip. Forgetting the mobile config leaves Map graduated on desktop but still Experimental-gated on mobile (inconsistent, and the brief explicitly calls this out).
- Do NOT delete the Experimental section or its remaining items (Summit, War Room) — only the Map item moves.
- The `mapHorizon` default flip is OPTIONAL and orthogonal: graduating the Map's NAV visibility does not require the Horizon redesign to be default-on. Keep them as separate commits/decisions. Flipping `mapHorizon` ON exposes **every** Horizon surface at once (scrubber, base-style switch, neutral chrome, and ALL drawers — i.e. all of P3–P12), so it is gated on **all of P3–P12 being shipped AND launch-ready**, not just P7, and rides its own approval separate from the nav move.
- Keep consistent with `docs/EXPERIMENTAL_TRIO_CUT_OR_KEEP_AUDIT_2026-06-13.md` — update it to reflect the graduation rather than contradicting it.

---

**Cross-phase notes / corrections surfaced during verification (for the playbook's errata):**
1. **Mobile Map nav item path corrected:** strategic handoff said `MobileNavSheet.tsx:54`; the real item is `src/components/MobileChrome/mobileNavConfig.ts:92` (`MobileNavSheet.tsx:54` is the `locked` consumer gate). Applied in P13.
2. **`WeekProposal.focusDate` has no current consumer** (produced at `mapAIService.ts:248`, consumed nowhere) — P10 (and P4's affordance) is its first consumer. NOTE: a same-named but UNRELATED `focusDate` prop exists in `CalendarTodayView.tsx` — that is NOT this field. Confirm scoped to `mapAIService.ts` + `src/components/map`, not a repo-wide grep.
3. **`entity_places` has no UPDATE policy and no realtime; `places` has no realtime** — confirmed live via `pg_policy` + `pg_publication_tables` (project `ucaeuszgoihoyrvhewxk`). P12's static-marker / refetch-on-focus design is correct.
4. **App.tsx holds no top-level `tasks`/`decisions` arrays** — P12 should self-fetch via `entity_places` (matching the `useContactCircles` self-fetch precedent at `PulseMapView.tsx:113`) rather than assume an App-lifted prop.
5. **`useMapAiProposals` already exposes every handler P10 needs** including the full-sequence `handleOpenInSystemMaps` and `arrivesAt`-populated `acceptedRoute` — P10 is a richer view, not new logic.
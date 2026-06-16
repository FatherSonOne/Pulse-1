# Map — Horizon (Direction D) — Resume Handoff (session 2026-06-15)

| | |
|---|---|
| **Doc** | `docs/MAP_HORIZON_RESUME_HANDOFF_2026-06-15.md` |
| **Date** | 2026-06-15 |
| **Purpose** | Hand the **remaining** Horizon phases (P8–P13) to a future session. Records what SHIPPED this session, the implementation patterns now in the code (so they aren't re-derived or contradicted), and what's left. |
| **Read first** | `docs/MAP_HORIZON_BUILD_HANDOFF_2026-06-15.md` (the P0–P13 execution playbook — per-phase gates/files/steps/acceptance) and `docs/MAP_HORIZON_REDESIGN_HANDOFF_2026-06-15.md` (§3 backend→UI matrix + §4 Rule-A pros/cons). This doc is the PROGRESS layer over those. |
| **Flag** | `mapHorizon` (boolean, default **OFF**). With it OFF the live Map is byte-for-byte the current Coral Cockpit. Activation condition in code: `mapHorizonOn = features.mapHorizon && mapLibreOn`. |
| **Verification** | The handoff's 18-item claim set was independently re-verified against live code + DB at session start (all substantially accurate; 5 cosmetic line-attribution nits). |

---

## 1. What shipped this session (all on `main`, pushed)

8 redesign phases + 3 verification harnesses. Every commit used **explicit paths** (never `git commit -a`); two parallel-session contacts commits (`b645c93`, `6c2268a`) landed cleanly alongside; the pre-existing uncommitted `docs/RELAY_MOBILE_STUDIO_SHELL_HANDOFF_2026-06-15.md` was left untouched throughout.

| Phase | Commit | What | Verified |
|---|---|---|---|
| **P0** flag scaffold | `0426ff7` | `mapHorizon` in FeatureFlags + DEFAULT_FEATURES (OFF) + FEATURE_NAMES + a Settings toggle ("Map Horizon Redesign (Alpha)") | tsc |
| **P1** data windows | `a857367` | `NOW_MS`(3h)/`THREE_DAY_MS` + `nowEvents`/`threeDayEvents` on GeoSignals + `MapHorizon` type + `isAtlasMode` bridge; `lensIncludesContact` extended with now/3d (existing branches verbatim) | tsc + **12 unit tests** |
| **P2** honest stubs | `ed3009f` | `horizon/horizonStubs.ts` registry of `ui_only_no_backend` surfaces (imported nowhere yet) | tsc |
| **P3** base-style switch | `3354420` | net-new **Contrast** palette + **density** (real, not stubbed) in `coralCockpitStyle.ts`; `MapLibreCanvas` style-signature swap; `useMapBaseStyle`; `horizon/BaseStyleSwitch.tsx` (neutral); replaces the dead Sat/Terr/Hybrid picker on the MapLibre branch | tsc + **8 tests** + **live eyeball** (Contrast restyles the map) |
| **P7** realtime/RLS | `7863ec6` | **APPLIED LIVE** to `pulse-chat`: `user_locations`→`supabase_realtime`; `location_share_consents` own_consents ALL→split (select both / write subject-only); `set_places_updated_at` search_path pinned; `config.toml` maps-* `verify_jwt=true`. Migration file `supabase/migrations/20260615130000_map_horizon_p7_realtime_rls.sql` | dry-run clean → applied → **re-queried live** |
| **P5** scrubber + Atlas | `8b0431a` | `horizon/HorizonScrubber.tsx` + `horizon/AtlasModeToggle.tsx` (neutral, a11y parity); derived-lens projection in PulseMapView; keyboard (1–4 + `a`) + SR announcer extended | tsc + **20 tests** + **live eyeball** (detent propagation, Atlas zoom-out) |
| **P4** adaptive AI card | `094ea2c` | `AiStrip` NEXT-STOP framing at `now` + surfaces dead `focusDate`/`focusId` as affordances; handlers `handleFocusEntity`/`handleJumpToDate`; FSM preserved | tsc + **harness eyeball** (5/5: NEXT STOP, date chip, Focus button + handlers fire) |
| **P6** coral→neutral chrome | `534993b` | `neutralChrome` prop on `MapFilterControls`/`MapFilterAccessories`; filter chrome neutral under Horizon; coral KEPT on AI strip / accepted route / live chip / broadcast-active | tsc + **live harness 15/15** (active toggle `bg-white/15`, no rose) + chrome eyeball |
| **P8** Live team drawer | `44ec1e7` | `horizon/LiveTeamDrawer.tsx` (right-side panel: `setLocationSharing` master switch + recipient flow + re-homed broadcasting-now rows w/ `location_label` + grace-aware ETA list + `useDialogA11y`); `horizon/useBroadcastControl.ts` (broadcast state machine lifted to a SINGLE PulseMapView owner; `MapFilterControls` now controlled, OFF path byte-identical); `location_label` populated in the broadcast upsert; `AcceptedRoute.path`→renderer-neutral `LatLng[]` | tsc-clean (all touched files) + **20 map tests** + **adversarial review (3 lenses)** — NOT yet live-eyeballed |

Harnesses (also pushed): `e2e/_verify-map-horizon.mjs` (`d4bd374`) — live authed Map tour; `e2e/_verify-map-horizon-ai.mjs` + `MapTestHarness` `ai` mode (`8056a3a`) — deterministic P4 affordances, no auth.

---

## 2. Implementation patterns now in the code (DO NOT re-derive / contradict)

These are the decisions the future session must build *with*, not around:

1. **Derived-lens projection (P5) — the spine of the whole UX.** In `PulseMapView`:
   - `legacyLens` (state) drives the OFF-path `MapLensRow` tabs only.
   - `horizon: MapHorizon` (state) + `atlasMode: boolean` (state) are the ON-path source of truth.
   - `lens: MapLens` is **derived**: `mapHorizonOn ? (atlasMode ? 'atlas' : now/today→'today', 3d/week→'week') : legacyLens`. **Every existing consumer reads this derived `lens`** (AI hook, meeting markers, all `lens==='atlas'` render branches, empty state, SR) — so they were left untouched.
   - `markerLens: MapLens | MapHorizon` is the **precise** detent, used ONLY by `lensIncludesContact` (the marker-window filter) + `useSrAnnouncer`.
   - New phases that need the time context should consume `lens` (projected) or `markerLens` (precise) — do **not** add a parallel lens.
2. **Flag-gating discipline.** Every Horizon surface is additive behind `mapHorizonOn`; the OFF path must stay byte-identical. Pattern: optional props default to the legacy behavior (`baseStyle?`/`density?` on MapLibreCanvas, `horizon?`/`onFocusEntity?`/`onJumpToDate?` on AiStrip, `neutralChrome?` on the filter bar).
3. **`coralCockpitStyle` is now 3-variant + density.** `buildCoralStyle(isDarkMode, { variant?, density? })`; `PALETTES = {light,dark,contrast}`; `coralLayers(p, density)`. **Contrast + density are REAL now** — the `horizonStubs` registry's disabled-state path is for the *other* not-yet-built surfaces, NOT these.
4. **`neutralChrome` (P6).** Coral=signal-only is enforced via this prop on the filter bar; the broadcast pill, AI strip, accepted-route polyline, and live chip KEEP coral. New chrome you add under Horizon should be neutral from the start (zinc rings, `bg-white/15`/`bg-gray-200` active) — mirror `BaseStyleSwitch`/`HorizonScrubber`.
5. **P7 is LIVE.** `user_locations` is published to realtime and `user_locations.consented_location_read` already lets a consented viewer SELECT the subject's row → **P8's Live drawer will receive real presence**. Don't re-add the migration; it's applied + in `supabase/migrations/`.
6. **e2e harness ai mode.** `MapTestHarness` (`/?e2eHarness=map&mode=ai`) mounts `AiStrip` with seeded proposals carrying `focusDate`/`focusId` — reuse/extend it for any AiStrip-dependent verification (no auth/model needed).

---

## 3. Remaining phases (specs live in the Build Playbook — deltas noted here)

> Rule-A status: **P8 SHIPPED** (approved + built 2026-06-16, commit `44ec1e7`). **P11 (§4.5), P13** still need explicit pros/cons approval before execution. **P9, P10, P12** are net-new additive shells (still flag-gated; confirm with the user but lower-risk).

- **P8 — Live team first-class drawer** ✅ **SHIPPED `44ec1e7`** (Build Playbook §P8; strategic §3.3, §4 / Rule-A).
  *Built:* `horizon/LiveTeamDrawer.tsx` (right-side panel) + `horizon/useBroadcastControl.ts`. Wires the previously-unsurfaced `setLocationSharing` as the "Share my location" master switch; POPULATES `user_locations.location_label` in the broadcast upsert via `reverseGeocode().catch(()=>null)` (null-tolerant; **also lights up the non-flagged War Room team radar — approved as additive**); re-homes the broadcasting-now rows (copied from `LiveTeamView`, +`location_label`); lists active ETA shares with **5-min grace-window** messaging (poll @30s — `eta_shares` is NOT realtime); `AcceptedRoute.path`→renderer-neutral `LatLng[]` (P4's orphan, bundled).
  *Deviations from the playbook (named per operating contract):* (1) the broadcast state machine was lifted to a **single owner in PulseMapView** (not "MapFilterControls consumes the hook" twice — two instances would double the keyboard listener + start/stop effect against the module-global `watchId`). `MapFilterControls` is now a **controlled consumer** via a `broadcast` prop; OFF path byte-identical (review-confirmed). (2) The recipient picker is rendered **once in PulseMapView** (always-mounted host) so both the filter-bar pill and the drawer summon the same picker. (3) Under Horizon the filter-bar **pill opens the drawer** (`onOpenLiveDrawer`) rather than being removed; `b` still toggles broadcast directly (shared state). (4) Master-switch disable **synchronously `stopLocationBroadcast()` before flipping `is_sharing` off** (Gotcha 4 — caught by adversarial review; the original ordering relied on the effect-cleanup which races the `await`).
- **P9 — Geofences drawer + all-geofences ring overlay** (§P9; strategic §3.4).
  List `listUserPlaces(geofence_radius_m IS NOT NULL)`; toggle radii via `setPlaceGeofence`; show `geofence_events` history; wire the **dead** `surfaced`/`surfaced_at` "mark reviewed" (net-new producer/consumer); new `horizon/MapLibreGeofenceRings.tsx` (mirror `MapLibreAtlasHalos`' equirectangular approach). **Surface honestly: "Geofence alerts require Live location ON"** (detection is broadcast-coupled). `completion_geofence` stays a `horizonStubs` stub.
- **P10 — Routes & planning drawer** (§P10; strategic §3.2).
  Host accept/reorder/dismiss from `useMapAiProposals` + "Open in Maps" (`buildMultiStopDirectionsUrl`) + plan summaries (`proposeWeekPlan`, with the `focusDate` jump already wired in P4's `handleJumpToDate`). **PRESERVE the dual-factor polyline decode** (Valhalla 1e6 / Google 1e5) in `maps-route`.
- **P11 — "I'm at…" on live geosearch** (§P11; strategic §4.5 / Rule-A).
  Swap `ImAtFAB`'s resolver to `geosearchService.geosearch` (Stadia, real); keep `reverseGeocode` as the GPS-dot fallback. **DO NOT touch** the working `pulse:messages:draft` handoff (dispatched in `PulseMapView.tsx:~1078` ↔ `Messages.tsx` listener; the in-code "Messages doesn't pick this up" comment is STALE/false — verified). Optional: surface `GeoSearchResult.type` category chip (`horizonStubs.geosearchCategoryChip`).
- **P12 — Cross-entity markers** (§P12; strategic §3.5).
  Plot the real-but-homeless `entity_places('task'|'decision')` as MapLibre-native markers (reuse the `*Body` portability seam — do NOT lift SearchMapView's Google path). Add `tasks`/`decisions` props from `App.tsx` to `PulseMapView`. **STATIC/refetch-on-focus** (entity_places has no realtime + no UPDATE RLS — verified). Not coral (not signal).
- **P13 — Graduate Map out of Experimental** (§P13 / Rule-A; DECIDED 2026-06-15).
  Relocate the Map nav item OUT of the Experimental section in BOTH `Sidebar/Sidebar.tsx` (item ~:132, section gate ~:403-404) and `MobileChrome/MobileNavSheet.tsx` (~:54). `App.tsx` already renders the Map unconditionally. **Pre-reqs MET:** P7 live + UI visually verified (P3/P5/P6 live, P4 harness). Still carries a deliberate go/no-go (only phase that changes default-visible surface). Decide whether to also flip `mapHorizon` ON by default (own `FLAGS_VERSION` bump + migration-block line, or persisted `false` masks it).

---

## 4. How to verify (token + harnesses)

- **Live authed tour:** `TARGET=http://localhost:5173 node e2e/_verify-map-horizon.mjs` — injects `mapHorizon`+`experimentalEnabled`+`mapLibreRenderer` via localStorage, navigates via the command palette, asserts + screenshots the scrubber/base-style/Atlas/filter-chrome.
- **Deterministic P4 (no auth):** `TARGET=http://localhost:5173 node e2e/_verify-map-horizon-ai.mjs` (dev harness `mode=ai`).
- **e2e token refresh** (the live tour needs `e2e/.auth/user.json`; ~1hr token, Google blocks automated OAuth): paste in a logged-in `localhost:5173` console:
  ```js
  (() => {const data=JSON.stringify({cookies:[],origins:[{origin:location.origin,localStorage:Object.entries(localStorage).map(([name,value])=>({name,value}))}]});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download='user.json';document.body.appendChild(a);a.click();a.remove();})();
  ```
  It lands in `C:\Users\Aegis{FM}\Downloads` (a Claude working dir); decode the access-token `exp`, copy to `e2e/.auth/user.json` if valid. (`e2e/.auth/user.json` is gitignored.)

---

## 5. Residuals / gotchas

- **P4 affordances are harness-verified, not live-data-verified.** The operational account (qntmecos@gmail.com) has 0 pinned contacts → no live AI proposals fire (route ≥2 / plan ≥2 / insight ≥3 stops). The affordances are proven via the deterministic harness; a live-data eyeball needs pinned contacts.
- **P5 meeting markers follow the projected lens** (now→today window), while contact markers use the precise now window. Acceptable for v1; a future refinement could narrow meeting markers to the now window.
- **P5 deferred the "Now = nearest un-visited stop" union** to a call-site layer (it's a global selection, not a per-contact predicate). P5 implements the event-window half; the nearest-stop union is documented in `useGeoRelevanceSignals.lensIncludesContact` and still pending.
- **eta_shares / geofence_events are NOT in realtime** (P7 only published `user_locations`, §8 deferred). ETA tick + visited-stops poll remain the mechanism — fine for v1.
- **P8 needs a LIVE eyeball.** The drawer is tsc-clean + adversarially reviewed but NOT live-data-verified: the operational account has 0 pinned/sharing contacts, so the broadcasting-now list + `location_label` display need a 2-browser test (one broadcaster, one viewer with granted consent) to confirm presence + label end-to-end. The e2e harness (`e2e/_verify-map-horizon.mjs`) does not yet open the drawer — extend it or eyeball manually with `?ff_mapHorizon=on`.
- **P8 `setLocationSharing` benign orphan.** If the user flips the master switch ON then CANCELS the recipient picker, `is_sharing` was already set `true` with no granted consents → invisible to everyone, cleaned on the next master-OFF. Acceptable; could be tightened by deferring `setLocationSharing(true)` to picker-confirm.
- **`location_label` semantic drift (cosmetic).** The `20260318000002_location_sharing.sql` column comment still says `'home'/'work'/'traveling'`; P8 now writes a full reverse-geocoded `formatted_address`. Every reader treats it as opaque `string|null`, so no code impact — the historical migration comment was left untouched (don't edit applied migrations).
- **Parallel sessions commit to `main`.** Always `git fetch` + check divergence before committing; use explicit-path commits. *(2026-06-16: a parallel Summit/Relay session pushed HEAD `381e0cc`→`138cd48` mid-P8 and committed the previously-uncommitted `RELAY` handoff + `Summit.css` itself — P8 stacked cleanly on top via explicit-path commit, nothing swept.)*

---

## 6. One-line state

P0–P8 shipped, `mapHorizon` OFF, P7 live. P8 (Live drawer) = `44ec1e7`, tsc-clean + adversarially reviewed but **not yet live-eyeballed** (§5). Resume at **P9** (Geofences drawer). Rule-A approvals still needed for P11, P13.

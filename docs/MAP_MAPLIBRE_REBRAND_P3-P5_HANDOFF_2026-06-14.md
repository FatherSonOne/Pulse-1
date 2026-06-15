# Map Rebrand → MapLibre (Path B) — P3 / P4 / P5 Handoff

**Date:** 2026-06-14
**Status in:** P0, P1, P2 **COMPLETE and pushed to `origin/main`** (live-confirmed in-app). This doc hands off the **remaining** epic: P3 (styling), P4 (geosearch), P5 (parity QA + flag flip), and the **legal-gate data migration** that blocks P5.
**Predecessor doc:** `docs/MAP_MAPLIBRE_REBRAND_HANDOFF_2026-06-14.md` (the original P0–P5 plan + grounded ToS facts). Read that first for the legal background; this doc supersedes its P3–P5 sections with the as-built reality.

---

## What's already done (so you don't re-do it)

The MapLibre renderer is fully built behind a flag and **matches the Google renderer across every overlay**: base tiles, contact/meeting/cluster markers, clustering, spiderfy fan-out, accepted-route line, Atlas territories + halos, radius rings, circle overlays, fit-bounds camera, attribution.

**Flag & entry:**
- `mapLibreRenderer` in `src/contexts/FeatureContext.tsx` (default **OFF**). Resolved by `src/components/map/provider/useMapLibreRenderer.ts` (FeatureContext value + `?ff_mapLibreRenderer=on` dev override).
- The Map section itself is gated by `experimentalEnabled` (Settings → Features & Labs).
- `PulseMapView.tsx` branches on `mapLibreOn`: renders the lazy `MapLibreCanvas` (+ overlay components) when ON, else the unchanged `<GoogleMap>`. **Google path is byte-identical** — every MapLibre change was additive.

**The `provider/` module** (`src/components/map/provider/`):
| File | Role |
|---|---|
| `types.ts` | `MapProviderApi` (camera: `fitBounds/panTo/setZoom/getZoom/onIdleOnce`) + neutral `LatLng`/`MapPadding` |
| `googleAdapter.ts` / `maplibreAdapter.ts` | camera adapters (P1a); `useFitBounds` drives either |
| `useMapLibreRenderer.ts` | flag resolver + `?ff_` dev override |
| `MapLibreCanvas.tsx` | the maplibre-gl map (lazy chunk; OpenFreeMap **liberty** style; `buildStyle()` attribution override; `compact` ⓘ) |
| `MapMarkerPortal.tsx` | OverlayView analog — `map.project()` + `createPortal`, repositions on move (type-only maplibre import) |
| `MapLibreAcceptedRoute.tsx` | route line → GeoJSON `line` |
| `MapLibreAtlasTerritories.tsx` / `MapLibreAtlasHalos.tsx` | territory polygons / density halos → GeoJSON fill/line (halos are circle **polygons** — maplibre `circle` radius is px not metres) |
| `MapLibreRadiusRings.tsx` / `MapLibreCircleOverlays.tsx` | hybrids — GeoJSON geometry + portal labels/dot |
| `maplibre-overrides.css` | forces the collapsed attribution "ⓘ" on wide screens |

Also: `services/routeService.ts` (+ `supabase/functions/maps-route` edge fn) for multi-stop route geometry; `sub/markerLayout.ts` (`computeMarkerLayout`, mirrors the Google inline marker logic — **keep in sync**); body extractions in `MapContactMarker`/`MapMeetingMarker`/`MapClusterMarker`/`SpiderLines` (each exports a `*Body` used by both renderers); `supercluster` promoted to a direct dep for renderer-agnostic clustering in `useMarkerClusters`.

**Marker rendering primitives all build only when the flag is ON** — every MapLibre overlay component uses a **type-only** maplibre import, so `maplibre-gl` itself ships only in its own lazy chunk via `MapLibreCanvas`. Don't break that (keep new overlay code type-only; verify `dist/assets/vendor-*.js` stays free of `maplibregl`).

---

## ⛔ THE LEGAL GATE — read this before P5

This is the real blocker, not a phase. **A MapLibre (non-Google) base map may NOT legally display Google-geocoded pins or Google-computed routes** (Google Maps Service-Specific Terms — "No use with a non-Google map" per API). Today, Pulse's geocoding/directions/distance still call Google via:

- `supabase/functions/maps-geocode/index.ts` → Google Geocoding (consumed by `services/locationService.ts`)
- `supabase/functions/maps-directions/index.ts` → Google Directions (consumed by `services/directionsService.ts`)
- `supabase/functions/maps-distance/index.ts` → Google Distance Matrix (consumed by `services/distanceMatrixService.ts`)
- `supabase/functions/maps-route/index.ts` → Google Directions (multi-stop, P0; consumed by `services/routeService.ts`)

**So flipping `mapLibreRenderer` ON in production while these return Google data = a ToS violation.** P5 (flag default ON) cannot ship until this data layer moves off Google.

**DECISION REQUIRED (owner): Stadia vs self-host.** Both are drop-in behind the *existing* edge functions (the clients don't change — only what the edge fn calls):
- **Stadia Maps** (hosted Pelias geocoding + Valhalla routing) — fastest path, ~$0 free tier → ~$20/mo. One API key, swap the upstream URL + response mapping in each edge fn.
- **Self-host Photon/Nominatim (geocode) + Valhalla/OSRM (routing)** — $0 ongoing but ops overhead (a box + OSM extracts).

Bonus this fixes: OSM-derived geocodes are **storable long-term** (Google's are technically not), which legitimizes Pulse persisting `home_lat/home_lng` etc.

**This migration can ship independently and is the highest-leverage next step** — it's a pure edge-fn swap, no UI change, and it unblocks P5. Recommended order: **legal gate → P4 → P3 → P5.**

---

## P3 — Coral Cockpit style JSON + (optional) self-hosted tiles

**Goal:** replace the stand-in OpenFreeMap **liberty** style with Pulse's Coral Cockpit cartography (light + dark), and decide tile hosting.

**As-built today:** `MapLibreCanvas.tsx` hard-codes `OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'` and `buildStyle()` fetches it + patches the source attribution. There is **no dark style and no isDarkMode switch yet** — the Google path has `mapService.ts` `MAP_STYLE_LIGHT/DARK` (~lines 47–113) driven by `isDarkMode`, but MapLibre always renders liberty (light).

**Work:**
1. **Author a Coral Cockpit MapLibre style JSON** (light + dark) — re-express the palette from `mapService.ts MAP_STYLE_LIGHT/DARK` in MapLibre's richer style-spec format (water, roads, labels, parks, building fills). This is design work, not mechanical.
2. **Wire `isDarkMode` → style** in `MapLibreCanvas` (it already receives `isDarkMode` via PulseMapView? — currently it does **not**; add the prop and `map.setStyle()` on theme change, or pick the style at mount). Note: `setStyle` re-adds sources/layers, so the overlay layer-managers (`MapLibreAcceptedRoute`, atlas layers, radius rings, circle overlays) must re-add their sources on the `style.load` / `styledata` event — **verify they survive a style swap** (today they add once on map load; a theme flip will drop them unless re-added).
3. **Tiles decision:**
   - **Keep OpenFreeMap** ($0, public instance) — simplest; swap only the style JSON, keep their tiles.
   - **Self-host Protomaps PMTiles on Cloudflare R2** (~$11/mo @ 10M reads) — one `.pmtiles` file, HTTP range reads, Protomaps style is CC0 (most minimal attribution). More control + no third-party uptime dependency.
4. **Attribution stays** — keep `buildStyle()`'s OSM/OpenMapTiles/OpenFreeMap credit (or Protomaps equiv.) + the `maplibre-overrides.css` compact ⓘ. (Already shipped; just don't regress it when changing the style.)

**Gotcha:** the style sources are referenced by id in the overlay layer-managers? No — overlays use their OWN sources (`pulse-accepted-route`, `pulse-atlas-*`, etc.), independent of the base style. So a style swap won't break overlay *sources*, but `setStyle()` clears ALL layers including theirs → they must re-add. Test a dark/light toggle with an accepted route + atlas lens active.

---

## P4 — geosearch (replace `google.maps.places.Autocomplete`)

**Why:** the autocomplete returns Google Places geocodes; persisting + plotting those on a MapLibre map is the same ToS issue as the geocoder. Replace with the chosen geosearch (Photon/Stadia autocomplete — pairs legally with the non-Google map; **do NOT use Mapbox geocoding**, its ToS also bars non-Mapbox maps).

**Call sites (verified 2026-06-14) — `google.maps.places.Autocomplete`:**
| File | Map-critical? | Notes |
|---|---|---|
| `src/components/map/PlacePicker.tsx` (`autocompleteRef`, ~line 76) | **YES** | feeds map place pins |
| `src/components/map/contacts/LocationEditModal.tsx` (`homeRef`/`workRef`, ~lines 211–212; `handlePlaceChanged` ~234) | **YES** | sets contact home/work lat/lng → shown on the map |
| `src/components/decisions/wizard/Step4Rhythm.tsx` (~line 50) | no (not a map surface) | decision venue input |
| `src/components/WarRoom/notebook/Composer.tsx` | no | War Room location source |
| `src/components/WarRoom/PulseStudio.tsx` | no | War Room location source |

**Scope decision:** the **2 map-critical** sites MUST migrate before the flag flips (they put geocodes on the MapLibre map). The other **3** don't render on the map, so they're not legally coupled to the renderer — but if you're standardizing on a non-Google geocoder anyway, sweeping all 5 avoids two geocoding stacks. Recommend: migrate the 2 for the flip; sweep the other 3 opportunistically.

**Work:** build a small `geosearchService` (client → a new `maps-geosearch` edge fn → Photon/Stadia autocomplete), and a renderer-neutral autocomplete input component to replace the Google `Autocomplete` widget (it currently binds to a Google `<input>` + `place_changed` listener — the replacement is a controlled input + a results dropdown calling the geosearch service, debounced). Note both `PlacePicker` and `LocationEditModal` currently gate on `useGoogleMapsLoader().isLoaded` — the replacement must not depend on Google JS being loaded.

---

## P5 — parity QA, flip the flag, retire Google

**Blocked by the legal gate.** Do NOT default `mapLibreRenderer: true` until geocoding/directions/distance are off Google.

**Parity QA checklist** (run under `?ff_mapLibreRenderer=on`, side-by-side vs OFF):
- [ ] Base tiles render; pan/zoom smooth; no console errors
- [ ] Contact + meeting markers: position, selection, route-sequence badge, live-location dot, travel-buffer badge
- [ ] Marker offsets (same-coord fanning)
- [ ] Clustering discs (zoom ≤15); click zooms to bbox
- [ ] Spiderfy (zoom ≥17 dense group): anchor click fans legs, tether SpiderLines, enter/exit animation, reduced-motion suppression
- [ ] Atlas territories + halos + circle-overlay labels (Atlas lens); territory click selects circle
- [ ] Accepted-route line draws + click → open-in-system-maps
- [ ] Radius rings + "you are here" dot + ring labels (when userPosition present)
- [ ] Fit-bounds: empty / single / multi-marker framing; MAX_FIT_ZOOM_OUT clamp; userPosition inclusion ≤50km
- [ ] Light **and** dark styles (after P3)
- [ ] Attribution: compact ⓘ, no "MapLibre", OSM credit on expand
- [ ] Mobile viewport

**Flip:** set `mapLibreRenderer` default ON in `FeatureContext.tsx` (or stage via rollout). Keep the Google path one release for rollback (`?ff_mapLibreRenderer=off`).

**Retire Google (after soak):** remove the `mapLibreOn` ternary's Google branch in `PulseMapView`, `useGoogleMapsLoader`, `googleAdapter.ts`, the `@react-google-maps/api` overlay components (`OverlayView`/`Polyline`/`Polygon`/`Circle` versions), the inline Google marker rendering, and the `@react-google-maps/api` + `@googlemaps/markerclusterer` deps. The `*Body` components + `computeMarkerLayout` + `provider/` become the only path. **Also resolve the AtlasTerritories/MapCircleOverlay redundancy** (both draw circle territories on Atlas in both renderers — dedupe during retirement).

---

## Guardrails (per CLAUDE.md)
- Additive + reversible until the flag flips; the Google path stays working behind the flag through P3/P4.
- The legal-gate migration MUST land before P5 default-ON. Don't flip without it.
- Keep new MapLibre overlay code **type-only** on maplibre-gl (preserve the lazy-chunk split — verify `vendor-*.js` stays clean of `maplibregl`).
- `computeMarkerLayout` mirrors the Google inline marker logic — if you touch one, touch both.
- Verify every step: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (gate on no NEW errors) + `npm run build`.
- This doc is tracked (`.gitignore` force-includes `*_HANDOFF_*.md`); the durable decision summary lives in the `project-pulse-maps-infra` memory.

**How to view the current build:** dev server (e.g. `localhost:5173`) → log in → Settings → Features & Labs → **Experimental Features ON** → open **Map** with `?ff_mapLibreRenderer=on`.

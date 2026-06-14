# Map Rebrand → MapLibre (Path B) — Implementation Handoff

**Date:** 2026-06-14
**Decision:** Owner chose **Path B — fully de-Google'd map** (no Google wordmark) over Path A (re-skin on Google tiles). This is a deliberate, flag-gated v2 epic — **do not rip out the working Google path**; build behind a `mapLibreRenderer` flag and keep Google as the fallback until parity is proven.
**Scope source:** the 2026-06-14 Map deep-dive research workflow (Google ToS + render-alternatives + current-stack blast radius). Grounded facts below; no need to re-research.

---

## Why Path B is a full-stack migration, not a tile swap (the load-bearing legal fact)

Google Maps Platform **Service-Specific Terms** carry a **"No use with a non-Google map"** clause per API: Directions §1.3, Distance Matrix §2.3, Geocoding §3.3, Geolocation §4.3, Places §5.3. You **may not** display Google-geocoded pins or Google-computed routes on a non-Google base map. Pulse currently uses Google Geocoding/Directions/Distance Matrix (via the `maps-geocode` / `maps-directions` / `maps-distance` edge functions). So:

> Switching the renderer to MapLibre **while still plotting Google geocodes/routes is a ToS violation.** Path B requires migrating **tiles AND the geocoding/directions/places data layer** off Google together.

Bonus: this also resolves a latent issue — Google's temporary geocodes technically aren't storable long-term, yet Pulse persists `home_lat/home_lng` etc. OSM-derived geocodes (Nominatim/Photon/Stadia) **are** storable.

Sources: [Google Maps Service Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) · [JS API attribution policy](https://developers.google.com/maps/documentation/javascript/policies).

---

## Recommended target stack

| Layer | Choice | Why | Cost |
|---|---|---|---|
| Renderer | **MapLibre GL JS** (`maplibre-gl`) + `react-map-gl/maplibre` | BSD-3, free, no map-load fee, no vendor wordmark; ~95% Mapbox-GL API parity. **Not Mapbox GL v2+** (proprietary, per-load billing, adds its own wordmark). | $0 |
| Tiles | **Protomaps PMTiles self-hosted on Cloudflare R2** (or OpenFreeMap public instance to start) | One `.pmtiles` file, HTTP range reads, no tile server; Protomaps style is **CC0** (most minimal attribution). | ~$11/mo @ 10M reads (R2); OpenFreeMap $0 |
| Geocoding + routing | **Stadia Maps** (hosted Pelias + Valhalla) — drop-in; or self-host **Photon/Nominatim** + **Valhalla/OSRM** | Legal pairing with non-Google map; storage-OK. Do **not** use Mapbox geocoding (its ToS also bars non-Mapbox maps). | Stadia ~$0 free tier → ~$20/mo |

---

## Blast radius (verified against current code)

**~25 files, ~50–70 engineering hours.** Markers are already custom React/DOM (`OverlayView` positioning only) so their internals survive; the work is porting the map primitives + styling + the one client-side DirectionsService call.

| Group | Files | Work |
|---|---|---|
| Container + loader | `PulseMapView.tsx` (the single `<GoogleMap>`, ~line 590), `hooks/useGoogleMapsLoader.ts` | `<GoogleMap>` → MapLibre `<Map>`; `useJsApiLoader` → npm import |
| Overlay anchors (6) | `MapContactMarker`, `MapMeetingMarker`, `MapClusterMarker`, `SpiderLines`, `MapRadiusRings`, `MapCircleOverlay` | `OverlayView` → MapLibre `Marker` / custom projected portal (`map.project(lngLat)`) |
| Geometry layers (3) | `overlays/AcceptedRoutePolyline` (Polyline), `overlays/AtlasTerritories` + `MapCircleOverlay` (Polygon), `overlays/AtlasHalos` + `MapRadiusRings` (Circle) | → GeoJSON `Source`+`Layer` (line/fill/circle) |
| Styling | `services/mapService.ts` `MAP_STYLE_LIGHT/DARK` (lines 47–113) | Re-express the Coral Cockpit palette as **MapLibre style JSON** (richer format than `google.maps.MapTypeStyle[]`) |
| Services | `hooks/useMapAiProposals.ts` (client `google.maps.DirectionsService`, ~line 215), `PlacePicker.tsx` + `LocationEditModal.tsx` (`google.maps.places.Autocomplete`) | DirectionsService → edge-fn returning polyline+ETA JSON; Autocomplete → Photon/Stadia geosearch |
| Utilities | `useFitBounds.ts` (`google.maps.event` + `LatLngBounds`), `mapService.ts` (`getMapOptions`, `computeBounds`, `GOOGLE_MAPS_LIBRARIES`), `aiTypes.ts` (`path: LatLngLiteral[]` → `{lat,lng}[]`) | mechanical |

**Already decoupled (no change):** `mapAIService.ts` (server-side ai-router), `locationService` geocoding (edge function), `useFitBounds` haversine math, all marker visual internals.

**De-risk first:** move the client-side `DirectionsService` call (useMapAiProposals) to an edge function returning `{polyline, durationMin}` — shrinks the swap and lets MapLibre be tested in parallel.

---

## Phased plan (flag-gated)

- **P0** Add `mapLibreRenderer` feature flag (default OFF). Decouple the client DirectionsService → edge function. Migrate geocoding/directions/distance off Google to Stadia (or self-host) behind the existing edge functions — **this is the legal prerequisite** and can ship independently.
- **P1** Introduce a thin `MapProvider` boundary wrapping: loader, container, overlay-anchor, polyline/polygon/circle, fitBounds/panTo/zoom, control positions, style. Google impl stays; add MapLibre impl.
- **P2** Port the 6 overlay-anchor components to projected portals; port the 3 geometry layers to GeoJSON sources/layers.
- **P3** Author the Coral Cockpit MapLibre style JSON (light/dark) against Protomaps; wire PMTiles on R2 (or OpenFreeMap).
- **P4** Replace `google.maps.places.Autocomplete` in PlacePicker/LocationEditModal with the chosen geosearch.
- **P5** Parity QA (markers, clustering, spiderfy, Atlas territories/halos, accepted-route polyline, fit-bounds, dark/light) behind the flag; flip default ON; retire the Google path once stable.

**Cost at target:** ~$0–$30/mo even at scale. **Branding result:** zero Google logo; only a small, freely-styleable OSM/Protomaps credit.

---

## Guardrails (per CLAUDE.md)
- Additive + reversible: keep the Google renderer fully working behind the flag until MapLibre reaches parity. No subtractive cutover.
- Verify schema/ToS before each step; the geocoding migration (P0) must land before any non-Google base map is shown with that data.
- This doc is a local artifact (`*.md` is gitignored repo-wide); the durable decision lives in the `project-pulse-maps-infra` memory.

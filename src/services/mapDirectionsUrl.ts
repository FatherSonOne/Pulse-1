// ─────────────────────────────────────────────────────────────────────────────
// mapDirectionsUrl — builds an OS-maps "directions" handoff URL that carries
// the FULL accepted-route sequence.
//
// The prior handoff (useMapAiProposals.handleOpenInSystemMaps) opened only the
// FIRST stop in Google Maps, silently dropping the rest of an AI-ordered route.
// This builds the complete origin → waypoints → destination URL.
//
// We standardise on Google Maps' universal `dir/?api=1` URL for every platform:
// it honours up to 25 waypoints, and on Android/iOS it opens the native Maps
// app when installed (else the web map). Apple Maps' own URL scheme does NOT
// reliably support multiple intermediate stops, so special-casing it would mean
// dropping waypoints again — sending the whole sequence to Google Maps is the
// honest choice.
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectionStop {
  lat: number;
  lng: number;
}

/**
 * @param orderedStops the accepted route in visit order (>= 1).
 * @param origin       the operator's current GPS, when known. When provided the
 *                     route starts from there and every stop becomes a
 *                     waypoint/destination; when null the first stop is the
 *                     origin.
 * @returns a Google Maps directions URL, or null when there's nothing to route.
 */
export function buildMultiStopDirectionsUrl(
  orderedStops: DirectionStop[],
  origin?: { lat: number; lng: number } | null,
): string | null {
  if (orderedStops.length === 0) return null;
  const fmt = (p: DirectionStop) => `${p.lat},${p.lng}`;

  const originPoint = origin ?? orderedStops[0];
  // With a GPS origin every stop is part of the route; without one, the first
  // stop is the origin so the route is the remaining stops.
  const routeStops = origin ? orderedStops : orderedStops.slice(1);

  if (routeStops.length === 0) {
    // Single stop and no GPS origin — just navigate to it.
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fmt(orderedStops[0]))}&travelmode=driving`;
  }

  const destination = routeStops[routeStops.length - 1];
  const waypoints = routeStops.slice(0, -1);

  const params = new URLSearchParams({
    api: '1',
    origin: fmt(originPoint),
    destination: fmt(destination),
    travelmode: 'driving',
  });
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(fmt).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

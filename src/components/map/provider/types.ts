// ─────────────────────────────────────────────────────────────────────────────
// MapProvider boundary — renderer-agnostic types (P1 of the MapLibre rebrand).
//
// These shapes let the map's host logic (camera framing, later overlays) speak
// to "the map" without importing google.maps.* directly. A concrete adapter
// (googleAdapter today, a maplibre adapter later) implements MapProviderApi;
// the host depends only on this interface.
//
// P1a covers the CAMERA seam (fitBounds / panTo / zoom / idle). Projection and
// overlay mounting are deferred to P1b/P2 — this interface grows then.
// ─────────────────────────────────────────────────────────────────────────────

/** Renderer-neutral lat/lng. Structurally compatible with google.maps.LatLngLiteral. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Viewport padding in pixels, matching google.maps.Padding / MapLibre's fitBounds padding. */
export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The imperative camera surface the host needs, renderer-agnostic.
 *
 * Adapters no-op safely when the underlying map instance isn't ready yet, so
 * callers don't have to null-check the map themselves.
 */
export interface MapProviderApi {
  /** Frame the viewport around every point with the given padding. */
  fitBounds(points: LatLng[], padding: MapPadding): void;
  /** Recenter on a single point without changing zoom. */
  panTo(point: LatLng): void;
  /** Set the zoom level. */
  setZoom(zoom: number): void;
  /** Current zoom, or undefined when the map isn't ready. */
  getZoom(): number | undefined;
  /**
   * Run `cb` on the next time the camera settles ('idle'), once. Returns an
   * unsubscribe that detaches the listener if it hasn't fired yet.
   */
  onIdleOnce(cb: () => void): () => void;
}

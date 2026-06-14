// ─────────────────────────────────────────────────────────────────────────────
// useFitBounds — refits the Google Map's viewport whenever the marker set,
// meeting set, or operator position changes.
//
// Framing rules:
// - Empty point set: pan to userPosition (or no-op) — refusing to fitBounds
//   with one synthetic point avoids the degenerate maxZoom snap.
// - One point: pan + zoom 13.
// - Multiple points: fitBounds with ASYMMETRIC padding (less top — chrome
//   already eats ~96px above the canvas; more bottom — FAB + chip live
//   there) and a hard cap at MAX_FIT_ZOOM_OUT so we never frame a continent
//   when a city would do.
// - userPosition is INCLUDED only when it's close enough to be useful (≤
//   USER_INCLUSION_KM from the nearest marker). When the operator is in
//   Brooklyn and the markers are in San Francisco, including userPosition
//   produces a transcontinental bound and renders the markers as a
//   pixel-cluster wedged into one corner — worse than just framing the
//   markers and trusting the operator to know where they are.
//
// Side-effect only; no return value. The caller passes a MapProviderApi (the
// renderer-agnostic camera adapter) rather than a raw map ref, so the framing
// math here stays renderer-neutral (P1a of the MapLibre rebrand).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import type { LatLng, MapProviderApi } from '../provider/types';

// Max distance from the nearest marker beyond which userPosition is excluded
// from the bounds calculation. 50km roughly = "still in the same metro area";
// further than that and including the operator just over-pads the frame.
const USER_INCLUSION_KM = 50;

// Floor on the resulting fit zoom. Anything wider than zoom 11 reads as
// "satellite view of the wrong country" and is rarely intentional.
const MAX_FIT_ZOOM_OUT = 11;

// Asymmetric padding (px). Top is small because MapLensRow + MapFilterBar
// already consume ~96px of vertical chrome; bottom is generous to clear the
// ImAtFAB (~64px) and the live-broadcaster / marker-count chip (~32px).
const FIT_PADDING = { top: 56, right: 64, bottom: 112, left: 64 };

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useFitBounds(
  camera: MapProviderApi | null,
  isLoaded: boolean,
  visibleMarkers: Array<{ lat: number; lng: number }>,
  meetingMarkers: Array<{ lat: number; lng: number }>,
  userPosition: LatLng | null,
): void {
  useEffect(() => {
    if (!camera || !isLoaded) return;

    const points: Array<LatLng> = [
      ...visibleMarkers.map(m => ({ lat: m.lat, lng: m.lng })),
      ...meetingMarkers.map(m => ({ lat: m.lat, lng: m.lng })),
    ];

    if (points.length === 0) {
      if (userPosition) camera.panTo(userPosition);
      return;
    }

    // Include the operator only when they're close enough to be part of the
    // story. Otherwise the bounds blow out continentally.
    if (userPosition) {
      const nearestKm = points.reduce(
        (min, p) => Math.min(min, haversineKm(userPosition, p)),
        Infinity,
      );
      if (nearestKm <= USER_INCLUSION_KM) {
        points.push(userPosition);
      }
    }

    if (points.length === 1) {
      camera.panTo(points[0]);
      camera.setZoom(13);
      return;
    }

    camera.fitBounds(points, FIT_PADDING);

    // Enforce the max-zoom-out floor on the NEXT idle tick. fitBounds is
    // async — its zoom isn't readable until the camera settles — so we ride
    // the one-shot 'idle' to clamp without fighting the in-flight animation.
    return camera.onIdleOnce(() => {
      const z = camera.getZoom();
      if (typeof z === 'number' && z < MAX_FIT_ZOOM_OUT) {
        camera.setZoom(MAX_FIT_ZOOM_OUT);
      }
    });
  }, [isLoaded, visibleMarkers, meetingMarkers, userPosition, camera]);
}

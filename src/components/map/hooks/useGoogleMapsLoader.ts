// ─────────────────────────────────────────────────────────────────────────────
// useGoogleMapsLoader — thin wrapper around @react-google-maps/api's
// useJsApiLoader, pre-configured with Pulse's id, API key, and libraries
// constant. Lifts the call out of PulseMapView so the host component
// doesn't need to import GOOGLE_MAPS_LIBRARIES or know the loader id.
// ─────────────────────────────────────────────────────────────────────────────

import { useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_LIBRARIES } from '../../../services/mapService';

export interface UseGoogleMapsLoaderResult {
  isLoaded: boolean;
  loadError: Error | undefined;
}

export function useGoogleMapsLoader(): UseGoogleMapsLoaderResult {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'pulse-google-maps',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  return { isLoaded, loadError };
}

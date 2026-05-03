// ============================================================
// MapPreview
//
// Small embeddable map card. The first cross-section consumer
// of the universal Place schema: any detail view (contact, task,
// decision, event) can drop one of these in to show "where this
// thing is" without pulling in the full ContactMapView.
//
// Two ways to point it at a location:
//   <MapPreview placeId="<uuid>" />         // looks up the Place
//   <MapPreview lat={...} lng={...} />      // raw coords (for
//                                             callers still on the
//                                             legacy column path)
// ============================================================

import React, { useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import { ExternalLink, MapPin } from 'lucide-react';
import {
  GOOGLE_MAPS_LIBRARIES,
  getMapOptions,
} from '../../services/mapService';
import { getPlace } from '../../services/locationService';
import { Place } from '../../types/placeTypes';

interface MapPreviewBaseProps {
  isDarkMode?: boolean;
  height?: number;
  /** Tap callback; defaults to opening the Map tab in a new view. */
  onOpenInMap?: () => void;
  /** Optional address override for the caption. */
  addressOverride?: string;
  className?: string;
}

type MapPreviewProps =
  | (MapPreviewBaseProps & { placeId: string; lat?: never; lng?: never })
  | (MapPreviewBaseProps & { placeId?: never; lat: number; lng: number });

const DEFAULT_HEIGHT = 140;
const DEFAULT_ZOOM = 14;

const MapPreview: React.FC<MapPreviewProps> = ({
  isDarkMode = false,
  height = DEFAULT_HEIGHT,
  onOpenInMap,
  addressOverride,
  className = '',
  ...locProps
}) => {
  const { isLoaded } = useJsApiLoader({
    id: 'pulse-google-maps',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState<boolean>(!!locProps.placeId);

  // Resolve the place if a placeId was passed
  useEffect(() => {
    if (!locProps.placeId) return;
    let cancelled = false;
    setLoading(true);
    getPlace(locProps.placeId)
      .then(p => { if (!cancelled) setPlace(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locProps.placeId]);

  // Resolve the lat/lng + address used for rendering
  const lat = place?.lat ?? locProps.lat;
  const lng = place?.lng ?? locProps.lng;
  const address = addressOverride ?? place?.address ?? null;

  const containerStyle = { width: '100%', height };

  if (lat == null || lng == null) {
    return (
      <div
        className={`rounded-xl flex flex-col items-center justify-center gap-1 text-xs ${
          isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-50 text-gray-400'
        } ${className}`}
        style={containerStyle}
      >
        <MapPin size={16} />
        {loading ? 'Loading place…' : 'No location set'}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center text-xs ${
          isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-50 text-gray-400'
        } ${className}`}
        style={containerStyle}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden border ${
        isDarkMode ? 'border-white/10' : 'border-gray-200'
      } ${className}`}
      style={containerStyle}
    >
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat, lng }}
        zoom={DEFAULT_ZOOM}
        options={{
          ...getMapOptions(isDarkMode),
          // Preview is non-interactive by default — tap goes to "open in Map"
          gestureHandling: 'none',
          zoomControl: false,
          keyboardShortcuts: false,
          disableDoubleClickZoom: true,
        }}
      >
        <OverlayView
          position={{ lat, lng }}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              backgroundColor: '#f43f5e',
              boxShadow: '0 2px 8px rgba(244,63,94,0.40), 0 0 0 3px #fafafa',
              transform: 'translate(-50%, -100%)',
            }}
          >
            <MapPin size={14} color="#fff" strokeWidth={2.5} />
          </div>
        </OverlayView>
      </GoogleMap>

      {/* Caption (address) + open-in-map affordance */}
      {(address || onOpenInMap) && (
        <div
          className={`absolute bottom-0 left-0 right-0 px-2.5 py-1.5 flex items-center justify-between gap-2 backdrop-blur-md ${
            isDarkMode ? 'bg-black/65 text-gray-200' : 'bg-white/85 text-gray-800'
          }`}
        >
          {address && (
            <span className="text-xs truncate flex-1">{address}</span>
          )}
          {onOpenInMap && (
            <button
              type="button"
              onClick={onOpenInMap}
              aria-label="Open in Map"
              className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 hover:text-rose-600 transition-colors"
            >
              Map
              <ExternalLink size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MapPreview;

// ============================================================
// SearchMapView (B3 / #35).
//
// Renders search results that have a place attached as pins on a
// single GoogleMap. Used as the 'map' view-mode in UnifiedSearchRedesign
// — same query, list ↔ map toggle.
//
// The component does NOT fetch — it expects results that already
// carry `metadata.spatial.placeId` + `metadata.spatial.distanceMiles`
// (set by spatialSearchService.applyGeoFilter). Each pin clicks
// through to the standard search detail panel via onSelect.
// ============================================================

import React, { useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';
import { CheckSquare, Mail, MapPin, MessageSquare, Mic, StickyNote, Users, Calendar } from 'lucide-react';
import { GOOGLE_MAPS_LIBRARIES, getMapOptions, computeBounds } from '../services/mapService';
import { getPlace } from '../services/locationService';
import { SearchResult, SearchResultType } from '../services/unifiedSearchService';

interface SearchMapViewProps {
  results: SearchResult[];
  isDarkMode?: boolean;
  /** Geo filter center (user position or geocoded place) — used to seed the map view. */
  center?: { lat: number; lng: number } | null;
  onSelect?: (result: SearchResult) => void;
}

interface PinDatum {
  result: SearchResult;
  lat: number;
  lng: number;
}

const RESULT_ICON: Record<SearchResultType, React.ElementType> = {
  message: MessageSquare,
  email: Mail,
  vox: Mic,
  note: StickyNote,
  task: CheckSquare,
  event: Calendar,
  thread: MessageSquare,
  contact: Users,
  sms: MessageSquare,
  unified_message: MessageSquare,
  archive: StickyNote,
};

const SearchMapView: React.FC<SearchMapViewProps> = ({
  results,
  isDarkMode = false,
  center,
  onSelect,
}) => {
  const { isLoaded } = useJsApiLoader({
    id: 'pulse-google-maps',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [pins, setPins] = useState<PinDatum[]>([]);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);

  // Resolve every result's placeId → lat/lng once. The spatial filter
  // already tagged each result with metadata.spatial.placeId.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved: PinDatum[] = [];
      for (const r of results) {
        const placeId = (r.metadata?.spatial as { placeId?: string } | undefined)?.placeId;
        if (!placeId) continue;
        const place = await getPlace(placeId);
        if (cancelled) return;
        if (place) resolved.push({ result: r, lat: place.lat, lng: place.lng });
      }
      if (!cancelled) setPins(resolved);
    })();
    return () => { cancelled = true; };
  }, [results]);

  // Fit bounds to all pins + the center, on either pins or center change.
  useEffect(() => {
    if (!mapRef || pins.length === 0) return;
    const points = pins.map(p => ({ lat: p.lat, lng: p.lng }));
    if (center) points.push(center);
    const bounds = computeBounds(points);
    if (bounds) mapRef.fitBounds(bounds, 80);
  }, [mapRef, pins, center]);

  if (!isLoaded) {
    return (
      <div
        className={`flex items-center justify-center text-sm rounded-xl ${
          isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-50 text-gray-500'
        }`}
        style={{ height: 480 }}
      >
        Loading map…
      </div>
    );
  }

  if (pins.length === 0 && results.length > 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm rounded-xl ${
          isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-50 text-gray-400'
        }`}
        style={{ height: 480 }}
      >
        Resolving locations…
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden border ${
        isDarkMode ? 'border-white/10' : 'border-gray-200'
      }`}
      style={{ height: 480 }}
    >
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 37.7749, lng: -122.4194 })}
        zoom={11}
        options={getMapOptions(isDarkMode)}
        onLoad={setMapRef}
      >
        {pins.map(({ result, lat, lng }) => {
          const Icon = RESULT_ICON[result.type] ?? MapPin;
          const distance = (result.metadata?.spatial as { distanceMiles?: number } | undefined)?.distanceMiles;
          return (
            <OverlayView
              key={`${result.type}:${result.id}`}
              position={{ lat, lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect?.(result); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(result);
                  }
                }}
                aria-label={`${result.title}${distance !== undefined ? `, ${distance.toFixed(1)} miles away` : ''}`}
                className="group relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 rounded-full"
                style={{ transform: 'translate(-50%, -100%)', border: 'none', padding: 0, background: 'transparent' }}
              >
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: '#f43f5e',
                    boxShadow: '0 2px 8px rgba(244,63,94,0.40), 0 0 0 3px #fafafa',
                  }}
                >
                  <Icon size={14} color="#fff" strokeWidth={2.5} />
                </div>
                <div
                  className="absolute top-full mt-1 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap text-xs font-semibold px-1.5 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity"
                  style={{
                    backgroundColor: 'rgba(15, 15, 15, 0.85)',
                    color: '#fafafa',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {result.title}
                  {distance !== undefined && (
                    <span style={{ color: '#fb7185', marginLeft: 6 }}>
                      {distance < 1 ? `${(distance * 5280).toFixed(0)} ft` : `${distance.toFixed(1)} mi`}
                    </span>
                  )}
                </div>
              </button>
            </OverlayView>
          );
        })}
      </GoogleMap>
    </div>
  );
};

export default SearchMapView;

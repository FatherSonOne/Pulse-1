import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { Contact } from '../../../types';
import { ContactCircle } from '../../../types/contactCircleTypes';
import { GOOGLE_MAPS_LIBRARIES, getMapOptions, computeBounds } from '../../../services/mapService';
import {
  getCurrentUserLocation,
  geocodeContactsBatch,
  saveContactLocation,
  subscribeToUserLocation,
  UserLocation,
} from '../../../services/locationService';
import MapFilterBar, { MapFilter } from './MapFilterBar';
import MapContactMarker from './MapContactMarker';
import MapRadiusRings from './MapRadiusRings';
import MapContactPanel from './MapContactPanel';
import MapCircleOverlay from './MapCircleOverlay';

interface ContactMapViewProps {
  contacts: Contact[];
  circles: ContactCircle[];
  isDarkMode: boolean;
  userId: string;
  onContactAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onContactUpdated?: (updated: Contact) => void;
}

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 }; // SF fallback
const DEFAULT_ZOOM = 11;

const ContactMapView: React.FC<ContactMapViewProps> = ({
  contacts,
  circles,
  isDarkMode,
  userId,
  onContactAction,
  onContactUpdated,
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'pulse-google-maps',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedLocType, setSelectedLocType] = useState<'home' | 'work'>('home');
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [liveLocations, setLiveLocations] = useState<Map<string, UserLocation>>(new Map());
  const [filter, setFilter] = useState<MapFilter>({
    circles: [],
    status: [],
    locationType: 'all',
    searchQuery: '',
  });

  // Sync when parent contacts update
  useEffect(() => { setLocalContacts(contacts); }, [contacts]);

  // Get user's position on mount
  useEffect(() => {
    getCurrentUserLocation()
      .then(pos => setUserPosition(pos))
      .catch(() => {}); // silently ignore denied
  }, []);

  // Batch geocode contacts that have address text but no lat/lng
  useEffect(() => {
    const needsGeocode = localContacts.filter(
      c => (c.address || c.homeAddress) && !c.homeLat && !c.workLat
    );
    if (needsGeocode.length === 0) return;

    geocodeContactsBatch(needsGeocode).then(results => {
      results.forEach(async (coords, contactId) => {
        const contact = needsGeocode.find(c => c.id === contactId);
        if (!contact) return;
        const address = contact.homeAddress || contact.address || '';
        await saveContactLocation(contactId, 'home', coords.lat, coords.lng, address);
        setLocalContacts(prev =>
          prev.map(c => c.id === contactId
            ? { ...c, homeLat: coords.lat, homeLng: coords.lng, homeAddress: address }
            : c
          )
        );
      });
    });
  }, []); // run once on mount

  // Subscribe to live locations for linked Pulse users
  useEffect(() => {
    const linked = localContacts.filter(c => c.pulseUserId);
    const unsubs: Array<() => void> = [];
    linked.forEach(c => {
      const unsub = subscribeToUserLocation(c.pulseUserId!, loc => {
        setLiveLocations(prev => new Map(prev).set(c.id, loc));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(fn => fn());
  }, [localContacts]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Fit map to all visible markers on first load
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const points: Array<{ lat: number; lng: number }> = [];
    localContacts.forEach(c => {
      if (c.homeLat != null && c.homeLng != null) points.push({ lat: c.homeLat, lng: c.homeLng });
      if (c.workLat != null && c.workLng != null) points.push({ lat: c.workLat, lng: c.workLng });
    });
    if (userPosition) points.push(userPosition);
    const bounds = computeBounds(points);
    if (bounds) mapRef.current.fitBounds(bounds, 80);
  }, [isLoaded, localContacts, userPosition]);

  // Build filtered visible contacts + their location type
  type MarkerData = { contact: Contact; locType: 'home' | 'work'; lat: number; lng: number };

  const visibleMarkers = useMemo<MarkerData[]>(() => {
    const q = filter.searchQuery.toLowerCase();
    return localContacts.flatMap(c => {
      if (q && !c.name.toLowerCase().includes(q)) return [];
      if (filter.status.length > 0 && !filter.status.includes(c.status)) return [];
      if (filter.circles.length > 0) {
        const inCircle = circles.some(
          circle => filter.circles.includes(circle.id) && circle.memberContactIds.includes(c.id)
        );
        if (!inCircle) return [];
      }

      const markers: MarkerData[] = [];
      if (
        (filter.locationType === 'all' || filter.locationType === 'home') &&
        c.homeLat != null && c.homeLng != null
      ) {
        markers.push({ contact: c, locType: 'home', lat: c.homeLat, lng: c.homeLng });
      }
      if (
        (filter.locationType === 'all' || filter.locationType === 'work') &&
        c.workLat != null && c.workLng != null
      ) {
        markers.push({ contact: c, locType: 'work', lat: c.workLat, lng: c.workLng });
      }
      return markers;
    });
  }, [localContacts, filter, circles]);

  const selectedContact = localContacts.find(c => c.id === selectedContactId) ?? null;

  const handleContactUpdated = useCallback((updated: Contact) => {
    setLocalContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
    onContactUpdated?.(updated);
  }, [onContactUpdated]);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center h-full text-sm ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
        <i className="fa-solid fa-triangle-exclamation mr-2" />
        Failed to load Google Maps. Check your API key.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <i className="fa-solid fa-map-location-dot text-3xl text-rose-400 motion-safe:animate-pulse" />
        <p className="text-sm">Loading map…</p>
      </div>
    );
  }

  const hasNoLocations = visibleMarkers.length === 0;

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl">
      {/* Filter bar */}
      <MapFilterBar
        filter={filter}
        circles={circles}
        isDarkMode={isDarkMode}
        onFilterChange={setFilter}
      />

      {/* Google Map */}
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={userPosition ?? DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        options={getMapOptions(isDarkMode)}
        onLoad={onMapLoad}
        onClick={() => { setSelectedContactId(null); setSelectedCircleId(null); }}
      >
        {/* Proximity radius rings */}
        {userPosition && (
          <MapRadiusRings center={userPosition} isDarkMode={isDarkMode} />
        )}

        {/* Circle territory overlays */}
        {circles.map(circle => (
          <MapCircleOverlay
            key={circle.id}
            circle={circle}
            contacts={localContacts}
            isSelected={selectedCircleId === circle.id}
            isDarkMode={isDarkMode}
            onClick={() => setSelectedCircleId(
              selectedCircleId === circle.id ? null : circle.id
            )}
          />
        ))}

        {/* Contact markers */}
        {visibleMarkers.map(({ contact, locType, lat, lng }) => {
          const live = liveLocations.get(contact.id);
          return (
            <MapContactMarker
              key={`${contact.id}-${locType}`}
              contact={contact}
              locationType={locType}
              lat={lat}
              lng={lng}
              isSelected={selectedContactId === contact.id && selectedLocType === locType}
              isLive={!!live && live.isSharing}
              liveLocation={live}
              onClick={() => {
                setSelectedContactId(contact.id);
                setSelectedLocType(locType);
              }}
            />
          );
        })}
      </GoogleMap>

      {/* Empty state overlay */}
      {hasNoLocations && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className={`rounded-2xl px-6 py-5 text-center shadow-lg backdrop-blur-2xl border ${isDarkMode ? 'bg-black/85 border-white/10' : 'bg-white/85 border-gray-200'}`}>
            <i className={`fa-solid fa-map-pin text-3xl mb-2 ${isDarkMode ? 'text-rose-500/60' : 'text-gray-300'}`} />
            <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>No locations to show</p>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {localContacts.some(c => c.address)
                ? 'Geocoding addresses…'
                : 'Click a contact → "Set Location" to add them to the map'}
            </p>
          </div>
        </div>
      )}

      {/* Contact detail panel */}
      {selectedContact && (
        <MapContactPanel
          contact={selectedContact}
          locationType={selectedLocType}
          circles={circles}
          userPosition={userPosition}
          liveLocation={liveLocations.get(selectedContact.id)}
          myUserId={userId}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedContactId(null)}
          onAction={onContactAction}
          onContactUpdated={handleContactUpdated}
        />
      )}

      {/* Contact count badge */}
      <div
        className={`absolute bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold shadow backdrop-blur-sm ${
          isDarkMode ? 'bg-gray-900/80 text-gray-300' : 'bg-white/80 text-gray-600'
        }`}
      >
        <i className="fa-solid fa-users mr-1.5 text-rose-400" />
        {visibleMarkers.length} location{visibleMarkers.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default ContactMapView;

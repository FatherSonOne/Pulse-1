import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { AlertTriangle, MapPin, MapPinned, Users } from 'lucide-react';
import { AppView, Contact } from '../../../types';
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
import LocationEditModal from './LocationEditModal';

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
  const [showAddLocationPicker, setShowAddLocationPicker] = useState(false);
  const [pickerContactId, setPickerContactId] = useState<string | null>(null);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [geoBannerDismissed, setGeoBannerDismissed] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('pulse:map:geo-banner-dismissed') === '1';
  });

  const dismissGeoBanner = useCallback(() => {
    setGeoBannerDismissed(true);
    try { localStorage.setItem('pulse:map:geo-banner-dismissed', '1'); } catch {
      // localStorage unavailable — banner stays dismissed for the session via state.
    }
  }, []);

  // Sync when parent contacts update
  useEffect(() => { setLocalContacts(contacts); }, [contacts]);

  // Get user's position on mount. PERMISSION_DENIED (code 1) surfaces the
  // banner; POSITION_UNAVAILABLE / TIMEOUT just leave userPosition null.
  useEffect(() => {
    getCurrentUserLocation()
      .then(pos => setUserPosition(pos))
      .catch((err: unknown) => {
        if (
          err && typeof err === 'object' && 'code' in err &&
          (err as GeolocationPositionError).code === 1
        ) {
          setGeoBlocked(true);
        }
      });
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
      <div className={`flex flex-col items-center justify-center h-full gap-3 text-sm ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} />
          Failed to load Google Maps. Check your API key.
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('pulse:navigate', {
            detail: { view: AppView.SETTINGS, section: 'integrations' },
          }))}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 transition-colors"
        >
          Open Settings
        </button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <MapPinned size={32} className="text-rose-500 motion-safe:animate-pulse" />
        <p className="text-sm">Loading map…</p>
      </div>
    );
  }

  const pickerContact = pickerContactId
    ? localContacts.find(c => c.id === pickerContactId) ?? null
    : null;
  const contactsWithoutLocations = localContacts.filter(
    c => c.homeLat == null && c.workLat == null
  );

  const hasNoLocations = visibleMarkers.length === 0;

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl">
      {/* Single entrance animation for the side panel; the rest of the
          map relies on motion-safe Tailwind utilities. */}
      <style>{`
        @keyframes contactsMapPanelEnter {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .contacts-map-panel-enter {
          animation: contactsMapPanelEnter 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .contacts-map-panel-enter { animation: none; }
        }
      `}</style>

      {/* Filter bar */}
      <MapFilterBar
        filter={filter}
        circles={circles}
        isDarkMode={isDarkMode}
        onFilterChange={setFilter}
        geoBlocked={geoBlocked && !geoBannerDismissed}
        onDismissGeoBanner={dismissGeoBanner}
        userId={userId}
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

      {/* Empty state overlay — geocoding-in-progress shows quietly; the
          true empty case offers an immediate path to add a location. */}
      {hasNoLocations && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className={`rounded-2xl px-6 py-5 text-center shadow-lg backdrop-blur-2xl border max-w-sm pointer-events-auto ${
              isDarkMode ? 'bg-black/85 border-white/10' : 'bg-white/90 border-gray-200'
            }`}
          >
            <MapPin
              size={32}
              className={`mx-auto mb-3 ${isDarkMode ? 'text-rose-500/70' : 'text-rose-500/60'}`}
            />
            {localContacts.some(c => c.address) ? (
              <>
                <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Geocoding addresses…
                </p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Pins will appear once Google resolves the addresses.
                </p>
              </>
            ) : (
              <>
                <p className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Pin your network to the map
                </p>
                <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Add a home or work location to a contact to see them here.
                  Distance, routes, and circles light up once you have a few pins.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddLocationPicker(true)}
                  disabled={contactsWithoutLocations.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MapPin size={14} />
                  Add a contact location
                </button>
              </>
            )}
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
        className={`absolute bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold shadow backdrop-blur-sm flex items-center gap-1.5 ${
          isDarkMode ? 'bg-gray-900/80 text-gray-300' : 'bg-white/80 text-gray-600'
        }`}
      >
        <Users size={12} className="text-rose-500" />
        {visibleMarkers.length} location{visibleMarkers.length !== 1 ? 's' : ''}
      </div>

      {/* Pick-a-contact-to-locate dialog (empty-state CTA target) */}
      {showAddLocationPicker && (
        <ContactLocationPickerOverlay
          contacts={contactsWithoutLocations}
          isDarkMode={isDarkMode}
          onClose={() => setShowAddLocationPicker(false)}
          onPick={(id) => {
            setShowAddLocationPicker(false);
            setPickerContactId(id);
          }}
        />
      )}

      {pickerContact && (
        <LocationEditModal
          contact={pickerContact}
          isOpen={true}
          isDarkMode={isDarkMode}
          onClose={() => setPickerContactId(null)}
          onSave={(updated) => {
            handleContactUpdated(updated);
            setPickerContactId(null);
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// Contact picker overlay (empty-state path)
// Inline because it's tightly coupled to the empty state and not
// reused elsewhere; modal feels heavy here.
// ============================================================

interface ContactLocationPickerOverlayProps {
  contacts: Contact[];
  isDarkMode: boolean;
  onClose: () => void;
  onPick: (contactId: string) => void;
}

const ContactLocationPickerOverlay: React.FC<ContactLocationPickerOverlayProps> = ({
  contacts,
  isDarkMode,
  onClose,
  onPick,
}) => {
  const [query, setQuery] = useState('');
  const filtered = contacts.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase())
  );

  // Focus trap + escape-to-close. Captures Tab/Shift+Tab at the boundaries
  // and cycles within the modal so keyboard users can't tab into the map
  // behind the dialog.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pick a contact to locate"
    >
      <div
        ref={containerRef}
        className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden ${
          isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`px-5 py-4 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
          <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Pick a contact to locate
          </h3>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className={`mt-3 w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors ${
              isDarkMode
                ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-rose-500'
                : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
            }`}
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className={`px-5 py-8 text-sm text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              No contacts match your search.
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                  isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: c.avatarColor || '#f43f5e' }}
                >
                  {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {c.name}
                  </p>
                  {c.role && (
                    <p className={`text-xs truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {c.role}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactMapView;

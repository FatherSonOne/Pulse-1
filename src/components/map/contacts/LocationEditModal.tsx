import React, { useRef, useState } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import { Briefcase, Home, Loader2, X } from 'lucide-react';
import { Contact } from '../../../types';
import { saveContactLocation, clearContactLocation } from '../../../services/locationService';
import { useGoogleMapsLoader } from '../hooks/useGoogleMapsLoader';
import { useMapLibreRenderer } from '../provider/useMapLibreRenderer';
import GeoSearchInput from '../sub/GeoSearchInput';
import type { GeoSearchResult } from '../../../services/geosearchService';

interface LocationEditModalProps {
  contact: Contact;
  isOpen: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  /** Updated contact. `previousId` is set when the save promoted a virtual
   *  (Google / Vision) contact into the DB and the id changed — callers
   *  matching by id need that to find the right row in their cache. */
  onSave: (updated: Contact, previousId?: string) => void;
}

// Sensible defaults so first-time users get geofence behaviour without
// touching the slider. Home is tighter than work because home is more
// precise (apartment vs. office building footprint).
const DEFAULT_RADIUS_M: Record<'home' | 'work', number> = {
  home: 75,
  work: 150,
};

const RADIUS_MIN_M = 25;
const RADIUS_MAX_M = 1000;

function formatRadius(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────
// LocationField + GeofenceControl live at module scope on purpose. They were
// previously defined inside LocationEditModal, which gave them a new function
// identity on every render — that made React unmount the <Autocomplete> on
// every state change, wiping the input value and discarding the autocomplete
// instance. The user-visible symptom was "I pick a suggestion and the input
// goes blank." Module-scope means the component type is stable and React
// just rebinds listeners as props change.

interface GeofenceControlProps {
  kind: 'home' | 'work';
  isOn: boolean;
  radius: number;
  isDarkMode: boolean;
  onToggle: (v: boolean) => void;
  onRadiusChange: (m: number) => void;
}

const GeofenceControl: React.FC<GeofenceControlProps> = ({
  kind,
  isOn,
  radius,
  isDarkMode,
  onToggle,
  onRadiusChange,
}) => {
  const subLabel = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        isDarkMode ? 'bg-white/5' : 'bg-rose-50/50 border border-rose-100/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <label className={`text-xs font-semibold flex items-center gap-1.5 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
          <span aria-hidden>📍</span>
          Arrival alerts
        </label>
        <button
          type="button"
          onClick={() => onToggle(!isOn)}
          aria-pressed={isOn}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            isOn ? 'bg-rose-500' : isDarkMode ? 'bg-white/15' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              isOn ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {isOn && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase tracking-wider ${subLabel}`}>Radius</span>
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              {formatRadius(radius)}
            </span>
          </div>
          <input
            type="range"
            min={RADIUS_MIN_M}
            max={RADIUS_MAX_M}
            step={25}
            value={radius}
            onChange={e => onRadiusChange(Number(e.target.value))}
            className="w-full accent-rose-500"
            aria-label={`${kind} geofence radius in meters`}
          />
          <p className={`text-[10px] ${subLabel}`}>
            You'll be notified when entering, approaching, or leaving this area.
          </p>
        </div>
      )}
    </div>
  );
};

interface LocationFieldProps {
  type: 'home' | 'work';
  label: string;
  currentAddress?: string;
  autocompleteRef: React.MutableRefObject<google.maps.places.Autocomplete | null>;
  inputRef: React.RefObject<HTMLInputElement>;
  isDarkMode: boolean;
  /** Maps JS + Places library ready. Until true we MUST NOT mount
   *  <Autocomplete> — it reads google.maps.places in componentDidMount and
   *  throws if the script hasn't loaded (Contacts mounts no map, so the
   *  loader would otherwise never have run). */
  isLoaded: boolean;
  loadError?: Error;
  onPlaceChanged: () => void;
  onClear: () => void;
  /** MapLibre path — use the non-Google geosearch instead of <Autocomplete>. */
  mapLibreOn: boolean;
  onGeoSelect: (r: GeoSearchResult) => void;
}

const LocationField: React.FC<LocationFieldProps> = ({
  type,
  label,
  currentAddress,
  autocompleteRef,
  inputRef,
  isDarkMode,
  isLoaded,
  loadError,
  onPlaceChanged,
  onClear,
  mapLibreOn,
  onGeoSelect,
}) => {
  const Icon = type === 'home' ? Home : Briefcase;
  const inputCls = isDarkMode
    ? 'bg-white/5 border-white/15 text-white placeholder-gray-500 focus:border-rose-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-rose-500';
  const labelCls = isDarkMode ? 'text-white' : 'text-gray-900';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={`text-sm font-semibold flex items-center gap-1.5 ${labelCls}`}>
          <Icon size={14} className="text-rose-500" /> {label}
        </label>
        {currentAddress && (
          <button
            onClick={onClear}
            className="text-xs text-rose-400 hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:underline"
          >
            Clear
          </button>
        )}
      </div>
      {currentAddress && (
        <p className={`text-xs px-3 py-1.5 rounded-lg ${isDarkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
          Current: {currentAddress}
        </p>
      )}
      {mapLibreOn ? (
        <GeoSearchInput
          isDarkMode={isDarkMode}
          placeholder={`Search for ${label.toLowerCase()} address…`}
          onSelect={onGeoSelect}
          inputClassName={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${inputCls}`}
        />
      ) : isLoaded ? (
        <Autocomplete
          onLoad={a => { autocompleteRef.current = a; }}
          onPlaceChanged={onPlaceChanged}
          options={{ types: ['address'] }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder={`Search for ${label.toLowerCase()} address...`}
            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${inputCls}`}
          />
        </Autocomplete>
      ) : (
        <input
          ref={inputRef}
          type="text"
          disabled
          placeholder={loadError ? 'Address search unavailable' : 'Loading address search…'}
          className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors opacity-70 ${inputCls}`}
        />
      )}
    </div>
  );
};

const LocationEditModal: React.FC<LocationEditModalProps> = ({
  contact,
  isOpen,
  isDarkMode,
  onClose,
  onSave,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load (and gate on) the Maps JS + Places library here. Contacts mounts no
  // <GoogleMap>, so without this call the loader never runs and <Autocomplete>
  // throws on mount. Shares the 'pulse-google-maps' loader id, so this is a
  // no-op join when a map elsewhere already triggered the load.
  const { isLoaded, loadError } = useGoogleMapsLoader();
  // MapLibre path → non-Google geosearch (the geocodes land on the map, so they
  // must be OSM-derived, not Google Places). OFF → Google Autocomplete as before.
  const mapLibreOn = useMapLibreRenderer();

  const homeRef = useRef<google.maps.places.Autocomplete | null>(null);
  const workRef = useRef<google.maps.places.Autocomplete | null>(null);
  const homeInputRef = useRef<HTMLInputElement>(null);
  const workInputRef = useRef<HTMLInputElement>(null);

  const [homePending, setHomePending] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [workPending, setWorkPending] = useState<{ lat: number; lng: number; address: string } | null>(null);

  // Geofence toggles + radii (per location). Default ON so newly-saved
  // locations come with arrival detection by default.
  const [homeGeofenceOn, setHomeGeofenceOn] = useState(true);
  const [workGeofenceOn, setWorkGeofenceOn] = useState(true);
  const [homeRadius, setHomeRadius] = useState(DEFAULT_RADIUS_M.home);
  const [workRadius, setWorkRadius] = useState(DEFAULT_RADIUS_M.work);

  if (!isOpen) return null;

  const bg = isDarkMode ? 'bg-black/90 backdrop-blur-xl border-white/10' : 'bg-white border-gray-200';
  const text = isDarkMode ? 'text-white' : 'text-gray-900';
  const sub = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  const handlePlaceChanged = (
    type: 'home' | 'work',
    _ref: React.MutableRefObject<google.maps.places.Autocomplete | null>
  ) => {
    const autocomplete = type === 'home' ? homeRef.current : workRef.current;
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || '';
    if (type === 'home') {
      setHomePending({ lat, lng, address });
      if (homeInputRef.current) homeInputRef.current.value = address;
    } else {
      setWorkPending({ lat, lng, address });
      if (workInputRef.current) workInputRef.current.value = address;
    }
  };

  // MapLibre-path selection — the geosearch result already carries lat/lng +
  // a composed address, so feed it straight into the same pending state. The
  // controlled GeoSearchInput shows the chosen label itself (no input ref).
  const handleGeoSelect = (type: 'home' | 'work', r: GeoSearchResult) => {
    const pending = { lat: r.lat, lng: r.lng, address: r.address || r.name || '' };
    if (type === 'home') setHomePending(pending);
    else setWorkPending(pending);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let updated = { ...contact };
      let canonicalId = contact.id;
      if (homePending) {
        canonicalId = await saveContactLocation(
          updated,
          'home',
          homePending.lat,
          homePending.lng,
          homePending.address,
          homeGeofenceOn ? homeRadius : null
        );
        updated = {
          ...updated,
          id: canonicalId,
          homeLat: homePending.lat,
          homeLng: homePending.lng,
          homeAddress: homePending.address,
        };
      }
      if (workPending) {
        canonicalId = await saveContactLocation(
          updated,
          'work',
          workPending.lat,
          workPending.lng,
          workPending.address,
          workGeofenceOn ? workRadius : null
        );
        updated = {
          ...updated,
          id: canonicalId,
          workLat: workPending.lat,
          workLng: workPending.lng,
          workAddress: workPending.address,
        };
      }
      // Trigger geofence cache refresh so the new place is picked up on
      // the next location tick. Lazy import — service may not be loaded
      // yet if the user never opened sharing.
      try {
        const mod = await import('../../../services/geofenceService');
        await mod.refreshGeofences();
      } catch { /* geofence service inactive — no-op */ }
      // Pass the original id back so the parent's local-state matcher can
      // find the row even when the save promoted the contact (id changed).
      onSave(updated, contact.id !== canonicalId ? contact.id : undefined);
    } catch (e) {
      setError('Failed to save location. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (type: 'home' | 'work') => {
    try {
      await clearContactLocation(contact.id, type);
      const updated = type === 'home'
        ? { ...contact, homeLat: undefined, homeLng: undefined, homeAddress: undefined }
        : { ...contact, workLat: undefined, workLng: undefined, workAddress: undefined };
      onSave(updated);
    } catch (e) {
      setError('Failed to clear location.');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${bg}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className={`text-base font-bold ${text}`}>Set Locations</h2>
            <p className={`text-xs mt-0.5 ${sub}`}>{contact.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X size={14} />
          </button>
        </div>

        <div className={`mx-5 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`} />

        {/* Fields */}
        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <LocationField
              type="home"
              label="Home"
              currentAddress={contact.homeAddress}
              autocompleteRef={homeRef}
              inputRef={homeInputRef}
              isDarkMode={isDarkMode}
              isLoaded={isLoaded}
              loadError={loadError}
              onPlaceChanged={() => handlePlaceChanged('home', homeRef)}
              onClear={() => handleClear('home')}
              mapLibreOn={mapLibreOn}
              onGeoSelect={(r) => handleGeoSelect('home', r)}
            />
            <GeofenceControl
              kind="home"
              isOn={homeGeofenceOn}
              radius={homeRadius}
              isDarkMode={isDarkMode}
              onToggle={setHomeGeofenceOn}
              onRadiusChange={setHomeRadius}
            />
          </div>

          <div className="space-y-2">
            <LocationField
              type="work"
              label="Work"
              currentAddress={contact.workAddress}
              autocompleteRef={workRef}
              inputRef={workInputRef}
              isDarkMode={isDarkMode}
              isLoaded={isLoaded}
              loadError={loadError}
              onPlaceChanged={() => handlePlaceChanged('work', workRef)}
              onClear={() => handleClear('work')}
              mapLibreOn={mapLibreOn}
              onGeoSelect={(r) => handleGeoSelect('work', r)}
            />
            <GeofenceControl
              kind="work"
              isOn={workGeofenceOn}
              radius={workRadius}
              isDarkMode={isDarkMode}
              onToggle={setWorkGeofenceOn}
              onRadiusChange={setWorkRadius}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-2 px-5 pb-5`}>
          <button
            onClick={onClose}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!homePending && !workPending)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 inline-flex items-center justify-center gap-1.5"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            Save Locations
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationEditModal;

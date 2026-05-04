// ============================================================
// PlacePicker — reusable place dropdown for any entity that can
// attach to a place via entity_places (task, decision, event,
// meeting). Issue #35 / Stream B1.
//
// Reads/writes through the universal Place schema only — no
// property-soup columns. The picker fetches:
//   * the currently-linked place for (entityType, entityId, role)
//   * the user's saved places (RLS scopes to personal + workspace)
// and lets the operator pick an existing one OR drop a new one
// in via Google Places Autocomplete.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { ChevronDown, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { GOOGLE_MAPS_LIBRARIES } from '../../services/mapService';
import {
  attachPlaceToEntity,
  createPlace,
  detachPlaceFromEntity,
  getPlacesForEntity,
  listUserPlaces,
} from '../../services/locationService';
import { Place, PlaceEntityType, PlaceRole } from '../../types/placeTypes';

interface PlacePickerProps {
  /** entity_places.entity_type — contacts use their own surface, so excluded. */
  entityType: Exclude<PlaceEntityType, 'contact'>;
  entityId: string;
  /** Role this place plays for the entity (tasks: 'primary', decisions: 'venue'). */
  role: PlaceRole;
  isDarkMode?: boolean;
  /** Fires after a successful attach / detach. */
  onChange?: (place: Place | null) => void;
}

const PlacePicker: React.FC<PlacePickerProps> = ({
  entityType,
  entityId,
  role,
  isDarkMode = false,
  onChange,
}) => {
  const { isLoaded } = useJsApiLoader({
    id: 'pulse-google-maps',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [attached, setAttached] = useState<Place | null>(null);
  const [available, setAvailable] = useState<Place[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [linked, all] = await Promise.all([
      getPlacesForEntity(entityType, entityId),
      listUserPlaces(),
    ]);
    setAttached(linked.find(p => p.role === role) ?? null);
    setAvailable(all);
  }, [entityType, entityId, role]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [isOpen]);

  const filtered = search.trim()
    ? available.filter(p => {
        const haystack = `${p.name ?? ''} ${p.address ?? ''}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
    : available;

  const handlePick = async (place: Place) => {
    if (busy) return;
    setBusy(true);
    try {
      if (attached && attached.id !== place.id) {
        await detachPlaceFromEntity(entityType, entityId, role);
      }
      await attachPlaceToEntity(entityType, entityId, place.id, role);
      setAttached(place);
      onChange?.(place);
      setIsOpen(false);
    } catch (err) {
      console.error('[PlacePicker] handlePick failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (busy || !attached) return;
    setBusy(true);
    try {
      await detachPlaceFromEntity(entityType, entityId, role);
      setAttached(null);
      onChange?.(null);
      setIsOpen(false);
    } catch (err) {
      console.error('[PlacePicker] handleRemove failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handlePlaceChanged = async () => {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const result = ac.getPlace();
    if (!result.geometry?.location) return;
    const lat = result.geometry.location.lat();
    const lng = result.geometry.location.lng();
    const address = result.formatted_address ?? '';
    const name = result.name ?? null;
    setBusy(true);
    try {
      const created = await createPlace({ lat, lng, address, name, type: 'custom' });
      setAvailable(prev => [created, ...prev]);
      if (attached) {
        await detachPlaceFromEntity(entityType, entityId, role);
      }
      await attachPlaceToEntity(entityType, entityId, created.id, role);
      setAttached(created);
      onChange?.(created);
      setIsOpen(false);
    } catch (err) {
      console.error('[PlacePicker] handlePlaceChanged failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
          isDarkMode
            ? 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <MapPin size={14} className="text-rose-500 flex-shrink-0" />
          <span className="truncate text-left">
            {attached
              ? (attached.name || attached.address || 'Saved place')
              : 'Add a location'}
          </span>
        </span>
        <ChevronDown size={14} className="flex-shrink-0 opacity-70" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Pick a location"
          className={`absolute z-50 mt-1 w-full max-h-[420px] flex flex-col rounded-xl shadow-2xl border overflow-hidden ${
            isDarkMode ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200'
          }`}
        >
          <div className={`p-2.5 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2">
              <Search size={14} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
              <input
                type="text"
                placeholder="Search saved places…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                className={`flex-1 text-sm bg-transparent outline-none ${
                  isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {filtered.length > 0 ? (
              filtered.map(p => {
                const isAttached = attached?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePick(p)}
                    disabled={busy}
                    className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:bg-rose-500/10 ${
                      isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    } ${isAttached ? (isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50') : ''}`}
                  >
                    <MapPin
                      size={12}
                      className={`mt-1 flex-shrink-0 ${isAttached ? 'text-rose-500' : (isDarkMode ? 'text-gray-500' : 'text-gray-400')}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {p.name || p.address || 'Saved place'}
                      </p>
                      {p.name && p.address && (
                        <p className={`text-xs truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {p.address}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className={`px-3 py-4 text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {search ? 'No saved places match.' : 'No saved places yet.'}
              </p>
            )}
          </div>

          <div className={`p-2.5 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-100'}`}>
            <label
              className={`flex items-center gap-1 mb-1.5 text-[11px] uppercase tracking-[0.1em] font-medium ${
                isDarkMode ? 'text-gray-500' : 'text-gray-400'
              }`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <Plus size={10} /> Add new place
            </label>
            {isLoaded ? (
              <Autocomplete
                onLoad={a => { autocompleteRef.current = a; }}
                onPlaceChanged={handlePlaceChanged}
                options={{ types: ['geocode', 'establishment'] }}
              >
                <input
                  type="text"
                  placeholder="Search address or place…"
                  className={`w-full text-sm px-2.5 py-1.5 rounded-lg border outline-none transition-colors ${
                    isDarkMode
                      ? 'bg-white/5 border-white/15 text-white placeholder-gray-500 focus:border-rose-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-500'
                  }`}
                />
              </Autocomplete>
            ) : (
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Loading geocoder…
              </p>
            )}
          </div>

          {attached && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border-t transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:bg-red-500/10 ${
                isDarkMode
                  ? 'text-red-400 hover:bg-red-500/10 border-white/10'
                  : 'text-red-500 hover:bg-red-50 border-gray-100'
              }`}
            >
              <Trash2 size={12} /> Remove location
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PlacePicker;

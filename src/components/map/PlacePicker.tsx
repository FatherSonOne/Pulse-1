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
  setPlaceGeofence,
} from '../../services/locationService';
import { Place, PlaceEntityType, PlaceRole } from '../../types/placeTypes';

// Default radius per entity type. Tasks fire when you reach the task site
// (tight); decisions/meetings/events when you enter the venue (looser).
const DEFAULT_GEOFENCE_RADIUS_M: Record<Exclude<PlaceEntityType, 'contact'>, number> = {
  task: 100,
  decision: 200,
  meeting: 150,
  event: 200,
};

const RADIUS_MIN_M = 25;
const RADIUS_MAX_M = 2000;

function formatRadius(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

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
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dedupe key: case-folded name + lat/lng rounded to ~1m. Rows without coords
  // fall back to the row id so they never collapse against each other. We
  // can't trust the table to be clean — RLS + sync from multiple devices
  // yields dupes in practice; the picker is the last UI before the user.
  const dedupePlaces = (rows: Place[], attachedId?: string | null): { unique: Place[]; hiddenCount: number } => {
    const seen = new Map<string, Place>();
    for (const p of rows) {
      const hasCoords = typeof p.lat === 'number' && typeof p.lng === 'number';
      const key = hasCoords
        ? `${(p.name ?? '').trim().toLowerCase()}|${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
        : `id:${p.id}`;
      const existing = seen.get(key);
      // Survival order: attached > geofence-configured > first seen. This
      // keeps the currently-attached row visible regardless of which dupe
      // happens to come back first from the service.
      if (!existing) {
        seen.set(key, p);
        continue;
      }
      const pAttached = !!attachedId && p.id === attachedId;
      const eAttached = !!attachedId && existing.id === attachedId;
      if (pAttached && !eAttached) {
        seen.set(key, p);
      } else if (!eAttached && p.geofenceRadiusM != null && existing.geofenceRadiusM == null) {
        seen.set(key, p);
      }
    }
    return { unique: Array.from(seen.values()), hiddenCount: rows.length - seen.size };
  };

  const refresh = useCallback(async () => {
    const [linked, all] = await Promise.all([
      getPlacesForEntity(entityType, entityId),
      listUserPlaces(),
    ]);
    const newAttached = linked.find(p => p.role === role) ?? null;
    setAttached(newAttached);
    const { unique, hiddenCount } = dedupePlaces(all, newAttached?.id ?? null);
    setAvailable(unique);
    setDuplicateCount(hiddenCount);
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

  const handleSetGeofence = useCallback(async (radius: number | null) => {
    if (!attached) return;
    try {
      await setPlaceGeofence(attached.id, radius);
      setAttached(prev => prev ? { ...prev, geofenceRadiusM: radius } : prev);
      // Refresh the geofence detection cache so the change is picked up
      // on the next position tick without needing a reload.
      try {
        const mod = await import('../../services/geofenceService');
        await mod.refreshGeofences();
      } catch { /* geofence module inactive — no-op */ }
    } catch (err) {
      console.error('[PlacePicker] setPlaceGeofence failed:', err);
    }
  }, [attached]);

  const defaultRadius = DEFAULT_GEOFENCE_RADIUS_M[entityType];
  const geofenceOn = (attached?.geofenceRadiusM ?? null) != null;
  const currentRadius = attached?.geofenceRadiusM ?? defaultRadius;

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

      {/* Geofence controls — only meaningful once a place is attached. */}
      {attached && (
        <div
          className={`mt-1.5 rounded-lg border px-3 py-2 ${
            isDarkMode
              ? 'bg-white/[0.03] border-white/10'
              : 'bg-rose-50/40 border-rose-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <label className={`text-xs font-semibold flex items-center gap-1.5 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              <span aria-hidden>📍</span>
              {entityType === 'task' ? 'Arrival = ready to complete' : 'Arrival alerts'}
            </label>
            <button
              type="button"
              onClick={() => handleSetGeofence(geofenceOn ? null : defaultRadius)}
              aria-pressed={geofenceOn}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                geofenceOn ? 'bg-rose-500' : isDarkMode ? 'bg-white/15' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  geofenceOn ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {geofenceOn && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-wider ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  Radius
                </span>
                <span className={`text-xs font-medium ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  {formatRadius(currentRadius)}
                </span>
              </div>
              <input
                type="range"
                min={RADIUS_MIN_M}
                max={RADIUS_MAX_M}
                step={25}
                value={currentRadius}
                onChange={e => {
                  const next = Number(e.target.value);
                  // Optimistic local update then persist so the slider feels live.
                  setAttached(prev => prev ? { ...prev, geofenceRadiusM: next } : prev);
                }}
                onMouseUp={e => handleSetGeofence(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={e => handleSetGeofence(Number((e.target as HTMLInputElement).value))}
                className="w-full accent-rose-500"
                aria-label={`${entityType} geofence radius in meters`}
              />
              <p className={`text-[10px] ${
                isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>
                {entityType === 'task'
                  ? "When you arrive, Today surfaces the task with a complete prompt."
                  : "You'll be notified when you arrive, approach, or leave."}
              </p>
            </div>
          )}
        </div>
      )}

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
              {duplicateCount > 0 && (
                <span
                  // Tinted-neutral, not coral. Duplicate-hidden is a benign
                  // data-quality signal — coral is reserved for state and
                  // urgency (CTA, unread, active, focus). Earlier pass used
                  // rose here; that was coral-as-decoration. Pass-3 fix.
                  className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-[0.1em] uppercase ${
                    isDarkMode
                      ? 'bg-white/[0.04] text-zinc-400 border border-white/5'
                      : 'bg-zinc-100 text-zinc-500 border border-zinc-200/60'
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  title={`${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} hidden from this list. Edit each from its own row to consolidate.`}
                  aria-label={`${duplicateCount} duplicates hidden`}
                >
                  {duplicateCount} hidden
                </span>
              )}
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

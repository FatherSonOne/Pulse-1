// ─────────────────────────────────────────────────────────────────────────────
// GeofencesDrawer — Direction D (Horizon, P9) first-class geofences surface.
//
// A right-side drawer (mirrors the P8 LiveTeamDrawer shell — the established
// Horizon drawer pattern, not the legacy bottom sheet) that:
//   1. HONESTLY surfaces that arrival detection only runs while Live location is
//      broadcasting (geofenceService.processPosition is driven solely by
//      startLocationBroadcast's tick — verified). No background/closed-app claim.
//   2. Toggles the all-geofences ring overlay on the map.
//   3. Lists geofenced places (places.geofence_radius_m != null) and lets the
//      operator adjust the radius (setPlaceGeofence) or remove the geofence.
//   4. Shows recent geofence_events with a "mark reviewed" affordance — the
//      net-new CONSUMER + producer of the previously-dead surfaced/surfaced_at.
//
// Coral=signal-only (CLAUDE.md §4): the rings on the MAP carry coral (live
// signal); this drawer's chrome stays neutral. The "requires Live ON" warning
// uses the established amber banner treatment (matches the geo-blocked banner).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, LogIn, LogOut, MapPin, Navigation, Trash2, X } from 'lucide-react';
import { Place } from '../../../types/placeTypes';
import { setPlaceGeofence } from '../../../services/locationService';
import {
  GeofenceEvent,
  listRecentGeofenceEvents,
  markGeofenceEventSurfaced,
  refreshGeofences,
} from '../../../services/geofenceService';
import { useDialogA11y } from '../sub/useDialogA11y';

export interface GeofencesDrawerProps {
  /** Places with a geofence set (geofenceRadiusM != null), owned by PulseMapView. */
  places: Place[];
  isDarkMode: boolean;
  /** Whether the broadcast watch is live — gates the honest detection banner. */
  isLiveOn: boolean;
  ringsVisible: boolean;
  onToggleRings: (visible: boolean) => void;
  /** Refetch the host's geofenced-places list (drives the ring overlay) after an
   *  edit. Returns a promise so the drawer can await it before re-enabling the
   *  radius controls (keeps the active-preset highlight from flickering stale). */
  onPlacesChanged: () => void | Promise<void>;
  onClose: () => void;
}

// Stepped presets within the DB CHECK bounds (geofence_radius_m integer 10–50000).
const RADIUS_PRESETS_M = [100, 250, 500, 1000, 2000, 5000];

function formatRadius(m: number): string {
  if (m < 1000) return `${m} m`;
  const km = m / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const EVENT_META: Record<GeofenceEvent['eventType'], { Icon: typeof LogIn; label: string }> = {
  enter: { Icon: LogIn, label: 'Arrived' },
  exit: { Icon: LogOut, label: 'Left' },
  approach: { Icon: Navigation, label: 'Nearby' },
};

export const GeofencesDrawer: React.FC<GeofencesDrawerProps> = ({
  places,
  isDarkMode,
  isLiveOn,
  ringsVisible,
  onToggleRings,
  onPlacesChanged,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useDialogA11y({ containerRef: panelRef, onClose, initialFocusRef: closeBtnRef });

  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const list = await listRecentGeofenceEvents();
      if (active) {
        setEvents(list);
        setEventsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const placeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of places) m.set(p.id, p.name || p.address || 'Geofenced place');
    return m;
  }, [places]);

  const handleSetRadius = async (placeId: string, radiusM: number | null) => {
    setSavingId(placeId);
    try {
      await setPlaceGeofence(placeId, radiusM);
      // Let an in-flight detection session pick up the change immediately
      // (no-op when no broadcast is running).
      await refreshGeofences().catch(() => { /* best effort */ });
      // Await the host refetch so the active-preset highlight reflects the new
      // radius before the buttons re-enable (no stale flicker).
      await onPlacesChanged();
    } catch (err) {
      console.error('[GeofencesDrawer] setPlaceGeofence failed:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkReviewed = async (eventId: string) => {
    // Optimistic — the row goes muted immediately; reconcile on failure.
    const stamp = new Date().toISOString();
    setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, surfaced: true, surfacedAt: stamp } : e)));
    try {
      await markGeofenceEventSurfaced(eventId);
    } catch (err) {
      console.error('[GeofencesDrawer] markGeofenceEventSurfaced failed:', err);
      setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, surfaced: false, surfacedAt: null } : e)));
    }
  };

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
  const sectionLabelCls = `text-[10px] tracking-[0.1em] uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`;

  return (
    <div
      className="absolute inset-0 z-30 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="geofences-drawer-title"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md h-full border-l shadow-2xl overflow-hidden flex flex-col ${
          isDarkMode ? 'bg-zinc-950 border-white/10 text-gray-200' : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        {/* Header — neutral chrome. */}
        <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${
          isDarkMode ? 'border-white/10' : 'border-gray-100'
        }`}>
          <div className="flex items-center gap-2">
            <MapPin size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} aria-hidden="true" />
            <span id="geofences-drawer-title" className="text-[11px] tracking-[0.1em] uppercase" style={monoStyle}>
              Geofences
            </span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400 focus-visible:ring-zinc-400' : 'hover:bg-gray-100 text-gray-500 focus-visible:ring-zinc-500'
            }`}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Honest dependency banner — detection is broadcast-coupled ──── */}
          {!isLiveOn && (
            <div
              role="status"
              className="flex items-start gap-2 px-4 py-3 text-xs border-b"
              style={{
                backgroundColor: isDarkMode ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                color: isDarkMode ? '#fcd34d' : '#b45309',
              }}
            >
              <span aria-hidden className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
              <span>
                Arrival alerts require <strong>Live location ON</strong>. Geofences only detect enter/exit
                while you're broadcasting — turn on Broadcast to get alerts. The rings below are always real.
              </span>
            </div>
          )}

          {/* ── Show rings toggle ─────────────────────────────────────────── */}
          <section className={`px-4 py-3 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Show rings on map</p>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {places.length > 0 ? `${places.length} geofence${places.length === 1 ? '' : 's'} drawn to scale` : 'No geofences to draw yet'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={ringsVisible}
                aria-label="Show geofence rings on map"
                onClick={() => onToggleRings(!ringsVisible)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
                } ${ringsVisible ? 'bg-rose-500' : isDarkMode ? 'bg-white/15' : 'bg-gray-300'}`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    ringsVisible ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* ── Geofenced places ──────────────────────────────────────────── */}
          <section className={`px-4 py-4 border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
            <div className="mb-3"><span className={sectionLabelCls} style={monoStyle}>Geofenced places</span></div>

            {places.length === 0 ? (
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                No geofences yet. Set a radius on a place (a contact's home/work, a task or event location) to get arrival alerts.
              </p>
            ) : (
              <div className="space-y-3">
                {places.map(place => {
                  const current = place.geofenceRadiusM ?? 0;
                  const saving = savingId === place.id;
                  return (
                    <div
                      key={place.id}
                      className={`rounded-xl border px-3 py-3 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {place.name || place.address || 'Untitled place'}
                          </p>
                          <p className={`text-[11px] truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            {place.address && place.name ? place.address : `radius ${formatRadius(current)}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSetRadius(place.id, null)}
                          disabled={saving}
                          aria-label="Remove geofence"
                          title="Remove geofence"
                          className={`p-1.5 rounded transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 ${
                            isDarkMode ? 'text-gray-400 hover:bg-white/10 focus-visible:ring-zinc-400' : 'text-gray-500 hover:bg-gray-100 focus-visible:ring-zinc-500'
                          }`}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2" role="group" aria-label={`Geofence radius for ${place.name || 'place'}`}>
                        {RADIUS_PRESETS_M.map(m => {
                          const active = current === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => handleSetRadius(place.id, m)}
                              disabled={saving}
                              aria-pressed={active}
                              className={`px-2 py-1 rounded text-[10px] tracking-[0.05em] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 ${
                                isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
                              } ${
                                active
                                  ? (isDarkMode ? 'bg-white/15 text-white' : 'bg-gray-200 text-gray-900')
                                  : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100')
                              }`}
                              style={monoStyle}
                            >
                              {formatRadius(m)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Recent activity ───────────────────────────────────────────── */}
          <section className="px-4 py-4">
            <div className="mb-3"><span className={sectionLabelCls} style={monoStyle}>Recent activity</span></div>

            {eventsLoading ? (
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Loading…</p>
            ) : events.length === 0 ? (
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                No geofence activity yet. {isLiveOn ? 'Enter or leave a geofenced place while broadcasting to see it here.' : 'Turn on Live location to start detecting arrivals.'}
              </p>
            ) : (
              <div className="space-y-2">
                {events.map(ev => {
                  const meta = EVENT_META[ev.eventType] ?? EVENT_META.enter;
                  const Icon = meta.Icon;
                  const placeName = placeNameById.get(ev.placeId) || 'Geofenced place';
                  return (
                    <div
                      key={ev.id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        ev.surfaced ? 'opacity-55' : ''
                      } ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-white'}`}
                    >
                      <Icon size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          <span className="font-medium">{meta.label}</span> · {placeName}
                        </p>
                        <p className={`text-[11px] truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {formatRelative(ev.occurredAt)}
                          {ev.distanceM != null && <span className="opacity-70"> · {Math.round(ev.distanceM)} m</span>}
                          {ev.surfaced && <span className="opacity-70"> · reviewed</span>}
                        </p>
                      </div>
                      {!ev.surfaced && (
                        <button
                          type="button"
                          onClick={() => handleMarkReviewed(ev.id)}
                          aria-label="Mark reviewed"
                          title="Mark reviewed"
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                            isDarkMode ? 'text-gray-300 hover:bg-white/10 focus-visible:ring-zinc-400' : 'text-gray-600 hover:bg-gray-100 focus-visible:ring-zinc-500'
                          }`}
                        >
                          <Check size={12} aria-hidden="true" /> Review
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default GeofencesDrawer;

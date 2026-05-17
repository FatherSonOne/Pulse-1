import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Briefcase, Globe, Home, Radio, Search, X } from 'lucide-react';
import { Contact } from '../../types';
import { ContactCircle } from '../../types/contactCircleTypes';
import {
  startLocationBroadcast,
  stopLocationBroadcast,
  setBroadcastRecipients,
  endBroadcastRecipients,
  getActiveBroadcastRecipientIds,
} from '../../services/locationService';
import BroadcastRecipientPicker from './sub/BroadcastRecipientPicker';

export interface MapFilter {
  circles: string[];
  locationType: 'all' | 'home' | 'work';
  searchQuery: string;
}

interface MapFilterBarProps {
  filter: MapFilter;
  circles: ContactCircle[];
  isDarkMode: boolean;
  onFilterChange: (f: MapFilter) => void;
  geoBlocked?: boolean;
  onDismissGeoBanner?: () => void;
  /** Logged-in user id — drives the personal Live Location broadcast toggle. */
  userId: string;
  /** Optional ref so the parent can focus the search input via `/`. */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Contacts the broadcaster can pick from. Phase 7 — required for the
   *  recipient picker. Filtered to Pulse-linked contacts inside the picker. */
  contacts: Contact[];
}

// Cached so the broadcast resumes on reload if the user had it enabled.
const LIVE_LOCATION_LS_KEY = 'pulse:map:live-location-on';

const LOCATION_OPTIONS = [
  { value: 'all'  as const, label: 'All',  Icon: Globe     },
  { value: 'home' as const, label: 'Home', Icon: Home      },
  { value: 'work' as const, label: 'Work', Icon: Briefcase },
];

const MapFilterBar: React.FC<MapFilterBarProps> = ({
  filter, circles, isDarkMode, onFilterChange, geoBlocked, onDismissGeoBanner, userId, searchInputRef, contacts,
}) => {
  const bg = isDarkMode ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-zinc-200';
  const text = isDarkMode ? 'text-white' : 'text-gray-900';

  // Personal Live Location toggle — controls own broadcast + geofence
  // detection. Persisted so a refresh resumes the previous state.
  const [liveOn, setLiveOn] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(LIVE_LOCATION_LS_KEY) === '1';
  });

  // Recipient-picker state. Opens when the user flips the BROADCAST chip ON;
  // confirm bulk-grants consent and starts the broadcast in a single hop.
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [viewerCount, setViewerCount] = useState<number>(() => getActiveBroadcastRecipientIds().length);

  useEffect(() => {
    if (!userId) return;
    if (liveOn) {
      startLocationBroadcast(userId, err => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied. Enable it to broadcast.');
          setLiveOn(false);
        }
      });
    } else {
      stopLocationBroadcast();
    }
    return () => { stopLocationBroadcast(); };
  }, [liveOn, userId]);

  const handleToggleLive = () => {
    if (!liveOn) {
      // Going from OFF → ON: route through the recipient picker first so the
      // operator declares an audience before the broadcast actually starts.
      setShowRecipientPicker(true);
      return;
    }
    // Going from ON → OFF: revoke session consents and stop. Pre-existing
    // (non-session) consents elsewhere stay intact.
    void endBroadcastRecipients(userId).catch(() => { /* best effort */ });
    setViewerCount(0);
    setLiveOn(false);
    try { localStorage.setItem(LIVE_LOCATION_LS_KEY, '0'); } catch { /* ignore */ }
    toast('Broadcast off', { icon: '⏸', duration: 2000 });
  };

  const handleRecipientConfirm = async (recipientUserIds: string[]) => {
    setShowRecipientPicker(false);
    try {
      await setBroadcastRecipients(userId, recipientUserIds);
    } catch (e) {
      toast.error('Could not grant viewer access. Try again.');
      return;
    }
    setViewerCount(recipientUserIds.length);
    setLiveOn(true);
    try { localStorage.setItem(LIVE_LOCATION_LS_KEY, '1'); } catch { /* ignore */ }
    toast(`Broadcasting to ${recipientUserIds.length}`, { icon: '📡', duration: 3000 });
  };

  // Listen for the global `B` shortcut from PulseMapView's keyboard layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (inField) return;
      if (e.key === 'b' || e.key === 'B') {
        handleToggleLive();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveOn]);

  const toggleCircle = (id: string) => {
    const next = filter.circles.includes(id)
      ? filter.circles.filter(x => x !== id)
      : [...filter.circles, id];
    onFilterChange({ ...filter, circles: next });
  };

  return (
    <div className={`absolute top-3 left-3 right-3 z-10 rounded-xl border shadow-md ${bg}`}>
      {geoBlocked && (
        <div
          role="status"
          className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs border-b ${
            isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}
          style={{
            backgroundColor: isDarkMode ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)',
            color: isDarkMode ? '#fcd34d' : '#b45309',
          }}
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
            Location blocked — enable to see distances and broadcast.
          </span>
          {onDismissGeoBanner && (
            <button
              type="button"
              onClick={onDismissGeoBanner}
              aria-label="Dismiss location banner"
              className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-amber-500/10'
              }`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 p-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <Search size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search names…"
            value={filter.searchQuery}
            onChange={e => onFilterChange({ ...filter, searchQuery: e.target.value })}
            className={`text-sm outline-none bg-transparent ${text} w-full`}
          />
        </div>

        <div className={`w-px h-5 ${isDarkMode ? 'bg-white/15' : 'bg-gray-200'}`} />

        {/* Location-type toggle (All / Home / Work) — the one filter chip
            that earns its place in Phase 1. */}
        <div className={`flex rounded-lg overflow-hidden text-xs ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
          {LOCATION_OPTIONS.map(({ value, label, Icon }) => {
            const active = filter.locationType === value;
            return (
              <button
                key={value}
                onClick={() => onFilterChange({ ...filter, locationType: value })}
                className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-inset ${
                  active
                    ? 'bg-rose-500 text-white'
                    : `${isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-200'}`
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            );
          })}
        </div>

        {/* BROADCAST toggle — was "Go Live"; mono-uppercase per the redesign. */}
        <button
          onClick={handleToggleLive}
          aria-pressed={liveOn}
          title={liveOn ? 'Broadcast on — press B to stop' : 'Press B to broadcast your location'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            liveOn
              ? 'bg-rose-500 text-white'
              : isDarkMode
                ? 'bg-white/10 text-gray-300 hover:bg-white/15'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {liveOn ? (
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          ) : (
            <Radio size={12} />
          )}
          {liveOn ? (viewerCount > 0 ? `Live · ${viewerCount}` : 'Live') : 'Broadcast'}
        </button>

        {showRecipientPicker && (
          <BroadcastRecipientPicker
            contacts={contacts}
            initialSelectedUserIds={getActiveBroadcastRecipientIds()}
            isDarkMode={isDarkMode}
            onCancel={() => setShowRecipientPicker(false)}
            onConfirm={handleRecipientConfirm}
          />
        )}

        {circles.length > 0 && (
          <>
            <div className={`w-px h-5 ${isDarkMode ? 'bg-white/15' : 'bg-gray-200'}`} />
            <div className="flex gap-1 flex-wrap">
              {circles.slice(0, 5).map(c => {
                const active = filter.circles.length === 0 || filter.circles.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCircle(c.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                      active ? 'opacity-100' : 'opacity-40'
                    }`}
                    style={{ backgroundColor: c.color + '33', color: c.color, border: `1px solid ${c.color}66` }}
                  >
                    {c.icon && <span>{c.icon}</span>}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MapFilterBar;

// ─────────────────────────────────────────────────────────────────────────────
// MapFilterBar — split into two concerns:
//
// • `MapFilterControls` (named export) — the inline filter controls: search,
//   location-type toggle, broadcast pill, recipient-picker modal. Designed
//   to be embedded into MapLensRow's `right` slot so the top chrome reads as
//   ONE 40-44px band instead of two stacked rows.
//
// • `MapFilterAccessories` (default export) — the optional accessory bands
//   that appear above or below the lens row: the geo-blocked banner (top)
//   and the circle filter chips (bottom). Renders nothing when neither
//   applies, so callers can drop it in unconditionally.
//
// The chip-style location toggle uses JetBrains Mono uppercase to match
// Broadcast and the lens chips — DESIGN.md's Mono-Label Rule.
// ─────────────────────────────────────────────────────────────────────────────

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

interface CommonProps {
  filter: MapFilter;
  isDarkMode: boolean;
  onFilterChange: (f: MapFilter) => void;
}

interface MapFilterControlsProps extends CommonProps {
  /** Logged-in user id — drives the personal Live Location broadcast toggle. */
  userId: string;
  /** Optional ref so the parent can focus the search input via `/`. */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Contacts the broadcaster can pick from. Filtered to Pulse-linked
   *  contacts inside the picker. */
  contacts: Contact[];
}

interface MapFilterAccessoriesProps extends CommonProps {
  circles: ContactCircle[];
  geoBlocked?: boolean;
  onDismissGeoBanner?: () => void;
}

// Cached so the broadcast resumes on reload if the user had it enabled.
const LIVE_LOCATION_LS_KEY = 'pulse:map:live-location-on';

const LOCATION_OPTIONS = [
  { value: 'all'  as const, label: 'All',  Icon: Globe     },
  { value: 'home' as const, label: 'Home', Icon: Home      },
  { value: 'work' as const, label: 'Work', Icon: Briefcase },
];

// ─── Inline controls — embedded into MapLensRow's right slot ──────────────
export const MapFilterControls: React.FC<MapFilterControlsProps> = ({
  filter, isDarkMode, onFilterChange, userId, searchInputRef, contacts,
}) => {
  const [liveOn, setLiveOn] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(LIVE_LOCATION_LS_KEY) === '1';
  });

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
      setShowRecipientPicker(true);
      return;
    }
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

  const monoStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
  const text = isDarkMode ? 'text-white' : 'text-gray-900';

  return (
    <>
      {/* Search — flex shrinks first when the row gets tight; placeholder
          surfaces the `/` shortcut so power users don't need a tooltip. */}
      <div className={`flex items-center gap-1.5 flex-1 min-w-[120px] max-w-[240px] rounded-md px-2 py-1 ${
        isDarkMode ? 'bg-white/[0.04]' : 'bg-gray-50'
      }`}>
        <Search size={12} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search · /"
          value={filter.searchQuery}
          onChange={e => onFilterChange({ ...filter, searchQuery: e.target.value })}
          className={`text-xs outline-none bg-transparent ${text} w-full min-w-0`}
        />
        {filter.searchQuery && (
          <button
            type="button"
            onClick={() => onFilterChange({ ...filter, searchQuery: '' })}
            aria-label="Clear search"
            className={`p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
            }`}
          >
            <X size={10} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Location-type toggle — mono uppercase to match the lens chips +
          broadcast pill. Was Inter; now consistent with the row's typographic
          system. */}
      <div
        role="group"
        aria-label="Location type filter"
        className={`flex rounded-md overflow-hidden flex-shrink-0 ${isDarkMode ? 'bg-white/[0.04]' : 'bg-gray-50'}`}
      >
        {LOCATION_OPTIONS.map(({ value, label, Icon }) => {
          const active = filter.locationType === value;
          return (
            <button
              key={value}
              onClick={() => onFilterChange({ ...filter, locationType: value })}
              aria-pressed={active}
              title={`Show ${label.toLowerCase()} locations`}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-inset ${
                active
                  ? 'bg-rose-500 text-white'
                  : `${isDarkMode ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-200'}`
              }`}
              style={monoStyle}
            >
              <Icon size={11} aria-hidden="true" />
              <span className="hidden md:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Broadcast — mono uppercase pill, coral when live. Routes through the
          recipient picker on OFF→ON so the operator declares an audience
          before the broadcast starts. Visible kbd hint matches the lens
          chips' pattern — keyboard shortcut shouldn't live only in title. */}
      <button
        onClick={handleToggleLive}
        aria-pressed={liveOn}
        aria-keyshortcuts="b"
        title={liveOn ? 'Broadcast on · press B to stop' : 'Press B to broadcast your location'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] tracking-[0.1em] uppercase transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
          liveOn
            ? 'bg-rose-500 text-white'
            : isDarkMode
              ? 'bg-white/[0.04] text-gray-300 hover:bg-white/10'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        }`}
        style={monoStyle}
      >
        {liveOn ? (
          <span className="relative inline-flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
        ) : (
          <Radio size={11} aria-hidden="true" />
        )}
        <span className="hidden md:inline">
          {liveOn ? (viewerCount > 0 ? `Live · ${viewerCount}` : 'Live') : 'Broadcast'}
        </span>
        <kbd
          aria-hidden="true"
          className={`ml-0.5 px-1 rounded text-[9px] leading-none font-normal ${
            liveOn
              ? 'bg-white/25 text-white'
              : isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-200 text-gray-500'
          }`}
        >
          B
        </kbd>
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
    </>
  );
};

// ─── Accessory bands — geo banner above, circle chips below ───────────────
const MapFilterAccessories: React.FC<MapFilterAccessoriesProps> = ({
  filter, circles, isDarkMode, onFilterChange, geoBlocked, onDismissGeoBanner,
}) => {
  const toggleCircle = (id: string) => {
    const next = filter.circles.includes(id)
      ? filter.circles.filter(x => x !== id)
      : [...filter.circles, id];
    onFilterChange({ ...filter, circles: next });
  };

  const hasCircles = circles.length > 0;
  if (!geoBlocked && !hasCircles) return null;

  return (
    <>
      {geoBlocked && (
        <div
          role="status"
          className={`flex items-center justify-between gap-2 px-3 py-1 text-xs border-b ${
            isDarkMode ? 'border-white/10' : 'border-gray-200'
          }`}
          style={{
            backgroundColor: isDarkMode ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)',
            color: isDarkMode ? '#fcd34d' : '#b45309',
          }}
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
            Location blocked. Enable it to see distances and broadcast.
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
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {hasCircles && (
        <div
          className={`flex gap-1 flex-wrap px-2 py-1 border-b overflow-x-auto ${
            isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-gray-200'
          }`}
        >
          {circles.slice(0, 5).map(c => {
            const active = filter.circles.length === 0 || filter.circles.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCircle(c.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
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
      )}
    </>
  );
};

export default MapFilterAccessories;

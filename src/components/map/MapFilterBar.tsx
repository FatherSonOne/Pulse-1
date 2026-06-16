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

import React from 'react';
import { Briefcase, Globe, Home, Radio, Search, X } from 'lucide-react';
import { ContactCircle } from '../../types/contactCircleTypes';
import type { BroadcastControl } from './horizon/useBroadcastControl';

export interface MapFilter {
  circles: string[];
  locationType: 'all' | 'home' | 'work';
  searchQuery: string;
}

interface CommonProps {
  filter: MapFilter;
  isDarkMode: boolean;
  onFilterChange: (f: MapFilter) => void;
  /** Direction D (Horizon, P6) — coral=signal-only. When true, the filter CHROME
   *  (search-clear, location toggle, banner dismiss) goes neutral; the broadcast
   *  pill keeps coral (it IS live signal). Undefined ⇒ legacy rose chrome (OFF path). */
  neutralChrome?: boolean;
}

interface MapFilterControlsProps extends CommonProps {
  /** Optional ref so the parent can focus the search input via `/`. */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Shared broadcast state machine (P8). Owned by PulseMapView via
   *  useBroadcastControl so the filter-bar pill and the LiveTeamDrawer drive
   *  ONE broadcast; this component is a pure consumer. */
  broadcast: BroadcastControl;
  /** Horizon path only: when provided, the Broadcast pill opens the first-class
   *  LiveTeamDrawer instead of toggling directly (the drawer owns the master
   *  switch + recipient flow). Undefined ⇒ legacy OFF path: the pill toggles. */
  onOpenLiveDrawer?: () => void;
}

interface MapFilterAccessoriesProps extends CommonProps {
  circles: ContactCircle[];
  geoBlocked?: boolean;
  onDismissGeoBanner?: () => void;
}

const LOCATION_OPTIONS = [
  { value: 'all'  as const, label: 'All',  Icon: Globe     },
  { value: 'home' as const, label: 'Home', Icon: Home      },
  { value: 'work' as const, label: 'Work', Icon: Briefcase },
];

// ─── Inline controls — embedded into MapLensRow's right slot ──────────────
export const MapFilterControls: React.FC<MapFilterControlsProps> = ({
  filter, isDarkMode, onFilterChange, searchInputRef, neutralChrome, broadcast, onOpenLiveDrawer,
}) => {
  // Coral=signal-only chrome (P6): neutral focus ring + neutral active fill for the
  // filter chrome when under Horizon; legacy rose otherwise. The broadcast pill is
  // deliberately excluded — it's live signal and keeps coral.
  const ringCls = neutralChrome
    ? (isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500')
    : 'focus-visible:ring-rose-500';
  const toggleActiveCls = neutralChrome
    ? (isDarkMode ? 'bg-white/15 text-white' : 'bg-gray-200 text-gray-900')
    : 'bg-rose-500 text-white';

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
            className={`p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 ${ringCls} ${
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
              className={`flex items-center gap-1 px-2 py-1 text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 ${ringCls} focus-visible:ring-inset ${
                active
                  ? toggleActiveCls
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

      {/* Broadcast — mono uppercase pill, coral when live. OFF path: toggles the
          broadcast directly (recipient picker on OFF→ON), B keyboard shortcut.
          Horizon path (onOpenLiveDrawer): opens the first-class LiveTeamDrawer,
          which owns the master switch + recipient flow. The recipient picker is
          rendered once by PulseMapView (always mounted) so either surface can
          summon it without owning the broadcast state. */}
      <button
        onClick={onOpenLiveDrawer ?? broadcast.handleToggleLive}
        aria-pressed={onOpenLiveDrawer ? undefined : broadcast.liveOn}
        aria-haspopup={onOpenLiveDrawer ? 'dialog' : undefined}
        aria-keyshortcuts={onOpenLiveDrawer ? undefined : 'b'}
        title={
          onOpenLiveDrawer
            ? 'Open live team'
            : broadcast.liveOn ? 'Broadcast on · press B to stop' : 'Press B to broadcast your location'
        }
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] tracking-[0.1em] uppercase transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
          broadcast.liveOn
            ? 'bg-rose-500 text-white'
            : isDarkMode
              ? 'bg-white/[0.04] text-gray-300 hover:bg-white/10'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        }`}
        style={monoStyle}
      >
        {broadcast.liveOn ? (
          <span className="relative inline-flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
        ) : (
          <Radio size={11} aria-hidden="true" />
        )}
        <span className="hidden md:inline">
          {broadcast.liveOn
            ? (broadcast.viewerCount > 0 ? `Live · ${broadcast.viewerCount}` : 'Live')
            : (onOpenLiveDrawer ? 'Live team' : 'Broadcast')}
        </span>
        {!onOpenLiveDrawer && (
          <kbd
            aria-hidden="true"
            className={`ml-0.5 px-1 rounded text-[9px] leading-none font-normal ${
              broadcast.liveOn
                ? 'bg-white/25 text-white'
                : isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-200 text-gray-500'
            }`}
          >
            B
          </kbd>
        )}
      </button>
    </>
  );
};

// ─── Accessory bands — geo banner above, circle chips below ───────────────
const MapFilterAccessories: React.FC<MapFilterAccessoriesProps> = ({
  filter, circles, isDarkMode, onFilterChange, geoBlocked, onDismissGeoBanner, neutralChrome,
}) => {
  // P6 — neutral focus ring under Horizon (coral=signal-only); legacy rose otherwise.
  const ringCls = neutralChrome
    ? (isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500')
    : 'focus-visible:ring-rose-500';
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
              className={`p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 ${ringCls} ${
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

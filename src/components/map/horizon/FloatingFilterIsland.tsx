// ─────────────────────────────────────────────────────────────────────────────
// FloatingFilterIsland — Direction-D "Horizon" floating-chrome (Tier-3 §8B) home
// for the two filter controls that lived in the suppressed chrome band's
// MapFilterControls: the search input (with the `/` focus ref) and the
// location-type toggle (All / Home / Work). Self-contained so the band-era
// MapFilterControls — which is the default-ON prod path — is left UNTOUCHED.
//
// The Broadcast pill is intentionally NOT here: under the float layout, going
// live is reached via the SurfacesCluster "Live" button → LiveTeamDrawer (which
// owns the master switch), so duplicating the pill would double the entry point.
// Mutations keep MapFilterControls' immutable spread-merge contract
// (onFilterChange({ ...filter, <key>: value })). NEUTRAL chrome — coral reserved
// for AI/live (CLAUDE.md §4); colors via the canonical --pulse-* tokens.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Briefcase, Globe, Home, Search, X } from 'lucide-react';
import type { MapFilter } from '../MapFilterBar';

export interface FloatingFilterIslandProps {
  filter: MapFilter;
  isDarkMode: boolean;
  onFilterChange: (f: MapFilter) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

const LOCATION_OPTIONS = [
  { value: 'all' as const, label: 'All', Icon: Globe },
  { value: 'home' as const, label: 'Home', Icon: Home },
  { value: 'work' as const, label: 'Work', Icon: Briefcase },
];

const MONO = "'JetBrains Mono', monospace";

export const FloatingFilterIsland: React.FC<FloatingFilterIslandProps> = ({
  filter,
  isDarkMode,
  onFilterChange,
  searchInputRef,
}) => {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-xl backdrop-blur-md"
      style={{
        background: 'var(--pulse-surface)',
        border: '1px solid var(--pulse-border)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-1.5 min-w-[120px] max-w-[200px]">
        <Search size={12} aria-hidden="true" style={{ color: 'var(--pulse-ink-3)' }} />
        <input
          ref={searchInputRef}
          type="text"
          value={filter.searchQuery}
          onChange={(e) => onFilterChange({ ...filter, searchQuery: e.target.value })}
          placeholder="Search · /"
          aria-label="Search the map"
          className={`text-xs outline-none bg-transparent w-full min-w-0 ${
            isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
          }`}
        />
        {filter.searchQuery && (
          <button
            type="button"
            onClick={() => onFilterChange({ ...filter, searchQuery: '' })}
            aria-label="Clear search"
            className={`p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
            }`}
            style={{ color: 'var(--pulse-ink-3)' }}
          >
            <X size={10} aria-hidden="true" />
          </button>
        )}
      </div>

      <span aria-hidden="true" className="w-px h-5" style={{ background: 'var(--pulse-border)' }} />

      {/* Location-type toggle */}
      <div role="group" aria-label="Location type filter" className="flex items-center">
        {LOCATION_OPTIONS.map(({ value, label, Icon }) => {
          const active = filter.locationType === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              title={`Show ${label.toLowerCase()} locations`}
              onClick={() => onFilterChange({ ...filter, locationType: value })}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
              }`}
              style={{
                fontFamily: MONO,
                background: active ? 'var(--pulse-surface-raised)' : 'transparent',
                color: active ? 'var(--pulse-ink)' : 'var(--pulse-ink-3)',
              }}
            >
              <Icon size={11} aria-hidden="true" />
              <span className="hidden md:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

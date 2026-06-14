// ─────────────────────────────────────────────────────────────────────────────
// Lens-specific empty state. Replaces the prior single-CTA card with copy +
// paths matched to the active lens. Atlas-empty surfaces a three-path
// onboarding card; Atlas mid-geocoding surfaces a wait card; Today/Week
// empty offers the Atlas swap.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Globe, Home, MapPin, MapPinned, Sparkles, Sun, Users } from 'lucide-react';
import type { MapLens } from './mapLens';

export interface LensEmptyStateProps {
  lens: MapLens;
  isDarkMode: boolean;
  atlasHasAnyPinned: boolean;
  hasGeocodingInFlight: boolean;
  canAddLocation: boolean;
  onOpenAtlas: () => void;
  onAutoGeocode: () => void;
  onPinWhereIAm: () => void;
  onPickContact: () => void;
}

export const LensEmptyState: React.FC<LensEmptyStateProps> = ({
  lens,
  isDarkMode,
  atlasHasAnyPinned,
  hasGeocodingInFlight,
  canAddLocation,
  onOpenAtlas,
  onAutoGeocode,
  onPinWhereIAm,
  onPickContact,
}) => {
  // Atlas-empty (first-run, no pins anywhere): three-path onboarding.
  if (lens === 'atlas' && !atlasHasAnyPinned) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6">
        <div
          className={`rounded-2xl px-6 py-5 shadow-lg backdrop-blur-2xl border max-w-md pointer-events-auto ${
            isDarkMode ? 'bg-zinc-950/85 border-white/10' : 'bg-white/90 border-gray-200'
          }`}
        >
          <MapPin size={28} className="text-rose-500/70 mb-3" />
          <p className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            Pin your network to see distance, routes, and circles.
          </p>
          <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Pick a starting move — the rest fills in as you go.
          </p>
          <div className="flex flex-col gap-2">
            {hasGeocodingInFlight && (
              <button
                type="button"
                onClick={onAutoGeocode}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
              >
                <Sparkles size={12} />
                Auto-geocode contacts with addresses
              </button>
            )}
            <button
              type="button"
              onClick={onPinWhereIAm}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isDarkMode ? 'border-white/10 text-gray-200 hover:border-rose-500/40 hover:text-rose-300' : 'border-gray-200 text-gray-700 hover:border-rose-500/40 hover:text-rose-600'
              }`}
            >
              <Home size={12} />
              Pin a contact's home or work
            </button>
            <button
              type="button"
              onClick={onPickContact}
              disabled={!canAddLocation}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode ? 'border-white/10 text-gray-200 hover:border-rose-500/40 hover:text-rose-300' : 'border-gray-200 text-gray-700 hover:border-rose-500/40 hover:text-rose-600'
              }`}
            >
              <Users size={12} />
              Pick a contact to place
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Atlas mid-state: addresses queued for geocoding.
  if (lens === 'atlas' && hasGeocodingInFlight) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`rounded-2xl px-6 py-5 text-center shadow-lg backdrop-blur-2xl border max-w-sm pointer-events-auto ${
            isDarkMode ? 'bg-zinc-950/85 border-white/10' : 'bg-white/90 border-gray-200'
          }`}
        >
          <MapPinned size={28} className="text-rose-500/70 mx-auto mb-3 motion-safe:animate-pulse" />
          <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            Geocoding addresses…
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Pins appear as Google resolves each contact.
          </p>
        </div>
      </div>
    );
  }

  // Today / Week empty when Atlas has pins: tell the truth, offer the lens swap.
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className={`rounded-2xl px-6 py-5 text-center shadow-lg backdrop-blur-2xl border max-w-sm pointer-events-auto ${
          isDarkMode ? 'bg-zinc-950/85 border-white/10' : 'bg-white/90 border-gray-200'
        }`}
      >
        <Sun size={28} className="text-rose-500/70 mx-auto mb-3" />
        <p className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {lens === 'today' ? 'Nothing on the map today.' : 'Nothing on the map this week.'}
        </p>
        <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
          Open Atlas to browse your full network.
        </p>
        <button
          type="button"
          onClick={onOpenAtlas}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            isDarkMode ? 'border-white/15 text-gray-200 hover:border-rose-500/40 hover:text-rose-300' : 'border-gray-200 text-gray-700 hover:border-rose-500/40 hover:text-rose-600'
          }`}
        >
          <Globe size={11} />
          Switch to Atlas
        </button>
      </div>
    </div>
  );
};

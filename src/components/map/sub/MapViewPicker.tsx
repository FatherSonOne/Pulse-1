// ─────────────────────────────────────────────────────────────────────────────
// MapViewPicker — floating base-tile picker (Map / Sat / Terr / Hybrid).
//
// Previously the right half of MapLensRow. Promoted to a bottom-right
// floating chip so the top chrome can dedicate every pixel to navigational
// state (lens + filter + broadcast). View-mode is spatial chrome — about how
// the map renders, not about what to look at — so it belongs near the map's
// own zoom + attribution affordances.
//
// Mono uppercase labels stay on the buttons on ≥sm; on mobile the labels
// collapse to icons. Keyboard shortcuts (4/5/6/7) preserved.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { MAP_VIEW_OPTIONS, type MapViewMode } from './mapLens';

export interface MapViewPickerProps {
  viewMode: MapViewMode;
  isDarkMode: boolean;
  onViewModeChange: (mode: MapViewMode) => void;
}

export const MapViewPicker: React.FC<MapViewPickerProps> = ({
  viewMode,
  isDarkMode,
  onViewModeChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Map view mode"
      className={`absolute bottom-20 right-4 z-10 flex items-center gap-0.5 rounded-lg p-0.5 shadow-md backdrop-blur-sm ${
        isDarkMode ? 'bg-zinc-900/85 border border-white/10' : 'bg-white/90 border border-gray-200'
      }`}
    >
      {MAP_VIEW_OPTIONS.map(({ id, label, Icon, hotkey }) => {
        const active = viewMode === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            aria-keyshortcuts={hotkey}
            aria-label={`${label} view`}
            onClick={() => onViewModeChange(id)}
            title={`${label} view · press ${hotkey}`}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
              active
                ? `text-rose-500 ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'}`
                : `${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`
            }`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Icon size={11} aria-hidden="true" />
            <span className="hidden sm:inline" aria-hidden="true">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

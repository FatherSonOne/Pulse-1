// ─────────────────────────────────────────────────────────────────────────────
// MapLensRow — the top-of-section header that carries the lens triad
// (TODAY / WEEK / ATLAS) on the left and the base-tile view picker
// (Map / Sat / Terr / Hybrid) on the right.
//
// Both groups share styling so they read as siblings, not strangers, and
// both expose aria-keyshortcuts (1/2/3 for lens, 4/5/6/7 for view) so the
// hotkey reference renders as a <kbd> chip on each button.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { LENS_OPTIONS, MAP_VIEW_OPTIONS, type MapLens, type MapViewMode } from './mapLens';

export interface MapLensRowProps {
  lens: MapLens;
  viewMode: MapViewMode;
  isDarkMode: boolean;
  onLensChange: (lens: MapLens) => void;
  onViewModeChange: (mode: MapViewMode) => void;
}

export const MapLensRow: React.FC<MapLensRowProps> = ({
  lens,
  viewMode,
  isDarkMode,
  onLensChange,
  onViewModeChange,
}) => {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${
        isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-gray-200'
      }`}
    >
      <div
        role="group"
        aria-label="Map lens"
        className="flex items-center gap-1"
      >
        {LENS_OPTIONS.map(({ id, label, Icon }) => {
          const active = lens === id;
          const hotkey = id === 'today' ? '1' : id === 'week' ? '2' : '3';
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              aria-keyshortcuts={hotkey}
              onClick={() => onLensChange(id)}
              title={`${label} lens — press ${hotkey}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                active
                  ? `text-rose-500 ${isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50'}`
                  : `${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`
              }`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <Icon size={11} aria-hidden="true" />
              <span>{label}</span>
              <kbd
                aria-hidden="true"
                className={`ml-0.5 px-1 rounded text-[9px] leading-none font-normal ${
                  active
                    ? isDarkMode ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-600'
                    : isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {hotkey}
              </kbd>
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="Map view mode"
        className={`flex items-center gap-0.5 rounded-md p-0.5 ${
          isDarkMode ? 'bg-white/[0.03]' : 'bg-gray-50'
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
              title={`${label} view — press ${hotkey}`}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                active
                  ? `text-rose-500 ${isDarkMode ? 'bg-rose-500/10' : 'bg-white shadow-sm'}`
                  : `${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-white/60'}`
              }`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <Icon size={11} aria-hidden="true" />
              <span className="hidden sm:inline" aria-hidden="true">{label}</span>
              <kbd
                aria-hidden="true"
                className={`ml-0.5 px-1 rounded text-[9px] leading-none font-normal ${
                  active
                    ? isDarkMode ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-600'
                    : isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {hotkey}
              </kbd>
            </button>
          );
        })}
      </div>
    </div>
  );
};

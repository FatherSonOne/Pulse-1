// ─────────────────────────────────────────────────────────────────────────────
// MapLensRow — the top-of-section chrome strip. Renders the lens triad
// (TODAY / WEEK / ATLAS) on the left and accepts an optional `right` slot
// for the filter / broadcast controls so they live in the same 40px band
// instead of stacking as a second row.
//
// The view-mode picker (Map/Sat/Terr/Hybrid) moved to a floating
// MapViewPicker chip at the map's bottom-right corner — see ./MapViewPicker.
// Keyboard shortcuts (1/2/3) are still rendered as <kbd> chips on each lens
// button; 4-7 for view mode are wired to the floating picker via the same
// useMapKeyboardShortcuts hook.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { LENS_OPTIONS, type MapLens } from './mapLens';

export interface MapLensRowProps {
  lens: MapLens;
  isDarkMode: boolean;
  onLensChange: (lens: MapLens) => void;
  /** Right-side slot — typically MapFilterBar's inline controls. */
  right?: React.ReactNode;
}

export const MapLensRow: React.FC<MapLensRowProps> = ({
  lens,
  isDarkMode,
  onLensChange,
  right,
}) => {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-2 py-1.5 border-b ${
        isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-gray-200'
      }`}
    >
      <div
        role="group"
        aria-label="Map lens"
        className="flex items-center gap-1 flex-shrink-0"
      >
        {LENS_OPTIONS.map(({ id, label, Icon }) => {
          const active = lens === id;
          const hotkey = id === 'today' ? '1' : id === 'week' ? '2' : '3';
          // Lens scope made specific so a first-time user doesn't have to
          // guess what "Atlas" means. Today/Week are temporal; Atlas is the
          // everyone-pinned view — different semantic, deserves a tooltip
          // that says so.
          const scopeHint =
            id === 'today' ? 'Today’s stops'
            : id === 'week' ? 'This week’s stops'
            : 'Everyone pinned';
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              aria-keyshortcuts={hotkey}
              onClick={() => onLensChange(id)}
              title={`${label} · ${scopeHint} · press ${hotkey}`}
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

      {right && (
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          {right}
        </div>
      )}
    </div>
  );
};

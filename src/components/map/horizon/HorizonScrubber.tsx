// ─────────────────────────────────────────────────────────────────────────────
// HorizonScrubber — Direction D (Horizon, P5) time axis. Replaces MapLensRow's
// TODAY/WEEK/ATLAS tabs (on the MapLibre + mapHorizon path) with a four-detent
// scrubber (Now → Today → 3 Days → Week) plus the orthogonal Atlas-mode toggle.
//
// a11y parity with the old tabs: each detent is an aria-pressed button with an
// aria-keyshortcuts hint and a visible <kbd> chip; Tab moves between them and the
// global 1–4 / `a` hotkeys (useMapKeyboardShortcuts) drive them. Same 40px chrome
// band + optional `right` slot (MapFilterBar) as MapLensRow. NEUTRAL — coral is
// reserved for AI/live signal (CLAUDE.md §4); the active detent is a neutral
// elevated "thumb", not rose. When Atlas mode is on the time context is overridden,
// so the scrubber dims to say so honestly while keeping the selected detent visible.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { MAP_HORIZON_OPTIONS, type MapHorizon } from '../sub/mapLens';
import { AtlasModeToggle } from './AtlasModeToggle';

export interface HorizonScrubberProps {
  horizon: MapHorizon;
  onHorizonChange: (h: MapHorizon) => void;
  atlasMode: boolean;
  onAtlasModeChange: (next: boolean) => void;
  isDarkMode: boolean;
  /** Right-side slot — typically MapFilterBar's inline controls (same as MapLensRow). */
  right?: React.ReactNode;
}

export const HorizonScrubber: React.FC<HorizonScrubberProps> = ({
  horizon,
  onHorizonChange,
  atlasMode,
  onAtlasModeChange,
  isDarkMode,
  right,
}) => {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-2 py-1.5 border-b ${
        isDarkMode ? 'bg-zinc-900/40 border-white/5' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          role="group"
          aria-label="Time horizon"
          className={`relative flex items-center gap-0.5 rounded-lg p-0.5 transition-opacity ${
            atlasMode ? 'opacity-50' : ''
          } ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}
        >
          {/* Scrubber track — the line the detents sit on. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 ${
              isDarkMode ? 'bg-white/10' : 'bg-gray-300'
            }`}
          />
          {MAP_HORIZON_OPTIONS.map(({ id, label, Icon, hotkey }) => {
            const active = horizon === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-keyshortcuts={hotkey}
                onClick={() => onHorizonChange(id)}
                title={`${label} · press ${hotkey}`}
                className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
                } ${
                  active
                    ? isDarkMode
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'bg-white text-gray-900 shadow-sm'
                    : isDarkMode
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Icon size={11} aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                <kbd
                  aria-hidden="true"
                  className={`ml-0.5 px-1 rounded text-[9px] leading-none font-normal ${
                    active
                      ? isDarkMode ? 'bg-white/15 text-gray-200' : 'bg-gray-200 text-gray-600'
                      : isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {hotkey}
                </kbd>
              </button>
            );
          })}
        </div>

        <span aria-hidden="true" className={`w-px h-5 ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

        <AtlasModeToggle atlasMode={atlasMode} onChange={onAtlasModeChange} isDarkMode={isDarkMode} />
      </div>

      {right && (
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          {right}
        </div>
      )}
    </div>
  );
};

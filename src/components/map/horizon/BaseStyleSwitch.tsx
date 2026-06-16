// ─────────────────────────────────────────────────────────────────────────────
// BaseStyleSwitch — Direction D (Horizon, P3) renderer-real base-style control.
//
// Replaces the dead Sat/Terr/Hybrid MapViewPicker on the MapLibre branch (under
// the mapHorizon flag). Two a11y groups in one floating chip: base style
// (Light / Dark / Contrast — all real, fully-styled palettes in coralCockpitStyle)
// and label density (Detailed / Minimal). Mirrors MapViewPicker's footprint
// (bottom-right) and mono-uppercase chrome, but NEUTRAL — coral is reserved for
// AI/live signal (CLAUDE.md §4), so the active state is a neutral fill, not rose.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  MAP_BASE_STYLE_OPTIONS,
  MAP_DENSITY_OPTIONS,
  type MapBaseStyle,
  type MapDensity,
} from '../sub/mapLens';

export interface BaseStyleSwitchProps {
  baseStyle: MapBaseStyle;
  density: MapDensity;
  isDarkMode: boolean;
  onBaseStyleChange: (next: MapBaseStyle) => void;
  onDensityChange: (next: MapDensity) => void;
}

export const BaseStyleSwitch: React.FC<BaseStyleSwitchProps> = ({
  baseStyle,
  density,
  isDarkMode,
  onBaseStyleChange,
  onDensityChange,
}) => {
  const btnClass = (active: boolean) =>
    `flex items-center gap-1 px-2 py-1 rounded text-[10px] tracking-[0.1em] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
      isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
    } ${
      active
        ? isDarkMode
          ? 'bg-white/15 text-white'
          : 'bg-gray-200 text-gray-900'
        : isDarkMode
          ? 'text-gray-400 hover:bg-white/5'
          : 'text-gray-500 hover:bg-gray-100'
    }`;

  return (
    <div
      className={`absolute bottom-20 right-4 z-10 flex items-center gap-1 rounded-lg p-0.5 shadow-md backdrop-blur-sm ${
        isDarkMode ? 'bg-zinc-900/85 border border-white/10' : 'bg-white/90 border border-gray-200'
      }`}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <div role="group" aria-label="Map base style" className="flex items-center gap-0.5">
        {MAP_BASE_STYLE_OPTIONS.map(({ id, label, Icon }) => {
          const active = baseStyle === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              aria-label={`${label} map style`}
              title={`${label} map style`}
              onClick={() => onBaseStyleChange(id)}
              className={btnClass(active)}
            >
              <Icon size={11} aria-hidden="true" />
              <span className="hidden sm:inline" aria-hidden="true">{label}</span>
            </button>
          );
        })}
      </div>

      <span
        aria-hidden="true"
        className={`w-px self-stretch my-1 ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}
      />

      <div role="group" aria-label="Map label density" className="flex items-center gap-0.5">
        {MAP_DENSITY_OPTIONS.map(({ id, label, Icon }) => {
          const active = density === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              aria-label={`${label} labels`}
              title={`${label} labels`}
              onClick={() => onDensityChange(id)}
              className={btnClass(active)}
            >
              <Icon size={11} aria-hidden="true" />
              <span className="hidden sm:inline" aria-hidden="true">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

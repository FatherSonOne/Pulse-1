// ─────────────────────────────────────────────────────────────────────────────
// HorizonScrubberPill — Direction-D "Horizon" floating-chrome (Tier-3 §8B) variant
// of the time scrubber. Same CONTROLLED CONTRACT as HorizonScrubber (emits the
// four MapHorizon literals, neutral-only, fully controlled/stateless) but rendered
// as the mockup's 3-row glass PILL instead of a chrome band:
//   1. header  — clock + "Horizon" + the current step label
//   2. track   — a real progress rail (filled to the current detent) + 4 handle dots
//   3. labels  — Now / Today / 3 Days / Week
// It floats over the full-bleed map; the Atlas toggle is a sibling island (rendered
// by PulseMapView), so this pill DIMS when Atlas is on to honestly show the time
// context is overridden (mirrors HorizonScrubber's opacity-50 dim).
//
// a11y parity preserved: the handle DOTS are the canonical aria-pressed toggles
// (role="group" "Time horizon", aria-keyshortcuts mirroring the global 1–4 hotkeys
// in useMapKeyboardShortcuts); the label-row buttons are redundant POINTER
// affordances (aria-hidden + tabIndex -1) so screen-reader users aren't
// double-announced. NEUTRAL — coral is reserved for AI/live signal (CLAUDE.md §4);
// colors come from the canonical --pulse-* tokens (auto light/dark via .dark).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Clock } from 'lucide-react';
import { MAP_HORIZON_OPTIONS, type MapHorizon } from '../sub/mapLens';

export interface HorizonScrubberPillProps {
  horizon: MapHorizon;
  onHorizonChange: (h: MapHorizon) => void;
  /** Atlas overrides the time context — dim the pill to say so (the Atlas toggle is a sibling island). */
  atlasMode: boolean;
  isDarkMode: boolean;
}

const MONO = "'JetBrains Mono', monospace";

export const HorizonScrubberPill: React.FC<HorizonScrubberPillProps> = ({
  horizon,
  onHorizonChange,
  atlasMode,
  isDarkMode,
}) => {
  const idx = Math.max(0, MAP_HORIZON_OPTIONS.findIndex(o => o.id === horizon));
  const frac = idx / (MAP_HORIZON_OPTIONS.length - 1);
  const current = MAP_HORIZON_OPTIONS[idx];

  return (
    <div
      className={`inline-flex flex-col gap-1.5 px-3 py-2 rounded-xl backdrop-blur-md transition-opacity ${
        atlasMode ? 'opacity-40 pointer-events-none' : ''
      }`}
      style={{
        background: 'var(--pulse-surface)',
        border: '1px solid var(--pulse-border)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.08)',
        minWidth: 240,
      }}
    >
      {/* Header row — clock + "Horizon" + current step */}
      <div className="flex items-center gap-1.5">
        <Clock size={11} aria-hidden="true" style={{ color: 'var(--pulse-ink-3)' }} />
        <span
          className="text-[10px] tracking-[0.1em] uppercase"
          style={{ fontFamily: MONO, color: 'var(--pulse-ink-3)' }}
        >
          Horizon
        </span>
        <span className="text-[10px] font-semibold ml-auto" style={{ color: 'var(--pulse-ink-2)' }}>
          {current.label}
        </span>
      </div>

      {/* Track row — bg rail + filled rail + handle dots (the canonical aria toggles) */}
      <div role="group" aria-label="Time horizon" className="relative flex items-center h-5">
        <span
          aria-hidden="true"
          className="absolute left-1.5 right-1.5 h-0.5 rounded"
          style={{ background: 'var(--pulse-border-strong)' }}
        />
        <span
          aria-hidden="true"
          className="absolute left-1.5 h-0.5 rounded transition-[width] duration-200 ease-out"
          style={{ background: 'var(--pulse-ink)', width: `calc((100% - 12px) * ${frac})` }}
        />
        <div className="relative flex items-center justify-between w-full">
          {MAP_HORIZON_OPTIONS.map(({ id, label, hotkey }, i) => {
            const active = horizon === id;
            const past = i <= idx;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-keyshortcuts={hotkey}
                onClick={() => onHorizonChange(id)}
                title={`${label} · press ${hotkey}`}
                className={`rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  isDarkMode ? 'focus-visible:ring-zinc-400' : 'focus-visible:ring-zinc-500'
                }`}
              >
                <span
                  className="block rounded-full transition-all duration-200 ease-out"
                  style={{
                    width: active ? 14 : 11,
                    height: active ? 14 : 11,
                    background: past ? 'var(--pulse-ink)' : 'var(--pulse-surface)',
                    border: `2px solid ${past ? 'var(--pulse-ink)' : 'var(--pulse-border-strong)'}`,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Label row — redundant pointer affordances (aria-hidden; the dots own a11y) */}
      <div className="flex items-center justify-between" aria-hidden="true">
        {MAP_HORIZON_OPTIONS.map(({ id, label }) => {
          const active = horizon === id;
          return (
            <button
              key={id}
              type="button"
              tabIndex={-1}
              onClick={() => onHorizonChange(id)}
              className="text-[10px] font-medium px-0.5 rounded transition-colors"
              style={{ color: active ? 'var(--pulse-ink)' : 'var(--pulse-ink-3)' }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

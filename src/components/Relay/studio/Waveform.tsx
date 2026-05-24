// Deterministic waveform — same `seed` always renders the same bars.
//
// Production tradeoff: a real waveform would come from a peaks-array on the
// voice asset (computed at upload time). Until that ships, deterministic
// pseudo-random gives every voice a stable, recognizable shape so users
// build a visual memory for their messages. When real peaks land, swap the
// `bars` source and keep the same render contract.

import React, { useMemo } from 'react';

import './waveform.css';

export interface WaveformProps {
  /** Stable seed — usually the voice id. Different seeds = different shapes. */
  seed: string;
  /** Pixel height of the tallest bar. Bars scale within this. */
  height?: number;
  /** Number of bars. 36 for inline, 60–120 for hero / footer. */
  count?: number;
  /** 0 → 1. Bars left of progress render at full opacity (coral),
   *  bars right render dimmed. Lets the same component serve both
   *  "static preview" and "currently playing" states. */
  progress?: number;
  /** Tailwind / utility class for the color. We use `currentColor` so the
   *  parent can style by setting `color: var(--pulse-rose)` on a wrapper. */
  className?: string;
  /** Thicker, taller bars — for hero / footer use. */
  tall?: boolean;
}

/** Pseudo-random bar heights, deterministic per seed. Linear congruential
 *  generator — fast, no dependencies, same output across browsers. */
function waveformBars(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const v = 0.18 + ((h % 1000) / 1000) * 0.82;
    bars.push(v);
  }
  return bars;
}

export const Waveform: React.FC<WaveformProps> = ({
  seed,
  height = 24,
  count = 36,
  progress = 0,
  className = '',
  tall = false,
}) => {
  const bars = useMemo(() => waveformBars(seed, count), [seed, count]);
  return (
    <span
      className={`pulse-wf ${tall ? 'pulse-wf--tall' : ''} ${className}`}
      style={{ height }}
      role="img"
      aria-label={`Waveform, ${Math.round(progress * 100)}% played`}
    >
      {bars.map((v, i) => (
        <i
          key={i}
          style={{
            height: Math.max(2, v * height),
            opacity: i / count <= progress ? 1 : (tall ? 0.4 : 0.45),
          }}
        />
      ))}
    </span>
  );
};

export default Waveform;

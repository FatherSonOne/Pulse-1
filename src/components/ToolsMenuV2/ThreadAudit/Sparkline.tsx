// src/components/ToolsMenuV2/ThreadAudit/Sparkline.tsx
// PR 3a — Surface 3 · Thread Audit · 30-day reply-time sparkline.
//
// Plain inline SVG. NO external chart library — adds zero deps. Uses
// --pulse-tone-info (neutral blue) for the stroke per spec; coral is
// reserved for AI-output surfaces only and is forbidden in PR 3a.
// Per spec the comment notes "uses --pulse-chart-1 if it exists" —
// the token does not exist today, so we fall back to --pulse-tone-info.

import React, { useMemo } from 'react';

export interface SparklineProps {
  /** Series — non-empty. Caller is responsible for normalising to one
   * value per day (length should be 30 for the canonical 30-day view). */
  values: number[];
  width?: number;
  height?: number;
  isDarkMode?: boolean;
  ariaLabel?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 320,
  height = 56,
  isDarkMode = false,
  ariaLabel,
}) => {
  const { d, area, min, max } = useMemo(() => {
    if (values.length === 0) {
      return { d: '', area: '', min: 0, max: 0 };
    }
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const range = hi - lo || 1;
    const stepX = values.length > 1 ? width / (values.length - 1) : 0;
    const padY = 4;
    const drawableH = height - padY * 2;
    const pts = values.map((v, i) => {
      const x = i * stepX;
      const y = padY + drawableH - ((v - lo) / range) * drawableH;
      return [x, y] as const;
    });
    const path = pts
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');
    const areaPath =
      `${path} L${pts[pts.length - 1][0].toFixed(2)},${height} L0,${height} Z`;
    return { d: path, area: areaPath, min: lo, max: hi };
  }, [values, width, height]);

  // Use --pulse-tone-info as the data-viz stroke (neutral blue). Coral
  // is intentionally NOT referenced — data is not signal.
  const stroke = 'var(--pulse-tone-info)';
  const areaFill = isDarkMode
    ? 'rgba(59, 130, 246, 0.16)' // matches --pulse-tone-info-soft dark
    : 'rgba(59, 130, 246, 0.10)';

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        ariaLabel ??
        `30-day reply time trend, low ${min.toFixed(0)}, high ${max.toFixed(0)}`
      }
      className="block"
    >
      {area ? <path d={area} fill={areaFill} /> : null}
      {d ? (
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
};

export default Sparkline;

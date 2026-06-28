/**
 * PulseMark — the canonical Pulse brand mark (Globe · Solid).
 *
 * A gradient disc with the heartbeat *knocked out* of it: the EKG slit is a real
 * transparent gap, so it reads as whatever surface sits behind the mark. This is
 * the production mark from the Asset Studio playground, replacing the old
 * waveform-stroke mark. Pair with <PulseWordmark/> for the full lockup.
 *
 * Geometry (viewBox 0 0 100 100): disc r = 43.33; heartbeat baseline crosses the
 * full diameter with one sharp peak/trough just left of centre.
 */
import React from 'react';

/** EKG heartbeat path in the 100×100 mark viewBox — shared with animated overlays. */
export const PULSE_HEARTBEAT_PATH =
  'M-1.13 50 H38.73 L45.54 36.57 L53.34 63.43 L60.01 50 H101.13';

/** Disc radius in the 100×100 viewBox. */
export const PULSE_DISC_R = 43.33;

interface PulseMarkProps {
  /** Rendered width & height in px (or any CSS length). Default 64. */
  size?: number | string;
  className?: string;
  /** Fill of the disc. 'grad' = rose→pink gradient (default); 'white' = solid white knockout. */
  fill?: 'grad' | 'white';
  /** Accessible label. When omitted the mark is decorative (aria-hidden). */
  title?: string;
  style?: React.CSSProperties;
}

export const PulseMark: React.FC<PulseMarkProps> = ({
  size = 64,
  className,
  fill = 'grad',
  title,
  style,
}) => {
  // Unique ids so multiple marks on a page don't collide on gradient/mask refs.
  const uid = React.useId().replace(/:/g, '');
  const gradId = `pmg-${uid}`;
  const maskId = `pmm-${uid}`;
  const discFill = fill === 'white' ? '#ffffff' : `url(#${gradId})`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <mask id={maskId}>
          <rect x="-2" y="-2" width="104" height="104" fill="#fff" />
          <path
            d={PULSE_HEARTBEAT_PATH}
            fill="none"
            stroke="#000"
            strokeWidth="3.12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <circle cx="50" cy="50" r={PULSE_DISC_R} fill={discFill} mask={`url(#${maskId})`} />
    </svg>
  );
};

interface PulseWordmarkProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * PulseWordmark — "PULSE" in Syne 800, uppercase, +0.06em tracking (the landing
 * hero lockup). Colour is inherited (currentColor) so callers theme it: ink in
 * light mode, white in dark. Syne is loaded globally via index.html.
 */
export const PulseWordmark: React.FC<PulseWordmarkProps> = ({ className, style }) => (
  <span
    className={className}
    style={{
      fontFamily: "'Syne','Inter',system-ui,sans-serif",
      fontWeight: 800,
      letterSpacing: '0.06em',
      lineHeight: 1,
      ...style,
    }}
  >
    PULSE
  </span>
);

export default PulseMark;

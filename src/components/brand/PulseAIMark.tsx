/**
 * PulseAIMark — the Pulse AI logo (dark-mode lockup).
 *
 * The Globe·Solid mark on its black monitor tile: a black disc + rose ring,
 * a rose→pink gradient disc, and the heartbeat *knocked out to black*. A white
 * light rides the cardiogram slit — the "live signal" cue for the AI assistant.
 *
 * Shares geometry with <PulseMark/> (PULSE_HEARTBEAT_PATH / PULSE_DISC_R).
 */
import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { PULSE_HEARTBEAT_PATH, PULSE_DISC_R } from './PulseMark';
import './PulseAIMark.css';

interface PulseAIMarkProps {
  /** Rendered width & height. Default 28. */
  size?: number | string;
  className?: string;
  /** Run the white-light sweep. Default true (still respects reduced-motion). */
  animated?: boolean;
  /** Draw the black tile + rose ring. Off when dropped into a host that already
   *  provides a dark frame (e.g. the sidebar button) so the knockout reveals it. */
  frame?: boolean;
}

export const PulseAIMark: React.FC<PulseAIMarkProps> = ({
  size = 28,
  className,
  animated = true,
  frame = true,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const gradId = `paig-${uid}`;
  const maskId = `paim-${uid}`;
  const clipId = `paic-${uid}`;
  const glowId = `paigl-${uid}`;

  const reduce = useReducedMotion();
  const live = animated && !reduce;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
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
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r={PULSE_DISC_R} />
        </clipPath>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dark-mode frame: black monitor tile + rose ring */}
      {frame && (
        <>
          <circle cx="50" cy="50" r="50" fill="#0d0d0d" />
          <circle cx="50" cy="50" r="48.5" fill="none" stroke="rgba(244,63,94,0.45)" strokeWidth="1.5" />
        </>
      )}

      {/* Gradient disc with the heartbeat knocked out to black */}
      <circle cx="50" cy="50" r={PULSE_DISC_R} fill={`url(#${gradId})`} mask={`url(#${maskId})`} />

      {/* White light in the cutout */}
      <g clipPath={`url(#${clipId})`}>
        {/* faint always-on glow so the slit reads alive even when static */}
        <path
          d={PULSE_HEARTBEAT_PATH}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.16"
        />
        {live ? (
          /* a bright white light rides the cardiogram */
          <path
            className="pai-sweep"
            d={PULSE_HEARTBEAT_PATH}
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />
        ) : (
          /* reduced-motion / static: the cutout centre lit white */
          <circle cx="50" cy="50" r="2.6" fill="#ffffff" filter={`url(#${glowId})`} opacity="0.9" />
        )}
      </g>
    </svg>
  );
};

export default PulseAIMark;

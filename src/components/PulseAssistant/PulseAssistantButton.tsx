import React from 'react';
import { motion } from 'framer-motion';
import './PulseAssistantButton.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const shortcutLabel = isMac ? '⌘/' : 'Ctrl+/';

// ECG path — same waveform shape as the panel header icon
const ECG_PATH = 'M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32';

// Path segment lengths (for proportional timing of the dot)
// Segments: (8,32)→(18,32)=10  (18,32)→(24,16)=17.1  (24,16)→(32,48)=33  (32,48)→(40,24)=25.3  (40,24)→(48,40)=17.9  (48,40)→(56,32)=11.3  total≈114.6
const DOT_KX   = [8, 18, 24, 32, 40, 48, 56];
const DOT_KY   = [32, 32, 16, 48, 24, 40, 32];
const DOT_T    = [0, 0.087, 0.236, 0.524, 0.744, 0.900, 1.0];
const DOT_OPAC = [1,  1,    1,    1,     1,     1,    0];   // fade out just before loop reset

// Stroke-dashoffset sweep: dasharray "25 90" (period=115≈path length) sweeps left→right
// Animating dashoffset 0 → -115 (one full period) creates a seamless infinite loop
const SWEEP_DURATION = 1.8; // seconds

interface PulseAssistantButtonProps {
  onClick: () => void;
  isOpen: boolean;
  hasProactiveSuggestion?: boolean;
  collapsed: boolean;
}

export const PulseAssistantButton: React.FC<PulseAssistantButtonProps> = ({
  onClick,
  isOpen,
  hasProactiveSuggestion = false,
  collapsed,
}) => {
  return (
    <button
      type="button"
      className={`pa-sidebar-btn ${isOpen ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      title={collapsed ? `Pulse AI (${shortcutLabel})` : undefined}
      aria-label="Toggle Pulse AI assistant"
      aria-expanded={isOpen}
    >
      {/* Icon container */}
      <motion.div
        className="pa-btn-icon"
        whileHover={{ y: -2, boxShadow: '0 6px 20px rgba(244, 63, 94, 0.55)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <svg
          viewBox="0 0 64 64"
          width="22"
          height="22"
          aria-hidden="true"
          className="pa-ecg-svg"
        >
          <defs>
            {/* Glow filter for the sweep line */}
            <filter id="pa-ecg-line-glow" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Stronger glow for the leading dot */}
            <filter id="pa-ecg-dot-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Dim base trace — faint rose ghost of the full waveform ── */}
          <path
            d={ECG_PATH}
            stroke="rgba(244, 63, 94, 0.22)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* ── Live sweep — rose-pink trail scans left→right ── */}
          <path
            d={ECG_PATH}
            stroke="#f43f5e"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#pa-ecg-line-glow)"
            className="pa-ecg-sweep"
          />

          {/* ── Glowing dot at the leading edge — hot rose-pink ──
              `initial` is required when animating SVG attributes via keyframe
              arrays — without it framer-motion's motion-value system briefly
              resolves cx/cy to undefined during interpolation setup, which
              React stringifies to "undefined" on the DOM attribute and the
              SVG layout engine warns. */}
          <motion.circle
            r="3.2"
            fill="#ff7096"
            filter="url(#pa-ecg-dot-glow)"
            initial={{ cx: DOT_KX[0], cy: DOT_KY[0], opacity: DOT_OPAC[0] }}
            animate={{
              cx: DOT_KX,
              cy: DOT_KY,
              opacity: DOT_OPAC,
            }}
            transition={{
              duration: SWEEP_DURATION,
              ease: 'linear',
              times: DOT_T,
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
        </svg>

        {/* Proactive suggestion badge */}
        {hasProactiveSuggestion && (
          <span className="pa-btn-badge" aria-hidden="true" />
        )}
      </motion.div>

      {!collapsed && (
        <>
          <span className="pa-btn-label">Pulse AI</span>
          <span className="pa-btn-shortcut">{shortcutLabel}</span>
        </>
      )}
    </button>
  );
};

// src/components/settings/EcosystemAppLogo.tsx
// Animated SVG brand marks for Ecosystem Bridge apps
// Each is a self-contained inline SVG — no external deps, works offline

import React from 'react';

interface EcosystemAppLogoProps {
  app: 'pulse' | 'entomate' | 'logos_vision';
  size?: number;
  className?: string;
}

export const EcosystemAppLogo: React.FC<EcosystemAppLogoProps> = ({
  app, size = 40, className = ''
}) => {
  const uid = `eco-${app}`;

  if (app === 'pulse') return <PulseLogo size={size} uid={uid} className={className} />;
  if (app === 'entomate') return <EntomateLogo size={size} uid={uid} className={className} />;
  return <LogosVisionLogo size={size} uid={uid} className={className} />;
};

// ─────────────────────────────────────────────────────────────────────────────
// PULSE — Heartbeat waveform on dark slate, coral-rose gradient
// Faithful to the actual favicon.svg brand mark
// Animation: travelling glow along the waveform
// ─────────────────────────────────────────────────────────────────────────────
function PulseLogo({ size, uid, className }: { size: number; uid: string; className: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      style={{ borderRadius: size * 0.21 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e1030" />
        </linearGradient>
        <linearGradient id={`${uid}-wave`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        {/* Glowing dot that travels the path */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f9a8d4" stopOpacity="1" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-blur`}>
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* Background */}
      <rect width="48" height="48" rx="10" fill={`url(#${uid}-bg)`} />

      {/* Glow halo behind waveform */}
      <path
        d="M4 24 L12 24 L16 14 L24 34 L32 18 L36 28 L44 24"
        stroke="#f43f5e"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.18"
        filter={`url(#${uid}-blur)`}
      />

      {/* Waveform — base */}
      <path
        d="M4 24 L12 24 L16 14 L24 34 L32 18 L36 28 L44 24"
        stroke={`url(#${uid}-wave)`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Travelling shimmer overlay */}
      <path
        d="M4 24 L12 24 L16 14 L24 34 L32 18 L36 28 L44 24"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="8 60"
        opacity="0.7"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="68" to="-68"
          dur="1.8s"
          repeatCount="indefinite"
          calcMode="linear"
        />
      </path>

      {/* Peak dot */}
      <circle cx="24" cy="34" r="2" fill="#fb7185">
        <animate attributeName="r" values="2;3;2" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.5;1" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTOMATE — Faithful to actual logo:
//   Two stacked horizontal bars (signal/EQ style) with circuit dots on right end
//   Dark background, crimson-rose brand color
//   Animation: bars pulse in sequence (like an EQ meter), dots glow
// ─────────────────────────────────────────────────────────────────────────────
function EntomateLogo({ size, uid, className }: { size: number; uid: string; className: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      style={{ borderRadius: size * 0.21 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#130008" />
          <stop offset="100%" stopColor="#1c0010" />
        </linearGradient>
        <linearGradient id={`${uid}-bar`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff2d6b" />
          <stop offset="100%" stopColor="#ff6b9d" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${uid}-dotglow`} x="-80%" y="-80%" width="360%" height="360%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="48" height="48" rx="10" fill={`url(#${uid}-bg)`} />

      {/* === Top bar (longer) === */}
      <rect x="10" y="16" width="22" height="4" rx="2" fill={`url(#${uid}-bar)`} filter={`url(#${uid}-glow)`}>
        <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" begin="0s" repeatCount="indefinite" />
      </rect>
      {/* Top bar circuit dot */}
      <circle cx="35" cy="18" r="3" fill="#ff2d6b" filter={`url(#${uid}-dotglow)`}>
        <animate attributeName="r" values="3;4;3" dur="1.6s" begin="0s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.5;1" dur="1.6s" begin="0s" repeatCount="indefinite" />
      </circle>

      {/* === Bottom bar (slightly shorter) === */}
      <rect x="10" y="28" width="17" height="4" rx="2" fill={`url(#${uid}-bar)`} filter={`url(#${uid}-glow)`}>
        <animate attributeName="opacity" values="0.55;1;0.55" dur="1.6s" begin="0.8s" repeatCount="indefinite" />
      </rect>
      {/* Bottom bar circuit dot */}
      <circle cx="30" cy="30" r="3" fill="#ff6b9d" filter={`url(#${uid}-dotglow)`}>
        <animate attributeName="r" values="3;4;3" dur="1.6s" begin="0.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;1;0.5" dur="1.6s" begin="0.8s" repeatCount="indefinite" />
      </circle>

      {/* Subtle connecting thread between dots */}
      <line x1="35" y1="21" x2="30" y2="27" stroke="#ff2d6b" strokeWidth="0.8" strokeDasharray="1.5 2" opacity="0.3" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOS VISION — Faithful to actual logo:
//   Concentric rings (sonar/radar/ripple motif) in teal-cyan on black
//   Colors: #0dcfba / #08b5a0 teal-cyan, near-black bg
//   Animation: rings pulse outward like sonar waves
// ─────────────────────────────────────────────────────────────────────────────
function LogosVisionLogo({ size, uid, className }: { size: number; uid: string; className: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      style={{ borderRadius: size * 0.21 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#031a18" />
          <stop offset="100%" stopColor="#010d0c" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="48" height="48" rx="10" fill={`url(#${uid}-bg)`} />

      {/* Outer ring — most transparent, pulses last */}
      <circle cx="24" cy="24" r="18" stroke="#0dcfba" strokeWidth="1.2" fill="none" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0.5;0.25" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
        <animate attributeName="r" values="18;19;18" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
      </circle>

      {/* Second ring */}
      <circle cx="24" cy="24" r="13" stroke="#0dcfba" strokeWidth="1.4" fill="none" opacity="0.45">
        <animate attributeName="opacity" values="0.45;0.7;0.45" dur="2.4s" begin="0.3s" repeatCount="indefinite" />
        <animate attributeName="r" values="13;14;13" dur="2.4s" begin="0.3s" repeatCount="indefinite" />
      </circle>

      {/* Third ring */}
      <circle cx="24" cy="24" r="8" stroke="#0dcfba" strokeWidth="1.6" fill="none" opacity="0.65">
        <animate attributeName="opacity" values="0.65;0.9;0.65" dur="2.4s" begin="0s" repeatCount="indefinite" />
        <animate attributeName="r" values="8;9;8" dur="2.4s" begin="0s" repeatCount="indefinite" />
      </circle>

      {/* Centre dot — brightest */}
      <circle cx="24" cy="24" r="3" fill="#0dcfba" filter={`url(#${uid}-glow)`}>
        <animate attributeName="r" values="3;3.8;3" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.7;1" dur="2.4s" repeatCount="indefinite" />
      </circle>

      {/* Sonar sweep — single rotating line segment */}
      <line x1="24" y1="24" x2="24" y2="6" stroke="#0dcfba" strokeWidth="1" opacity="0.4"
        strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate"
          from="0 24 24" to="360 24 24"
          dur="4s" repeatCount="indefinite" calcMode="linear" />
      </line>
    </svg>
  );
}

export default EcosystemAppLogo;

import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const LightningIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--lightning ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes lightning-flash {
        0%, 90%, 100% { opacity: 1; filter: none; }
        92% { opacity: 0.3; filter: drop-shadow(0 0 6px #fbbf24cc); }
        94% { opacity: 1; filter: drop-shadow(0 0 8px #fbbf24); }
        96% { opacity: 0.5; }
        98% { opacity: 1; filter: drop-shadow(0 0 4px #fbbf2488); }
      }
      @keyframes lightning-spark {
        0% { filter: drop-shadow(0 0 0px #fbbf24); transform: scale(1); }
        40% { filter: drop-shadow(0 0 10px #fbbf24); transform: scale(1.15); }
        100% { filter: drop-shadow(0 0 2px #fbbf2444); transform: scale(1); }
      }
      .pulse-icon--lightning { animation: lightning-flash 3s ease-in-out infinite; }
      .pulse-icon--lightning:hover { animation: lightning-spark 0.35s ease-out; }
    `}</style>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l2-8z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

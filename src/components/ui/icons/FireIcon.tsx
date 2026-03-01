import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const FireIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--fire ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes fire-flicker {
        0%, 100% { transform: scaleY(1) skewX(0deg); }
        25% { transform: scaleY(1.04) skewX(1deg); }
        50% { transform: scaleY(0.97) skewX(-1.5deg); }
        75% { transform: scaleY(1.05) skewX(0.5deg); }
      }
      @keyframes fire-burst {
        0% { transform: scale(1); filter: none; }
        40% { transform: scale(1.2); filter: drop-shadow(0 0 8px #f97316aa); }
        100% { transform: scale(1); filter: none; }
      }
      .pulse-icon--fire { transform-origin: bottom center; animation: fire-flicker 0.9s ease-in-out infinite; }
      .pulse-icon--fire:hover { animation: fire-burst 0.4s ease-out; }
    `}</style>
    <path d="M12 2c0 0-1 4-4 6.5C6 11 5 13 5 15a7 7 0 0014 0c0-3-2-5-3-6-1 2-2 2.5-2 2.5S15 9 12 2z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M12 13c0 0-2 1-2 3a2.5 2.5 0 005 0c0-1.5-1-2-1-2S13.5 15 12 13z" fill={color} fillOpacity="0.5" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

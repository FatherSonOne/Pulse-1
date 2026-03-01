import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const TrophyIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--trophy ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes trophy-shimmer {
        0%, 100% { filter: drop-shadow(0 0 0px #fbbf24); }
        50% { filter: drop-shadow(0 0 4px #fbbf2466); }
      }
      @keyframes trophy-shine {
        0% { filter: drop-shadow(0 0 0px #fbbf24); }
        40% { filter: drop-shadow(0 0 10px #fbbf24cc); }
        100% { filter: drop-shadow(0 0 3px #fbbf2444); }
      }
      .pulse-icon--trophy { animation: trophy-shimmer 3s ease-in-out infinite; }
      .pulse-icon--trophy:hover { animation: trophy-shine 0.5s ease-out forwards; }
    `}</style>
    <path d="M8 2h8v7a4 4 0 01-8 0V2z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M4 5h4M20 5h-4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M8 11c0 0-1 1-1 3h10c0-2-1-3-1-3" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <rect x="9" y="14" width="6" height="3" rx="0.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
    <line x1="7" y1="21" x2="17" y2="21" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

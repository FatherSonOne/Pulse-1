import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const KeyboardIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--keyboard ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes kb-press {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(1px); }
      }
      @keyframes kb-type {
        0% { transform: scale(1); }
        30% { transform: scale(0.97) translateY(1px); }
        100% { transform: scale(1); }
      }
      .pulse-icon--keyboard { animation: kb-press 3s ease-in-out infinite; }
      .pulse-icon--keyboard:hover { animation: kb-type 0.2s ease-out; }
    `}</style>
    <rect x="2" y="6" width="20" height="12" rx="2" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" />
    <line x1="6" y1="10" x2="6" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="10" y1="10" x2="10" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="14" y1="10" x2="14" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="18" y1="10" x2="18" y2="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="6" y1="14" x2="6" y2="14" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="18" y1="14" x2="18" y2="14" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="9" y1="14" x2="15" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

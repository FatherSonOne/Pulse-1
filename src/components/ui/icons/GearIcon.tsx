import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const GearIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--gear ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes gear-spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes gear-spin-fast {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .pulse-icon--gear .gear-body {
        transform-origin: 12px 12px;
        animation: gear-spin-slow 8s linear infinite;
      }
      .pulse-icon--gear:hover .gear-body {
        animation: gear-spin-fast 1s linear infinite;
      }
    `}</style>
    <g className="gear-body">
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.7" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.08" />
    </g>
  </svg>
);

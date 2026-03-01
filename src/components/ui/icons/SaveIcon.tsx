import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const SaveIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--save ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes save-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.04); }
      }
      @keyframes save-click {
        0% { transform: scale(1); }
        30% { transform: scale(0.93); }
        70% { transform: scale(1.06); }
        100% { transform: scale(1); }
      }
      .pulse-icon--save { animation: save-pulse 3s ease-in-out infinite; }
      .pulse-icon--save:hover { animation: save-click 0.3s ease-out; }
    `}</style>
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <polyline points="17,21 17,13 7,13 7,21" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    <polyline points="7,3 7,8 15,8" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

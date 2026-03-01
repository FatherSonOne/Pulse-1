import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const ClipboardIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--clipboard ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes clip-bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1.5px); }
      }
      @keyframes clip-open {
        0%, 100% { transform: translateY(0) scale(1); }
        40% { transform: translateY(-2px) scale(1.05); }
      }
      .pulse-icon--clipboard { animation: clip-bob 3s ease-in-out infinite; }
      .pulse-icon--clipboard:hover { animation: clip-open 0.35s ease-out; }
    `}</style>
    <rect x="8" y="2" width="8" height="4" rx="1.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke={color} strokeWidth="1.7" strokeLinejoin="round" fill={color} fillOpacity="0.08" />
    <line x1="8" y1="11" x2="16" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
    <line x1="8" y1="15" x2="13" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
  </svg>
);

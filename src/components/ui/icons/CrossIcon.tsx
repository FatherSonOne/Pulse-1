import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const CrossIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--cross ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes cross-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(0.95); }
      }
      @keyframes cross-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-3px); }
        40% { transform: translateX(3px); }
        60% { transform: translateX(-2px); }
        80% { transform: translateX(2px); }
      }
      .pulse-icon--cross { animation: cross-pulse 3s ease-in-out infinite; }
      .pulse-icon--cross:hover { animation: cross-shake 0.4s ease-in-out; }
    `}</style>
    <circle cx="12" cy="12" r="10" fill="#ef444420" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
    <path d="M8 8l8 8M16 8l-8 8" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

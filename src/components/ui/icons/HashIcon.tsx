import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const HashIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--hash ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes hash-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.75; transform: scale(0.97); }
      }
      @keyframes hash-pop {
        0% { transform: scale(1); }
        40% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      .pulse-icon--hash { animation: hash-pulse 3s ease-in-out infinite; }
      .pulse-icon--hash:hover { animation: hash-pop 0.3s ease-out; }
    `}</style>
    <line x1="4" y1="9" x2="20" y2="9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="4" y1="15" x2="20" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="10" y1="3" x2="8" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="3" x2="14" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

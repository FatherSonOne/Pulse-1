import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const LaptopIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--laptop ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes laptop-idle {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1.5px); }
      }
      @keyframes laptop-open {
        0% { transform: scale(1); }
        30% { transform: scale(1.06) translateY(-2px); }
        100% { transform: scale(1); }
      }
      .pulse-icon--laptop { animation: laptop-idle 3.5s ease-in-out infinite; }
      .pulse-icon--laptop:hover { animation: laptop-open 0.4s ease-out; }
    `}</style>
    <rect x="2" y="4" width="20" height="13" rx="2" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" />
    <rect x="5" y="7" width="14" height="7" rx="1" fill={color} fillOpacity="0.15" />
    <path d="M2 19l1.5-2h17l1.5 2H2z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <line x1="9" y1="19" x2="15" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

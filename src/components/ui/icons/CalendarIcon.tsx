import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const CalendarIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--calendar ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes cal-idle {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1.5px); }
      }
      @keyframes cal-flip {
        0% { transform: scale(1) rotate(0deg); }
        30% { transform: scale(1.06) rotate(-3deg); }
        70% { transform: scale(1.03) rotate(1deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .pulse-icon--calendar { animation: cal-idle 3.5s ease-in-out infinite; }
      .pulse-icon--calendar:hover { animation: cal-flip 0.4s ease-out; }
    `}</style>
    <rect x="3" y="4" width="18" height="18" rx="2" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" />
    <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
    <circle cx="8" cy="15" r="1" fill={color} />
    <circle cx="12" cy="15" r="1" fill={color} />
    <circle cx="16" cy="15" r="1" fill={color} />
  </svg>
);

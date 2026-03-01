import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const MobileIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--mobile ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes mobile-vibrate {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        20% { transform: translateX(-2px) rotate(-2deg); }
        40% { transform: translateX(2px) rotate(2deg); }
        60% { transform: translateX(-1.5px) rotate(-1deg); }
        80% { transform: translateX(1.5px) rotate(1deg); }
      }
      @keyframes mobile-idle {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1.5px); }
      }
      .pulse-icon--mobile { animation: mobile-idle 3s ease-in-out infinite; }
      .pulse-icon--mobile:hover { animation: mobile-vibrate 0.5s ease-in-out; }
    `}</style>
    <rect x="5" y="2" width="14" height="20" rx="2.5" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" />
    <line x1="9" y1="6" x2="15" y2="6" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.4" />
    <circle cx="12" cy="18.5" r="1.2" fill={color} fillOpacity="0.6" />
    <rect x="8" y="9" width="8" height="5" rx="1" fill={color} fillOpacity="0.2" />
  </svg>
);

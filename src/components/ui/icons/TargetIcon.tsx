import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const TargetIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--target ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes target-ripple {
        0% { r: 9; opacity: 0.5; }
        100% { r: 11; opacity: 0; }
      }
      @keyframes target-zoom {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      .pulse-icon--target .outer-ring {
        animation: target-ripple 2.5s ease-out infinite;
      }
      .pulse-icon--target:hover {
        animation: target-zoom 0.4s ease-out;
      }
    `}</style>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" strokeOpacity="0.25" />
    <circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
    <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.8" />
    <circle cx="12" cy="12" r="1.2" fill={color} />
    <circle className="outer-ring" cx="12" cy="12" r="9" stroke={color} strokeWidth="1" strokeOpacity="0" fill="none" />
  </svg>
);

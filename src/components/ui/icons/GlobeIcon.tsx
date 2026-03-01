import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const GlobeIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--globe ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes globe-spin {
        0% { transform: rotateY(0deg); }
        100% { transform: rotateY(360deg); }
      }
      @keyframes globe-idle {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(5deg); }
      }
      @keyframes globe-hover {
        0% { transform: scale(1) rotate(0deg); }
        50% { transform: scale(1.08) rotate(10deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .pulse-icon--globe { animation: globe-idle 4s ease-in-out infinite; }
      .pulse-icon--globe:hover { animation: globe-hover 0.6s ease-out; }
    `}</style>
    <circle cx="12" cy="12" r="10" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" />
    <path d="M2 12h20" stroke={color} strokeWidth="1.4" strokeOpacity="0.6" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke={color} strokeWidth="1.4" />
    <path d="M4.93 7h14.14M4.93 17h14.14" stroke={color} strokeWidth="1.2" strokeOpacity="0.4" strokeLinecap="round" />
  </svg>
);

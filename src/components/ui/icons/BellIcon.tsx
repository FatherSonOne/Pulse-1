import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const BellIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--bell ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', transformOrigin: 'top center' }}
  >
    <style>{`
      @keyframes bell-sway {
        0%, 100% { transform: rotate(0deg); }
        20% { transform: rotate(8deg); }
        40% { transform: rotate(-8deg); }
        60% { transform: rotate(5deg); }
        80% { transform: rotate(-5deg); }
        90% { transform: rotate(0deg); }
      }
      @keyframes bell-ring {
        0%, 100% { transform: rotate(0deg); }
        10% { transform: rotate(12deg); }
        20% { transform: rotate(-12deg); }
        30% { transform: rotate(10deg); }
        40% { transform: rotate(-10deg); }
        50% { transform: rotate(6deg); }
        60% { transform: rotate(-6deg); }
        70% { transform: rotate(0deg); }
      }
      .pulse-icon--bell {
        transform-origin: 12px 4px;
        animation: bell-sway 4s ease-in-out infinite;
        animation-delay: 1.5s;
      }
      .pulse-icon--bell:hover {
        animation: bell-ring 0.6s ease-in-out;
      }
    `}</style>
    <path d="M18 11a6 6 0 00-12 0v3l-2 2v1h16v-1l-2-2v-3z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M10 18a2 2 0 004 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="4" r="1" fill={color} />
  </svg>
);

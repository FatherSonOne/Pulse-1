import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const TagIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--tag ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes tag-wiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-5deg); }
        75% { transform: rotate(5deg); }
      }
      @keyframes tag-snap {
        0% { transform: rotate(0deg) scale(1); }
        30% { transform: rotate(-10deg) scale(1.1); }
        70% { transform: rotate(5deg) scale(1.05); }
        100% { transform: rotate(0deg) scale(1); }
      }
      .pulse-icon--tag { animation: tag-wiggle 4s ease-in-out infinite; }
      .pulse-icon--tag:hover { animation: tag-snap 0.4s ease-out; }
    `}</style>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="7" cy="7" r="1.5" fill={color} />
  </svg>
);

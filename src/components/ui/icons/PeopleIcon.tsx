import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const PeopleIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--people ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes people-sway {
        0%, 100% { transform: translateX(0); }
        33% { transform: translateX(-1px); }
        66% { transform: translateX(1px); }
      }
      @keyframes people-gather {
        0% { transform: scale(1); }
        50% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      .pulse-icon--people { animation: people-sway 3.5s ease-in-out infinite; }
      .pulse-icon--people:hover { animation: people-gather 0.35s ease-out; }
    `}</style>
    <circle cx="9" cy="7" r="3" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.6" />
    <circle cx="17" cy="8" r="2.5" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.4" />
    <path d="M1 21v-1a8 8 0 0116 0v1" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M17 11c2.7.5 5 2.5 5 5v1" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

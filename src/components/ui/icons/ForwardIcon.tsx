import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const ForwardIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--forward ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes fwd-arc {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(2px); }
      }
      @keyframes fwd-launch {
        0% { transform: scale(1) rotate(0deg); }
        30% { transform: scale(1.08) rotate(8deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .pulse-icon--forward { animation: fwd-arc 3s ease-in-out infinite; }
      .pulse-icon--forward:hover { animation: fwd-launch 0.4s ease-out; }
    `}</style>
    <polyline points="15,17 20,12 15,7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 18v-2a4 4 0 014-4h12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

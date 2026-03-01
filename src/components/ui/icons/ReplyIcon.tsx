import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const ReplyIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--reply ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes reply-arc {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(-2px); }
      }
      @keyframes reply-swing {
        0% { transform: scale(1) rotate(0deg); }
        30% { transform: scale(1.08) rotate(-8deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .pulse-icon--reply { animation: reply-arc 3s ease-in-out infinite; }
      .pulse-icon--reply:hover { animation: reply-swing 0.4s ease-out; }
    `}</style>
    <polyline points="9,17 4,12 9,7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 18v-2a4 4 0 00-4-4H4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

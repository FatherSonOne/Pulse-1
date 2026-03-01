import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const StarIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--star ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes star-twinkle {
        0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
        25% { transform: scale(1.08) rotate(5deg); opacity: 0.9; }
        75% { transform: scale(0.96) rotate(-5deg); opacity: 0.85; }
      }
      @keyframes star-burst {
        0% { transform: scale(1) rotate(0deg); filter: none; }
        40% { transform: scale(1.25) rotate(15deg); filter: drop-shadow(0 0 6px #fbbf24cc); }
        100% { transform: scale(1) rotate(0deg); filter: none; }
      }
      .pulse-icon--star { animation: star-twinkle 2.8s ease-in-out infinite; }
      .pulse-icon--star:hover { animation: star-burst 0.4s ease-out; }
    `}</style>
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

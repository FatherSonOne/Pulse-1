import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const RocketIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--rocket ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes rocket-float {
        0%, 100% { transform: translateY(0) rotate(-45deg); }
        50% { transform: translateY(-2.5px) rotate(-45deg); }
      }
      @keyframes rocket-launch {
        0% { transform: translateY(0) rotate(-45deg); opacity: 1; }
        60% { transform: translateY(-8px) rotate(-45deg); opacity: 0.6; }
        100% { transform: translateY(0) rotate(-45deg); opacity: 1; }
      }
      @keyframes flame-flicker {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
      }
      .pulse-icon--rocket { animation: rocket-float 2.2s ease-in-out infinite; }
      .pulse-icon--rocket:hover { animation: rocket-launch 0.5s ease-out; }
      .pulse-icon--rocket .flame { animation: flame-flicker 0.5s ease-in-out infinite; }
    `}</style>
    <g transform="rotate(-45 12 12)">
      <path d="M12 2C12 2 7 7 7 13h10C17 7 12 2 12 2z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <rect x="9" y="13" width="6" height="4" rx="1" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
      <path className="flame" d="M10 17c0 2-1.5 3-1.5 3s0-2 1-2.5M14 17c0 2 1.5 3 1.5 3s0-2-1-2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="10" r="2" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.4" />
    </g>
  </svg>
);

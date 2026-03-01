import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const WarningIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--warning ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes warning-glow {
        0%, 100% { filter: drop-shadow(0 0 0px #f59e0b); opacity: 1; }
        50% { filter: drop-shadow(0 0 4px #f59e0b88); opacity: 0.85; }
      }
      @keyframes warning-urgency {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        15% { transform: translateX(-3px) rotate(-3deg); }
        30% { transform: translateX(3px) rotate(3deg); }
        45% { transform: translateX(-2px) rotate(-2deg); }
        60% { transform: translateX(2px) rotate(2deg); }
        75% { transform: translateX(0) rotate(0deg); }
      }
      .pulse-icon--warning { animation: warning-glow 2.5s ease-in-out infinite; }
      .pulse-icon--warning:hover { animation: warning-urgency 0.5s ease-in-out; }
    `}</style>
    <path d="M12 3L2 20h20L12 3z" fill="#f59e0b22" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="12" cy="16.5" r="1.1" fill={color} />
  </svg>
);

import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const HookIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--hook ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes hook-sway {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(5deg); }
        75% { transform: rotate(-5deg); }
      }
      @keyframes hook-catch {
        0% { transform: rotate(0deg); }
        40% { transform: rotate(15deg); }
        100% { transform: rotate(0deg); }
      }
      .pulse-icon--hook { transform-origin: 12px 3px; animation: hook-sway 3s ease-in-out infinite; }
      .pulse-icon--hook:hover { animation: hook-catch 0.4s ease-out; }
    `}</style>
    <path d="M12 3v10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M12 13c0 4 6 5 6 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 22c-2 0-4-1-4-3s2-3 4-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="3" r="1.5" fill={color} />
  </svg>
);

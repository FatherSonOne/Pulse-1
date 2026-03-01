import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const LinkIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--link ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes link-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      @keyframes link-connect {
        0% { transform: scale(1) rotate(0deg); }
        50% { transform: scale(1.1) rotate(-5deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .pulse-icon--link { animation: link-pulse 2.8s ease-in-out infinite; }
      .pulse-icon--link:hover { animation: link-connect 0.4s ease-out; }
    `}</style>
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

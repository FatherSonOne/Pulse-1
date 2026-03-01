import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const EditIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--edit ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes edit-idle {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(-5deg) translateY(-1px); }
      }
      @keyframes edit-write {
        0% { transform: rotate(0deg) scale(1); }
        30% { transform: rotate(-8deg) scale(1.08) translateY(-2px); }
        100% { transform: rotate(0deg) scale(1); }
      }
      .pulse-icon--edit { transform-origin: 20px 20px; animation: edit-idle 3s ease-in-out infinite; }
      .pulse-icon--edit:hover { animation: edit-write 0.4s ease-out; }
    `}</style>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

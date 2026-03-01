import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const CheckIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--check ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes check-bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
      }
      @keyframes check-draw {
        0% { stroke-dashoffset: 30; opacity: 0.4; }
        100% { stroke-dashoffset: 0; opacity: 1; }
      }
      .pulse-icon--check {
        animation: check-bounce 2.8s ease-in-out infinite;
      }
      .pulse-icon--check:hover {
        animation: none;
      }
      .pulse-icon--check:hover .check-path {
        animation: check-draw 0.35s ease-out forwards;
      }
      .check-path {
        stroke-dasharray: 30;
        stroke-dashoffset: 0;
      }
      .check-circle {
        fill: #22c55e22;
      }
    `}</style>
    <circle cx="12" cy="12" r="10" className="check-circle" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
    <path
      className="check-path"
      d="M7 12.5l3.5 3.5 6.5-7"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

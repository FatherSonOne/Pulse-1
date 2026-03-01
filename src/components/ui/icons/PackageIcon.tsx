import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const PackageIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--package ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes pkg-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
      }
      @keyframes pkg-unwrap {
        0% { transform: scale(1) rotate(0deg); }
        30% { transform: scale(1.08) rotate(-3deg); }
        70% { transform: scale(1.05) rotate(2deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .pulse-icon--package { animation: pkg-float 3s ease-in-out infinite; }
      .pulse-icon--package:hover { animation: pkg-unwrap 0.4s ease-out; }
    `}</style>
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <polyline points="3.27,6.96 12,12.01 20.73,6.96" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="22.08" x2="12" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const ToolsIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--tools ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes tools-idle {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(5deg); }
      }
      @keyframes tools-work {
        0% { transform: rotate(0deg); }
        25% { transform: rotate(-15deg); }
        75% { transform: rotate(15deg); }
        100% { transform: rotate(0deg); }
      }
      .pulse-icon--tools { transform-origin: 12px 12px; animation: tools-idle 3s ease-in-out infinite; }
      .pulse-icon--tools:hover { animation: tools-work 0.5s ease-in-out; }
    `}</style>
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 17l3 3" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

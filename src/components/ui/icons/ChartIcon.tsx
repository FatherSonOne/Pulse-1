import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const ChartIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--chart ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes bar1-grow {
        0%, 100% { transform: scaleY(1); }
        50% { transform: scaleY(0.75); }
      }
      @keyframes bar2-grow {
        0%, 100% { transform: scaleY(1); }
        50% { transform: scaleY(1.15); }
      }
      @keyframes bar3-grow {
        0%, 100% { transform: scaleY(1); }
        50% { transform: scaleY(0.85); }
      }
      @keyframes bars-sequence {
        0%, 100% { transform: scaleY(1); }
        33% { transform: scaleY(1.3); }
        66% { transform: scaleY(0.7); }
      }
      .pulse-icon--chart .b1 { transform-origin: bottom; animation: bar1-grow 2.4s ease-in-out infinite; }
      .pulse-icon--chart .b2 { transform-origin: bottom; animation: bar2-grow 2.4s ease-in-out infinite 0.3s; }
      .pulse-icon--chart .b3 { transform-origin: bottom; animation: bar3-grow 2.4s ease-in-out infinite 0.6s; }
      .pulse-icon--chart:hover .b1 { animation: bars-sequence 0.6s ease-in-out; }
      .pulse-icon--chart:hover .b2 { animation: bars-sequence 0.6s ease-in-out 0.1s; }
      .pulse-icon--chart:hover .b3 { animation: bars-sequence 0.6s ease-in-out 0.2s; }
    `}</style>
    <rect className="b1" x="3" y="12" width="4" height="9" rx="1" fill={color} fillOpacity="0.7" />
    <rect className="b2" x="10" y="7" width="4" height="14" rx="1" fill={color} />
    <rect className="b3" x="17" y="10" width="4" height="11" rx="1" fill={color} fillOpacity="0.85" />
    <line x1="2" y1="21.5" x2="22" y2="21.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

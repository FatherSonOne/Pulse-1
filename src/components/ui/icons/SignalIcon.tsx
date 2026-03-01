import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const SignalIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--signal ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes signal-radiate {
        0%, 100% { opacity: 0.2; transform: scale(0.9); }
        50% { opacity: 0.8; transform: scale(1.05); }
      }
      @keyframes signal-burst {
        0% { opacity: 1; }
        50% { opacity: 0.3; transform: scale(1.15); }
        100% { opacity: 1; }
      }
      .pulse-icon--signal .ring1 { animation: signal-radiate 1.5s ease-in-out infinite; }
      .pulse-icon--signal .ring2 { animation: signal-radiate 1.5s ease-in-out infinite 0.3s; }
      .pulse-icon--signal .ring3 { animation: signal-radiate 1.5s ease-in-out infinite 0.6s; }
      .pulse-icon--signal:hover { animation: signal-burst 0.4s ease-out; }
    `}</style>
    <circle cx="12" cy="12" r="2" fill={color} />
    <path className="ring1" d="M8.5 8.5a5 5 0 017 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path className="ring1" d="M15.5 8.5a5 5 0 00-7 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path className="ring2" d="M5.5 5.5a9 9 0 0113 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    <path className="ring2" d="M18.5 5.5a9 9 0 00-13 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    <path className="ring3" d="M2.5 2.5a14 14 0 0119 19" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" strokeOpacity="0.5" />
    <path className="ring3" d="M21.5 2.5a14 14 0 00-19 19" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" strokeOpacity="0.5" />
  </svg>
);

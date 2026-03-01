import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const ChatIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--chat ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes dot-type {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-3px); opacity: 1; }
      }
      @keyframes bubble-pop {
        0% { transform: scale(1); }
        40% { transform: scale(1.12); }
        100% { transform: scale(1); }
      }
      .pulse-icon--chat .d1 { animation: dot-type 1.6s ease-in-out infinite; }
      .pulse-icon--chat .d2 { animation: dot-type 1.6s ease-in-out infinite 0.25s; }
      .pulse-icon--chat .d3 { animation: dot-type 1.6s ease-in-out infinite 0.5s; }
      .pulse-icon--chat:hover { animation: bubble-pop 0.3s ease-out; }
    `}</style>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    <circle className="d1" cx="8.5" cy="12" r="1.1" fill={color} />
    <circle className="d2" cx="12" cy="12" r="1.1" fill={color} />
    <circle className="d3" cx="15.5" cy="12" r="1.1" fill={color} />
  </svg>
);

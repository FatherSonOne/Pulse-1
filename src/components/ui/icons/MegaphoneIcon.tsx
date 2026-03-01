import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const MegaphoneIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--megaphone ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes mega-broadcast {
        0%, 100% { transform: rotate(0deg); }
        10% { transform: rotate(-3deg); }
        20% { transform: rotate(3deg); }
        30% { transform: rotate(-2deg); }
        40% { transform: rotate(0deg); }
      }
      @keyframes mega-shout {
        0% { transform: scale(1) rotate(0deg); }
        30% { transform: scale(1.1) rotate(-5deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      @keyframes fade-wave {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 0.7; }
      }
      .pulse-icon--megaphone { animation: mega-broadcast 4s ease-in-out infinite; }
      .pulse-icon--megaphone:hover { animation: mega-shout 0.4s ease-out; }
      .wave-1 { animation: fade-wave 1.5s ease-in-out infinite; }
      .wave-2 { animation: fade-wave 1.5s ease-in-out infinite 0.3s; }
    `}</style>
    <path d="M9 10l9-5v12l-9-5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <rect x="3" y="9" width="6" height="6" rx="1" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
    <path d="M6 19v-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path className="wave-1" d="M19 8c1 1 1.5 2.5 1.5 3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path className="wave-2" d="M21 6c1.5 1.5 2.5 3.5 2.5 5.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

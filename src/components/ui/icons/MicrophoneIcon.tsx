import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const MicrophoneIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--microphone ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes mic-wave {
        0%, 100% { transform: scaleX(1); opacity: 0.4; }
        50% { transform: scaleX(1.15); opacity: 0.8; }
      }
      @keyframes mic-glow {
        0% { filter: drop-shadow(0 0 0px #a855f7); }
        40% { filter: drop-shadow(0 0 6px #a855f7aa); }
        100% { filter: drop-shadow(0 0 2px #a855f744); }
      }
      .pulse-icon--microphone .wave1 { animation: mic-wave 1.2s ease-in-out infinite; }
      .pulse-icon--microphone .wave2 { animation: mic-wave 1.2s ease-in-out infinite 0.2s; }
      .pulse-icon--microphone:hover { animation: mic-glow 0.5s ease-out forwards; }
    `}</style>
    <rect x="9" y="2" width="6" height="11" rx="3" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.7" />
    <path d="M19 11a7 7 0 01-14 0" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <line x1="8" y1="22" x2="16" y2="22" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <line className="wave1" x1="9" y1="7" x2="15" y2="7" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5" style={{ transformOrigin: '12px 7px' }} />
    <line className="wave2" x1="9" y1="9.5" x2="15" y2="9.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5" style={{ transformOrigin: '12px 9.5px' }} />
  </svg>
);

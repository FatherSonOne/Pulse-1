import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const PinIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--pin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes pin-drop {
        0%, 100% { transform: translateY(0); }
        30% { transform: translateY(-3px); }
        60% { transform: translateY(1px); }
      }
      @keyframes pin-stick {
        0% { transform: scale(1) translateY(0); }
        40% { transform: scale(1.1) translateY(-4px); }
        70% { transform: scale(0.95) translateY(2px); }
        100% { transform: scale(1) translateY(0); }
      }
      .pulse-icon--pin { animation: pin-drop 3.5s ease-in-out infinite; }
      .pulse-icon--pin:hover { animation: pin-stick 0.4s ease-out; }
    `}</style>
    <path d="M12 2a5 5 0 015 5c0 4-5 11-5 11S7 11 7 7a5 5 0 015-5z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="2" fill={color} fillOpacity="0.5" stroke={color} strokeWidth="1.4" />
  </svg>
);

import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const LightbulbIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--lightbulb ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes bulb-glow {
        0%, 100% { filter: drop-shadow(0 0 0px #fbbf24); }
        50% { filter: drop-shadow(0 0 5px #fbbf2466); }
      }
      @keyframes bulb-flash {
        0% { filter: drop-shadow(0 0 0px #fbbf24); }
        30% { filter: drop-shadow(0 0 8px #fbbf24cc); }
        100% { filter: drop-shadow(0 0 2px #fbbf2444); }
      }
      .pulse-icon--lightbulb { animation: bulb-glow 2.5s ease-in-out infinite; }
      .pulse-icon--lightbulb:hover { animation: bulb-flash 0.4s ease-out forwards; }
      .bulb-fill { fill: #fbbf2422; }
      .pulse-icon--lightbulb:hover .bulb-fill { fill: #fbbf2455; }
    `}</style>
    <path className="bulb-fill" d="M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9 18h6M10 21h4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M12 6v2M8.5 7.5l1.5 1.5M15.5 7.5l-1.5 1.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.5" />
  </svg>
);

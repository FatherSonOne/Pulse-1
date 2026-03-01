import React from 'react';

interface GamepadIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const GamepadIcon: React.FC<GamepadIconProps> = ({
  size = 18,
  color = 'currentColor',
  className = '',
}) => (
  <>
    <style>{`
      @keyframes gamepad-idle {
        0%, 100% { transform: rotate(-4deg); }
        50% { transform: rotate(4deg); }
      }
      @keyframes gamepad-hover {
        0% { transform: scale(1); }
        40% { transform: scale(1.2) rotate(-8deg); }
        70% { transform: scale(1.1) rotate(6deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .pulse-icon--gamepad {
        display: inline-block;
        animation: gamepad-idle 3s ease-in-out infinite;
      }
      .pulse-icon--gamepad:hover {
        animation: gamepad-hover 0.4s ease-out forwards;
      }
    `}</style>
    <svg
      className={`pulse-icon--gamepad ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Controller body */}
      <rect x="2" y="8" width="20" height="10" rx="5" />
      {/* D-pad */}
      <line x1="7" y1="11" x2="7" y2="15" />
      <line x1="5" y1="13" x2="9" y2="13" />
      {/* Buttons */}
      <circle cx="16" cy="11" r="1" fill={color} />
      <circle cx="19" cy="13" r="1" fill={color} />
      <circle cx="16" cy="15" r="1" fill={color} />
    </svg>
  </>
);

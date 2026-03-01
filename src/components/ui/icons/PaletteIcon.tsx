import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const PaletteIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--palette ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes palette-spin {
        0%, 100% { transform: rotate(0deg); }
        50% { transform: rotate(8deg); }
      }
      @keyframes palette-whirl {
        0% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(15deg) scale(1.08); }
        100% { transform: rotate(0deg) scale(1); }
      }
      .pulse-icon--palette { transform-origin: 12px 12px; animation: palette-spin 4s ease-in-out infinite; }
      .pulse-icon--palette:hover { animation: palette-whirl 0.5s ease-out; }
    `}</style>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.6" />
    <circle cx="6.5" cy="11.5" r="1.5" fill={color} fillOpacity="0.6" />
    <circle cx="9.5" cy="7.5" r="1.5" fill={color} fillOpacity="0.7" />
    <circle cx="14.5" cy="7.5" r="1.5" fill={color} fillOpacity="0.8" />
    <circle cx="17.5" cy="11.5" r="1.5" fill={color} />
  </svg>
);

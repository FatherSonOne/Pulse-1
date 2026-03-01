import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const EmailIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--email ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes email-slide {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1.5px); }
      }
      @keyframes email-open {
        0% { transform: scaleY(1); }
        50% { transform: scaleY(0.85); }
        100% { transform: scaleY(1); }
      }
      .pulse-icon--email { animation: email-slide 3s ease-in-out infinite; }
      .pulse-icon--email:hover { animation: email-open 0.35s ease-out; }
    `}</style>
    <rect x="2" y="5" width="20" height="14" rx="2" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" />
    <path d="M2 7l10 7 10-7" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

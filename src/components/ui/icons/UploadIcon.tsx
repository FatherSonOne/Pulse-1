import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const UploadIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--upload ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes upload-arrow {
        0%, 100% { transform: translateY(0); }
        40% { transform: translateY(-3px); }
        70% { transform: translateY(1px); }
      }
      @keyframes upload-send {
        0% { transform: translateY(0); opacity: 1; }
        60% { transform: translateY(-5px); opacity: 0.5; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .pulse-icon--upload .arrow { animation: upload-arrow 2s ease-in-out infinite; }
      .pulse-icon--upload:hover .arrow { animation: upload-send 0.5s ease-out; }
    `}</style>
    <polyline className="arrow" points="16,16 12,12 8,16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line className="arrow" x1="12" y1="12" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

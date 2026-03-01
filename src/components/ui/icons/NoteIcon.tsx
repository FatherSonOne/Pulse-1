import React from 'react';

interface Props { size?: number; className?: string; color?: string; }

export const NoteIcon: React.FC<Props> = ({ size = 20, className = '', color = 'currentColor' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={`pulse-icon pulse-icon--note ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <style>{`
      @keyframes note-write {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1px); }
      }
      @keyframes note-scribble {
        0% { transform: scale(1) rotate(0deg); }
        30% { transform: scale(1.05) rotate(-2deg); }
        70% { transform: scale(1.03) rotate(1deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .pulse-icon--note { animation: note-write 3s ease-in-out infinite; }
      .pulse-icon--note:hover { animation: note-scribble 0.4s ease-out; }
      .line1 { animation: line-appear 3s ease-in-out infinite; }
      .line2 { animation: line-appear 3s ease-in-out infinite 0.4s; }
      @keyframes line-appear {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 0.9; }
      }
    `}</style>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <polyline points="14 2 14 8 20 8" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    <line className="line1" x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line className="line2" x1="8" y1="17" x2="13" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

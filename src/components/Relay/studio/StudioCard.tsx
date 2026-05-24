// Reusable card wrapper for studio-pattern message rows.
//
// Replaces ad-hoc card markup in the 6 mode bodies once they migrate.
// Until then, exported as a primitive so new code can adopt it piecemeal.

import React from 'react';

import './studio-card.css';

export interface StudioCardProps {
  /** Active = the card whose voice is currently nowPlaying. Gets the
   *  coral 1px ring + glow shadow. */
  active?: boolean;
  /** Click handler — usually starts playback. */
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  /** Render as <button>, so keyboard + screen readers get a real
   *  interactive control. Default false (use plain <div>). */
  asButton?: boolean;
}

export const StudioCard: React.FC<StudioCardProps> = ({
  active = false,
  onClick,
  className = '',
  children,
  asButton = false,
}) => {
  const cls = `pulse-studio-card ${active ? 'pulse-studio-card--active' : ''} ${className}`;
  if (asButton) {
    return (
      <button type="button" onClick={onClick} className={cls} data-active={active || undefined}>
        {children}
      </button>
    );
  }
  return (
    <div onClick={onClick} className={cls} data-active={active || undefined}>
      {children}
    </div>
  );
};

export default StudioCard;

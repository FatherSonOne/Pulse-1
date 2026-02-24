import React, { useEffect, useState } from 'react';
import './MiniConfetti.css';

interface MiniConfettiProps {
  trigger: boolean;
  onComplete?: () => void;
}

/**
 * Phase 7.2: Mini Confetti Component
 *
 * Lightweight CSS-only confetti burst for task completion celebrations.
 * No external library needed - pure CSS animations.
 */
export const MiniConfetti: React.FC<MiniConfettiProps> = ({ trigger, onComplete }) => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsActive(true);

      // Reset after animation completes
      const timer = setTimeout(() => {
        setIsActive(false);
        onComplete?.();
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!isActive) return null;

  // Generate 6 confetti particles
  const particles = Array.from({ length: 6 }, (_, i) => i);

  return (
    <div className="mini-confetti-container">
      {particles.map((index) => (
        <div
          key={index}
          className={`confetti-particle confetti-particle-${index}`}
        />
      ))}
    </div>
  );
};

export default MiniConfetti;

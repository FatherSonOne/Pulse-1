/**
 * TypingIndicator Component
 * Shows when a user is typing in the conversation
 * Phase 4.4: User Presence Indicators
 *
 * Version: 1.0
 * Date: 2026-02-11
 */

import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  userName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  userName,
  size = 'md',
  className = '',
}) => {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs';
  const padding = size === 'sm' ? 'px-2 py-1' : size === 'lg' ? 'px-4 py-2' : 'px-3 py-1.5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2 ${padding} bg-[#f2f2f2] dark:bg-[rgba(255,255,255,0.055)] rounded-full ${className}`}
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={`${dotSize} rounded-full bg-zinc-400 dark:bg-zinc-500`}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: index * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className={`${textSize} text-zinc-600 dark:text-zinc-400 font-medium`}>
        {userName} is typing...
      </span>
    </motion.div>
  );
};

/**
 * Compact typing indicator (just the dots)
 */
export const TypingIndicatorDots: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={`${dotSize} rounded-full bg-zinc-400 dark:bg-zinc-500`}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

export default React.memo(TypingIndicator);

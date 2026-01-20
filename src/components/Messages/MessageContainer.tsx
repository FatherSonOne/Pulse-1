import React, { ReactNode, memo } from 'react';

interface MessageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * MessageContainer - Main layout wrapper for Messages component
 * Provides consistent container styling and layout structure
 */
export const MessageContainer = memo<MessageContainerProps>(({ children, className = '' }) => {
  return (
    <div
      className={`h-full flex bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative animate-fade-in shadow-xl ${className}`}
    >
      {children}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(100%);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
});

MessageContainer.displayName = 'MessageContainer';

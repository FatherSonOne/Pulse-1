import React, { ReactNode, memo } from 'react';

interface MessageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * MessageContainer - Main layout wrapper for Messages component
 * Provides consistent container styling and layout structure.
 *
 * Keyframes (slideInRight, slideOutRight, fade-in, scale-in) and the
 * .animate-fade-in / .animate-scale-in classes used here live in
 * messages.css — no per-mount inline <style> injection.
 */
export const MessageContainer = memo<MessageContainerProps>(({ children, className = '' }) => {
  return (
    <div
      className={`h-full flex bg-[var(--pulse-canvas)] rounded-2xl overflow-hidden border border-[var(--pulse-border)] relative animate-fade-in shadow-xl ${className}`}
    >
      {children}
    </div>
  );
});

MessageContainer.displayName = 'MessageContainer';

import React from 'react';
import { formatSmartTimestamp, formatFullTimestamp } from '../../utils/dateUtils';

interface SmartTimestampProps {
  date: Date;
  className?: string;
}

/**
 * SmartTimestamp - Displays a smart, context-aware timestamp
 *
 * Features:
 * - Relative time for recent messages ("5 min ago")
 * - Absolute time for older messages ("10:30 AM")
 * - Full timestamp on hover
 * - Minimal, unobtrusive styling
 *
 * Performance: Optimized with React.memo() to prevent unnecessary re-renders
 */
export const SmartTimestamp: React.FC<SmartTimestampProps> = React.memo(({ date, className = '' }) => {
  const smartTime = formatSmartTimestamp(date);
  const fullTime = formatFullTimestamp(date);

  return (
    <span
      className={`text-[10px] text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-500 transition-colors ${className}`}
      title={fullTime}
    >
      {smartTime}
    </span>
  );
}, (prevProps, nextProps) => {
  // Only re-render if date or className changes
  return prevProps.date.getTime() === nextProps.date.getTime() && 
         prevProps.className === nextProps.className;
});

import React from 'react';

interface DateDividerProps {
  date: Date;
  label: string;
}

/**
 * DateDivider - Displays a date separator between message groups
 *
 * Modern design inspired by Discord/Slack:
 * - Centered text with horizontal lines
 * - Sticky positioning option
 * - Subtle styling that doesn't distract from messages
 *
 * Performance: Optimized with React.memo() to prevent unnecessary re-renders
 */
export const DateDivider: React.FC<DateDividerProps> = React.memo(({ date, label }) => {
  return (
    <div className="date-divider flex items-center justify-center my-6 px-4">
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
      <div
        className="px-4 py-1.5 mx-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-sm"
        title={date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      >
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if label changes (date changes are reflected in label)
  return prevProps.label === nextProps.label;
});

/**
 * StickyDateDivider - Date divider that stays at top while scrolling
 * (Optional enhancement for future implementation)
 *
 * Performance: Optimized with React.memo()
 */
export const StickyDateDivider: React.FC<DateDividerProps> = React.memo(({ date, label }) => {
  return (
    <div className="sticky top-0 z-10 backdrop-blur-sm bg-white/80 dark:bg-zinc-950/80 py-2 px-4">
      <div className="flex items-center justify-center">
        <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-sm">
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.label === nextProps.label;
});

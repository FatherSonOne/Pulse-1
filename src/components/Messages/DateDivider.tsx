import React from 'react';

interface DateDividerProps {
  date: Date;
  label: string;
}

/**
 * DateDivider — Pulse Coral Cockpit divider.
 *
 * Replaces the centered-pill / two-line pattern with a left-aligned mono
 * label preceded by a coral pulse-dot, then a single hairline that runs
 * out to the right. Reads as a section anchor, not a chat-app separator.
 *
 * Performance: Optimized with React.memo() to prevent unnecessary re-renders
 */
export const DateDivider: React.FC<DateDividerProps> = React.memo(({ date, label }) => {
  return (
    <div
      className="date-divider"
      title={date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    >
      <span className="date-divider-dot" aria-hidden="true" />
      <span className="date-divider-label">{label}</span>
      <span className="date-divider-line" aria-hidden="true" />
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
    <div className="sticky top-0 z-10 bg-[#f8f8f8]/95 dark:bg-black/95 py-2 px-4">
      <div className="date-divider">
        <span className="date-divider-dot" aria-hidden="true" />
        <span
          className="date-divider-label"
          title={date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        >
          {label}
        </span>
        <span className="date-divider-line" aria-hidden="true" />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.label === nextProps.label;
});

import React from 'react';

interface GlanceTileShellProps {
  label: string;
  headline: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
  ariaLabel?: string;
}

/**
 * Shared shell for the four glance tiles on the Today panel. Small fixed-height
 * card, no chevron, no collapse — at-a-glance state only. Mono uppercase label
 * + larger headline + optional body. Click navigates to the relevant section.
 */
const GlanceTileShell: React.FC<GlanceTileShellProps> = ({
  label,
  headline,
  onClick,
  children,
  ariaLabel,
}) => {
  const inner = (
    <div className="flex flex-col gap-2 h-full">
      <span className="pulse-label text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
        {headline}
      </div>
      {children && <div className="mt-auto pt-1">{children}</div>}
    </div>
  );

  const className =
    'bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-xl p-3 sm:p-4 min-h-[112px] transition-colors duration-150';

  if (onClick) {
    return (
      <button
        onClick={onClick}
        aria-label={ariaLabel || label}
        className={`${className} text-left w-full hover:border-rose-500/30 dark:hover:border-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={className} aria-label={ariaLabel || label}>
      {inner}
    </div>
  );
};

export default GlanceTileShell;

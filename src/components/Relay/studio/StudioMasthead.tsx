// StudioMasthead — the shared section header for every Relay Voice Studio
// surface. Replaces the per-mode VoxModeToolbar / VoxModeHeader chrome.
//
// The Path C pattern (see _design-playground/relay-redesign.html → "C · Voice
// Studio"): a mono uppercase eyebrow ("RELAY · INBOX", "PERSONAL NOTES",
// "LIVE NOW · 2 ROOMS", …), a text-3xl title, and an optional one-line
// subtitle. `tone="rose"` tints the eyebrow for live / active sources
// (Live, Broadcast) per the coral budget — coral is signal, never chrome.
// `right` carries title-baseline controls (Inbox's status toggle + source
// dropdown). Direct / Channel use their own conversation-pane headers, not
// this masthead.

import React from 'react';

export interface StudioMastheadProps {
  /** Mono eyebrow, e.g. "Relay · Inbox" — rendered uppercase via tracking. */
  eyebrow: React.ReactNode;
  /** Big section title (text-3xl). */
  title: React.ReactNode;
  /** Optional one-line subtitle under the title. */
  subtitle?: React.ReactNode;
  /** 'rose' tints the eyebrow coral/rose for live / active sources; default
   *  is neutral ink. Coral budget: reserve rose for live + active state. */
  tone?: 'default' | 'rose';
  /** Optional leading glyph in the eyebrow (a live dot, a radio icon). */
  eyebrowIcon?: React.ReactNode;
  /** Right-aligned controls aligned to the title baseline (Inbox filters). */
  right?: React.ReactNode;
  className?: string;
}

export const StudioMasthead: React.FC<StudioMastheadProps> = ({
  eyebrow,
  title,
  subtitle,
  tone = 'default',
  eyebrowIcon,
  right,
  className = '',
}) => {
  const eyebrowColor =
    tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-zinc-500 dark:text-zinc-400';

  return (
    <header className={`mb-5 ${className}`}>
      <div
        className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${eyebrowColor}`}
      >
        {eyebrowIcon}
        <span>{eyebrow}</span>
      </div>
      {/* flex-wrap so the title-baseline controls (Inbox status toggle + source
          dropdown) drop below the title at phone width instead of overflowing;
          a no-op on desktop where the row has room. */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mt-1">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
          {title}
        </h1>
        {right && <div className="flex items-center gap-2 shrink-0 max-w-full overflow-x-auto">{right}</div>}
      </div>
      {subtitle && (
        <div className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">{subtitle}</div>
      )}
    </header>
  );
};

export default StudioMasthead;

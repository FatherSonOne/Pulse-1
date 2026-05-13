// PanelShell — unified chrome for COACH-tier inline panels (AI Coach,
// AI Mediator, Insights). Replaces ad-hoc per-component chrome with a
// single surface that follows the Pulse design system:
//   - Translucent surface over true black (dark) or paper-pure (light)
//   - JetBrains Mono provenance chip in uppercase tracked 0.1em
//   - Coral-only signal (no purple/cyan/violet)
//   - 1px hairline border, 12px radius
//   - Inter title at body weight, no gradient text

import React from 'react';
import { X } from 'lucide-react';

interface PanelShellProps {
  /** Provenance label suffix (e.g., "COACH", "MEDIATOR", "INSIGHTS"). The
   *  chip renders as "PULSE AI · {source}" by default. */
  source: string;
  /** Plain-English panel title in body type. */
  title: string;
  /** Optional one-line subtitle / context. */
  subtitle?: string;
  /** Dismiss handler. Hides the X button when omitted. */
  onDismiss?: () => void;
  /** Right-aligned action slot for refresh / settings / etc. */
  actions?: React.ReactNode;
  /** Panel body. */
  children: React.ReactNode;
  /** Extra classes on the outer container. */
  className?: string;
  /** Whether to prefix the chip with "PULSE AI · ". Default true. */
  attributedToAI?: boolean;
}

export const PanelShell: React.FC<PanelShellProps> = ({
  source,
  title,
  subtitle,
  onDismiss,
  actions,
  children,
  className = '',
  attributedToAI = true,
}) => (
  <section
    className={`bg-white dark:bg-[rgba(255,255,255,0.03)] ring-1 ring-[rgba(0,0,0,0.08)] dark:ring-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden ${className}`}
    role="region"
    aria-label={title}
  >
    {/* Header */}
    <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
      <div className="min-w-0">
        <div className="font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-rose-600 dark:text-rose-bright">
          {attributedToAI ? `PULSE AI · ${source.toUpperCase()}` : source.toUpperCase()}
        </div>
        <h3 className="mt-0.5 text-[15px] font-medium text-zinc-900 dark:text-zinc-50 leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {actions}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={`Dismiss ${title}`}
            className="w-7 h-7 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-bright hover:bg-rose-500/[0.08] dark:hover:bg-rose-500/[0.10] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>

    {/* Body */}
    <div className="px-4 pb-4">{children}</div>
  </section>
);

export default PanelShell;

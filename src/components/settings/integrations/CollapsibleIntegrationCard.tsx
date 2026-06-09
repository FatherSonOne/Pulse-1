import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleIntegrationCardProps {
  /** Header content: the brand .integration-icon + .integration-info blocks. */
  summary: React.ReactNode;
  /** Optional status pill rendered at the right of the summary row. */
  badge?: React.ReactNode;
  /** Start expanded. Pass !connected so connected integrations collapse to a row. */
  defaultOpen?: boolean;
  /** Forwarded to the outer .integration-card (e.g. the connected borderColor). */
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
}

/**
 * CollapsibleIntegrationCard — wraps the existing .integration-card shell so an
 * integration collapses to its header row (icon + name + status pill + chevron)
 * and expands to the full body on click. Uncontrolled (owns its open state), so
 * each card opts in (collapsed by default — the header row shows the at-a-glance
 * state; pass `defaultOpen` to override) and there is no parent accordion /
 * single-open coupling.
 *
 * Reuses the repo's grid-template-rows collapse (.widget-collapse-grid /
 * .widget-spring in index.css). The body stays MOUNTED when collapsed, so a
 * card's state and effects are never thrashed by toggling. Body height animates
 * via the grid trick (not raw height); the chevron rotates via transform.
 * Respects the Settings.css prefers-reduced-motion block (degrades to instant).
 */
export const CollapsibleIntegrationCard: React.FC<CollapsibleIntegrationCardProps> = ({
  summary,
  badge,
  defaultOpen = false,
  style,
  className,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`integration-card collapsible-integration${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <button
        type="button"
        className="integration-header collapsible-integration__summary"
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} integration details`}
        onClick={() => setOpen((o) => !o)}
      >
        {summary}
        {badge}
        <ChevronDown
          className={`collapsible-integration__chevron widget-spring${open ? ' rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div className="widget-collapse-grid" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div style={{ overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleIntegrationCard;

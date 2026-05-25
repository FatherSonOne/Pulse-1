import React from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  Clock,
  Scale,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import { RelationshipData, formatDuration } from './useRelationshipData';

/**
 * RelationshipRail — Path D (Signal Composer) "remembers the relationship"
 * rail. Read-only first: open items, the last decision, and reply pace for
 * the active contact (MESSAGES_REDESIGN_HANDOFF_2026-05-24, step 4).
 *
 * Host-agnostic and presentational — it consumes a derived `RelationshipData`
 * (see useRelationshipData) and owns only its collapsed/expanded chrome. Both
 * Messages surfaces (legacy monolith + V2 MessagesSplitView) render it.
 *
 * Tokens only (--pulse-*). Status tones (positive / warning / overdue) carry
 * decision + open-item state — never coral, which stays reserved for AI
 * output. The decision card uses a full 1px tone border + tinted fill (NOT a
 * side-stripe — that pattern is banned by DESIGN.md).
 */

interface RelationshipRailProps {
  data: RelationshipData;
  /** Contact display name, used in the empty-state copy. */
  contactName?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** When provided, open-item rows become interactive (Path D step "make
   *  open-items interactive"). Omitted = static read-only rows. */
  onToggleOpenItem?: (id: string) => void;
  className?: string;
}

const sectionLabel =
  'font-mono uppercase tracking-[0.1em] text-[10px] font-medium text-zinc-500 dark:text-zinc-400';

const decisionTone: Record<
  'open' | 'approved' | 'rejected',
  { border: string; bg: string; fg: string; label: string }
> = {
  approved: {
    border: 'var(--pulse-tone-positive)',
    bg: 'var(--pulse-tone-positive-soft)',
    fg: 'var(--pulse-tone-positive)',
    label: 'Approved',
  },
  open: {
    border: 'var(--pulse-tone-warning)',
    bg: 'var(--pulse-tone-warning-soft)',
    fg: 'var(--pulse-tone-warning)',
    label: 'Open',
  },
  rejected: {
    border: 'var(--pulse-tone-overdue)',
    bg: 'var(--pulse-tone-overdue-soft)',
    fg: 'var(--pulse-tone-overdue)',
    label: 'Rejected',
  },
};

export const RelationshipRail: React.FC<RelationshipRailProps> = ({
  data,
  contactName,
  collapsed,
  onToggleCollapse,
  onToggleOpenItem,
  className = '',
}) => {
  const { openItems, lastDecision, pace } = data;
  const who = contactName?.trim() || 'this contact';

  // ── Collapsed: a slim re-open rail with an open-items count cue ──
  if (collapsed) {
    return (
      <aside
        className={`flex-shrink-0 w-11 border-l border-[var(--pulse-border)] bg-[var(--pulse-canvas)] flex flex-col items-center pt-4 gap-3 ${className}`}
        aria-label="Relationship (collapsed)"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Show relationship"
          aria-label="Show relationship panel"
          aria-expanded={false}
          className="w-8 h-8 rounded-md inline-flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
        >
          <PanelRightOpen className="w-4 h-4" aria-hidden="true" />
        </button>
        {openItems.length > 0 && (
          <span
            className="min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-[10px] font-mono font-semibold tabular-nums"
            style={{
              color: 'var(--pulse-tone-warning)',
              background: 'var(--pulse-tone-warning-soft)',
            }}
            title={`${openItems.length} open item${openItems.length === 1 ? '' : 's'}`}
          >
            {openItems.length}
          </span>
        )}
      </aside>
    );
  }

  // ── Expanded panel ──
  return (
    <aside
      className={`flex-shrink-0 w-[280px] border-l border-[var(--pulse-border)] bg-[var(--pulse-canvas)] flex flex-col overflow-y-auto ${className}`}
      aria-label="Relationship"
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <h3 className={sectionLabel}>Relationship</h3>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Hide relationship"
          aria-label="Hide relationship panel"
          aria-expanded
          className="w-7 h-7 rounded-md inline-flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
        >
          <PanelRightClose className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Open items */}
      <section className="px-4 pb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className={sectionLabel}>Open items</span>
          {openItems.length > 0 && (
            <span className="font-mono text-[10px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              · {openItems.length}
            </span>
          )}
        </div>
        {openItems.length === 0 ? (
          <p className="text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
            All clear — nothing open with {who}.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {openItems.map((item) => {
              const interactive = Boolean(onToggleOpenItem);
              const Row = interactive ? 'button' : 'div';
              return (
                <li key={item.id}>
                  <Row
                    {...(interactive
                      ? {
                          type: 'button' as const,
                          onClick: () => onToggleOpenItem?.(item.id),
                          'aria-label': `Mark "${item.title}" done`,
                        }
                      : {})}
                    className={`w-full flex items-start gap-2 text-left text-[13px] leading-snug text-zinc-800 dark:text-zinc-200 ${
                      interactive
                        ? 'rounded-md px-1.5 py-1 -mx-1.5 hover:bg-zinc-200/40 dark:hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40'
                        : ''
                    }`}
                  >
                    {interactive ? (
                      <Circle
                        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                        style={{ color: 'var(--pulse-tone-warning)' }}
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-60"
                        style={{ color: 'var(--pulse-tone-warning)' }}
                        aria-hidden="true"
                      />
                    )}
                    <span>{item.title}</span>
                  </Row>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Last decision — only when one exists */}
      {lastDecision && (
        <section className="px-4 pb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Scale className="w-3 h-3 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
            <span className={sectionLabel}>Last decision</span>
          </div>
          <div
            className="rounded-lg p-3"
            style={{
              border: `1px solid ${decisionTone[lastDecision.status].border}`,
              background: decisionTone[lastDecision.status].bg,
            }}
          >
            <p className="text-[13px] leading-snug text-zinc-800 dark:text-zinc-100">
              {lastDecision.text}
            </p>
            <span
              className="mt-2 inline-flex items-center font-mono uppercase tracking-[0.1em] text-[10px] font-semibold"
              style={{ color: decisionTone[lastDecision.status].fg }}
            >
              {decisionTone[lastDecision.status].label}
            </span>
          </div>
        </section>
      )}

      {/* Pace */}
      <section className="px-4 pb-5">
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="w-3 h-3 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
          <span className={sectionLabel}>Pace</span>
        </div>
        <dl className="flex flex-col gap-1.5">
          <PaceRow label="You reply" value={formatDuration(pace.youReplyMs)} />
          <PaceRow label="They reply" value={formatDuration(pace.themReplyMs)} />
          <PaceRow
            label="Volume"
            value={`${pace.volume.toLocaleString()} msg${pace.volume === 1 ? '' : 's'}`}
          />
        </dl>
      </section>
    </aside>
  );
};

const PaceRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between">
    <dt className="text-[13px] text-zinc-500 dark:text-zinc-400">{label}</dt>
    <dd className="font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
      {value}
    </dd>
  </div>
);

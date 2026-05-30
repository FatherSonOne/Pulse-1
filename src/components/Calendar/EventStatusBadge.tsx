/**
 * EventStatusBadge.tsx
 *
 * Pill badge indicating an event's status: tentative, confirmed, or cancelled.
 * Status colors use --pulse-tone-* tokens; labels use the mono uppercase
 * tracked vocabulary per DESIGN.md §3 (Mono-Label Rule).
 */

import React from 'react';

export type EventStatus = 'tentative' | 'confirmed' | 'cancelled';

interface EventStatusBadgeProps {
  status: EventStatus;
  size?: 'sm' | 'md';
}

const STATUS_TOKENS: Record<EventStatus, { bg: string; fg: string; border: string }> = {
  confirmed: {
    bg: 'var(--pulse-tone-positive-soft)',
    fg: 'var(--pulse-tone-positive)',
    border: 'var(--pulse-tone-positive-glow)',
  },
  tentative: {
    bg: 'var(--pulse-tone-warning-soft)',
    fg: 'var(--pulse-tone-warning)',
    border: 'var(--pulse-tone-warning-glow)',
  },
  cancelled: {
    bg: 'var(--pulse-tone-neutral-soft)',
    fg: 'var(--pulse-ink-3)',
    border: 'var(--pulse-tone-neutral-glow)',
  },
};

const STATUS_LABELS: Record<EventStatus, string> = {
  confirmed: 'Confirmed',
  tentative: 'Tentative',
  cancelled: 'Cancelled',
};

export const EventStatusBadge: React.FC<EventStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]';
  const tokens = STATUS_TOKENS[status];
  const lineThrough = status === 'cancelled' ? ' line-through' : '';
  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-semibold uppercase tracking-[0.1em] border${lineThrough} ${sizeClass}`}
      style={{
        backgroundColor: tokens.bg,
        color: tokens.fg,
        borderColor: tokens.border,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
};

export default EventStatusBadge;

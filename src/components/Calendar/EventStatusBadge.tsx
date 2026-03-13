/**
 * EventStatusBadge.tsx
 *
 * Pill badge indicating an event's status: tentative, confirmed, or cancelled.
 * Used in event detail panel and optionally on event pills.
 */

import React from 'react';

export type EventStatus = 'tentative' | 'confirmed' | 'cancelled';

interface EventStatusBadgeProps {
  status: EventStatus;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<EventStatus, string> = {
  confirmed:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  tentative:  'bg-amber-100  dark:bg-amber-900/30  text-amber-700  dark:text-amber-400',
  cancelled:  'bg-zinc-100   dark:bg-zinc-800       text-zinc-500   dark:text-zinc-400 line-through',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  confirmed: 'Confirmed',
  tentative: 'Tentative',
  cancelled: 'Cancelled',
};

export const EventStatusBadge: React.FC<EventStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
};

export default EventStatusBadge;

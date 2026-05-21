import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface CardSourceChipProps {
  /** Sender display name — preserved verbatim (never strip braces/hash). */
  senderName: string;
  /** ISO 8601 timestamp when the card was sent / received. */
  sentAt?: string | null;
}

function formatRelative(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.round(diffHr / 24);
  if (diffDays < 7) return diffDays === 1 ? 'yesterday' : `${diffDays}d`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.round(diffDays / 30)}mo`;
  return `${Math.round(diffDays / 365)}y`;
}

/**
 * Neutral provenance chip indicating a contact originated from an accepted
 * contact card. Used on:
 *   - `ReceivedCardListItem` (list row) — shows "From card" pill
 *   - `ContactDetail` header — shows when contact came in via card
 *
 * Visual:  pill, `--pulse-tone-neutral-soft` background, `--pulse-ink-2` text.
 * NOT coral — coral is reserved for the Received-tab badge only.
 *
 * Sender display name passes through verbatim per guardrail #1.
 */
export const CardSourceChip: React.FC<CardSourceChipProps> = ({ senderName, sentAt }) => {
  const { t } = useTranslation();
  const relative = useMemo(() => formatRelative(sentAt), [sentAt]);
  const tooltip = relative
    ? t('contacts.cards.sourceChip.tooltip_format', { sender: senderName, time: relative })
    : t('contacts.cards.sourceChip.label');

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: 'var(--pulse-tone-neutral-soft)',
        color: 'var(--pulse-ink-2)',
        lineHeight: 1.4,
      }}
      title={tooltip}
      aria-label={tooltip}
    >
      {t('contacts.cards.sourceChip.label')}
    </span>
  );
};

export default CardSourceChip;

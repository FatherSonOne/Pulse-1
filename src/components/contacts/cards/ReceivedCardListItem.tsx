import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MoreHorizontal } from 'lucide-react';
import type { ContactCard } from '../../../types/contactCard';
import { CardSourceChip } from './CardSourceChip';

export interface ReceivedCardListItemProps {
  card: ContactCard;
  /**
   * Display name of the sender as resolved server-side from auth.users.
   * Pass through verbatim — never strip `{`, `}`, `#`.
   */
  senderDisplayName: string;
  selected: boolean;
  unread?: boolean;
  /**
   * True if the card has been forwarded (forwarded_from_card_id !== null).
   */
  isForwarded?: boolean;
  onToggleSelect: (cardId: string) => void;
  onOpen: (cardId: string) => void;
  onMoreActions?: (cardId: string) => void;
}

function formatRelative(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diffMs = Date.now() - d.getTime();
  const min = Math.max(0, Math.round(diffMs / 60_000));
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.round(hr / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return d.toLocaleDateString();
}

function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const t1 = new Date(expiresAt).getTime();
  if (Number.isNaN(t1)) return null;
  const diff = t1 - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

function initialsFromName(name: string): string {
  // NOTE: We intentionally do NOT strip braces from `name` here. The
  // display name is preserved verbatim per guardrail #1. This helper
  // is allowed to skim non-letter chars only for avatar initials —
  // never for display.
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '?';
  const letters = tokens
    .map(tok => {
      const m = tok.match(/[A-Za-zÀ-ɏ]/);
      return m ? m[0] : '';
    })
    .filter(Boolean);
  if (letters.length === 0) return '?';
  return (letters[0] + (letters[1] ?? '')).toUpperCase();
}

/**
 * Single row in the Received inbox list (vision § Layout sketches § 3).
 *
 * 72px desktop / 80px mobile height; full-row checkbox touch target.
 * Unread rows show a leading rose dot. Expiring-soon rows show an
 * inline warning chip with `--pulse-tone-warning` text only (no
 * background — keeps list density readable).
 */
export const ReceivedCardListItem: React.FC<ReceivedCardListItemProps> = ({
  card,
  senderDisplayName,
  selected,
  unread = false,
  isForwarded = false,
  onToggleSelect,
  onOpen,
  onMoreActions,
}) => {
  const { t } = useTranslation();

  const subjectName = card.card_snapshot?.name?.trim() || '';
  const initials = useMemo(() => initialsFromName(subjectName), [subjectName]);
  const relative = useMemo(() => formatRelative(card.created_at), [card.created_at]);
  const expiryDays = useMemo(() => daysUntilExpiry(card.expires_at), [card.expires_at]);

  const sharedByText = isForwarded
    ? t('contacts.cards.receivedTab.row_forwarded_format', {
        sender: senderDisplayName,
        time: relative,
      })
    : t('contacts.cards.receivedTab.row_shared_by_format', {
        sender: senderDisplayName,
        time: relative,
      });

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpen(card.id);
    } else if (event.key === ' ') {
      event.preventDefault();
      onToggleSelect(card.id);
    }
  };

  return (
    <div
      role="listitem"
      className="flex items-center gap-3 px-3"
      style={{
        minHeight: 72,
        borderTop: '1px solid var(--pulse-border)',
        borderLeft: selected ? '2px solid var(--pulse-rose)' : '2px solid transparent',
        background: selected ? 'var(--pulse-surface-raised)' : 'transparent',
      }}
      onKeyDown={handleRowKeyDown}
    >
      {/* Selection checkbox — full-row hit area via wrapping label below. */}
      <label
        className="flex cursor-pointer items-center"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(card.id)}
          aria-label={t('contacts.cards.receivedTab.row_select_aria', { sender: senderDisplayName })}
          className="h-5 w-5"
        />
      </label>

      {/* Unread dot */}
      {unread ? (
        <span
          aria-label={t('contacts.cards.receivedTab.row_unread_aria')}
          role="img"
          style={{
            width: 6,
            height: 6,
            borderRadius: 9999,
            background: 'var(--pulse-rose)',
            flexShrink: 0,
          }}
        />
      ) : (
        <span aria-hidden="true" style={{ width: 6, flexShrink: 0 }} />
      )}

      {/* Avatar */}
      <button
        type="button"
        onClick={() => onOpen(card.id)}
        aria-label={t('contacts.cards.receivedTab.row_open_aria', { sender: senderDisplayName })}
        className="flex items-center justify-center rounded-full font-semibold"
        style={{
          width: 40,
          height: 40,
          background: card.card_snapshot?.avatar_color || 'var(--pulse-surface-raised)',
          color: 'var(--pulse-ink)',
          flexShrink: 0,
          border: '1px solid var(--pulse-border)',
        }}
      >
        {initials}
      </button>

      {/* Content (clickable) */}
      <button
        type="button"
        onClick={() => onOpen(card.id)}
        className="flex-1 text-left"
        style={{ minHeight: 44 }}
      >
        <div className="flex items-center gap-2">
          <span
            className="truncate font-semibold"
            style={{ color: 'var(--pulse-ink)' }}
            // Preserve display name verbatim — guardrail #1
          >
            {subjectName}
          </span>
          <CardSourceChip senderName={senderDisplayName} sentAt={card.created_at} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--pulse-ink-2)' }}>
          <span className="truncate">{sharedByText}</span>
        </div>
        {expiryDays !== null && expiryDays <= 3 && (
          <div
            className="mt-0.5 inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--pulse-tone-warning)' }}
          >
            <AlertTriangle size={12} aria-hidden="true" />
            {expiryDays <= 1
              ? t('contacts.cards.receivedTab.row_expires_format_one')
              : t('contacts.cards.receivedTab.row_expires_format_other', { count: expiryDays })}
          </div>
        )}
      </button>

      {/* More actions */}
      <button
        type="button"
        onClick={() => onMoreActions?.(card.id)}
        aria-label={t('contacts.cards.receivedTab.row_more_aria')}
        className="inline-flex items-center justify-center rounded-lg"
        style={{ minWidth: 44, minHeight: 44, color: 'var(--pulse-ink-2)' }}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
    </div>
  );
};

export default ReceivedCardListItem;

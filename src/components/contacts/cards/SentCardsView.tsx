import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  type ContactCard,
  deriveSentCardStatus,
  canUnsend,
  type SentCardStatus,
} from '../../../types/contactCard';
import contactCardService from '../../../services/contactCardService';
import { RevokeCardConfirmation } from './RevokeCardConfirmation';

interface SentCardsViewProps {
  /**
   * Pre-loaded cards. When omitted, the view loads via the
   * contactCardService on mount.
   */
  initialCards?: ContactCard[];
  onBack?: () => void;
}

type FilterValue = 'all' | 'active' | 'revoked' | 'expired';

function formatRelative(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString();
}

function statusLabel(status: SentCardStatus, t: (k: string) => string): string {
  switch (status) {
    case 'active':
      return t('contacts.cards.sentList.status_not_viewed');
    case 'viewed':
      return t('contacts.cards.sentList.status_viewed');
    case 'revoked':
      return t('contacts.cards.sentList.status_revoked');
    case 'expired':
      return t('contacts.cards.sentList.status_expired');
  }
}

/**
 * Sender's audit list (vision § Layout sketches § 7).
 *
 * Per accord R-23 AC-23-3, status is binary — "Viewed" / "Not yet viewed",
 * NEVER the numeric `view_count`. Unsend button renders only when
 * `canUnsend(card)` is true; otherwise Revoke. Both go through the same
 * RevokeCardConfirmation modal.
 */
export const SentCardsView: React.FC<SentCardsViewProps> = ({ initialCards, onBack }) => {
  const { t } = useTranslation();
  const [cards, setCards] = useState<ContactCard[]>(initialCards ?? []);
  const [loading, setLoading] = useState(!initialCards);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [revokingCard, setRevokingCard] = useState<ContactCard | null>(null);
  const [revokingMode, setRevokingMode] = useState<'unsend' | 'revoke'>('revoke');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fresh = await contactCardService.fetchSent();
      setCards(fresh);
    } catch (err) {
      console.warn('[SentCardsView] fetchSent failed:', err);
      setLoadError(t('contacts.cards.sentList.error_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (initialCards) return;
    void load();
  }, [initialCards, load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return cards;
    return cards.filter(c => {
      const s = deriveSentCardStatus(c);
      if (filter === 'active') return s === 'active' || s === 'viewed';
      if (filter === 'revoked') return s === 'revoked';
      if (filter === 'expired') return s === 'expired';
      return true;
    });
  }, [cards, filter]);

  const handleRevoked = () => {
    void load();
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="px-4 pt-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: 'var(--pulse-ink-2)', minHeight: 44 }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t('contacts.cards.receivedDetail.back_cta')}
          </button>
        )}
        <h1 className="mt-3 text-xl font-bold" style={{ color: 'var(--pulse-ink)' }}>
          {t('contacts.cards.sentList.title')}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
          {t('contacts.cards.sentList.subtitle')}
        </p>
      </div>

      {/* Filter row */}
      <div
        role="tablist"
        aria-label={t('contacts.cards.sentList.filter_label')}
        className="mt-3 flex gap-1 px-4"
      >
        {(['all', 'active', 'revoked', 'expired'] as FilterValue[]).map(value => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            type="button"
            onClick={() => setFilter(value)}
            className="rounded-lg px-3 text-sm font-medium"
            style={{
              minHeight: 44,
              background: filter === value ? 'var(--pulse-surface-raised)' : 'transparent',
              color: filter === value ? 'var(--pulse-ink)' : 'var(--pulse-ink-2)',
              border:
                filter === value
                  ? '1px solid var(--pulse-border)'
                  : '1px solid transparent',
            }}
          >
            {t(`contacts.cards.sentList.filter_${value}`)}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="mt-3">
        {loading ? (
          <div className="px-4 py-4 flex items-center gap-2 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {t('contacts.cards.share.sending_state')}
          </div>
        ) : loadError ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-lg px-4 font-semibold"
              style={{
                minHeight: 44,
                background: 'var(--pulse-rose)',
                color: 'var(--pulse-surface)',
              }}
            >
              {t('contacts.cards.sentList.error_retry_cta')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <h3 className="text-base font-semibold" style={{ color: 'var(--pulse-ink)' }}>
              {t('contacts.cards.sentList.empty_title')}
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
              {t('contacts.cards.sentList.empty_body')}
            </p>
          </div>
        ) : (
          <div role="list">
            {filtered.map(card => {
              const status = deriveSentCardStatus(card);
              const canUns = canUnsend(card);
              return (
                <div
                  key={card.id}
                  role="listitem"
                  className="flex items-center justify-between gap-3 px-4"
                  style={{
                    minHeight: 72,
                    borderTop: '1px solid var(--pulse-border)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: 'var(--pulse-ink)' }}>
                      {/* Subject name verbatim */}
                      {card.card_snapshot?.name}
                      <span className="ml-2 font-normal" style={{ color: 'var(--pulse-ink-2)' }}>
                        → {card.recipient_hint ?? ''}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                      {t('contacts.cards.sentList.row_sent_format', {
                        time: formatRelative(card.created_at),
                        status: statusLabel(status, t),
                      })}
                    </div>
                  </div>
                  {status === 'revoked' || status === 'expired' ? (
                    <span className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>
                      {t('contacts.cards.sentList.no_action_label')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRevokingCard(card);
                        setRevokingMode(canUns ? 'unsend' : 'revoke');
                      }}
                      className="rounded-lg px-3 font-semibold"
                      style={{
                        minHeight: 44,
                        background: 'var(--pulse-tone-overdue-soft)',
                        color: 'var(--pulse-tone-overdue)',
                        border: '1px solid var(--pulse-border)',
                      }}
                    >
                      {canUns
                        ? t('contacts.cards.sentList.unsend_cta')
                        : t('contacts.cards.sentList.revoke_cta')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RevokeCardConfirmation
        open={Boolean(revokingCard)}
        card={revokingCard}
        mode={revokingMode}
        onCancel={() => setRevokingCard(null)}
        onConfirm={handleRevoked}
      />
    </div>
  );
};

export default SentCardsView;

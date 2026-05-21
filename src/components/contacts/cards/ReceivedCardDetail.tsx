import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2, Mail, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ContactCard } from '../../../types/contactCard';
import { CardProvenanceLine } from './CardProvenanceLine';
import { ExpiryWarningBanner } from './ExpiryWarningBanner';

interface ReceivedCardDetailProps {
  card: ContactCard;
  /**
   * Display name of the immediate sender (server-resolved from auth.users).
   * Verbatim — preserve `{`, `}`, `#`.
   */
  senderDisplayName: string;
  /**
   * Display name of the chain-root sender if forwarded. Verbatim.
   * Falls back to senderDisplayName if not a forward.
   */
  originalSenderName?: string | null;
  onBack: () => void;
  onAccept: () => void;
  onDecline?: () => void;
  onMaybe?: () => void;
  onForward?: () => void;
}

/**
 * Full received-card view (vision § Layout sketches § 4).
 *
 * Sticky action bar on mobile (.contacts-detail-actions positioning is
 * Tailwind-only — sticky bottom-0 below sm:static for desktop). Provenance
 * line renders only when the card was forwarded. Expiry banner renders
 * iff `expires_at - now() < 3 days`.
 *
 * Intro note is rendered as a plain React text node — no raw-HTML escape
 * hatches; React auto-escapes content.
 */
export const ReceivedCardDetail: React.FC<ReceivedCardDetailProps> = ({
  card,
  senderDisplayName,
  originalSenderName,
  onBack,
  onAccept,
  onDecline,
  onMaybe,
  onForward,
}) => {
  const { t } = useTranslation();
  const [goneStateReason, setGoneStateReason] = useState<'revoked' | 'expired' | null>(null);

  // Live revoke/expire check (vision spec — "live update mid-view")
  React.useEffect(() => {
    if (card.revoked_at) {
      setGoneStateReason('revoked');
      return;
    }
    if (!card.expires_at) return;
    const t1 = new Date(card.expires_at).getTime();
    if (Number.isFinite(t1) && t1 <= Date.now()) {
      setGoneStateReason('expired');
    }
  }, [card.revoked_at, card.expires_at]);

  const subjectName = card.card_snapshot?.name?.trim() || '';
  const titleLine = [
    card.card_snapshot?.title,
    card.card_snapshot?.company ? `at ${card.card_snapshot.company}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const isForwarded = Boolean(card.forwarded_from_card_id);

  if (goneStateReason) {
    return (
      <div className="px-6 py-10 text-center" role="region">
        <h2 className="text-base font-semibold" style={{ color: 'var(--pulse-ink)' }}>
          {goneStateReason === 'revoked'
            ? t('contacts.cards.receivedDetail.gone_revoked_title')
            : t('contacts.cards.receivedDetail.gone_expired_title')}
        </h2>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-lg px-4 font-semibold"
          style={{
            minHeight: 44,
            background: 'var(--pulse-rose)',
            color: 'var(--pulse-surface)',
          }}
        >
          {t('contacts.cards.receivedDetail.gone_back_cta')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* Back link */}
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--pulse-ink-2)', minHeight: 44 }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('contacts.cards.receivedDetail.back_cta')}
        </button>
      </div>

      {/* Subject */}
      <div className="px-4 pt-4 text-center">
        <div
          className="mx-auto flex items-center justify-center rounded-full font-bold"
          style={{
            width: 96,
            height: 96,
            background: card.card_snapshot?.avatar_color || 'var(--pulse-surface-raised)',
            color: 'var(--pulse-ink)',
            border: '1px solid var(--pulse-border)',
            fontSize: 28,
          }}
        >
          {subjectName
            .split(/\s+/)
            .filter(Boolean)
            .map(tok => {
              const m = tok.match(/[A-Za-zÀ-ɏ]/);
              return m ? m[0] : '';
            })
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?'}
        </div>
        <h1
          className="mt-3 text-xl font-bold"
          style={{ color: 'var(--pulse-ink)' }}
          // Display name verbatim
        >
          {subjectName}
        </h1>
        {titleLine && (
          <p className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            {titleLine}
          </p>
        )}
      </div>

      {/* Contact info */}
      <section
        className="mx-4 mt-6 space-y-2 rounded-lg p-4"
        style={{ border: '1px solid var(--pulse-border)' }}
        aria-label={t('contacts.cards.receivedDetail.section_contact_info_label')}
      >
        {card.card_snapshot?.email && (
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--pulse-ink)' }}>
            <Mail size={14} aria-hidden="true" style={{ color: 'var(--pulse-ink-2)' }} />
            {card.card_snapshot.email}
          </p>
        )}
        {card.card_snapshot?.phone && (
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--pulse-ink)' }}>
            <Phone size={14} aria-hidden="true" style={{ color: 'var(--pulse-ink-2)' }} />
            {card.card_snapshot.phone}
          </p>
        )}
        {card.card_snapshot?.company && (
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--pulse-ink)' }}>
            <Building2 size={14} aria-hidden="true" style={{ color: 'var(--pulse-ink-2)' }} />
            {card.card_snapshot.company}
          </p>
        )}
        {card.card_snapshot?.address && (
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--pulse-ink)' }}>
            <MapPin size={14} aria-hidden="true" style={{ color: 'var(--pulse-ink-2)' }} />
            {card.card_snapshot.address}
          </p>
        )}
      </section>

      {/* About this share */}
      <section
        className="mx-4 mt-4 space-y-3"
        aria-label={t('contacts.cards.receivedDetail.section_about_sender_label')}
      >
        <CardProvenanceLine
          immediateSenderName={senderDisplayName}
          originalSenderName={isForwarded ? originalSenderName ?? null : null}
          variant="inline"
        />
        {card.intro_note && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pulse-ink-3)' }}>
              {t('contacts.cards.receivedDetail.note_label_format', { sender: senderDisplayName })}
            </p>
            <div
              className="rounded-lg p-3 text-sm"
              style={{
                background: 'var(--pulse-surface-raised)',
                color: 'var(--pulse-ink)',
                border: '1px solid var(--pulse-border)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {/* Rendered as React text node — auto-escaped, never HTML. */}
              {card.intro_note}
            </div>
          </div>
        )}
        {card.expires_at && <ExpiryWarningBanner expiresAt={card.expires_at} />}
      </section>

      {/* Actions */}
      <div
        className="sticky bottom-0 mt-6 flex items-center justify-end gap-2 px-4 py-3 sm:static sm:mx-4 sm:mt-6 sm:rounded-lg sm:border sm:px-4"
        style={{
          background: 'var(--pulse-surface)',
          borderTop: '1px solid var(--pulse-border)',
        }}
      >
        {onDecline && (
          <button
            type="button"
            onClick={() => {
              onDecline();
              toast.success(
                t('contacts.cards.receivedDetail.declined_toast_format', { sender: senderDisplayName }),
              );
            }}
            className="rounded-lg px-3 font-semibold"
            style={{
              minHeight: 44,
              color: 'var(--pulse-tone-overdue)',
            }}
          >
            {t('contacts.cards.receivedDetail.decline_cta')}
          </button>
        )}
        {onMaybe && (
          <button
            type="button"
            onClick={() => {
              onMaybe();
              toast(t('contacts.cards.receivedDetail.maybe_toast'));
            }}
            className="rounded-lg px-3 font-semibold"
            style={{
              minHeight: 44,
              color: 'var(--pulse-ink-2)',
            }}
          >
            {t('contacts.cards.receivedDetail.maybe_cta')}
          </button>
        )}
        {onForward && card.is_forwardable && (
          <button
            type="button"
            onClick={onForward}
            className="rounded-lg px-3 font-semibold"
            style={{
              minHeight: 44,
              background: 'var(--pulse-surface-raised)',
              color: 'var(--pulse-ink)',
              border: '1px solid var(--pulse-border)',
            }}
          >
            {t('contacts.cards.receivedDetail.forward_cta')}
          </button>
        )}
        <button
          type="button"
          onClick={onAccept}
          className="rounded-lg px-4 font-semibold"
          style={{
            minHeight: 44,
            background: 'var(--pulse-rose)',
            color: 'var(--pulse-surface)',
          }}
        >
          {t('contacts.cards.receivedDetail.accept_cta')}
        </button>
      </div>
    </div>
  );
};

export default ReceivedCardDetail;

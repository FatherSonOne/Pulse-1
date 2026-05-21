import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ContactCard } from '../../../types/contactCard';
import contactCardService from '../../../services/contactCardService';

interface RevokeCardConfirmationProps {
  open: boolean;
  card: ContactCard | null;
  /**
   * 'unsend' for ≤30 min old, 0 views — soft language ("pull it back cleanly").
   * 'revoke' for everything else — firm language ("make the link stop working").
   * Both write `revoked_at` server-side; the distinction is linguistic only (magi D-9).
   */
  mode: 'unsend' | 'revoke';
  /**
   * True iff this card is a chain root with descendant forwards.
   * When true, an extra warning line is rendered explaining cascade revocation.
   */
  hasChainDescendants?: boolean;
  /**
   * True iff this user is a mid-chain forwarder (not the chain root).
   * When true, the "subtree only" warning is rendered.
   */
  isSubtreeRevoke?: boolean;
  /**
   * Approximate count of descendants when hasChainDescendants is true.
   * Optional — vision spec mentions "forwarded 4 times" copy.
   */
  chainDescendantsCount?: number;
  onCancel: () => void;
  onConfirm?: () => void;
}

function formatRelativeMinutes(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleDateString();
}

function formatAbsoluteDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Sender-side confirmation modal for Unsend / Revoke (R-16).
 *
 * Visually identical layout — only the copy differs (magi D-9: linguistic
 * distinction only). Includes truthfulness disclaimer: existing copies
 * recipients have saved to their device contacts won't be deleted (R-18).
 */
export const RevokeCardConfirmation: React.FC<RevokeCardConfirmationProps> = ({
  open,
  card,
  mode,
  hasChainDescendants = false,
  isSubtreeRevoke = false,
  chainDescendantsCount,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = 'revoke-card-title';

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSubmitting(false);
      window.setTimeout(() => {
        dialogRef.current?.querySelector<HTMLElement>('button[data-primary]')?.focus();
      }, 0);
    } else {
      previousFocusRef.current?.focus?.();
    }
  }, [open]);

  const closeIfAllowed = () => {
    if (!submitting) onCancel();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeIfAllowed();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [],
    );
    if (focusables.length === 0) return;
    const currentIndex = focusables.findIndex(el => el === document.activeElement);
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusables.length - 1
        : currentIndex - 1
      : currentIndex === focusables.length - 1
        ? 0
        : currentIndex + 1;
    event.preventDefault();
    focusables[nextIndex]?.focus();
  };

  const handleConfirm = async () => {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await contactCardService.revokeCard(card.id);
      toast.success(t('contacts.cards.revoke.success_toast'));
      onConfirm?.();
      onCancel();
    } catch {
      toast.error(t('contacts.cards.revoke.error_toast'));
    } finally {
      setSubmitting(false);
    }
  };

  const { title, body } = useMemo(() => {
    if (!card) return { title: '', body: '' };
    const recipient = card.recipient_hint ?? '';
    if (mode === 'unsend') {
      return {
        title: t('contacts.cards.revoke.unsend_title'),
        body: t('contacts.cards.revoke.unsend_body_format', {
          recipient,
          time: formatRelativeMinutes(card.created_at),
        }),
      };
    }
    const date = formatAbsoluteDate(card.created_at);
    return {
      title: t('contacts.cards.revoke.revoke_title'),
      body:
        card.view_count > 0
          ? t('contacts.cards.revoke.revoke_body_format', { recipient, date })
          : t('contacts.cards.revoke.revoke_body_unviewed_format', { recipient, date }),
    };
  }, [card, mode, t]);

  if (!card) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          style={{ background: 'color-mix(in srgb, var(--pulse-ink) 70%, transparent)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={closeIfAllowed}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--pulse-surface)' }}
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onMouseDown={event => event.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div
              className="flex items-start justify-between gap-4 p-5 border-b"
              style={{ borderColor: 'var(--pulse-border)' }}
            >
              <h2 id={titleId} className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>
                {title}
              </h2>
              <button
                type="button"
                onClick={closeIfAllowed}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg"
                style={{ minWidth: 44, minHeight: 44, color: 'var(--pulse-ink-2)' }}
                aria-label={t('contacts.cards.revoke.cancel_cta')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm" style={{ color: 'var(--pulse-ink)' }}>
              <p>{body}</p>

              {mode === 'revoke' && (
                <p style={{ color: 'var(--pulse-ink-2)' }}>
                  {t('contacts.cards.revoke.kept_copies_disclaimer')}
                </p>
              )}

              {hasChainDescendants && (
                <p
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: 'var(--pulse-tone-warning-soft)',
                    color: 'var(--pulse-ink)',
                    border: '1px solid var(--pulse-border)',
                  }}
                >
                  {t('contacts.cards.revoke.chain_warning_format', {
                    count: chainDescendantsCount ?? 1,
                  })}
                </p>
              )}

              {isSubtreeRevoke && (
                <p
                  className="rounded-lg px-3 py-2"
                  style={{
                    background: 'var(--pulse-tone-info-soft)',
                    color: 'var(--pulse-ink)',
                    border: '1px solid var(--pulse-border)',
                  }}
                >
                  {t('contacts.cards.revoke.subtree_warning')}
                </p>
              )}

              <p className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                {t('contacts.cards.revoke.cant_undo')}
              </p>
            </div>

            <div
              className="flex items-center justify-end gap-2 p-5 border-t"
              style={{ borderColor: 'var(--pulse-border)' }}
            >
              <button
                type="button"
                onClick={closeIfAllowed}
                disabled={submitting}
                className="px-4 rounded-lg font-semibold"
                style={{ minHeight: 44, color: 'var(--pulse-ink-2)' }}
              >
                {t('contacts.cards.revoke.cancel_cta')}
              </button>
              <button
                type="button"
                data-primary
                onClick={handleConfirm}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 rounded-lg font-semibold disabled:opacity-50"
                style={{
                  minHeight: 44,
                  background: 'var(--pulse-tone-overdue-soft)',
                  color: 'var(--pulse-tone-overdue)',
                  border: '1px solid var(--pulse-border)',
                }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {submitting
                  ? t('contacts.cards.revoke.revoking_state')
                  : mode === 'unsend'
                    ? t('contacts.cards.revoke.unsend_cta')
                    : t('contacts.cards.revoke.revoke_cta')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RevokeCardConfirmation;

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ContactCard, CreateContactCardResponse } from '../../../types/contactCard';
import contactCardService from '../../../services/contactCardService';

interface ForwardCardModalProps {
  open: boolean;
  /** The received card we are forwarding (must have is_forwardable = true). */
  sourceCard: ContactCard | null;
  /** Display name of THIS user (the forwarder); rendered in helper text only. */
  forwarderDisplayName: string;
  /** Display name of the chain-root sender (original). Verbatim — preserve braces. */
  originalSenderName: string;
  onCancel: () => void;
  onSent?: (card: CreateContactCardResponse) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PULSE_USER_RE = /^[A-Za-z0-9_.-]{3,}$/;

/**
 * Forward an accepted/received card to another recipient.
 *
 * Notable differences vs ShareCardModal (vision § Layout sketches § 9):
 *   - Recipient sees both the forwarder AND the chain-root sender.
 *   - No token-policy or forwardability toggles — original sender's
 *     `is_forwardable` setting is preserved through the chain (R-3).
 *   - Helper text confirms what the recipient will see (transparency).
 */
export const ForwardCardModal: React.FC<ForwardCardModalProps> = ({
  open,
  sourceCard,
  forwarderDisplayName,
  originalSenderName,
  onCancel,
  onSent,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = 'forward-card-title';

  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const subjectName = sourceCard?.card_snapshot?.name?.trim() || '';

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRecipient('');
      setNote('');
      setSubmitting(false);
      setRecipientError(null);
      window.setTimeout(() => {
        dialogRef.current?.querySelector<HTMLElement>('input[type="text"]')?.focus();
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
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]',
      ) ?? [],
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

  const handleForward = async () => {
    if (!sourceCard || submitting) return;
    const trimmed = recipient.trim();
    if (!(EMAIL_RE.test(trimmed) || PULSE_USER_RE.test(trimmed))) {
      setRecipientError(t('contacts.cards.share.error_invalid_recipient'));
      return;
    }
    setRecipientError(null);
    setSubmitting(true);
    try {
      const response = await contactCardService.forwardCard({
        parent_card_id: sourceCard.id,
        recipient_hint: trimmed,
        intro_note: note.trim() ? note.trim() : undefined,
      });
      toast.success(t('contacts.cards.forward.success_toast_format', { recipient: trimmed }));
      onSent?.(response);
      onCancel();
    } catch (err) {
      const server = (err as Error & { server?: { error?: string } }).server;
      const errEnum = server?.error ?? '';
      if (errEnum.includes('card_not_forwardable')) {
        toast.error(t('contacts.cards.forward.error_not_forwardable'));
      } else if (errEnum.includes('rate_limit_exceeded')) {
        toast.error(t('contacts.cards.share.error_rate_limit'));
      } else {
        toast.error(t('contacts.cards.forward.error_generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!sourceCard) return null;

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
            className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
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
              <div>
                <h2 id={titleId} className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>
                  {t('contacts.cards.forward.modal_title_format', { name: subjectName })}
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                  {t('contacts.cards.forward.modal_subtitle_format', { original: originalSenderName })}
                </p>
              </div>
              <button
                type="button"
                onClick={closeIfAllowed}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg"
                style={{ minWidth: 44, minHeight: 44, color: 'var(--pulse-ink-2)' }}
                aria-label={t('contacts.cards.forward.cancel_cta')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="forward-card-recipient"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--pulse-ink-3)' }}
                >
                  {t('contacts.cards.forward.recipient_label')}
                </label>
                <input
                  id="forward-card-recipient"
                  type="text"
                  value={recipient}
                  onChange={e => {
                    setRecipient(e.target.value);
                    if (recipientError) setRecipientError(null);
                  }}
                  placeholder={t('contacts.cards.forward.recipient_placeholder')}
                  aria-invalid={recipientError ? 'true' : 'false'}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--pulse-canvas-soft)',
                    color: 'var(--pulse-ink)',
                    border: `1px solid ${recipientError ? 'var(--pulse-tone-overdue)' : 'var(--pulse-border)'}`,
                    minHeight: 44,
                  }}
                />
                {recipientError && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--pulse-tone-overdue)' }}>
                    {recipientError}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="forward-card-note"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--pulse-ink-3)' }}
                >
                  {t('contacts.cards.forward.note_label')}
                </label>
                <textarea
                  id="forward-card-note"
                  value={note}
                  onChange={e => setNote(e.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={3}
                  placeholder={t('contacts.cards.forward.note_placeholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--pulse-canvas-soft)',
                    color: 'var(--pulse-ink)',
                    border: '1px solid var(--pulse-border)',
                    resize: 'vertical',
                  }}
                />
                <div className="mt-1 flex justify-end text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  {t('contacts.cards.forward.note_counter_format', { count: note.length })}
                </div>
              </div>

              <p
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: 'var(--pulse-tone-info-soft)',
                  color: 'var(--pulse-ink-2)',
                  border: '1px solid var(--pulse-border)',
                }}
              >
                {t('contacts.cards.forward.recipient_will_see_format', {
                  forwarder: forwarderDisplayName,
                })}
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
                {t('contacts.cards.forward.cancel_cta')}
              </button>
              <button
                type="button"
                onClick={handleForward}
                disabled={!recipient.trim() || submitting}
                className="inline-flex items-center gap-2 px-4 rounded-lg font-semibold disabled:opacity-50"
                style={{
                  minHeight: 44,
                  background: 'var(--pulse-rose)',
                  color: 'var(--pulse-surface)',
                }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {submitting
                  ? t('contacts.cards.forward.forwarding_state')
                  : t('contacts.cards.forward.forward_cta')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ForwardCardModal;

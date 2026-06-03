import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Loader2, Share, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import type { Contact } from '../../../types';
import type {
  CreateContactCardResponse,
  TokenPolicy,
} from '../../../types/contactCard';
import contactCardService from '../../../services/contactCardService';

interface ShareCardModalProps {
  open: boolean;
  /** The contact whose card will be shared (subject). */
  contact: Contact | null;
  onCancel: () => void;
  onSent?: (card: CreateContactCardResponse) => void;
}

type ExpiryOption = 'never' | '1d' | '7d' | '30d';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PULSE_USER_RE = /^[A-Za-z0-9_.-]{3,}$/;

function isValidRecipient(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return EMAIL_RE.test(trimmed) || PULSE_USER_RE.test(trimmed);
}

function expiryToIso(opt: ExpiryOption): string | null {
  if (opt === 'never') return null;
  const days = opt === '1d' ? 1 : opt === '7d' ? 7 : 30;
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/**
 * Single-recipient share-creation flow (vision § Layout sketches § 1).
 *
 * Recipient input + intro note + collapsible "More options" (token policy,
 * forwardability toggle, expiry picker). On Capacitor, exposes a secondary
 * "Share via system…" button that fires the OS share sheet AFTER the
 * card row is persisted (R-5).
 */
export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  open,
  contact,
  onCancel,
  onSent,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = 'share-card-title';
  const subtitleId = 'share-card-subtitle';

  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [singleUse, setSingleUse] = useState(false);
  const [forwardable, setForwardable] = useState(true);
  const [expiry, setExpiry] = useState<ExpiryOption>('never');
  const [submitting, setSubmitting] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const isNative = useMemo(() => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }, []);

  const subjectName = contact?.name?.trim() || '';

  // Reset on open / close
  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRecipient('');
      setNote('');
      setMoreOpen(false);
      setSingleUse(false);
      setForwardable(true);
      setExpiry('never');
      setSubmitting(false);
      setRecipientError(null);
      window.setTimeout(() => {
        dialogRef.current
          ?.querySelector<HTMLElement>('input[type="text"], input[type="email"], textarea')
          ?.focus();
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
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]',
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

  const handleSend = async (alsoNative: boolean = false) => {
    if (!contact || submitting) return;
    const trimmedRecipient = recipient.trim();
    if (!isValidRecipient(trimmedRecipient)) {
      setRecipientError(t('contacts.cards.share.error_invalid_recipient'));
      return;
    }
    setRecipientError(null);
    setSubmitting(true);
    try {
      const tokenPolicy: TokenPolicy = singleUse ? 'single_use' : 'multi_use';
      const response = await contactCardService.createCard({
        contact_id: contact.id,
        recipient_hint: trimmedRecipient,
        intro_note: note.trim() ? note.trim() : undefined,
        token_policy: tokenPolicy,
        is_forwardable: forwardable,
        expires_at: expiryToIso(expiry),
      });

      toast.success(
        t('contacts.cards.share.success_toast_format', { recipient: trimmedRecipient }),
      );

      // R-5: Open OS share sheet AFTER persistence so the URL is canonical.
      if (alsoNative && isNative && response.share_url) {
        try {
          // Lazy import keeps test envs without Capacitor share plugin happy.
          const mod = await import('@capacitor/share').catch(() => null);
          await mod?.Share?.share?.({
            title: subjectName
              ? `Card for ${subjectName}`
              : t('contacts.cards.share.modal_title', { name: subjectName }),
            url: response.share_url,
            dialogTitle: t('contacts.cards.share.share_via_system_cta'),
          });
        } catch (err) {
          // TODO(phase-6-review): the share-sheet error is non-fatal; the
          // card was already created. Logging only.
          console.warn('[ShareCardModal] native share sheet failed:', err);
        }
      }

      onSent?.(response);
      onCancel();
    } catch (err) {
      const server = (err as Error & { server?: { error?: string } }).server;
      const errEnum = server?.error ?? '';
      if (errEnum.includes('rate_limit_exceeded')) {
        toast.error(t('contacts.cards.share.error_rate_limit'));
      } else if (errEnum.includes('sender_blocked_by_recipient')) {
        toast.error(t('contacts.cards.share.error_blocked'));
      } else if (errEnum.includes('validation_failed')) {
        setRecipientError(t('contacts.cards.share.error_invalid_recipient'));
      } else {
        toast.error(t('contacts.cards.share.error_generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const sendDisabled = !recipient.trim() || submitting;

  if (!contact) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          style={{ background: 'rgba(0, 0, 0, 0.6)' }}
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
            aria-describedby={subtitleId}
            className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--pulse-surface-modal)' }}
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onMouseDown={event => event.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between gap-4 p-5 border-b"
              style={{ borderColor: 'var(--pulse-border)' }}
            >
              <div>
                <h2 id={titleId} className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>
                  {t('contacts.cards.share.modal_title', { name: subjectName })}
                </h2>
                <p id={subtitleId} className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                  {t('contacts.cards.share.modal_subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeIfAllowed}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg"
                style={{ minWidth: 44, minHeight: 44, color: 'var(--pulse-ink-2)' }}
                aria-label={t('contacts.cards.share.cancel_cta')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="share-card-recipient"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--pulse-ink-3)' }}
                >
                  {t('contacts.cards.share.recipient_label')}
                </label>
                <input
                  id="share-card-recipient"
                  type="text"
                  value={recipient}
                  onChange={e => {
                    setRecipient(e.target.value);
                    if (recipientError) setRecipientError(null);
                  }}
                  placeholder={t('contacts.cards.share.recipient_placeholder')}
                  aria-invalid={recipientError ? 'true' : 'false'}
                  aria-describedby="share-card-recipient-helper"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--pulse-canvas-soft)',
                    color: 'var(--pulse-ink)',
                    border: `1px solid ${recipientError ? 'var(--pulse-tone-overdue)' : 'var(--pulse-border)'}`,
                    minHeight: 44,
                  }}
                />
                <p
                  id="share-card-recipient-helper"
                  className="mt-1 text-xs"
                  style={{ color: recipientError ? 'var(--pulse-tone-overdue)' : 'var(--pulse-ink-3)' }}
                >
                  {recipientError ?? t('contacts.cards.share.recipient_helper')}
                </p>
              </div>

              <div>
                <label
                  htmlFor="share-card-note"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--pulse-ink-3)' }}
                >
                  {t('contacts.cards.share.note_label')}
                </label>
                <textarea
                  id="share-card-note"
                  value={note}
                  onChange={e => setNote(e.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={3}
                  placeholder={t('contacts.cards.share.note_placeholder')}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--pulse-canvas-soft)',
                    color: 'var(--pulse-ink)',
                    border: '1px solid var(--pulse-border)',
                    resize: 'vertical',
                  }}
                />
                <div className="mt-1 flex justify-end text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  {t('contacts.cards.share.note_counter_format', { count: note.length })}
                </div>
              </div>

              {/* More options */}
              <div>
                <button
                  type="button"
                  onClick={() => setMoreOpen(v => !v)}
                  aria-expanded={moreOpen}
                  aria-controls="share-card-more-options"
                  className="inline-flex items-center gap-1 text-sm font-medium"
                  style={{ color: 'var(--pulse-ink-2)', minHeight: 44 }}
                >
                  {moreOpen ? (
                    <ChevronDown size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                  {t('contacts.cards.share.more_options_toggle')}
                </button>
                {moreOpen && (
                  <div
                    id="share-card-more-options"
                    className="mt-2 space-y-3 rounded-lg p-3"
                    style={{
                      background: 'var(--pulse-surface-raised)',
                      border: '1px solid var(--pulse-border)',
                    }}
                  >
                    <label className="flex cursor-pointer items-start gap-2" style={{ minHeight: 44 }}>
                      <input
                        type="checkbox"
                        checked={singleUse}
                        onChange={e => setSingleUse(e.target.checked)}
                        className="mt-1 h-5 w-5"
                      />
                      <span>
                        <span className="block text-sm font-medium" style={{ color: 'var(--pulse-ink)' }}>
                          {t('contacts.cards.share.single_use_toggle_label')}
                        </span>
                        <span className="block text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                          {t('contacts.cards.share.single_use_toggle_helper')}
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2" style={{ minHeight: 44 }}>
                      <input
                        type="checkbox"
                        checked={forwardable}
                        onChange={e => setForwardable(e.target.checked)}
                        className="mt-1 h-5 w-5"
                      />
                      <span>
                        <span className="block text-sm font-medium" style={{ color: 'var(--pulse-ink)' }}>
                          {t('contacts.cards.share.forwarding_toggle_label')}
                        </span>
                        <span className="block text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                          {t('contacts.cards.share.forwarding_toggle_helper')}
                        </span>
                      </span>
                    </label>
                    <div>
                      <label
                        htmlFor="share-card-expiry"
                        className="mb-1 block text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--pulse-ink-3)' }}
                      >
                        {t('contacts.cards.share.expiry_label')}
                      </label>
                      <select
                        id="share-card-expiry"
                        value={expiry}
                        onChange={e => setExpiry(e.target.value as ExpiryOption)}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{
                          background: 'var(--pulse-canvas-soft)',
                          color: 'var(--pulse-ink)',
                          border: '1px solid var(--pulse-border)',
                          minHeight: 44,
                        }}
                      >
                        <option value="never">{t('contacts.cards.share.expiry_never_option')}</option>
                        <option value="1d">{t('contacts.cards.share.expiry_1_day_option')}</option>
                        <option value="7d">{t('contacts.cards.share.expiry_7_days_option')}</option>
                        <option value="30d">{t('contacts.cards.share.expiry_30_days_option')}</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex flex-wrap items-center justify-end gap-2 p-5 border-t"
              style={{ borderColor: 'var(--pulse-border)' }}
            >
              <button
                type="button"
                onClick={closeIfAllowed}
                disabled={submitting}
                className="px-4 rounded-lg font-semibold"
                style={{ minHeight: 44, color: 'var(--pulse-ink-2)' }}
              >
                {t('contacts.cards.share.cancel_cta')}
              </button>
              {isNative && (
                <button
                  type="button"
                  onClick={() => handleSend(true)}
                  disabled={sendDisabled}
                  className="inline-flex items-center gap-2 px-4 rounded-lg font-semibold disabled:opacity-50"
                  style={{
                    minHeight: 44,
                    background: 'var(--pulse-surface-raised)',
                    color: 'var(--pulse-ink)',
                    border: '1px solid var(--pulse-border)',
                  }}
                >
                  <Share size={16} aria-hidden="true" />
                  {t('contacts.cards.share.share_via_system_cta')}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSend(false)}
                disabled={sendDisabled}
                className="inline-flex items-center gap-2 px-4 rounded-lg font-semibold disabled:opacity-50"
                style={{
                  minHeight: 44,
                  background: 'var(--pulse-rose)',
                  color: '#ffffff',
                }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {submitting
                  ? t('contacts.cards.share.sending_state')
                  : t('contacts.cards.share.send_cta')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareCardModal;

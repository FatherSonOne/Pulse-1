import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, X } from 'lucide-react';
import type { ContactCard } from '../../../types/contactCard';

interface AcceptCardConfirmationProps {
  open: boolean;
  card: ContactCard | null;
  /** Sender's display name (server-resolved from auth.users). Verbatim — preserve braces/hash. */
  senderDisplayName: string;
  onCancel: () => void;
  onConfirm: (opts: { connectWithSender: boolean }) => Promise<void> | void;
}

/**
 * Accept confirmation modal — magi D-2 load-bearing UX.
 *
 * Two visually-distinct rows:
 *  1. Immutable status row "Add {name} to your contacts" — checkmark icon,
 *     positive-soft background. Required, not a checkbox.
 *  2. Checkbox row "Also connect with {sender} on Pulse" — DEFAULT CHECKED,
 *     rose ring around the entire box when checked, neutral border when
 *     unchecked. Accept button label flips between "Accept and connect"
 *     and "Accept only" to make the diff visible at the action level.
 *
 * Keyboard order: Cancel → row-2 checkbox → Accept. The row-1 box is
 * non-interactive (no focusable element inside).
 *
 * On open, focus moves to the checkbox (drawing attention to the magi-
 * locked default) and a live-region announces the default state.
 *
 * Display names pass through verbatim per guardrail #1.
 */
export const AcceptCardConfirmation: React.FC<AcceptCardConfirmationProps> = ({
  open,
  card,
  senderDisplayName,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = 'accept-card-title';

  const [connect, setConnect] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const subjectName = card?.card_snapshot?.name?.trim() || '';

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setConnect(true);
      setSubmitting(false);
      // Focus the checkbox — surfaces the default state immediately.
      window.setTimeout(() => {
        checkboxRef.current?.focus();
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
        'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
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

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm({ connectWithSender: connect });
    } finally {
      setSubmitting(false);
    }
  };

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
            className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--pulse-surface)' }}
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
              <h2 id={titleId} className="text-lg font-bold" style={{ color: 'var(--pulse-ink)' }}>
                {t('contacts.cards.acceptModal.title_format', { name: subjectName })}
              </h2>
              <button
                type="button"
                onClick={closeIfAllowed}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg"
                style={{ minWidth: 44, minHeight: 44, color: 'var(--pulse-ink-2)' }}
                aria-label={t('contacts.cards.acceptModal.cancel_cta')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Live-region announcement on open */}
            <span className="sr-only" aria-live="polite">
              {t('contacts.cards.acceptModal.sr_announce_format', {
                name: subjectName,
                sender: senderDisplayName,
              })}
            </span>

            {/* Body */}
            <div className="p-5 space-y-3">
              {/* Row 1 — immutable status */}
              <div
                className="flex items-start gap-3 rounded-lg p-3"
                style={{
                  background: 'var(--pulse-tone-positive-soft)',
                  border: '1px solid var(--pulse-border)',
                }}
              >
                <Check
                  size={20}
                  aria-hidden="true"
                  style={{ color: 'var(--pulse-tone-positive)', marginTop: 2, flexShrink: 0 }}
                />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--pulse-ink)' }}>
                    {t('contacts.cards.acceptModal.primary_row_label_format', { name: subjectName })}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--pulse-ink-2)' }}>
                    {t('contacts.cards.acceptModal.primary_row_helper')}
                  </p>
                </div>
              </div>

              {/* Row 2 — magi default-checked checkbox */}
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-all"
                style={{
                  background: 'var(--pulse-surface-raised)',
                  border: connect
                    ? '2px solid var(--pulse-rose)'
                    : '1px solid var(--pulse-border)',
                  // Compensate padding so the ring change doesn't shift content.
                  padding: connect ? '11px' : '12px',
                  opacity: connect ? 1 : 0.85,
                  minHeight: 44,
                }}
              >
                <input
                  ref={checkboxRef}
                  type="checkbox"
                  checked={connect}
                  onChange={e => setConnect(e.target.checked)}
                  disabled={submitting}
                  aria-describedby="accept-row2-helper"
                  className="mt-1 h-6 w-6"
                />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--pulse-ink)' }}>
                    {t('contacts.cards.acceptModal.secondary_row_label_format', {
                      sender: senderDisplayName,
                    })}
                  </p>
                  <p
                    id="accept-row2-helper"
                    className="mt-1 text-xs"
                    style={{ color: 'var(--pulse-ink-2)' }}
                  >
                    {t('contacts.cards.acceptModal.secondary_row_helper_format', {
                      sender: senderDisplayName,
                    })}
                  </p>
                </div>
              </label>
            </div>

            {/* Footer */}
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
                {t('contacts.cards.acceptModal.cancel_cta')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 rounded-lg font-semibold disabled:opacity-50"
                style={{
                  minHeight: 44,
                  background: 'var(--pulse-rose)',
                  color: 'var(--pulse-surface)',
                }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {submitting
                  ? t('contacts.cards.acceptModal.accepting_state')
                  : connect
                    ? t('contacts.cards.acceptModal.accept_and_connect_cta')
                    : t('contacts.cards.acceptModal.accept_only_cta')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AcceptCardConfirmation;

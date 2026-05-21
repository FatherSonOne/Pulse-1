import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Contact } from '../../../types';
import type { CreateContactCardBundleResponse } from '../../../types/contactCard';
import contactCardService from '../../../services/contactCardService';

interface ShareCardBundleModalProps {
  open: boolean;
  /** Contacts whose cards will be bundled. Caller enforces >=2 typically. */
  subjects: Contact[];
  onCancel: () => void;
  onSent?: (bundle: CreateContactCardBundleResponse) => void;
}

type Step = 'compose' | 'confirm';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PULSE_USER_RE = /^[A-Za-z0-9_.-]{3,}$/;
const RECIPIENT_CAP = 25;
const BUNDLE_CARD_CAP = 100;

interface RecipientChip {
  value: string;
  valid: boolean;
}

function toChip(raw: string): RecipientChip {
  const value = raw.trim();
  return { value, valid: EMAIL_RE.test(value) || PULSE_USER_RE.test(value) };
}

function parseChips(raw: string): RecipientChip[] {
  return raw
    .split(/[,\n\s;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(toChip);
}

/**
 * Multi-recipient share-creation flow (vision § Layout sketches § 2).
 *
 * Two-step modal: Compose (recipients + shared note + forwardability/expiry)
 * then Confirm ("N cards × M recipients = N×M shares"). Bundles always
 * use multi-use tokens (R-4); single-use toggle is intentionally absent.
 *
 * Recipient input uses a chip-input pattern: paste comma/newline-separated
 * emails to bulk-add; invalid emails render with overdue outline.
 */
export const ShareCardBundleModal: React.FC<ShareCardBundleModalProps> = ({
  open,
  subjects,
  onCancel,
  onSent,
}) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = 'share-bundle-title';

  const [step, setStep] = useState<Step>('compose');
  const [chips, setChips] = useState<RecipientChip[]>([]);
  const [chipDraft, setChipDraft] = useState('');
  const [note, setNote] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [forwardable, setForwardable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setStep('compose');
      setChips([]);
      setChipDraft('');
      setNote('');
      setMoreOpen(false);
      setForwardable(true);
      setSubmitting(false);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else {
      previousFocusRef.current?.focus?.();
    }
  }, [open]);

  const cardsCount = subjects.length;
  const recipientsCount = chips.filter(c => c.valid).length;
  const totalShares = cardsCount * recipientsCount;

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
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
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

  const commitDraft = () => {
    const parsed = parseChips(chipDraft);
    if (parsed.length === 0) return;
    setChips(prev => {
      const seen = new Set(prev.map(c => c.value.toLowerCase()));
      const next = [...prev];
      for (const c of parsed) {
        const key = c.value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        if (next.length >= RECIPIENT_CAP) {
          toast.error(t('contacts.cards.shareBundle.error_too_many_recipients'));
          break;
        }
        next.push(c);
      }
      return next;
    });
    setChipDraft('');
  };

  const handleChipKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      if (chipDraft.trim()) {
        event.preventDefault();
        commitDraft();
      }
      return;
    }
    if (event.key === 'Backspace' && chipDraft.length === 0 && chips.length > 0) {
      event.preventDefault();
      setChips(prev => prev.slice(0, -1));
    }
  };

  const handleChipPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (!/[,;\n\s]/.test(pasted)) return;
    event.preventDefault();
    setChipDraft(prev => prev + pasted);
    // Defer commit so the state update flushes
    window.setTimeout(commitDraft, 0);
  };

  const removeChip = (idx: number) => {
    setChips(prev => prev.filter((_, i) => i !== idx));
  };

  const goConfirm = () => {
    if (chipDraft.trim()) commitDraft();
    if (cardsCount > BUNDLE_CARD_CAP) {
      toast.error(t('contacts.cards.shareBundle.error_too_many'));
      return;
    }
    if (recipientsCount === 0) return;
    setStep('confirm');
  };

  const handleSendAll = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const recipients = chips.filter(c => c.valid).map(c => c.value);
      const response = await contactCardService.createBundle({
        contact_ids: subjects.map(s => s.id),
        recipient_hints: recipients,
        intro_note: note.trim() ? note.trim() : undefined,
        is_forwardable: forwardable,
      });
      const failedCount = response.failures?.length ?? 0;
      const succeededCount = response.share_urls?.length ?? response.cards_created;
      if (failedCount > 0) {
        toast.error(
          t('contacts.cards.shareBundle.partial_failure_format', {
            succeeded: succeededCount,
            total: succeededCount + failedCount,
            failed: failedCount,
          }),
        );
      } else {
        toast.success(
          t('contacts.cards.shareBundle.success_toast_format', {
            cards: cardsCount,
            recipients: recipients.length,
          }),
        );
      }
      onSent?.(response);
      onCancel();
    } catch (err) {
      const server = (err as Error & { server?: { error?: string } }).server;
      const errEnum = server?.error ?? '';
      if (errEnum.includes('bundle_rate_limit_exceeded')) {
        toast.error(t('contacts.cards.shareBundle.error_rate_limit'));
      } else if (errEnum.includes('bundle_size_exceeded')) {
        toast.error(t('contacts.cards.shareBundle.error_too_many'));
      } else {
        toast.error(t('contacts.cards.share.error_generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const continueDisabled =
    recipientsCount === 0 || cardsCount === 0 || cardsCount > BUNDLE_CARD_CAP;

  // Step content
  const composeStep = useMemo(
    () => (
      <>
        <div className="p-5 space-y-4">
          <div>
            <label
              htmlFor="share-bundle-recipients"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--pulse-ink-3)' }}
            >
              {t('contacts.cards.shareBundle.recipients_label')}
            </label>
            <div
              className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-2"
              style={{
                background: 'var(--pulse-canvas-soft)',
                border: '1px solid var(--pulse-border)',
                minHeight: 60,
              }}
              onClick={() => inputRef.current?.focus()}
            >
              {chips.map((chip, idx) => (
                <span
                  key={`${chip.value}-${idx}`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  role="button"
                  tabIndex={0}
                  aria-invalid={chip.valid ? 'false' : 'true'}
                  aria-label={
                    chip.valid
                      ? chip.value
                      : `${chip.value} — ${t('contacts.cards.shareBundle.error_invalid_chip_aria')}`
                  }
                  style={{
                    background: chip.valid
                      ? 'var(--pulse-tone-neutral-soft)'
                      : 'transparent',
                    border: chip.valid
                      ? '1px solid transparent'
                      : '1px solid var(--pulse-tone-overdue)',
                    color: chip.valid ? 'var(--pulse-ink)' : 'var(--pulse-tone-overdue)',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      removeChip(idx);
                    }
                  }}
                >
                  {chip.value}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      removeChip(idx);
                    }}
                    aria-label={`Remove ${chip.value}`}
                    style={{ lineHeight: 0 }}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                id="share-bundle-recipients"
                type="text"
                value={chipDraft}
                onChange={e => setChipDraft(e.target.value)}
                onKeyDown={handleChipKeyDown}
                onPaste={handleChipPaste}
                onBlur={() => {
                  if (chipDraft.trim()) commitDraft();
                }}
                placeholder={
                  chips.length === 0 ? t('contacts.cards.shareBundle.recipients_placeholder') : ''
                }
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--pulse-ink)', minWidth: 160 }}
              />
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
              {t('contacts.cards.shareBundle.recipients_helper')}
            </p>
          </div>

          <div>
            <label
              htmlFor="share-bundle-note"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--pulse-ink-3)' }}
            >
              {t('contacts.cards.shareBundle.shared_note_label')}
            </label>
            <textarea
              id="share-bundle-note"
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder={t('contacts.cards.shareBundle.shared_note_placeholder')}
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

          <div>
            <button
              type="button"
              onClick={() => setMoreOpen(v => !v)}
              aria-expanded={moreOpen}
              aria-controls="share-bundle-more"
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
                id="share-bundle-more"
                className="mt-2 space-y-3 rounded-lg p-3"
                style={{
                  background: 'var(--pulse-surface-raised)',
                  border: '1px solid var(--pulse-border)',
                }}
              >
                <label className="flex cursor-pointer items-start gap-2" style={{ minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={forwardable}
                    onChange={e => setForwardable(e.target.checked)}
                    className="mt-1 h-5 w-5"
                  />
                  <span>
                    <span className="block text-sm font-medium" style={{ color: 'var(--pulse-ink)' }}>
                      {t('contacts.cards.shareBundle.forwarding_toggle_label')}
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                      {t('contacts.cards.shareBundle.forwarding_toggle_helper')}
                    </span>
                  </span>
                </label>
                <p className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  {t('contacts.cards.shareBundle.bundle_multi_use_helper')}
                </p>
              </div>
            )}
          </div>
        </div>
        <div
          className="flex items-center justify-end gap-2 p-5 border-t"
          style={{ borderColor: 'var(--pulse-border)' }}
        >
          <button
            type="button"
            onClick={closeIfAllowed}
            className="px-4 rounded-lg font-semibold"
            style={{ minHeight: 44, color: 'var(--pulse-ink-2)' }}
          >
            {t('contacts.cards.shareBundle.back_cta')}
          </button>
          <button
            type="button"
            onClick={goConfirm}
            disabled={continueDisabled}
            className="px-4 rounded-lg font-semibold disabled:opacity-50"
            style={{
              minHeight: 44,
              background: 'var(--pulse-rose)',
              color: 'var(--pulse-surface)',
            }}
          >
            {t('contacts.cards.shareBundle.continue_cta')}
          </button>
        </div>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chips, chipDraft, note, moreOpen, forwardable, continueDisabled, t],
  );

  const confirmStep = useMemo(
    () => (
      <>
        <div className="p-5">
          <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            {t('contacts.cards.shareBundle.confirm_intro')}
          </p>
          <div
            className="my-4 text-center text-2xl font-semibold"
            style={{ color: 'var(--pulse-ink)', fontVariantNumeric: 'tabular-nums' }}
          >
            {t('contacts.cards.shareBundle.confirm_summary_format', {
              cards: cardsCount,
              recipients: recipientsCount,
              total: totalShares,
            })}
          </div>
          <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            {t('contacts.cards.shareBundle.confirm_description_format', { cards: cardsCount })}
          </p>
        </div>
        <div
          className="flex items-center justify-end gap-2 p-5 border-t"
          style={{ borderColor: 'var(--pulse-border)' }}
        >
          <button
            type="button"
            onClick={() => setStep('compose')}
            disabled={submitting}
            className="px-4 rounded-lg font-semibold"
            style={{ minHeight: 44, color: 'var(--pulse-ink-2)' }}
          >
            {t('contacts.cards.shareBundle.back_cta')}
          </button>
          <button
            type="button"
            onClick={handleSendAll}
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
              ? t('contacts.cards.shareBundle.sending_state')
              : t('contacts.cards.shareBundle.send_all_cta')}
          </button>
        </div>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardsCount, recipientsCount, totalShares, submitting, t],
  );

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
            className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
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
                  {step === 'compose'
                    ? t('contacts.cards.shareBundle.modal_title_format', { count: cardsCount })
                    : t('contacts.cards.shareBundle.confirm_title')}
                </h2>
                {step === 'compose' && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
                    {t('contacts.cards.shareBundle.modal_subtitle')}
                  </p>
                )}
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

            {step === 'compose' ? composeStep : confirmStep}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareCardBundleModal;

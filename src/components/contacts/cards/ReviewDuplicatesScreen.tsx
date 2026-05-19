import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Contact } from '../../../types';
import type { ContactCard } from '../../../types/contactCard';

export interface DuplicatePair {
  card: ContactCard;
  existing: Contact;
}

interface ReviewDuplicatesScreenProps {
  pairs: DuplicatePair[];
  onMerge: (pair: DuplicatePair) => Promise<void> | void;
  onKeepBoth: (pair: DuplicatePair) => Promise<void> | void;
  onBack: () => void;
  onDone: () => void;
}

interface PairFieldRowProps {
  label: string;
  newValue?: string | null;
  existingValue?: string | null;
}

const PairFieldRow: React.FC<PairFieldRowProps> = ({ label, newValue, existingValue }) => {
  if (!newValue && !existingValue) return null;
  const differs = (newValue ?? '') !== (existingValue ?? '');
  return (
    <div
      className="grid grid-cols-2 gap-3 text-sm"
      style={{
        borderLeft: differs ? '2px solid var(--pulse-tone-warning)' : '2px solid transparent',
        paddingLeft: 8,
        color: 'var(--pulse-ink)',
      }}
    >
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--pulse-ink-3)' }}>
          {label}
        </div>
        <div>{newValue ?? '—'}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--pulse-ink-3)' }}>
          &nbsp;
        </div>
        <div>{existingValue ?? '—'}</div>
      </div>
    </div>
  );
};

/**
 * Post-Accept dedup resolution UI (vision § Layout sketches § 6).
 *
 * Per-pair side-by-side comparison; left = new from card, right = existing.
 * Differing fields are highlighted with a left border in
 * `--pulse-tone-warning`. Merge default per accord D-12: existing data
 * wins; the sender's card fields only fill blanks. The actual field-level
 * merge UI is delegated upstream by `onMerge` — the screen here renders
 * the comparison and dispatches the decision.
 */
export const ReviewDuplicatesScreen: React.FC<ReviewDuplicatesScreenProps> = ({
  pairs,
  onMerge,
  onKeepBoth,
  onBack,
  onDone,
}) => {
  const { t } = useTranslation();
  const [resolved, setResolved] = useState<Set<number>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);

  const currentPair = pairs[currentIdx];
  const allResolved = resolved.size === pairs.length;

  const titleText = useMemo(() => {
    if (pairs.length === 1) return t('contacts.cards.reviewDuplicates.title_format_one');
    return t('contacts.cards.reviewDuplicates.title_format', { count: pairs.length });
  }, [pairs.length, t]);

  const handleMerge = async () => {
    if (!currentPair) return;
    await onMerge(currentPair);
    setResolved(prev => new Set(prev).add(currentIdx));
    advance();
  };

  const handleKeep = async () => {
    if (!currentPair) return;
    await onKeepBoth(currentPair);
    setResolved(prev => new Set(prev).add(currentIdx));
    advance();
  };

  const advance = () => {
    if (currentIdx < pairs.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handleDone = () => {
    if (allResolved) {
      toast.success(t('contacts.cards.reviewDuplicates.all_resolved_toast'));
    }
    onDone();
  };

  if (!currentPair) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--pulse-ink-2)', minHeight: 44 }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('contacts.cards.reviewDuplicates.back_cta')}
        </button>
        <p className="mt-6 text-center text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
          {t('contacts.cards.reviewDuplicates.all_resolved_toast')}
        </p>
      </div>
    );
  }

  const cardSnapshot = currentPair.card.card_snapshot;
  const existing = currentPair.existing;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--pulse-ink-2)', minHeight: 44 }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('contacts.cards.reviewDuplicates.back_cta')}
        </button>
        <h1 className="mt-3 text-xl font-bold" style={{ color: 'var(--pulse-ink)' }}>
          {titleText}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
          {t('contacts.cards.reviewDuplicates.subtitle')}
        </p>
      </div>

      <div className="px-4 py-4">
        <p className="mb-3 text-xs uppercase tracking-wide" style={{ color: 'var(--pulse-ink-3)' }}>
          {t('contacts.cards.reviewDuplicates.pair_indicator_format', {
            current: currentIdx + 1,
            total: pairs.length,
          })}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div
            className="rounded-lg p-3"
            style={{ border: '1px solid var(--pulse-border)', background: 'var(--pulse-surface-raised)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pulse-ink-3)' }}>
              {t('contacts.cards.reviewDuplicates.new_column_label')}
            </div>
          </div>
          <div
            className="rounded-lg p-3"
            style={{ border: '1px solid var(--pulse-border)', background: 'var(--pulse-surface-raised)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pulse-ink-3)' }}>
              {t('contacts.cards.reviewDuplicates.existing_column_label')}
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg p-3" style={{ border: '1px solid var(--pulse-border)' }}>
          <PairFieldRow label="Name" newValue={cardSnapshot.name} existingValue={existing.name} />
          <PairFieldRow label="Email" newValue={cardSnapshot.email} existingValue={existing.email} />
          <PairFieldRow label="Phone" newValue={cardSnapshot.phone} existingValue={existing.phone} />
          <PairFieldRow
            label="Company"
            newValue={cardSnapshot.company}
            existingValue={existing.company}
          />
          {/* Note: Contact stores job title under `role` (legacy naming). */}
          <PairFieldRow label="Title" newValue={cardSnapshot.title} existingValue={existing.role} />
          <PairFieldRow
            label="Address"
            newValue={cardSnapshot.address}
            existingValue={existing.address}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleMerge}
            className="inline-flex items-center gap-2 rounded-lg px-4 font-semibold"
            style={{
              minHeight: 44,
              background: 'var(--pulse-rose)',
              color: 'var(--pulse-surface)',
            }}
          >
            {t('contacts.cards.reviewDuplicates.merge_cta')}
          </button>
          <button
            type="button"
            onClick={handleKeep}
            className="rounded-lg px-4 font-semibold"
            style={{
              minHeight: 44,
              background: 'var(--pulse-surface-raised)',
              color: 'var(--pulse-ink)',
              border: '1px solid var(--pulse-border)',
            }}
          >
            {t('contacts.cards.reviewDuplicates.keep_separate_cta')}
          </button>
          <button
            type="button"
            onClick={advance}
            className="rounded-lg px-4 font-semibold"
            style={{ minHeight: 44, color: 'var(--pulse-ink-2)' }}
          >
            {t('contacts.cards.reviewDuplicates.skip_cta')}
          </button>
        </div>
      </div>

      <div
        className="flex items-center justify-end gap-2 px-4 py-3"
        style={{ borderTop: '1px solid var(--pulse-border)' }}
      >
        <button
          type="button"
          onClick={handleDone}
          className="rounded-lg px-4 font-semibold"
          style={{
            minHeight: 44,
            background: allResolved ? 'var(--pulse-rose)' : 'var(--pulse-surface-raised)',
            color: allResolved ? 'var(--pulse-surface)' : 'var(--pulse-ink)',
            border: allResolved ? 'none' : '1px solid var(--pulse-border)',
          }}
        >
          {t('contacts.cards.reviewDuplicates.done_cta')}
        </button>
      </div>
    </div>
  );
};

export default ReviewDuplicatesScreen;

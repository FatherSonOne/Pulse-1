import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import '../WarRoom/PulseStudio.css';

export type ContactProvenanceSource = 'google' | 'outlook' | 'manual' | 'legacy' | 'logos-vision' | 'card' | null;

interface ProvenanceChipProps {
  source: ContactProvenanceSource;
  addedAt?: string | null;
  variant: 'dot' | 'chip';
}

function normalizeSource(source: ContactProvenanceSource): Exclude<ContactProvenanceSource, null> {
  return source ?? 'legacy';
}

function formatRelativeDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.max(0, Math.round(diffMs / 86_400_000));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.round(diffDays / 30)} months ago`;
  return `${Math.round(diffDays / 365)} years ago`;
}

const ProvenanceChipInner: React.FC<ProvenanceChipProps> = ({ source, addedAt, variant }) => {
  const { t } = useTranslation();
  const normalized = normalizeSource(source);
  const sourceLabel = t(`contacts.provenance.source_${normalized}`);
  const relativeDate = useMemo(() => formatRelativeDate(addedAt), [addedAt]);
  const label = relativeDate
    ? t('contacts.provenance.dot_tooltip_format', { source: sourceLabel, date: relativeDate })
    : t('contacts.provenance.chip_label_format', { source: sourceLabel });

  if (variant === 'dot') {
    return (
      <span
        className="contacts-provenance-dot-target"
        title={label}
        aria-label={label}
      >
        <span
          className="ps-provenance-dot"
          data-source={normalized}
          role="img"
          aria-label={label}
        />
      </span>
    );
  }

  return (
    <span className="ps-provenance" aria-label={label} title={label}>
      {sourceLabel}
      {relativeDate && <span aria-hidden="true">&nbsp;&middot;&nbsp;{relativeDate}</span>}
    </span>
  );
};

export const ProvenanceChip = memo(
  ProvenanceChipInner,
  (prev, next) => prev.source === next.source && prev.addedAt === next.addedAt && prev.variant === next.variant,
);

export default ProvenanceChip;

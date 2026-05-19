import React from 'react';
import { useTranslation } from 'react-i18next';

interface CardProvenanceLineProps {
  /** Display name of the immediate sender (who put the card in this recipient's inbox). */
  immediateSenderName: string;
  /** Display name of the original (chain-root) sender, if this card was forwarded. */
  originalSenderName?: string | null;
  /** 'inline' = subtle single-line; 'banner' = boxed callout under the avatar block. */
  variant?: 'inline' | 'banner';
}

/**
 * Single-line provenance string for received cards.
 *
 * Display names are preserved verbatim — never strip `{`, `}`, or `#`.
 * (Per Pulse guardrail #1 + memory `reference_pulse_contact_name_braces`.)
 *
 * Forwarded:  "Aiko Tanaka is forwarding a card originally shared by Maya Chen."
 * Direct:     "Maya Chen shared this card with you."
 */
export const CardProvenanceLine: React.FC<CardProvenanceLineProps> = ({
  immediateSenderName,
  originalSenderName,
  variant = 'inline',
}) => {
  const { t } = useTranslation();
  const isForwarded = Boolean(originalSenderName && originalSenderName !== immediateSenderName);

  const text = isForwarded
    ? t('contacts.cards.provenance.forwarded_format', {
        forwarder: immediateSenderName,
        original: originalSenderName as string,
      })
    : t('contacts.cards.provenance.direct_format', { sender: immediateSenderName });

  if (variant === 'banner') {
    return (
      <p
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          background: 'var(--pulse-surface-raised)',
          color: 'var(--pulse-ink-2)',
          border: '1px solid var(--pulse-border)',
        }}
      >
        {text}
      </p>
    );
  }

  return (
    <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
      {text}
    </p>
  );
};

export default CardProvenanceLine;

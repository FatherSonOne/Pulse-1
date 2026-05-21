import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface ExpiryWarningBannerProps {
  /** ISO 8601 timestamp string. */
  expiresAt: string;
  /**
   * Only render the banner when `expiresAt - now() < thresholdDays`.
   * Defaults to 3 days per accord R-24.
   */
  thresholdDays?: number;
}

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  try {
    return date.toLocaleString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString();
  }
}

/**
 * Non-dismissible warning surfaced on `ReceivedCardDetail` when a card is
 * within `thresholdDays` of expiring. Per accord R-24, recipient sees the
 * exact local-time expiry to plan their Accept window.
 *
 * Renders nothing if the card is more than `thresholdDays` away from expiry
 * (or if `expiresAt` is invalid).
 */
export const ExpiryWarningBanner: React.FC<ExpiryWarningBannerProps> = ({
  expiresAt,
  thresholdDays = 3,
}) => {
  const { t } = useTranslation();
  const formatted = useMemo(() => formatExpiry(expiresAt), [expiresAt]);

  const withinWindow = useMemo(() => {
    const t1 = new Date(expiresAt).getTime();
    if (Number.isNaN(t1)) return false;
    const deltaMs = t1 - Date.now();
    if (deltaMs < 0) return false; // already expired — gone-state, not warning
    return deltaMs < thresholdDays * 24 * 60 * 60 * 1000;
  }, [expiresAt, thresholdDays]);

  if (!withinWindow) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('contacts.cards.expiryBanner.sr_label')}
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
      style={{
        background: 'var(--pulse-tone-warning-soft)',
        color: 'var(--pulse-ink)',
        border: '1px solid var(--pulse-border)',
      }}
    >
      <AlertTriangle
        size={16}
        aria-hidden="true"
        style={{ color: 'var(--pulse-tone-warning)', marginTop: 2, flexShrink: 0 }}
      />
      <span>{t('contacts.cards.expiryBanner.format', { datetime: formatted })}</span>
    </div>
  );
};

export default ExpiryWarningBanner;

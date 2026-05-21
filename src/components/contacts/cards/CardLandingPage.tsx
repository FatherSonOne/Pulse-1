import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CardSnapshot } from '../../../types/contactCard';
import { CardProvenanceLine } from './CardProvenanceLine';

export type LandingState = 'valid' | 'revoked' | 'expired' | 'consumed' | 'not_found';

export interface CardLandingData {
  /**
   * Card subject identity (whitelisted fields only — see CardSnapshot).
   */
  cardSnapshot: CardSnapshot;
  /** Sender display name, resolved server-side. Verbatim. */
  senderDisplayName: string;
  /** Forwarding chain root display name, if this card is a forward. */
  originalSenderName?: string | null;
  /** Server-rendered intro note (plain text — render as React text node). */
  introNote?: string | null;
  /** Token string (used to build vCard download href). */
  token: string;
  /** Public vCard URL (server typically renders this). */
  vcardUrl?: string;
  /** App store smart-link for "Get Pulse" CTA. */
  appStoreUrl?: string;
}

interface CardLandingPageProps {
  state: LandingState;
  data?: CardLandingData;
  /**
   * When true, the OS has handed off to the installed Pulse app via
   * Universal Link / App Link. The page should NOT render in this case;
   * pass `intercepted` so the parent edge wrapper knows to skip render.
   * (For in-app preview / Storybook usage, set false.)
   */
  intercepted?: boolean;
}

/**
 * Public landing page for non-Pulse recipients (vision § Layout sketches § 8).
 *
 * In production this is server-rendered by the `resolve-card-deeplink`
 * edge function (or a static-edge HTML route hydrated with the edge
 * data). This React component exists so the in-app preview and tests
 * can exercise the same layout. DevOps wires the SSR wrapping.
 *
 * Gone-state pages (revoked/expired/consumed/not_found) deliberately
 * show no sender name or card content — Adversarial Adam UUID-probing
 * defense (R-18).
 */
export const CardLandingPage: React.FC<CardLandingPageProps> = ({
  state,
  data,
  intercepted,
}) => {
  const { t } = useTranslation();

  if (intercepted) return null;

  // Gone-state variants
  if (state !== 'valid' || !data) {
    let title = t('contacts.cards.landing.gone_title');
    let subtitle: string | null = t('contacts.cards.landing.gone_subtitle');
    if (state === 'consumed') {
      title = t('contacts.cards.landing.single_use_consumed_title');
      subtitle = null;
    } else if (state === 'not_found') {
      title = t('contacts.cards.landing.not_found_title');
      subtitle = null;
    }
    return (
      <main
        role="main"
        aria-label="Card unavailable"
        className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 text-center"
        style={{ background: 'var(--pulse-canvas)', color: 'var(--pulse-ink)' }}
      >
        <div
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--pulse-rose)', marginBottom: 32 }}
        >
          Pulse
        </div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--pulse-ink)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            {subtitle}
          </p>
        )}
        <p
          className="mt-8 text-sm font-medium"
          style={{ color: 'var(--pulse-ink-2)' }}
        >
          {t('contacts.cards.landing.get_pulse_secondary_cta')}
        </p>
      </main>
    );
  }

  const subjectName = data.cardSnapshot.name?.trim() || '';
  const titleLine = [
    data.cardSnapshot.title,
    data.cardSnapshot.company ? `at ${data.cardSnapshot.company}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const isForwarded = Boolean(data.originalSenderName);

  const sanitizedFileName = subjectName
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .slice(0, 64) || 'contact';

  return (
    <main
      role="main"
      aria-label="Contact card"
      className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-4 py-10"
      style={{ background: 'var(--pulse-canvas)', color: 'var(--pulse-ink)' }}
    >
      <div
        className="text-2xl font-bold tracking-tight"
        style={{ color: 'var(--pulse-rose)' }}
      >
        Pulse
      </div>

      <h1 className="mt-8 text-center text-lg font-semibold" style={{ color: 'var(--pulse-ink)' }}>
        {t('contacts.cards.landing.shared_by_format', { sender: data.senderDisplayName })}
      </h1>

      <div
        className="mt-6 w-full rounded-2xl p-5 text-center"
        style={{
          background: 'var(--pulse-surface)',
          border: '1px solid var(--pulse-border)',
        }}
      >
        <div
          className="mx-auto flex items-center justify-center rounded-full font-bold"
          style={{
            width: 96,
            height: 96,
            background: data.cardSnapshot.avatar_color || 'var(--pulse-surface-raised)',
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
        <h2
          className="mt-3 text-lg font-bold"
          style={{ color: 'var(--pulse-ink)' }}
          // Display name verbatim
        >
          {subjectName}
        </h2>
        {titleLine && (
          <p className="mt-1 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            {titleLine}
          </p>
        )}

        <div className="mt-4 space-y-1 text-sm text-left" style={{ color: 'var(--pulse-ink)' }}>
          {data.cardSnapshot.email && <p>{data.cardSnapshot.email}</p>}
          {data.cardSnapshot.phone && <p>{data.cardSnapshot.phone}</p>}
          {data.cardSnapshot.address && <p>{data.cardSnapshot.address}</p>}
        </div>

        {data.introNote && (
          <div className="mt-4 text-left">
            <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: 'var(--pulse-ink-3)' }}>
              {t('contacts.cards.landing.note_label_format', { sender: data.senderDisplayName })}
            </p>
            <p className="text-sm" style={{ color: 'var(--pulse-ink-2)', whiteSpace: 'pre-wrap' }}>
              {/* React auto-escapes text content */}
              {data.introNote}
            </p>
          </div>
        )}
      </div>

      {/* Primary CTA */}
      <a
        href={data.vcardUrl || `/api/cards/${data.token}/vcard`}
        download={`${sanitizedFileName}.vcf`}
        className="mt-6 w-full rounded-lg px-4 py-3 text-center font-semibold"
        style={{
          minHeight: 44,
          background: 'var(--pulse-rose)',
          color: 'var(--pulse-surface)',
        }}
      >
        {t('contacts.cards.landing.save_to_contacts_cta')}
      </a>

      {/* Secondary CTA */}
      {data.appStoreUrl && (
        <a
          href={data.appStoreUrl}
          className="mt-3 text-sm font-medium"
          style={{ color: 'var(--pulse-ink-2)', minHeight: 44 }}
        >
          {t('contacts.cards.landing.get_pulse_cta')}
        </a>
      )}

      {/* Provenance */}
      <div className="mt-8 w-full">
        <CardProvenanceLine
          immediateSenderName={data.senderDisplayName}
          originalSenderName={isForwarded ? data.originalSenderName ?? null : null}
          variant="inline"
        />
      </div>
    </main>
  );
};

export default CardLandingPage;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { ContactCard, BulkAcceptResult } from '../../../types/contactCard';
import contactCardService from '../../../services/contactCardService';
import { ReceivedCardListItem } from './ReceivedCardListItem';

export interface ReceivedTabProps {
  /**
   * Optional pre-loaded cards. When omitted, ReceivedTab loads via the
   * contactCardService on mount. The orchestrator may pass a hydrated
   * list (e.g. from a parent query) for SSR-style hand-off.
   */
  initialCards?: ContactCard[];
  /**
   * Map of sender_user_id → display name. Resolved by the orchestrator
   * (which has access to auth.users.raw_user_meta_data). If a sender is
   * missing from this map, we fall back to a stable placeholder.
   *
   * NOTE(phase-6-review): when the user-profile resolver service ships,
   * replace this prop with a hook that fetches lazily.
   */
  senderNames?: Record<string, string>;
  /**
   * Optional callback when the user wants to open the Sent Cards view
   * (vision spec § 3 — "Sent cards →" link in the tab header).
   */
  onOpenSentCards?: () => void;
  /**
   * Optional override to navigate to the card detail. When omitted,
   * the tab manages its own detail view via local state.
   */
  onOpenCard?: (cardId: string) => void;
}

/**
 * The 4th top-level Contacts tab (Aiko's daily-arrival surface).
 *
 * Coral-budget exception: the unread badge on the parent tab control
 * uses `--pulse-coral-bg-12`. The tab body itself stays neutral.
 *
 * Empty state, loading skeleton, multi-select, bulk Accept, post-accept
 * summary with "Review duplicates" CTA all live here. The detail view
 * (`ReceivedCardDetail`) renders inline below this list when a card is
 * focused — matches the existing right-pane pattern in
 * `ContactsRedesigned.tsx`.
 */
export const ReceivedTab: React.FC<ReceivedTabProps> = ({
  initialCards,
  senderNames,
  onOpenSentCards,
  onOpenCard,
}) => {
  const { t } = useTranslation();
  const [cards, setCards] = useState<ContactCard[]>(initialCards ?? []);
  const [loading, setLoading] = useState(!initialCards);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acceptSummary, setAcceptSummary] = useState<BulkAcceptResult | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const resolveSenderName = useCallback(
    (senderUserId: string): string => {
      if (senderNames && senderNames[senderUserId]) return senderNames[senderUserId];
      // TODO(phase-6-review): when user-profile resolver ships, swap this
      // fallback for an async fetch. The placeholder keeps the row legible
      // without exposing the raw user id.
      return 'Pulse user';
    },
    [senderNames],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const fresh = await contactCardService.fetchReceived();
      setCards(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      console.warn('[ReceivedTab] fetchReceived failed:', err);
      setLoadError(t('contacts.cards.receivedTab.error_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (initialCards) return;
    void load();
  }, [initialCards, load]);

  const expiringSoonCount = useMemo(() => {
    const now = Date.now();
    return cards.filter(c => {
      if (!c.expires_at) return false;
      const t1 = new Date(c.expires_at).getTime();
      return Number.isFinite(t1) && t1 - now < 3 * 86_400_000 && t1 > now;
    }).length;
  }, [cards]);

  const allSelected = cards.length > 0 && selected.size === cards.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cards.map(c => c.id)));
    }
  };

  const toggleOne = (cardId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const handleAccept = async () => {
    if (selected.size === 0 || accepting) return;
    setAccepting(true);
    try {
      // Bulk accept via repeated single-card accept calls (the service
      // wrapper currently invokes accept-contact-card per call; the
      // backend's edge function handles bulk shape internally — see
      // service contract). Aggregate the results for the summary.
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map(id => contactCardService.acceptCard(id, { connectWithSender: true })),
      );
      const aggregated: BulkAcceptResult = results.reduce<BulkAcceptResult>(
        (acc, r) => ({
          added: acc.added + r.added,
          linked: acc.linked + r.linked,
          skipped: acc.skipped + r.skipped,
          per_card: [...acc.per_card, ...r.per_card],
        }),
        { added: 0, linked: 0, skipped: 0, per_card: [] },
      );
      setAcceptSummary(aggregated);
      setSelected(new Set());
      // Remove accepted rows from the list (they no longer belong in Received).
      setCards(prev => prev.filter(c => !ids.includes(c.id)));
    } catch (err) {
      console.warn('[ReceivedTab] bulk accept failed:', err);
      toast.error(t('contacts.cards.acceptModal.error_generic'));
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineSelected = async () => {
    if (selected.size === 0 || accepting) return;
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map(id => contactCardService.declineCard(id)));
      setCards(prev => prev.filter(c => !ids.includes(c.id)));
      setSelected(new Set());
      // TODO(phase-6-review): no explicit toast — vision spec only locks
      // single-card decline toast copy. Using sensible default.
    } catch (err) {
      console.warn('[ReceivedTab] decline failed:', err);
    }
  };

  // Render header summary line
  const headerSummary = useMemo(() => {
    const newCount = cards.length;
    if (newCount === 0) return t('contacts.cards.receivedTab.header_summary_empty');
    if (expiringSoonCount > 0) {
      return t('contacts.cards.receivedTab.header_summary_format', {
        newCount,
        expiringCount: expiringSoonCount,
      });
    }
    return t('contacts.cards.receivedTab.header_summary_simple_format', { newCount });
  }, [cards.length, expiringSoonCount, t]);

  return (
    <div role="region" aria-label={t('contacts.cards.receivedTab.tab_label')}>
      {/* Header */}
      <div
        className="flex items-start justify-between gap-4 px-4 pt-4 pb-3"
        style={{ borderBottom: '1px solid var(--pulse-border)' }}
      >
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--pulse-ink)' }}>
            {t('contacts.cards.receivedTab.tab_label')}
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            {headerSummary}
          </p>
        </div>
        {onOpenSentCards && (
          <button
            type="button"
            onClick={onOpenSentCards}
            className="text-sm font-medium"
            style={{ color: 'var(--pulse-rose)', minHeight: 44 }}
          >
            {t('contacts.cards.receivedTab.sent_cards_link')}
          </button>
        )}
      </div>

      {/* Post-Accept summary */}
      {acceptSummary && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between px-4 py-3"
          style={{
            background: 'var(--pulse-tone-positive-soft)',
            borderBottom: '1px solid var(--pulse-border)',
            color: 'var(--pulse-ink)',
          }}
        >
          <span className="text-sm">
            {t('contacts.cards.receivedTab.post_accept_summary_format', {
              added: acceptSummary.added,
              linked: acceptSummary.linked,
              skipped: acceptSummary.skipped,
            })}
          </span>
          {acceptSummary.linked > 0 && (
            <button
              type="button"
              onClick={() => {
                // TODO(phase-6-review): wire to ReviewDuplicatesScreen route
                // when the orchestrator picks the routing approach. For now
                // this CTA is a no-op signal.
                toast(
                  t('contacts.cards.reviewDuplicates.title_format', {
                    count: acceptSummary.linked,
                  }),
                );
              }}
              className="text-sm font-semibold underline"
              style={{ color: 'var(--pulse-rose)', minHeight: 44 }}
            >
              {t('contacts.cards.receivedTab.post_accept_review_cta')}
            </button>
          )}
        </div>
      )}

      {/* Multi-select toolbar */}
      {cards.length > 0 && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2"
          style={{ borderBottom: '1px solid var(--pulse-border)' }}
        >
          <label className="flex cursor-pointer items-center gap-2" style={{ minHeight: 44 }}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={toggleAll}
              className="h-5 w-5"
              aria-label={t('contacts.cards.receivedTab.select_all')}
            />
            <span className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
              {selected.size > 0
                ? t('contacts.cards.receivedTab.selection_count_format', { count: selected.size })
                : t('contacts.cards.receivedTab.select_all')}
            </span>
          </label>

          {selected.size > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAccept}
                disabled={accepting}
                className="inline-flex items-center gap-2 rounded-lg px-3 font-semibold disabled:opacity-50"
                style={{
                  minHeight: 44,
                  background: 'var(--pulse-rose)',
                  color: 'var(--pulse-surface)',
                }}
              >
                {accepting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {t('contacts.cards.receivedTab.accept_selected_cta')}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen(v => !v)}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  aria-label={t('contacts.cards.receivedTab.accept_selected_menu_aria')}
                  className="inline-flex items-center justify-center rounded-lg"
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    background: 'var(--pulse-surface-raised)',
                    border: '1px solid var(--pulse-border)',
                    color: 'var(--pulse-ink)',
                  }}
                >
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                {moreOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 w-56 rounded-lg shadow-lg z-10"
                    style={{
                      background: 'var(--pulse-surface)',
                      border: '1px solid var(--pulse-border)',
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        void handleDeclineSelected();
                      }}
                      className="w-full px-3 text-left text-sm"
                      style={{ minHeight: 44, color: 'var(--pulse-ink)' }}
                    >
                      {t('contacts.cards.receivedTab.decline_selected_action')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        // TODO(phase-6-review): wire snooze when the snooze
                        // service is defined. Vision spec mentions the 7-day
                        // snooze but no service method exists yet.
                        toast(t('contacts.cards.receivedDetail.maybe_toast'));
                      }}
                      className="w-full px-3 text-left text-sm"
                      style={{ minHeight: 44, color: 'var(--pulse-ink)' }}
                    >
                      {t('contacts.cards.receivedTab.maybe_action')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        // TODO(phase-6-review): wire to card_send_blocks
                        // insert via service when block-sender method exists.
                        toast(t('contacts.cards.receivedTab.block_sender_action'));
                      }}
                      className="w-full px-3 text-left text-sm"
                      style={{ minHeight: 44, color: 'var(--pulse-tone-overdue)' }}
                    >
                      {t('contacts.cards.receivedTab.block_sender_action')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="px-4 py-6 space-y-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="animate-pulse rounded-lg"
              style={{
                height: 72,
                background:
                  'linear-gradient(90deg, var(--pulse-canvas-soft), var(--pulse-surface-raised))',
              }}
            />
          ))}
        </div>
      ) : loadError ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg px-4 font-semibold"
            style={{
              minHeight: 44,
              background: 'var(--pulse-rose)',
              color: 'var(--pulse-surface)',
            }}
          >
            {t('contacts.cards.receivedTab.error_retry_cta')}
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <h3 className="text-base font-semibold" style={{ color: 'var(--pulse-ink)' }}>
            {t('contacts.cards.receivedTab.empty_title')}
          </h3>
          <p className="mt-2 text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            {t('contacts.cards.receivedTab.empty_body')}
          </p>
          <p className="mt-4 text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
            {t('contacts.cards.receivedTab.empty_secondary_cta')}
          </p>
        </div>
      ) : (
        <div role="list" className="pb-4">
          {cards.map(card => (
            <ReceivedCardListItem
              key={card.id}
              card={card}
              senderDisplayName={resolveSenderName(card.sender_user_id)}
              selected={selected.has(card.id)}
              unread={true /* Phase 6: real read-marker comes from backend. */}
              isForwarded={Boolean(card.forwarded_from_card_id)}
              onToggleSelect={toggleOne}
              onOpen={cid => onOpenCard?.(cid)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReceivedTab;

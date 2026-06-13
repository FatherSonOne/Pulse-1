import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceData, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import billingService, { type Invoice, type Subscription } from '../../services/billingService';
import { useEntitlements } from '../../hooks/useEntitlements';
import { UsageLimitWarning } from '../billing/UpgradePrompt';
import { UsageWarningBanner } from '../billing/UsageWarningBanner';
import { TaxIdCard } from './billing/TaxIdCard';
import { BillingContactsCard } from './billing/BillingContactsCard';
import { InvoicesCard } from './billing/InvoicesCard';
import {
  markJustPaidGrace,
  trackOnboarding,
  OnboardingEvent,
} from '../../lib/monitoring/onboardingEvents';

// ── Constants ────────────────────────────────────────────────────────

const PULSE_TEAM_PLAN_ID = 'pulse_team';
const PULSE_GROWTH_PLAN_ID = 'pulse_growth';

const PULSE_TEAM_PRICING = {
  monthly: 15, // per seat / month
  yearly: 150, // per seat / year — 2 months free vs. $180
};

const PULSE_GROWTH_PRICING = {
  monthly: 300,
  yearly: 3000, // 2 months free vs. $3600
};

const PULSE_TEAM_FEATURES: string[] = [
  'Per-seat billing — $15 / user / mo · min 2 seats',
  '2,000 AI messages / month',
  '50 GB storage',
  '500 Relay minutes / month',
  'All 5 Relay peers + Triage stream',
  'Glimpse async video + Studio RAG',
  'Calendar, messaging, meetings',
  'Advanced analytics + full ecosystem bridge',
];

const PULSE_GROWTH_FEATURES: string[] = [
  'Everything in Team, plus:',
  '10,000 AI messages / month (5×)',
  '500 GB storage (10×)',
  '2,500 Relay minutes / month (5×)',
  'SSO / SAML — coming soon',
  'API access with rate-limited keys',
  'Audit log retention: 365 days',
  'Priority support — 1 business day SLA',
];

const TEAM_COLORS = {
  gradient: 'linear-gradient(135deg, #d946ef, #ec4899)',
  shadow: 'rgba(217, 70, 239, 0.3)',
  badge: '#d946ef',
};

const GROWTH_COLORS = {
  gradient: 'linear-gradient(135deg, #7c3aed, #6366f1)',
  shadow: 'rgba(124, 58, 237, 0.3)',
  badge: '#7c3aed',
};

const PULSE_SOLO_PLAN_ID = 'pulse_solo';

const PULSE_SOLO_PRICING = {
  monthly: 20,
  yearly: 200, // 10 months for 12 (matches the annual discount on Team/Growth)
};

const PULSE_SOLO_FEATURES: string[] = [
  '1 seat — just you',
  '1,500 AI messages / month',
  '25 GB storage',
  '300 Relay minutes / month',
  'All 5 Relay peers + Triage stream',
  'Glimpse async video + Studio RAG',
  'Calendar, messaging, meetings',
];

const SOLO_COLORS = {
  gradient: 'linear-gradient(135deg, #fb7185, #f43f5e)', // rose — distinct from Team magenta / Growth purple
  shadow: 'rgba(244, 63, 94, 0.3)',
  badge: '#f43f5e',
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Unlimited';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatNumber(n: number | null): string {
  if (n === null) return 'Unlimited';
  return n.toLocaleString();
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** First day of the next calendar month, formatted nicely. */
function nextMonthlyReset(): string {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Infer billing cycle from subscription trial/period span. Defaults to monthly. */
function inferBillingCycle(sub: Subscription | null): 'monthly' | 'yearly' {
  if (!sub?.current_period_start || !sub?.current_period_end) return 'monthly';
  const start = new Date(sub.current_period_start).getTime();
  const end = new Date(sub.current_period_end).getTime();
  const days = (end - start) / (1000 * 60 * 60 * 24);
  return days > 60 ? 'yearly' : 'monthly';
}

// ── Component ────────────────────────────────────────────────────────

export const BillingSettings: React.FC = () => {
  const { currentWorkspace, members } = useWorkspaceData();
  const { isOwner, isAdmin } = useWorkspacePermissions();
  const {
    entitlements,
    isTrialing,
    trialDaysLeft,
    hasActivePulseAccess,
    isLoading: entLoading,
    error: entError,
    refresh: refreshEntitlements,
  } = useEntitlements();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [growthCycle, setGrowthCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [soloCycle, setSoloCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] =
    useState<{ type: 'success' | 'canceled'; text: string } | null>(null);
  const [usageHighlight, setUsageHighlight] = useState(false);

  const usageSectionRef = useRef<HTMLDivElement | null>(null);

  const canManageBilling = isOwner || isAdmin;
  const workspaceId = currentWorkspace?.id;

  // Handle ?billing=success / ?billing=canceled redirect from Stripe.
  // Success path: arm the just-paid grace window so TrialGate suppresses the
  // paywall while the billing-webhook is still writing entitlements, then
  // refresh entitlements + poll every 1.5s up to 15s until access is real.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingParam = params.get('billing');
    if (billingParam === 'success') {
      setCheckoutMessage({
        type: 'success',
        text: 'Subscription updated. Pulse is unlocking your workspace now.',
      });
      markJustPaidGrace(30_000);
      trackOnboarding(OnboardingEvent.CheckoutCompleted, {
        workspace_id: currentWorkspace?.id,
      });
      refreshEntitlements().catch(() => {});

      let attempts = 0;
      const poll = window.setInterval(() => {
        attempts += 1;
        refreshEntitlements().catch(() => {});
        if (attempts >= 10) window.clearInterval(poll);
      }, 1500);

      params.delete('billing');
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`,
      );

      return () => window.clearInterval(poll);
    } else if (billingParam === 'canceled') {
      setCheckoutMessage({ type: 'canceled', text: 'Checkout canceled. No changes were made.' });
      params.delete('billing');
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`,
      );
    }
  }, [currentWorkspace?.id, refreshEntitlements]);

  // Deep-link from the sidebar "Nearing usage limit" banner: focus the usage
  // section and briefly highlight it so the user lands on the right card.
  useEffect(() => {
    if (loading || entLoading) return;
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('billing_focus');
    if (focus !== 'usage' || !usageSectionRef.current) return;

    usageSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setUsageHighlight(true);
    const t = setTimeout(() => setUsageHighlight(false), 2400);

    params.delete('billing_focus');
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`,
    );
    return () => clearTimeout(t);
  }, [loading, entLoading]);

  useEffect(() => {
    if (!workspaceId) return;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [invoicesData, subData] = await Promise.all([
          canManageBilling ? billingService.getInvoices(workspaceId) : Promise.resolve([]),
          billingService.getSubscription(workspaceId),
        ]);
        setInvoices(invoicesData);
        setSubscription(subData);

        // Prime the cycle toggle with the user's actual billing cadence
        const inferred = inferBillingCycle(subData);
        setSelectedCycle(inferred);
      } catch (err) {
        console.error('Failed to load billing data:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load billing information');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workspaceId, canManageBilling]);

  const handleCheckout = useCallback(
    async (cycle: 'monthly' | 'yearly') => {
      if (!workspaceId) return;
      setActionLoading('checkout');
      try {
        const url = await billingService.createCheckout({
          workspaceId,
          planId: PULSE_TEAM_PLAN_ID,
          billingCycle: cycle,
        });
        window.location.href = url;
      } catch (err) {
        console.error('Checkout failed:', err);
        setLoadError(err instanceof Error ? err.message : 'Checkout failed. Try again.');
      } finally {
        setActionLoading(null);
      }
    },
    [workspaceId],
  );

  const handleCheckoutSolo = useCallback(
    async (cycle: 'monthly' | 'yearly') => {
      if (!workspaceId) return;
      setActionLoading('checkout-solo');
      try {
        const url = await billingService.createCheckout({
          workspaceId,
          planId: PULSE_SOLO_PLAN_ID,
          billingCycle: cycle,
        });
        window.location.href = url;
      } catch (err) {
        console.error('Solo checkout failed:', err);
        setLoadError(err instanceof Error ? err.message : 'Checkout failed. Try again.');
      } finally {
        setActionLoading(null);
      }
    },
    [workspaceId],
  );

  const handleCheckoutGrowth = useCallback(
    async (cycle: 'monthly' | 'yearly') => {
      if (!workspaceId) return;
      setActionLoading('checkout-growth');
      try {
        const url = await billingService.createCheckout({
          workspaceId,
          planId: PULSE_GROWTH_PLAN_ID,
          billingCycle: cycle,
        });
        window.location.href = url;
      } catch (err) {
        console.error('Growth checkout failed:', err);
        setLoadError(err instanceof Error ? err.message : 'Checkout failed. Try again.');
      } finally {
        setActionLoading(null);
      }
    },
    [workspaceId],
  );

  const handleManageBilling = useCallback(async () => {
    if (!workspaceId) return;
    setActionLoading('portal');
    try {
      const url = await billingService.openCustomerPortal(workspaceId);
      window.location.href = url;
    } catch (err) {
      console.error('Portal failed:', err);
      setLoadError(err instanceof Error ? err.message : 'Could not open the billing portal.');
    } finally {
      setActionLoading(null);
    }
  }, [workspaceId]);

  const displayError = loadError || entError;

  // ── Header (shared between loading and loaded states) ──
  const header = (
    <div className="section-header">
      <h3>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--pulse-rose)' }}
        >
          <path d="M4 2h16a1 1 0 0 1 1 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1z" />
          <line x1="8" y1="9" x2="16" y2="9" />
          <line x1="8" y1="13" x2="14" y2="13" />
        </svg>
        Plan &amp; Billing
      </h3>
      <p>Manage your Pulse Team subscription, usage, and payment settings.</p>
    </div>
  );

  // ── Loading ──
  if (loading || entLoading) {
    return (
      <div className="space-y-8 animate-slide-up">
        {header}
        <div
          className="flex items-center justify-center py-12"
          style={{ color: 'var(--pulse-ink-3)' }}
        >
          Loading billing information...
        </div>
      </div>
    );
  }

  // ── Expired state (minimal placeholder; TrialExpiredBlock handles the real paywall at App level) ──
  if (!hasActivePulseAccess) {
    return (
      <div className="space-y-8 animate-slide-up">
        {header}
        <div
          className="rounded-xl p-6 text-center"
          style={{
            background: 'var(--pulse-surface)',
            border: '1px solid var(--pulse-border)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--pulse-ink-2)' }}>
            Your Pulse trial has expired. See the upgrade prompt to restore access.
          </p>
        </div>
      </div>
    );
  }

  // Derived UI state
  const subscriptionCycle = inferBillingCycle(subscription);
  const activeMonthlyEquivalent =
    subscriptionCycle === 'yearly'
      ? Math.round(PULSE_TEAM_PRICING.yearly / 12)
      : PULSE_TEAM_PRICING.monthly;

  // True when the workspace has a real paid Stripe subscription (not a synthetic
  // pre-Stripe trial). Plan changes must go through the Customer Portal in this
  // state — Stripe handles proration and prevents the double-subscription bug.
  const hasActivePaidSub =
    !isTrialing &&
    !!subscription &&
    (subscription.status === 'active' || subscription.status === 'past_due');

  const statusBadge = isTrialing
    ? `TRIAL · ${trialDaysLeft}d LEFT`
    : subscription?.cancel_at_period_end
    ? 'CANCELS SOON'
    : subscription?.status === 'past_due'
    ? 'PAST DUE'
    : subscription?.status === 'canceled'
    ? 'CANCELED'
    : 'ACTIVE';

  return (
    <div className="space-y-8 animate-slide-up">
      {header}

      {/* Near-limit warning — dismissible; appears when any metered resource
          (AI messages, storage, Relay minutes) is >= 80% of the cap. */}
      <UsageWarningBanner />

      {/* Checkout success / canceled toast */}
      {checkoutMessage && (
        <div
          className="rounded-xl p-4 flex items-center justify-between"
          style={{
            background: checkoutMessage.type === 'success' ? '#10b98110' : 'var(--pulse-surface)',
            border: `1px solid ${
              checkoutMessage.type === 'success' ? '#10b98130' : 'var(--pulse-border)'
            }`,
          }}
        >
          <div className="flex items-center gap-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                stroke: checkoutMessage.type === 'success' ? '#10b981' : 'var(--pulse-ink-3)',
              }}
            >
              {checkoutMessage.type === 'success' ? (
                <>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </>
              )}
            </svg>
            <span
              className="text-sm"
              style={{
                color:
                  checkoutMessage.type === 'success' ? '#10b981' : 'var(--pulse-ink-2)',
              }}
            >
              {checkoutMessage.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutMessage(null)}
            className="text-xs"
            style={{ color: 'var(--pulse-ink-3)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error banner */}
      {displayError && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: '#ef444410', border: '1px solid #ef444430' }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: '#ef4444', flexShrink: 0 }}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-sm" style={{ color: '#ef4444' }}>
            {displayError}
          </span>
        </div>
      )}

      {/* Current Plan Banner */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: `linear-gradient(135deg, ${TEAM_COLORS.badge}08, ${TEAM_COLORS.badge}04)`,
          border: `1px solid ${TEAM_COLORS.badge}30`,
        }}
      >
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{
              background: TEAM_COLORS.gradient,
              boxShadow: `0 4px 12px ${TEAM_COLORS.shadow}`,
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xl font-bold dark:text-white text-zinc-900">Pulse Team</h4>
              <span
                className="px-2 py-0.5 text-white text-xs font-bold rounded-full"
                style={{
                  background: TEAM_COLORS.badge,
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                }}
              >
                {statusBadge}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--pulse-ink-3)' }}>
              {isTrialing ? (
                <>
                  30-day trial ·{' '}
                  <span style={{ color: 'var(--pulse-ink)', fontWeight: 500 }}>
                    {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} remaining
                  </span>
                  {subscription?.trial_end && ` · Ends ${formatDate(subscription.trial_end)}`}
                </>
              ) : (
                <>
                  ${activeMonthlyEquivalent}/user/mo
                  {subscriptionCycle === 'yearly' &&
                    ` (billed $${PULSE_TEAM_PRICING.yearly.toLocaleString()}/user/yr)`}
                  {subscription?.current_period_end &&
                    ` · Next renewal: ${formatDate(subscription.current_period_end)}`}
                  {subscription?.cancel_at_period_end && ' · Cancels at period end'}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Manage subscription button (paid only, admin only) */}
        {canManageBilling && !isTrialing && subscription && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
              style={{
                background: 'var(--pulse-surface)',
                border: '1px solid var(--pulse-border)',
                color: 'var(--pulse-ink)',
              }}
            >
              {actionLoading === 'portal' ? 'Opening...' : 'Manage Subscription'}
            </button>
          </div>
        )}
      </div>

      {/* Seat usage — paid plans only, billed per active member */}
      {canManageBilling && !isTrialing && subscription && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'var(--pulse-surface)',
            border: '1px solid var(--pulse-border)',
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h5 className="text-sm font-semibold dark:text-white text-zinc-900 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Seats
              </h5>
              <p className="text-xs mt-1" style={{ color: 'var(--pulse-ink-3)' }}>
                {members.length} active {members.length === 1 ? 'member' : 'members'} ·
                ${activeMonthlyEquivalent} per seat / month
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold dark:text-white text-zinc-900">
                ${(members.length * activeMonthlyEquivalent).toLocaleString()}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--pulse-ink-3)' }}>
                est. next invoice
              </div>
            </div>
          </div>
          <p className="text-[11px] mt-3 pt-3 border-t" style={{ color: 'var(--pulse-ink-3)', borderColor: 'var(--pulse-border)' }}>
            Your plan scales with your team — you're charged for each active member.
            Adding or removing members updates Stripe automatically and prorates the next invoice.
            {currentWorkspace?.auto_join_enabled && currentWorkspace?.auto_join_domain && (
              <> Auto-join is enabled for <strong>{currentWorkspace.auto_join_domain}</strong>;
              anyone signing up with that email domain will be added and billed.</>
            )}
          </p>
        </div>
      )}

      {/* Solo upgrade card — the entry/hero tier (1 seat, flat price). Rendered
          first, gated identically to the Team trial card below. */}
      {isTrialing && canManageBilling && entitlements?.apps?.pulse !== 'growth' && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--pulse-surface)',
            border: `2px solid ${SOLO_COLORS.badge}40`,
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4
                  className="text-lg font-bold"
                  style={{ color: 'var(--pulse-ink)' }}
                >
                  Pulse Solo
                </h4>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{
                    background: `${SOLO_COLORS.badge}20`,
                    color: SOLO_COLORS.badge,
                    letterSpacing: '0.04em',
                  }}
                >
                  SOLO
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>
                Just you — the full Pulse toolkit at the entry price.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: 'var(--pulse-ink)' }}>
                $
                {soloCycle === 'monthly'
                  ? PULSE_SOLO_PRICING.monthly
                  : Math.round(PULSE_SOLO_PRICING.yearly / 12)}
                <span
                  className="text-sm font-normal"
                  style={{ color: 'var(--pulse-ink-3)' }}
                >
                  /mo
                </span>
              </div>
              {soloCycle === 'yearly' && (
                <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  ${PULSE_SOLO_PRICING.yearly.toLocaleString()} billed yearly · 2 months free
                </div>
              )}
            </div>
          </div>

          {/* Billing cycle toggle */}
          <div
            className="flex items-center gap-2 rounded-xl p-1 mb-5"
            style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
          >
            <button
              type="button"
              onClick={() => setSoloCycle('monthly')}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: soloCycle === 'monthly' ? SOLO_COLORS.gradient : 'transparent',
                color: soloCycle === 'monthly' ? 'white' : 'var(--pulse-ink-3)',
                boxShadow: soloCycle === 'monthly' ? `0 2px 8px ${SOLO_COLORS.shadow}` : 'none',
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setSoloCycle('yearly')}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: soloCycle === 'yearly' ? SOLO_COLORS.gradient : 'transparent',
                color: soloCycle === 'yearly' ? 'white' : 'var(--pulse-ink-3)',
                boxShadow: soloCycle === 'yearly' ? `0 2px 8px ${SOLO_COLORS.shadow}` : 'none',
              }}
            >
              Yearly
              <span className="text-xs ml-1" style={{ color: '#10b981' }}>
                2 months free
              </span>
            </button>
          </div>

          {/* Features */}
          <ul className="space-y-2 mb-5">
            {PULSE_SOLO_FEATURES.map((feat) => (
              <li
                key={feat}
                className="flex items-start gap-2 text-sm"
                style={{ color: 'var(--pulse-ink-2)' }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: SOLO_COLORS.badge, marginTop: 3, flexShrink: 0 }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{feat}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => handleCheckoutSolo(soloCycle)}
            disabled={actionLoading === 'checkout-solo'}
            className="w-full py-3 px-4 text-sm font-semibold rounded-xl transition-all text-white disabled:opacity-50"
            style={{
              background: SOLO_COLORS.gradient,
              boxShadow: `0 4px 12px ${SOLO_COLORS.shadow}`,
            }}
          >
            {actionLoading === 'checkout-solo' ? 'Redirecting to checkout...' : 'Get Pulse Solo'}
          </button>
        </div>
      )}

      {/* Trial upgrade card — only when on a Team trial. Defensive `apps.pulse`
          check prevents this card from leaking through if entitlements drift
          (e.g. trial sub left dangling after upgrade — see the May-14 incident). */}
      {isTrialing && canManageBilling && entitlements?.apps?.pulse !== 'growth' && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--pulse-surface)',
            border: `2px solid ${TEAM_COLORS.badge}40`,
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <h4
                className="text-lg font-bold"
                style={{ color: 'var(--pulse-ink)' }}
              >
                Upgrade to Pulse Team
              </h4>
              <p className="text-sm mt-1" style={{ color: 'var(--pulse-ink-3)' }}>
                Keep your team connected after your trial ends.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: 'var(--pulse-ink)' }}>
                $
                {selectedCycle === 'monthly'
                  ? PULSE_TEAM_PRICING.monthly
                  : Math.round(PULSE_TEAM_PRICING.yearly / 12)}
                <span
                  className="text-sm font-normal"
                  style={{ color: 'var(--pulse-ink-3)' }}
                >
                  /user/mo
                </span>
              </div>
              {selectedCycle === 'yearly' ? (
                <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  ${PULSE_TEAM_PRICING.yearly.toLocaleString()} / user billed yearly · 2 months free
                </div>
              ) : (
                <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  billed per active seat, min 2
                </div>
              )}
            </div>
          </div>

          {/* Billing cycle toggle */}
          <div
            className="flex items-center gap-2 rounded-xl p-1 mb-5"
            style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
          >
            <button
              type="button"
              onClick={() => setSelectedCycle('monthly')}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedCycle === 'monthly' ? TEAM_COLORS.gradient : 'transparent',
                color:
                  selectedCycle === 'monthly'
                    ? 'white'
                    : 'var(--pulse-ink-3)',
                boxShadow:
                  selectedCycle === 'monthly' ? `0 2px 8px ${TEAM_COLORS.shadow}` : 'none',
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setSelectedCycle('yearly')}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedCycle === 'yearly' ? TEAM_COLORS.gradient : 'transparent',
                color:
                  selectedCycle === 'yearly'
                    ? 'white'
                    : 'var(--pulse-ink-3)',
                boxShadow:
                  selectedCycle === 'yearly' ? `0 2px 8px ${TEAM_COLORS.shadow}` : 'none',
              }}
            >
              Yearly
              <span className="text-xs ml-1" style={{ color: '#10b981' }}>
                2 months free
              </span>
            </button>
          </div>

          {/* Features */}
          <ul className="space-y-2 mb-5">
            {PULSE_TEAM_FEATURES.map((feat) => (
              <li
                key={feat}
                className="flex items-start gap-2 text-sm"
                style={{ color: 'var(--pulse-ink-2)' }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: '#10b981', marginTop: 3, flexShrink: 0 }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{feat}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => handleCheckout(selectedCycle)}
            disabled={actionLoading === 'checkout'}
            className="w-full py-3 px-4 text-sm font-semibold rounded-xl transition-all text-white disabled:opacity-50"
            style={{
              background: TEAM_COLORS.gradient,
              boxShadow: `0 4px 12px ${TEAM_COLORS.shadow}`,
            }}
          >
            {actionLoading === 'checkout' ? 'Redirecting to checkout...' : 'Upgrade now'}
          </button>
        </div>
      )}

      {/* Upgrade to Growth card — visible to billing managers on Team (not already on Growth) */}
      {canManageBilling && entitlements?.apps?.pulse !== 'growth' && (
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--pulse-surface)',
            border: `2px solid ${GROWTH_COLORS.badge}40`,
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4
                  className="text-lg font-bold"
                  style={{ color: 'var(--pulse-ink)' }}
                >
                  Outgrew Pulse Team?
                </h4>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{
                    background: `${GROWTH_COLORS.badge}20`,
                    color: GROWTH_COLORS.badge,
                    letterSpacing: '0.04em',
                  }}
                >
                  GROWTH
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--pulse-ink-3)' }}>
                5× metered capacity, 10× storage, plus SSO, API access, audit retention,
                custom branding, and priority support.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: 'var(--pulse-ink)' }}>
                $
                {growthCycle === 'monthly'
                  ? PULSE_GROWTH_PRICING.monthly
                  : Math.round(PULSE_GROWTH_PRICING.yearly / 12)}
                <span
                  className="text-sm font-normal"
                  style={{ color: 'var(--pulse-ink-3)' }}
                >
                  /mo
                </span>
              </div>
              {growthCycle === 'yearly' && (
                <div className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
                  ${PULSE_GROWTH_PRICING.yearly.toLocaleString()} billed yearly · 2 months free
                </div>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-2 rounded-xl p-1 mb-5"
            style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
          >
            <button
              type="button"
              onClick={() => setGrowthCycle('monthly')}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: growthCycle === 'monthly' ? GROWTH_COLORS.gradient : 'transparent',
                color: growthCycle === 'monthly' ? 'white' : 'var(--pulse-ink-3)',
                boxShadow: growthCycle === 'monthly' ? `0 2px 8px ${GROWTH_COLORS.shadow}` : 'none',
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setGrowthCycle('yearly')}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: growthCycle === 'yearly' ? GROWTH_COLORS.gradient : 'transparent',
                color: growthCycle === 'yearly' ? 'white' : 'var(--pulse-ink-3)',
                boxShadow: growthCycle === 'yearly' ? `0 2px 8px ${GROWTH_COLORS.shadow}` : 'none',
              }}
            >
              Yearly
              <span className="text-xs ml-1" style={{ color: '#10b981' }}>
                2 months free
              </span>
            </button>
          </div>

          <ul className="space-y-2 mb-5">
            {PULSE_GROWTH_FEATURES.map((feat) => (
              <li
                key={feat}
                className="flex items-start gap-2 text-sm"
                style={{ color: 'var(--pulse-ink-2)' }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: GROWTH_COLORS.badge, marginTop: 3, flexShrink: 0 }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{feat}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => (hasActivePaidSub ? handleManageBilling() : handleCheckoutGrowth(growthCycle))}
            disabled={actionLoading === 'checkout-growth' || actionLoading === 'portal'}
            className="w-full py-3 px-4 text-sm font-semibold rounded-xl transition-all text-white disabled:opacity-50"
            style={{
              background: GROWTH_COLORS.gradient,
              boxShadow: `0 4px 12px ${GROWTH_COLORS.shadow}`,
            }}
          >
            {hasActivePaidSub
              ? actionLoading === 'portal'
                ? 'Opening Stripe portal…'
                : 'Switch to Growth in Stripe portal'
              : actionLoading === 'checkout-growth'
                ? 'Redirecting to checkout...'
                : 'Move up to Growth'}
          </button>
          {hasActivePaidSub && (
            <p
              className="text-xs mt-3 text-center"
              style={{ color: 'var(--pulse-ink-3)' }}
            >
              Plan changes happen in Stripe&rsquo;s portal — proration is automatic and
              you&rsquo;ll never be billed for two plans at once.
            </p>
          )}
        </div>
      )}

      {/* Usage Meters */}
      {entitlements && (
        <div
          ref={usageSectionRef}
          className="rounded-xl p-6 scroll-mt-4 transition-shadow"
          style={{
            background: 'var(--pulse-surface)',
            border: `1px solid ${usageHighlight ? 'var(--pulse-rose)' : 'var(--pulse-border)'}`,
            boxShadow: usageHighlight ? '0 0 0 3px rgba(217, 70, 239, 0.18)' : 'none',
          }}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--pulse-ink-3)',
              }}
            >
              Current Usage
            </h4>
            <span className="text-xs" style={{ color: 'var(--pulse-ink-3)' }}>
              Monthly reset on {nextMonthlyReset()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UsageMeter
              label="AI Messages"
              current={entitlements.usage?.ai_messages || 0}
              limit={entitlements.max_ai_messages_mo}
            />
            <UsageMeter
              label="Storage"
              current={entitlements.usage?.storage_bytes || 0}
              limit={entitlements.max_storage_bytes}
              formatFn={formatBytes}
            />
            <UsageMeter
              label="Relay Minutes"
              current={entitlements.usage?.voxer_minutes || 0}
              limit={entitlements.max_voxer_minutes_mo}
            />
          </div>

          {/* Usage limit warnings */}
          {(['ai_messages', 'sms_sent', 'storage_bytes', 'voxer_minutes'] as const).map((metric) => {
            const limit =
              metric === 'ai_messages'
                ? entitlements.max_ai_messages_mo
                : metric === 'sms_sent'
                ? entitlements.max_sms_mo
                : metric === 'storage_bytes'
                ? entitlements.max_storage_bytes
                : entitlements.max_voxer_minutes_mo;

            if (limit === null) return null;

            const atLimit = billingService.isAtLimit(entitlements, metric);
            const nearLimit =
              !atLimit && billingService.isNearLimit(entitlements, metric);
            if (!atLimit && !nearLimit) return null;

            return (
              <div key={metric} className="mt-4">
                <UsageLimitWarning
                  metric={metric}
                  current={entitlements.usage?.[metric] || 0}
                  limit={limit}
                  onUpgrade={canManageBilling ? () => handleCheckout(selectedCycle) : undefined}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice history — empty state + status filter + summary */}
      {canManageBilling && (
        <InvoicesCard invoices={invoices} />
      )}

      {/* Tax ID — admin+ */}
      {canManageBilling && (
        <TaxIdCard />
      )}

      {/* Additional billing contacts — admin+ */}
      {canManageBilling && (
        <BillingContactsCard />
      )}

      {/* Non-admin notice */}
      {!canManageBilling && (
        <div
          className="rounded-xl p-4 text-center text-sm"
          style={{
            background: 'var(--pulse-surface)',
            border: '1px solid var(--pulse-border)',
            color: 'var(--pulse-ink-3)',
          }}
        >
          Contact your workspace owner to manage billing.
        </div>
      )}
    </div>
  );
};

// ── UsageMeter subcomponent ──────────────────────────────────────────

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number | null;
  formatFn?: (n: number | null) => string;
}

const UsageMeter: React.FC<UsageMeterProps> = ({ label, current, limit, formatFn }) => {
  const format = formatFn || formatNumber;
  const percentage = limit ? Math.min(100, (current / limit) * 100) : 0;
  const isNear = limit ? percentage >= 80 && percentage < 100 : false;
  const isAt = limit ? percentage >= 100 : false;
  const barColor = isAt ? '#ef4444' : isNear ? '#f59e0b' : 'var(--pulse-rose)';

  return (
    <div
      className="p-3 rounded-lg"
      style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--pulse-ink-2)' }}>
          {label}
        </span>
        <span
          className="text-xs"
          style={{ color: isAt ? '#ef4444' : 'var(--pulse-ink-3)' }}
        >
          {format(current)} / {format(limit)}
        </span>
      </div>
      {limit !== null ? (
        <>
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--pulse-border)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percentage}%`, background: barColor }}
            />
          </div>
          {isAt && (
            <div className="text-xs mt-1.5" style={{ color: '#ef4444', fontWeight: 500 }}>
              At limit — blocked until reset
            </div>
          )}
          {isNear && (
            <div className="text-xs mt-1.5" style={{ color: '#f59e0b' }}>
              {Math.round(percentage)}% used — approaching limit
            </div>
          )}
        </>
      ) : (
        <div className="text-xs" style={{ color: '#10b981' }}>
          Unlimited
        </div>
      )}
    </div>
  );
};

export default BillingSettings;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceData, useWorkspacePermissions } from '../../contexts/WorkspaceContext';
import billingService, { type Plan, type Invoice, type Subscription } from '../../services/billingService';
import { useEntitlements } from '../../hooks/useEntitlements';
import { UsageLimitWarning } from '../billing/UpgradePrompt';

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

/** Maps tier string to numeric rank for comparison */
function tierRank(tier: string): number {
  switch (tier) {
    case 'starter': return 1;
    case 'pro': return 2;
    case 'business': return 3;
    default: return 0;
  }
}

const TIER_COLORS: Record<string, { gradient: string; shadow: string; badge: string }> = {
  free: { gradient: 'linear-gradient(135deg, #6b7280, #9ca3af)', shadow: 'rgba(107,114,128,0.3)', badge: '#6b7280' },
  starter: { gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)', shadow: 'rgba(59,130,246,0.3)', badge: '#3b82f6' },
  pro: { gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)', shadow: 'rgba(244,63,94,0.3)', badge: '#f43f5e' },
  business: { gradient: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', shadow: 'rgba(124,58,237,0.3)', badge: '#7c3aed' },
  ecosystem: { gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', shadow: 'rgba(16,185,129,0.3)', badge: '#10b981' },
};

const TIER_NAMES: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Professional', business: 'Business', ecosystem: 'Ecosystem',
};

// ── Component ────────────────────────────────────────────────────────

export const BillingSettings: React.FC = () => {
  const { currentWorkspace } = useWorkspaceData();
  const { isOwner, isAdmin } = useWorkspacePermissions();
  const { entitlements, pulseTier, isTrialing, trialDaysLeft, isLoading: entLoading, error: entError } = useEntitlements();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'canceled'; text: string } | null>(null);

  const planCardsRef = useRef<HTMLDivElement>(null);
  const canManageBilling = isOwner || isAdmin;
  const workspaceId = currentWorkspace?.id;
  const currentTierRank = tierRank(pulseTier);

  // Handle ?billing=success / ?billing=canceled redirect from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingParam = params.get('billing');
    if (billingParam === 'success') {
      setCheckoutMessage({ type: 'success', text: 'Subscription updated! Changes may take a moment to reflect.' });
      params.delete('billing');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    } else if (billingParam === 'canceled') {
      setCheckoutMessage({ type: 'canceled', text: 'Checkout canceled. No changes were made.' });
      params.delete('billing');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [plansData, invoicesData, subData] = await Promise.all([
          billingService.getAvailablePlans('pulse'),
          canManageBilling ? billingService.getInvoices(workspaceId) : Promise.resolve([]),
          billingService.getSubscription(workspaceId),
        ]);
        setPlans(plansData);
        setInvoices(invoicesData);
        setSubscription(subData);
      } catch (err) {
        console.error('Failed to load billing data:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load billing information');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workspaceId, canManageBilling]);

  const handleCheckout = useCallback(async (planId: string) => {
    if (!workspaceId) return;
    setActionLoading(planId);
    try {
      const url = await billingService.createCheckout({
        workspaceId,
        planId,
        billingCycle,
      });
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [workspaceId, billingCycle]);

  const handleManageBilling = useCallback(async () => {
    if (!workspaceId) return;
    setActionLoading('portal');
    try {
      const url = await billingService.openCustomerPortal(workspaceId);
      window.location.href = url;
    } catch (err) {
      console.error('Portal failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [workspaceId]);

  const tierColors = TIER_COLORS[pulseTier] || TIER_COLORS.free;
  const pulsePlans = plans.filter(p => p.app === 'pulse');
  const bundlePlans = plans.filter(p => p.app === 'bundle');
  const displayError = loadError || entError;

  // ── Header (shared between loading and loaded states) ──

  const header = (
    <div className="section-header">
      <h3>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--set-primary)' }}>
          <path d="M4 2h16a1 1 0 0 1 1 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 0 1 1-1z"/>
          <line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/>
        </svg>
        Plan &amp; Billing
      </h3>
      <p>Manage your subscription, usage, and payment settings.</p>
    </div>
  );

  if (loading || entLoading) {
    return (
      <div className="space-y-8 animate-slide-up">
        {header}
        <div className="flex items-center justify-center py-12" style={{ color: 'var(--set-text-muted)' }}>
          Loading billing information...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-up">
      {header}

      {/* Checkout success/canceled toast */}
      {checkoutMessage && (
        <div
          className="rounded-xl p-4 flex items-center justify-between"
          style={{
            background: checkoutMessage.type === 'success' ? '#10b98110' : 'var(--set-surface)',
            border: `1px solid ${checkoutMessage.type === 'success' ? '#10b98130' : 'var(--set-border)'}`,
          }}
        >
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: checkoutMessage.type === 'success' ? '#10b981' : 'var(--set-text-muted)' }}>
              {checkoutMessage.type === 'success'
                ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                : <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}
            </svg>
            <span className="text-sm" style={{ color: checkoutMessage.type === 'success' ? '#10b981' : 'var(--set-text-secondary)' }}>
              {checkoutMessage.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutMessage(null)}
            className="text-xs"
            style={{ color: 'var(--set-text-muted)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error banner */}
      {displayError && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#ef444410', border: '1px solid #ef444430' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: '#ef4444', flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-sm" style={{ color: '#ef4444' }}>{displayError}</span>
        </div>
      )}

      {/* Current Plan Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${tierColors.badge}08, ${tierColors.badge}04)`,
        border: `1px solid ${tierColors.badge}20`,
        borderLeft: `3px solid ${tierColors.badge}`,
      }} className="rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0" style={{ background: tierColors.gradient, boxShadow: `0 4px 12px ${tierColors.shadow}` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xl font-bold dark:text-white text-zinc-900">
                Pulse {TIER_NAMES[pulseTier] || 'Free'}
              </h4>
              <span className="px-2 py-0.5 text-white text-xs font-bold rounded-full" style={{
                background: tierColors.badge,
                fontSize: '10px',
                letterSpacing: '0.06em',
              }}>
                {isTrialing ? `TRIAL - ${trialDaysLeft}d LEFT` :
                 subscription?.status === 'past_due' ? 'PAST DUE' :
                 subscription?.status === 'canceled' ? 'CANCELED' : 'ACTIVE'}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--set-text-muted)' }}>
              {subscription?.current_period_end
                ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                : 'Free tier'}
              {subscription?.cancel_at_period_end && ' (cancels at period end)'}
            </p>
          </div>
        </div>

        {/* Manage / Trial CTA buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {canManageBilling && subscription && !isTrialing && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
              style={{
                background: 'var(--set-surface)',
                border: '1px solid var(--set-border)',
                color: 'var(--set-text-main)',
              }}
            >
              {actionLoading === 'portal' ? 'Opening...' : 'Manage Subscription'}
            </button>
          )}
          {isTrialing && canManageBilling && (
            <button
              onClick={() => planCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all"
              style={{
                background: tierColors.gradient,
                boxShadow: `0 4px 12px ${tierColors.shadow}`,
              }}
            >
              Choose a Plan
            </button>
          )}
        </div>
      </div>

      {/* Usage Meters */}
      {entitlements && (
        <div className="rounded-xl p-6" style={{ background: 'var(--set-surface)', border: '1px solid var(--set-border)' }}>
          <h4 className="mb-4" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--set-text-muted)' }}>
            Current Usage
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UsageMeter label="AI Messages" current={entitlements.usage?.ai_messages || 0} limit={entitlements.max_ai_messages_mo} />
            <UsageMeter label="SMS Sent" current={entitlements.usage?.sms_sent || 0} limit={entitlements.max_sms_mo} />
            <UsageMeter label="Storage" current={entitlements.usage?.storage_bytes || 0} limit={entitlements.max_storage_bytes} formatFn={formatBytes} />
            <UsageMeter label="Voxer Minutes" current={entitlements.usage?.voxer_minutes || 0} limit={null} />
          </div>

          {/* Usage limit warnings */}
          {billingService.isAtLimit(entitlements, 'ai_messages') && entitlements.max_ai_messages_mo !== null && (
            <div className="mt-4">
              <UsageLimitWarning metric="ai_messages" current={entitlements.usage?.ai_messages || 0} limit={entitlements.max_ai_messages_mo} onUpgrade={() => planCardsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          )}
          {billingService.isNearLimit(entitlements, 'ai_messages') && !billingService.isAtLimit(entitlements, 'ai_messages') && entitlements.max_ai_messages_mo !== null && (
            <div className="mt-4">
              <UsageLimitWarning metric="ai_messages" current={entitlements.usage?.ai_messages || 0} limit={entitlements.max_ai_messages_mo} onUpgrade={() => planCardsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          )}
          {billingService.isAtLimit(entitlements, 'sms_sent') && entitlements.max_sms_mo !== null && (
            <div className="mt-4">
              <UsageLimitWarning metric="sms_sent" current={entitlements.usage?.sms_sent || 0} limit={entitlements.max_sms_mo} onUpgrade={() => planCardsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          )}
          {billingService.isAtLimit(entitlements, 'storage_bytes') && entitlements.max_storage_bytes !== null && (
            <div className="mt-4">
              <UsageLimitWarning metric="storage_bytes" current={entitlements.usage?.storage_bytes || 0} limit={entitlements.max_storage_bytes} onUpgrade={() => planCardsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          )}
        </div>
      )}

      {/* Plan Cards */}
      {canManageBilling && (
        <>
          {/* Billing cycle toggle */}
          <div className="flex items-center justify-center gap-3" ref={planCardsRef}>
            <span className="text-sm" style={{ color: billingCycle === 'monthly' ? 'var(--set-text-main)' : 'var(--set-text-muted)', fontWeight: billingCycle === 'monthly' ? 600 : 400 }}>Monthly</span>
            <button
              type="button"
              aria-label={`Switch to ${billingCycle === 'monthly' ? 'yearly' : 'monthly'} billing`}
              onClick={() => setBillingCycle(c => c === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-12 h-6 rounded-full transition-colors"
              style={{ background: billingCycle === 'yearly' ? 'var(--set-primary)' : 'var(--set-border)' }}
            >
              <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ left: billingCycle === 'yearly' ? '26px' : '2px' }} />
            </button>
            <span className="text-sm" style={{ color: billingCycle === 'yearly' ? 'var(--set-text-main)' : 'var(--set-text-muted)', fontWeight: billingCycle === 'yearly' ? 600 : 400 }}>
              Yearly <span className="text-xs" style={{ color: '#10b981' }}>(2 months free)</span>
            </span>
          </div>

          {/* Pulse Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pulsePlans.map(plan => {
              const colors = TIER_COLORS[plan.tier === 1 ? 'starter' : plan.tier === 2 ? 'pro' : 'business'];
              const isCurrentPlan = (
                (plan.tier === 1 && pulseTier === 'starter') ||
                (plan.tier === 2 && pulseTier === 'pro') ||
                (plan.tier === 3 && pulseTier === 'business')
              );

              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  colors={colors}
                  billingCycle={billingCycle}
                  isCurrentPlan={isCurrentPlan}
                  currentTierRank={currentTierRank}
                  isLoading={actionLoading === plan.id}
                  onSelect={() => handleCheckout(plan.id)}
                  onManage={handleManageBilling}
                />
              );
            })}
          </div>

          {/* Bundle Upsell */}
          {bundlePlans.length > 0 && (
            <div className="rounded-xl p-6" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(6,182,212,0.05))', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                  <h4 className="font-semibold" style={{ color: 'var(--set-text-main)' }}>Full Ecosystem Bundle</h4>
                  <p className="text-xs" style={{ color: 'var(--set-text-muted)' }}>Pulse + Logos Vision + Entomate — Save up to 18%</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {bundlePlans.map(plan => {
                  const monthlyPrices: Record<number, number> = { 1: 139, 2: 269, 3: 479 };
                  const yearlyPrices: Record<number, number> = { 1: 1390, 2: 2690, 3: 4790 };
                  const savings: Record<number, string> = { 1: '17% off individual', 2: '18% off individual', 3: '17% off individual' };
                  const monthly = monthlyPrices[plan.tier] || 0;
                  const yearly = yearlyPrices[plan.tier] || 0;
                  const price = billingCycle === 'yearly' ? Math.round(yearly / 12) : monthly;

                  return (
                    <button
                      key={plan.id}
                      onClick={() => handleCheckout(plan.id)}
                      disabled={!!actionLoading}
                      className="p-3 rounded-lg text-left transition-all hover:shadow-md"
                      style={{ background: 'var(--set-surface)', border: '1px solid var(--set-border)' }}
                    >
                      <div className="text-sm font-semibold" style={{ color: 'var(--set-text-main)' }}>{plan.name}</div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-lg font-bold" style={{ color: '#10b981' }}>${price}</span>
                        <span className="text-xs" style={{ color: 'var(--set-text-muted)' }}>/mo</span>
                        {billingCycle === 'yearly' && (
                          <span className="text-xs ml-1" style={{ color: '#10b981' }}>(${yearly.toLocaleString()}/yr)</span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#10b981' }}>
                        {savings[plan.tier]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Invoice History */}
      {canManageBilling && invoices.length > 0 && (
        <div className="rounded-xl p-6" style={{ background: 'var(--set-surface)', border: '1px solid var(--set-border)' }}>
          <h4 className="mb-4" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--set-text-muted)' }}>
            Invoice History
          </h4>
          <div className="space-y-0">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--set-border)' }}>
                <div>
                  <span className="text-sm" style={{ color: 'var(--set-text-main)' }}>
                    {inv.period_start ? new Date(inv.period_start).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--set-text-main)' }}>
                    {formatCents(inv.amount_paid || inv.amount_due)}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full" style={{
                    background: inv.status === 'paid' ? '#10b98120' : inv.status === 'open' ? '#f59e0b20' : '#ef444420',
                    color: inv.status === 'paid' ? '#10b981' : inv.status === 'open' ? '#f59e0b' : '#ef4444',
                  }}>
                    {inv.status}
                  </span>
                  {inv.invoice_pdf && (
                    <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: 'var(--set-text-muted)' }} title="Download PDF">
                      PDF
                    </a>
                  )}
                  {inv.invoice_url && (
                    <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: 'var(--set-primary)' }}>
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-admin notice */}
      {!canManageBilling && (
        <div className="rounded-xl p-4 text-center text-sm" style={{ background: 'var(--set-surface)', border: '1px solid var(--set-border)', color: 'var(--set-text-muted)' }}>
          Contact your workspace admin to manage billing.
        </div>
      )}
    </div>
  );
};

// ── Subcomponents ────────────────────────────────────────────────────

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number | null;
  formatFn?: (n: number | null) => string;
}

const UsageMeter: React.FC<UsageMeterProps> = ({ label, current, limit, formatFn }) => {
  const format = formatFn || formatNumber;
  const percentage = limit ? Math.min(100, (current / limit) * 100) : 0;
  const isNear = limit ? percentage >= 80 : false;
  const isAt = limit ? percentage >= 100 : false;
  const barColor = isAt ? '#ef4444' : isNear ? '#f59e0b' : 'var(--set-primary)';

  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--set-surface-raised)', border: '1px solid var(--set-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--set-text-secondary)' }}>{label}</span>
        <span className="text-xs" style={{ color: isAt ? '#ef4444' : 'var(--set-text-muted)' }}>
          {format(current)} / {format(limit)}
        </span>
      </div>
      {limit !== null && (
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--set-border)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, background: barColor }} />
        </div>
      )}
      {limit === null && (
        <div className="text-xs" style={{ color: '#10b981' }}>Unlimited</div>
      )}
    </div>
  );
};

// ── PlanCard ────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: Plan;
  colors: { gradient: string; shadow: string; badge: string };
  billingCycle: 'monthly' | 'yearly';
  isCurrentPlan: boolean;
  currentTierRank: number;
  isLoading: boolean;
  onSelect: () => void;
  onManage: () => void;
}

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  pulse_starter: { monthly: 79, yearly: 790 },
  pulse_pro: { monthly: 149, yearly: 1490 },
  pulse_business: { monthly: 249, yearly: 2490 },
};

const PLAN_FEATURES: Record<string, string[]> = {
  pulse_starter: ['5 users', '500 AI messages/mo', '100 SMS/mo', '5 GB storage', 'Voxer', 'Email & Calendar'],
  pulse_pro: ['15 users', '2,000 AI messages/mo', '500 SMS/mo', '25 GB storage', 'Video Vox & Pulse Radio', 'Email campaigns', 'Studio RAG', 'Advanced analytics'],
  pulse_business: ['Unlimited users', 'Unlimited AI messages', 'Unlimited SMS', 'Unlimited storage', 'Predictive analytics', 'White label', 'Priority support'],
};

const PlanCard: React.FC<PlanCardProps> = ({ plan, colors, billingCycle, isCurrentPlan, currentTierRank, isLoading, onSelect, onManage }) => {
  const pricing = PLAN_PRICES[plan.id];
  const features = PLAN_FEATURES[plan.id] || [];
  const price = pricing ? (billingCycle === 'yearly' ? Math.round(pricing.yearly / 12) : pricing.monthly) : 0;
  const isUpgrade = plan.tier > currentTierRank;
  const isDowngrade = plan.tier < currentTierRank && currentTierRank > 0;
  const isPro = plan.tier === 2;

  let buttonLabel = 'Get Started';
  let buttonAction = onSelect;
  if (isCurrentPlan) {
    buttonLabel = 'Current Plan';
  } else if (isDowngrade) {
    buttonLabel = 'Change Plan';
    buttonAction = onManage;
  } else if (isUpgrade) {
    buttonLabel = 'Upgrade';
  }

  return (
    <div
      className="rounded-2xl p-5 transition-all"
      style={{
        background: 'var(--set-surface)',
        border: isCurrentPlan ? `2px solid ${colors.badge}` : '1px solid var(--set-border)',
        position: 'relative',
      }}
    >
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-white text-xs font-bold rounded-full" style={{ background: colors.badge, fontSize: '10px' }}>
          CURRENT PLAN
        </div>
      )}
      {!isCurrentPlan && isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-white text-xs font-bold rounded-full" style={{ background: colors.badge, fontSize: '10px' }}>
          MOST POPULAR
        </div>
      )}

      <h4 className="text-base font-semibold mb-1" style={{ color: 'var(--set-text-main)' }}>{plan.name}</h4>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold" style={{ color: 'var(--set-text-main)' }}>${price}</span>
        <span className="text-sm" style={{ color: 'var(--set-text-muted)' }}>/mo</span>
        {billingCycle === 'yearly' && pricing && (
          <span className="text-xs ml-1" style={{ color: '#10b981' }}>
            (${pricing.yearly.toLocaleString()}/yr)
          </span>
        )}
      </div>

      <div className="space-y-2 mb-5">
        {features.map(feat => (
          <div key={feat} className="flex items-center gap-2 text-sm" style={{ color: 'var(--set-text-secondary)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: colors.badge, flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{feat}</span>
          </div>
        ))}
      </div>

      <button
        onClick={buttonAction}
        disabled={isCurrentPlan || isLoading}
        className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
        style={{
          background: isCurrentPlan ? 'var(--set-border)' : isDowngrade ? 'transparent' : colors.gradient,
          boxShadow: isCurrentPlan || isDowngrade ? 'none' : `0 4px 12px ${colors.shadow}`,
          color: isCurrentPlan ? 'var(--set-text-muted)' : isDowngrade ? 'var(--set-text-secondary)' : 'white',
          border: isDowngrade ? '1px solid var(--set-border)' : 'none',
        }}
      >
        {isLoading ? 'Loading...' : buttonLabel}
      </button>
    </div>
  );
};

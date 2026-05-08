import React, { useState, useCallback } from 'react';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import billingService from '../../services/billingService';

interface UpgradePromptProps {
  /** The feature that triggered the prompt */
  feature: string;
  /** Display title */
  title?: string;
  /** Description of what upgrading unlocks */
  description?: string;
  /** Minimum plan required: 'starter' | 'pro' | 'business' */
  requiredPlan?: 'starter' | 'pro' | 'business';
  /** Called when user dismisses the prompt */
  onDismiss?: () => void;
  /** Inline (banner) or modal style */
  variant?: 'inline' | 'modal';
}

const PLAN_IDS: Record<string, string> = {
  starter: 'pulse_starter',
  pro: 'pulse_pro',
  business: 'pulse_business',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Professional',
  business: 'Business',
};

const PLAN_COLORS: Record<string, { gradient: string; shadow: string }> = {
  starter: { gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)', shadow: 'rgba(59,130,246,0.3)' },
  pro: { gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)', shadow: 'rgba(244,63,94,0.3)' },
  business: { gradient: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', shadow: 'rgba(124,58,237,0.3)' },
};

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  title,
  description,
  requiredPlan = 'pro',
  onDismiss,
  variant = 'inline',
}) => {
  const { currentWorkspace } = useWorkspaceData();
  const [loading, setLoading] = useState(false);

  const colors = PLAN_COLORS[requiredPlan] || PLAN_COLORS.pro;

  const handleUpgrade = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const url = await billingService.createCheckout({
        workspaceId: currentWorkspace.id,
        planId: PLAN_IDS[requiredPlan],
        billingCycle: 'monthly',
      });
      window.location.href = url;
    } catch (err) {
      console.error('Upgrade checkout failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, requiredPlan]);

  const handleViewPlans = useCallback(() => {
    window.location.href = '/settings?tab=billing';
  }, []);

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--pulse-surface)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: colors.gradient }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--pulse-ink)' }}>
                {title || `Upgrade to ${PLAN_LABELS[requiredPlan]}`}
              </h3>
            </div>
          </div>

          <p className="text-sm mb-6" style={{ color: 'var(--pulse-ink-2)', lineHeight: 1.6 }}>
            {description || `This feature requires the ${PLAN_LABELS[requiredPlan]} plan. Upgrade to unlock ${feature} and more.`}
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleViewPlans}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-all"
              style={{ background: colors.gradient, boxShadow: `0 4px 12px ${colors.shadow}` }}
            >
              View Plans
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all"
                style={{ background: 'var(--pulse-surface-raised)', border: '1px solid var(--pulse-border)', color: 'var(--pulse-ink-2)' }}
              >
                Maybe Later
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Inline banner variant
  return (
    <div className="rounded-xl p-4 flex items-center gap-4" style={{
      background: 'var(--pulse-surface)',
      border: '1px solid var(--pulse-border)',
    }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: colors.gradient }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--pulse-ink)' }}>
          {title || `Upgrade to ${PLAN_LABELS[requiredPlan]}`}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--pulse-ink-3)' }}>
          {description || `Unlock ${feature} with the ${PLAN_LABELS[requiredPlan]} plan.`}
        </p>
      </div>
      <button
        type="button"
        onClick={handleViewPlans}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg flex-shrink-0 transition-all"
        style={{ background: colors.gradient }}
      >
        {loading ? '...' : 'Upgrade'}
      </button>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs flex-shrink-0"
          style={{ color: 'var(--pulse-ink-3)' }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

// ── Usage Limit Warning ──────────────────────────────────────────────

interface UsageLimitWarningProps {
  metric: string;
  current: number;
  limit: number;
  onUpgrade?: () => void;
}

export const UsageLimitWarning: React.FC<UsageLimitWarningProps> = ({ metric, current, limit, onUpgrade }) => {
  const percentage = Math.round((current / limit) * 100);
  const isOver = percentage >= 100;

  const metricLabels: Record<string, string> = {
    ai_messages: 'AI messages',
    sms_sent: 'SMS messages',
    storage_bytes: 'storage',
    voxer_minutes: 'Relay minutes',
    workflow_runs: 'workflow runs',
  };

  return (
    <div className="rounded-lg p-3 text-sm" style={{
      background: isOver ? '#ef444410' : '#f59e0b10',
      border: `1px solid ${isOver ? '#ef444430' : '#f59e0b30'}`,
    }}>
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: isOver ? '#ef4444' : '#f59e0b' }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span style={{ color: isOver ? '#ef4444' : '#f59e0b', fontWeight: 500 }}>
          {isOver
            ? `You've reached your ${metricLabels[metric] || metric} limit`
            : `${percentage}% of your ${metricLabels[metric] || metric} used`}
        </span>
      </div>
      {onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-2 text-xs font-medium"
          style={{ color: 'var(--pulse-rose)' }}
        >
          Upgrade for more →
        </button>
      )}
    </div>
  );
};

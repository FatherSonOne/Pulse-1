// UsageWarningBanner.tsx — Proactive "you're close to your cap" banner.
//
// Reads the workspace's current entitlements and renders a dismissible banner
// when ANY metered resource (AI messages, SMS, storage, Relay minutes) has
// crossed the 80% usage threshold. The goal is to warn users BEFORE they hit
// the hard cap (which triggers the far noisier AICapExceededError toast from
// useAIErrorHandler).
//
// Placement: mount inside Dashboard and BillingSettings so the banner follows
// the user into the two places they're most likely to see it.
//
// Dismissal: stored in sessionStorage per-workspace + per-metric, so the
// banner stays hidden for the rest of the session but comes back on reload
// (the situation hasn't changed — they still need to see it eventually).
//
// The copy for `ai_messages` intentionally echoes the cap-exceeded toast
// ("Upgrade to avoid interruption") so the user sees consistent language
// across the warning → hard-cap transition.

import React, { useMemo, useState, useCallback } from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import { AppView } from '../../types';

type MeteredMetric = 'ai_messages' | 'sms' | 'storage' | 'voxer_minutes';

interface MetricConfig {
  key: MeteredMetric;
  label: string;
  unit: string;
  usageField: string;
  limitField: keyof import('../../services/billingService').Entitlements;
  formatter?: (value: number) => string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'ai_messages',
    label: 'AI messages',
    unit: 'messages',
    usageField: 'ai_messages',
    limitField: 'max_ai_messages_mo',
  },
  {
    key: 'sms',
    label: 'SMS',
    unit: 'messages',
    usageField: 'sms',
    limitField: 'max_sms_mo',
  },
  {
    key: 'voxer_minutes',
    label: 'Relay minutes',
    unit: 'min',
    usageField: 'voxer_minutes',
    limitField: 'max_voxer_minutes_mo',
  },
  {
    key: 'storage',
    label: 'storage',
    unit: 'GB',
    usageField: 'storage_bytes',
    limitField: 'max_storage_bytes',
    formatter: (bytes) => `${(bytes / (1024 ** 3)).toFixed(1)} GB`,
  },
];

interface UsageWarningBannerProps {
  /** Where the "Upgrade" CTA should take the user. Defaults to Settings → Billing. */
  onUpgrade?: () => void;
  /** Optional className for outer container */
  className?: string;
}

export const UsageWarningBanner: React.FC<UsageWarningBannerProps> = ({
  onUpgrade,
  className = '',
}) => {
  const { entitlements, isNearLimit, isLoading } = useEntitlements();
  const { currentWorkspace } = useWorkspaceData();
  const [dismissedKey, setDismissedKey] = useState<string | null>(() => {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(`usage-banner-dismissed:${currentWorkspace?.id ?? ''}`);
  });

  // Pick the first metric that's >= 80% and not dismissed. We only surface one
  // banner at a time; if the user dismisses AI-messages and they're also near
  // the SMS cap, the SMS banner will appear on next render.
  const triggered = useMemo(() => {
    if (isLoading || !entitlements) return null;
    for (const m of METRICS) {
      if (!isNearLimit(m.key)) continue;
      const dismissKey = `${m.key}:${currentWorkspace?.id ?? ''}`;
      if (dismissedKey === dismissKey) continue;
      const usage = entitlements.usage?.[m.usageField] ?? 0;
      const limit = entitlements[m.limitField] as number | null;
      if (limit == null || limit === 0) continue;
      const pct = Math.round((usage / limit) * 100);
      return { metric: m, usage, limit, pct, dismissKey };
    }
    return null;
  }, [entitlements, isNearLimit, isLoading, currentWorkspace?.id, dismissedKey]);

  const handleUpgrade = useCallback(() => {
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    // Fallback: navigate via the global pulse:navigate event → Settings → Plan & Billing
    window.dispatchEvent(
      new CustomEvent('pulse:navigate', {
        detail: { view: AppView.SETTINGS, section: 'billing' },
      }),
    );
  }, [onUpgrade]);

  const handleDismiss = useCallback(() => {
    if (!triggered) return;
    try {
      sessionStorage.setItem(
        `usage-banner-dismissed:${currentWorkspace?.id ?? ''}`,
        triggered.dismissKey,
      );
    } catch {
      /* sessionStorage unavailable — still hide in-memory */
    }
    setDismissedKey(triggered.dismissKey);
  }, [triggered, currentWorkspace?.id]);

  if (!triggered) return null;

  const { metric, usage, limit, pct } = triggered;
  const usageStr = metric.formatter ? metric.formatter(usage) : usage.toLocaleString();
  const limitStr = metric.formatter ? metric.formatter(limit) : limit.toLocaleString();

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-rose-500/10 text-amber-100 ${className}`}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
        <AlertTriangle size={16} className="text-amber-400" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-amber-100">
          You've used {usageStr}/{limitStr} {metric.label} this month ({pct}%).
        </div>
        <div className="text-xs text-amber-200/70 mt-0.5">
          Upgrade to avoid interruption when you hit the cap.
        </div>
      </div>
      <button
        type="button"
        onClick={handleUpgrade}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-semibold transition-colors"
      >
        Upgrade
        <ArrowRight size={12} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className="flex-shrink-0 w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-amber-200/60 hover:text-amber-100 transition-colors"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

export default UsageWarningBanner;

// useEntitlements.ts — React hook for feature gating and usage limits
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkspaceData } from '../contexts/WorkspaceContext';
import billingService, { type Entitlements } from '../services/billingService';

interface UseEntitlementsReturn {
  entitlements: Entitlements | null;
  isLoading: boolean;
  error: string | null;
  /** Check if a feature flag is enabled */
  canUse: (feature: string) => boolean;
  /** Check if usage has hit the plan limit */
  isAtLimit: (metric: string) => boolean;
  /** Check if usage is at 80%+ of the plan limit */
  isNearLimit: (metric: string) => boolean;
  /** Current Pulse tier: 'team' | 'free' (= no active subscription/trial) */
  pulseTier: string;
  /** Whether the workspace is on a trial */
  isTrialing: boolean;
  /** Days left in trial (0 if not trialing) */
  trialDaysLeft: number;
  /** Whether the workspace has an active Pulse subscription (trialing or paid). False = show TrialExpiredBlock. */
  hasActivePulseAccess: boolean;
  /** Refresh entitlements from the database */
  refresh: () => Promise<void>;
}

export function useEntitlements(): UseEntitlementsReturn {
  const { currentWorkspace } = useWorkspaceData();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = currentWorkspace?.id;

  const fetchEntitlements = useCallback(async () => {
    if (!workspaceId) {
      setEntitlements(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await billingService.getEntitlements(workspaceId);
      setEntitlements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entitlements');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  const canUse = useCallback((feature: string): boolean => {
    if (!entitlements) return false;
    return billingService.canUseFeature(entitlements, feature);
  }, [entitlements]);

  const isAtLimit = useCallback((metric: string): boolean => {
    if (!entitlements) return false;
    return billingService.isAtLimit(entitlements, metric);
  }, [entitlements]);

  const isNearLimit = useCallback((metric: string): boolean => {
    if (!entitlements) return false;
    return billingService.isNearLimit(entitlements, metric);
  }, [entitlements]);

  const pulseTier = useMemo(() => {
    return (entitlements?.apps?.pulse as string) || 'free';
  }, [entitlements]);

  const hasActivePulseAccess = useMemo(() => {
    if (!entitlements) return false;
    return billingService.hasActivePulseAccess(entitlements);
  }, [entitlements]);

  const isTrialing = entitlements?.is_trialing || false;

  const trialDaysLeft = useMemo(() => {
    if (!entitlements?.trial_ends_at) return 0;
    const diff = new Date(entitlements.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [entitlements]);

  return {
    entitlements,
    isLoading,
    error,
    canUse,
    isAtLimit,
    isNearLimit,
    pulseTier,
    isTrialing,
    trialDaysLeft,
    hasActivePulseAccess,
    refresh: fetchEntitlements,
  };
}

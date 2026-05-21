/**
 * useSummitEntitlement — single source of truth for "can this user start a
 * Summit session, and if so, what are the caps?" Computed from:
 *
 *   1. Their BYO OpenAI key (if any) → BYO mode, no cap
 *   2. Their workspace entitlements (tier + trial state + plan caps)
 *   3. Their current-period summit_minutes usage
 *
 * BYO always wins — if a user has pasted a personal OpenAI key, Summit
 * runs against it and we don't gate. Otherwise the hosted-minutes gate
 * applies. Trial users override plan caps to 15 min/month + 5-min sessions.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntitlements } from './useEntitlements';
import { getByoKeyStatus } from '../services/byoKeyService';

const TRIAL_MINUTES_PER_MONTH = 15;
const TRIAL_SESSION_SEC = 300;
const BYO_SESSION_SEC = 1800;

export type SummitDenyReason =
  | 'wrong_tier'
  | 'over_cap'
  | 'trial_cap'
  | 'no_subscription';

export interface SummitEntitlement {
  hasAccess: boolean;
  /** Set when hasAccess === false. */
  reason?: SummitDenyReason;
  /** Total monthly allowance. 0 = no Summit access on this plan. */
  capMinutes: number;
  /** Minutes already consumed in the current calendar month. */
  usedMinutes: number;
  /** capMinutes - usedMinutes, never negative. Infinity for BYO mode. */
  remainingMinutes: number;
  /** Hard ceiling for a single session, in seconds. */
  sessionMaxSec: number;
  /** True when the user has a personal OpenAI key on file. */
  isByoMode: boolean;
  /** Echoes useEntitlements.isTrialing for convenience. */
  isTrialing: boolean;
  /** Echoes useEntitlements.pulseTier ('team' | 'growth' | 'free' | ...). */
  pulseTier: string;
  isLoading: boolean;
  /** Re-runs the BYO + entitlements lookups (e.g. after a Settings change). */
  refresh: () => Promise<void>;
}

export function useSummitEntitlement(): SummitEntitlement {
  const {
    entitlements,
    isLoading: entLoading,
    pulseTier,
    isTrialing,
    refresh: refreshEntitlements,
  } = useEntitlements();
  const [isByoMode, setIsByoMode] = useState<boolean>(false);
  const [byoLoading, setByoLoading] = useState<boolean>(true);

  const loadByo = useCallback(async () => {
    setByoLoading(true);
    try {
      const status = await getByoKeyStatus();
      setIsByoMode(status.hasKey && status.lastOk !== false);
    } finally {
      setByoLoading(false);
    }
  }, []);

  useEffect(() => {
    loadByo();
  }, [loadByo]);

  const refresh = useCallback(async () => {
    await Promise.all([loadByo(), refreshEntitlements()]);
  }, [loadByo, refreshEntitlements]);

  return useMemo<SummitEntitlement>(() => {
    const isLoading = entLoading || byoLoading;

    if (isByoMode) {
      return {
        hasAccess: true,
        capMinutes: 0,
        usedMinutes: 0,
        remainingMinutes: Number.POSITIVE_INFINITY,
        sessionMaxSec: BYO_SESSION_SEC,
        isByoMode: true,
        isTrialing,
        pulseTier,
        isLoading,
        refresh,
      };
    }

    const usedMinutes = Number(entitlements?.usage?.summit_minutes ?? 0);

    let capMinutes: number;
    let sessionMaxSec: number;
    if (isTrialing) {
      capMinutes = TRIAL_MINUTES_PER_MONTH;
      sessionMaxSec = TRIAL_SESSION_SEC;
    } else {
      capMinutes = entitlements?.max_summit_minutes_mo ?? 0;
      sessionMaxSec = entitlements?.max_summit_session_sec ?? 0;
    }

    const remainingMinutes = Math.max(0, capMinutes - usedMinutes);

    // Reason resolution — checked in the same order as the edge function.
    let reason: SummitDenyReason | undefined;
    if (pulseTier === 'free' && !isTrialing) {
      reason = 'no_subscription';
    } else if (capMinutes <= 0) {
      reason = 'wrong_tier';
    } else if (remainingMinutes <= 0) {
      reason = isTrialing ? 'trial_cap' : 'over_cap';
    }

    return {
      hasAccess: !reason,
      reason,
      capMinutes,
      usedMinutes,
      remainingMinutes,
      sessionMaxSec,
      isByoMode: false,
      isTrialing,
      pulseTier,
      isLoading,
      refresh,
    };
  }, [
    entLoading,
    byoLoading,
    isByoMode,
    isTrialing,
    pulseTier,
    entitlements,
    refresh,
  ]);
}

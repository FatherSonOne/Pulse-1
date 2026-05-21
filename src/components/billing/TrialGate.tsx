// TrialGate — renders TrialExpiredBlock over the app when the workspace has no
// active Pulse subscription (trial expired or never started).
//
// Mounted inside WorkspaceProvider so useEntitlements has a workspace to query.
// Does NOT block the entire app tree — renders the paywall as an overlay so the
// app can keep background state fresh. App interaction is blocked by the backdrop.

import React, { useState, useEffect } from 'react';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useWorkspaceData } from '../../contexts/WorkspaceContext';
import { TrialExpiredBlock } from './TrialExpiredBlock';
import { isJustPaidGraceActive } from '../../lib/monitoring/onboardingEvents';

const DEV_BYPASS_KEY = 'pulse_dev_bypass_paywall';

interface TrialGateProps {
  children: React.ReactNode;
}

export const TrialGate: React.FC<TrialGateProps> = ({ children }) => {
  const { entitlements, hasActivePulseAccess, isLoading, refresh } = useEntitlements();
  const { currentWorkspace } = useWorkspaceData();

  // Post-Stripe webhook race: Checkout redirects ~1s before the billing-webhook
  // finishes writing the entitlements row. Without a grace window the user sees
  // TrialExpiredBlock flash for the duration. The grace flag is set by the
  // BillingSettings ?billing=success effect (see onboardingEvents.markJustPaidGrace).
  // While the flag is live we suppress the paywall AND background-poll
  // entitlements every 1.5s so the real state takes over the moment it's ready.
  const [graceActive, setGraceActive] = useState<boolean>(() => isJustPaidGraceActive());

  useEffect(() => {
    if (!graceActive) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      if (cancelled) return;
      refresh().catch(() => {});
      if (!isJustPaidGraceActive()) {
        setGraceActive(false);
        window.clearInterval(interval);
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [graceActive, refresh]);

  // Drop the grace flag the moment we see real Pulse access — no need to keep
  // polling once entitlements are populated.
  useEffect(() => {
    if (graceActive && hasActivePulseAccess) {
      try { sessionStorage.removeItem('pulse_just_paid_grace'); } catch { /* ignore */ }
      setGraceActive(false);
    }
  }, [graceActive, hasActivePulseAccess]);

  // Dev-only escape hatch — lets the engineer log in as other accounts on
  // localhost without having to manually flip entitlements in the DB.
  // Persisted in sessionStorage so it resets when the tab closes; only honored
  // when running under Vite dev (import.meta.env.DEV).
  const [devBypassed, setDevBypassed] = useState<boolean>(() => {
    if (!import.meta.env.DEV) return false;
    try { return sessionStorage.getItem(DEV_BYPASS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+P toggles bypass for the current tab session
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setDevBypassed(prev => {
          const next = !prev;
          try {
            if (next) sessionStorage.setItem(DEV_BYPASS_KEY, '1');
            else sessionStorage.removeItem(DEV_BYPASS_KEY);
          } catch { /* ignore */ }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleDevDismiss = () => {
    try { sessionStorage.setItem(DEV_BYPASS_KEY, '1'); } catch { /* ignore */ }
    setDevBypassed(true);
  };

  // While entitlements are loading, render children — block appears once we know.
  // If no workspace yet, WorkspaceGate handles that state.
  const showPaywall =
    !isLoading &&
    !!entitlements &&
    !hasActivePulseAccess &&
    !!currentWorkspace &&
    !devBypassed &&
    !graceActive;

  return (
    <>
      {children}
      {showPaywall && (
        <TrialExpiredBlock
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          canManageBilling={true}
          onDevDismiss={import.meta.env.DEV ? handleDevDismiss : undefined}
        />
      )}
    </>
  );
};

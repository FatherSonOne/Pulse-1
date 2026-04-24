// useAIErrorHandler.tsx — Global UI treatment for AI router errors.
//
// The ai-router throws typed errors (AICapExceededError, AITrialExpiredError,
// AIProviderUnavailableError) that propagate out of every invokeAI() call site.
// Without this hook those errors hit `catch(err)` blocks in ~20 services and
// silently log to the console — the user sees only a generic "failed" message.
//
// Usage in a component:
//   const handleAIError = useAIErrorHandler();
//   try { await someAIService(...) }
//   catch (err) {
//     if (handleAIError(err)) return; // handled — already showed toast / paywall
//     // fall through to existing generic handling
//   }
//
// Design choices:
// - AICapExceededError → sticky toast with "Upgrade" CTA that dispatches
//   `pulse:navigate` to Settings → Plan & Billing. Sticky because users often
//   miss transient toasts and the error blocks every AI feature until reset.
// - AITrialExpiredError → no-op. TrialGate already renders a full-screen
//   paywall globally; another toast would be noisy.
// - AIProviderUnavailableError → short transient toast. Usually self-heals
//   within a minute when the fallback provider recovers.
//
// Returns `true` when the error was handled so callers can short-circuit
// their generic error branch.
//
// Requires <Toaster /> from react-hot-toast mounted at app root (see App.tsx).
//
// ── Hook contract ───────────────────────────────────────────────────────
//   const handleAIError = useAIErrorHandler();
//   handleAIError(err: unknown): boolean   // true = handled, false = not our error

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  AICapExceededError,
  AITrialExpiredError,
  AIProviderUnavailableError,
} from '../services/ai/errors';
import { AppView } from '../types';

// Single toast id per error class — prevents duplicate toasts when a user
// clicks "generate" three times in a row.
const CAP_TOAST_ID = 'ai-cap-exceeded';
const PROVIDER_TOAST_ID = 'ai-provider-unavailable';

function formatResetDate(resetAt: string): string {
  if (!resetAt) return 'soon';
  const d = new Date(resetAt);
  if (Number.isNaN(d.getTime())) return 'soon';
  // Short, friendly format: "Mon, Nov 1" — drop year for brevity.
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Navigate to Settings → Plan & Billing via the global pulse:navigate event. */
function openBillingSettings(): void {
  window.dispatchEvent(
    new CustomEvent('pulse:navigate', {
      detail: { view: AppView.SETTINGS, section: 'billing' },
    }),
  );
}

export type AIErrorHandler = (err: unknown) => boolean;

export function useAIErrorHandler(): AIErrorHandler {
  return useCallback((err: unknown): boolean => {
    // AICapExceededError → sticky toast + Upgrade CTA
    if (err instanceof AICapExceededError) {
      const resetLabel = formatResetDate(err.resetAt);
      toast.custom(
        (t) => (
          <div
            role="alert"
            className={`${t.visible ? 'animate-enter' : 'animate-leave'} ai-cap-toast`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              maxWidth: 420,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #1a0b1f, #2a0b2f)',
              border: '1px solid rgba(217, 70, 239, 0.35)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              color: '#fff',
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                AI limit reached
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                {err.usage.toLocaleString()}/{err.limit.toLocaleString()} messages · resets {resetLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                openBillingSettings();
                toast.dismiss(t.id);
              }}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #d946ef, #ec4899)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 12,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Upgrade
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => toast.dismiss(t.id)}
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'transparent',
                color: 'rgba(255,255,255,0.55)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ),
        { id: CAP_TOAST_ID, duration: Infinity, position: 'top-center' },
      );
      return true;
    }

    // AITrialExpiredError → silent. TrialGate already shows the paywall.
    if (err instanceof AITrialExpiredError) {
      return true;
    }

    // AIProviderUnavailableError → short transient toast.
    if (err instanceof AIProviderUnavailableError) {
      toast.error('AI temporarily unavailable, try again in a minute.', {
        id: PROVIDER_TOAST_ID,
        duration: 5000,
      });
      return true;
    }

    return false;
  }, []);
}

export default useAIErrorHandler;

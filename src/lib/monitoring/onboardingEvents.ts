// onboardingEvents.ts
//
// Typed activation funnel for the post-Stripe onboarding flow. Names match the
// contract in docs/onboarding-redesign.md §11 and are the single source of truth
// for PostHog dashboards. Both the legacy modal/checklist surfaces and the new
// post-Stripe surface call through here; the moment-of-truth funnel is
// `surface_shown -> first_message_sent`.
//
// Idempotency: callers pass `workspace_id` so PostHog dedupes per workspace.
// Helpers are no-ops when PostHog isn't initialised (see analytics.ts).

import { trackEvent } from './analytics';

export const OnboardingEvent = {
  /** Pre-Stripe plan picker: org name + team size submitted */
  PlanPickerNamed: 'onboarding.plan_picker_named',
  /** Stripe Checkout success redirect fires */
  CheckoutCompleted: 'onboarding.checkout_completed',
  /** Post-Stripe surface mounts (or legacy modal becomes visible) */
  SurfaceShown: 'onboarding.surface_shown',
  /** Owner submits the legacy "Name your organization" modal */
  Named: 'onboarding.named',
  /** Legacy checklist (or new Polish accordion) first becomes visible */
  ChecklistOpened: 'onboarding.checklist_opened',
  /** Founder welcome voice note play event (new surface) */
  FounderNotePlayed: 'onboarding.founder_note_played',
  /** Primary activation: first Relay message sent post-Stripe */
  FirstMessageSent: 'onboarding.first_message_sent',
  /** Secondary activation: first capture made */
  FirstCaptureMade: 'onboarding.first_capture_made',
  /** Network activation: at least one teammate invited */
  TeammateInvited: 'onboarding.teammate_invited',
  /** Polish accordion expanded (new surface) */
  PolishOpened: 'onboarding.polish_opened',
  /** Single Polish/checklist item clicked. payload: { item_id } */
  ChoreClicked: 'onboarding.chore_clicked',
  /** Single Polish/checklist item completed. payload: { item_id } */
  PolishItemCompleted: 'onboarding.polish_item_completed',
  /** Surface or checklist dismissed without completing every item */
  Dismissed: 'onboarding.dismissed',
} as const;

export type OnboardingEventName = (typeof OnboardingEvent)[keyof typeof OnboardingEvent];

type BaseProps = {
  workspace_id?: string;
  role?: 'owner' | 'admin' | 'member';
};

export function trackOnboarding(
  event: OnboardingEventName,
  properties: BaseProps & Record<string, unknown> = {},
): void {
  trackEvent(event, properties);
}

/** Sets `pulse_just_paid_grace` so TrialGate skips the paywall for `ttlMs`. */
export function markJustPaidGrace(ttlMs: number = 30_000): void {
  try {
    sessionStorage.setItem('pulse_just_paid_grace', String(Date.now() + ttlMs));
  } catch {
    /* sessionStorage unavailable (private mode, SSR) — fail silently */
  }
}

/** Returns true while the grace window is still open. */
export function isJustPaidGraceActive(): boolean {
  try {
    const raw = sessionStorage.getItem('pulse_just_paid_grace');
    if (!raw) return false;
    const until = Number.parseInt(raw, 10);
    if (Number.isNaN(until)) return false;
    if (Date.now() < until) return true;
    sessionStorage.removeItem('pulse_just_paid_grace');
    return false;
  } catch {
    return false;
  }
}

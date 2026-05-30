// inviteTeammateNavigation — single source of truth for routing an
// activation/onboarding CTA to the invite surface (Settings → Team → invite).
//
// Reuse-only: it composes the exact mechanisms already wired across the app —
//   1. `?settings=team&focus=invite` URL params (read on mount by Settings.tsx
//      `?settings=` deep-link and TeamSettings.tsx `?focus=invite` scroll/
//      highlight at :51-70 — same params OrgSetupChecklist writes).
//   2. `pulse:navigate` ({ view: SETTINGS, section: 'team' }) — App.tsx:734
//      mount-independent navigation; sets the settings section AND switches
//      view from anywhere (Dashboard, Relay, Decisions) without prop threading.
//   3. `pulse:settings-navigate` ({ section, focus }) — Settings.tsx:132
//      belt-and-suspenders for when Settings is already mounted.
//
// Fires `OnboardingEvent.ChoreClicked` so the funnel sees the activation move
// (the real `TeammateInvited` event already fires inside inviteService.ts —
// this only records the nudge/empty-state click that routed there).
//
// Deterministic activation chrome — NOT AI. No coral, no AIProvenanceChip.

import { AppView } from '../types';
import { trackOnboarding, OnboardingEvent } from '../lib/monitoring/onboardingEvents';

interface NavigateToInviteOptions {
  /** Workspace id for funnel attribution (optional — funnel dedupes per ws). */
  workspaceId?: string | null;
  /** Where the click came from, e.g. 'relay-empty', 'decisions-caughtup',
   *  'nudge'. Recorded on the ChoreClicked event for surface attribution. */
  source: string;
}

export function navigateToTeamInvite({ workspaceId, source }: NavigateToInviteOptions): void {
  trackOnboarding(OnboardingEvent.ChoreClicked, {
    workspace_id: workspaceId ?? undefined,
    item_id: 'team',
    source,
  });

  // Write the deep-link params the destination sections read on mount.
  try {
    const params = new URLSearchParams(window.location.search);
    params.set('settings', 'team');
    params.set('focus', 'invite');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  } catch {
    /* history unavailable (SSR / sandbox) — navigation events still fire */
  }

  // Mount-independent navigation: switch view + select the Team section.
  window.dispatchEvent(
    new CustomEvent('pulse:navigate', { detail: { view: AppView.SETTINGS, section: 'team' } }),
  );
  // If Settings is already mounted, also nudge it to the section + focus.
  window.dispatchEvent(
    new CustomEvent('pulse:settings-navigate', { detail: { section: 'team', focus: 'invite' } }),
  );
}

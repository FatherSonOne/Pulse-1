// ============================================
// Side-effecting channel handlers for the hybrid Contacts ChannelRow (Phase 1).
//
// Email reuses the EXISTING compose bridge verbatim (handoff §4.4): the same
// sessionStorage key + window event App.handleComposeEmail uses (src/App.tsx),
// plus the global `pulse:navigate` bus the shell already dispatches for Map.
// No new infrastructure — this is a new caller of an existing path.
// ============================================

import { Contact, AppView } from '../../../../types';

/**
 * Open the email composer pre-addressed to a contact. Mirrors
 * App.handleComposeEmail but seeds the recipient:
 *   1. stash the intent so the Email surface picks it up on (re)mount,
 *   2. fire the live event so an already-mounted composer opens immediately,
 *   3. navigate to the Email view via the global navigate bus.
 * Callers must gate on emailEnabled — channelsFor already hides Email when off.
 */
export function composeEmail(contact: Contact): void {
  const payload = { recipient: contact.email, subject: '', body: '' };
  try {
    sessionStorage.setItem('pulse_pending_compose', JSON.stringify(payload));
  } catch {
    /* private-mode / quota: the live event below still opens the composer */
  }
  window.dispatchEvent(new CustomEvent('pulse:compose-email', { detail: payload }));
  window.dispatchEvent(new CustomEvent('pulse:navigate', { detail: { view: AppView.EMAIL } }));
}

/**
 * Invoke the device dialer (D5). No-op on desktop web (risk #10); the number
 * stays copyable in the contact detail. Strips formatting to a dialable string.
 */
export function callContact(contact: Contact): void {
  if (!contact.phone) return;
  const dialable = contact.phone.replace(/[^\d+]/g, '');
  if (!dialable) return;
  window.location.href = `tel:${dialable}`;
}

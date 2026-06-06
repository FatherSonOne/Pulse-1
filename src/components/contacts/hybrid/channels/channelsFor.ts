// ============================================
// channelsFor — pure channel resolution for the hybrid Contacts redesign.
// Path D · Phase 1. The single source of INVARIANT 1 (handoff §2):
//
//   "Reach must match identity."
//     Pulse user (contact.pulseUserId set) → Message / Vox / Meet (native).
//     External                             → Email / Slack(if linked) / Call / Note.
//
// Intentionally presentation-free (no React, no icon components) so the
// branching is trivially unit-testable. ChannelRow maps `kind` → icon + handler.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md §4.4 + §10 (D5/D6).
// ============================================

import { Contact } from '../../../../types';

export type ChannelKind =
  // Pulse-native (contact is also a Pulse user)
  | 'message'
  | 'vox'
  | 'meet'
  // External reach
  | 'email'
  | 'slack'
  | 'call'
  | 'note';

export type ChannelTone = 'pulse' | 'email' | 'slack' | 'call' | 'note';

export interface ChannelDescriptor {
  kind: ChannelKind;
  label: string;
  tone: ChannelTone;
  /** When true the button renders inert (greyed, fires no handler). */
  disabled?: boolean;
  /** Tooltip explaining why a channel is inert (no phone, Slack not yet wired, …). */
  disabledReason?: string;
}

export interface ChannelsForOptions {
  /**
   * D6: the Email surface is itself flag-gated. When email is OFF we HIDE the
   * Email channel rather than offer a dead button.
   */
  emailEnabled: boolean;
  /**
   * Phase 8: a resolved Slack identity exists for this contact. Until Phase 8
   * ships the `slack_user_id` column + resolver this is always false in real
   * data, so Slack simply doesn't appear. Tests/preview may pass true to
   * exercise the disabled "Link Slack" affordance.
   */
  slackLinked?: boolean;
  /**
   * Phase 8 flips this true once `slackService.sendMessage` is wired. Until then
   * a shown Slack channel is rendered disabled.
   */
  slackSendEnabled?: boolean;
}

export function channelsFor(contact: Contact, opts: ChannelsForOptions): ChannelDescriptor[] {
  // Pulse user → native trio. pulseUserId is the identity gate (handoff §2.1).
  // Email/phone are irrelevant here; the contact is reachable on Pulse surfaces.
  if (contact.pulseUserId) {
    return [
      { kind: 'message', label: 'Message', tone: 'pulse' },
      { kind: 'vox', label: 'Vox', tone: 'pulse' },
      { kind: 'meet', label: 'Meet', tone: 'pulse' },
    ];
  }

  const channels: ChannelDescriptor[] = [];

  // Email — the core fix. Every external contact carries a required email, yet
  // you couldn't email them from this surface. Gated on emailEnabled (D6).
  if (opts.emailEnabled) {
    channels.push({ kind: 'email', label: 'Email', tone: 'email' });
  }

  // Slack — only when an identity is linked (Phase 8). Disabled until send wired.
  if (opts.slackLinked) {
    channels.push({
      kind: 'slack',
      label: 'Slack',
      tone: 'slack',
      disabled: !opts.slackSendEnabled,
      disabledReason: opts.slackSendEnabled ? undefined : 'Slack send arrives in a later phase',
    });
  }

  // Call — tel: device dialer (D5). Inert without a number (risk #10: also a
  // desktop-web no-op; the number stays copyable in the contact detail).
  channels.push({
    kind: 'call',
    label: 'Call',
    tone: 'call',
    disabled: !contact.phone,
    disabledReason: contact.phone ? undefined : 'No phone number on file',
  });

  // Note — quick log appended to the contact's notes field.
  channels.push({ kind: 'note', label: 'Note', tone: 'note' });

  return channels;
}

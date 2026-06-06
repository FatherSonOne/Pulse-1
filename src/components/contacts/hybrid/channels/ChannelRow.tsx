// ============================================
// ChannelRow — the shared adaptive action row (handoff INVARIANT 1).
// One primitive used in the detail, the list (compact), and the co-pilot rail.
// Neutral chrome; coral only on hover (CLAUDE.md §4 — coral is AI-only at REST,
// hover state is allowed). Channel set comes from the pure channelsFor().
// ============================================

import React from 'react';
import { Mail, Phone, StickyNote, MessageCircle, Mic, Video, Hash } from 'lucide-react';
import { Contact } from '../../../../types';
import { channelsFor, ChannelDescriptor, ChannelKind } from './channelsFor';
import { composeEmail, callContact } from './actions';

const ICONS: Record<ChannelKind, React.ComponentType<{ className?: string }>> = {
  message: MessageCircle,
  vox: Mic,
  meet: Video,
  email: Mail,
  slack: Hash, // lucide brand icons are version-unstable; Hash reads as a channel
  call: Phone,
  note: StickyNote,
};

export interface ChannelRowProps {
  contact: Contact;
  /** D6: hides the Email channel when the Email feature is off. */
  emailEnabled: boolean;
  /** Native Pulse surfaces (message → Messages, vox → Relay, meet → Meetings). */
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  /** Quick-log handler. Until wired (FocusColumn, Phase 3) the Note button is inert. */
  onNote?: (contact: Contact) => void;
  /** Phase 8: a resolved Slack identity exists. */
  slackLinked?: boolean;
  /** Phase 8: Slack send is wired. Until then a shown Slack button is disabled. */
  slackSendEnabled?: boolean;
  /** Horizontal pill layout (list rows / rail) vs. the default vertical grid. */
  compact?: boolean;
  className?: string;
}

export const ChannelRow: React.FC<ChannelRowProps> = ({
  contact,
  emailEnabled,
  onAction,
  onNote,
  slackLinked,
  slackSendEnabled,
  compact = false,
  className = '',
}) => {
  const channels = channelsFor(contact, { emailEnabled, slackLinked, slackSendEnabled });

  const run = (ch: ChannelDescriptor) => {
    switch (ch.kind) {
      case 'message':
      case 'vox':
      case 'meet':
        onAction(ch.kind, contact.id);
        break;
      case 'email':
        composeEmail(contact);
        break;
      case 'call':
        callContact(contact);
        break;
      case 'note':
        onNote?.(contact);
        break;
      case 'slack':
        // disabled until Phase 8 wires send — no handler
        break;
    }
  };

  return (
    <div
      className={(compact ? 'flex flex-wrap gap-1.5' : 'grid gap-2') + (className ? ` ${className}` : '')}
      style={compact ? undefined : { gridTemplateColumns: `repeat(${channels.length}, minmax(0, 1fr))` }}
    >
      {channels.map((ch) => {
        const Icon = ICONS[ch.kind];
        // Note stays inert until a quick-log handler is wired (Phase 3).
        const noteInert = ch.kind === 'note' && !onNote;
        const inert = !!ch.disabled || noteInert;
        // A disabled Slack button advertises the next step ("Link Slack"); a
        // missing note handler explains itself; otherwise fall back to the label.
        const label = ch.kind === 'slack' && ch.disabled ? 'Link Slack' : ch.label;
        const reason =
          ch.disabledReason || (noteInert ? 'Open the contact to add a note' : undefined);

        const layout = compact
          ? 'flex flex-row items-center gap-[7px] px-[11px] py-[7px] rounded-[9px]'
          : 'flex flex-col items-center gap-1.5 px-1.5 py-2.5 rounded-xl';
        const interactive = inert
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:-translate-y-px hover:text-[var(--pulse-coral-fg)] hover:border-[var(--pulse-rose-soft)] hover:bg-[var(--pulse-rose-soft)]';

        return (
          <button
            key={ch.kind}
            type="button"
            disabled={inert}
            onClick={() => !inert && run(ch)}
            title={reason || label}
            aria-label={inert && reason ? `${label} — ${reason}` : label}
            className={`${layout} border transition-all duration-150 bg-[var(--pulse-surface-raised)] border-[var(--pulse-border)] text-[var(--pulse-ink-2)] ${interactive}`}
          >
            <Icon className="w-[18px] h-[18px]" />
            <span
              className="text-[10px] font-medium uppercase tracking-[0.08em] whitespace-nowrap"
              style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ChannelRow;

// ============================================
// CONTACTS HYBRID — PEOPLE (3-pane orchestrator)
// Path D redesign. Replaces the ContactsRedesigned body when the
// `contactsHybrid` feature flag is ON (gated in ContactsShell.tsx).
//
// Phase 1 — the full 3-column shell (Browse / Focus / Co-pilot) lands in
// Phases 2–4. This interim view hosts a LIVE preview of the Phase 1 deliverable:
// the adaptive ChannelRow, rendered against real contacts so the
// reach-matches-identity branches are eyeball-verifiable under the flag. The
// preview is replaced wholesale by FocusColumn in Phase 3.
//
// Props mirror ContactsRedesignedProps verbatim so ContactsShell can swap one
// for the other without changing the call site.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md.
// ============================================

import React from 'react';
import { Contact } from '../../../types';
import { useFeatures } from '../../../contexts/FeatureContext';
import { ChannelRow } from './channels/ChannelRow';

interface ContactsHybridPeopleProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onSyncComplete?: (newContacts: Contact[]) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  onDeleteContact?: (contactId: string) => Promise<boolean>;
  openAddContact?: boolean;
}

const PreviewCard: React.FC<{
  title: string;
  caption: string;
  contact?: Contact;
  children?: React.ReactNode;
  emptyHint: string;
}> = ({ title, caption, contact, children, emptyHint }) => (
  <div
    className="rounded-2xl border p-4"
    style={{ background: 'var(--pulse-surface)', borderColor: 'var(--pulse-border)' }}
  >
    <div className="flex items-baseline justify-between mb-1">
      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</span>
      <span
        className="text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500"
        style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
      >
        {caption}
      </span>
    </div>
    {contact ? (
      <>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          {contact.name}
          {contact.role ? ` · ${contact.role}` : ''}
        </p>
        {children}
      </>
    ) : (
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{emptyHint}</p>
    )}
  </div>
);

export const ContactsHybridPeople: React.FC<ContactsHybridPeopleProps> = ({
  contacts,
  onAction,
  onUpdateContact,
}) => {
  const { features } = useFeatures();

  const pulseSample = contacts.find((c) => c.pulseUserId);
  const externalSample = contacts.find((c) => !c.pulseUserId && c.email);

  // Phase 1 quick-log: append a timestamped note via the existing update path.
  // The real inline-note editor is owned by FocusColumn (Phase 3).
  const handleNote = (c: Contact) => {
    if (!onUpdateContact) return;
    const stamp = new Date().toLocaleString();
    onUpdateContact({
      ...c,
      notes: `${c.notes ? `${c.notes}\n` : ''}[${stamp}] Quick note (Phase 1 preview)`,
    });
  };

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--pulse-canvas)' }}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div
          className="inline-flex items-center gap-2 px-2.5 py-1 mb-4 rounded-full border border-rose-300/40 dark:border-rose-400/30 text-rose-500 dark:text-rose-300 text-[10px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
        >
          Contacts Hybrid · Beta
        </div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Hybrid People view — Phase 1
        </h2>
        <p className="mt-2 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          The adaptive channel row is live below. Pulse users reach native surfaces; everyone else
          reaches Email / Call / Note. The 3-pane layout (Browse · Focus · Co-pilot) arrives in the
          next phases. <span className="text-zinc-400 dark:text-zinc-500">({contacts.length} contacts loaded.)</span>
        </p>

        <div className="mt-8 space-y-4">
          <PreviewCard
            title="Pulse user"
            caption="native → message / vox / meet"
            contact={pulseSample}
            emptyHint="No Pulse-user contact in this list yet — link a contact to a Pulse account to see the native trio."
          >
            {pulseSample && (
              <ChannelRow
                contact={pulseSample}
                emailEnabled={features.emailEnabled}
                onAction={onAction}
                onNote={handleNote}
              />
            )}
          </PreviewCard>

          <PreviewCard
            title="External contact"
            caption="email / call / note"
            contact={externalSample}
            emptyHint="No external contact found."
          >
            {externalSample && (
              <ChannelRow
                contact={externalSample}
                emailEnabled={features.emailEnabled}
                onAction={onAction}
                onNote={handleNote}
              />
            )}
          </PreviewCard>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed pt-1">
            Email is hidden when the Email feature is off (Settings → Features &amp; Labs). A
            disabled “Link Slack” button appears once a Slack identity is linked (Phase 8). Call is
            disabled when a contact has no phone number.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactsHybridPeople;

// ============================================
// CONTACTS HYBRID — PEOPLE (3-pane orchestrator)
// Path D redesign. Replaces the ContactsRedesigned body when the
// `contactsHybrid` feature flag is ON (gated in ContactsShell.tsx).
//
// Phase 0 — Scaffold only. This is an intentional placeholder so the flag
// has a real consumer and toggles cleanly between the legacy People view and
// the hybrid shell with no errors. The 3 columns (Browse / Focus / Co-pilot)
// land in Phases 2–4; the adaptive ChannelRow lands in Phase 1.
//
// Props mirror ContactsRedesignedProps verbatim so ContactsShell can swap one
// for the other without changing the call site.
// See docs/CONTACTS_REDESIGN_HANDOFF_2026-06-05.md.
// ============================================

import React from 'react';
import { Contact } from '../../../types';

interface ContactsHybridPeopleProps {
  contacts: Contact[];
  onAction: (action: 'message' | 'vox' | 'meet', contactId: string) => void;
  onSyncComplete?: (newContacts: Contact[]) => void;
  onUpdateContact?: (updatedContact: Contact) => void;
  onAddContact?: (contact: Omit<Contact, 'id'>) => Promise<Contact | null>;
  onDeleteContact?: (contactId: string) => Promise<boolean>;
  openAddContact?: boolean;
}

export const ContactsHybridPeople: React.FC<ContactsHybridPeopleProps> = ({
  contacts,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center h-full w-full text-center px-6"
      style={{ background: 'var(--pulse-canvas)' }}
    >
      <div
        className="inline-flex items-center gap-2 px-2.5 py-1 mb-4 rounded-full border border-rose-300/40 dark:border-rose-400/30 text-rose-500 dark:text-rose-300 text-[10px] uppercase tracking-[0.12em]"
        style={{ fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace" }}
      >
        Contacts Hybrid · Beta
      </div>
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
        Hybrid People view — scaffold
      </h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        The 3-pane redesign (Browse · Focus · Co-pilot) is being built behind the
        <span className="mx-1 font-mono text-xs text-zinc-600 dark:text-zinc-300">contactsHybrid</span>
        flag. Columns and the adaptive channel row arrive in the next phases.
      </p>
      <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
        {contacts.length} contact{contacts.length === 1 ? '' : 's'} ready to wire in.
      </p>
    </div>
  );
};

export default ContactsHybridPeople;

// ============================================
// ContactListItem — compact row for the narrow Browse column (Col 1).
// New presentation for the 3-pane layout (the legacy grid card / wide list row
// don't fit a ~330px column). Click selects the contact into the Focus pane.
// ============================================

import React from 'react';
import { Contact } from '../../../../types';

interface ContactListItemProps {
  contact: Contact;
  selected: boolean;
  onSelect: () => void;
}

export const ContactListItem: React.FC<ContactListItemProps> = ({ contact, selected, onSelect }) => {
  const secondary = contact.role || contact.company || contact.email;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border transition-colors ${
        selected
          ? 'bg-[var(--pulse-rose-soft)] border-[var(--pulse-rose-soft)]'
          : 'border-transparent hover:bg-[var(--pulse-surface-raised)]'
      }`}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
        style={{ backgroundColor: contact.avatarColor || '#6366f1' }}
      >
        {contact.name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {contact.name}
          </span>
          {contact.pulseUserId && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--pulse-rose)]"
              title="On Pulse"
              aria-label="On Pulse"
            />
          )}
        </span>
        {secondary && (
          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{secondary}</span>
        )}
      </span>
    </button>
  );
};

export default ContactListItem;

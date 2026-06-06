// ============================================
// ContactListItem — compact row for the narrow Browse column (Col 1).
// New presentation for the 3-pane layout. Click selects the contact into the
// Focus pane; the bulk checkbox (shown on hover or when any selection is
// active) toggles multi-select for the BulkActionToolbar (Phase 7).
// ============================================

import React from 'react';
import { Check } from 'lucide-react';
import { Contact } from '../../../../types';

interface ContactListItemProps {
  contact: Contact;
  selected: boolean;
  checked: boolean;
  /** True when any bulk selection is active → keep checkboxes visible. */
  selectionActive: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
}

export const ContactListItem: React.FC<ContactListItemProps> = ({
  contact,
  selected,
  checked,
  selectionActive,
  onSelect,
  onToggleCheck,
}) => {
  const secondary = contact.role || contact.company || contact.email;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-current={selected}
      className={`group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border transition-colors cursor-pointer ${
        selected
          ? 'bg-[var(--pulse-rose-soft)] border-[var(--pulse-rose-soft)]'
          : 'border-transparent hover:bg-[var(--pulse-surface-raised)]'
      }`}
    >
      {/* Bulk-select checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? `Deselect ${contact.name}` : `Select ${contact.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCheck();
        }}
        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-opacity ${
          checked || selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
        }`}
        style={{
          borderColor: checked ? 'var(--pulse-rose)' : 'var(--pulse-border-strong)',
          background: checked ? 'var(--pulse-rose)' : 'transparent',
        }}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </button>

      {contact.avatarUrl ? (
        <img
          src={contact.avatarUrl}
          alt={contact.name}
          className="w-9 h-9 rounded-full object-cover shrink-0"
        />
      ) : (
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
          style={{ backgroundColor: contact.avatarColor || '#6366f1' }}
        >
          {contact.name.charAt(0).toUpperCase()}
        </span>
      )}
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
    </div>
  );
};

export default ContactListItem;

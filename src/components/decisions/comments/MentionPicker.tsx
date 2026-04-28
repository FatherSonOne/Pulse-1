// MentionPicker: small popover that surfaces workspace members when the
// composer detects an `@` followed by query text. The picker writes the
// chosen member's id into the textarea using the `@<uuid>` syntax that
// decisionCommentsService.extractMentions parses.

import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '../../../types';

interface MentionPickerProps {
  /** Anchor coordinates relative to the composer textarea (top, left). */
  anchor: { top: number; left: number } | null;
  /** Current query string (the text after the `@`). */
  query: string;
  members: User[];
  onPick: (member: User) => void;
  onClose: () => void;
}

function memberDisplay(m: User): string {
  return (m as User & { full_name?: string }).full_name || m.email || '';
}

export const MentionPicker: React.FC<MentionPickerProps> = ({
  anchor,
  query,
  members,
  onPick,
  onClose,
}) => {
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return members
      .filter((m) => memberDisplay(m).toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Keyboard navigation while the picker is open.
  useEffect(() => {
    if (!anchor) return;
    const handleKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onPick(filtered[highlight]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [anchor, filtered, highlight, onPick, onClose]);

  if (!anchor || filtered.length === 0) return null;

  return (
    <div
      className="dc-mention-picker"
      style={{ top: anchor.top, left: anchor.left }}
      role="listbox"
      aria-label="Mention a workspace member"
    >
      {filtered.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={i === highlight}
          className={`dc-mention-option${i === highlight ? ' is-active' : ''}`}
          onClick={() => onPick(m)}
          onMouseEnter={() => setHighlight(i)}
        >
          {memberDisplay(m)}
        </button>
      ))}
    </div>
  );
};

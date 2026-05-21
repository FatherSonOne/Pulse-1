// ============================================================
// AssigneePicker — popover replacement for the native <select>
// in TaskEditModal. Matches the PlacePicker grammar (mono-uppercase
// chip trigger, coral focus, paper-pure popover with search +
// scrollable list). Native <select> renders as OS chrome on Chrome
// Windows; banned by DESIGN.md "shadcn-as-shipped" rule.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, User as UserIcon, X } from 'lucide-react';
import { User } from '../../types';

interface AssigneePickerProps {
  value: string;
  members: User[];
  onChange: (id: string) => void;
  placeholder?: string;
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function colorFromId(id: string): string {
  // Deterministic hue from id — same id always gets the same color.
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 50%)`;
}

const AssigneePicker: React.FC<AssigneePickerProps> = ({
  value,
  members,
  onChange,
  placeholder = 'Unassigned',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const selected = members.find(m => m.id === value) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onClick);
    };
  }, [isOpen]);

  const filtered = query.trim()
    ? members.filter(m =>
        ((m.name ?? '') + ' ' + (m.email ?? ''))
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : members;

  const handlePick = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="assignee-picker">
      <button
        type="button"
        className="assignee-picker-trigger"
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selected ? (
          <span className="assignee-picker-pill">
            <span
              className="assignee-picker-avatar"
              style={{ backgroundColor: colorFromId(selected.id) }}
              aria-hidden
            >
              {initials(selected.name || selected.email || '?')}
            </span>
            <span className="assignee-picker-name">{selected.name || selected.email}</span>
          </span>
        ) : (
          <span className="assignee-picker-placeholder">
            <UserIcon size={14} aria-hidden />
            {placeholder}
          </span>
        )}
        <ChevronDown size={14} className="assignee-picker-chevron" aria-hidden />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="assignee-picker-popover"
          role="dialog"
          aria-label="Pick assignee"
        >
          <div className="assignee-picker-search">
            <Search size={13} aria-hidden />
            <input
              type="text"
              placeholder="Search teammates..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              aria-label="Search teammates"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="assignee-picker-clear"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="assignee-picker-list" role="listbox">
            <button
              type="button"
              role="option"
              aria-selected={value === ''}
              className={`assignee-picker-row${value === '' ? ' is-selected' : ''}`}
              onClick={() => handlePick('')}
            >
              <span className="assignee-picker-row-avatar assignee-picker-row-avatar--empty" aria-hidden>
                <UserIcon size={14} />
              </span>
              <span className="assignee-picker-row-name">Unassigned</span>
              {value === '' && <Check size={14} className="assignee-picker-row-check" aria-hidden />}
            </button>

            {filtered.length === 0 ? (
              <p className="assignee-picker-empty">No teammates match.</p>
            ) : (
              filtered.map(m => {
                const isSelected = m.id === value;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`assignee-picker-row${isSelected ? ' is-selected' : ''}`}
                    onClick={() => handlePick(m.id)}
                  >
                    <span
                      className="assignee-picker-row-avatar"
                      style={{ backgroundColor: colorFromId(m.id) }}
                      aria-hidden
                    >
                      {initials(m.name || m.email || '?')}
                    </span>
                    <span className="assignee-picker-row-text">
                      <span className="assignee-picker-row-name">{m.name || m.email}</span>
                      {m.name && m.email && (
                        <span className="assignee-picker-row-email">{m.email}</span>
                      )}
                    </span>
                    {isSelected && <Check size={14} className="assignee-picker-row-check" aria-hidden />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssigneePicker;

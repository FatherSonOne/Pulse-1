// MemberPicker: multi-select workspace member dropdown.
// Reuses the workspace_members data already loaded by DecisionTaskHub.

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { User } from '../../../../types';

interface MemberPickerProps {
  label: string;
  value: string[]; // member ids
  onChange: (next: string[]) => void;
  members: User[];
  required?: boolean;
  error?: string;
  hint?: string;
  multiSelect?: boolean;
  /** Min selections required when multiSelect is true. */
  minItems?: number;
  /** Render a placeholder when nothing is selected. */
  placeholder?: string;
  id?: string;
}

function memberDisplayName(m: User): string {
  return (m as User & { full_name?: string }).full_name || m.email || '';
}

export const MemberPicker: React.FC<MemberPickerProps> = ({
  label,
  value,
  onChange,
  members,
  required,
  error,
  hint,
  multiSelect = true,
  placeholder = 'Add members',
  id,
}) => {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const selectedMembers = members.filter((m) => value.includes(m.id));
  const filtered = members.filter(
    (m) =>
      !value.includes(m.id) &&
      memberDisplayName(m).toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (memberId: string) => {
    if (value.includes(memberId)) {
      onChange(value.filter((id) => id !== memberId));
    } else if (multiSelect) {
      onChange([...value, memberId]);
    } else {
      onChange([memberId]);
      setOpen(false);
    }
    setSearch('');
  };

  const remove = (memberId: string) => {
    onChange(value.filter((id) => id !== memberId));
  };

  return (
    <div className="dw-field">
      <label htmlFor={fieldId} className="dw-field-label dt-label">
        {label}
        {required && <span className="dw-field-required" aria-label="required">*</span>}
      </label>
      <div ref={containerRef} className="dw-memberpicker">
        <button
          id={fieldId}
          type="button"
          className={`dw-memberpicker-trigger${error ? ' has-error' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {selectedMembers.length === 0 ? (
            <span className="dw-memberpicker-placeholder">{placeholder}</span>
          ) : (
            <div className="dw-memberpicker-chips">
              {selectedMembers.map((m) => (
                <span key={m.id} className="dw-chip">
                  {memberDisplayName(m)}
                  <button
                    type="button"
                    className="dw-chip-remove"
                    onClick={(e) => { e.stopPropagation(); remove(m.id); }}
                    aria-label={`Remove ${memberDisplayName(m)}`}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <ChevronDown size={14} className="dw-memberpicker-chevron" aria-hidden="true" />
        </button>
        {open && (
          <>
            <div
              className="dw-memberpicker-backdrop"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="dw-memberpicker-popover" role="listbox">
              <input
                type="text"
                className="dw-memberpicker-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members"
                autoFocus
                aria-label="Search members"
              />
              <div className="dw-memberpicker-options">
                {filtered.length === 0 && search && (
                  <p className="dw-memberpicker-empty">No matches.</p>
                )}
                {filtered.length === 0 && !search && selectedMembers.length === members.length && (
                  <p className="dw-memberpicker-empty">All members selected.</p>
                )}
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="dw-memberpicker-option"
                    onClick={() => toggle(m.id)}
                  >
                    {memberDisplayName(m)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {hint && !error && <p className="dw-field-hint">{hint}</p>}
      {error && <p className="dw-field-error" role="alert">{error}</p>}
    </div>
  );
};

// SelectField: Pulse-styled dropdown. Replaces native <select> chrome.
// Same popover pattern as the bulk-toolbar Status dropdown shipped in step 7.

import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectFieldOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T | null;
  onChange: (next: T) => void;
  options: SelectFieldOption<T>[];
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  id?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  required,
  error,
  hint,
  placeholder = 'Pick one',
  id,
}: SelectFieldProps<T>) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="dw-field">
      <label htmlFor={fieldId} className="dw-field-label dt-label">
        {label}
        {required && <span className="dw-field-required" aria-label="required">*</span>}
      </label>
      <div className="dw-select">
        <button
          id={fieldId}
          type="button"
          className={`dw-select-trigger${error ? ' has-error' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={selected ? '' : 'dw-select-placeholder'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {open && (
          <>
            <div
              className="dw-select-backdrop"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="dw-select-popover" role="listbox">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  className={`dw-select-option${value === opt.value ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {hint && !error && <p className="dw-field-hint">{hint}</p>}
      {error && <p className="dw-field-error" role="alert">{error}</p>}
    </div>
  );
}

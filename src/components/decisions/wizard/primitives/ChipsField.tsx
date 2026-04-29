// ChipsField: freeform tag input. Enter or comma adds a chip.

import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

interface ChipsFieldProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  minItems?: number;
  maxItems?: number;
  hint?: string;
  id?: string;
}

export const ChipsField: React.FC<ChipsFieldProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Type and press Enter',
  required,
  error,
  maxItems,
  hint,
  id,
}) => {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addChip = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    if (maxItems !== undefined && value.length >= maxItems) return;
    onChange([...value, trimmed]);
    setDraft('');
  };

  const removeChip = (chip: string) => {
    onChange(value.filter((c) => c !== chip));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      removeChip(value[value.length - 1]);
    }
  };

  return (
    <div className="dw-field">
      <label htmlFor={fieldId} className="dw-field-label dt-label">
        {label}
        {required && <span className="dw-field-required" aria-label="required">*</span>}
      </label>
      <div
        className={`dw-chips-container${error ? ' has-error' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((chip) => (
          <span key={chip} className="dw-chip">
            {chip}
            <button
              type="button"
              className="dw-chip-remove"
              onClick={(e) => { e.stopPropagation(); removeChip(chip); }}
              aria-label={`Remove ${chip}`}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          className="dw-chips-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && addChip(draft)}
          placeholder={value.length === 0 ? placeholder : ''}
          aria-invalid={Boolean(error)}
        />
      </div>
      {hint && !error && (
        <p className="dw-field-hint">{hint}</p>
      )}
      {error && (
        <p className="dw-field-error" role="alert">{error}</p>
      )}
    </div>
  );
};

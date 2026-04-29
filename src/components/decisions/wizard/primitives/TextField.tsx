// TextField: single-line text input.
// Pulse-styled (no native chrome), mono uppercase label, error state, --dt-* tokens.

import React from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  autoFocus?: boolean;
  maxLength?: number;
  hint?: string;
  id?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  autoFocus,
  maxLength,
  hint,
  id,
}) => {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="dw-field">
      <label htmlFor={fieldId} className="dw-field-label dt-label">
        {label}
        {required && <span className="dw-field-required" aria-label="required">*</span>}
      </label>
      <input
        id={fieldId}
        type="text"
        className={`dw-input${error ? ' has-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
      />
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="dw-field-hint">{hint}</p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="dw-field-error" role="alert">{error}</p>
      )}
    </div>
  );
};

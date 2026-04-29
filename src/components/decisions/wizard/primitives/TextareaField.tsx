// TextareaField: multi-line text input.

import React from 'react';

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  rows?: number;
  hint?: string;
  id?: string;
  autoFocus?: boolean;
}

export const TextareaField: React.FC<TextareaFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  rows = 3,
  hint,
  id,
  autoFocus,
}) => {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="dw-field">
      <label htmlFor={fieldId} className="dw-field-label dt-label">
        {label}
        {required && <span className="dw-field-required" aria-label="required">*</span>}
      </label>
      <textarea
        id={fieldId}
        className={`dw-textarea${error ? ' has-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
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

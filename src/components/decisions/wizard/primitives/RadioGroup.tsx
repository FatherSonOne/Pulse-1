// RadioGroup: segmented control for picking one of N options.

import React from 'react';

interface RadioGroupProps<T extends string> {
  label: string;
  value: T | null;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  required?: boolean;
  error?: string;
  hint?: string;
}

export function RadioGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  required,
  error,
  hint,
}: RadioGroupProps<T>) {
  return (
    <div className="dw-field" role="radiogroup" aria-labelledby={`${label}-radiogroup-label`}>
      <span id={`${label}-radiogroup-label`} className="dw-field-label dt-label">
        {label}
        {required && <span className="dw-field-required" aria-label="required">*</span>}
      </span>
      <div className={`dw-radiogroup${error ? ' has-error' : ''}`}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            className={`dw-radio-option${value === opt.value ? ' is-selected' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hint && !error && <p className="dw-field-hint">{hint}</p>}
      {error && <p className="dw-field-error" role="alert">{error}</p>}
    </div>
  );
}

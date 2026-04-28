// CurrencyField: number input with a leading currency symbol.

import React from 'react';

interface CurrencyFieldProps {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  symbol?: string;
  suffix?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  id?: string;
}

export const CurrencyField: React.FC<CurrencyFieldProps> = ({
  label,
  value,
  onChange,
  symbol = '$',
  suffix,
  required,
  error,
  hint,
  placeholder = '0',
  id,
}) => {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="dw-field">
      <label htmlFor={fieldId} className="dw-field-label dt-label">
        {label}
        {required && <span className="dw-field-required" aria-label="required">*</span>}
      </label>
      <div className={`dw-currency-wrap${error ? ' has-error' : ''}`}>
        <span className="dw-currency-symbol" aria-hidden="true">{symbol}</span>
        <input
          id={fieldId}
          type="number"
          inputMode="numeric"
          className="dw-currency-input"
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(null);
            } else {
              const num = Number(raw);
              if (!Number.isNaN(num)) onChange(num);
            }
          }}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
        />
        {suffix && <span className="dw-currency-suffix dt-label">{suffix}</span>}
      </div>
      {hint && !error && <p className="dw-field-hint">{hint}</p>}
      {error && <p className="dw-field-error" role="alert">{error}</p>}
    </div>
  );
};

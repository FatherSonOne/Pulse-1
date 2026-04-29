// DatePicker: Pulse-styled date input with a small popover calendar.
//
// Replaces native <input type="date"> chrome. The popover is intentionally
// minimal: a month grid, prev/next buttons, today highlight, mono labels.
// For v1 of the wizard this is sufficient; richer date affordances (range,
// time-of-day) are out of scope.

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DatePickerProps {
  label: string;
  /** ISO date string (YYYY-MM-DD) or null. */
  value: string | null;
  onChange: (next: string | null) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Optional default offset from today when first opened (e.g. 14 days). */
  defaultOffsetDays?: number;
  id?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplay(iso: string | null): string {
  if (!iso) return 'Pick a date';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function getMonthGrid(year: number, monthIndex: number): Array<Date | null> {
  const first = new Date(year, monthIndex, 1);
  const startDay = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIndex, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  required,
  error,
  hint,
  id,
}) => {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Initialize the calendar at the value's month (or today's month).
  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const cells = getMonthGrid(viewYear, viewMonth);
  const today = todayIso();

  const pick = (d: Date) => {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  };

  return (
    <div className="dw-field">
      <label htmlFor={fieldId} className="dw-field-label dt-label">
        {label}
        {required && <span className="dw-field-required" aria-label="required">*</span>}
      </label>
      <div className="dw-datepicker">
        <button
          id={fieldId}
          type="button"
          className={`dw-datepicker-trigger${error ? ' has-error' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Calendar size={14} aria-hidden="true" />
          <span>{formatDisplay(value)}</span>
        </button>
        {open && (
          <>
            <div
              className="dw-datepicker-backdrop"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={popoverRef}
              className="dw-datepicker-popover"
              role="dialog"
              aria-label={`Pick date for ${label}`}
            >
              <div className="dw-datepicker-header">
                <button
                  type="button"
                  className="dw-datepicker-nav"
                  onClick={() => {
                    if (viewMonth === 0) {
                      setViewMonth(11);
                      setViewYear((y) => y - 1);
                    } else {
                      setViewMonth((m) => m - 1);
                    }
                  }}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <span className="dw-datepicker-title dt-label">
                  {MONTHS[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  className="dw-datepicker-nav"
                  onClick={() => {
                    if (viewMonth === 11) {
                      setViewMonth(0);
                      setViewYear((y) => y + 1);
                    } else {
                      setViewMonth((m) => m + 1);
                    }
                  }}
                  aria-label="Next month"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              <div className="dw-datepicker-weekdays">
                {DAYS.map((d) => (
                  <span key={d} className="dw-datepicker-weekday dt-label">{d}</span>
                ))}
              </div>
              <div className="dw-datepicker-grid">
                {cells.map((d, i) => {
                  if (!d) return <span key={i} className="dw-datepicker-cell-empty" />;
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const isToday = iso === today;
                  const isSelected = iso === value;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`dw-datepicker-cell${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                      onClick={() => pick(d)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
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

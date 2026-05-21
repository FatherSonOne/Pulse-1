// ============================================================
// DueDatePicker — popover replacement for native <input type="date">
// in TaskEditModal. Native date input renders as OS chrome
// (Material/shadcn-as-shipped reflex banned by DESIGN.md). This
// custom popover gives quick options (Today / Tomorrow / Next week)
// and a mini calendar grid spanning two months ahead.
//
// Value contract: ISO date string `YYYY-MM-DD` (matches the
// existing `deadline` state shape in TaskEditModal). Empty string
// means no due date set.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DueDatePickerProps {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  placeholder?: string;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromIsoDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(n => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDisplay(s: string): string {
  const d = fromIsoDate(s);
  if (!d) return '';
  const now = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays <= 6) {
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

interface MonthGridProps {
  year: number;
  month: number; // 0-indexed
  selected: Date | null;
  today: Date;
  onPick: (date: Date) => void;
}

const MonthGrid: React.FC<MonthGridProps> = ({ year, month, selected, today, onPick }) => {
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: Array<Date | null> = [];
    for (let i = 0; i < startWeekday; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(year, month, d));
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year, month]);

  return (
    <div className="due-date-month">
      <div className="due-date-month-header">
        {MONTH_LABELS[month]} {year}
      </div>
      <div className="due-date-weekdays" aria-hidden>
        {WEEKDAY_LABELS.map((d, i) => (
          <span key={i} className="due-date-weekday">{d}</span>
        ))}
      </div>
      <div className="due-date-grid" role="grid">
        {cells.map((cell, i) => {
          if (!cell) return <span key={i} className="due-date-cell due-date-cell--empty" />;
          const isToday = isSameDay(cell, today);
          const isSelected = selected && isSameDay(cell, selected);
          const isPast = cell < startOfDay(today);
          return (
            <button
              key={i}
              type="button"
              className={`due-date-cell${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}`}
              onClick={() => onPick(cell)}
              aria-pressed={!!isSelected}
              aria-label={cell.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const DueDatePicker: React.FC<DueDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'No due date',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = fromIsoDate(value);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = selected ?? today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

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

  const pick = (d: Date) => {
    onChange(toIsoDate(d));
    setIsOpen(false);
  };

  const clear = () => {
    onChange('');
    setIsOpen(false);
  };

  const quickPick = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    pick(d);
  };

  const stepMonth = (delta: number) => {
    setViewMonth(prev => {
      const m = prev.month + delta;
      if (m < 0)  return { year: prev.year - 1, month: 11 };
      if (m > 11) return { year: prev.year + 1, month: 0  };
      return { year: prev.year, month: m };
    });
  };

  return (
    <div className="due-date-picker">
      <button
        type="button"
        className={`due-date-trigger${value ? ' has-value' : ''}`}
        onClick={() => setIsOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="due-date-trigger-icon" aria-hidden>
          <CalendarIcon size={14} />
        </span>
        <span className={`due-date-trigger-text${value ? '' : ' is-placeholder'}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            className="due-date-trigger-clear"
            onClick={e => { e.stopPropagation(); clear(); }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }
            }}
            aria-label="Clear due date"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={14} className="due-date-trigger-chevron" aria-hidden />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="due-date-popover"
          role="dialog"
          aria-label="Pick due date"
        >
          <div className="due-date-quick">
            <button type="button" className="due-date-quick-btn" onClick={() => quickPick(0)}>Today</button>
            <button type="button" className="due-date-quick-btn" onClick={() => quickPick(1)}>Tomorrow</button>
            <button type="button" className="due-date-quick-btn" onClick={() => quickPick(7)}>Next week</button>
            {value && (
              <button type="button" className="due-date-quick-btn due-date-quick-btn--clear" onClick={clear}>Clear</button>
            )}
          </div>

          <div className="due-date-nav">
            <button
              type="button"
              className="due-date-nav-btn"
              onClick={() => stepMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className="due-date-nav-label"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {MONTH_LABELS[viewMonth.month].slice(0, 3).toUpperCase()} {viewMonth.year}
            </span>
            <button
              type="button"
              className="due-date-nav-btn"
              onClick={() => stepMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <MonthGrid
            year={viewMonth.year}
            month={viewMonth.month}
            selected={selected}
            today={today}
            onPick={pick}
          />
        </div>
      )}
    </div>
  );
};

export default DueDatePicker;

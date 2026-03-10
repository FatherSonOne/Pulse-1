import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface JumpToDateProps {
  isOpen: boolean;
  currentDate: Date;
  onClose: () => void;
  /** Called when user confirms a date. Parent sets currentDate + viewMode. */
  onJump: (date: Date) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS_MINI = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// ─── Mini calendar ────────────────────────────────────────────────────────────

const MiniCalendar: React.FC<{
  viewDate: Date;           // which month is displayed
  selected: Date | null;
  today: Date;
  onSelectDay: (d: Date) => void;
}> = ({ viewDate, selected, today, onSelectDay }) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none">
      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1" role="row" aria-hidden="true">
        {WEEKDAYS_MINI.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-bold text-zinc-400 dark:text-zinc-500 py-1"
          >
            {d}
          </div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5" role="grid">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={i} role="gridcell" aria-hidden="true" />;
          }
          const isToday = isSameDay(date, today);
          const isSelected = selected && isSameDay(date, selected);
          const isOtherMonth = date.getMonth() !== month;

          return (
            <button
              key={i}
              role="gridcell"
              aria-label={`${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}${isToday ? ', today' : ''}`}
              aria-pressed={isSelected ?? false}
              aria-current={isToday ? 'date' : undefined}
              className={`
                w-7 h-7 mx-auto flex items-center justify-center
                text-xs font-medium rounded-full transition-colors
                ${isSelected
                  ? 'bg-red-600 text-white font-bold'
                  : isToday
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold'
                    : isOtherMonth
                      ? 'text-zinc-300 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }
              `}
              onClick={() => onSelectDay(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const JumpToDate: React.FC<JumpToDateProps> = ({ isOpen, currentDate, onClose, onJump }) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState<Date>(() => startOfMonth(currentDate));
  const [selected, setSelected] = useState<Date | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setViewDate(startOfMonth(currentDate));
      setSelected(null);
      setTimeout(() => panelRef.current?.focus(), 30);
    }
  }, [isOpen, currentDate]);

  const prevMonth = useCallback(() => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);
  const nextMonth = useCallback(() => {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);

  const handleSelectDay = useCallback((date: Date) => {
    setSelected(date);
    // Immediately jump on click (no separate confirm button needed)
    onJump(date);
    onClose();
  }, [onJump, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }, [onClose]);

  const handleBackdropKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleBackdropKeyDown);
    return () => window.removeEventListener('keydown', handleBackdropKeyDown);
  }, [isOpen, handleBackdropKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9997] flex items-start justify-center pt-[12vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Jump to date"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="
          relative z-10
          w-72
          bg-white dark:bg-zinc-900
          rounded-2xl shadow-2xl
          border border-zinc-200 dark:border-zinc-700
          overflow-hidden
          animate-[calScaleIn_140ms_ease-out]
          focus:outline-none
        "
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Month header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="
              w-7 h-7 flex items-center justify-center rounded-full
              text-zinc-400 hover:text-zinc-700 dark:hover:text-white
              hover:bg-zinc-100 dark:hover:bg-zinc-800
              transition-colors
            "
          >
            <ChevronLeft className="text-[10px]" />
          </button>

          <span
            className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tracking-tight"
            aria-live="polite"
            aria-atomic="true"
          >
            {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>

          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="
              w-7 h-7 flex items-center justify-center rounded-full
              text-zinc-400 hover:text-zinc-700 dark:hover:text-white
              hover:bg-zinc-100 dark:hover:bg-zinc-800
              transition-colors
            "
          >
            <ChevronRight className="text-[10px]" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="px-3 py-3">
          <MiniCalendar
            viewDate={viewDate}
            selected={selected}
            today={today}
            onSelectDay={handleSelectDay}
          />
        </div>

        {/* Quick links */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800">
          <button
            className="
              flex-1 text-xs font-semibold py-1.5 rounded-lg
              bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
              hover:bg-red-100 dark:hover:bg-red-900/40
              transition-colors
            "
            onClick={() => { onJump(today); onClose(); }}
          >
            Today
          </button>
          <button
            className="
              flex-1 text-xs font-medium py-1.5 rounded-lg
              bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
              hover:bg-zinc-200 dark:hover:bg-zinc-700
              transition-colors
            "
            onClick={() => {
              const next = new Date(today);
              next.setMonth(next.getMonth() + 1, 1);
              setViewDate(next);
            }}
          >
            Next month
          </button>
          <button
            className="
              flex-1 text-xs font-medium py-1.5 rounded-lg
              bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
              hover:bg-zinc-200 dark:hover:bg-zinc-700
              transition-colors
            "
            onClick={() => {
              const prev = new Date(today);
              prev.setMonth(prev.getMonth() - 1, 1);
              setViewDate(prev);
            }}
          >
            Last month
          </button>
        </div>

        {/* Hint */}
        <div className="px-4 pb-2.5 text-center">
          <span className="text-[10px] text-zinc-400">Click any day to jump there</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default JumpToDate;

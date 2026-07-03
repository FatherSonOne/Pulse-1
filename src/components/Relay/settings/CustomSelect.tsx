// CustomSelect — fully-themed dropdown that replaces the native <select>.
// The browser's native option list can't be styled to match Relay's
// "control room" surface, so we render our own popover. Shared across all
// Relay settings tabs (Audio / Video / Storage / General).

import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

export interface CustomSelectThemeClasses {
  border: string;
  text: string;
  textMuted: string;
  inputBg: string;
  hoverBg: string;
}

interface CustomSelectProps<T extends string | number> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  isDarkMode: boolean;
  accentColor: string;
  tc: CustomSelectThemeClasses;
  ariaLabel?: string;
}

export function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  disabled = false,
  isDarkMode,
  accentColor,
  tc,
  ariaLabel,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selectAt = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const handleTriggerKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
        return;
      }
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((prev) => {
        const next = prev + dir;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && activeIndex >= 0) {
        selectAt(activeIndex);
      } else {
        setOpen((o) => !o);
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleTriggerKey}
        className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl border ${tc.border} ${tc.inputBg} ${tc.text} cursor-pointer transition-[box-shadow,border-color] ease-pulse focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        style={open ? { borderColor: accentColor, boxShadow: `0 0 0 2px ${accentColor}40` } : undefined}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className={`ml-2 w-5 h-5 ${tc.textMuted} shrink-0 transition-transform duration-200 ease-pulse ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute z-50 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border ${tc.border} p-1 shadow-xl ${
            isDarkMode ? 'bg-[#161618]' : 'bg-white'
          }`}
          style={{ boxShadow: isDarkMode ? '0 12px 32px rgba(0,0,0,0.5)' : '0 12px 32px rgba(0,0,0,0.12)' }}
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={String(opt.value) || 'default'}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectAt(index)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm cursor-pointer ${tc.text} ${
                  isActive ? tc.hoverBg : ''
                }`}
                style={isSelected ? { color: accentColor } : undefined}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CustomSelect;

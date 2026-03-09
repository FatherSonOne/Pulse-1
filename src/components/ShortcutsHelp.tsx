import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { Keyboard, X } from 'lucide-react';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Data ────────────────────────────────────────────────────────────────────

interface ShortcutEntry {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  heading: string;
  icon: string;
  items: ShortcutEntry[];
}

const GROUPS: ShortcutGroup[] = [
  {
    heading: 'Navigation',
    icon: 'fa-compass',
    items: [
      { keys: ['←', '→'],   label: 'Previous / next period' },
      { keys: ['T'],         label: 'Jump to today' },
      { keys: ['⌘J'],        label: 'Jump to any date…' },
    ],
  },
  {
    heading: 'Views',
    icon: 'fa-calendar',
    items: [
      { keys: ['D'], label: 'Day view' },
      { keys: ['W'], label: 'Week view' },
      { keys: ['M'], label: 'Month view' },
      { keys: ['Y'], label: 'Year view' },
      { keys: ['A'], label: 'Agenda view' },
    ],
  },
  {
    heading: 'Events',
    icon: 'fa-calendar-plus',
    items: [
      { keys: ['N', 'C'],    label: 'New event' },
      { keys: ['E'],         label: 'Edit selected event' },
      { keys: ['Del'],       label: 'Delete selected event' },
      { keys: ['/'],         label: 'Focus search bar' },
    ],
  },
  {
    heading: 'Panels & Modes',
    icon: 'fa-sidebar',
    items: [
      { keys: ['⌘K'],        label: 'Command palette' },
      { keys: ['⌘I'],        label: 'AI assistant panel' },
      { keys: ['⌘F'],        label: 'Focus mode (hide panels)' },
      { keys: ['?'],         label: 'This help sheet' },
      { keys: ['Esc'],       label: 'Close / dismiss' },
    ],
  },
];

// ─── Key badge ────────────────────────────────────────────────────────────────

const KeyBadge: React.FC<{ k: string }> = ({ k }) => (
  <kbd
    className="
      inline-flex items-center justify-center
      min-w-[1.75rem] h-6 px-1.5
      font-mono text-[11px] font-semibold
      rounded-md
      bg-zinc-100 dark:bg-zinc-800
      text-zinc-600 dark:text-zinc-300
      border border-zinc-300 dark:border-zinc-600
      shadow-[0_1px_0_0_rgba(0,0,0,0.12)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]
      select-none
    "
  >
    {k}
  </kbd>
);

// ─── Component ────────────────────────────────────────────────────────────────

const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ isOpen, onClose }) => {
  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === '?') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Sheet */}
      <div
        className="
          relative z-10
          w-full max-w-lg
          bg-white dark:bg-zinc-900
          rounded-2xl shadow-2xl
          border border-zinc-200 dark:border-zinc-700
          overflow-hidden
          animate-[calScaleIn_160ms_ease-out]
        "
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <Keyboard className="text-zinc-500 dark:text-zinc-400 text-xs" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close shortcuts help"
            className="
              w-7 h-7 flex items-center justify-center
              rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-white
              hover:bg-zinc-100 dark:hover:bg-zinc-800
              transition-colors
            "
          >
            <X className="text-xs" />
          </button>
        </div>

        {/* Groups */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-zinc-100 dark:divide-zinc-800">
          {GROUPS.map(group => (
            <div key={group.heading} className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <i className={`fa-solid ${group.icon} text-[10px] text-zinc-400`} aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {group.heading}
                </span>
              </div>
              <div className="space-y-2.5">
                {group.items.map(item => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-600 dark:text-zinc-300 min-w-0 leading-tight">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.keys.map(k => <KeyBadge key={k} k={k} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">
            Shortcuts are disabled while typing in inputs
          </span>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            Press <KeyBadge k="?" /> or <KeyBadge k="Esc" /> to close
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ShortcutsHelp;

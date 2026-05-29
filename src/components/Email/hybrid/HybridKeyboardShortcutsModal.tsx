// HybridKeyboardShortcutsModal — help modal for the hybrid email surface.
// Mirrors the legacy KeyboardShortcutsModal layout but lists the hybrid
// keybindings (⌘E mode toggle + Triage E/H/T/R/⌘↵ + Cockpit j/k/o/Enter).
import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  category: string;
  shortcuts: ShortcutRow[];
}

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPad|iPhone|iPod/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

export const HYBRID_SHORTCUTS: ShortcutSection[] = [
  {
    category: 'Hybrid',
    shortcuts: [
      { keys: [mod, 'E'], description: 'Toggle Cockpit / Triage' },
      { keys: ['Esc'], description: 'Dismiss Triage · collapse expanded row · close composer' },
    ],
  },
  {
    category: 'Triage mode',
    shortcuts: [
      { keys: ['E'], description: 'Archive current email + advance' },
      { keys: ['R'], description: 'Reply (does not advance — send to advance)' },
      { keys: ['H'], description: 'Snooze until tomorrow 9 AM + advance' },
      { keys: ['T'], description: 'Push to Decisions & Tasks (v1.1)' },
      { keys: [mod, '↵'], description: 'Send AI-drafted reply (v1.1)' },
      { keys: ['←'], description: 'Previous email (no action)' },
      { keys: ['→'], description: 'Next email (no action)' },
    ],
  },
  {
    category: 'Cockpit mode',
    shortcuts: [
      { keys: ['j', '↓'], description: 'Focus next Signal row' },
      { keys: ['k', '↑'], description: 'Focus previous Signal row' },
      { keys: ['o', 'Enter'], description: 'Expand / collapse focused Signal row' },
    ],
  },
  {
    category: 'Global',
    shortcuts: [
      { keys: ['c'], description: 'Compose new email' },
      { keys: ['?'], description: 'Show this help' },
      { keys: ['/'], description: 'Focus search (Phase 8)' },
      { keys: ['Shift', 'N'], description: 'Refresh / sync (Phase 7)' },
      { keys: ['g', 'i'], description: 'Inbox (Phase 6)' },
      { keys: ['g', 's'], description: 'Starred (Phase 6)' },
      { keys: ['g', 't'], description: 'Sent (Phase 6)' },
      { keys: ['g', 'd'], description: 'Drafts (Phase 6)' },
    ],
  },
];

export const HybridKeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hybrid-shortcuts-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden border border-stone-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center"
              aria-hidden="true"
            >
              <Keyboard className="text-white w-5 h-5" />
            </div>
            <div>
              <h2 id="hybrid-shortcuts-title" className="text-lg font-semibold text-stone-900 dark:text-white">
                Keyboard Shortcuts
              </h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Hybrid email mode · Cockpit + Triage
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center justify-center text-stone-500 dark:text-zinc-500 hover:text-stone-700 dark:hover:text-white transition"
            aria-label="Close keyboard shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {HYBRID_SHORTCUTS.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-3">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.shortcuts.map((sc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 py-2 px-3 bg-stone-50 dark:bg-zinc-800/50 rounded-lg"
                    >
                      <span className="text-sm text-stone-700 dark:text-zinc-300 flex-1">
                        {sc.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {sc.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            {keyIdx > 0 && (
                              <span className="text-xs text-stone-400 dark:text-zinc-600 mx-0.5">+</span>
                            )}
                            <kbd className="px-2 py-1 text-xs font-medium bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded shadow-sm text-stone-700 dark:text-zinc-300">
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50">
          <p className="text-xs text-stone-500 dark:text-zinc-500 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded">?</kbd>{' '}
            anytime to show this help · <kbd className="px-1.5 py-0.5 text-xs bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
};

export default HybridKeyboardShortcutsModal;

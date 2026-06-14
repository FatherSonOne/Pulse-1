// HybridKeyboardShortcutsModal — help modal for the hybrid email surface.
// Lists the hybrid keybindings (⌘E mode toggle + Triage E/H/T/R/⌘↵ +
// Cockpit j/k/o/Enter). Visual language consumes Pulse tokens only —
// JetBrains Mono on section labels and kbd glyphs, --pulse-canvas /
// --pulse-surface-raised / --pulse-border on surfaces, no decorative
// gradient. Matches the rest of the hybrid surface.
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

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
      { keys: ['Esc'], description: 'Dismiss Triage, collapse expanded row, close composer' },
    ],
  },
  {
    category: 'Triage mode',
    shortcuts: [
      { keys: ['E'], description: 'Archive current email, advance' },
      { keys: ['R'], description: 'Reply (does not advance, send to advance)' },
      { keys: ['H'], description: 'Snooze until tomorrow 9 AM, advance' },
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
      { keys: ['o', 'Enter'], description: 'Expand or collapse focused Signal row' },
    ],
  },
  {
    category: 'Global',
    shortcuts: [
      { keys: ['c'], description: 'Compose new email' },
      { keys: ['?'], description: 'Show this help' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['Shift', 'N'], description: 'Refresh, sync' },
      { keys: [mod, 'Z'], description: 'Undo last send' },
      { keys: ['g', 'i'], description: 'Inbox' },
      { keys: ['g', 's'], description: 'Starred' },
      { keys: ['g', 't'], description: 'Sent' },
      { keys: ['g', 'd'], description: 'Drafts' },
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
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
        style={{
          background: 'rgba(10, 10, 11, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'hybridBackdropIn 160ms ease',
        }}
      />

      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden"
        style={{
          background: 'var(--pulse-canvas)',
          border: '1px solid var(--pulse-border)',
          borderRadius: 16,
          boxShadow: 'var(--pulse-shadow-md)',
          animation: 'hybridModalIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--pulse-border)' }}
        >
          <div className="min-w-0">
            <h2
              id="hybrid-shortcuts-title"
              className="text-[17px] font-semibold pulse-ink-color leading-tight"
            >
              Keyboard shortcuts
            </h2>
            <p
              className="mt-1 text-[10.5px] font-mono-pulse tracking-wide-mono uppercase pulse-ink-3-color"
            >
              Hybrid email · Cockpit + Triage
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            type="button"
            className="w-8 h-8 inline-flex items-center justify-center pulse-ink-2-color transition"
            style={{ borderRadius: 8 }}
            aria-label="Close keyboard shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {HYBRID_SHORTCUTS.map((section) => (
              <div key={section.category}>
                <h3
                  className="text-[10.5px] font-mono-pulse tracking-wide-mono uppercase pulse-ink-3-color mb-3"
                >
                  {section.category}
                </h3>
                <div className="space-y-1.5">
                  {section.shortcuts.map((sc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 py-2 px-3"
                      style={{
                        background: 'var(--pulse-surface-raised)',
                        borderRadius: 8,
                      }}
                    >
                      <span className="text-[13px] pulse-ink-color flex-1">
                        {sc.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {sc.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            {keyIdx > 0 && (
                              <span className="text-[10px] pulse-ink-3-color mx-0.5">+</span>
                            )}
                            <kbd
                              className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10.5px] font-mono-pulse tracking-wide-mono uppercase pulse-ink-color"
                              style={{
                                background: 'var(--pulse-surface)',
                                border: '1px solid var(--pulse-border)',
                                borderRadius: 4,
                                minWidth: 22,
                                lineHeight: 1.4,
                              }}
                            >
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

        <div
          className="px-6 py-3"
          style={{
            borderTop: '1px solid var(--pulse-border)',
            background: 'var(--pulse-surface-raised)',
          }}
        >
          <p className="text-[10.5px] font-mono-pulse tracking-wide-mono uppercase pulse-ink-3-color text-center">
            <kbd
              className="inline-flex items-center justify-center px-1.5 py-0.5 mx-1 text-[10px] font-mono-pulse uppercase pulse-ink-color"
              style={{
                background: 'var(--pulse-surface)',
                border: '1px solid var(--pulse-border)',
                borderRadius: 4,
                minWidth: 18,
                lineHeight: 1.4,
              }}
            >
              ?
            </kbd>
            shows this · <kbd
              className="inline-flex items-center justify-center px-1.5 py-0.5 mx-1 text-[10px] font-mono-pulse uppercase pulse-ink-color"
              style={{
                background: 'var(--pulse-surface)',
                border: '1px solid var(--pulse-border)',
                borderRadius: 4,
                minWidth: 18,
                lineHeight: 1.4,
              }}
            >
              Esc
            </kbd>
            closes
          </p>
        </div>
      </div>
    </div>
  );
};

export default HybridKeyboardShortcutsModal;

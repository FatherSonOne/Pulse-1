// src/components/Archives/ShortcutOverlay.tsx
// Keyboard shortcut cheat sheet — opens with `?`, dismisses with Esc.

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ShortcutOverlayProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string[]; label: string; group: string }> = [
  { keys: ['/'], label: 'Focus search', group: 'Navigate' },
  { keys: ['⌘', 'K'], label: 'Focus search', group: 'Navigate' },
  { keys: ['j'], label: 'Next item', group: 'Navigate' },
  { keys: ['k'], label: 'Previous item', group: 'Navigate' },
  { keys: ['Esc'], label: 'Close detail or modal', group: 'Navigate' },
  { keys: ['s'], label: 'Star / unstar', group: 'Item' },
  { keys: ['e'], label: 'Edit item', group: 'Item' },
  { keys: ['d'], label: 'Delete item', group: 'Item' },
  { keys: ['?'], label: 'Show this overlay', group: 'Help' },
];

const Kbd: React.FC<{ k: string }> = ({ k }) => (
  <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-zinc-300 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-700 dark:text-zinc-300 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
    {k}
  </kbd>
);

export const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Group shortcuts
  const groups = SHORTCUTS.reduce((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {} as Record<string, typeof SHORTCUTS>);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/[0.06]">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-500 mb-0.5">
              Memory · keyboard
            </div>
            <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {Object.entries(groups).map(([group, shortcuts]) => (
            <div key={group}>
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500 mb-2">
                {group}
              </div>
              <ul className="space-y-1.5">
                {shortcuts.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && <span className="text-zinc-400 dark:text-zinc-600 text-xs">+</span>}
                          <Kbd k={k} />
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Press <Kbd k="Esc" /> to close
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShortcutOverlay;

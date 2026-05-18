// src/components/PulseComposer/ToolsMenuPlaceholder.tsx
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
//
// Stub modal opened by the Tools menu button. PR 3a/3b will replace this
// with the real slim tools surface (Thread Summary / Insights / Audit /
// Translate Settings). Surface 3 is also where the 6-coral-usage budget
// gets spent — PR 1 carries ZERO coral.

import React, { useEffect, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';

interface ToolsMenuPlaceholderProps {
  open: boolean;
  isDarkMode: boolean;
  onClose: () => void;
}

export const ToolsMenuPlaceholder: React.FC<ToolsMenuPlaceholderProps> = ({
  open,
  isDarkMode,
  onClose,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tools-placeholder-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
      />
      <div
        className={[
          'relative w-full max-w-md rounded-2xl shadow-2xl animate-fade-in',
          isDarkMode
            ? 'bg-zinc-900 border border-white/10 text-zinc-100'
            : 'bg-white border border-black/10 text-zinc-900',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles
              size={18}
              aria-hidden="true"
              className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}
            />
            <h2 id="tools-placeholder-title" className="text-base font-semibold">
              Tools
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={[
              'rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5',
            ].join(' ')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 pb-5">
          <p
            className={[
              'text-sm leading-relaxed',
              isDarkMode ? 'text-zinc-300' : 'text-zinc-600',
            ].join(' ')}
          >
            Tools menu coming in PR 3 — Thread Summary, Insights, Thread Audit,
            and Translate Settings will live here.
          </p>
          <p
            className={[
              'mt-3 text-xs font-mono uppercase tracking-[0.1em]',
              isDarkMode ? 'text-zinc-500' : 'text-zinc-500',
            ].join(' ')}
          >
            Surface 3 · Messages Tools Redesign
          </p>
        </div>
      </div>
    </div>
  );
};

export default ToolsMenuPlaceholder;

// src/components/PulseComposer/ToolsMenuPlaceholder.tsx
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
// PR 3a — gated swap to the real slim Tools menu (ToolsMenuV2) when the
//         `toolsMenuV2` feature flag is on. Legacy placeholder stays in
//         place when the flag is off so PR 1's surface remains shipped
//         exactly as it landed.
//
// Coral budget: ZERO. PR 3a continues PR 1's no-coral discipline. PR 3b
// will spend the six coral instances inside ToolsMenuV2 (Summary +
// Insights only). This file MUST stay coral-free.

import React, { useEffect, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useFeatures } from '../../contexts/FeatureContext';
import { ToolsMenuV2 } from '../ToolsMenuV2';

interface ToolsMenuPlaceholderProps {
  open: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  /**
   * Optional — wired by the call site when the active thread id is
   * available. Falls back to a deterministic placeholder so the V2
   * panel still mounts in isolation (Storybook / dev review).
   */
  threadId?: string;
  /**
   * Optional — message count for the active thread. Drives the
   * `<5 messages` empty-state in Thread Audit. Defaults to 0 (which
   * triggers the empty-state copy).
   */
  messageCount?: number;
}

export const ToolsMenuPlaceholder: React.FC<ToolsMenuPlaceholderProps> = ({
  open,
  isDarkMode,
  onClose,
  threadId,
  messageCount,
}) => {
  const { isFeatureEnabled } = useFeatures();
  const v2Enabled = isFeatureEnabled('toolsMenuV2');

  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    if (v2Enabled) return; // V2 owns its own focus
    requestAnimationFrame(() => closeBtnRef.current?.focus());
  }, [open, v2Enabled]);

  useEffect(() => {
    if (!open) return;
    if (v2Enabled) return; // V2 owns its own Esc
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, v2Enabled, onClose]);

  if (!open) return null;

  // PR 3a — feature-flagged real surface.
  if (v2Enabled) {
    return (
      <ToolsMenuV2
        open={open}
        threadId={threadId ?? 'unknown-thread'}
        messageCount={messageCount ?? 0}
        isDarkMode={isDarkMode}
        onClose={onClose}
      />
    );
  }

  // Legacy placeholder (kept verbatim from PR 1 so the off-flag path
  // remains byte-identical for QA comparison).
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

// src/components/MessageContextMenu/EditedBadge.tsx
// PR 2 · Surface 2 · "edited" badge next to a message timestamp.
//
// Per locked decision #4 in the spec, after an edit the bubble shows
// an "edited" affordance whose hover/long-press surfaces the original
// text in a small popover. Pure UI — caller passes `originalText`.

import React, { useEffect, useRef, useState } from 'react';
import type { EditedBadgeProps } from './types';

const LONG_PRESS_MS = 350;

export const EditedBadge: React.FC<EditedBadgeProps> = ({
  edited,
  originalText,
  isDarkMode = false,
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!edited) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), LONG_PRESS_MS);
  };
  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          if (!originalText) return;
          setOpen((v) => !v);
        }}
        onMouseEnter={() => originalText && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onPointerDown={handlePointerDown}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        aria-label={
          originalText
            ? 'Message was edited. Press to see original.'
            : 'Message was edited.'
        }
        aria-expanded={open}
        aria-haspopup={originalText ? 'dialog' : undefined}
        className={[
          'ml-2 align-baseline font-mono uppercase tracking-[0.1em] text-[9px]',
          'inline-flex items-center px-1 rounded',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
          isDarkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-800',
          originalText ? 'cursor-help' : 'cursor-default',
        ].join(' ')}
      >
        edited
      </button>
      {open && originalText ? (
        <span
          role="dialog"
          aria-label="Original message"
          className={[
            'absolute z-50 mt-1 right-0 min-w-[180px] max-w-[260px] p-2 rounded-lg shadow-lg text-xs',
            'whitespace-pre-wrap break-words',
            isDarkMode
              ? 'bg-zinc-800 text-zinc-100 border border-white/10'
              : 'bg-white text-zinc-900 border border-black/10',
          ].join(' ')}
        >
          <span
            className={[
              'block font-mono uppercase tracking-[0.1em] text-[9px] mb-1',
              isDarkMode ? 'text-zinc-400' : 'text-zinc-500',
            ].join(' ')}
          >
            Original
          </span>
          {originalText}
        </span>
      ) : null}
    </span>
  );
};

export default EditedBadge;

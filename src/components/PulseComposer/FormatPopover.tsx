// src/components/PulseComposer/FormatPopover.tsx
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
//
// Floating toolbar that appears above a non-empty text selection. The
// six actions wrap or prefix the selection with markdown-ish delimiters
// (the same shape Pulse already uses elsewhere). Block-style actions
// (list/quote) line-prefix each line in the selection.
//
// Position is computed once at render — the textarea's selection range
// is the source of truth. If the popover would overflow the viewport,
// it clamps to the nearest edge with 8px padding.
//
// Coral budget: ZERO.

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  Quote,
} from 'lucide-react';
import type {
  FormatActionDescriptor,
  FormatActionId,
  SelectionAnchor,
} from './types';
import { TOUCH_TARGET_PX } from './types';

const POPOVER_WIDTH = 280;
const VIEWPORT_PAD = 8;

const FORMAT_ACTIONS: ReadonlyArray<FormatActionDescriptor> = [
  {
    id: 'bold',
    label: 'Bold',
    icon: Bold,
    shortcut: 'Cmd+B',
    wrap: { start: '**', end: '**' },
  },
  {
    id: 'italic',
    label: 'Italic',
    icon: Italic,
    shortcut: 'Cmd+I',
    wrap: { start: '_', end: '_' },
  },
  {
    id: 'code',
    label: 'Code',
    icon: Code,
    shortcut: 'Cmd+E',
    wrap: { start: '`', end: '`' },
  },
  {
    id: 'list',
    label: 'List',
    icon: List,
    shortcut: 'Cmd+Shift+8',
    linePrefix: '- ',
  },
  {
    id: 'quote',
    label: 'Quote',
    icon: Quote,
    shortcut: 'Cmd+Shift+.',
    linePrefix: '> ',
  },
  {
    id: 'link',
    label: 'Link',
    icon: LinkIcon,
    shortcut: 'Cmd+K',
    wrap: { start: '[', end: '](url)' },
  },
];

interface FormatPopoverProps {
  open: boolean;
  anchor: SelectionAnchor | null;
  isDarkMode: boolean;
  onApply: (action: FormatActionId) => void;
}

function clampPosition(anchorX: number, anchorY: number): { top: number; left: number } {
  if (typeof window === 'undefined') return { top: anchorY, left: anchorX };
  const popoverHeight = 48;
  const desiredTop = anchorY - popoverHeight - 10;
  const top = Math.max(VIEWPORT_PAD, desiredTop);
  const halfWidth = POPOVER_WIDTH / 2;
  const minLeft = VIEWPORT_PAD;
  const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_PAD;
  const left = Math.max(minLeft, Math.min(anchorX - halfWidth, maxLeft));
  return { top, left };
}

export const FormatPopover: React.FC<FormatPopoverProps> = ({
  open,
  anchor,
  isDarkMode,
  onApply,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useMemo(
    () => (anchor ? clampPosition(anchor.x, anchor.y) : null),
    [anchor],
  );

  // Roving focus on Arrow keys.
  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const onKey = (e: KeyboardEvent) => {
      const buttons = Array.from(
        el.querySelectorAll<HTMLButtonElement>('[data-format-action]'),
      );
      const active = document.activeElement as HTMLElement | null;
      const idx = active ? buttons.indexOf(active as HTMLButtonElement) : -1;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = idx < 0 ? 0 : (idx + 1) % buttons.length;
        buttons[next]?.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = idx < 0 ? buttons.length - 1 : (idx - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || !anchor || !pos) return null;

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Text formatting"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: POPOVER_WIDTH,
        zIndex: 60,
      }}
      className={[
        'flex items-center gap-0.5 px-1 py-1 rounded-xl shadow-2xl backdrop-blur animate-fade-in',
        isDarkMode
          ? 'bg-zinc-900/95 border border-white/10 text-zinc-100'
          : 'bg-white/98 border border-black/10 text-zinc-900',
      ].join(' ')}
      // Prevent the textarea from losing selection when the user clicks here.
      onMouseDown={(e) => e.preventDefault()}
    >
      {FORMAT_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            data-format-action={action.id}
            aria-label={`${action.label} (${action.shortcut})`}
            title={`${action.label} (${action.shortcut})`}
            onClick={() => onApply(action.id)}
            className={[
              'flex items-center justify-center rounded-lg',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40',
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5',
            ].join(' ')}
            style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};

/**
 * Apply a markdown-ish format to a textarea value over the given range.
 * Returns the new value + new caret/selection range (so the caller can
 * restore selection after the React state update settles).
 */
export function applyFormat(
  value: string,
  start: number,
  end: number,
  action: FormatActionId,
): { value: string; selectionStart: number; selectionEnd: number } {
  const descriptor = FORMAT_ACTIONS.find((a) => a.id === action);
  if (!descriptor) return { value, selectionStart: start, selectionEnd: end };
  const selected = value.slice(start, end);
  if (descriptor.linePrefix) {
    const prefixed = selected
      .split('\n')
      .map((line) => `${descriptor.linePrefix}${line}`)
      .join('\n');
    const next = value.slice(0, start) + prefixed + value.slice(end);
    return {
      value: next,
      selectionStart: start,
      selectionEnd: start + prefixed.length,
    };
  }
  if (descriptor.wrap) {
    const { start: s, end: e } = descriptor.wrap;
    const wrapped = `${s}${selected}${e}`;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    return {
      value: next,
      selectionStart: start + s.length,
      selectionEnd: start + s.length + selected.length,
    };
  }
  return { value, selectionStart: start, selectionEnd: end };
}

export { FORMAT_ACTIONS };
export default FormatPopover;

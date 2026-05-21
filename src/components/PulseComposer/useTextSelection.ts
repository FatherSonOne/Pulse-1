// src/components/PulseComposer/useTextSelection.ts
// PR 1 — Messages Tools Redesign · Surface 1 · Compose bar.
//
// Selection-tracking hook for the format popover. Watches the textarea
// for selectionchange / pointerup / keyup and produces a viewport-anchored
// rect whenever the user has selected ≥ 1 character.
//
// The popover positioning math uses a single line-height assumption — the
// textarea uses a monospace-ish line height so a per-line rectangle is a
// safe approximation. Anchoring inside a textarea is fundamentally a
// heuristic; the spec accepts this trade-off (Notion/Medium do the same).

import { useEffect, useState } from 'react';
import type { SelectionAnchor } from './types';

/** Estimated line height in px — used when DOM measurement isn't possible. */
const FALLBACK_LINE_HEIGHT = 20;

interface MeasuredCaretRect {
  top: number;
  left: number;
  height: number;
}

/**
 * Estimate the caret rect at `offset` inside the textarea by cloning the
 * textarea into a mirror <div> whose styles match the textarea, then
 * measuring the position of a marker span at the requested offset.
 */
function measureCaretRect(
  textarea: HTMLTextAreaElement,
  offset: number,
): MeasuredCaretRect | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const propsToCopy: (keyof CSSStyleDeclaration)[] = [
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontFamily',
    'lineHeight',
    'letterSpacing',
    'textTransform',
    'wordSpacing',
    'textIndent',
    'whiteSpace',
    'wordWrap',
  ];
  for (const prop of propsToCopy) {
    const value = style.getPropertyValue(String(prop));
    if (value) mirror.style.setProperty(String(prop), value);
  }
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  // Match scroll so the offset math agrees with the rendered textarea.
  mirror.textContent = textarea.value.slice(0, offset);
  const marker = document.createElement('span');
  marker.textContent = textarea.value.slice(offset, offset + 1) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const taRect = textarea.getBoundingClientRect();
  document.body.removeChild(mirror);
  // The mirror is positioned off-screen; we project the marker's local
  // offset back onto the textarea's viewport rect.
  const localTop = markerRect.top - mirrorRect.top;
  const localLeft = markerRect.left - mirrorRect.left;
  return {
    top: taRect.top + localTop - textarea.scrollTop,
    left: taRect.left + localLeft - textarea.scrollLeft,
    height: markerRect.height || FALLBACK_LINE_HEIGHT,
  };
}

/**
 * useTextSelection — produces a `SelectionAnchor` whenever the textarea
 * has a non-empty selection, and null otherwise. The caller is responsible
 * for rendering the popover; this hook is positioning + lifecycle only.
 */
export function useTextSelection(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
): SelectionAnchor | null {
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const update = () => {
      if (document.activeElement !== el) {
        setAnchor(null);
        return;
      }
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      if (end <= start) {
        setAnchor(null);
        return;
      }
      const startRect = measureCaretRect(el, start);
      const endRect = measureCaretRect(el, end);
      if (!startRect || !endRect) {
        // Fallback: anchor at the textarea center-top.
        const rect = el.getBoundingClientRect();
        setAnchor({
          x: rect.left + rect.width / 2,
          y: rect.top,
          length: end - start,
          start,
          end,
        });
        return;
      }
      // If the selection spans multiple lines, anchor above the start.
      const sameLine = Math.abs(startRect.top - endRect.top) < 2;
      const x = sameLine
        ? (startRect.left + endRect.left) / 2
        : startRect.left;
      const y = startRect.top;
      setAnchor({ x, y, length: end - start, start, end });
    };

    const onSelectionChange = () => update();
    document.addEventListener('selectionchange', onSelectionChange);
    el.addEventListener('pointerup', update);
    el.addEventListener('keyup', update);
    el.addEventListener('blur', () => setAnchor(null));

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      el.removeEventListener('pointerup', update);
      el.removeEventListener('keyup', update);
    };
  }, [textareaRef]);

  return anchor;
}

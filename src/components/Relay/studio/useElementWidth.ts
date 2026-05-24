import { useCallback, useRef, useState } from 'react';

/**
 * Observe an element's inline (width) size with a ResizeObserver and return a
 * callback ref + the current width in px.
 *
 * Why this exists: Relay never gets the full viewport — the global Pulse nav
 * and the vertical SourcesRail sit in front of every mode body — so Tailwind
 * `md:`/`lg:` (viewport media queries) over-report the room a mode actually
 * has. Measuring the *pane* gives container-query semantics: layout decisions
 * key off the width the content really occupies, not the window.
 *
 * The width is rounded to the nearest `step` (default 8px) and state only
 * updates when the rounded value changes, so a drag-resize triggers at most one
 * re-render per step crossing rather than one per pixel. In steady state (no
 * resizing) the observer is silent and there are zero extra re-renders.
 *
 * A callback ref (rather than useRef + useEffect) keeps observe/disconnect
 * correct across element swaps without a separate effect.
 */
export function useElementWidth<T extends HTMLElement = HTMLElement>(
  step = 8,
): [(node: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const lastRef = useRef(-1);

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || typeof ResizeObserver === 'undefined') return;

      const apply = (raw: number) => {
        const rounded = Math.round(raw / step) * step;
        if (rounded !== lastRef.current) {
          lastRef.current = rounded;
          setWidth(rounded);
        }
      };

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        // borderBoxSize is the most reliable cross-browser inline size; fall
        // back to the content rect for older engines.
        const raw = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        apply(raw);
      });
      ro.observe(node);
      observerRef.current = ro;

      // Prime synchronously so the first paint already has the real width
      // rather than the 0 default for one frame.
      apply(node.getBoundingClientRect().width);
    },
    [step],
  );

  return [ref, width];
}

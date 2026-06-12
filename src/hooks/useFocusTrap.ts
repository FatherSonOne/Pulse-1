import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { enterOverlay, exitOverlay, isTopmostOverlay } from '../lib/overlayStack';

interface UseFocusTrapOptions {
  /** Whether the trap is currently active (e.g. modal is open). */
  active: boolean;
  /** Optional callback fired when Escape is pressed inside the trap. */
  onEscape?: () => void;
  /** Optional ref to the element that should receive initial focus.
   *  If omitted, the first focusable child of the container is focused. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Whether to restore focus to the previously focused element when
   *  the trap deactivates. Defaults to true. */
  restoreFocus?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap keyboard focus inside a container — used for modals, dialogs,
 * and floating panels. Returns a ref to attach to the container.
 *
 * Implements the WCAG 2.4.3 + 2.1.2 pattern:
 *  - Tab / Shift+Tab cycles within the container
 *  - Escape calls onEscape (consumer decides whether to close)
 *  - Initial focus moves into the container on activation
 *  - Previously focused element is restored on deactivation
 *
 * Usage:
 *   const ref = useFocusTrap<HTMLDivElement>({ active: isOpen, onEscape: onClose });
 *   <div ref={ref} role="dialog" aria-modal="true">…</div>
 */
export function useFocusTrap<T extends HTMLElement>({
  active,
  onEscape,
  initialFocusRef,
  restoreFocus = true,
}: UseFocusTrapOptions): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  // Keep the latest Escape handler in a ref so an unstable callback can't
  // re-register the keydown listener and tear the trap down/up on every render
  // (the same pattern useAndroidBackButton uses for interceptBack). Without it,
  // typing in a sheet's input re-creates onEscape, the effect re-runs, and the
  // rAF initial-focus yanks focus back to the first focusable each keystroke.
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;

    // Register on the shared overlay stack: enables topmost-only key handling
    // (so stacked traps don't all fire Escape) and a global "an overlay is
    // open" signal that app-wide keyboard shortcuts consult before acting.
    const token = enterOverlay();

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusInitial = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const container = containerRef.current;
      if (!container) return;
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    };

    const id = window.requestAnimationFrame(focusInitial);

    const handleKey = (e: KeyboardEvent) => {
      // Only the topmost active trap reacts; lower stacked traps stay inert so a
      // single Escape/Tab doesn't fire across every mounted trap at once.
      if (!isTopmostOverlay(token)) return;
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusables = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);

    return () => {
      exitOverlay(token);
      window.cancelAnimationFrame(id);
      document.removeEventListener('keydown', handleKey);
      if (restoreFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [active, initialFocusRef, restoreFocus]);

  return containerRef;
}

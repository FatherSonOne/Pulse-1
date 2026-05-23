import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

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

  useEffect(() => {
    if (!active) return;

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
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation();
        onEscape();
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
      window.cancelAnimationFrame(id);
      document.removeEventListener('keydown', handleKey);
      if (restoreFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [active, onEscape, initialFocusRef, restoreFocus]);

  return containerRef;
}

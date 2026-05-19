// ─────────────────────────────────────────────────────────────────────────────
// useDialogA11y — shared focus management for Map section dialogs.
//
// Three guarantees per WCAG 2.4.3 (Focus Order) and 2.4.7 (Focus Visible):
//   1. On mount, focus moves into the dialog (initialFocusRef or the first
//      focusable inside containerRef).
//   2. Tab cycles inside the container; Shift-Tab on the first focusable
//      jumps to the last, and vice versa.
//   3. Escape calls onClose, and on unmount focus returns to whatever owned
//      it before mount — almost always the trigger button.
//
// Consumers pass containerRef (the dialog's root <div>) and optionally
// initialFocusRef (the field they want focused first — typically a search
// input or the primary action). If omitted, the first focusable element in
// container is focused.
// ─────────────────────────────────────────────────────────────────────────────

import { RefObject, useEffect } from 'react';

interface UseDialogA11yArgs {
  containerRef: RefObject<HTMLElement>;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement>;
}

const FOCUSABLE_SELECTOR =
  'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function useDialogA11y({ containerRef, onClose, initialFocusRef }: UseDialogA11yArgs): void {
  useEffect(() => {
    // Stash whoever owns focus right now (usually the trigger button) so we
    // can return to it on unmount. Capture-once via the effect closure.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Set initial focus on the next tick — gives autoFocus inputs a chance
    // to run first, and avoids racing React's commit phase.
    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const root = containerRef.current;
      if (!root) return;
      const focusables = getFocusables(root);
      focusables[0]?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = getFocusables(root);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      // Restore focus to the trigger, but tolerate the case where the
      // trigger has been unmounted (e.g. a parent re-render swapped it out)
      // — focus() on a detached element throws in some browsers.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        try { previouslyFocused.focus({ preventScroll: true }); } catch { /* noop */ }
      }
    };
  }, [containerRef, onClose, initialFocusRef]);
}

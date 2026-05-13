import type React from 'react';

/**
 * View Transitions wrapper for cross-section navigation from a dashboard
 * strip row to its detail view. Uses View Transitions API in Chrome/Edge/Safari;
 * falls back to instant navigation in Firefox.
 *
 * The caller must temporarily set `view-transition-name: strip-row` on the
 * clicked row so the browser knows what to morph. We do that here.
 */
type StartViewTransitionCapableDoc = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

export function navigateWithTransition(
  trigger: HTMLElement | null,
  doNavigate: () => void,
): void {
  const doc = document as StartViewTransitionCapableDoc;

  const cleanup = (): void => {
    if (trigger) trigger.style.viewTransitionName = '';
  };

  if (!doc.startViewTransition || !trigger) {
    doNavigate();
    return;
  }

  trigger.style.viewTransitionName = 'strip-row';
  const transition = doc.startViewTransition(() => { doNavigate(); });
  void transition.finished.finally(cleanup);
}

/**
 * Click handler factory: returns an onClick that wraps the navigation
 * in a View Transition. Use on strip rows.
 */
export function makeStripRowClick(
  doNavigate: () => void,
): React.MouseEventHandler<HTMLElement> {
  return (e) => {
    navigateWithTransition(e.currentTarget as HTMLElement, doNavigate);
  };
}

/**
 * Keyboard navigation helper for strip lists. Wires j/k (and ArrowDown/ArrowUp)
 * to walk across all `[data-strip-row]` elements on the page, and Enter to
 * click the focused row. Returns a cleanup function.
 */
export function attachStripKeyboardNav(container: HTMLElement): () => void {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-strip-row]'));
    if (rows.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const currentIdx = active ? rows.findIndex(r => r === active || r.contains(active)) : -1;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = rows[Math.min(currentIdx + 1, rows.length - 1)] ?? rows[0];
      next.focus();
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = rows[Math.max(currentIdx - 1, 0)] ?? rows[0];
      prev.focus();
    } else if (e.key === 'Enter' && currentIdx >= 0) {
      const row = rows[currentIdx];
      if (row && document.activeElement === row) {
        e.preventDefault();
        row.click();
      }
    }
  };

  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

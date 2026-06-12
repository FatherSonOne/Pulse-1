// overlayStack — a process-wide LIFO registry of active "blocking" overlays
// (focus-trapped dialogs, the mobile bottom sheets, the capture modal). It
// exists because Pulse mounts every keyboard listener on `document`/`window`,
// where DOM event semantics give us no built-in notion of "which overlay is on
// top". Two jobs:
//
//   1. Topmost arbitration — only the overlay on top of the stack should react
//      to Escape/Tab. `e.stopPropagation()` cannot silence sibling listeners on
//      the same node, so without this every mounted trap fires Escape at once
//      (closing a hidden sheet underneath a visible modal). Each consumer holds
//      a token and checks `isTopmostOverlay(token)` before acting.
//
//   2. A global "is any overlay open" signal so app-wide keyboard shortcuts
//      (Relay/Glimpse letter keys, the g-chord layer, palette command
//      shortcuts) can bail instead of acting on the view occluded behind an
//      open overlay.
//
// Module-level state (not React) on purpose: the consumers are imperative
// keydown handlers that must read it synchronously at event-dispatch time.

let stack: number[] = [];
let counter = 0;

/** Push a new overlay onto the stack and return its token. Call on activate. */
export function enterOverlay(): number {
  const token = ++counter;
  stack.push(token);
  return token;
}

/** Remove an overlay from the stack. Call on deactivate/unmount with its token. */
export function exitOverlay(token: number): void {
  stack = stack.filter((t) => t !== token);
}

/** True when at least one overlay is active. Checks the registered stack first
 *  (focus-trap modals + CaptureModal), then falls back to the DOM so the many
 *  bespoke modals that don't register are still seen by the global shortcut
 *  guards. A dialog counts only if it's actually visible (offsetWidth/Height
 *  non-zero) — which ignores conditionally-hidden-but-mounted dialogs and works
 *  for position:fixed modals, where offsetParent would misleadingly be null.
 *
 *  INVARIANT: a non-blocking / coexisting surface (e.g. a docked side panel that
 *  leaves the view interactive beside it) must NOT carry aria-modal="true", or
 *  it silently suppresses every global shortcut while open. Non-blocking dialogs
 *  use role="dialog" with NO aria-modal (PulseAssistant) or aria-modal="false"
 *  (ToolsMenuV2 desktop dock, EmailComposerModal sidecar). */
export function isOverlayOpen(): boolean {
  if (stack.length > 0) return true;
  if (typeof document === 'undefined') return false;
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
  for (let i = 0; i < dialogs.length; i++) {
    const el = dialogs[i];
    if (el.offsetWidth > 0 || el.offsetHeight > 0) return true;
  }
  return false;
}

/** True when `token` is the overlay currently on top of the stack. */
export function isTopmostOverlay(token: number): boolean {
  return stack.length > 0 && stack[stack.length - 1] === token;
}

/**
 * MessagesFocusModePlugin
 *
 * Phase 5d.3 — Focus Mode for `MessagesSplitView`.
 *
 * The existing `<FocusMode>` component (and its sub-components —
 * FocusTimer, FocusControls, DistractionBlockingOverlay,
 * SessionCompletionCelebration, FocusDigestCard, FocusStatsDashboard)
 * is already self-contained: it owns its own timer state, persists to
 * localStorage, and renders a full-screen overlay. ~3000 LOC of
 * focus-related UI lives in those files and remains unchanged.
 *
 * What was missing was a clean *trigger* contract. The legacy
 * `Messages.tsx` toggled focus mode via a local `useState` + threaded
 * `isFocusModeActive` / `setIsFocusModeActive` through a half-dozen
 * children. The `FocusModeContext` was already wired into
 * `MessagesWithProviders` but unused.
 *
 * This plugin closes the gap: it bridges the context (the trigger) to
 * the self-contained `<FocusMode>` overlay (the rendering), so any
 * descendant in the tree can call `useFocusMode().startFocusMode(threadId)`
 * to enter focus mode without prop-drilling.
 *
 * Wire as `<MessagesSplitView renderGlobalOverlay={() => (
 *   <MessagesFocusModePlugin userId={userId} />
 * )} />`.
 *
 * Wrap the tree in `<FocusModeProvider>` (already provided by
 * `MessagesWithProviders` — no extra setup needed when using the
 * standard entry point).
 */

import React, { Suspense, lazy } from 'react';
import { useFocusMode } from '../../contexts/FocusModeContext';

// Lazy-load — the focus stack is heavy (~3000 LOC) and rarely
// triggered. Loading on demand keeps the initial bundle lean.
const FocusMode = lazy(() =>
  import('./FocusMode').then((m) => ({ default: m.FocusMode })),
);

interface MessagesFocusModePluginProps {
  /** Authenticated user id — required by the focus-mode service for
   *  session attribution / stats. */
  userId: string;
  /** Optional friendly thread name shown in the overlay header. The
   *  context only stores `threadId`; the host typically resolves the
   *  display name from the active conversation. */
  threadName?: string;
}

export const MessagesFocusModePlugin: React.FC<MessagesFocusModePluginProps> = ({
  userId,
  threadName,
}) => {
  const { isActive, threadId, stopFocusMode } = useFocusMode();

  // Render nothing when focus mode is inactive — keeps DOM clean and
  // the lazy chunk only loads when actually needed.
  if (!isActive || !threadId) return null;

  return (
    <Suspense fallback={null}>
      <FocusMode
        isActive={isActive}
        threadId={threadId}
        threadName={threadName}
        userId={userId}
        onClose={stopFocusMode}
      />
    </Suspense>
  );
};

export default MessagesFocusModePlugin;

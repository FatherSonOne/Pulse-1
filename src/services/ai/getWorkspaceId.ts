// Non-React helper to read the active workspace ID from localStorage.
// Used by AI services that run outside React components. The key matches
// ACTIVE_WORKSPACE_KEY in src/contexts/WorkspaceContext.tsx — keep in sync.

const ACTIVE_WORKSPACE_KEY = 'pulse_active_workspace';

export function getCurrentWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

/** Throws if no active workspace is set — call sites that require one use this. */
export function requireCurrentWorkspaceId(): string {
  const id = getCurrentWorkspaceId();
  if (!id) {
    throw new Error(
      'No active workspace. User must select or create a workspace before invoking AI.',
    );
  }
  return id;
}

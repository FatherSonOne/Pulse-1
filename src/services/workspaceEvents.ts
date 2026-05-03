/**
 * Workspace lifecycle event bus.
 *
 * WorkspaceContext is the single source of truth for the active workspace,
 * but singleton services (dataService, voxModeService, pulseService, …)
 * live outside React and hold long-lived realtime channels. They need to
 * tear those channels down when the user switches workspaces — otherwise
 * a channel filtered by the previous workspace_id keeps streaming into the
 * new context, leaking cross-workspace data.
 *
 * Why a window event instead of a callback registry: services initialise
 * at module-load time, before WorkspaceContext mounts. A passive window
 * event lets them subscribe without having to import the React context
 * (which would create a circular dep) and without leaking React internals
 * into singleton lifecycles.
 */

export const WORKSPACE_CHANGED_EVENT = 'pulse:workspace-changed';
export const WORKSPACE_CLEARED_EVENT = 'pulse:workspace-cleared';

export interface WorkspaceChangedDetail {
  previousId: string | null;
  currentId: string;
  userId: string | null;
}

export interface WorkspaceClearedDetail {
  /** Last-known workspace before clear (e.g. on logout) */
  previousId: string | null;
  /** Reason — useful for downstream handlers that distinguish logout vs deletion */
  reason: 'logout' | 'last-workspace-deleted' | 'no-membership';
}

export function emitWorkspaceChanged(detail: WorkspaceChangedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WorkspaceChangedDetail>(WORKSPACE_CHANGED_EVENT, { detail }));
}

export function emitWorkspaceCleared(detail: WorkspaceClearedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WorkspaceClearedDetail>(WORKSPACE_CLEARED_EVENT, { detail }));
}

export function onWorkspaceChanged(
  handler: (detail: WorkspaceChangedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<WorkspaceChangedDetail>).detail);
  window.addEventListener(WORKSPACE_CHANGED_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_CHANGED_EVENT, listener);
}

export function onWorkspaceCleared(
  handler: (detail: WorkspaceClearedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<WorkspaceClearedDetail>).detail);
  window.addEventListener(WORKSPACE_CLEARED_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_CLEARED_EVENT, listener);
}

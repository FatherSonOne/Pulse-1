import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { workspaceService, Workspace, WorkspaceMember, WorkspacePlan, WorkspaceUpdatableFields } from '../services/workspaceService';
import { supabase } from '../services/supabase';
import { emitWorkspaceChanged, emitWorkspaceCleared } from '../services/workspaceEvents';
import { usePermissionMatrix } from '../hooks/usePermissionMatrix';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVE_WORKSPACE_KEY  = 'pulse_active_workspace';
const PENDING_INVITE_KEY    = 'pulse_pending_invite_token';

// ---------------------------------------------------------------------------
// Sub-context types
// ---------------------------------------------------------------------------

export interface WorkspaceDataContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  members: WorkspaceMember[];
  currentRole: 'owner' | 'admin' | 'member' | 'viewer' | null;
  isLoading: boolean;
}

export interface WorkspaceActionsContextType {
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string, description?: string, plan?: WorkspacePlan) => Promise<Workspace>;
  createChildWorkspace: (parentWorkspaceId: string, name: string, description?: string) => Promise<Workspace>;
  updateWorkspace: (
    workspaceId: string,
    updates: WorkspaceUpdatableFields,
  ) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  softDeleteWorkspace: (workspaceId: string) => Promise<void>;
  hardDeleteWorkspace: (workspaceId: string) => Promise<void>;
  restoreWorkspace: (workspaceId: string) => Promise<void>;
  deletedWorkspaces: Workspace[];
}

export interface WorkspacePermissionsContextType {
  isOwner: boolean;
  isAdmin: boolean;
  canManageMembers: boolean;
  /**
   * Catalog-backed permission check. Returns true when the current user's
   * role has `key` granted in the workspace's permission catalog. Fail-closed
   * during catalog load and when the user is not a workspace member.
   *
   * Does not yet consult group_grants (#42 Sub-PR 5 substrate exists; UI/read
   * consumer lands in a follow-up). For workspace-wide role grants — which is
   * the entire production surface today — this is the authoritative API.
   */
  hasPermission: (key: string) => boolean;
}

/**
 * Cross-cutting mutation lock — held while a workspace-scoped mutation
 * is in flight (e.g. Team Settings inviting, role change, member remove,
 * invite revoke). Readers use this to disable affordances that would
 * change `currentWorkspace` mid-mutation (workspace switcher), avoiding
 * the race where a fetch returns into a different workspace's context.
 *
 * `acquireMutationLock()` returns a release function. Callers should
 * wrap the await chain in a try/finally so the lock is released even
 * on error. Counter-based so nested/parallel mutations stack cleanly.
 */
export interface WorkspaceMutationLockContextType {
  isMutating: boolean;
  acquireMutationLock: () => () => void;
}

// Aggregated type (backward compat)
export interface WorkspaceContextType
  extends WorkspaceDataContextType,
    WorkspaceActionsContextType,
    WorkspacePermissionsContextType {}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export const WorkspaceDataContext = createContext<WorkspaceDataContextType | undefined>(undefined);
export const WorkspaceActionsContext = createContext<WorkspaceActionsContextType | undefined>(undefined);
export const WorkspacePermissionsContext = createContext<WorkspacePermissionsContextType | undefined>(undefined);
export const WorkspaceMutationLockContext = createContext<WorkspaceMutationLockContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const { user } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletedWorkspaces, setDeletedWorkspaces] = useState<Workspace[]>([]);

  // Mutation lock counter (F1). Tracks how many workspace-scoped mutations
  // are currently in flight so the workspace switcher can disable itself.
  // Counter (not bool) so nested/parallel mutations stack cleanly.
  const [mutationLockCount, setMutationLockCount] = useState<number>(0);

  const acquireMutationLock = useCallback((): (() => void) => {
    setMutationLockCount(n => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setMutationLockCount(n => Math.max(0, n - 1));
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Data fetching helpers
  // ---------------------------------------------------------------------------

  const loadWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    if (!user) return [];
    const fetched = await workspaceService.getUserWorkspaces(user.id);
    setWorkspaces(fetched);
    return fetched;
    // Key on the stable user id, NOT the user object. AuthContext calls
    // setUser(newUser) with a fresh reference on every TOKEN_REFRESHED, so
    // depending on `user` would rebuild this callback (and every effect that
    // lists it) on each proactive token refresh. See the init-effect note below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadMembers = useCallback(async (workspaceId: string): Promise<void> => {
    const fetched = await workspaceService.getMembers(workspaceId);
    setMembers(fetched);
  }, []);

  // ---------------------------------------------------------------------------
  // Restore / persist active workspace
  // ---------------------------------------------------------------------------

  const resolveActiveWorkspace = useCallback(
    (list: Workspace[]): Workspace | null => {
      if (list.length === 0) return null;
      const persisted = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      if (persisted) {
        const match = list.find((w) => w.id === persisted);
        if (match) return match;
      }
      return list[0];
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setMembers([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      try {
        const pendingToken = sessionStorage.getItem(PENDING_INVITE_KEY);
        if (pendingToken) {
          sessionStorage.removeItem(PENDING_INVITE_KEY);
          try {
            const wsId = await workspaceService.acceptInvite(pendingToken);
            localStorage.setItem(ACTIVE_WORKSPACE_KEY, wsId);
          } catch {
            // Accept failed (expired/already used) — continue normally
          }
        }

        let list = await workspaceService.getUserWorkspaces(user.id);
        if (cancelled) return;

        // No active workspaces — check for soft-deleted ones before auto-creating
        if (list.length === 0) {
          try {
            const deleted = await workspaceService.getDeletedWorkspaces();
            if (cancelled) return;
            if (deleted.length > 0) {
              setDeletedWorkspaces(deleted);
              // Don't auto-create — show the interstitial instead
            } else {
              // First-time user: auto-create a default workspace
              const created = await workspaceService.createWorkspace('My Workspace');
              list = [created];
            }
          } catch {
            // Non-fatal — switcher will remain hidden until user manually creates one
          }
        }

        setWorkspaces(list);

        const active = resolveActiveWorkspace(list);
        setCurrentWorkspace(active);

        if (active) {
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, active.id);
          const memberList = await workspaceService.getMembers(active.id);
          if (cancelled) return;
          setMembers(memberList);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
    // Depend on the stable user id, NOT the user object. AuthContext replaces
    // the user object reference on every auth event (incl. the session
    // monitor's proactive TOKEN_REFRESHED). Keying on the object re-ran this
    // init on each refresh, flipping isLoading true->false, which made
    // WorkspaceGate (App.tsx) swap the whole authed tree for the loading
    // screen and remount it — wiping in-flight modal/form state app-wide
    // (e.g. ConnectContactsModal refetching contacts 3x per refresh burst).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, resolveActiveWorkspace]);

  // ---------------------------------------------------------------------------
  // Load members whenever currentWorkspace changes
  // ---------------------------------------------------------------------------

  const currentWorkspaceId = currentWorkspace?.id;

  useEffect(() => {
    if (!currentWorkspaceId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    workspaceService.getMembers(currentWorkspaceId).then((fetched) => {
      if (!cancelled) setMembers(fetched);
    });
    return () => { cancelled = true; };
  }, [currentWorkspaceId]);

  // ---------------------------------------------------------------------------
  // Broadcast workspace lifecycle events to singleton services
  // ---------------------------------------------------------------------------
  // Long-lived services (dataService, voxModeService, …) hold realtime channels
  // filtered by the previous workspace_id. They listen for these events to tear
  // those channels down on switch — preventing cross-workspace data leaks.

  const previousWorkspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    const previousId = previousWorkspaceIdRef.current;
    const userId = user?.id ?? null;

    if (currentWorkspaceId) {
      if (previousId !== currentWorkspaceId) {
        emitWorkspaceChanged({ previousId, currentId: currentWorkspaceId, userId });
      }
    } else if (previousId) {
      // currentWorkspace just became null — could be logout, last-workspace deletion,
      // or the user lost their last membership. WorkspaceProvider's !user effect
      // distinguishes logout; this branch covers the other two.
      emitWorkspaceCleared({
        previousId,
        reason: !userId ? 'logout' : 'no-membership',
      });
    }

    previousWorkspaceIdRef.current = currentWorkspaceId ?? null;
  }, [currentWorkspaceId, user?.id]);

  // ---------------------------------------------------------------------------
  // Realtime subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!currentWorkspaceId) return;

    const channel = supabase
      .channel(`workspace_members:${currentWorkspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${currentWorkspaceId}` },
        () => { workspaceService.getMembers(currentWorkspaceId).then(setMembers); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentWorkspaceId]);

  // Watch this user's OWN membership rows across ALL workspaces. The above
  // subscription is scoped to the active workspace and will not fire when
  // the user is added to a NEW workspace (e.g. by accepting an invite),
  // leaving the workspace switcher stale until reload. This second channel
  // catches that case and refetches the workspace list.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`my_workspace_memberships:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_members', filter: `user_id=eq.${user.id}` },
        () => { loadWorkspaces(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // Stable user id only — see the init-effect note. Resubscribing the
    // realtime channel on every token refresh is both wasteful and a
    // reconnect-churn source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadWorkspaces]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const currentRole: WorkspaceMember['role'] | null = user
    ? (members.find((m) => m.user_id === user.id)?.role ?? null)
    : null;

  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const canManageMembers = isAdmin;

  // Catalog-backed permission check. Loads the permission matrix for the
  // current workspace once per workspace switch and derives a Set<key> of
  // permissions granted to the current role.
  const matrix = usePermissionMatrix(currentWorkspace?.id ?? null);
  const grantedPermissions = useMemo<Set<string>>(() => {
    if (!currentRole || matrix.isLoading || matrix.error) return new Set();
    const set = new Set<string>();
    for (const row of matrix.rows) {
      if (row.roles[currentRole]) set.add(row.key);
    }
    return set;
  }, [currentRole, matrix.rows, matrix.isLoading, matrix.error]);
  const hasPermission = useCallback(
    (key: string) => grantedPermissions.has(key),
    [grantedPermissions],
  );

  // ---------------------------------------------------------------------------
  // Actions (stable unless their deps change)
  // ---------------------------------------------------------------------------

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const target = workspaces.find((w) => w.id === workspaceId);
      if (!target) return;
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
      setCurrentWorkspace(target);
    },
    [workspaces],
  );

  const createWorkspace = useCallback(
    async (name: string, description?: string, plan?: WorkspacePlan): Promise<Workspace> => {
      const created = await workspaceService.createWorkspace(name, description, plan || 'team');
      setWorkspaces((prev) => [...prev, created]);
      setCurrentWorkspace(created);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, created.id);
      return created;
    },
    [],
  );

  const createChildWorkspace = useCallback(
    async (parentWorkspaceId: string, name: string, description?: string): Promise<Workspace> => {
      const created = await workspaceService.createChildWorkspace(parentWorkspaceId, name, description);
      setWorkspaces((prev) => [...prev, created]);
      setCurrentWorkspace(created);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, created.id);
      return created;
    },
    [],
  );

  const updateWorkspace = useCallback(
    async (
      workspaceId: string,
      updates: WorkspaceUpdatableFields,
    ): Promise<void> => {
      const updated = await workspaceService.updateWorkspace(workspaceId, updates);
      setWorkspaces((prev) => prev.map((w) => (w.id === workspaceId ? updated : w)));
      if (currentWorkspace?.id === workspaceId) setCurrentWorkspace(updated);
    },
    [currentWorkspace],
  );

  const refreshWorkspaces = useCallback(async (): Promise<void> => {
    const list = await loadWorkspaces();
    if (currentWorkspace && !list.find((w) => w.id === currentWorkspace.id)) {
      const fallback = list[0] ?? null;
      setCurrentWorkspace(fallback);
      if (fallback) localStorage.setItem(ACTIVE_WORKSPACE_KEY, fallback.id);
      else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  }, [loadWorkspaces, currentWorkspace]);

  const refreshMembers = useCallback(async (): Promise<void> => {
    if (!currentWorkspaceId) return;
    await loadMembers(currentWorkspaceId);
  }, [loadMembers, currentWorkspaceId]);

  const softDeleteWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    await workspaceService.softDeleteWorkspace(workspaceId);
    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    if (currentWorkspace?.id === workspaceId) {
      const remaining = workspaces.filter((w) => w.id !== workspaceId);
      const fallback = remaining[0] ?? null;
      setCurrentWorkspace(fallback);
      if (fallback) localStorage.setItem(ACTIVE_WORKSPACE_KEY, fallback.id);
      else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
    // Refresh deleted list
    const deleted = await workspaceService.getDeletedWorkspaces();
    setDeletedWorkspaces(deleted);
  }, [currentWorkspace, workspaces]);

  const hardDeleteWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    await workspaceService.hardDeleteWorkspace(workspaceId);
    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    setDeletedWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    if (currentWorkspace?.id === workspaceId) {
      const remaining = workspaces.filter((w) => w.id !== workspaceId);
      const fallback = remaining[0] ?? null;
      setCurrentWorkspace(fallback);
      if (fallback) localStorage.setItem(ACTIVE_WORKSPACE_KEY, fallback.id);
      else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    }
  }, [currentWorkspace, workspaces]);

  const restoreWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    await workspaceService.restoreWorkspace(workspaceId);
    setDeletedWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    // Refresh active workspaces
    const list = await loadWorkspaces();
    const restored = list.find((w) => w.id === workspaceId);
    if (restored && !currentWorkspace) {
      setCurrentWorkspace(restored);
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, restored.id);
    }
  }, [loadWorkspaces, currentWorkspace]);

  // ---------------------------------------------------------------------------
  // Focused context values — each only re-creates when its own slice changes
  // ---------------------------------------------------------------------------

  const dataValue = useMemo<WorkspaceDataContextType>(() => ({
    workspaces,
    currentWorkspace,
    members,
    currentRole,
    isLoading,
  }), [workspaces, currentWorkspace, members, currentRole, isLoading]);

  const actionsValue = useMemo<WorkspaceActionsContextType>(() => ({
    switchWorkspace,
    createWorkspace,
    createChildWorkspace,
    updateWorkspace,
    refreshWorkspaces,
    refreshMembers,
    softDeleteWorkspace,
    hardDeleteWorkspace,
    restoreWorkspace,
    deletedWorkspaces,
  }), [switchWorkspace, createWorkspace, createChildWorkspace, updateWorkspace, refreshWorkspaces, refreshMembers, softDeleteWorkspace, hardDeleteWorkspace, restoreWorkspace, deletedWorkspaces]);

  const permissionsValue = useMemo<WorkspacePermissionsContextType>(() => ({
    isOwner,
    isAdmin,
    canManageMembers,
    hasPermission,
  }), [isOwner, isAdmin, canManageMembers, hasPermission]);

  const mutationLockValue = useMemo<WorkspaceMutationLockContextType>(() => ({
    isMutating: mutationLockCount > 0,
    acquireMutationLock,
  }), [mutationLockCount, acquireMutationLock]);

  return (
    <WorkspaceDataContext.Provider value={dataValue}>
      <WorkspaceActionsContext.Provider value={actionsValue}>
        <WorkspacePermissionsContext.Provider value={permissionsValue}>
          <WorkspaceMutationLockContext.Provider value={mutationLockValue}>
            {children}
          </WorkspaceMutationLockContext.Provider>
        </WorkspacePermissionsContext.Provider>
      </WorkspaceActionsContext.Provider>
    </WorkspaceDataContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Focused hooks — subscribe only to the slice you need
// ---------------------------------------------------------------------------

export const useWorkspaceData = (): WorkspaceDataContextType => {
  const ctx = useContext(WorkspaceDataContext);
  if (ctx === undefined) throw new Error('useWorkspaceData must be used within a WorkspaceProvider');
  return ctx;
};

export const useWorkspaceActions = (): WorkspaceActionsContextType => {
  const ctx = useContext(WorkspaceActionsContext);
  if (ctx === undefined) throw new Error('useWorkspaceActions must be used within a WorkspaceProvider');
  return ctx;
};

export const useWorkspacePermissions = (): WorkspacePermissionsContextType => {
  const ctx = useContext(WorkspacePermissionsContext);
  if (ctx === undefined) throw new Error('useWorkspacePermissions must be used within a WorkspaceProvider');
  return ctx;
};

export const useWorkspaceMutationLock = (): WorkspaceMutationLockContextType => {
  const ctx = useContext(WorkspaceMutationLockContext);
  if (ctx === undefined) throw new Error('useWorkspaceMutationLock must be used within a WorkspaceProvider');
  return ctx;
};

// ---------------------------------------------------------------------------
// Backward-compat aggregated hook — existing consumers keep working unchanged
// ---------------------------------------------------------------------------

export const useWorkspace = (): WorkspaceContextType => ({
  ...useWorkspaceData(),
  ...useWorkspaceActions(),
  ...useWorkspacePermissions(),
});

// Keep legacy context export for any direct context consumers
export const WorkspaceContext = WorkspaceDataContext;

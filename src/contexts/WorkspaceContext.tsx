import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { workspaceService, Workspace, WorkspaceMember, WorkspacePlan } from '../services/workspaceService';
import { supabase } from '../services/supabase';

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
  updateWorkspace: (
    workspaceId: string,
    updates: Partial<Pick<Workspace, 'name' | 'description' | 'avatar_url' | 'slug'>>,
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

  // ---------------------------------------------------------------------------
  // Data fetching helpers
  // ---------------------------------------------------------------------------

  const loadWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    if (!user) return [];
    const fetched = await workspaceService.getUserWorkspaces(user.id);
    setWorkspaces(fetched);
    return fetched;
  }, [user]);

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
  }, [user, resolveActiveWorkspace]);

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

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const currentRole: WorkspaceMember['role'] | null = user
    ? (members.find((m) => m.user_id === user.id)?.role ?? null)
    : null;

  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const canManageMembers = isAdmin;

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
      const created = await workspaceService.createWorkspace(name, description, plan || 'free');
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
      updates: Partial<Pick<Workspace, 'name' | 'description' | 'avatar_url' | 'slug'>>,
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
    updateWorkspace,
    refreshWorkspaces,
    refreshMembers,
    softDeleteWorkspace,
    hardDeleteWorkspace,
    restoreWorkspace,
    deletedWorkspaces,
  }), [switchWorkspace, createWorkspace, updateWorkspace, refreshWorkspaces, refreshMembers, softDeleteWorkspace, hardDeleteWorkspace, restoreWorkspace, deletedWorkspaces]);

  const permissionsValue = useMemo<WorkspacePermissionsContextType>(() => ({
    isOwner,
    isAdmin,
    canManageMembers,
  }), [isOwner, isAdmin, canManageMembers]);

  return (
    <WorkspaceDataContext.Provider value={dataValue}>
      <WorkspaceActionsContext.Provider value={actionsValue}>
        <WorkspacePermissionsContext.Provider value={permissionsValue}>
          {children}
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

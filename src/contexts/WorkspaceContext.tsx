import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import { workspaceService, Workspace, WorkspaceMember } from '../services/workspaceService';
import { supabase } from '../services/supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVE_WORKSPACE_KEY  = 'pulse_active_workspace';
const PENDING_INVITE_KEY    = 'pulse_pending_invite_token';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

interface WorkspaceContextType {
  // State
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  members: WorkspaceMember[];
  currentRole: 'owner' | 'admin' | 'member' | 'viewer' | null;
  isLoading: boolean;

  // Actions
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  updateWorkspace: (
    workspaceId: string,
    updates: Partial<Pick<Workspace, 'name' | 'description' | 'avatar_url' | 'slug'>>,
  ) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshMembers: () => Promise<void>;

  // Helpers
  isOwner: boolean;
  isAdmin: boolean;
  canManageMembers: boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

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

  /**
   * Picks the workspace to make active after a workspaces load.
   * Preference order:
   *   1. The ID persisted in localStorage (if it still belongs to the user)
   *   2. The first workspace in the list
   *   3. null (the user has no workspaces)
   */
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
  // Initial load — triggered when the authenticated user becomes available
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
        // Auto-accept a pending invite if the user just logged in after
        // clicking an invite link (token saved by WorkspaceInviteAccept).
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

        const list = await workspaceService.getUserWorkspaces(user.id);
        if (cancelled) return;
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

    return () => {
      cancelled = true;
    };
  }, [user, resolveActiveWorkspace]);

  // ---------------------------------------------------------------------------
  // Load members whenever currentWorkspace changes
  // (skips the very first render — the init effect above handles that)
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

    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId]);

  // ---------------------------------------------------------------------------
  // Realtime subscription — refresh members on workspace_members changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!currentWorkspaceId) return;

    const channel = supabase
      .channel(`workspace_members:${currentWorkspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${currentWorkspaceId}`,
        },
        () => {
          // Re-fetch the full member list on any change so the UI stays consistent
          workspaceService.getMembers(currentWorkspaceId).then(setMembers);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
  // Public actions
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
    async (name: string, description?: string): Promise<Workspace> => {
      const created = await workspaceService.createWorkspace(name, description);
      // Optimistically add to list and switch to the new workspace
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
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? updated : w)),
      );
      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(updated);
      }
    },
    [currentWorkspace],
  );

  const refreshWorkspaces = useCallback(async (): Promise<void> => {
    const list = await loadWorkspaces();
    // If the currently active workspace is no longer in the list, fall back
    if (currentWorkspace && !list.find((w) => w.id === currentWorkspace.id)) {
      const fallback = list[0] ?? null;
      setCurrentWorkspace(fallback);
      if (fallback) {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, fallback.id);
      } else {
        localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      }
    }
  }, [loadWorkspaces, currentWorkspace]);

  const refreshMembers = useCallback(async (): Promise<void> => {
    if (!currentWorkspaceId) return;
    await loadMembers(currentWorkspaceId);
  }, [loadMembers, currentWorkspaceId]);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value: WorkspaceContextType = {
    workspaces,
    currentWorkspace,
    members,
    currentRole,
    isLoading,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    refreshWorkspaces,
    refreshMembers,
    isOwner,
    isAdmin,
    canManageMembers,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Provides access to the WorkspaceContext.
 * Must be used inside a <WorkspaceProvider>.
 */
export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

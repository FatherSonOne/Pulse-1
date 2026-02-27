import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  avatar_url: string | null;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invited_by: string | null;
  joined_at: string;
  // populated via join to pulse_users or auth
  name?: string;
  email?: string;
  avatar_url?: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that a Supabase response has no error, throwing if one is present.
 */
function assertNoError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[workspaceService] ${context}: ${error.message}`);
  }
}

/**
 * Returns the current authenticated user's ID, throwing if unauthenticated.
 */
async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  assertNoError(error, 'getUser');
  if (!data.user) {
    throw new Error('[workspaceService] No authenticated user');
  }
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const workspaceService = {
  /**
   * Returns all workspaces that the given user is a member of,
   * sorted by the time they joined (ascending).
   */
  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('joined_at, workspaces(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true });

    assertNoError(error, 'getUserWorkspaces');

    if (!data) return [];

    return data
      .map((row: { workspaces: Workspace | null }) => row.workspaces)
      .filter((w): w is Workspace => w !== null);
  },

  /**
   * Fetches a single workspace by its primary key.
   * Returns null when no matching workspace is found.
   */
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();

    assertNoError(error, 'getWorkspace');
    return data ?? null;
  },

  /**
   * Creates a new workspace owned by the currently authenticated user.
   * Automatically inserts the owner as a workspace_member with role 'owner'.
   */
  async createWorkspace(name: string, description?: string): Promise<Workspace> {
    const userId = await getCurrentUserId();

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name,
        description: description ?? null,
        owner_id: userId,
      })
      .select()
      .single();

    assertNoError(workspaceError, 'createWorkspace — insert workspace');

    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
        invited_by: null,
      });

    assertNoError(memberError, 'createWorkspace — insert owner member');

    return workspace as Workspace;
  },

  /**
   * Applies a partial update to a workspace and returns the updated record.
   */
  async updateWorkspace(
    workspaceId: string,
    updates: Partial<Pick<Workspace, 'name' | 'description' | 'avatar_url' | 'slug'>>,
  ): Promise<Workspace> {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', workspaceId)
      .select()
      .single();

    assertNoError(error, 'updateWorkspace');
    return data as Workspace;
  },

  /**
   * Deletes a workspace. Related workspace_members rows should be removed
   * by a cascade constraint on the database.
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);

    assertNoError(error, 'deleteWorkspace');
  },

  /**
   * Returns all members of the workspace. Attempts to enrich each member
   * with display_name and avatar_url from the pulse_users table via a
   * left join. Falls back to raw member rows if the join is unavailable.
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    // NOTE: pulse_users.user_id is TEXT (not a UUID FK), so PostgREST relational
    // join syntax cannot be used here. Fetch members directly; name/avatar
    // enrichment can be added later via an RPC if needed.
    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role, invited_by, joined_at')
      .eq('workspace_id', workspaceId);

    assertNoError(error, 'getMembers');
    return (data ?? []) as WorkspaceMember[];
  },

  /**
   * Creates a pending invite for the given email address and role.
   * The token is a random UUID generated by the database default.
   * Invites expire in 7 days.
   */
  async inviteMember(
    workspaceId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer',
  ): Promise<WorkspaceInvite> {
    const userId = await getCurrentUserId();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        invited_by: userId,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    assertNoError(error, 'inviteMember');
    return data as WorkspaceInvite;
  },

  /**
   * Accepts an invite identified by its unique token.
   * Validates that the invite has not already been accepted and has not expired.
   * Adds the current user to workspace_members and marks the invite as accepted.
   */
  async acceptInvite(token: string): Promise<void> {
    const userId = await getCurrentUserId();

    // Look up the invite
    const { data: invite, error: lookupError } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    assertNoError(lookupError, 'acceptInvite — lookup');

    if (!invite) {
      throw new Error('[workspaceService] acceptInvite: invite not found');
    }
    if (invite.accepted_at !== null) {
      throw new Error('[workspaceService] acceptInvite: invite has already been accepted');
    }
    if (new Date(invite.expires_at) < new Date()) {
      throw new Error('[workspaceService] acceptInvite: invite has expired');
    }

    // Add the user as a member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: userId,
        role: invite.role,
        invited_by: invite.invited_by,
      });

    assertNoError(memberError, 'acceptInvite — insert member');

    // Mark the invite as accepted
    const { error: updateError } = await supabase
      .from('workspace_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    assertNoError(updateError, 'acceptInvite — mark accepted');
  },

  /**
   * Updates the role of an existing workspace member.
   * The 'owner' role cannot be assigned through this method; use a dedicated
   * ownership-transfer flow if that is required.
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: 'admin' | 'member' | 'viewer',
  ): Promise<void> {
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .neq('role', 'owner'); // guard: never overwrite the owner role

    assertNoError(error, 'updateMemberRole');
  },

  /**
   * Removes a member from a workspace.
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    assertNoError(error, 'removeMember');
  },

  /**
   * Returns pending (not yet accepted, not yet expired) invites for a workspace.
   */
  async getPendingInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    assertNoError(error, 'getPendingInvites');
    return (data ?? []) as WorkspaceInvite[];
  },

  /**
   * Returns the role of the given user within the workspace, or null if the
   * user is not a member.
   */
  async getUserRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember['role'] | null> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    assertNoError(error, 'getUserRole');
    return data?.role ?? null;
  },
};

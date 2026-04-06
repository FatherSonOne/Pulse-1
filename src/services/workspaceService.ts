import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspacePlan = 'free' | 'starter' | 'pro' | 'business' | 'ecosystem';

export const WORKSPACE_PLAN_LABELS: Record<WorkspacePlan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  ecosystem: 'Ecosystem',
};

export const WORKSPACE_PLAN_LIMITS: Record<WorkspacePlan, number> = {
  free: 50,
  starter: 500,
  pro: 5000,
  business: 15000,
  ecosystem: 25000,
};

export const SELF_SERVICE_PLANS: WorkspacePlan[] = ['free', 'starter', 'pro', 'business', 'ecosystem'];

export const WORKSPACE_PLAN_DESCRIPTIONS: Record<WorkspacePlan, string> = {
  free: 'Try it out with basic features',
  starter: 'For small teams getting started',
  pro: 'For growing organizations',
  business: 'For established organizations with advanced needs',
  ecosystem: 'Full suite: Pulse + Logos Vision + Entomate',
};

export const WORKSPACE_PLAN_APPS: Record<WorkspacePlan, string[]> = {
  free: ['Pulse'],
  starter: ['Pulse'],
  pro: ['Pulse'],
  business: ['Pulse'],
  ecosystem: ['Pulse', 'Logos Vision', 'Entomate'],
};

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  avatar_url: string | null;
  plan: WorkspacePlan;
  owner_id: string;
  created_at: string;
  updated_at: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
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
  async createWorkspace(name: string, description?: string, plan: WorkspacePlan = 'free'): Promise<Workspace> {
    const userId = await getCurrentUserId();

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name,
        description: description ?? null,
        owner_id: userId,
        plan,
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
    options?: { inviterName?: string; workspaceName?: string; personalMessage?: string },
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

    const invite = data as WorkspaceInvite;

    // Send invite email best-effort
    try {
      await this._sendInviteEmail(
        email,
        invite.token,
        options?.workspaceName ?? 'your workspace',
        options?.inviterName,
        options?.personalMessage,
      );
    } catch (emailErr) {
      console.warn('[workspaceService] invite email failed (non-fatal):', emailErr);
    }

    return invite;
  },

  /** Sends the invite notification email via the send-email edge function. */
  async _sendInviteEmail(
    toEmail: string,
    token: string,
    workspaceName: string,
    inviterName?: string,
    personalMessage?: string,
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const inviteUrl = `${window.location.origin}/invite?token=${encodeURIComponent(token)}`;
    const fromName = inviterName || 'A teammate';

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 0">
        <div style="text-align:center;margin-bottom:28px">
          <div style="display:inline-block;padding:10px 20px;background:linear-gradient(135deg,#f43f5e,#ec4899);border-radius:12px">
            <span style="color:#fff;font-weight:700;font-size:20px;letter-spacing:0.5px">Pulse</span>
          </div>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;text-align:center">
          <h2 style="margin:0 0 8px;font-size:20px;color:#18181b">You're invited!</h2>
          <p style="margin:0 0 20px;color:#71717a;font-size:14px">
            ${fromName} invited you to join <strong>${workspaceName}</strong> on Pulse.
          </p>
          ${personalMessage ? `<p style="margin:0 0 20px;color:#52525b;font-size:13px;font-style:italic;background:#f4f4f5;border-radius:8px;padding:12px">"${personalMessage}"</p>` : ''}
          <a href="${inviteUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#f43f5e,#ec4899);color:#fff;font-weight:600;font-size:14px;text-decoration:none;border-radius:10px;box-shadow:0 4px 12px rgba(244,63,94,0.3)">
            Accept Invitation
          </a>
          <p style="margin:20px 0 0;color:#a1a1aa;font-size:12px">This invite expires in 7 days.</p>
        </div>
      </div>
    `;

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        to: toEmail,
        subject: `${fromName} invited you to ${workspaceName} on Pulse`,
        html,
      }),
    });
  },

  /**
   * Accepts an invite identified by its unique token.
   * Validates that the invite has not already been accepted and has not expired.
   * Adds the current user to workspace_members and marks the invite as accepted.
   */
  /**
   * Accepts a workspace invite via the accept_workspace_invite RPC function.
   * The RPC runs as SECURITY DEFINER so it can insert the member row without
   * the caller needing existing membership. Returns the workspace_id on success.
   */
  async acceptInvite(token: string): Promise<string> {
    const { data, error } = await supabase.rpc('accept_workspace_invite', { p_token: token });

    assertNoError(error, 'acceptInvite — rpc');

    const result = data as { success: boolean; workspace_id?: string; role?: string; error?: string };
    if (!result.success) {
      throw new Error(`[workspaceService] acceptInvite: ${result.error}`);
    }

    return result.workspace_id!;
  },

  /**
   * Returns the shareable invite link URL for a given invite token.
   */
  getInviteLink(token: string): string {
    return `${window.location.origin}/invite?token=${encodeURIComponent(token)}`;
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

  // -------------------------------------------------------------------------
  // Workspace deletion & recovery
  // -------------------------------------------------------------------------

  /**
   * Soft-deletes a workspace (30-day recovery window).
   * Callable by owner or admin.
   */
  async softDeleteWorkspace(workspaceId: string): Promise<void> {
    const { error } = await supabase.rpc('soft_delete_workspace', {
      p_workspace_id: workspaceId,
    });
    assertNoError(error, 'softDeleteWorkspace');
  },

  /**
   * Permanently deletes a workspace and all associated data.
   * Owner-only.
   */
  async hardDeleteWorkspace(workspaceId: string): Promise<void> {
    const { error } = await supabase.rpc('hard_delete_workspace', {
      p_workspace_id: workspaceId,
    });
    assertNoError(error, 'hardDeleteWorkspace');
  },

  /**
   * Restores a soft-deleted workspace within the 30-day recovery window.
   * Owner-only.
   */
  async restoreWorkspace(workspaceId: string): Promise<void> {
    const { error } = await supabase.rpc('restore_workspace', {
      p_workspace_id: workspaceId,
    });
    assertNoError(error, 'restoreWorkspace');
  },

  /**
   * Returns soft-deleted workspaces owned by the current user.
   * Uses the workspaces_select_deleted RLS policy.
   */
  async getDeletedWorkspaces(): Promise<Workspace[]> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', userId)
      .not('deleted_at', 'is', null);

    assertNoError(error, 'getDeletedWorkspaces');
    return (data ?? []) as Workspace[];
  },
};

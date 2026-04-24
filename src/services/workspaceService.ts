import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspacePlan = 'free' | 'team' | 'starter' | 'pro' | 'business' | 'ecosystem';

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

export const WORKSPACE_PLAN_PRICES: Record<WorkspacePlan, string> = {
  free: '$0',
  starter: '$79/mo',
  pro: '$149/mo',
  business: '$249/mo',
  ecosystem: 'From $139/mo',
};

export const WORKSPACE_PLAN_COLORS: Record<WorkspacePlan, string> = {
  free: '#6b7280',
  starter: '#3b82f6',
  pro: '#f43f5e',
  business: '#7c3aed',
  ecosystem: '#10b981',
};

export type OrgOnboardingStep = 'pending' | 'named' | 'complete';
export type OrgSizeBucket = '1-10' | '11-50' | '51-200' | '200+';
export type SessionTimeoutMinutes = 0 | 60 | 480 | 1440 | 10080;

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
  // Organization profile (UI: "Organization", DB: workspaces)
  onboarding_step: OrgOnboardingStep;
  auto_join_domain: string | null;
  auto_join_enabled: boolean;
  legal_name: string | null;
  billing_email: string | null;
  industry: string | null;
  size_bucket: OrgSizeBucket | null;
  // Security policy
  enforce_2fa: boolean;
  session_timeout_minutes: SessionTimeoutMinutes;
  ip_allowlist: string[];
}

export type WorkspaceUpdatableFields = Partial<Pick<
  Workspace,
  | 'name'
  | 'description'
  | 'avatar_url'
  | 'slug'
  | 'onboarding_step'
  | 'auto_join_domain'
  | 'auto_join_enabled'
  | 'legal_name'
  | 'billing_email'
  | 'industry'
  | 'size_bucket'
  | 'enforce_2fa'
  | 'session_timeout_minutes'
  | 'ip_allowlist'
>>;

export interface SignInActivityEntry {
  session_id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  device_name: string | null;
  device_type: string | null;
  browser_name: string | null;
  os_name: string | null;
  ip_address: string | null;
  location: string | null;
  is_active: boolean;
  is_current: boolean;
  last_active_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invited_by: string | null;
  joined_at: string;
  // populated via get_enriched_workspace_members RPC
  name?: string;
  email?: string;
  avatar_url?: string;
  handle?: string;
}

export interface AuditLogEntry {
  id: number;
  workspace_id: string;
  actor_id: string;
  action: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
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
  async createWorkspace(name: string, description?: string, plan: WorkspacePlan = 'team'): Promise<Workspace> {
    const userId = await getCurrentUserId();

    // Auto-generate a URL-safe slug from the name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'workspace';
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name,
        slug,
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

    // Start a 30-day Pulse Team trial. Non-fatal if it fails (RPC is idempotent
    // and can be retried manually). Done lazily via import to avoid circular deps.
    try {
      const billingService = (await import('./billingService')).default;
      await billingService.startPulseTeamTrial(workspace.id);
    } catch (e) {
      console.warn('[workspaceService] Could not start Pulse Team trial:', e);
    }

    return workspace as Workspace;
  },

  /**
   * Applies a partial update to a workspace and returns the updated record.
   */
  async updateWorkspace(
    workspaceId: string,
    updates: WorkspaceUpdatableFields,
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
   * Returns all members of the workspace enriched with display_name,
   * avatar_url, email, and handle from user_profiles + auth.users via
   * the get_enriched_workspace_members RPC.
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await supabase.rpc('get_enriched_workspace_members', {
      p_workspace_id: workspaceId,
    });

    assertNoError(error, 'getMembers');

    return ((data ?? []) as Array<{
      workspace_id: string;
      user_id: string;
      role: WorkspaceMember['role'];
      invited_by: string | null;
      joined_at: string;
      display_name: string | null;
      full_name: string | null;
      avatar_url: string | null;
      email: string | null;
      handle: string | null;
    }>).map((row) => ({
      workspace_id: row.workspace_id,
      user_id: row.user_id,
      role: row.role,
      invited_by: row.invited_by,
      joined_at: row.joined_at,
      name: row.display_name || row.full_name || undefined,
      email: row.email || undefined,
      avatar_url: row.avatar_url || undefined,
      handle: row.handle || undefined,
    }));
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

    // Enforce member limit for the workspace plan
    const workspace = await this.getWorkspace(workspaceId);
    const limit = WORKSPACE_PLAN_LIMITS[workspace.plan] ?? 50;
    const [members, pendingInvites] = await Promise.all([
      this.getMembers(workspaceId),
      this.getPendingInvites(workspaceId),
    ]);
    const currentCount = members.length + pendingInvites.length;
    if (currentCount >= limit) {
      throw new Error(
        `This workspace has reached its ${WORKSPACE_PLAN_LABELS[workspace.plan]} plan limit of ${limit} members. Upgrade your plan to add more.`,
      );
    }

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

    // Push the new seat count to Stripe. Non-fatal — billingService.syncSeats
    // swallows errors so a flaky Stripe call never blocks joining a workspace.
    try {
      const billing = (await import('./billingService')).default;
      await billing.syncSeats(result.workspace_id!);
    } catch (e) {
      console.warn('[workspaceService] acceptInvite — seat sync failed:', e);
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

    // Decrement the Stripe seat count. Fire-and-forget; billingService swallows errors.
    try {
      const billing = (await import('./billingService')).default;
      await billing.syncSeats(workspaceId);
    } catch (e) {
      console.warn('[workspaceService] removeMember — seat sync failed:', e);
    }
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

  // -------------------------------------------------------------------------
  // Activity indicators
  // -------------------------------------------------------------------------

  /**
   * Returns total unread message count across all channels in a workspace.
   */
  async getUnreadCount(workspaceId: string, userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_workspace_unread_count', {
      p_workspace_id: workspaceId,
      p_user_id: userId,
    });
    if (error) {
      console.warn('[workspaceService] getUnreadCount failed:', error.message);
      return 0;
    }
    return (data as number) ?? 0;
  },

  // -------------------------------------------------------------------------
  // Ownership transfer
  // -------------------------------------------------------------------------

  /**
   * Transfers workspace ownership to another member.
   * The current owner is demoted to admin; the target becomes owner.
   * Owner-only.
   */
  async transferOwnership(workspaceId: string, newOwnerId: string): Promise<void> {
    const { data, error } = await supabase.rpc('transfer_workspace_ownership', {
      p_workspace_id: workspaceId,
      p_new_owner_id: newOwnerId,
    });

    assertNoError(error, 'transferOwnership — rpc');

    const result = data as { success: boolean; error?: string };
    if (!result.success) {
      throw new Error(`[workspaceService] transferOwnership: ${result.error}`);
    }
  },

  // -------------------------------------------------------------------------
  // Audit log
  // -------------------------------------------------------------------------

  /**
   * Writes an entry to the workspace audit log via SECURITY DEFINER RPC.
   */
  async writeAuditLog(
    workspaceId: string,
    action: string,
    targetId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const userId = await getCurrentUserId();
    const { error } = await supabase.rpc('write_workspace_audit', {
      p_workspace_id: workspaceId,
      p_actor_id: userId,
      p_action: action,
      p_target_id: targetId ?? null,
      p_metadata: metadata ?? {},
    });
    if (error) console.warn('[workspaceService] writeAuditLog failed (non-fatal):', error.message);
  },

  // -------------------------------------------------------------------------
  // Security — sign-in activity
  // -------------------------------------------------------------------------

  /**
   * Returns recent sign-in activity for all members of a workspace.
   * Owner/admin only (enforced inside the RPC).
   */
  async getSignInActivity(workspaceId: string, limit = 50): Promise<SignInActivityEntry[]> {
    const { data, error } = await supabase.rpc('get_workspace_sign_in_activity', {
      p_workspace_id: workspaceId,
      p_limit: limit,
    });
    assertNoError(error, 'getSignInActivity');
    return (data ?? []) as SignInActivityEntry[];
  },

  /**
   * Returns recent audit log entries for a workspace.
   * Admin+ only (enforced by RLS).
   */
  async getAuditLog(workspaceId: string, limit = 50): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('workspace_audit_log')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    assertNoError(error, 'getAuditLog');
    return (data ?? []) as AuditLogEntry[];
  },
};

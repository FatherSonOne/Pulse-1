import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspacePlan = 'free' | 'team' | 'growth' | 'starter' | 'pro' | 'business' | 'ecosystem';

// NOTE: Pulse runs two live tiers — 'team' ($100/mo) and 'growth' ($300/mo).
// The legacy keys (free/starter/pro/business/ecosystem) remain only to keep
// historical workspace.plan rows readable; they are not user-selectable.

export const WORKSPACE_PLAN_LABELS: Record<WorkspacePlan, string> = {
  free: 'Free',
  team: 'Team',
  growth: 'Growth',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  ecosystem: 'Ecosystem',
};

export const WORKSPACE_PLAN_LIMITS: Record<WorkspacePlan, number> = {
  free: 50,
  team: 1_000_000,
  growth: 1_000_000,
  starter: 500,
  pro: 5000,
  business: 15000,
  ecosystem: 25000,
};

export const WORKSPACE_PLAN_DESCRIPTIONS: Record<WorkspacePlan, string> = {
  free: 'Try it out with basic features',
  team: 'Pulse Team — unlimited seats, all features',
  growth: 'Pulse Growth — 5× capacity, SSO, API, audit retention, priority support',
  starter: 'For small teams getting started',
  pro: 'For growing organizations',
  business: 'For established organizations with advanced needs',
  ecosystem: 'Full suite: Pulse + Logos Vision + Entomate',
};

export const WORKSPACE_PLAN_APPS: Record<WorkspacePlan, string[]> = {
  free: ['Pulse'],
  team: ['Pulse'],
  growth: ['Pulse'],
  starter: ['Pulse'],
  pro: ['Pulse'],
  business: ['Pulse'],
  ecosystem: ['Pulse', 'Logos Vision', 'Entomate'],
};

export const WORKSPACE_PLAN_PRICES: Record<WorkspacePlan, string> = {
  free: '$0',
  team: '$100/mo',
  growth: '$300/mo',
  starter: '$79/mo',
  pro: '$149/mo',
  business: '$249/mo',
  ecosystem: 'From $139/mo',
};

export const WORKSPACE_PLAN_COLORS: Record<WorkspacePlan, string> = {
  free: '#6b7280',
  team: '#f43f5e',
  growth: '#7c3aed',
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
  parent_workspace_id: string | null;
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
  // Compliance
  legal_hold: boolean;
  // Billing
  billing_contacts: string[];
  tax_id_type: string | null;
  tax_id_value: string | null;
  // AI policy
  ai_allowed_providers: { openai?: boolean; anthropic?: boolean; google?: boolean } & Record<string, boolean | undefined>;
  ai_pii_masking_enforced: boolean;
  ai_output_retention_days: 0 | 7 | 30 | 90 | 365;
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
  | 'legal_hold'
  | 'billing_contacts'
  | 'tax_id_type'
  | 'tax_id_value'
  | 'ai_allowed_providers'
  | 'ai_pii_masking_enforced'
  | 'ai_output_retention_days'
>>;

export interface WorkspaceGroup {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  member_count?: number;
}

export interface WorkspaceGroupMember {
  group_id: string;
  user_id: string;
  added_at: string;
  added_by: string | null;
}

export interface GroupGrant {
  id: string;
  group_id: string;
  permission_key: string;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
  created_by: string | null;
}

export type IntegrationKey =
  | 'slack' | 'gmail' | 'google_calendar' | 'google_drive'
  | 'microsoft' | 'twilio' | 'zapier';

export type IntegrationScope = 'per_user' | 'shared';

export interface WorkspaceIntegration {
  id: string;
  workspace_id: string;
  integration_key: IntegrationKey;
  scope: IntegrationScope;
  is_enabled: boolean;
  shared_config: Record<string, unknown>;
  connected_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberConnectionRow {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_avatar_url: string | null;
  user_role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  providers: string[];
  app_count: number;
  last_connected_at: string | null;
}

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

/**
 * Result of an invite send attempt. Returned by `inviteMember`.
 * `emailDelivery.ok = false` means the row was created/refreshed in the DB
 * but the notification email could not be sent — the UI should warn the
 * inviter and let them copy the invite link manually as a fallback.
 */
export interface InviteResult {
  invite: WorkspaceInvite;
  isResend: boolean;
  emailDelivery: { ok: boolean; reason?: string };
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
// Members cache
// ---------------------------------------------------------------------------
// get_enriched_workspace_members is a moderately heavy RPC (joins pulse_users +
// auth.users) called by every assignee dropdown / member list. Membership
// changes rarely, so a short TTL cache + in-flight dedupe collapses repeated
// mounts and render bursts into one round-trip. Mutations invalidate explicitly;
// the TTL bounds any missed invalidation to a few seconds.
const MEMBERS_CACHE_TTL_MS = 30_000;
const _membersCache = new Map<string, { at: number; members: WorkspaceMember[] }>();
const _membersInflight = new Map<string, Promise<WorkspaceMember[]>>();
function invalidateMembersCache(workspaceId: string) {
  _membersCache.delete(workspaceId);
  _membersInflight.delete(workspaceId);
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
   * Creates a new primary (billed) workspace owned by the currently authenticated user.
   * The workspaces row and the owner workspace_members row are written together in the
   * bootstrap_workspace SECURITY DEFINER RPC's single plpgsql transaction, so a
   * partial-creation orphan can't happen. Then starts a 30-day Pulse Team trial; if
   * that fails, the workspace is hard-deleted (FK CASCADE removes the member row).
   *
   * Used for first-time users only — additional workspaces under an existing owner
   * go through `createChildWorkspace`.
   */
  async createWorkspace(name: string, description?: string, plan: WorkspacePlan = 'team'): Promise<Workspace> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'workspace';
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const { data: workspaceId, error: rpcError } = await supabase.rpc('bootstrap_workspace', {
      p_name:        name,
      p_slug:        slug,
      p_description: description ?? null,
      p_plan:        plan,
    });

    assertNoError(rpcError, 'createWorkspace — bootstrap_workspace RPC');

    if (!workspaceId) {
      throw new Error('[workspaceService] createWorkspace: RPC returned no workspace id');
    }

    // Fetch the just-created row to return the full Workspace shape. RLS allows
    // this because the bootstrap RPC has already inserted the caller as the owner.
    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    assertNoError(fetchError, 'createWorkspace — fetch new workspace row');

    // Start the 30-day trial. On failure, hard-delete the workspace; FK CASCADE
    // takes the workspace_members row with it, so a single DELETE is the rollback.
    try {
      const billingService = (await import('./billingService')).default;
      await billingService.startPulseTeamTrial(workspaceId as string);
    } catch (e) {
      console.error('[workspaceService] startPulseTeamTrial failed; rolling back workspace', e);
      try {
        await supabase.from('workspaces').delete().eq('id', workspaceId);
      } catch (rollbackErr) {
        console.error('[workspaceService] Rollback also failed', rollbackErr);
      }
      throw new Error(
        e instanceof Error
          ? `Could not start your trial: ${e.message}`
          : 'Could not start your trial. Please try again.',
      );
    }

    return workspace as Workspace;
  },

  /**
   * Creates a child workspace under a primary, sharing the parent's plan and
   * entitlements without its own subscription. Owner-only. Used when an org
   * owner wants to spin up additional sub-contexts (Development, Project, etc.)
   * inside their existing paid org.
   */
  async createChildWorkspace(parentWorkspaceId: string, name: string, description?: string): Promise<Workspace> {
    const { data, error } = await supabase.rpc('create_child_workspace', {
      p_parent_id: parentWorkspaceId,
      p_name: name,
      p_description: description ?? null,
    });

    assertNoError(error, 'createChildWorkspace');

    if (!data) {
      throw new Error('createChildWorkspace returned no workspace');
    }

    return data as Workspace;
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
  async getMembers(workspaceId: string, opts?: { force?: boolean }): Promise<WorkspaceMember[]> {
    const now = Date.now();
    if (!opts?.force) {
      const cached = _membersCache.get(workspaceId);
      if (cached && now - cached.at < MEMBERS_CACHE_TTL_MS) return cached.members;
      const inflight = _membersInflight.get(workspaceId);
      if (inflight) return inflight;
    }

    const fetchPromise = (async () => {
      const { data, error } = await supabase.rpc('get_enriched_workspace_members', {
        p_workspace_id: workspaceId,
      });

      assertNoError(error, 'getMembers');

      const members = ((data ?? []) as Array<{
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

      _membersCache.set(workspaceId, { at: Date.now(), members });
      return members;
    })();

    _membersInflight.set(workspaceId, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      _membersInflight.delete(workspaceId);
    }
  },

  /**
   * Creates or refreshes a pending invite for the given email + role and
   * sends the notification email. Behavior on conflict:
   *  - email already a member of the workspace → throws
   *  - existing invite already accepted → throws (the (workspace_id,email)
   *    unique key would otherwise produce a confusing 409)
   *  - existing invite still pending or already expired → updates role +
   *    refreshes expires_at on the existing row (token is preserved so any
   *    previously-shared link still works) and re-sends the email
   *  - no existing row → inserts a new one
   *
   * Returns an InviteResult so the caller can surface email-send failures
   * to the user (Resend errors, missing API key, unverified domain, etc.)
   * without the invite row creation appearing to fail.
   */
  async inviteMember(
    workspaceId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer',
    options?: { inviterName?: string; workspaceName?: string; personalMessage?: string },
  ): Promise<InviteResult> {
    const userId = await getCurrentUserId();
    const normalizedEmail = email.trim().toLowerCase();

    // Enforce member limit for the workspace plan
    const workspace = await this.getWorkspace(workspaceId);
    const limit = WORKSPACE_PLAN_LIMITS[workspace.plan] ?? 50;
    const [members, pendingInvites] = await Promise.all([
      this.getMembers(workspaceId),
      this.getPendingInvites(workspaceId),
    ]);

    if (members.some(m => m.email?.toLowerCase() === normalizedEmail)) {
      throw new Error(`${normalizedEmail} is already a member of this workspace.`);
    }

    // Look up any existing invite row for (workspace_id, email) — pending,
    // expired, or accepted. The unique constraint means there is at most one.
    const { data: existing, error: lookupErr } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('email', normalizedEmail)
      .maybeSingle();
    assertNoError(lookupErr, 'inviteMember — existing-invite lookup');

    if (existing && (existing as WorkspaceInvite).accepted_at) {
      throw new Error(`${normalizedEmail} has already accepted an invite to this workspace.`);
    }

    // Capacity check counts the existing pending invite as already-occupying
    // a seat, so refresh-paths don't trip the limit.
    const occupiedSeats =
      members.length +
      (existing && !(existing as WorkspaceInvite).accepted_at
        ? pendingInvites.length
        : pendingInvites.length + 1);
    if (occupiedSeats > limit) {
      throw new Error(
        `This workspace has reached its ${WORKSPACE_PLAN_LABELS[workspace.plan]} plan limit of ${limit} members. Upgrade your plan to add more.`,
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    let invite: WorkspaceInvite;
    let isResend = false;

    if (existing) {
      // Refresh the pending/expired row in place — preserve token so any
      // previously-shared link keeps working.
      const { data, error } = await supabase
        .from('workspace_invites')
        .update({
          role,
          invited_by: userId,
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', (existing as WorkspaceInvite).id)
        .select()
        .single();
      assertNoError(error, 'inviteMember — refresh existing');
      invite = data as WorkspaceInvite;
      isResend = true;
    } else {
      const { data, error } = await supabase
        .from('workspace_invites')
        .insert({
          workspace_id: workspaceId,
          email: normalizedEmail,
          role,
          invited_by: userId,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();
      assertNoError(error, 'inviteMember');
      invite = data as WorkspaceInvite;
    }

    const emailDelivery = await this._sendInviteEmail(
      normalizedEmail,
      invite.token,
      options?.workspaceName ?? 'your workspace',
      options?.inviterName,
      options?.personalMessage,
    );

    if (!emailDelivery.ok) {
      console.warn('[workspaceService] invite email failed:', emailDelivery.reason);
    }

    return { invite, isResend, emailDelivery };
  },

  /**
   * Sends the invite notification email via the send-email edge function.
   * Never throws — returns a delivery result so the caller can surface
   * problems (missing edge function, Resend not configured, unverified
   * sender domain, etc.) without aborting the invite-row creation.
   */
  async _sendInviteEmail(
    toEmail: string,
    token: string,
    workspaceName: string,
    inviterName?: string,
    personalMessage?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, reason: 'Not signed in' };

    // Invite emails are delivered to external recipients — they cannot reach
    // localhost or any dev origin. Always use the canonical public URL so the
    // link resolves in the recipient's browser regardless of where the invite
    // was sent from. Mirrors inviteService.sendInvitationViaGmail.
    const PUBLIC_APP_URL = 'https://pulse.logosvision.org';
    const inviteUrl = `${PUBLIC_APP_URL}/invite?token=${encodeURIComponent(token)}`;
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
    if (!SUPABASE_URL) return { ok: false, reason: 'VITE_SUPABASE_URL not set' };

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
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

      const body = await resp.json().catch(() => ({} as { ok?: boolean; error?: string }));

      if (!resp.ok || body?.ok === false) {
        return {
          ok: false,
          reason: body?.error || `HTTP ${resp.status}`,
        };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
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
    // now queues a billing_drift_log entry on failure instead of silently
    // swallowing, so the daily reconciler will pick up any drift.
    try {
      const billing = (await import('./billingService')).default;
      await billing.syncSeats(result.workspace_id!, 'accept_invite');
    } catch (e) {
      // Only reachable if the dynamic import itself blew up (very rare);
      // syncSeats already catches its own errors and queues drift internally.
      console.warn('[workspaceService] acceptInvite — billingService import failed:', e);
    }

    return result.workspace_id!;
  },

  /**
   * Returns the shareable invite link URL for a given invite token.
   */
  getInviteLink(token: string): string {
    // Shareable invite links are pasted into email/Slack/SMS for external
    // recipients, so they must always point at the public production URL
    // even when generated from a dev environment.
    return `https://pulse.logosvision.org/invite?token=${encodeURIComponent(token)}`;
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
    invalidateMembersCache(workspaceId);
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
    invalidateMembersCache(workspaceId);

    // Decrement the Stripe seat count. billingService.syncSeats queues a
    // billing_drift_log entry on failure so the reconciler picks it up.
    try {
      const billing = (await import('./billingService')).default;
      await billing.syncSeats(workspaceId, 'remove_member');
    } catch (e) {
      // Only reachable if the dynamic import itself failed.
      console.warn('[workspaceService] removeMember — billingService import failed:', e);
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
  // Groups / departments
  // -------------------------------------------------------------------------

  /**
   * Returns all groups in a workspace, with member counts.
   * Visible to any workspace member (RLS-enforced).
   */
  async getGroups(workspaceId: string): Promise<WorkspaceGroup[]> {
    const [{ data: groups, error: groupsErr }, { data: counts, error: countsErr }] = await Promise.all([
      supabase
        .from('workspace_groups')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name', { ascending: true }),
      supabase
        .from('workspace_group_members')
        .select('group_id'),
    ]);

    assertNoError(groupsErr, 'getGroups — groups');
    assertNoError(countsErr, 'getGroups — counts');

    const countByGroup = new Map<string, number>();
    for (const row of (counts ?? []) as Array<{ group_id: string }>) {
      countByGroup.set(row.group_id, (countByGroup.get(row.group_id) ?? 0) + 1);
    }

    return ((groups ?? []) as WorkspaceGroup[]).map(g => ({
      ...g,
      member_count: countByGroup.get(g.id) ?? 0,
    }));
  },

  /**
   * Returns the user_ids of every member in a given group.
   */
  async getGroupMembers(groupId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('workspace_group_members')
      .select('user_id')
      .eq('group_id', groupId);

    assertNoError(error, 'getGroupMembers');
    return ((data ?? []) as Array<{ user_id: string }>).map(r => r.user_id);
  },

  /**
   * Creates a new group within a workspace. Admin+ only (RLS-enforced).
   */
  async createGroup(
    workspaceId: string,
    name: string,
    description?: string | null,
    color?: string | null,
  ): Promise<WorkspaceGroup> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('workspace_groups')
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
        created_by: userId,
      })
      .select()
      .single();

    assertNoError(error, 'createGroup');
    return data as WorkspaceGroup;
  },

  async updateGroup(
    groupId: string,
    updates: Partial<Pick<WorkspaceGroup, 'name' | 'description' | 'color'>>,
  ): Promise<WorkspaceGroup> {
    const { data, error } = await supabase
      .from('workspace_groups')
      .update(updates)
      .eq('id', groupId)
      .select()
      .single();

    assertNoError(error, 'updateGroup');
    return data as WorkspaceGroup;
  },

  async deleteGroup(groupId: string): Promise<void> {
    const { error } = await supabase
      .from('workspace_groups')
      .delete()
      .eq('id', groupId);

    assertNoError(error, 'deleteGroup');
  },

  async addGroupMember(groupId: string, userId: string): Promise<void> {
    const actorId = await getCurrentUserId();
    const { error } = await supabase
      .from('workspace_group_members')
      .insert({ group_id: groupId, user_id: userId, added_by: actorId });

    assertNoError(error, 'addGroupMember');
  },

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('workspace_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    assertNoError(error, 'removeGroupMember');
  },

  // -------------------------------------------------------------------------
  // Group grants — workspace-wide permission assignments to groups.
  //
  // First consumer of the public.group_grants table (added in Sub-PR 5,
  // migration 20260522000000_permissions_group_grants.sql). This pass ships
  // workspace-wide grants only — resource-scoped grants (resource_type +
  // resource_id NOT NULL) are deferred until a feature surface exists that
  // needs them.
  //
  // NOTE: client-side hasPermission() on WorkspaceContext is matrix-only and
  // does NOT yet merge group grants. RLS on the server is authoritative;
  // bringing the client-side gate into agreement is a follow-up.
  // -------------------------------------------------------------------------

  async listGroupGrants(groupId: string): Promise<GroupGrant[]> {
    const { data, error } = await supabase
      .from('group_grants')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    assertNoError(error, 'listGroupGrants');
    return (data ?? []) as GroupGrant[];
  },

  /** Grant a workspace-wide permission to a group. Requires groups.manage. */
  async grantGroupPermission(
    groupId: string,
    permissionKey: string,
  ): Promise<GroupGrant> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('group_grants')
      .insert({
        group_id: groupId,
        permission_key: permissionKey,
        resource_type: null,
        resource_id: null,
        created_by: userId,
      })
      .select()
      .single();

    assertNoError(error, 'grantGroupPermission');
    return data as GroupGrant;
  },

  async revokeGroupGrant(grantId: string): Promise<void> {
    const { error } = await supabase
      .from('group_grants')
      .delete()
      .eq('id', grantId);

    assertNoError(error, 'revokeGroupGrant');
  },

  // -------------------------------------------------------------------------
  // Integrations — org-managed policy + admin visibility
  // -------------------------------------------------------------------------

  /**
   * Returns all workspace integration policy rows. Visible to any member.
   */
  async getWorkspaceIntegrations(workspaceId: string): Promise<WorkspaceIntegration[]> {
    const { data, error } = await supabase
      .from('workspace_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('integration_key', { ascending: true });

    assertNoError(error, 'getWorkspaceIntegrations');
    return (data ?? []) as WorkspaceIntegration[];
  },

  /**
   * Upserts (insert or update) the integration policy row for a key.
   * Admin+ only (RLS-enforced).
   */
  async upsertWorkspaceIntegration(
    workspaceId: string,
    integrationKey: IntegrationKey,
    fields: Partial<Pick<WorkspaceIntegration, 'scope' | 'is_enabled' | 'shared_config' | 'notes'>>,
  ): Promise<WorkspaceIntegration> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('workspace_integrations')
      .upsert(
        {
          workspace_id:    workspaceId,
          integration_key: integrationKey,
          connected_by:    fields.scope === 'shared' ? userId : null,
          ...fields,
        },
        { onConflict: 'workspace_id,integration_key' },
      )
      .select()
      .single();

    assertNoError(error, 'upsertWorkspaceIntegration');
    return data as WorkspaceIntegration;
  },

  /**
   * Returns the admin view of every member's connected providers. Admin+ only.
   */
  async getMemberConnections(workspaceId: string): Promise<MemberConnectionRow[]> {
    const { data, error } = await supabase.rpc('get_workspace_member_connections', {
      p_workspace_id: workspaceId,
    });
    assertNoError(error, 'getMemberConnections');
    return (data ?? []) as MemberConnectionRow[];
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

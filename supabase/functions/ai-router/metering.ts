// Usage metering + hard-cap enforcement
// Reads the workspace's entitlements and compares against current-period usage.
// When a workspace hits its ai_messages cap, further requests are rejected with 402.

// deno-lint-ignore-file no-explicit-any

interface Entitlements {
  max_ai_messages_mo: number | null;
  is_trialing: boolean;
  trial_ends_at: string | null;
}

export interface CapCheckResult {
  allowed: boolean;
  reason?: 'cap_exceeded' | 'trial_expired' | 'no_entitlements';
  usage: number;
  limit: number | null;
  resetAt: string;
}

function currentPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function verifyWorkspaceAccess(
  supabase: any,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return !error && !!data;
}

export async function checkAICap(
  supabase: any,
  workspaceId: string,
): Promise<CapCheckResult> {
  const { start, end } = currentPeriod();

  // Fetch entitlements
  const { data: ent } = await supabase
    .from('entitlements')
    .select('max_ai_messages_mo, is_trialing, trial_ends_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle<Entitlements>();

  // No entitlements row = pre-launch default (Pulse Team cap of 2000)
  // Once billing is live, this should become trial_expired block.
  const limit = ent?.max_ai_messages_mo ?? 2000;

  // Trial expired check — if is_trialing is true but trial_ends_at is past
  if (ent?.is_trialing && ent.trial_ends_at) {
    if (new Date(ent.trial_ends_at).getTime() < Date.now()) {
      return { allowed: false, reason: 'trial_expired', usage: 0, limit, resetAt: end };
    }
  }

  // Fetch current-period usage
  const { data: usageRec } = await supabase
    .from('usage_records')
    .select('quantity')
    .eq('workspace_id', workspaceId)
    .eq('metric', 'ai_messages')
    .eq('period_start', start)
    .maybeSingle();

  const usage = usageRec?.quantity ?? 0;

  // NULL limit = unlimited (Scale tier, Business tier, etc.)
  if (limit === null) {
    return { allowed: true, usage, limit: null, resetAt: end };
  }

  if (usage >= limit) {
    return { allowed: false, reason: 'cap_exceeded', usage, limit, resetAt: end };
  }

  return { allowed: true, usage, limit, resetAt: end };
}

export async function incrementAIUsage(
  supabase: any,
  workspaceId: string,
  quantity = 1,
): Promise<void> {
  const { start, end } = currentPeriod();
  const { error } = await supabase.rpc('increment_usage', {
    p_workspace_id: workspaceId,
    p_metric: 'ai_messages',
    p_quantity: quantity,
    p_period_start: start,
    p_period_end: end,
  });
  if (error) {
    // Log but don't fail the user request — we already gave them the AI response
    console.error('[ai-router] increment_usage failed:', error.message);
  }
}

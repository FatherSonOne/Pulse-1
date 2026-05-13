// Workspace access + AI usage cap helpers.
// Duplicated from ai-router/metering.ts — Supabase deploys each function as a
// self-contained bundle, so cross-function imports don't resolve at runtime.

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

  const { data: ent } = await supabase
    .from('entitlements')
    .select('max_ai_messages_mo, is_trialing, trial_ends_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle<Entitlements>();

  const limit = ent?.max_ai_messages_mo ?? 2000;

  if (ent?.is_trialing && ent.trial_ends_at) {
    if (new Date(ent.trial_ends_at).getTime() < Date.now()) {
      return { allowed: false, reason: 'trial_expired', usage: 0, limit, resetAt: end };
    }
  }

  const { data: usageRec } = await supabase
    .from('usage_records')
    .select('quantity')
    .eq('workspace_id', workspaceId)
    .eq('metric', 'ai_messages')
    .eq('period_start', start)
    .maybeSingle();

  const usage = usageRec?.quantity ?? 0;

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
    console.error('[gemini-audio] increment_usage failed:', error.message);
  }
}

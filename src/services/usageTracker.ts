// usageTracker.ts — Fire-and-forget usage metering for billing
// Calls the billing-usage edge function to increment usage counters.
// All calls are non-blocking — failures are logged but never thrown.

import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type Metric = 'ai_messages' | 'sms_sent' | 'storage_bytes' | 'voxer_minutes' | 'workflow_runs';

async function getWorkspaceId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  return data?.workspace_id || null;
}

// Cache workspace ID for the session
let cachedWorkspaceId: string | null = null;

async function resolveWorkspaceId(): Promise<string | null> {
  if (cachedWorkspaceId) return cachedWorkspaceId;
  cachedWorkspaceId = await getWorkspaceId();
  return cachedWorkspaceId;
}

/**
 * Record usage for a metric. Fire-and-forget — never throws.
 */
export async function trackUsage(metric: Metric, quantity: number = 1): Promise<void> {
  try {
    const workspaceId = await resolveWorkspaceId();
    if (!workspaceId) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Non-blocking fetch — we don't await the response in most cases
    fetch(`${SUPABASE_URL}/functions/v1/billing-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        metric,
        quantity,
      }),
    }).catch(() => {
      // Silently fail — usage tracking should never block the user
    });
  } catch {
    // Never throw from usage tracking
  }
}

export const usageTracker = {
  aiMessage: () => trackUsage('ai_messages', 1),
  smsSent: () => trackUsage('sms_sent', 1),
  storageBytes: (bytes: number) => trackUsage('storage_bytes', bytes),
  voxerMinutes: (minutes: number) => trackUsage('voxer_minutes', minutes),
};

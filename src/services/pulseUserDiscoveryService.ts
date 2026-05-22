import { supabase } from './supabase';

export interface DiscoveredPulseUser {
  user_id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  shared_workspace_id: string;
  shared_workspace_role: 'owner' | 'admin' | 'member' | 'viewer';
  online_status: 'online' | 'offline' | 'away' | 'busy';
  already_in_contacts: boolean;
  joined_at: string;
}

export class PulseUserDiscoveryError extends Error {
  constructor(
    message: string,
    public readonly code: 'unauthenticated' | 'forbidden' | 'network' | 'unexpected',
  ) {
    super(message);
    this.name = 'PulseUserDiscoveryError';
  }
}

export async function discoverPulseUsers(params: {
  workspaceId: string;
  query?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ users: DiscoveredPulseUser[]; nextCursor: string | null }> {
  const { workspaceId, query = null, limit = 50, cursor = null } = params;

  const { data, error } = await supabase.rpc('discover_pulse_users', {
    p_workspace_id: workspaceId,
    p_query: query,
    p_limit: limit,
    p_cursor: cursor,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('unauthenticated') || error.code === 'PGRST301') {
      throw new PulseUserDiscoveryError('Not authenticated', 'unauthenticated');
    }
    if (
      msg.includes('forbidden') ||
      msg.includes('permission denied') ||
      error.code === '42501'
    ) {
      throw new PulseUserDiscoveryError(
        "You don’t have access to this workspace’s member list",
        'forbidden',
      );
    }
    throw new PulseUserDiscoveryError(
      error.message ?? 'Unexpected error from discover_pulse_users',
      'unexpected',
    );
  }

  const rows = (data as DiscoveredPulseUser[] | null) ?? [];
  const nextCursor =
    rows.length === limit
      ? btoa(JSON.stringify({ joined_at: rows[rows.length - 1].joined_at, user_id: rows[rows.length - 1].user_id }))
      : null;

  return { users: rows, nextCursor };
}

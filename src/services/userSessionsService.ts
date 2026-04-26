import { supabase } from './supabase';

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string | null;
  device_type: string | null;
  browser_name: string | null;
  os_name: string | null;
  ip_address: string | null;
  location: string | null;
  is_active: boolean;
  is_current: boolean;
  trusted: boolean;
  mfa_verified: boolean;
  created_at: string;
  last_active_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

// RLS limits these reads/writes to the calling user's own sessions.
export const userSessionsService = {
  async list(limit = 50): Promise<UserSession[]> {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) throw new Error(`[userSessionsService] list: ${error.message}`);
    return (data ?? []) as UserSession[];
  },

  async revoke(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revocation_reason: 'Revoked by user',
      })
      .eq('id', sessionId);

    if (error) throw new Error(`[userSessionsService] revoke: ${error.message}`);
  },

  async revokeOtherSessions(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revocation_reason: 'Revoked by user (sign out all other devices)',
      })
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('is_current', false)
      .select('id');

    if (error) throw new Error(`[userSessionsService] revokeOtherSessions: ${error.message}`);
    return (data ?? []).length;
  },
};

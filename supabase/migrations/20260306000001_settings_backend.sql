-- Settings Backend Migration
-- Created: 2026-03-06
-- Adds: team_invites, user_subscriptions, delete_user_account RPC

-- ─── team_invites ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Inviter can see and manage their own invites
CREATE POLICY "team_invites_inviter_select" ON team_invites
  FOR SELECT USING (auth.uid() = inviter_id);

CREATE POLICY "team_invites_inviter_insert" ON team_invites
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "team_invites_inviter_delete" ON team_invites
  FOR DELETE USING (auth.uid() = inviter_id);

CREATE POLICY "team_invites_inviter_update" ON team_invites
  FOR UPDATE USING (auth.uid() = inviter_id);

-- ─── user_subscriptions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_user_select" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── delete_user_account RPC ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to delete their own account
  IF auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Not authorized to delete this account';
  END IF;

  -- Cascade delete in dependency order
  DELETE FROM messages WHERE user_id = target_user_id;
  DELETE FROM contacts WHERE user_id = target_user_id;
  DELETE FROM calendar_events WHERE user_id = target_user_id;
  DELETE FROM user_settings WHERE user_id = target_user_id;
  DELETE FROM team_invites WHERE inviter_id = target_user_id;
  DELETE FROM user_subscriptions WHERE user_id = target_user_id;
  DELETE FROM pulse_profiles WHERE id = target_user_id;

  -- Note: auth.users deletion must be handled via supabase.auth.admin.deleteUser()
  -- or the user calling supabase.auth.signOut() after this RPC
END;
$$;

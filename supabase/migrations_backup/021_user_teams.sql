-- ============================================
-- USER TEAMS SYSTEM
-- Allows users to create and manage teams
-- ============================================

-- Drop existing tables if they exist (to avoid schema conflicts)
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS user_teams CASCADE;

-- User Teams Table
CREATE TABLE user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_color TEXT DEFAULT '#ec4899',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, name)
);

-- Team Members Table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES user_teams(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL CHECK (member_type IN ('pulse_user', 'contact')),
  member_id TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(team_id, member_type, member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_updated_at ON user_teams(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_type, member_id);

-- RLS Policies
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Users can view their own teams
CREATE POLICY "Users can view their own teams"
  ON user_teams FOR SELECT
  USING (auth.uid()::text = user_id);

-- Users can insert their own teams
CREATE POLICY "Users can insert their own teams"
  ON user_teams FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own teams
CREATE POLICY "Users can update their own teams"
  ON user_teams FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Users can delete their own teams
CREATE POLICY "Users can delete their own teams"
  ON user_teams FOR DELETE
  USING (auth.uid()::text = user_id);

-- Users can view members of their own teams
CREATE POLICY "Users can view members of their own teams"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_teams.id = team_members.team_id
      AND user_teams.user_id = auth.uid()::text
    )
  );

-- Users can insert members to their own teams
CREATE POLICY "Users can insert members to their own teams"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_teams.id = team_members.team_id
      AND user_teams.user_id = auth.uid()::text
    )
  );

-- Users can update members of their own teams
CREATE POLICY "Users can update members of their own teams"
  ON team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_teams.id = team_members.team_id
      AND user_teams.user_id = auth.uid()::text
    )
  );

-- Users can delete members from their own teams
CREATE POLICY "Users can delete members from their own teams"
  ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_teams.id = team_members.team_id
      AND user_teams.user_id = auth.uid()::text
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_team_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_updated_at_trigger
  BEFORE UPDATE ON user_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_team_updated_at();

-- Comments
COMMENT ON TABLE user_teams IS 'User-defined teams for organizing contacts and Pulse users';
COMMENT ON TABLE team_members IS 'Members of user teams (can be Pulse users or contacts)';
COMMENT ON COLUMN team_members.member_type IS 'Type of member: pulse_user (from user_profiles) or contact (from contacts table)';
COMMENT ON COLUMN team_members.member_id IS 'ID of the member (user_profiles.id for pulse_user, contacts.id for contact)';
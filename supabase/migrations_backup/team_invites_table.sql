-- Team Invites Table for Pulse
-- Run this in your Supabase SQL Editor

-- Create the team_invites table
CREATE TABLE IF NOT EXISTS public.team_invites (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    invited_by UUID REFERENCES auth.users(id),
    invited_by_name TEXT NOT NULL,
    workspace_id TEXT,
    workspace_name TEXT DEFAULT 'Pulse Team',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    accepted_by UUID REFERENCES auth.users(id),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_invited_by ON public.team_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON public.team_invites(status);

-- Enable Row Level Security
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invites they sent
CREATE POLICY "Users can view their sent invites"
    ON public.team_invites
    FOR SELECT
    USING (auth.uid() = invited_by);

-- Policy: Users can view invites sent to their email
CREATE POLICY "Users can view invites to their email"
    ON public.team_invites
    FOR SELECT
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Policy: Authenticated users can create invites
CREATE POLICY "Authenticated users can create invites"
    ON public.team_invites
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update invites sent to them (accept)
CREATE POLICY "Users can accept invites to their email"
    ON public.team_invites
    FOR UPDATE
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Grant access to authenticated users
GRANT ALL ON public.team_invites TO authenticated;

-- Function to auto-expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invites()
RETURNS void AS $$
BEGIN
    UPDATE public.team_invites
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to expire invites (requires pg_cron extension)
-- SELECT cron.schedule('expire-invites', '0 * * * *', 'SELECT expire_old_invites()');

COMMENT ON TABLE public.team_invites IS 'Stores team invitation records for Pulse app';

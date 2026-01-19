-- Fix Team Invites RLS Policies
-- Run this in your Supabase SQL Editor to fix the "permission denied for table users" error

-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view their sent invites" ON public.team_invites;
DROP POLICY IF EXISTS "Users can view invites to their email" ON public.team_invites;
DROP POLICY IF EXISTS "Authenticated users can create invites" ON public.team_invites;
DROP POLICY IF EXISTS "Users can accept invites to their email" ON public.team_invites;

-- Re-create the table if it doesn't exist
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

-- Ensure RLS is enabled
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invites they sent (simplified - no subquery to users table)
CREATE POLICY "Users can view their sent invites"
    ON public.team_invites
    FOR SELECT
    USING (auth.uid() = invited_by);

-- Policy: Users can view invites sent to their email (using auth.jwt() instead of users table lookup)
-- This avoids the "permission denied for table users" error
CREATE POLICY "Users can view invites to their email"
    ON public.team_invites
    FOR SELECT
    USING (
        lower(email) = lower(auth.jwt() ->> 'email')
    );

-- Policy: Authenticated users can create invites (simplified)
CREATE POLICY "Authenticated users can create invites"
    ON public.team_invites
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can accept invites sent to their email (using auth.jwt())
CREATE POLICY "Users can accept invites to their email"
    ON public.team_invites
    FOR UPDATE
    USING (
        lower(email) = lower(auth.jwt() ->> 'email')
    );

-- Grant access to authenticated users
GRANT ALL ON public.team_invites TO authenticated;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_invited_by ON public.team_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON public.team_invites(status);

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

COMMENT ON TABLE public.team_invites IS 'Stores team invitation records for Pulse app';

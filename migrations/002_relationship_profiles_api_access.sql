-- ============================================
-- Relationship Profiles API Access Policies
-- Enable API-based operations on relationship_profiles table
-- ============================================

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.relationship_profiles;
DROP POLICY IF EXISTS "API can create profiles" ON public.relationship_profiles;
DROP POLICY IF EXISTS "API can update profiles" ON public.relationship_profiles;

-- Create service role policy for full access
CREATE POLICY "Service role can manage all profiles"
  ON public.relationship_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy for API-based profile creation (for enrichment endpoint)
-- This allows creating profiles without user_id when called from service role
CREATE POLICY "API can create profiles"
  ON public.relationship_profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create policy for API-based profile updates
CREATE POLICY "API can update profiles"
  ON public.relationship_profiles
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions to service_role
GRANT SELECT, INSERT, UPDATE ON public.relationship_profiles TO service_role;

-- Add comment
COMMENT ON TABLE public.relationship_profiles IS 'Relationship intelligence profiles - accessible via service role for API operations';

-- Create profiles for existing users who signed up before the trigger was added
-- Run this ONCE after running 003_pulse_handles.sql

-- Insert profiles for any auth.users that don't have one yet
INSERT INTO public.user_profiles (id, display_name, full_name, avatar_url)
SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.id = u.id
);

-- Report how many profiles were created
DO $$
DECLARE
    profile_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM public.user_profiles;
    RAISE NOTICE 'Total user profiles now: %', profile_count;
END $$;

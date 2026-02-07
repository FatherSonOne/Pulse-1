-- ================================================
-- RESET: Activity Logs & Security Alerts Tables
-- ================================================
-- Run this ONLY if you need to completely reset the security monitoring system
-- WARNING: This will delete all activity logs and security alerts!

-- Drop triggers first
DROP TRIGGER IF EXISTS update_security_alerts_timestamp ON public.security_alerts;
DROP TRIGGER IF EXISTS update_security_settings_timestamp ON public.security_settings;
DROP TRIGGER IF EXISTS create_user_security_settings ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_security_alerts_updated_at();
DROP FUNCTION IF EXISTS public.update_security_settings_updated_at();
DROP FUNCTION IF EXISTS public.cleanup_old_activity_logs();
DROP FUNCTION IF EXISTS public.create_default_security_settings();

-- Drop tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS public.security_alerts CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.security_settings CASCADE;

-- Verification
SELECT 'Reset Complete - Tables Dropped' as status;

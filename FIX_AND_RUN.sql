-- ================================================
-- FIX SCRIPT: Drop existing incomplete tables and recreate
-- ================================================
-- Run this in Supabase SQL Editor if you get column errors
-- This will cleanly recreate all tables
-- ================================================

-- Drop existing tables (this is safe because of CASCADE)
DROP TABLE IF EXISTS public.security_alerts CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.security_settings CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.update_security_alerts_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_security_settings_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_activity_logs() CASCADE;
DROP FUNCTION IF EXISTS public.create_default_security_settings() CASCADE;

-- ============================================
-- Activity Logs Table
-- ============================================
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    location_info JSONB DEFAULT '{}'::jsonb,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    severity VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_action_category CHECK (action_category IN ('auth', 'data_access', 'settings', 'export', 'security', 'admin')),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Indexes
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX idx_activity_logs_action_category ON public.activity_logs(action_category);
CREATE INDEX idx_activity_logs_severity ON public.activity_logs(severity) WHERE severity IN ('warning', 'critical');
CREATE INDEX idx_activity_logs_user_date ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_composite ON public.activity_logs(user_id, action_category, created_at DESC);

-- ============================================
-- Security Alerts Table
-- ============================================
CREATE TABLE public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL,
    alert_level VARCHAR(20) NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    trigger_activity_id UUID REFERENCES public.activity_logs(id) ON DELETE SET NULL,
    ip_address INET,
    device_info JSONB DEFAULT '{}'::jsonb,
    location_info JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'new',
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    push_sent BOOLEAN DEFAULT false,
    push_sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_alert_level CHECK (alert_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_status CHECK (status IN ('new', 'acknowledged', 'resolved', 'false_positive'))
);

-- Indexes
CREATE INDEX idx_security_alerts_user_id ON public.security_alerts(user_id);
CREATE INDEX idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX idx_security_alerts_alert_type ON public.security_alerts(alert_type);
CREATE INDEX idx_security_alerts_alert_level ON public.security_alerts(alert_level);
CREATE INDEX idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX idx_security_alerts_unread ON public.security_alerts(user_id, created_at DESC) WHERE status = 'new';
CREATE INDEX idx_security_alerts_composite ON public.security_alerts(user_id, status, alert_level, created_at DESC);

-- ============================================
-- Security Settings Table
-- ============================================
CREATE TABLE public.security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    alerts_enabled BOOLEAN DEFAULT true,
    email_alerts_enabled BOOLEAN DEFAULT true,
    push_alerts_enabled BOOLEAN DEFAULT true,
    monitor_new_locations BOOLEAN DEFAULT true,
    monitor_new_devices BOOLEAN DEFAULT true,
    monitor_unusual_times BOOLEAN DEFAULT true,
    monitor_failed_logins BOOLEAN DEFAULT true,
    monitor_data_exports BOOLEAN DEFAULT true,
    trusted_device_fingerprints JSONB DEFAULT '[]'::jsonb,
    trusted_ip_ranges JSONB DEFAULT '[]'::jsonb,
    activity_retention_days INTEGER DEFAULT 90 CHECK (activity_retention_days >= 30 AND activity_retention_days <= 365),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_security_settings_user_id ON public.security_settings(user_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

-- Activity Logs Policies
CREATE POLICY "Users can view own activity logs"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity logs"
    ON public.activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Security Alerts Policies
CREATE POLICY "Users can view own security alerts"
    ON public.security_alerts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert security alerts"
    ON public.security_alerts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own security alerts"
    ON public.security_alerts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Security Settings Policies
CREATE POLICY "Users can view own security settings"
    ON public.security_settings FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own security settings"
    ON public.security_settings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own security settings"
    ON public.security_settings FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Functions & Triggers
-- ============================================
CREATE FUNCTION public.update_security_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_security_alerts_timestamp
    BEFORE UPDATE ON public.security_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_security_alerts_updated_at();

CREATE FUNCTION public.update_security_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_security_settings_timestamp
    BEFORE UPDATE ON public.security_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_security_settings_updated_at();

CREATE FUNCTION public.cleanup_old_activity_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Delete logs older than user's retention period
    WITH user_retention AS (
        SELECT user_id, COALESCE(activity_retention_days, 90) as retention_days
        FROM public.security_settings
    )
    DELETE FROM public.activity_logs al
    USING user_retention ur
    WHERE al.user_id = ur.user_id
    AND al.created_at < NOW() - (ur.retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Also delete logs for users without settings (default 90 days)
    DELETE FROM public.activity_logs
    WHERE user_id NOT IN (SELECT user_id FROM public.security_settings)
    AND created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS temp_count = ROW_COUNT;

    -- Add the counts together
    deleted_count := deleted_count + temp_count;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.create_default_security_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.security_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_user_security_settings
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_security_settings();

-- ============================================
-- Grant Permissions
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.security_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.security_settings TO authenticated;

-- ============================================
-- Success Message
-- ============================================
SELECT
    '✅ Migration Complete!' as status,
    'Created 3 tables with full RLS policies' as result,
    'activity_logs, security_alerts, security_settings' as tables_created;

-- Verify tables were created successfully
SELECT
    tablename as table_name,
    CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('activity_logs', 'security_alerts', 'security_settings')
ORDER BY tablename;

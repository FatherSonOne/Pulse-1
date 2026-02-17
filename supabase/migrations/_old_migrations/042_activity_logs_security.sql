-- ================================================
-- Activity Logs & Security Alerts Tables
-- ================================================
-- Comprehensive security monitoring infrastructure
-- Tracks user activity, detects anomalies, and sends alerts
-- ================================================

-- ============================================
-- Activity Logs Table
-- ============================================
-- Tracks all significant user actions for security and audit purposes
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Activity details
    action_type VARCHAR(100) NOT NULL, -- 'login', 'gmail_sync', 'calendar_access', 'settings_change', etc.
    action_category VARCHAR(50) NOT NULL, -- 'auth', 'data_access', 'settings', 'export', etc.
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,

    -- Security context
    ip_address INET,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}'::jsonb, -- { type, os, browser, model }
    location_info JSONB DEFAULT '{}'::jsonb, -- { city, country, region }

    -- Metadata
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexing for fast queries
    CONSTRAINT valid_action_category CHECK (action_category IN ('auth', 'data_access', 'settings', 'export', 'security', 'admin')),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Indexes for performance
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX idx_activity_logs_action_category ON public.activity_logs(action_category);
CREATE INDEX idx_activity_logs_severity ON public.activity_logs(severity) WHERE severity IN ('warning', 'critical');
CREATE INDEX idx_activity_logs_user_date ON public.activity_logs(user_id, created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_activity_logs_composite ON public.activity_logs(user_id, action_category, created_at DESC);

-- Table comment
COMMENT ON TABLE public.activity_logs IS 'Comprehensive activity logging for security monitoring and audit trails';

-- ============================================
-- Security Alerts Table
-- ============================================
-- Stores detected security events and unusual activity
CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Alert details
    alert_type VARCHAR(100) NOT NULL, -- 'new_location', 'new_device', 'unusual_time', 'multiple_failed_logins', etc.
    alert_level VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- Security context
    trigger_activity_id UUID REFERENCES public.activity_logs(id) ON DELETE SET NULL,
    ip_address INET,
    device_info JSONB DEFAULT '{}'::jsonb,
    location_info JSONB DEFAULT '{}'::jsonb,

    -- Alert state
    status VARCHAR(20) DEFAULT 'new', -- 'new', 'acknowledged', 'resolved', 'false_positive'
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    -- Notification state
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    push_sent BOOLEAN DEFAULT false,
    push_sent_at TIMESTAMPTZ,

    -- Additional context
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_alert_level CHECK (alert_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_status CHECK (status IN ('new', 'acknowledged', 'resolved', 'false_positive'))
);

-- Indexes for performance
CREATE INDEX idx_security_alerts_user_id ON public.security_alerts(user_id);
CREATE INDEX idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX idx_security_alerts_alert_type ON public.security_alerts(alert_type);
CREATE INDEX idx_security_alerts_alert_level ON public.security_alerts(alert_level);
CREATE INDEX idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX idx_security_alerts_unread ON public.security_alerts(user_id, created_at DESC) WHERE status = 'new';

-- Composite index for dashboard queries
CREATE INDEX idx_security_alerts_composite ON public.security_alerts(user_id, status, alert_level, created_at DESC);

-- Table comment
COMMENT ON TABLE public.security_alerts IS 'Security alerts for unusual activity detection and notifications';

-- ============================================
-- Security Settings Table
-- ============================================
-- User preferences for security alerts
CREATE TABLE IF NOT EXISTS public.security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Alert preferences
    alerts_enabled BOOLEAN DEFAULT true,
    email_alerts_enabled BOOLEAN DEFAULT true,
    push_alerts_enabled BOOLEAN DEFAULT true,

    -- Alert types to monitor
    monitor_new_locations BOOLEAN DEFAULT true,
    monitor_new_devices BOOLEAN DEFAULT true,
    monitor_unusual_times BOOLEAN DEFAULT true,
    monitor_failed_logins BOOLEAN DEFAULT true,
    monitor_data_exports BOOLEAN DEFAULT true,

    -- Trusted devices/locations (stored as arrays of hashes)
    trusted_device_fingerprints JSONB DEFAULT '[]'::jsonb,
    trusted_ip_ranges JSONB DEFAULT '[]'::jsonb,

    -- Activity retention
    activity_retention_days INTEGER DEFAULT 90 CHECK (activity_retention_days >= 30 AND activity_retention_days <= 365),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX idx_security_settings_user_id ON public.security_settings(user_id);

-- Table comment
COMMENT ON TABLE public.security_settings IS 'User-specific security alert preferences and trusted devices';

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

-- Activity Logs Policies
CREATE POLICY "Users can view own activity logs"
    ON public.activity_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity logs"
    ON public.activity_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Security Alerts Policies
CREATE POLICY "Users can view own security alerts"
    ON public.security_alerts
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert security alerts"
    ON public.security_alerts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own security alerts"
    ON public.security_alerts
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Security Settings Policies
CREATE POLICY "Users can view own security settings"
    ON public.security_settings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own security settings"
    ON public.security_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own security settings"
    ON public.security_settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_security_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for security_alerts
CREATE TRIGGER update_security_alerts_timestamp
    BEFORE UPDATE ON public.security_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_security_alerts_updated_at();

-- Function to update updated_at for security_settings
CREATE OR REPLACE FUNCTION public.update_security_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for security_settings
CREATE TRIGGER update_security_settings_timestamp
    BEFORE UPDATE ON public.security_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_security_settings_updated_at();

-- Function to auto-cleanup old activity logs based on retention policy
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete logs older than user's retention period
    WITH user_retention AS (
        SELECT
            user_id,
            COALESCE(activity_retention_days, 90) as retention_days
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

    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default security settings for new users
CREATE OR REPLACE FUNCTION public.create_default_security_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.security_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default security settings when user signs up
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
-- Initial Data & Examples
-- ============================================

-- No initial data needed - tables will be populated as users interact with the system

-- ============================================
-- Verification Queries
-- ============================================

-- Verify tables created
SELECT
    'Tables Created' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('activity_logs', 'security_alerts', 'security_settings')
ORDER BY tablename;

-- Verify RLS policies
SELECT
    'RLS Policies' as check_type,
    tablename,
    policyname,
    cmd as command
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('activity_logs', 'security_alerts', 'security_settings')
ORDER BY tablename, policyname;

-- Verify indexes
SELECT
    'Indexes' as check_type,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('activity_logs', 'security_alerts', 'security_settings')
ORDER BY tablename, indexname;

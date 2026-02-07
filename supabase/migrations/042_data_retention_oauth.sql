-- ================================================
-- Data Retention and OAuth Apps Management
-- ================================================
-- Creates tables and functions for data retention policies
-- and third-party OAuth app tracking
-- ================================================

-- ================================================
-- 1. Data Retention Policies Table
-- ================================================

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Retention periods (in days, -1 = never delete)
    emails_retention_days INTEGER NOT NULL DEFAULT 90,
    calendar_retention_days INTEGER NOT NULL DEFAULT 365,
    contacts_retention_days INTEGER NOT NULL DEFAULT -1,
    messages_retention_days INTEGER NOT NULL DEFAULT 180,

    -- Policy settings
    auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT true,
    cleanup_time_utc TIME NOT NULL DEFAULT '02:00:00', -- 2 AM UTC
    last_cleanup_at TIMESTAMPTZ,
    next_cleanup_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_policy_per_user UNIQUE(user_id)
);

COMMENT ON TABLE public.data_retention_policies IS 'User-defined data retention policies for automatic cleanup';

CREATE INDEX idx_data_retention_user_id ON public.data_retention_policies(user_id);
CREATE INDEX idx_data_retention_next_cleanup ON public.data_retention_policies(next_cleanup_at)
    WHERE auto_cleanup_enabled = true;

-- ================================================
-- 2. Data Cleanup Logs Table
-- ================================================

CREATE TABLE IF NOT EXISTS public.data_cleanup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Cleanup details
    cleanup_type VARCHAR(50) NOT NULL, -- 'emails', 'calendar', 'contacts', 'messages'
    items_deleted INTEGER NOT NULL DEFAULT 0,
    retention_days INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'partial'
    error_message TEXT,

    -- Performance metrics
    execution_time_ms INTEGER,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_cleanup_type CHECK (cleanup_type IN ('emails', 'calendar', 'contacts', 'messages')),
    CONSTRAINT valid_status CHECK (status IN ('completed', 'failed', 'partial'))
);

COMMENT ON TABLE public.data_cleanup_logs IS 'Audit log for data cleanup operations';

CREATE INDEX idx_cleanup_logs_user_id ON public.data_cleanup_logs(user_id);
CREATE INDEX idx_cleanup_logs_created_at ON public.data_cleanup_logs(created_at DESC);
CREATE INDEX idx_cleanup_logs_type ON public.data_cleanup_logs(cleanup_type);

-- ================================================
-- 3. OAuth Apps Table
-- ================================================

CREATE TABLE IF NOT EXISTS public.oauth_connected_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- App details
    app_name VARCHAR(255) NOT NULL,
    app_client_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'google', -- 'google', 'microsoft', etc.

    -- Permissions and scopes
    scopes TEXT[] NOT NULL DEFAULT '{}',
    permissions_granted TEXT[] NOT NULL DEFAULT '{}',

    -- Usage tracking
    first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    access_count INTEGER NOT NULL DEFAULT 0,

    -- Security
    is_trusted BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_provider CHECK (provider IN ('google', 'microsoft', 'apple'))
);

COMMENT ON TABLE public.oauth_connected_apps IS 'Third-party OAuth applications connected to user accounts';

CREATE INDEX idx_oauth_apps_user_id ON public.oauth_connected_apps(user_id);
CREATE INDEX idx_oauth_apps_active ON public.oauth_connected_apps(user_id, is_active)
    WHERE is_active = true;
CREATE INDEX idx_oauth_apps_provider ON public.oauth_connected_apps(provider);

-- ================================================
-- 4. RLS Policies
-- ================================================

-- Data Retention Policies RLS
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own retention policies"
ON public.data_retention_policies
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own retention policies"
ON public.data_retention_policies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own retention policies"
ON public.data_retention_policies
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own retention policies"
ON public.data_retention_policies
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Data Cleanup Logs RLS
ALTER TABLE public.data_cleanup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cleanup logs"
ON public.data_cleanup_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can insert cleanup logs"
ON public.data_cleanup_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- OAuth Apps RLS
ALTER TABLE public.oauth_connected_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OAuth apps"
ON public.oauth_connected_apps
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OAuth apps"
ON public.oauth_connected_apps
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own OAuth apps"
ON public.oauth_connected_apps
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own OAuth apps"
ON public.oauth_connected_apps
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ================================================
-- 5. Functions
-- ================================================

-- Calculate next cleanup time based on policy
CREATE OR REPLACE FUNCTION public.calculate_next_cleanup_time(
    p_cleanup_time_utc TIME,
    p_from_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_cleanup TIMESTAMPTZ;
BEGIN
    -- Get next occurrence of the cleanup time
    v_next_cleanup := (DATE(p_from_time AT TIME ZONE 'UTC') + p_cleanup_time_utc) AT TIME ZONE 'UTC';

    -- If that time has passed today, schedule for tomorrow
    IF v_next_cleanup <= p_from_time THEN
        v_next_cleanup := v_next_cleanup + INTERVAL '1 day';
    END IF;

    RETURN v_next_cleanup;
END;
$$;

-- Update next_cleanup_at when policy changes
CREATE OR REPLACE FUNCTION public.update_next_cleanup_time()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND
        (NEW.cleanup_time_utc != OLD.cleanup_time_utc OR
         NEW.auto_cleanup_enabled != OLD.auto_cleanup_enabled)) THEN

        IF NEW.auto_cleanup_enabled THEN
            NEW.next_cleanup_at := public.calculate_next_cleanup_time(NEW.cleanup_time_utc);
        ELSE
            NEW.next_cleanup_at := NULL;
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_retention_policy_next_cleanup
    BEFORE INSERT OR UPDATE ON public.data_retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_next_cleanup_time();

-- Update updated_at timestamp for OAuth apps
CREATE OR REPLACE FUNCTION public.update_oauth_apps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_oauth_apps_timestamp
    BEFORE UPDATE ON public.oauth_connected_apps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_oauth_apps_updated_at();

-- Function to get items eligible for cleanup
CREATE OR REPLACE FUNCTION public.get_cleanup_eligible_count(
    p_user_id UUID,
    p_data_type VARCHAR(50),
    p_retention_days INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cutoff_date TIMESTAMPTZ;
    v_count INTEGER := 0;
BEGIN
    -- Don't cleanup if retention is -1 (never delete)
    IF p_retention_days = -1 THEN
        RETURN 0;
    END IF;

    v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;

    -- Count based on data type
    CASE p_data_type
        WHEN 'emails' THEN
            -- Placeholder - would count from emails table
            v_count := 0;
        WHEN 'calendar' THEN
            -- Placeholder - would count from events table
            v_count := 0;
        WHEN 'contacts' THEN
            -- Placeholder - would count from contacts table
            v_count := 0;
        WHEN 'messages' THEN
            -- Placeholder - would count from messages table
            v_count := 0;
    END CASE;

    RETURN v_count;
END;
$$;

-- ================================================
-- 6. Permissions
-- ================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_retention_policies TO authenticated;
GRANT SELECT, INSERT ON public.data_cleanup_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_connected_apps TO authenticated;

-- ================================================
-- 7. Initial Data
-- ================================================

-- Create default retention policy for existing users
-- This will run once during migration
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM auth.users LOOP
        INSERT INTO public.data_retention_policies (
            user_id,
            emails_retention_days,
            calendar_retention_days,
            contacts_retention_days,
            messages_retention_days,
            auto_cleanup_enabled
        ) VALUES (
            v_user.id,
            90,  -- 90 days for emails
            365, -- 1 year for calendar
            -1,  -- Never delete contacts
            180, -- 180 days for messages
            false -- Disabled by default (opt-in)
        )
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END;
$$;

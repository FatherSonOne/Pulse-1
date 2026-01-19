-- User Contact Annotations and Presence Tracking
-- This migration adds:
-- 1. user_contact_annotations table for private notes/customization on other users
-- 2. Enhanced presence tracking on user_profiles
-- 3. Functions for managing presence and annotations

-- ============================================
-- USER CONTACT ANNOTATIONS TABLE
-- Stores user-specific customizations/notes about other Pulse users
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_contact_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Custom fields (private to user_id)
    nickname TEXT,              -- e.g., "Babe" instead of "@magan"
    custom_notes TEXT,          -- Private notes about this contact
    custom_tags TEXT[],         -- Private tags
    custom_phone TEXT,          -- Additional phone numbers
    custom_email TEXT,          -- Additional email addresses
    custom_birthday DATE,       -- Birthday if known
    custom_company TEXT,        -- Their company
    custom_role TEXT,           -- Their role/position
    custom_address TEXT,        -- Address
    
    -- Relationship metadata
    is_favorite BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    last_interaction_at TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent self-annotation
    CONSTRAINT no_self_annotation CHECK (user_id != target_user_id),
    
    -- One annotation per user-target pair
    UNIQUE(user_id, target_user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_contact_annotations_user ON public.user_contact_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contact_annotations_target ON public.user_contact_annotations(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_contact_annotations_favorite ON public.user_contact_annotations(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_user_contact_annotations_blocked ON public.user_contact_annotations(user_id, is_blocked) WHERE is_blocked = true;

-- ============================================
-- ENHANCE USER PROFILES WITH PRESENCE
-- Add columns if they don't exist (idempotent)
-- ============================================

-- Add online_status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'user_profiles' 
                   AND column_name = 'online_status') THEN
        ALTER TABLE public.user_profiles 
        ADD COLUMN online_status TEXT DEFAULT 'offline' CHECK (online_status IN ('online', 'offline', 'away', 'busy'));
    END IF;
END $$;

-- Add last_active_at if not exists (different from last_seen_at)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'user_profiles' 
                   AND column_name = 'last_active_at') THEN
        ALTER TABLE public.user_profiles 
        ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create index for presence queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_online_status ON public.user_profiles(online_status, last_active_at) WHERE online_status != 'offline';

-- ============================================
-- FUNCTIONS FOR CONTACT ANNOTATIONS
-- ============================================

-- Function to get or create annotation
CREATE OR REPLACE FUNCTION get_or_create_annotation(p_user_id UUID, p_target_user_id UUID)
RETURNS UUID AS $$
DECLARE
    annotation_id UUID;
BEGIN
    -- Try to find existing annotation
    SELECT id INTO annotation_id
    FROM public.user_contact_annotations
    WHERE user_id = p_user_id AND target_user_id = p_target_user_id;
    
    -- Create if not exists
    IF annotation_id IS NULL THEN
        INSERT INTO public.user_contact_annotations (user_id, target_user_id)
        VALUES (p_user_id, p_target_user_id)
        RETURNING id INTO annotation_id;
    END IF;
    
    RETURN annotation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update annotation
CREATE OR REPLACE FUNCTION update_contact_annotation(
    p_user_id UUID,
    p_target_user_id UUID,
    p_nickname TEXT DEFAULT NULL,
    p_custom_notes TEXT DEFAULT NULL,
    p_custom_tags TEXT[] DEFAULT NULL,
    p_custom_phone TEXT DEFAULT NULL,
    p_custom_email TEXT DEFAULT NULL,
    p_custom_birthday DATE DEFAULT NULL,
    p_custom_company TEXT DEFAULT NULL,
    p_custom_role TEXT DEFAULT NULL,
    p_custom_address TEXT DEFAULT NULL,
    p_is_favorite BOOLEAN DEFAULT NULL,
    p_is_blocked BOOLEAN DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    annotation_id UUID;
BEGIN
    -- Get or create annotation
    annotation_id := get_or_create_annotation(p_user_id, p_target_user_id);
    
    -- Update with provided values (NULL means don't update that field)
    UPDATE public.user_contact_annotations
    SET
        nickname = COALESCE(p_nickname, nickname),
        custom_notes = COALESCE(p_custom_notes, custom_notes),
        custom_tags = COALESCE(p_custom_tags, custom_tags),
        custom_phone = COALESCE(p_custom_phone, custom_phone),
        custom_email = COALESCE(p_custom_email, custom_email),
        custom_birthday = COALESCE(p_custom_birthday, custom_birthday),
        custom_company = COALESCE(p_custom_company, custom_company),
        custom_role = COALESCE(p_custom_role, custom_role),
        custom_address = COALESCE(p_custom_address, custom_address),
        is_favorite = COALESCE(p_is_favorite, is_favorite),
        is_blocked = COALESCE(p_is_blocked, is_blocked),
        updated_at = NOW()
    WHERE id = annotation_id;
    
    RETURN annotation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get enriched user profile with annotations
CREATE OR REPLACE FUNCTION get_enriched_user_profile(p_requesting_user_id UUID, p_target_user_id UUID)
RETURNS TABLE (
    id UUID,
    handle TEXT,
    display_name TEXT,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
    is_verified BOOLEAN,
    online_status TEXT,
    last_active_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    -- Annotation fields
    nickname TEXT,
    custom_notes TEXT,
    custom_tags TEXT[],
    custom_phone TEXT,
    custom_email TEXT,
    custom_birthday DATE,
    custom_company TEXT,
    custom_role TEXT,
    custom_address TEXT,
    is_favorite BOOLEAN,
    is_blocked BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.handle,
        p.display_name,
        p.full_name,
        p.bio,
        p.avatar_url,
        p.phone,
        (SELECT email FROM auth.users WHERE id = p.id) as email,
        p.is_verified,
        p.online_status,
        p.last_active_at,
        p.last_seen_at,
        -- Annotation fields (NULL if no annotation exists)
        a.nickname,
        a.custom_notes,
        a.custom_tags,
        a.custom_phone,
        a.custom_email,
        a.custom_birthday,
        a.custom_company,
        a.custom_role,
        a.custom_address,
        COALESCE(a.is_favorite, false) as is_favorite,
        COALESCE(a.is_blocked, false) as is_blocked
    FROM public.user_profiles p
    LEFT JOIN public.user_contact_annotations a 
        ON a.user_id = p_requesting_user_id AND a.target_user_id = p.id
    WHERE p.id = p_target_user_id
    AND (p.is_public = true OR p.id = p_requesting_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTIONS FOR PRESENCE TRACKING
-- ============================================

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence(
    p_user_id UUID,
    p_status TEXT DEFAULT 'online'
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET
        online_status = p_status,
        last_active_at = NOW(),
        last_seen_at = CASE WHEN p_status = 'offline' THEN NOW() ELSE last_seen_at END,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark user as inactive (called by cron or on explicit logout)
CREATE OR REPLACE FUNCTION mark_inactive_users(p_timeout_minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    WITH updated AS (
        UPDATE public.user_profiles
        SET
            online_status = 'offline',
            updated_at = NOW()
        WHERE online_status != 'offline'
        AND last_active_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO updated_count FROM updated;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get online users count
CREATE OR REPLACE FUNCTION get_online_users_count()
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM public.user_profiles
    WHERE online_status = 'online'
    AND last_active_at > NOW() - INTERVAL '5 minutes';
    
    RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's last active status as human-readable string
CREATE OR REPLACE FUNCTION get_last_active_status(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    profile RECORD;
    minutes_ago INTEGER;
    hours_ago INTEGER;
    days_ago INTEGER;
BEGIN
    SELECT online_status, last_active_at 
    INTO profile
    FROM public.user_profiles
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN 'Unknown';
    END IF;
    
    IF profile.online_status = 'online' THEN
        RETURN 'Active now';
    END IF;
    
    -- Calculate time difference
    minutes_ago := EXTRACT(EPOCH FROM (NOW() - profile.last_active_at)) / 60;
    
    IF minutes_ago < 1 THEN
        RETURN 'Active just now';
    ELSIF minutes_ago < 60 THEN
        RETURN 'Active ' || minutes_ago || 'm ago';
    ELSE
        hours_ago := minutes_ago / 60;
        IF hours_ago < 24 THEN
            RETURN 'Active ' || hours_ago || 'h ago';
        ELSE
            days_ago := hours_ago / 24;
            IF days_ago = 1 THEN
                RETURN 'Active yesterday';
            ELSE
                RETURN 'Active ' || days_ago || 'd ago';
            END IF;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update updated_at on annotations
CREATE TRIGGER update_user_contact_annotations_updated_at
    BEFORE UPDATE ON public.user_contact_annotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_contact_annotations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own annotations
CREATE POLICY "Users can view own annotations"
    ON public.user_contact_annotations FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own annotations
CREATE POLICY "Users can insert own annotations"
    ON public.user_contact_annotations FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own annotations
CREATE POLICY "Users can update own annotations"
    ON public.user_contact_annotations FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own annotations
CREATE POLICY "Users can delete own annotations"
    ON public.user_contact_annotations FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON public.user_contact_annotations TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_annotation TO authenticated;
GRANT EXECUTE ON FUNCTION update_contact_annotation TO authenticated;
GRANT EXECUTE ON FUNCTION get_enriched_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_presence TO authenticated;
GRANT EXECUTE ON FUNCTION mark_inactive_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_online_users_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_last_active_status TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.user_contact_annotations IS 'User-specific customization and notes about other Pulse users (private to each user)';
COMMENT ON COLUMN public.user_profiles.online_status IS 'Current online status: online, offline, away, busy';
COMMENT ON COLUMN public.user_profiles.last_active_at IS 'Last time user was actively using the app';
COMMENT ON FUNCTION get_enriched_user_profile IS 'Gets user profile enriched with requesting user''s private annotations';
COMMENT ON FUNCTION update_user_presence IS 'Updates user online status and activity timestamp';
COMMENT ON FUNCTION get_last_active_status IS 'Returns human-readable last active status (e.g., "Active 5m ago")';

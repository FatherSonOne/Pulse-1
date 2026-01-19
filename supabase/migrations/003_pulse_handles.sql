-- Pulse Handles Migration
-- Adds unique handles (@username) for Pulse-to-Pulse messaging
-- Run this in your Supabase SQL Editor

-- ============================================
-- CLEANUP (in case of partial previous run)
-- Drop tables first (CASCADE will handle triggers and dependent objects)
-- ============================================
DROP TABLE IF EXISTS public.reserved_handles CASCADE;
DROP TABLE IF EXISTS public.pulse_conversations CASCADE;
DROP TABLE IF EXISTS public.pulse_messages CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Drop functions (may exist without tables)
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS mark_messages_read(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS send_pulse_message(UUID, UUID, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_or_create_conversation(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS search_users(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS is_handle_available(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop trigger on auth.users (this table always exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================
-- USER PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT UNIQUE,
    display_name TEXT,
    full_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    phone TEXT,
    is_public BOOLEAN DEFAULT true,  -- Can be found by other users
    is_verified BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Handle format validation: lowercase, alphanumeric, underscores, 3-30 chars
    -- NOTE: Using LEFT/RIGHT instead of LIKE because _ is a wildcard in SQL LIKE patterns
    CONSTRAINT valid_handle CHECK (
        handle IS NULL OR
        (
            handle ~ '^[a-z0-9_]{3,30}$' AND
            handle NOT LIKE '%\_\_%' ESCAPE '\' AND
            LEFT(handle, 1) != '_' AND
            RIGHT(handle, 1) != '_'
        )
    )
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_handle ON public.user_profiles(handle);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON public.user_profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON public.user_profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_public ON public.user_profiles(is_public) WHERE is_public = true;

-- Full-text search index for name searching
CREATE INDEX IF NOT EXISTS idx_user_profiles_search ON public.user_profiles
    USING gin(to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(full_name, '') || ' ' || coalesce(handle, '')));

-- ============================================
-- PULSE MESSAGES TABLE
-- Direct messages between Pulse users
-- ============================================
CREATE TABLE public.pulse_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id UUID,  -- For grouping conversations

    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text',  -- 'text', 'image', 'voice', 'file'
    media_url TEXT,

    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent self-messaging
    CONSTRAINT no_self_message CHECK (sender_id != recipient_id)
);

-- Create indexes for fast message queries
CREATE INDEX IF NOT EXISTS idx_pulse_messages_sender ON public.pulse_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_messages_recipient ON public.pulse_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_messages_thread ON public.pulse_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_messages_unread ON public.pulse_messages(recipient_id, is_read) WHERE is_read = false;

-- Composite index for conversation lookup (between two users)
CREATE INDEX IF NOT EXISTS idx_pulse_messages_conversation ON public.pulse_messages(
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
);

-- ============================================
-- PULSE CONVERSATIONS TABLE
-- Track conversations between users
-- ============================================
CREATE TABLE public.pulse_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    last_message_id UUID REFERENCES public.pulse_messages(id),
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,

    user1_unread_count INTEGER DEFAULT 0,
    user2_unread_count INTEGER DEFAULT 0,

    is_archived_by_user1 BOOLEAN DEFAULT false,
    is_archived_by_user2 BOOLEAN DEFAULT false,
    is_muted_by_user1 BOOLEAN DEFAULT false,
    is_muted_by_user2 BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent same user in both slots
    CONSTRAINT different_users CHECK (user1_id != user2_id)
);

-- Unique index to ensure one conversation per user pair (order doesn't matter)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pulse_conversations_unique_pair
    ON public.pulse_conversations (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));

-- Index for finding conversations by user
CREATE INDEX IF NOT EXISTS idx_pulse_conversations_user1 ON public.pulse_conversations(user1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_conversations_user2 ON public.pulse_conversations(user2_id, last_message_at DESC);

-- ============================================
-- HANDLE RESERVATION TABLE
-- Reserved/blocked handles
-- ============================================
CREATE TABLE public.reserved_handles (
    handle TEXT PRIMARY KEY,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some reserved handles
INSERT INTO public.reserved_handles (handle, reason) VALUES
    ('admin', 'System reserved'),
    ('pulse', 'Brand reserved'),
    ('support', 'System reserved'),
    ('help', 'System reserved'),
    ('system', 'System reserved'),
    ('bot', 'System reserved'),
    ('official', 'System reserved'),
    ('team', 'System reserved'),
    ('staff', 'System reserved'),
    ('mod', 'System reserved'),
    ('moderator', 'System reserved'),
    ('logosvision', 'Brand reserved'),
    ('logos_vision', 'Brand reserved')
ON CONFLICT (handle) DO NOTHING;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to check if handle is available
CREATE OR REPLACE FUNCTION is_handle_available(check_handle TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check format (3-30 chars, lowercase alphanumeric and underscores)
    IF NOT (check_handle ~ '^[a-z0-9_]{3,30}$') THEN
        RETURN false;
    END IF;

    -- Check double underscores (escape _ with backslash in LIKE pattern)
    IF check_handle LIKE '%\_\_%' ESCAPE '\' THEN
        RETURN false;
    END IF;

    -- Check leading/trailing underscore (use substring/position instead of LIKE)
    IF LEFT(check_handle, 1) = '_' OR RIGHT(check_handle, 1) = '_' THEN
        RETURN false;
    END IF;

    -- Check reserved
    IF EXISTS (SELECT 1 FROM public.reserved_handles WHERE handle = check_handle) THEN
        RETURN false;
    END IF;

    -- Check taken
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE handle = check_handle) THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users by handle or name
CREATE OR REPLACE FUNCTION search_users(search_query TEXT, limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    id UUID,
    handle TEXT,
    display_name TEXT,
    full_name TEXT,
    avatar_url TEXT,
    is_verified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.handle,
        p.display_name,
        p.full_name,
        p.avatar_url,
        p.is_verified
    FROM public.user_profiles p
    WHERE p.is_public = true
    AND (
        p.handle ILIKE '%' || search_query || '%'
        OR p.display_name ILIKE '%' || search_query || '%'
        OR p.full_name ILIKE '%' || search_query || '%'
    )
    ORDER BY
        CASE
            WHEN p.handle = lower(search_query) THEN 0
            WHEN p.handle LIKE lower(search_query) || '%' THEN 1
            WHEN p.display_name ILIKE search_query || '%' THEN 2
            ELSE 3
        END,
        p.display_name
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(user_a UUID, user_b UUID)
RETURNS UUID AS $$
DECLARE
    conv_id UUID;
BEGIN
    -- Try to find existing conversation
    SELECT id INTO conv_id
    FROM public.pulse_conversations
    WHERE (user1_id = LEAST(user_a, user_b) AND user2_id = GREATEST(user_a, user_b));

    -- Create if not exists
    IF conv_id IS NULL THEN
        INSERT INTO public.pulse_conversations (user1_id, user2_id)
        VALUES (LEAST(user_a, user_b), GREATEST(user_a, user_b))
        RETURNING id INTO conv_id;
    END IF;

    RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a pulse message
CREATE OR REPLACE FUNCTION send_pulse_message(
    p_sender_id UUID,
    p_recipient_id UUID,
    p_content TEXT,
    p_content_type TEXT DEFAULT 'text',
    p_media_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    msg_id UUID;
    conv_id UUID;
BEGIN
    -- Get or create conversation
    conv_id := get_or_create_conversation(p_sender_id, p_recipient_id);

    -- Insert message
    INSERT INTO public.pulse_messages (sender_id, recipient_id, thread_id, content, content_type, media_url)
    VALUES (p_sender_id, p_recipient_id, conv_id, p_content, p_content_type, p_media_url)
    RETURNING id INTO msg_id;

    -- Update conversation
    UPDATE public.pulse_conversations
    SET
        last_message_id = msg_id,
        last_message_at = NOW(),
        last_message_preview = LEFT(p_content, 100),
        user1_unread_count = CASE WHEN user1_id = p_recipient_id THEN user1_unread_count + 1 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN user2_id = p_recipient_id THEN user2_unread_count + 1 ELSE user2_unread_count END,
        updated_at = NOW()
    WHERE id = conv_id;

    RETURN msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(p_user_id UUID, p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Mark messages as read
    UPDATE public.pulse_messages
    SET is_read = true, read_at = NOW()
    WHERE thread_id = p_conversation_id
    AND recipient_id = p_user_id
    AND is_read = false;

    -- Reset unread count in conversation
    UPDATE public.pulse_conversations
    SET
        user1_unread_count = CASE WHEN user1_id = p_user_id THEN 0 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN user2_id = p_user_id THEN 0 ELSE user2_unread_count END,
        updated_at = NOW()
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pulse_messages_updated_at ON public.pulse_messages;
CREATE TRIGGER update_pulse_messages_updated_at
    BEFORE UPDATE ON public.pulse_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pulse_conversations_updated_at ON public.pulse_conversations;
CREATE TRIGGER update_pulse_conversations_updated_at
    BEFORE UPDATE ON public.pulse_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, display_name, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserved_handles ENABLE ROW LEVEL SECURITY;

-- User profiles: Users can view public profiles, edit own
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.user_profiles FOR SELECT
    USING (is_public = true OR id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- Pulse messages: Users can see messages they sent or received
CREATE POLICY "Users can view their messages"
    ON public.pulse_messages FOR SELECT
    USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send messages"
    ON public.pulse_messages FOR INSERT
    WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update their sent messages"
    ON public.pulse_messages FOR UPDATE
    USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Conversations: Users can see their conversations
CREATE POLICY "Users can view their conversations"
    ON public.pulse_conversations FOR SELECT
    USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Users can update their conversations"
    ON public.pulse_conversations FOR UPDATE
    USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Reserved handles: Public read
CREATE POLICY "Anyone can view reserved handles"
    ON public.reserved_handles FOR SELECT
    USING (true);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.pulse_messages TO authenticated;
GRANT ALL ON public.pulse_conversations TO authenticated;
GRANT SELECT ON public.reserved_handles TO authenticated;

GRANT EXECUTE ON FUNCTION is_handle_available TO authenticated;
GRANT EXECUTE ON FUNCTION search_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION send_pulse_message TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read TO authenticated;

COMMENT ON TABLE public.user_profiles IS 'User profiles with Pulse handles for in-app messaging';
COMMENT ON TABLE public.pulse_messages IS 'Direct messages between Pulse users';
COMMENT ON TABLE public.pulse_conversations IS 'Conversations between Pulse users';

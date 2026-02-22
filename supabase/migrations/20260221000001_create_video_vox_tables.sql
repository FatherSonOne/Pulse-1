-- Migration: Create Video Vox Tables and Functions
-- Date: 2026-02-21
-- Purpose: Add complete database schema for Video Vox (cinematic video messaging) feature
-- Features: Conversations, Video Messages, AI Analysis, Reactions, Bookmarks, Read Receipts, AI Queue
--
-- Based on TypeScript types in: src/services/voxer/voxModeTypes.ts
-- Based on service implementation in: src/services/voxer/videoVoxService.ts

-- ============================================================================
-- 1. VIDEO VOX CONVERSATIONS
-- ============================================================================
-- Main conversation threads between participants
-- Tracks participant lists, last message info, and conversation metadata

CREATE TABLE IF NOT EXISTS video_vox_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Participants (array of pulse_users.id)
    participant_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

    -- Optional title for group conversations
    title TEXT,

    -- Last message tracking (for conversation list sorting and previews)
    last_message_id UUID,
    last_message_at TIMESTAMPTZ,

    -- Creator
    created_by UUID REFERENCES pulse_users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT video_vox_conversations_has_participants CHECK (array_length(participant_ids, 1) > 0)
);

-- Set ownership
ALTER TABLE video_vox_conversations OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE video_vox_conversations IS 'Video Vox conversation threads between participants';
COMMENT ON COLUMN video_vox_conversations.participant_ids IS 'Array of pulse_users.id who are in this conversation';
COMMENT ON COLUMN video_vox_conversations.last_message_id IS 'Reference to most recent message for preview';
COMMENT ON COLUMN video_vox_conversations.last_message_at IS 'Timestamp of last message for sorting';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_vox_conversations_last_message
    ON video_vox_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_video_vox_conversations_created_by
    ON video_vox_conversations(created_by);
-- GIN index for participant array containment queries
CREATE INDEX IF NOT EXISTS idx_video_vox_conversations_participants
    ON video_vox_conversations USING GIN(participant_ids);

-- ============================================================================
-- 2. VIDEO VOX CONVERSATION MEMBERS
-- ============================================================================
-- Junction table tracking per-user conversation state
-- Manages unread counts, mute settings, and read receipts

CREATE TABLE IF NOT EXISTS video_vox_conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    conversation_id UUID NOT NULL REFERENCES video_vox_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pulse_users(id) ON DELETE CASCADE,

    -- Per-user state
    unread_count INTEGER NOT NULL DEFAULT 0,
    is_muted BOOLEAN NOT NULL DEFAULT false,
    last_read_at TIMESTAMPTZ,

    -- Timestamps
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT video_vox_conversation_members_unread_positive CHECK (unread_count >= 0),
    CONSTRAINT video_vox_conversation_members_unique UNIQUE (conversation_id, user_id)
);

-- Set ownership
ALTER TABLE video_vox_conversation_members OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE video_vox_conversation_members IS 'Per-user state for video vox conversations (unread counts, mute settings)';
COMMENT ON COLUMN video_vox_conversation_members.unread_count IS 'Number of unread messages in this conversation for this user';
COMMENT ON COLUMN video_vox_conversation_members.is_muted IS 'Whether user has muted notifications for this conversation';
COMMENT ON COLUMN video_vox_conversation_members.last_read_at IS 'Timestamp when user last marked conversation as read';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_vox_members_conversation
    ON video_vox_conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_video_vox_members_user
    ON video_vox_conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_video_vox_members_unread
    ON video_vox_conversation_members(user_id, unread_count) WHERE unread_count > 0;

-- ============================================================================
-- 3. VIDEO VOX MESSAGES
-- ============================================================================
-- Individual video messages with AI analysis fields
-- Stores video content, transcripts, summaries, and metadata

CREATE TABLE IF NOT EXISTS video_vox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Conversation reference
    conversation_id UUID NOT NULL REFERENCES video_vox_conversations(id) ON DELETE CASCADE,

    -- Sender info (denormalized for performance)
    sender_id UUID NOT NULL REFERENCES pulse_users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_handle TEXT,
    sender_avatar_url TEXT,

    -- Video content (stored in Supabase storage bucket 'voxer')
    video_url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    duration INTEGER NOT NULL, -- Duration in seconds
    width INTEGER DEFAULT 1080,
    height INTEGER DEFAULT 1920,
    file_size BIGINT, -- File size in bytes

    -- Text content
    caption TEXT,

    -- AI-generated content (populated by Gemini 2.5)
    transcript TEXT, -- Full speech transcript
    summary TEXT, -- 1-2 sentence summary
    topics TEXT[] DEFAULT ARRAY[]::TEXT[], -- Key topics/themes/keywords
    sentiment TEXT, -- 'positive', 'neutral', 'negative', or 'mixed'
    action_items TEXT[] DEFAULT ARRAY[]::TEXT[], -- Action items mentioned in video

    -- Reply threading
    reply_to_id UUID REFERENCES video_vox_messages(id) ON DELETE SET NULL,
    reply_to_timestamp INTEGER, -- Timestamp in parent video (seconds)
    quoted_text TEXT, -- Quoted transcript text from parent
    thread_count INTEGER DEFAULT 0, -- Number of replies to this message

    -- Mentions
    mentions UUID[] DEFAULT ARRAY[]::UUID[], -- Array of pulse_users.id mentioned in video

    -- Delivery status
    status TEXT NOT NULL DEFAULT 'sent', -- 'uploading', 'processing', 'sent', 'delivered', 'viewed', 'failed'
    processing_status TEXT DEFAULT 'pending', -- 'pending', 'transcribing', 'summarizing', 'complete', 'failed'

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Optional expiration (ephemeral messages)

    -- Metadata for extensibility
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Constraints
    CONSTRAINT video_vox_messages_status_check CHECK (
        status IN ('uploading', 'processing', 'sent', 'delivered', 'viewed', 'failed')
    ),
    CONSTRAINT video_vox_messages_processing_status_check CHECK (
        processing_status IN ('pending', 'transcribing', 'summarizing', 'complete', 'failed')
    ),
    CONSTRAINT video_vox_messages_sentiment_check CHECK (
        sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'mixed')
    ),
    CONSTRAINT video_vox_messages_duration_positive CHECK (duration > 0)
);

-- Set ownership
ALTER TABLE video_vox_messages OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE video_vox_messages IS 'Video messages with AI analysis (transcripts, summaries, topics, sentiment)';
COMMENT ON COLUMN video_vox_messages.transcript IS 'AI-generated transcript of spoken content (via Gemini 2.5)';
COMMENT ON COLUMN video_vox_messages.summary IS 'AI-generated 1-2 sentence summary';
COMMENT ON COLUMN video_vox_messages.topics IS 'AI-extracted key topics and keywords';
COMMENT ON COLUMN video_vox_messages.sentiment IS 'AI-analyzed overall sentiment';
COMMENT ON COLUMN video_vox_messages.action_items IS 'AI-extracted action items mentioned in video';
COMMENT ON COLUMN video_vox_messages.processing_status IS 'Status of AI processing pipeline';
COMMENT ON COLUMN video_vox_messages.reply_to_timestamp IS 'Timestamp in parent video being replied to (seconds)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_vox_messages_conversation
    ON video_vox_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_vox_messages_sender
    ON video_vox_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_vox_messages_reply_to
    ON video_vox_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_vox_messages_processing
    ON video_vox_messages(processing_status) WHERE processing_status IN ('pending', 'transcribing', 'summarizing');
CREATE INDEX IF NOT EXISTS idx_video_vox_messages_expires
    ON video_vox_messages(expires_at) WHERE expires_at IS NOT NULL;
-- Full-text search on transcripts and captions
CREATE INDEX IF NOT EXISTS idx_video_vox_messages_transcript_search
    ON video_vox_messages USING GIN(to_tsvector('english', COALESCE(transcript, '') || ' ' || COALESCE(caption, '')));

-- Now we can safely add the foreign key for last_message_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'video_vox_conversations_last_message_fkey'
    ) THEN
        ALTER TABLE video_vox_conversations
            ADD CONSTRAINT video_vox_conversations_last_message_fkey
            FOREIGN KEY (last_message_id)
            REFERENCES video_vox_messages(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 4. VIDEO VOX REACTIONS
-- ============================================================================
-- Emoji reactions on messages (can be timestamped to specific moments)

CREATE TABLE IF NOT EXISTS video_vox_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    message_id UUID NOT NULL REFERENCES video_vox_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pulse_users(id) ON DELETE CASCADE,

    -- Reaction data
    emoji TEXT NOT NULL, -- Emoji character(s)
    timestamp INTEGER, -- Optional: reaction to specific moment in video (seconds)

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: one emoji per user per message (can update timestamp)
    CONSTRAINT video_vox_reactions_unique UNIQUE (message_id, user_id, emoji)
);

-- Set ownership
ALTER TABLE video_vox_reactions OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE video_vox_reactions IS 'Emoji reactions on video messages (can be timestamped to specific moments)';
COMMENT ON COLUMN video_vox_reactions.timestamp IS 'Optional timestamp in video where reaction applies (seconds)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_vox_reactions_message
    ON video_vox_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_video_vox_reactions_user
    ON video_vox_reactions(user_id);

-- ============================================================================
-- 5. VIDEO VOX READ RECEIPTS
-- ============================================================================
-- Track when users view messages and watch duration

CREATE TABLE IF NOT EXISTS video_vox_read_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    message_id UUID NOT NULL REFERENCES video_vox_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pulse_users(id) ON DELETE CASCADE,

    -- View tracking
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    watch_duration INTEGER, -- How many seconds user watched
    completed BOOLEAN NOT NULL DEFAULT false, -- Whether user watched entire video

    -- Constraints: one receipt per user per message (upsert on conflict)
    CONSTRAINT video_vox_read_receipts_unique UNIQUE (message_id, user_id)
);

-- Set ownership
ALTER TABLE video_vox_read_receipts OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE video_vox_read_receipts IS 'Track when users view messages and how much they watch';
COMMENT ON COLUMN video_vox_read_receipts.watch_duration IS 'Number of seconds user watched (may be less than video duration)';
COMMENT ON COLUMN video_vox_read_receipts.completed IS 'Whether user watched the entire video';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_vox_receipts_message
    ON video_vox_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_video_vox_receipts_user
    ON video_vox_read_receipts(user_id, viewed_at DESC);

-- ============================================================================
-- 6. VIDEO VOX BOOKMARKS
-- ============================================================================
-- User bookmarks with optional notes and timestamps

CREATE TABLE IF NOT EXISTS video_vox_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    message_id UUID NOT NULL REFERENCES video_vox_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES pulse_users(id) ON DELETE CASCADE,

    -- Bookmark data
    note TEXT, -- Optional user note about the bookmark
    timestamp INTEGER, -- Optional: bookmark at specific moment in video (seconds)

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: one bookmark per user per message
    CONSTRAINT video_vox_bookmarks_unique UNIQUE (message_id, user_id)
);

-- Set ownership
ALTER TABLE video_vox_bookmarks OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE video_vox_bookmarks IS 'User bookmarks for video messages with optional notes and timestamps';
COMMENT ON COLUMN video_vox_bookmarks.timestamp IS 'Optional timestamp in video where bookmark points (seconds)';
COMMENT ON COLUMN video_vox_bookmarks.note IS 'User-added note about why they bookmarked this';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_vox_bookmarks_message
    ON video_vox_bookmarks(message_id);
CREATE INDEX IF NOT EXISTS idx_video_vox_bookmarks_user
    ON video_vox_bookmarks(user_id, created_at DESC);

-- ============================================================================
-- 7. VIDEO VOX AI QUEUE
-- ============================================================================
-- Queue for AI processing tasks (transcription, summarization, etc.)

CREATE TABLE IF NOT EXISTS video_vox_ai_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key
    message_id UUID NOT NULL REFERENCES video_vox_messages(id) ON DELETE CASCADE,

    -- Queue status
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    tasks TEXT[] NOT NULL DEFAULT ARRAY['transcribe', 'summarize', 'extract_topics']::TEXT[], -- Tasks to perform

    -- Processing tracking
    attempts INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT video_vox_ai_queue_status_check CHECK (
        status IN ('pending', 'processing', 'completed', 'failed')
    ),
    CONSTRAINT video_vox_ai_queue_attempts_positive CHECK (attempts >= 0)
);

-- Set ownership
ALTER TABLE video_vox_ai_queue OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE video_vox_ai_queue IS 'Queue for AI processing tasks on video messages';
COMMENT ON COLUMN video_vox_ai_queue.tasks IS 'Array of AI tasks to perform (transcribe, summarize, extract_topics, etc.)';
COMMENT ON COLUMN video_vox_ai_queue.attempts IS 'Number of processing attempts (for retry logic)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_vox_ai_queue_status
    ON video_vox_ai_queue(status, created_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_video_vox_ai_queue_message
    ON video_vox_ai_queue(message_id);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Secure access to video vox data

-- Enable RLS on all tables
ALTER TABLE video_vox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_ai_queue ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first (idempotent migration)
DO $$
BEGIN
    -- video_vox_conversations policies
    DROP POLICY IF EXISTS "Users can view own conversations" ON video_vox_conversations;
    DROP POLICY IF EXISTS "Users can create conversations" ON video_vox_conversations;
    DROP POLICY IF EXISTS "Users can update own conversations" ON video_vox_conversations;

    -- video_vox_conversation_members policies
    DROP POLICY IF EXISTS "Users can view own memberships" ON video_vox_conversation_members;
    DROP POLICY IF EXISTS "Users can create own memberships" ON video_vox_conversation_members;
    DROP POLICY IF EXISTS "Users can update own memberships" ON video_vox_conversation_members;

    -- video_vox_messages policies
    DROP POLICY IF EXISTS "Users can view messages in own conversations" ON video_vox_messages;
    DROP POLICY IF EXISTS "Users can create messages in own conversations" ON video_vox_messages;
    DROP POLICY IF EXISTS "Users can update own messages" ON video_vox_messages;
    DROP POLICY IF EXISTS "Users can delete own messages" ON video_vox_messages;

    -- video_vox_reactions policies
    DROP POLICY IF EXISTS "Users can view reactions on accessible messages" ON video_vox_reactions;
    DROP POLICY IF EXISTS "Users can create own reactions" ON video_vox_reactions;
    DROP POLICY IF EXISTS "Users can delete own reactions" ON video_vox_reactions;

    -- video_vox_read_receipts policies
    DROP POLICY IF EXISTS "Users can view read receipts on accessible messages" ON video_vox_read_receipts;
    DROP POLICY IF EXISTS "Users can manage own read receipts" ON video_vox_read_receipts;

    -- video_vox_bookmarks policies
    DROP POLICY IF EXISTS "Users can view own bookmarks" ON video_vox_bookmarks;
    DROP POLICY IF EXISTS "Users can create own bookmarks" ON video_vox_bookmarks;
    DROP POLICY IF EXISTS "Users can update own bookmarks" ON video_vox_bookmarks;
    DROP POLICY IF EXISTS "Users can delete own bookmarks" ON video_vox_bookmarks;

    -- video_vox_ai_queue policies
    DROP POLICY IF EXISTS "Users can view AI queue for own messages" ON video_vox_ai_queue;
    DROP POLICY IF EXISTS "Service role can manage AI queue" ON video_vox_ai_queue;
END $$;

-- Policies for video_vox_conversations
-- Users can view conversations they're a participant in
CREATE POLICY "Users can view own conversations"
    ON video_vox_conversations FOR SELECT
    USING (auth.uid() = ANY(participant_ids));

-- Users can create conversations (will be added as participant)
CREATE POLICY "Users can create conversations"
    ON video_vox_conversations FOR INSERT
    WITH CHECK (auth.uid() = ANY(participant_ids));

-- Users can update conversations they're in (for title, etc.)
CREATE POLICY "Users can update own conversations"
    ON video_vox_conversations FOR UPDATE
    USING (auth.uid() = ANY(participant_ids));

-- Policies for video_vox_conversation_members
-- Users can view their own memberships
CREATE POLICY "Users can view own memberships"
    ON video_vox_conversation_members FOR SELECT
    USING (auth.uid() = user_id);

-- System can create memberships (via triggers/functions)
CREATE POLICY "Users can create own memberships"
    ON video_vox_conversation_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own membership settings
CREATE POLICY "Users can update own memberships"
    ON video_vox_conversation_members FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies for video_vox_messages
-- Users can view messages in conversations they're part of
CREATE POLICY "Users can view messages in own conversations"
    ON video_vox_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM video_vox_conversations
            WHERE video_vox_conversations.id = video_vox_messages.conversation_id
            AND auth.uid() = ANY(video_vox_conversations.participant_ids)
        )
    );

-- Users can create messages in conversations they're part of
CREATE POLICY "Users can create messages in own conversations"
    ON video_vox_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM video_vox_conversations
            WHERE video_vox_conversations.id = conversation_id
            AND auth.uid() = ANY(video_vox_conversations.participant_ids)
        )
    );

-- Users can update their own messages (for editing status, AI results)
CREATE POLICY "Users can update own messages"
    ON video_vox_messages FOR UPDATE
    USING (auth.uid() = sender_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
    ON video_vox_messages FOR DELETE
    USING (auth.uid() = sender_id);

-- Policies for video_vox_reactions
-- Users can view reactions on messages they have access to
CREATE POLICY "Users can view reactions on accessible messages"
    ON video_vox_reactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM video_vox_messages
            JOIN video_vox_conversations ON video_vox_conversations.id = video_vox_messages.conversation_id
            WHERE video_vox_messages.id = video_vox_reactions.message_id
            AND auth.uid() = ANY(video_vox_conversations.participant_ids)
        )
    );

-- Users can create their own reactions
CREATE POLICY "Users can create own reactions"
    ON video_vox_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
    ON video_vox_reactions FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for video_vox_read_receipts
-- Users can view read receipts on messages they have access to
CREATE POLICY "Users can view read receipts on accessible messages"
    ON video_vox_read_receipts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM video_vox_messages
            JOIN video_vox_conversations ON video_vox_conversations.id = video_vox_messages.conversation_id
            WHERE video_vox_messages.id = video_vox_read_receipts.message_id
            AND auth.uid() = ANY(video_vox_conversations.participant_ids)
        )
    );

-- Users can create/update their own read receipts
CREATE POLICY "Users can manage own read receipts"
    ON video_vox_read_receipts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for video_vox_bookmarks
-- Users can view their own bookmarks
CREATE POLICY "Users can view own bookmarks"
    ON video_vox_bookmarks FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own bookmarks
CREATE POLICY "Users can create own bookmarks"
    ON video_vox_bookmarks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookmarks
CREATE POLICY "Users can update own bookmarks"
    ON video_vox_bookmarks FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
    ON video_vox_bookmarks FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for video_vox_ai_queue
-- Users can view AI queue status for their messages
CREATE POLICY "Users can view AI queue for own messages"
    ON video_vox_ai_queue FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM video_vox_messages
            WHERE video_vox_messages.id = video_vox_ai_queue.message_id
            AND auth.uid() = video_vox_messages.sender_id
        )
    );

-- Service role can manage AI queue (for background processing)
CREATE POLICY "Service role can manage AI queue"
    ON video_vox_ai_queue FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 9. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_vox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update updated_at on video_vox_conversations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_update_video_vox_conversations_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_video_vox_conversations_updated_at
            BEFORE UPDATE ON video_vox_conversations
            FOR EACH ROW
            EXECUTE FUNCTION update_video_vox_updated_at();
    END IF;
END$$;

-- Function: Update conversation last_message tracking
-- This runs when a new message is inserted or a message is deleted
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
DECLARE
    v_conversation_id UUID;
    v_last_message_id UUID;
    v_last_message_at TIMESTAMPTZ;
BEGIN
    -- Get conversation_id from NEW or OLD
    v_conversation_id := COALESCE(NEW.conversation_id, OLD.conversation_id);

    -- Get the most recent message in this conversation
    SELECT id, created_at INTO v_last_message_id, v_last_message_at
    FROM video_vox_messages
    WHERE conversation_id = v_conversation_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Update the conversation
    UPDATE video_vox_conversations
    SET
        last_message_id = v_last_message_id,
        last_message_at = v_last_message_at,
        updated_at = NOW()
    WHERE id = v_conversation_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update conversation last_message on message insert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_update_last_message_on_insert'
    ) THEN
        CREATE TRIGGER trigger_update_last_message_on_insert
            AFTER INSERT ON video_vox_messages
            FOR EACH ROW
            EXECUTE FUNCTION update_conversation_last_message();
    END IF;
END$$;

-- Trigger: Update conversation last_message on message delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_update_last_message_on_delete'
    ) THEN
        CREATE TRIGGER trigger_update_last_message_on_delete
            AFTER DELETE ON video_vox_messages
            FOR EACH ROW
            EXECUTE FUNCTION update_conversation_last_message();
    END IF;
END$$;

-- Function: Increment unread count for conversation members
-- This runs when a new message is inserted
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment unread_count for all members except the sender
    UPDATE video_vox_conversation_members
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Increment unread count on new message
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_increment_unread_on_new_message'
    ) THEN
        CREATE TRIGGER trigger_increment_unread_on_new_message
            AFTER INSERT ON video_vox_messages
            FOR EACH ROW
            EXECUTE FUNCTION increment_unread_count();
    END IF;
END$$;

-- Function: Update thread_count on parent message
-- This runs when a reply is created or deleted
CREATE OR REPLACE FUNCTION update_thread_count()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_id UUID;
    v_thread_count INTEGER;
BEGIN
    -- Get parent message ID from NEW or OLD
    v_parent_id := COALESCE(NEW.reply_to_id, OLD.reply_to_id);

    -- Only proceed if this is a reply
    IF v_parent_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Count replies
    SELECT COUNT(*) INTO v_thread_count
    FROM video_vox_messages
    WHERE reply_to_id = v_parent_id;

    -- Update parent message thread_count
    UPDATE video_vox_messages
    SET thread_count = v_thread_count
    WHERE id = v_parent_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update thread count on reply insert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_update_thread_count_on_insert'
    ) THEN
        CREATE TRIGGER trigger_update_thread_count_on_insert
            AFTER INSERT ON video_vox_messages
            FOR EACH ROW
            EXECUTE FUNCTION update_thread_count();
    END IF;
END$$;

-- Trigger: Update thread count on reply delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_update_thread_count_on_delete'
    ) THEN
        CREATE TRIGGER trigger_update_thread_count_on_delete
            AFTER DELETE ON video_vox_messages
            FOR EACH ROW
            EXECUTE FUNCTION update_thread_count();
    END IF;
END$$;

-- ============================================================================
-- 10. RPC FUNCTION: Get or Create Conversation
-- ============================================================================
-- Used by videoVoxService.getOrCreateConversation()
-- Finds existing conversation with exact participant match, or creates new one

CREATE OR REPLACE FUNCTION get_or_create_video_vox_conversation(
    p_participant_ids UUID[],
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_participant_id UUID;
BEGIN
    -- Sort participant IDs for consistent matching
    p_participant_ids := ARRAY(SELECT unnest(p_participant_ids) ORDER BY 1);

    -- Try to find existing conversation with exact same participants
    -- Compare sorted arrays for equality
    SELECT id INTO v_conversation_id
    FROM video_vox_conversations
    WHERE ARRAY(SELECT unnest(participant_ids) ORDER BY 1) = p_participant_ids
    LIMIT 1;

    -- If conversation exists, return it
    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;

    -- Otherwise, create new conversation
    INSERT INTO video_vox_conversations (participant_ids, created_by)
    VALUES (p_participant_ids, p_created_by)
    RETURNING id INTO v_conversation_id;

    -- Create conversation_members entries for all participants
    FOREACH v_participant_id IN ARRAY p_participant_ids
    LOOP
        INSERT INTO video_vox_conversation_members (conversation_id, user_id)
        VALUES (v_conversation_id, v_participant_id);
    END LOOP;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION get_or_create_video_vox_conversation IS
    'Get existing conversation with exact participant match, or create new conversation with member records';

-- ============================================================================
-- 11. GRANTS
-- ============================================================================
-- Grant appropriate permissions to roles

-- video_vox_conversations
GRANT SELECT, INSERT, UPDATE ON TABLE video_vox_conversations TO authenticated;
GRANT ALL ON TABLE video_vox_conversations TO service_role;

-- video_vox_conversation_members
GRANT SELECT, INSERT, UPDATE ON TABLE video_vox_conversation_members TO authenticated;
GRANT ALL ON TABLE video_vox_conversation_members TO service_role;

-- video_vox_messages
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE video_vox_messages TO authenticated;
GRANT ALL ON TABLE video_vox_messages TO service_role;

-- video_vox_reactions
GRANT SELECT, INSERT, DELETE ON TABLE video_vox_reactions TO authenticated;
GRANT ALL ON TABLE video_vox_reactions TO service_role;

-- video_vox_read_receipts
GRANT ALL ON TABLE video_vox_read_receipts TO authenticated;
GRANT ALL ON TABLE video_vox_read_receipts TO service_role;

-- video_vox_bookmarks
GRANT ALL ON TABLE video_vox_bookmarks TO authenticated;
GRANT ALL ON TABLE video_vox_bookmarks TO service_role;

-- video_vox_ai_queue
GRANT SELECT ON TABLE video_vox_ai_queue TO authenticated;
GRANT ALL ON TABLE video_vox_ai_queue TO service_role;

-- Grant execute on RPC function
GRANT EXECUTE ON FUNCTION get_or_create_video_vox_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_video_vox_conversation TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration: create_video_vox_tables.sql';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Successfully created Video Vox database schema:';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables:';
    RAISE NOTICE '  ✓ video_vox_conversations - Conversation threads';
    RAISE NOTICE '  ✓ video_vox_conversation_members - Per-user conversation state';
    RAISE NOTICE '  ✓ video_vox_messages - Video messages with AI analysis';
    RAISE NOTICE '  ✓ video_vox_reactions - Emoji reactions (with timestamps)';
    RAISE NOTICE '  ✓ video_vox_read_receipts - View tracking';
    RAISE NOTICE '  ✓ video_vox_bookmarks - User bookmarks with notes';
    RAISE NOTICE '  ✓ video_vox_ai_queue - AI processing queue';
    RAISE NOTICE '';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  ✓ Row Level Security (RLS) policies on all tables';
    RAISE NOTICE '  ✓ Automatic unread count tracking';
    RAISE NOTICE '  ✓ Automatic last_message tracking';
    RAISE NOTICE '  ✓ Automatic thread_count tracking';
    RAISE NOTICE '  ✓ Full-text search on transcripts and captions';
    RAISE NOTICE '  ✓ get_or_create_video_vox_conversation() RPC function';
    RAISE NOTICE '';
    RAISE NOTICE 'AI Analysis Fields:';
    RAISE NOTICE '  ✓ transcript - Full speech transcript (Gemini 2.5)';
    RAISE NOTICE '  ✓ summary - 1-2 sentence summary';
    RAISE NOTICE '  ✓ topics - Key topics/keywords array';
    RAISE NOTICE '  ✓ sentiment - Emotional analysis';
    RAISE NOTICE '  ✓ action_items - Extracted action items';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for Video Vox feature!';
    RAISE NOTICE '============================================';
END $$;

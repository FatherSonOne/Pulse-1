-- Video Vox Database Schema
-- Video messaging with AI-powered transcription, summaries, reactions, and replies

-- ============================================
-- VIDEO VOX CONVERSATIONS
-- ============================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS video_vox_reactions CASCADE;
DROP TABLE IF EXISTS video_vox_replies CASCADE;
DROP TABLE IF EXISTS video_vox_messages CASCADE;
DROP TABLE IF EXISTS video_vox_conversations CASCADE;

-- Video Vox Conversations (1:1 and group video threads)
CREATE TABLE video_vox_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_ids UUID[] NOT NULL,
  title TEXT,  -- Optional title for group conversations
  last_message_id UUID,
  last_message_at TIMESTAMPTZ,
  created_by UUID REFERENCES pulse_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_vox_conversations_participants ON video_vox_conversations USING GIN(participant_ids);
CREATE INDEX idx_video_vox_conversations_last_message ON video_vox_conversations(last_message_at DESC);

-- Per-user conversation metadata (unread counts, muting, etc.)
CREATE TABLE video_vox_conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES video_vox_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  unread_count INTEGER DEFAULT 0,
  is_muted BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_video_vox_members_user ON video_vox_conversation_members(user_id);
CREATE INDEX idx_video_vox_members_conversation ON video_vox_conversation_members(conversation_id);

-- ============================================
-- VIDEO VOX MESSAGES
-- ============================================

CREATE TABLE video_vox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES video_vox_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES pulse_users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_handle TEXT,
  sender_avatar_url TEXT,

  -- Video content
  video_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  duration INTEGER NOT NULL,  -- Duration in seconds
  width INTEGER DEFAULT 1080,
  height INTEGER DEFAULT 1920,
  file_size INTEGER,  -- Size in bytes

  -- Text content
  caption TEXT,  -- User-provided caption (max 200 chars)

  -- AI-generated content
  transcript TEXT,  -- Full speech-to-text transcript
  summary TEXT,  -- AI-generated summary of the video content
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],  -- AI-extracted topics/keywords
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  action_items TEXT[] DEFAULT ARRAY[]::TEXT[],  -- AI-extracted action items

  -- Reply threading
  reply_to_id UUID REFERENCES video_vox_messages(id) ON DELETE SET NULL,
  reply_to_timestamp INTEGER,  -- Timestamp in the parent video being referenced
  quoted_text TEXT,  -- Excerpt from parent transcript
  thread_count INTEGER DEFAULT 0,  -- Number of replies to this message

  -- Mentions
  mentions UUID[] DEFAULT ARRAY[]::UUID[],  -- Tagged users in the video

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('uploading', 'processing', 'sent', 'delivered', 'viewed', 'failed')),
  processing_status TEXT CHECK (processing_status IN ('pending', 'transcribing', 'summarizing', 'complete', 'failed')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- Optional expiry for ephemeral videos

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb  -- For additional extensible data
);

CREATE INDEX idx_video_vox_messages_conversation ON video_vox_messages(conversation_id);
CREATE INDEX idx_video_vox_messages_sender ON video_vox_messages(sender_id);
CREATE INDEX idx_video_vox_messages_created ON video_vox_messages(created_at DESC);
CREATE INDEX idx_video_vox_messages_reply ON video_vox_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_video_vox_messages_topics ON video_vox_messages USING GIN(topics);
CREATE INDEX idx_video_vox_messages_mentions ON video_vox_messages USING GIN(mentions);

-- ============================================
-- VIDEO VOX REACTIONS
-- ============================================

CREATE TABLE video_vox_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES video_vox_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,  -- The reaction emoji
  timestamp INTEGER,  -- Optional: reaction to a specific moment in the video
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)  -- One reaction type per user per message
);

CREATE INDEX idx_video_vox_reactions_message ON video_vox_reactions(message_id);
CREATE INDEX idx_video_vox_reactions_user ON video_vox_reactions(user_id);

-- ============================================
-- VIDEO VOX READ RECEIPTS
-- ============================================

CREATE TABLE video_vox_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES video_vox_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  watch_duration INTEGER,  -- How many seconds they watched
  completed BOOLEAN DEFAULT FALSE,  -- Did they watch the whole thing
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_video_vox_receipts_message ON video_vox_read_receipts(message_id);
CREATE INDEX idx_video_vox_receipts_user ON video_vox_read_receipts(user_id);

-- ============================================
-- VIDEO VOX BOOKMARKS/SAVES
-- ============================================

CREATE TABLE video_vox_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES pulse_users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES video_vox_messages(id) ON DELETE CASCADE,
  note TEXT,  -- Optional note about why they saved it
  timestamp INTEGER,  -- Bookmark at a specific moment
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX idx_video_vox_bookmarks_user ON video_vox_bookmarks(user_id);

-- ============================================
-- VIDEO VOX AI ANALYSIS QUEUE
-- ============================================

CREATE TABLE video_vox_ai_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES video_vox_messages(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  tasks TEXT[] DEFAULT ARRAY['transcribe', 'summarize', 'extract_topics']::TEXT[],
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_vox_ai_queue_status ON video_vox_ai_queue(status) WHERE status = 'pending';
CREATE INDEX idx_video_vox_ai_queue_message ON video_vox_ai_queue(message_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Update conversation last_message when new message is inserted
CREATE OR REPLACE FUNCTION update_video_vox_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE video_vox_conversations
  SET
    last_message_id = NEW.id,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_video_vox_message_insert
  AFTER INSERT ON video_vox_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_video_vox_conversation_last_message();

-- Increment unread counts for other participants
CREATE OR REPLACE FUNCTION increment_video_vox_unread()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE video_vox_conversation_members
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_video_vox_increment_unread
  AFTER INSERT ON video_vox_messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_video_vox_unread();

-- Update thread count when reply is added
CREATE OR REPLACE FUNCTION update_video_vox_thread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reply_to_id IS NOT NULL THEN
    UPDATE video_vox_messages
    SET thread_count = thread_count + 1
    WHERE id = NEW.reply_to_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_video_vox_thread_count
  AFTER INSERT ON video_vox_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_video_vox_thread_count();

-- Get or create conversation between participants
CREATE OR REPLACE FUNCTION get_or_create_video_vox_conversation(
  p_participant_ids UUID[],
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_sorted_ids UUID[];
BEGIN
  -- Sort participant IDs for consistent lookup
  SELECT ARRAY_AGG(id ORDER BY id) INTO v_sorted_ids FROM UNNEST(p_participant_ids) AS id;

  -- Try to find existing conversation with exact same participants
  SELECT id INTO v_conversation_id
  FROM video_vox_conversations
  WHERE participant_ids @> v_sorted_ids
    AND participant_ids <@ v_sorted_ids;

  -- If not found, create new conversation
  IF v_conversation_id IS NULL THEN
    INSERT INTO video_vox_conversations (participant_ids, created_by)
    VALUES (v_sorted_ids, p_created_by)
    RETURNING id INTO v_conversation_id;

    -- Add all participants as members
    INSERT INTO video_vox_conversation_members (conversation_id, user_id)
    SELECT v_conversation_id, UNNEST(v_sorted_ids);
  END IF;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE video_vox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_vox_ai_queue ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now, auth handled at app level)
CREATE POLICY "Allow all on video_vox_conversations" ON video_vox_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on video_vox_conversation_members" ON video_vox_conversation_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on video_vox_messages" ON video_vox_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on video_vox_reactions" ON video_vox_reactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on video_vox_read_receipts" ON video_vox_read_receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on video_vox_bookmarks" ON video_vox_bookmarks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on video_vox_ai_queue" ON video_vox_ai_queue FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- UPDATE STORAGE BUCKET FOR VIDEO FILES
-- ============================================

-- Update voxer bucket to include video MIME types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a',
  'video/webm', 'video/mp4', 'video/quicktime', 'video/x-m4v',
  'image/jpeg', 'image/png', 'image/webp'  -- For thumbnails
]::text[]
WHERE id = 'voxer';

-- ============================================
-- SAMPLE VIEWS FOR COMMON QUERIES
-- ============================================

-- View for conversation list with last message preview
CREATE OR REPLACE VIEW video_vox_conversation_list AS
SELECT
  c.id,
  c.participant_ids,
  c.title,
  c.last_message_at,
  c.created_at,
  m.caption AS last_message_caption,
  m.sender_name AS last_message_sender,
  m.duration AS last_message_duration,
  m.thumbnail_url AS last_message_thumbnail
FROM video_vox_conversations c
LEFT JOIN video_vox_messages m ON c.last_message_id = m.id
ORDER BY c.last_message_at DESC NULLS LAST;

-- View for messages with reaction counts
CREATE OR REPLACE VIEW video_vox_messages_with_reactions AS
SELECT
  m.*,
  COALESCE(
    jsonb_object_agg(r.emoji, r.count) FILTER (WHERE r.emoji IS NOT NULL),
    '{}'::jsonb
  ) AS reaction_counts
FROM video_vox_messages m
LEFT JOIN (
  SELECT message_id, emoji, COUNT(*) as count
  FROM video_vox_reactions
  GROUP BY message_id, emoji
) r ON m.id = r.message_id
GROUP BY m.id;

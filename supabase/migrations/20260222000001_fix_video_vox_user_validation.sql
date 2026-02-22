-- Migration: Fix Video Vox RPC Function - Validate Pulse Users
-- Date: 2026-02-22
-- Purpose: Fix foreign key constraint error by validating participant IDs exist in pulse_users

-- Drop and recreate the get_or_create_video_vox_conversation function
-- with proper validation
DROP FUNCTION IF EXISTS get_or_create_video_vox_conversation(UUID[], UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_or_create_video_vox_conversation(
    p_participant_ids UUID[],
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_participant_id UUID;
    v_valid_participant_ids UUID[];
BEGIN
    -- Sort participant IDs for consistent matching
    p_participant_ids := ARRAY(SELECT unnest(p_participant_ids) ORDER BY 1);

    -- Filter to only include participant IDs that actually exist in pulse_users
    -- This prevents foreign key constraint violations
    SELECT ARRAY(
        SELECT DISTINCT unnest(p_participant_ids)
        WHERE unnest IN (SELECT id FROM pulse_users)
    ) INTO v_valid_participant_ids;

    -- Ensure we have at least one valid participant
    IF array_length(v_valid_participant_ids, 1) IS NULL OR array_length(v_valid_participant_ids, 1) = 0 THEN
        RAISE EXCEPTION 'No valid pulse_users found in participant list';
    END IF;

    -- Try to find existing conversation with exact same participants
    -- Compare sorted arrays for equality
    SELECT id INTO v_conversation_id
    FROM video_vox_conversations
    WHERE ARRAY(SELECT unnest(participant_ids) ORDER BY 1) = v_valid_participant_ids
    LIMIT 1;

    -- If conversation exists, return it
    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;

    -- Otherwise, create new conversation with only valid participants
    INSERT INTO video_vox_conversations (participant_ids, created_by)
    VALUES (v_valid_participant_ids, p_created_by)
    RETURNING id INTO v_conversation_id;

    -- Create conversation_members entries for all valid participants
    FOREACH v_participant_id IN ARRAY v_valid_participant_ids
    LOOP
        INSERT INTO video_vox_conversation_members (conversation_id, user_id)
        VALUES (v_conversation_id, v_participant_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING; -- Prevent duplicates
    END LOOP;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment
COMMENT ON FUNCTION get_or_create_video_vox_conversation IS
    'Get existing conversation with exact participant match, or create new conversation. Only includes participants that exist in pulse_users table.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_video_vox_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_video_vox_conversation TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration: fix_video_vox_user_validation.sql';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Fixed Video Vox RPC function:';
    RAISE NOTICE '';
    RAISE NOTICE '  ✓ Validates participant IDs exist in pulse_users';
    RAISE NOTICE '  ✓ Filters out invalid contact IDs';
    RAISE NOTICE '  ✓ Prevents foreign key constraint violations';
    RAISE NOTICE '  ✓ Added ON CONFLICT handling for member inserts';
    RAISE NOTICE '';
    RAISE NOTICE 'Video Vox conversations now work with contact lists!';
    RAISE NOTICE '============================================';
END $$;

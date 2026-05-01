-- Fix get_or_create_video_vox_conversation RPC
-- ============================================================================
-- The version installed by 20260221000001_create_video_vox_tables.sql uses
--   ARRAY(SELECT unnest(...) ORDER BY 1)
-- which fails on Postgres with: 'column "unnest" does not exist' (42703).
-- The set-returning function in the SELECT list creates an implicit column
-- whose positional reference is brittle across PG versions.
--
-- Replace with the well-tested pattern:
--   ARRAY_AGG(id ORDER BY id) FROM UNNEST(arr) AS t(id)
-- and use array containment (@> and <@) for set-equality matching.

CREATE OR REPLACE FUNCTION public.get_or_create_video_vox_conversation(
    p_participant_ids UUID[],
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_sorted_ids UUID[];
    v_participant_id UUID;
BEGIN
    -- Deduplicate + sort participant IDs for consistent matching.
    SELECT ARRAY_AGG(DISTINCT id ORDER BY id)
    INTO v_sorted_ids
    FROM UNNEST(p_participant_ids) AS t(id);

    IF v_sorted_ids IS NULL OR array_length(v_sorted_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'p_participant_ids must contain at least one user id';
    END IF;

    -- Find an existing conversation whose participant set exactly matches.
    -- Mutual containment (@> and <@) is set-equality and ignores order.
    SELECT id INTO v_conversation_id
    FROM video_vox_conversations
    WHERE participant_ids @> v_sorted_ids
      AND participant_ids <@ v_sorted_ids
    LIMIT 1;

    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;

    -- Otherwise create a new conversation with the sorted, deduped array.
    INSERT INTO video_vox_conversations (participant_ids, created_by)
    VALUES (v_sorted_ids, p_created_by)
    RETURNING id INTO v_conversation_id;

    -- Create membership rows for each participant.
    FOREACH v_participant_id IN ARRAY v_sorted_ids
    LOOP
        INSERT INTO video_vox_conversation_members (conversation_id, user_id)
        VALUES (v_conversation_id, v_participant_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_or_create_video_vox_conversation IS
    'Get or create a Glimpse conversation for an exact set of participants. '
    'Uses ARRAY_AGG over UNNEST(...) for ordering (PG-version-portable); '
    'matches via array containment in both directions (set-equality).';

GRANT EXECUTE ON FUNCTION public.get_or_create_video_vox_conversation(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_video_vox_conversation(UUID[], UUID) TO service_role;

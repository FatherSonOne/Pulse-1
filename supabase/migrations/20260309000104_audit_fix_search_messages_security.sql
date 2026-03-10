-- ============================================================
-- MIGRATION: 20260309000104_audit_fix_search_messages_security.sql
-- PURPOSE:   Fix search_messages() SECURITY DEFINER function which
--            currently bypasses RLS and has no user-scope filter.
--            Add explicit auth.uid() scoping so users only search
--            their own messages.
--            Also add REVOKE PUBLIC and explicit grants.
-- ISSUE:     H-5 from 2026-03-09 database audit
-- SAFE:      CREATE OR REPLACE
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.search_messages(
  search_query     TEXT,
  p_thread_id      UUID    DEFAULT NULL,
  p_start_date     TIMESTAMPTZ DEFAULT NULL,
  p_end_date       TIMESTAMPTZ DEFAULT NULL,
  p_has_attachments BOOLEAN DEFAULT NULL,
  p_limit          INTEGER DEFAULT 50,
  p_offset         INTEGER DEFAULT 0
)
RETURNS TABLE (
  id             UUID,
  text           TEXT,
  thread_id      UUID,
  sender         TEXT,
  created_at     TIMESTAMPTZ,
  attachment_url TEXT,
  rank           REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.text,
    m.thread_id,
    m.sender,
    m.created_at,
    m.attachment_url,
    ts_rank(m.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM public.messages m
  WHERE
    -- Scope to calling user's messages only
    m.user_id = v_uid
    AND m.search_vector @@ websearch_to_tsquery('english', search_query)
    AND (p_thread_id   IS NULL OR m.thread_id    = p_thread_id)
    AND (p_start_date  IS NULL OR m.created_at  >= p_start_date)
    AND (p_end_date    IS NULL OR m.created_at  <= p_end_date)
    AND (p_has_attachments IS NULL OR
         (p_has_attachments = TRUE  AND m.attachment_url IS NOT NULL) OR
         (p_has_attachments = FALSE AND m.attachment_url IS NULL))
  ORDER BY rank DESC, m.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL  ON FUNCTION public.search_messages(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_messages(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, INTEGER, INTEGER) TO authenticated;

COMMIT;

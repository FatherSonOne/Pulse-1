-- Migration: 20260228000001_fix_search_suggestions_injection.sql
-- PURPOSE: Fix SQL injection risk in get_search_suggestions() by using
--          format(%L) for safe literal quoting instead of string concatenation.
-- RELATES TO: SEARCH-AUDIT-2026-02-27 Defect 3 (P0)

BEGIN;

CREATE OR REPLACE FUNCTION get_search_suggestions(
  partial_query TEXT,
  p_thread_id   UUID,
  p_limit       INTEGER DEFAULT 10
)
RETURNS TABLE (suggestion TEXT, frequency BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- format(%L) is PostgreSQL's built-in literal quoting — properly escapes
  -- the value, eliminating injection risk while satisfying ts_stat()'s
  -- requirement for a SQL string argument.
  RETURN QUERY
  SELECT
    word   AS suggestion,
    ndoc   AS frequency
  FROM ts_stat(
    format(
      'SELECT search_vector FROM public.messages WHERE thread_id = %L',
      p_thread_id::text
    )
  )
  WHERE word ILIKE partial_query || '%'
  ORDER BY ndoc DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION get_search_suggestions(TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_search_suggestions(TEXT, UUID, INTEGER) TO authenticated;

COMMIT;
